import { describe, expect, it } from 'vitest';
import { canAccess, buildAuditLog, calculateTotals } from './data';

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
});
