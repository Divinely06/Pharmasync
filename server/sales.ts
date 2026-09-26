const PAYMENT_METHODS = new Set(["Cash", "GCash", "Maya", "Card"]);

export const validateSaleRequest = (body: unknown): string | null => {
  if (!body || typeof body !== "object") return "A sale request is required";

  const sale = body as Record<string, unknown>;
  if (!Array.isArray(sale.items) || sale.items.length === 0) return "Items are required";
  if (typeof sale.paymentMethod !== "string" || !PAYMENT_METHODS.has(sale.paymentMethod)) {
    return "Unsupported payment method";
  }

  const medicineIds = new Set<string>();
  for (const item of sale.items) {
    if (!item || typeof item !== "object") return "Sale items are invalid";
    const line = item as Record<string, unknown>;
    if (typeof line.medicineId !== "string" || !line.medicineId.trim() || !Number.isInteger(line.quantity) || Number(line.quantity) < 1) {
      return "Sale items are invalid";
    }
    if (medicineIds.has(line.medicineId)) return "Each medicine may only appear once";
    medicineIds.add(line.medicineId);
  }

  for (const field of ["discount", "amountReceived"] as const) {
    const value = sale[field];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      return `${field} must be a non-negative number`;
    }
  }

  return null;
};