import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type PaymentMethod = "CARD" | "GCASH" | "MAYA" | "QRPH";
export type PaymentStatus = "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
export type PaymentRequest = { saleId: string; amount: number; currency: string; method: PaymentMethod; idempotencyKey: string; successUrl?: string; cancelUrl?: string };
export type PaymentResult = { status: PaymentStatus; provider: string; providerReference: string | null; checkoutUrl?: string; paymentReference?: string; referenceNumber?: string; amountMinor?: number; currency?: string; failureCode?: string };

export const isPaymentInProgress = (status: PaymentStatus) => status === "PENDING" || status === "AUTHORIZED";

export type PayMongoWebhook = { eventId: string | null; eventType: string; liveMode: boolean; providerReference: string };

export const verifyPayMongoWebhookSignature = (rawBody: Buffer, signatureHeader: string | undefined, secret: string, liveMode: boolean) => {
  if (!signatureHeader || !secret) return false;
  const parts = new Map(signatureHeader.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part.trim(), ""] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
  const timestamp = parts.get("t");
  const signature = parts.get(liveMode ? "li" : "te");
  if (!timestamp || !/^\d+$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const provided = Buffer.from(signature, "hex");
  const expected = createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])).digest();
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

export const parsePayMongoWebhook = (payload: unknown): PayMongoWebhook | null => {
  if (!payload || typeof payload !== "object") return null;
  const event = (payload as { data?: unknown }).data;
  if (!event || typeof event !== "object") return null;
  const eventData = event as { id?: unknown; attributes?: unknown };
  if (!eventData.attributes || typeof eventData.attributes !== "object") return null;
  const attributes = eventData.attributes as { type?: unknown; livemode?: unknown; data?: unknown };
  if (typeof attributes.type !== "string" || typeof attributes.livemode !== "boolean" || !attributes.data || typeof attributes.data !== "object") return null;
  const resource = attributes.data as { id?: unknown; type?: unknown; attributes?: unknown };
  const resourceAttributes = resource.attributes && typeof resource.attributes === "object" ? resource.attributes as { checkout_session_id?: unknown; checkout_session?: unknown } : {};
  const nestedSession = resourceAttributes.checkout_session && typeof resourceAttributes.checkout_session === "object" ? (resourceAttributes.checkout_session as { id?: unknown }).id : undefined;
  const reference = resource.type === "checkout_session" ? resource.id : resourceAttributes.checkout_session_id ?? nestedSession;
  if (typeof reference !== "string" || !reference) return null;
  return {
    eventId: typeof eventData.id === "string" ? eventData.id : null,
    eventType: attributes.type,
    liveMode: attributes.livemode,
    providerReference: reference,
  };
};

export interface PaymentProvider {
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  getPayment(providerReference: string): Promise<PaymentResult | null>;
  getRefundStatus?(refundReference: string): Promise<PaymentResult | null>;
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

  async getRefundStatus(refundReference: string) {
    return this.byReference.get(refundReference) ?? null;
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

  async getRefundStatus(refundReference: string): Promise<PaymentResult | null> {
    try {
      const payload = await this.fetchJson<{ status?: string; id?: string; reference?: string; provider_reference?: string; failure_code?: string; }>(`/refunds/${encodeURIComponent(refundReference)}`, { method: "GET" });
      return {
        status: normalizeSandboxStatus(payload.status ?? "PENDING"),
        provider: "SANDBOX",
        providerReference: String(payload.reference ?? payload.provider_reference ?? payload.id ?? refundReference),
        ...(payload.failure_code ? { failureCode: String(payload.failure_code) } : {}),
      };
    } catch { return null; }
  }
}

export class PayMongoProvider extends SandboxPaymentProvider {
  constructor(baseUrl = process.env.PAYMONGO_BASE_URL ?? "https://api.paymongo.com/v1", apiKey = process.env.PAYMONGO_SECRET_KEY ?? process.env.PAYMONGO_API_KEY ?? "") {
    super(baseUrl.replace(/\/$/, ""), apiKey);
  }

  protected async request<T>(path: string, init?: RequestInit, baseUrl = this.baseUrl): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
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
    const paymentMethodTypes = request.method === "CARD" ? ["card"] : request.method === "GCASH" ? ["gcash"] : request.method === "QRPH" ? ["qrph"] : ["paymaya"];
    if (!request.successUrl || !request.cancelUrl) throw new Error("PayMongo checkout return URLs are required");
    const payload = await this.request<{ data?: { id?: string; attributes?: { checkout_url?: string } } }>("/checkout_sessions", {
      method: "POST",
      headers: { "Idempotency-Key": request.idempotencyKey },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ name: `Pharmasync sale ${request.saleId}`, amount: Math.round(request.amount * 100), currency: request.currency, quantity: 1 }],
            payment_method_types: paymentMethodTypes,
            success_url: request.successUrl,
            cancel_url: request.cancelUrl,
            reference_number: request.saleId,
          },
        },
      }),
    }, this.baseUrl.replace(/\/v1$/, "/v2"));

    const session = payload.data;
    const checkoutUrl = session?.attributes?.checkout_url;
    if (!session?.id || !checkoutUrl) throw new Error("PayMongo did not return a valid checkout session");
    return {
      status: "PENDING",
      provider: "PAYMONGO",
      providerReference: session.id,
      checkoutUrl,
    };
  }

  async getPayment(providerReference: string): Promise<PaymentResult | null> {
    try {
      const payload = await this.request<{ data?: { id?: string; attributes?: { status?: string; checkout_url?: string; reference_number?: string; payments?: { id?: string; attributes?: { status?: string; amount?: number; currency?: string } }[] } } }>(`/checkout_sessions/${encodeURIComponent(providerReference)}`);
      const attrs = payload.data?.attributes ?? {};
      const paidPayment = attrs.payments?.find((payment) => payment.attributes?.status?.toLowerCase() === "paid");
      const paymentStatuses = attrs.payments?.map((payment) => payment.attributes?.status?.toLowerCase()) ?? [];
      const sessionStatus = attrs.status?.toLowerCase();
      const status: PaymentStatus = paymentStatuses.includes("paid") || sessionStatus === "paid" ? "PAID"
        : paymentStatuses.some((paymentStatus) => paymentStatus === "failed" || paymentStatus === "declined") ? "FAILED"
        : paymentStatuses.some((paymentStatus) => paymentStatus === "cancelled" || paymentStatus === "canceled") ? "CANCELLED"
        : sessionStatus === "expired" ? "EXPIRED"
        : sessionStatus === "cancelled" || sessionStatus === "canceled" ? "CANCELLED"
        : sessionStatus === "failed" ? "FAILED"
        : "PENDING";
      return {
        status,
        provider: "PAYMONGO",
        providerReference: String(payload.data?.id ?? providerReference),
        ...(attrs.checkout_url ? { checkoutUrl: attrs.checkout_url } : {}),
        ...(attrs.reference_number ? { referenceNumber: attrs.reference_number } : {}),
        ...(paidPayment?.id ? { paymentReference: paidPayment.id } : {}),
        ...(paidPayment?.attributes?.amount !== undefined ? { amountMinor: paidPayment.attributes.amount } : {}),
        ...(paidPayment?.attributes?.currency ? { currency: paidPayment.attributes.currency.toUpperCase() } : {}),
      };
    } catch {
      return null;
    }
  }

  async cancelPayment(providerReference: string): Promise<PaymentResult | null> {
    try {
      const payload = await this.request<{ data?: { id?: string; attributes?: { status?: string } } }>(`/checkout_sessions/${encodeURIComponent(providerReference)}/expire`, { method: "POST" });
      const status = payload.data?.attributes?.status?.toLowerCase();
      return {
        status: status === "paid" ? "PAID" : status === "expired" || status === "cancelled" || status === "canceled" ? "CANCELLED" : "PENDING",
        provider: "PAYMONGO",
        providerReference: String(payload.data?.id ?? providerReference),
      };
    } catch {
      return null;
    }
  }

  async refundPayment(providerReference: string, amount?: number): Promise<PaymentResult | null> {
    try {
      const payment = await this.getPayment(providerReference);
      if (!payment || payment.status !== "PAID" || !payment.paymentReference) return null;
      const refundAmount = amount === undefined ? payment.amountMinor : Math.round(amount * 100);
      if (refundAmount === undefined || refundAmount <= 0) return null;
      const payload = await this.request<{ data?: { id?: string; attributes?: { status?: string } } }>("/refunds", {
        method: "POST",
        headers: { "Idempotency-Key": `refund-${payment.paymentReference}` },
        body: JSON.stringify({
          data: {
            attributes: {
              amount: refundAmount,
              payment_id: payment.paymentReference,
              reason: "others",
            },
          },
        }),
      }, this.baseUrl.replace(/\/v2$/, "/v1"));
      return {
        status: payload.data?.attributes?.status === "succeeded" ? "REFUNDED" : payload.data?.attributes?.status === "failed" ? "FAILED" : "PENDING",
        provider: "PAYMONGO",
        providerReference: String(payload.data?.id ?? payment.paymentReference),
      };
    } catch {
      return null;
    }
  }

  async getRefundStatus(refundReference: string): Promise<PaymentResult | null> {
    try {
      const payload = await this.request<{ data?: { id?: string; attributes?: { status?: string } } }>(`/refunds/${encodeURIComponent(refundReference)}`);
      const status = payload.data?.attributes?.status?.toLowerCase();
      return {
        status: status === "succeeded" ? "REFUNDED" : status === "failed" ? "FAILED" : "PENDING",
        provider: "PAYMONGO",
        providerReference: String(payload.data?.id ?? refundReference),
      };
    } catch { return null; }
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