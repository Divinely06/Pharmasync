import { createHmac } from "node:crypto";
import { request as httpRequest, createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("pg", () => ({
  Pool: class {
    query = queryMock;
    connect = vi.fn();
  },
}));

const webhookSecret = "whsec_test_secret";
let server: Server;
let serverUrl: string;
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

const postWebhook = (body: string, timestamp: string, signature: string) => new Promise<{ statusCode: number | undefined; body: string }>((resolve, reject) => {
  const request = httpRequest(new URL(`${serverUrl}/api/webhooks/paymongo`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://events.paymongo.com",
      "PayMongo-Signature": `t=${timestamp},te=${signature}`,
    },
  }, (response) => {
    let responseBody = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => { responseBody += chunk; });
    response.on("end", () => resolve({ statusCode: response.statusCode, body: responseBody }));
  });
  request.on("error", reject);
  request.end(body);
});

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/pharmasync_test");
  vi.stubEnv("PAYMENT_PROVIDER", "paymongo");
  vi.stubEnv("PAYMONGO_SECRET_KEY", "test_secret_key");
  vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", webhookSecret);
  vi.stubEnv("CLIENT_ORIGIN", "http://localhost:4175");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "true");
  vi.resetModules();

  const app = (await import("./index.js")).default;
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  consoleError.mockRestore();
  vi.unstubAllEnvs();
  vi.resetModules();
});

beforeEach(() => queryMock.mockReset());

describe("PayMongo webhook endpoint", () => {
  it("acknowledges a valid delivery when no matching payment remains in progress", async () => {
    queryMock.mockResolvedValue({ rowCount: 0, rows: [] });
    const payload = {
      data: {
        id: "evt_123",
        attributes: {
          type: "checkout_session.payment.paid",
          livemode: false,
          data: { id: "cs_123", type: "checkout_session" },
        },
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");

    const response = await postWebhook(body, timestamp, signature);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
  });

  it("acknowledges a valid delivery when PayMongo status confirmation fails", async () => {
    queryMock.mockResolvedValue({ rowCount: 1, rows: [{ id: "pay_123", status: "PENDING" }] });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("PayMongo unavailable")) as typeof fetch;
    const payload = {
      data: {
        id: "evt_456",
        attributes: {
          type: "checkout_session.payment.paid",
          livemode: false,
          data: { id: "cs_456", type: "checkout_session" },
        },
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");

    try {
      const response = await postWebhook(body, timestamp, signature);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ received: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("acknowledges signed events that do not reference a checkout", async () => {
    const payload = {
      data: {
        id: "evt_789",
        attributes: {
          type: "customer.created",
          livemode: false,
          data: { id: "cus_789", type: "customer" },
        },
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");

    const response = await postWebhook(body, timestamp, signature);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("does not acknowledge a delivery with an invalid signature", async () => {
    const body = JSON.stringify({ data: { attributes: { type: "customer.created", livemode: false, data: { id: "cus_000", type: "customer" } } } });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const response = await postWebhook(body, timestamp, "0".repeat(64));

    expect(response.statusCode).toBe(401);
  });
});