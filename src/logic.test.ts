import { describe, expect, it } from 'vitest';
import { canAccess, buildAuditLog, calculateTotals } from './data';
import { validateSaleRequest } from '../server/sales';

describe('pharmacy system logic', () => {
  it('allows admin access to reports and inventory', () => {
    expect(canAccess('ADMIN', 'REPORTS')).toBe(true);
    expect(canAccess('CASHIER', 'REPORTS')).toBe(false);
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

  it('rejects invalid sale requests before they reach the database', () => {
    expect(validateSaleRequest({ items: [{ medicineId: 'med-1', quantity: 1 }], paymentMethod: 'Bitcoin' })).toBe('Unsupported payment method');
    expect(validateSaleRequest({ items: [{ medicineId: 'med-1', quantity: 1 }, { medicineId: 'med-1', quantity: 2 }], paymentMethod: 'Cash' })).toBe('Each medicine may only appear once');
    expect(validateSaleRequest({ items: [{ medicineId: 'med-1', quantity: 1 }], paymentMethod: 'Cash', discount: -1 })).toBe('discount must be a non-negative number');
    expect(validateSaleRequest({ items: [{ medicineId: 'med-1', quantity: 1 }], paymentMethod: 'Cash', amountReceived: Number.NaN })).toBe('amountReceived must be a non-negative number');
    expect(validateSaleRequest({ items: [{ medicineId: 'med-1', quantity: 1 }], paymentMethod: 'Cash' })).toBeNull();
  });
});
