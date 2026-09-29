import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentProvider, DummyPaymentProvider, isPaymentInProgress, verifyPayMongoWebhookSignature } from "./payment-provider.js";

const request = { saleId: "sale-1", amount: 100, currency: "PHP", method: "GCASH" as const, idempotencyKey: "checkout-1", successUrl: "https://shop.example/success", cancelUrl: "https://shop.example/cancel" };

const withPayMongoEnvironment = async (run: () => Promise<void>) => {
  const originalFetch = globalThis.fetch;
  const originalSecretKey = process.env.PAYMONGO_SECRET_KEY;
  const originalApiKey = process.env.PAYMONGO_API_KEY;
  const originalBaseUrl = process.env.PAYMONGO_BASE_URL;
  process.env.PAYMONGO_SECRET_KEY = "test_secret_key";
  process.env.PAYMONGO_BASE_URL = "https://api.paymongo.com/v1";
  try { await run(); }
  finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [["PAYMONGO_SECRET_KEY", originalSecretKey], ["PAYMONGO_API_KEY", originalApiKey], ["PAYMONGO_BASE_URL", originalBaseUrl]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

describe("dummy payment provider", () => {
  it("keeps pending and authorized payments in the in-progress flow", () => {
    expect(isPaymentInProgress("PENDING")).toBe(true);
    expect(isPaymentInProgress("AUTHORIZED")).toBe(true);
    expect(isPaymentInProgress("PAID")).toBe(false);
    expect(isPaymentInProgress("FAILED")).toBe(false);
  });

  it.each([["success", "PAID"], ["pending", "PENDING"], ["failure", "FAILED"], ["cancelled", "CANCELLED"], ["timeout", "EXPIRED"]] as const)("maps %s to %s", async (outcome, expected) => {
    const provider = new DummyPaymentProvider(outcome);
    expect((await provider.createPayment(request)).status).toBe(expected);
  });

  it("returns the same payment for a repeated idempotency key", async () => {
    const provider = new DummyPaymentProvider("success");
    const first = await provider.createPayment(request);
    expect(await provider.createPayment(request)).toEqual(first);
  });

  it("supports pending cancellation and paid refunds", async () => {
    const pending = new DummyPaymentProvider("pending");
    const pendingResult = await pending.createPayment(request);
    expect((await pending.cancelPayment(pendingResult.providerReference!))?.status).toBe("CANCELLED");
    const paid = new DummyPaymentProvider("success");
    const paidResult = await paid.createPayment({ ...request, idempotencyKey: "checkout-2" });
    expect((await paid.refundPayment(paidResult.providerReference!))?.status).toBe("REFUNDED");
  });

  it("supports dummy and sandbox selection and fails closed for missing PayMongo credentials", () => {
    expect(createPaymentProvider("dummy")).toBeInstanceOf(DummyPaymentProvider);
    expect(() => createPaymentProvider("unknown")).toThrow(/not configured/);
    expect(() => createPaymentProvider("sandbox")).not.toThrow();
    const originalSecretKey = process.env.PAYMONGO_SECRET_KEY;
    const originalApiKey = process.env.PAYMONGO_API_KEY;
    delete process.env.PAYMONGO_SECRET_KEY;
    delete process.env.PAYMONGO_API_KEY;
    try { expect(() => createPaymentProvider("paymongo")).toThrow("PAYMONGO_SECRET_KEY is required when PAYMENT_PROVIDER=paymongo"); }
    finally {
      if (originalSecretKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
      else process.env.PAYMONGO_SECRET_KEY = originalSecretKey;
      if (originalApiKey === undefined) delete process.env.PAYMONGO_API_KEY;
      else process.env.PAYMONGO_API_KEY = originalApiKey;
    }
  });
});

describe("PayMongo integration", () => {
  it("verifies mode-specific HMAC signatures and rejects tampering", () => {
    const rawBody = Buffer.from('{"data":{"id":"evt_1"}}');
    const secret = "whsec_test_secret";
    const timestamp = "1760000000";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString()}`).digest("hex");
    const header = `t=${timestamp},te=${signature},li=${"0".repeat(64)}`;
    expect(verifyPayMongoWebhookSignature(rawBody, header, secret, false)).toBe(true);
    expect(verifyPayMongoWebhookSignature(rawBody, header, secret, true)).toBe(false);
    expect(verifyPayMongoWebhookSignature(Buffer.from(`${rawBody} `), header, secret, false)).toBe(false);
  });

  it("accepts the documented raw-body HMAC signature", () => {
    const rawBody = Buffer.from('{"data":{"id":"evt_2"}}');
    const signature = createHmac("sha256", "secret").update(rawBody).digest("hex");
    expect(verifyPayMongoWebhookSignature(rawBody, `t=1760000000,li=${signature}`, "secret", true)).toBe(true);
  });

  it.each([["CARD", ["card"]], ["GCASH", ["gcash"]], ["MAYA", ["paymaya"]]] as const)("creates Hosted Checkout for %s", async (method, paymentMethodTypes) => {
    await withPayMongoEnvironment(async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: "cs_123", attributes: { checkout_url: "https://checkout.paymongo.com/cs_123" } } }) });
      globalThis.fetch = fetchMock as typeof fetch;
      const result = await createPaymentProvider("paymongo").createPayment({ ...request, method });
      expect(result).toMatchObject({ status: "PENDING", provider: "PAYMONGO", providerReference: "cs_123", checkoutUrl: "https://checkout.paymongo.com/cs_123" });
      expect(fetchMock).toHaveBeenCalledWith("https://api.paymongo.com/v2/checkout_sessions", expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": request.idempotencyKey }),
        body: expect.stringContaining(JSON.stringify(paymentMethodTypes)),
      }));
    });
  });

  it("retrieves and validates paid session details via v1", async () => {
    await withPayMongoEnvironment(async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: "cs_123", attributes: { status: "paid", reference_number: "sale-1", payments: [{ id: "pay_123", attributes: { status: "paid", amount: 10000, currency: "PHP" } }] } } }) });
      globalThis.fetch = fetchMock as typeof fetch;
      await expect(createPaymentProvider("paymongo").getPayment("cs_123")).resolves.toMatchObject({ status: "PAID", paymentReference: "pay_123", referenceNumber: "sale-1", amountMinor: 10000, currency: "PHP" });
      expect(fetchMock).toHaveBeenCalledWith("https://api.paymongo.com/v1/checkout_sessions/cs_123", expect.anything());
    });
  });

  it("maps failed payments inside active checkout sessions to FAILED", async () => {
    await withPayMongoEnvironment(async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: "cs_123", attributes: { status: "active", payments: [{ id: "pay_123", attributes: { status: "failed" } }] } } }) }) as typeof fetch;
      await expect(createPaymentProvider("paymongo").getPayment("cs_123")).resolves.toMatchObject({ status: "FAILED" });
    });
  });

  it("expires hosted sessions and refunds using the associated payment id", async () => {
    await withPayMongoEnvironment(async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "cs_123", attributes: { status: "expired" } } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "cs_123", attributes: { status: "paid", payments: [{ id: "pay_123", attributes: { status: "paid", amount: 10000, currency: "PHP" } }] } } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "ref_123", attributes: { status: "succeeded" } } }) });
      globalThis.fetch = fetchMock as typeof fetch;
      const provider = createPaymentProvider("paymongo");
      await expect(provider.cancelPayment("cs_123")).resolves.toMatchObject({ status: "CANCELLED" });
      await expect(provider.refundPayment("cs_123")).resolves.toMatchObject({ status: "REFUNDED", providerReference: "ref_123" });
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.paymongo.com/v1/checkout_sessions/cs_123/expire");
      expect(fetchMock.mock.calls[2][0]).toBe("https://api.paymongo.com/v1/refunds");
      expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({ data: { attributes: { payment_id: "pay_123", amount: 10000 } } });
    });
  });
});