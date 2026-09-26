import { randomUUID } from "node:crypto";

export type PaymentMethod = "CARD" | "E_WALLET";
export type PaymentStatus = "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
export type PaymentRequest = { saleId: string; amount: number; currency: string; method: PaymentMethod; idempotencyKey: string };
export type PaymentResult = { status: PaymentStatus; provider: string; providerReference: string | null; failureCode?: string };

export interface PaymentProvider {
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  getPayment(providerReference: string): Promise<PaymentResult | null>;
  cancelPayment(providerReference: string): Promise<PaymentResult | null>;
  refundPayment(providerReference: string, amount?: number): Promise<PaymentResult | null>;
}

const outcomes: Record<string, PaymentStatus> = {
  success: "PAID",
  pending: "PENDING",
  failure: "FAILED",
  cancelled: "CANCELLED",
  timeout: "EXPIRED",
};

export class DummyPaymentProvider implements PaymentProvider {
  private readonly byReference = new Map<string, PaymentResult>();
  private readonly byIdempotencyKey = new Map<string, PaymentResult>();
  private readonly outcome: PaymentStatus;

  constructor(outcomeName = process.env.DUMMY_PAYMENT_OUTCOME ?? "success") {
    const outcome = outcomes[outcomeName];
    if (!outcome) throw new Error("DUMMY_PAYMENT_OUTCOME must be success, pending, failure, cancelled, or timeout");
    this.outcome = outcome;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    const existing = this.byIdempotencyKey.get(request.idempotencyKey);
    if (existing) return existing;
    const result: PaymentResult = {
      status: this.outcome,
      provider: "DUMMY",
      providerReference: `DUMMY-${randomUUID()}`,
      ...(this.outcome === "FAILED" ? { failureCode: "SIMULATED_FAILURE" } : {}),
    };
    this.byIdempotencyKey.set(request.idempotencyKey, result);
    this.byReference.set(result.providerReference!, result);
    return result;
  }

  async getPayment(providerReference: string) {
    return this.byReference.get(providerReference) ?? null;
  }

  async cancelPayment(providerReference: string) {
    const payment = this.byReference.get(providerReference);
    if (!payment) return providerReference.startsWith("DUMMY-") ? { status: "CANCELLED" as const, provider: "DUMMY", providerReference } : null;
    if (payment.status === "PENDING" || payment.status === "AUTHORIZED") payment.status = "CANCELLED";
    return payment;
  }

  async refundPayment(providerReference: string, amount?: number) {
    const payment = this.byReference.get(providerReference);
    if (!payment) return providerReference.startsWith("DUMMY-") ? { status: "REFUNDED" as const, provider: "DUMMY", providerReference } : null;
    if (payment.status !== "PAID" || (amount !== undefined && (!Number.isFinite(amount) || amount <= 0))) return null;
    payment.status = "REFUNDED";
    return payment;
  }
}

export const createPaymentProvider = (name = process.env.PAYMENT_PROVIDER ?? "dummy"): PaymentProvider => {
  if (name === "dummy") return new DummyPaymentProvider();
  throw new Error(`Payment provider "${name}" is not configured`);
};