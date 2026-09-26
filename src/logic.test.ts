import { afterEach, describe, expect, it, vi } from 'vitest';
import { canAccess, buildAuditLog, calculateTotals } from './data';
import { api } from './api';
import { medicineSchema, saleSchema } from '../server/validation';

afterEach(() => vi.unstubAllGlobals());

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
});

describe('write request validation', () => {
  it('rejects non-positive sale quantities and missing idempotency keys', () => {
    expect(saleSchema.safeParse({ items: [{ medicineId: 'med-1', quantity: 0 }], paymentMethod: 'Cash' }).success).toBe(false);
    expect(saleSchema.safeParse({ items: [{ medicineId: 'med-1', quantity: 1 }], paymentMethod: 'Cash' }).success).toBe(false);
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
