import { randomUUID } from "node:crypto";

export type PaymentMethod = "CARD" | "E_WALLET";
export type PaymentStatus = "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
export type PaymentRequest = { saleId: string; amount: number; currency: string; method: PaymentMethod; idempotencyKey: string };
export type PaymentResult = { status: PaymentStatus; provider: string; providerReference: string | null; failureCode?: string };

export const isPaymentInProgress = (status: PaymentStatus) => status === "PENDING" || status === "AUTHORIZED";

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

const normalizeSandboxStatus = (value: unknown): PaymentStatus => {
  const raw = String(value ?? "").toUpperCase();
  switch (raw) {
    case "PAID":
    case "SUCCESS":
      return "PAID";
    case "PENDING":
    case "PROCESSING":
      return "PENDING";
    case "AUTHORIZED":
      return "AUTHORIZED";
    case "FAILED":
    case "DECLINED":
      return "FAILED";
    case "CANCELLED":
    case "VOIDED":
      return "CANCELLED";
    case "EXPIRED":
    case "TIMEOUT":
      return "EXPIRED";
    case "REFUNDED":
      return "REFUNDED";
    default:
      return "PENDING";
  }
};

export class SandboxPaymentProvider implements PaymentProvider {
  protected readonly baseUrl: string;
  protected readonly apiKey: string;

  constructor(baseUrl = process.env.PAYMENT_SANDBOX_BASE_URL ?? "https://sandbox.example.com/api", apiKey = process.env.PAYMENT_SANDBOX_API_KEY ?? process.env.PAYMENT_SANDBOX_SECRET_KEY ?? "sandbox-dev-key") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init?.headers ?? {}),
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload === "object" && payload && "message" in payload ? String((payload as { message?: string }).message) : "Sandbox payment request failed";
      throw new Error(message);
    }

    return payload as T;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (this.baseUrl === "https://sandbox.example.com/api" && this.apiKey === "sandbox-dev-key") {
      return {
        status: "PENDING",
        provider: "SANDBOX",
        providerReference: `sandbox-${randomUUID()}`,
      };
    }

    const payload = await this.fetchJson<{ status?: string; id?: string; reference?: string; provider_reference?: string; provider_reference_id?: string; failure_code?: string; message?: string; }>('/payments', {
      method: "POST",
      body: JSON.stringify({
        saleId: request.saleId,
        amount: request.amount,
        currency: request.currency,
        method: request.method,
        idempotencyKey: request.idempotencyKey,
      }),
    });

    return {
      status: normalizeSandboxStatus(payload.status ?? "PAID"),
      provider: "SANDBOX",
      providerReference: String(payload.reference ?? payload.provider_reference ?? payload.provider_reference_id ?? payload.id ?? `sandbox-${randomUUID()}`),
      ...(payload.failure_code ? { failureCode: String(payload.failure_code) } : {}),
    };
  }

  async getPayment(providerReference: string): Promise<PaymentResult | null> {
    try {
      const payload = await this.fetchJson<{ status?: string; id?: string; reference?: string; provider_reference?: string; failure_code?: string; }>('/payments/' + encodeURIComponent(providerReference), { method: "GET" });
      return {
        status: normalizeSandboxStatus(payload.status ?? "PAID"),
        provider: "SANDBOX",
        providerReference: String(payload.reference ?? payload.provider_reference ?? payload.id ?? providerReference),
        ...(payload.failure_code ? { failureCode: String(payload.failure_code) } : {}),
      };
    } catch {
      return null;
    }
  }

  async cancelPayment(providerReference: string): Promise<PaymentResult | null> {
    try {
      const payload = await this.fetchJson<{ status?: string; id?: string; reference?: string; provider_reference?: string; failure_code?: string; }>('/payments/' + encodeURIComponent(providerReference) + '/cancel', { method: "POST" });
      return {
        status: normalizeSandboxStatus(payload.status ?? "CANCELLED"),
        provider: "SANDBOX",
        providerReference: String(payload.reference ?? payload.provider_reference ?? payload.id ?? providerReference),
        ...(payload.failure_code ? { failureCode: String(payload.failure_code) } : {}),
      };
    } catch {
      return null;
    }
  }

  async refundPayment(providerReference: string, amount?: number): Promise<PaymentResult | null> {
    try {
      const payload = await this.fetchJson<{ status?: string; id?: string; reference?: string; provider_reference?: string; failure_code?: string; }>('/payments/' + encodeURIComponent(providerReference) + '/refund', {
        method: "POST",
        body: amount === undefined ? undefined : JSON.stringify({ amount }),
      });
      return {
        status: normalizeSandboxStatus(payload.status ?? "REFUNDED"),
        provider: "SANDBOX",
        providerReference: String(payload.reference ?? payload.provider_reference ?? payload.id ?? providerReference),
        ...(payload.failure_code ? { failureCode: String(payload.failure_code) } : {}),
      };
    } catch {
      return null;
    }
  }
}

export class PayMongoProvider extends SandboxPaymentProvider {
  constructor(baseUrl = process.env.PAYMONGO_BASE_URL ?? "https://api.paymongo.com/v1", apiKey = process.env.PAYMONGO_SECRET_KEY ?? process.env.PAYMONGO_API_KEY ?? "") {
    super(baseUrl, apiKey);
  }

  protected async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
        ...(init?.headers ?? {}),
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload === "object" && payload && "errors" in payload && Array.isArray((payload as { errors?: Array<{ detail?: string }> }).errors) ? String((payload as { errors?: Array<{ detail?: string }> }).errors?.[0]?.detail ?? "PayMongo request failed") : "PayMongo request failed";
      throw new Error(message);
    }

    return payload as T;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    const payload = await this.request<{ data?: { id?: string; attributes?: { status?: string; id?: string; payment_intent_id?: string; failure_code?: string } } }>('/payment_intents', {
      method: "POST",
      headers: { "Idempotency-Key": request.idempotencyKey },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(request.amount * 100),
            currency: request.currency.toLowerCase(),
            payment_method_allowed: request.method === "CARD" ? ["card"] : ["gcash"],
            payment_method_options: request.method === "CARD" ? { card: { request_three_d_secure: "any" } } : undefined,
            description: `Pharmasync sale ${request.saleId}`,
          },
        },
      }),
    });

    const attrs = payload.data?.attributes ?? {};
    return {
      status: attrs.status === "succeeded" ? "PAID" : attrs.status === "awaiting_payment_method" ? "PENDING" : attrs.status === "failed" ? "FAILED" : "PENDING",
      provider: "PAYMONGO",
      providerReference: String(payload.data?.id ?? attrs.payment_intent_id ?? `pm-${randomUUID()}`),
      ...(attrs.failure_code ? { failureCode: String(attrs.failure_code) } : {}),
    };
  }

  async getPayment(providerReference: string): Promise<PaymentResult | null> {
    try {
      const payload = await this.request<{ data?: { id?: string; attributes?: { status?: string; failure_code?: string } } }>(`/payment_intents/${encodeURIComponent(providerReference)}`);
      const attrs = payload.data?.attributes ?? {};
      return {
        status: attrs.status === "succeeded" ? "PAID" : attrs.status === "failed" ? "FAILED" : "PENDING",
        provider: "PAYMONGO",
        providerReference: String(payload.data?.id ?? providerReference),
        ...(attrs.failure_code ? { failureCode: String(attrs.failure_code) } : {}),
      };
    } catch {
      return null;
    }
  }

  async cancelPayment(providerReference: string): Promise<PaymentResult | null> {
    try {
      const payload = await this.request<{ data?: { id?: string; attributes?: { status?: string; failure_code?: string } } }>(`/payment_intents/${encodeURIComponent(providerReference)}/cancel`, { method: "POST" });
      const attrs = payload.data?.attributes ?? {};
      return {
        status: attrs.status === "cancelled" ? "CANCELLED" : "PENDING",
        provider: "PAYMONGO",
        providerReference: String(payload.data?.id ?? providerReference),
        ...(attrs.failure_code ? { failureCode: String(attrs.failure_code) } : {}),
      };
    } catch {
      return null;
    }
  }

  async refundPayment(providerReference: string, amount?: number): Promise<PaymentResult | null> {
    try {
      const payload = await this.request<{ data?: { id?: string; attributes?: { status?: string; failure_code?: string } } }>('/refunds', {
        method: "POST",
        body: JSON.stringify({
          data: {
            attributes: {
              amount: amount === undefined ? undefined : Math.round(amount * 100),
              payment_intent_id: providerReference,
              reason: "requested_by_customer",
            },
          },
        }),
      });
      const attrs = payload.data?.attributes ?? {};
      return {
        status: attrs.status === "refunded" ? "REFUNDED" : "PENDING",
        provider: "PAYMONGO",
        providerReference: String(payload.data?.id ?? providerReference),
        ...(attrs.failure_code ? { failureCode: String(attrs.failure_code) } : {}),
      };
    } catch {
      return null;
    }
  }
}

const isConfiguredLiveProvider = (baseUrl?: string, apiKey?: string) => {
  const normalizedBase = (baseUrl ?? "").trim();
  const normalizedKey = (apiKey ?? "").trim();
  return normalizedBase.length > 0 && normalizedBase !== "https://sandbox.example.com/api" && normalizedKey.length > 0 && normalizedKey !== "sandbox-dev-key";
};

export const createPaymentProvider = (name = process.env.PAYMENT_PROVIDER ?? "dummy"): PaymentProvider => {
  if (name === "dummy") return new DummyPaymentProvider();
  if (name === "sandbox") {
    const baseUrl = process.env.PAYMENT_SANDBOX_BASE_URL ?? "https://sandbox.example.com/api";
    const apiKey = process.env.PAYMENT_SANDBOX_API_KEY ?? process.env.PAYMENT_SANDBOX_SECRET_KEY ?? "sandbox-dev-key";
    return isConfiguredLiveProvider(baseUrl, apiKey) ? new SandboxPaymentProvider(baseUrl, apiKey) : new DummyPaymentProvider();
  }
  if (name === "paymongo") {
    const baseUrl = process.env.PAYMONGO_BASE_URL ?? "https://api.paymongo.com/v1";
    const apiKey = process.env.PAYMONGO_SECRET_KEY ?? process.env.PAYMONGO_API_KEY ?? "";
    if (!isConfiguredLiveProvider(baseUrl, apiKey)) throw new Error("PAYMONGO_SECRET_KEY is required when PAYMENT_PROVIDER=paymongo");
    return new PayMongoProvider(baseUrl, apiKey);
  }
  throw new Error(`Payment provider "${name}" is not configured`);
};