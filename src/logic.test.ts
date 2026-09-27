import { afterEach, describe, expect, it, vi } from 'vitest';
import { canAccess, buildAuditLog, calculateTotals, dateKey, matchesMedicineCategory } from './data';
import { api } from './api';
import { normalizeDatabaseUrl } from '../server/db';
import { isRequestOriginAllowed, medicineSchema, saleSchema } from '../server/validation';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('pharmacy system logic', () => {
  it('allows admin access to reports and inventory', () => {
    expect(canAccess('ADMIN', 'REPORTS')).toBe(true);
    expect(canAccess('ADMIN', 'AUDIT')).toBe(true);
    expect(canAccess('ADMIN', 'USERS')).toBe(true);
    expect(canAccess('PHARMACIST', 'INVENTORY')).toBe(true);
    expect(canAccess('PHARMACIST', 'POS')).toBe(false);
    expect(canAccess('PHARMACIST', 'USERS')).toBe(false);
    expect(canAccess('CASHIER', 'POS')).toBe(true);
    expect(canAccess('CASHIER', 'INVENTORY')).toBe(false);
    expect(canAccess('CASHIER', 'REPORTS')).toBe(false);
    expect(canAccess('CASHIER', 'AUDIT')).toBe(false);
    expect(canAccess('CASHIER', 'USERS')).toBe(false);
  });

  it('matches plural POS categories to singular medicine types', () => {
    expect(matchesMedicineCategory('Antibiotic', 'Antibiotics')).toBe(true);
    expect(matchesMedicineCategory('Analgesic', 'Analgesics')).toBe(true);
    expect(matchesMedicineCategory('Antacid', 'Antacids')).toBe(true);
    expect(matchesMedicineCategory('Vitamin', 'Vitamins')).toBe(true);
    expect(matchesMedicineCategory('Cardiovascular', 'Antibiotics')).toBe(false);
  });

  it('creates audit entries with clear metadata', () => {
    const log = buildAuditLog({
      userId: 'u-1',
      action: 'LOGIN',
      entityType: 'USER',
      entityId: 'u-1',
      success: true,
      metadata: { ipAddress: '127.0.0.1' },
    });

    expect(log.action).toBe('LOGIN');
    expect(log.success).toBe(true);
    expect(log.metadata.ipAddress).toBe('127.0.0.1');
  });

  it('calculates correct totals for transaction lines', () => {
    const totals = calculateTotals([
      { quantity: 2, unitPrice: 15 },
      { quantity: 3, unitPrice: 10 },
    ]);

    expect(totals.subtotal).toBe(60);
    expect(totals.tax).toBe(6);
    expect(totals.total).toBe(66);
  });

  it('keeps local calendar dates instead of shifting them to UTC', () => {
    vi.stubEnv('TZ', 'Asia/Manila');

    expect(dateKey(new Date('2026-09-26T16:00:00.000Z'))).toBe('2026-09-27');
    expect(dateKey('2026-09-26T16:00:00.000Z')).toBe('2026-09-27');
    expect(dateKey('2026-09-26')).toBe('2026-09-26');
  });

  it('adds libpq compatibility to SSL database URLs so Aiven/self-signed certs connect', () => {
    expect(normalizeDatabaseUrl('postgres://user:pass@host:5432/app?sslmode=require')).toBe('postgres://user:pass@host:5432/app?sslmode=require&uselibpqcompat=true');
    expect(normalizeDatabaseUrl('postgres://user:pass@host:5432/app?sslmode=require&uselibpqcompat=true')).toBe('postgres://user:pass@host:5432/app?sslmode=require&uselibpqcompat=true');
    expect(normalizeDatabaseUrl('postgres://user:pass@host:5432/app')).toBe('postgres://user:pass@host:5432/app');
  });

});

describe('typed API client', () => {
  it('uses same-origin cookies and does not send a browser token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ user: {} }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.session();

    expect(fetchMock).toHaveBeenCalledWith('/api/session', expect.objectContaining({ credentials: 'same-origin' }));
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(options.headers).has('Authorization')).toBe(false);
  });

  it('preserves the unauthorized status and stable error code', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ code: 'UNAUTHORIZED', error: 'Authentication required' }), { status: 401 })));

    await expect(api.session()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('omits cleared optional report dates from requests', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response('csv', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.reports({ from: '', to: '' });
    expect(fetchMock).toHaveBeenCalledWith('/api/reports', expect.anything());

    await api.salesReportCsv({ from: '', to: '' });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/reports/sales.csv', expect.objectContaining({ credentials: 'same-origin' }));
  });
});

describe('write request validation', () => {
  it('rejects non-positive sale quantities and missing idempotency keys', () => {
    expect(saleSchema.safeParse({ items: [{ medicineId: 'med-1', quantity: 0 }], paymentMethod: 'Cash' }).success).toBe(false);
    expect(saleSchema.safeParse({ items: [{ medicineId: 'med-1', quantity: 1 }], paymentMethod: 'Cash' }).success).toBe(false);
  });

  it('rejects duplicate medicines in one sale request', () => {
    expect(saleSchema.safeParse({ items: [{ medicineId: 'med-1', quantity: 1 }, { medicineId: 'med-1', quantity: 1 }], paymentMethod: 'Cash', idempotencyKey: 'attempt-1' }).success).toBe(false);
  });

  it('rejects currency values with fractions of a cent', () => {
    expect(saleSchema.safeParse({ items: [{ medicineId: 'med-1', quantity: 1 }], discount: 0.005, paymentMethod: 'Cash', idempotencyKey: 'attempt-1' }).success).toBe(false);
    expect(medicineSchema.safeParse({
      barcode: '12345', genericName: 'Example', brandName: 'Example 10mg', medicineType: 'Other', dosageForm: 'Tablet', strength: '10mg',
      unitPrice: 0.005, quantity: 2, reorderLevel: 1, expirationDate: '2027-02-28', batchNumber: 'B-1',
    }).success).toBe(false);
  });

  it('rejects invalid batch dates and negative inventory values', () => {
    const medicine = {
      barcode: '12345', genericName: 'Example', brandName: 'Example 10mg', medicineType: 'Other', dosageForm: 'Tablet', strength: '10mg',
      unitPrice: 10, quantity: 2, reorderLevel: 1, expirationDate: '2026-02-30', batchNumber: 'B-1',
    };
    expect(medicineSchema.safeParse(medicine).success).toBe(false);
    expect(medicineSchema.safeParse({ ...medicine, expirationDate: '2027-02-28', quantity: -1 }).success).toBe(false);
  });
});

describe('production request origin policy', () => {
  const allowedOrigin = 'https://pharmasync.example';

  it('allows originless safe requests such as health checks and same-origin reads', () => {
    expect(isRequestOriginAllowed('GET', undefined, allowedOrigin, true)).toBe(true);
    expect(isRequestOriginAllowed('OPTIONS', undefined, allowedOrigin, true)).toBe(true);
  });

  it('requires the configured origin for writes and rejects foreign origins', () => {
    expect(isRequestOriginAllowed('POST', allowedOrigin, allowedOrigin, true)).toBe(true);
    expect(isRequestOriginAllowed('POST', undefined, allowedOrigin, true)).toBe(false);
    expect(isRequestOriginAllowed('POST', 'https://attacker.example', allowedOrigin, true)).toBe(false);
  });

  it('allows local preview hosts used by dev environments and Codespaces', () => {
    expect(isRequestOriginAllowed('POST', 'http://localhost:4175', 'http://localhost:4175', true)).toBe(true);
    expect(isRequestOriginAllowed('POST', 'http://127.0.0.1:4175', 'http://localhost:4175', true)).toBe(true);
    expect(isRequestOriginAllowed('POST', 'https://verbose-funicular-4qv6r576x76xf5r5q-4175.app.github.dev', 'http://localhost:4175', true)).toBe(true);
  });

  it('allows same-host production requests when CLIENT_ORIGIN is not configured', () => {
    expect(isRequestOriginAllowed('POST', 'https://pharmasync-hopemed.vercel.app', undefined, true, 'pharmasync-hopemed.vercel.app')).toBe(true);
    expect(isRequestOriginAllowed('POST', 'https://evil.example', undefined, true, 'pharmasync-hopemed.vercel.app')).toBe(false);
  });
});
