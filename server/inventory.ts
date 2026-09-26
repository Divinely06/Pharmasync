export type BatchStock = { id: string; quantity: number };
export type BatchAllocation = { batchId: string; quantity: number };

export const allocateFefo = (batches: readonly BatchStock[], requested: number): BatchAllocation[] | null => {
  if (!Number.isInteger(requested) || requested < 1) return null;
  let remaining = requested;
  const allocations: BatchAllocation[] = [];
  for (const batch of batches) {
    if (remaining === 0) break;
    const quantity = Math.min(batch.quantity, remaining);
    if (quantity > 0) {
      allocations.push({ batchId: batch.id, quantity });
      remaining -= quantity;
    }
  }
  return remaining === 0 ? allocations : null;
};