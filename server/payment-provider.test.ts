import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentProvider, DummyPaymentProvider } from "./payment-provider.js";

const request = { saleId: "sale-1", amount: 100, currency: "PHP", method: "E_WALLET" as const, idempotencyKey: "checkout-1" };

describe("dummy payment provider", () => {
  it.each([
    ["success", "PAID"],
    ["pending", "PENDING"],
    ["failure", "FAILED"],
    ["cancelled", "CANCELLED"],
    ["timeout", "EXPIRED"],
  ] as const)("maps %s to %s", async (outcome, expected) => {
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

  it("supports both dummy and sandbox provider selection", () => {
    expect(createPaymentProvider("dummy")).toBeInstanceOf(DummyPaymentProvider);
    expect(() => createPaymentProvider("unknown")).toThrow(/not configured/);
    expect(() => createPaymentProvider("sandbox")).not.toThrow();
    expect(() => createPaymentProvider("paymongo")).not.toThrow();
  });

  it("falls back to the dummy provider when the live PayMongo credentials are missing", () => {
    const originalKey = process.env.PAYMONGO_SECRET_KEY;
    delete process.env.PAYMONGO_SECRET_KEY;
    delete process.env.PAYMONGO_API_KEY;

    try {
      expect(createPaymentProvider("paymongo")).toBeInstanceOf(DummyPaymentProvider);
    } finally {
      if (originalKey) process.env.PAYMONGO_SECRET_KEY = originalKey;
    }
  });

  it("creates a PayMongo payment intent when the provider is selected", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: "pm_int_123", attributes: { status: "awaiting_payment_method" } },
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;
    process.env.PAYMONGO_SECRET_KEY = "test_secret_key";
    process.env.PAYMONGO_BASE_URL = "https://api.paymongo.com/v1";

    try {
      const provider = createPaymentProvider("paymongo");
      const result = await provider.createPayment(request);
      expect(result.provider).toBe("PAYMONGO");
      expect(result.providerReference).toBe("pm_int_123");
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.PAYMONGO_SECRET_KEY;
      delete process.env.PAYMONGO_BASE_URL;
    }
  });
});