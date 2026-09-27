import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES, canAccess, buildAuditLog, calculateTotals, dateKey, generateMedicineBarcode, getVisibleCategoryFilters, matchesMedicineCategory, stopMediaStream } from './data';
import { api } from './api';
import { missingDatabaseTables, normalizeDatabaseUrl, requiredDatabaseTables } from '../server/db';
import { isRequestOriginAllowed, loginSchema, medicineSchema, passwordChangeSchema, passwordResetSchema, saleSchema, sessionTokenSchema, userCreateSchema, validateSaleTotals } from '../server/validation';

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
    expect(canAccess('PHARMACIST', 'REPORTS')).toBe(false);
    expect(canAccess('PHARMACIST', 'USERS')).toBe(false);
    expect(canAccess('CASHIER', 'POS')).toBe(true);
    expect(canAccess('CASHIER', 'INVENTORY')).toBe(false);
    expect(canAccess('CASHIER', 'REPORTS')).toBe(false);
    expect(canAccess('CASHIER', 'AUDIT')).toBe(false);
    expect(canAccess('CASHIER', 'USERS')).toBe(false);
  });

  it('matches real POS categories to medicine taxonomy values', () => {
    expect(matchesMedicineCategory('Antibiotic', 'Antibiotic')).toBe(true);
    expect(matchesMedicineCategory('Antihistamine/Antiemetic', 'Antihistamine')).toBe(true);
    expect(matchesMedicineCategory('Antacid/GI', 'Antacid/GI')).toBe(true);
    expect(matchesMedicineCategory('Cardiovascular/Lipid', 'Cardiovascular')).toBe(true);
    expect(matchesMedicineCategory('Respiratory/Mucolytic', 'Respiratory')).toBe(true);
    expect(matchesMedicineCategory('Cardiovascular', 'Antibiotic')).toBe(false);
    expect(matchesMedicineCategory('Respiratory/Allergy', 'Respiratory/Allergy')).toBe(true);
    expect(matchesMedicineCategory('Vitamins/Supplements', 'Vitamins/Supplements')).toBe(true);
  });

  it('includes the full product catalog category set for POS filters', () => {
    expect(CATEGORIES).toEqual(expect.arrayContaining([
      'All',
      'Antibiotic',
      'Antibiotic/Anti-TB',
      'Antihistamine',
      'Antihistamine/Antiemetic',
      'Antacid/GI',
      'Cardiovascular',
      'Cardiovascular/Lipid',
      'Respiratory',
      'Respiratory/Mucolytic',
      'Respiratory/Allergy',
      'Vitamins/Supplements',
      'Urology',
      'Topical/Skin',
      'Medical Supply',
    ]));
  });

  it('hides unavailable POS categories while keeping valid ones visible', () => {
    const medicines = [
      { medicineType: 'Antibiotic', quantity: 0, expirationDate: '2024-01-01' },
      { medicineType: 'Cardiovascular', quantity: 12, expirationDate: '2030-01-01' },
      { medicineType: 'Analgesic', quantity: 0, expirationDate: '2024-01-01' },
    ] as const;

    expect(getVisibleCategoryFilters(medicines, (medicine) => medicine.quantity > 0)).toEqual(['All', 'Cardiovascular']);
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

  it('creates consistent barcode values for items that need camera scanning', () => {
    const a = generateMedicineBarcode('Sample Brand');
    const b = generateMedicineBarcode('Sample Brand', ['480123456001']);

    expect(/^\d{8,13}$/.test(a)).toBe(true);
    expect(a).not.toBe('480123456001');
    expect(b).not.toBe('480123456001');
    expect(b.length).toBeGreaterThanOrEqual(8);
  });

  it('stops all active media tracks when a scanner session is closed', () => {
    const trackA = { stop: vi.fn() };
    const trackB = { stop: vi.fn() };
    const stream = {
      getTracks: () => [trackA, trackB],
    } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(trackA.stop).toHaveBeenCalledTimes(1);
    expect(trackB.stop).toHaveBeenCalledTimes(1);
  });

  it('reports missing required database tables for readiness checks', () => {
    expect(missingDatabaseTables(requiredDatabaseTables)).toEqual([]);
    expect(missingDatabaseTables(['users', 'sessions'])).not.toContain('users');
    expect(missingDatabaseTables(['users', 'sessions'])).toContain('medicines');
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

  it('returns a clean invalid result for malformed session cookie tokens', () => {
    expect(sessionTokenSchema.safeParse('a'.repeat(64)).success).toBe(true);
    expect(sessionTokenSchema.safeParse('%E0%A4%A').success).toBe(false);
    expect(sessionTokenSchema.safeParse('short').success).toBe(false);
  });
});

describe('write request validation', () => {
  it('normalizes usernames and rejects passwords beyond bcrypt byte capacity', () => {
    const user = { username: ' Cashier ', fullName: 'Example Cashier', email: 'cashier@example.test', password: 'valid-password', role: 'CASHIER' };
    expect(userCreateSchema.parse(user).username).toBe('cashier');
    expect(userCreateSchema.safeParse({ ...user, password: 'a'.repeat(73) }).success).toBe(false);
    expect(passwordResetSchema.safeParse({ password: 'a'.repeat(73) }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'cashier', password: 'a'.repeat(73) }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...user, password: '界'.repeat(24) }).success).toBe(true);
    expect(userCreateSchema.safeParse({ ...user, password: '界'.repeat(25) }).success).toBe(false);
  });

  it('requires current and bcrypt-compatible new passwords for self-service changes', () => {
    expect(passwordChangeSchema.safeParse({ currentPassword: 'old-password', newPassword: 'new-password' }).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ currentPassword: '', newPassword: 'new-password' }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ currentPassword: 'old-password', newPassword: 'short' }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ currentPassword: 'old-password', newPassword: 'x'.repeat(73) }).success).toBe(false);
  });

  it('rejects non-positive sale quantities and missing idempotency keys', () => {
    expect(saleSchema.safeParse({ items: [{ medicineId: 'med-1', quantity: 0 }], paymentMethod: 'Cash' }).success).toBe(false);
    expect(saleSchema.safeParse({ items: [{ medicineId: 'med-1', quantity: 1 }], paymentMethod: 'Cash' }).success).toBe(false);
  });

  it('rejects impossible cash totals before a sale reaches the database', () => {
    expect(validateSaleTotals({ subtotal: 100, discount: 110, tax: 10, amountReceived: 0, paymentMethod: 'Cash' }).valid).toBe(false);
    expect(validateSaleTotals({ subtotal: 100, discount: 10, tax: 10, amountReceived: 100, paymentMethod: 'Cash' }).valid).toBe(true);
    expect(validateSaleTotals({ subtotal: 100, discount: 10, tax: 10, amountReceived: 99, paymentMethod: 'Cash' }).valid).toBe(false);
    expect(validateSaleTotals({ subtotal: 100, discount: 0, tax: 10, paymentMethod: 'Cash' }).valid).toBe(true);
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

  it('requires preview host origins to be configured for production writes', () => {
    const previewOrigin = 'https://verbose-funicular-4qv6r576x76xf5r5q-4175.app.github.dev';
    expect(isRequestOriginAllowed('POST', previewOrigin, 'http://localhost:4175', true)).toBe(false);
    expect(isRequestOriginAllowed('POST', previewOrigin, `http://localhost:4175,${previewOrigin}`, true)).toBe(true);
  });

  it('requires a configured origin for production writes', () => {
    expect(isRequestOriginAllowed('POST', 'https://pharmasync-hopemed.vercel.app', undefined, true)).toBe(false);
    expect(isRequestOriginAllowed('POST', 'https://pharmasync-hopemed.vercel.app', 'https://pharmasync-hopemed.vercel.app', true)).toBe(true);
  });
});
