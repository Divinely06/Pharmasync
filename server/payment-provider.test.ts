import { describe, expect, it } from "vitest";
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

  it("only selects a configured provider", () => {
    expect(createPaymentProvider("dummy")).toBeInstanceOf(DummyPaymentProvider);
    expect(() => createPaymentProvider("unknown")).toThrow(/not configured/);
  });
});