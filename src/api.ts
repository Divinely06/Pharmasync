import type { AuditLog, Medicine, PharmacyState, PharmacyUser, SaleRecord } from "./data";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type ReportData = {
  summary: { transactions: number; totalRevenue: number; averageBasket: number; totalUnits: number };
  monthly: { month: string; revenue: number; transactions: number }[];
  payment: { name: string; value: number }[];
  category: { name: string; value: number }[];
  topSelling: { id: string; name: string; quantity: number; revenue: number }[];
  inventory: { value: number; low_stock_count: number; expiring_soon_count: number };
  movement: { month: string; received: number; dispensed: number }[];
};

export type ReceiptData = Omit<SaleRecord, "items"> & {
  items: (SaleRecord["items"][number] & { batches: { batchNumber: string; expirationDate: string; quantity: number }[] })[];
  paymentStatus: string;
  provider: string | null;
  providerReference: string | null;
  simulated: boolean;
};

export type BackupRecord = { id: string; requestedAt: string; completedAt: string | null; status: "PENDING" | "COMPLETED" | "FAILED"; fileName: string | null; fileSizeBytes: number | null; errorMessage: string | null; requestedBy: string | null };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, "The pharmacy service is unreachable. Check the connection and retry.", "NETWORK_ERROR");
  }

  const result = (await response.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!response.ok) {
    throw new ApiError(response.status, result.error ?? "The request could not be completed.", result.code);
  }
  return result;
}

export const api = {
  session: () => request<{ user: PharmacyUser }>("/session"),
  login: (username: string, password: string) => request<{ user: PharmacyUser }>("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: true }>("/logout", { method: "POST" }),
  state: () => request<PharmacyState>("/state"),
  audit: (filters: { page: number; pageSize: number; actor: string; action: string; entityType: string; search: string }) => request<{ logs: AuditLog[]; page: number; pageSize: number; total: number; totalPages: number }>(`/audit?${new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize), actor: filters.actor, action: filters.action, entityType: filters.entityType, search: filters.search })}`),
  reports: (filters: { from?: string; to?: string } = {}) => request<ReportData>(`/reports?${new URLSearchParams(filters)}`),
  salesReportCsv: async (filters: { from?: string; to?: string } = {}) => {
    let response: Response;
    try { response = await fetch(`/api/reports/sales.csv?${new URLSearchParams(filters)}`, { credentials: "same-origin" }); }
    catch { throw new ApiError(0, "The pharmacy service is unreachable. Check the connection and retry.", "NETWORK_ERROR"); }
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string; code?: string };
      throw new ApiError(response.status,result.error ?? "The report export could not be completed",result.code);
    }
    return response.blob();
  },
  backups: (page = 1, pageSize = 25) => request<{ backups: BackupRecord[]; page: number; pageSize: number; total: number; totalPages: number }>(`/backups?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`),
  backupChanges: () => request<{ logs: AuditLog[] }>("/backups/changes"),
  archivedMedicines: () => request<{ medicines: Medicine[] }>("/medicines/archived"),
  restoreMedicine: (id: string) => request<{ id: string }>(`/medicines/${encodeURIComponent(id)}/restore`, { method: "POST" }),
  createBackup: () => request<{ id: string; status: string; fileName: string; fileSizeBytes: number }>("/backups", { method: "POST" }),
  searchMedicines: (q: string, page = 1, pageSize = 30) => request<{ medicines: (Medicine & { supplierName?: string; availableQuantity: number })[]; total: number; page: number; pageSize: number; totalPages: number }>(`/medicines?${new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) })}`),
  medicineDetail: (id: string) => request<PharmacyState["medicines"][number] & { batches: PharmacyState["medicineBatches"]; notice: string }>(`/medicines/${encodeURIComponent(id)}`),
  searchSuppliers: (q: string, page = 1, pageSize = 30) => request<{ suppliers: PharmacyState["suppliers"]; total: number; page: number; pageSize: number; totalPages: number }>(`/suppliers?${new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) })}`),
  createSale: (sale: { items: { medicineId: string; quantity: number }[]; discount: number; discountType: "none" | "pwd" | "senior"; discountId: string; paymentMethod: string; amountReceived: number; idempotencyKey: string }) => request<{ id: string; paymentId: string | null; status: string; simulated: boolean; duplicate?: boolean }>("/sales", { method: "POST", body: JSON.stringify(sale) }),
  paymentStatus: (id: string) => request<{ id: string; saleId: string; status: string; provider: string; providerReference: string | null }>(`/payments/${encodeURIComponent(id)}`),
  cancelPayment: (id: string) => request<{ id: string; status: string }>(`/payments/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  refundPayment: (id: string) => request<{ id: string; status: string }>(`/payments/${encodeURIComponent(id)}/refund`, { method: "POST" }),
  receipt: (id: string) => request<ReceiptData>(`/sales/${encodeURIComponent(id)}/receipt`),
  createPurchase: (purchase: { supplierId: string; referenceNumber: string; items: { medicineId: string; quantity: number; unitCost: number; batchNumber: string; expirationDate: string }[] }) => request<{ id: string; totalAmount: number }>("/purchases", { method: "POST", body: JSON.stringify(purchase) }),
  receivePurchase: (id: string) => request<{ id: string; status: string }>(`/purchases/${encodeURIComponent(id)}/receive`, { method: "POST" }),
  cancelPurchase: (id: string) => request<{ id: string; status: string }>(`/purchases/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  recordInventoryMovement: (movement: { batchId: string; movement: string; quantity: number; direction: "IN" | "OUT"; notes: string }) => request<{ id: string; resultingQuantity: number }>("/inventory/movements", { method: "POST", body: JSON.stringify(movement) }),
  saveMedicine: (id: string | undefined, medicine: Record<string, unknown>) => request<{ id: string }>(id ? `/medicines/${encodeURIComponent(id)}` : "/medicines", { method: id ? "PATCH" : "POST", body: JSON.stringify(medicine) }),
  archiveMedicine: (id: string) => request<{ ok: true }>(`/medicines/${encodeURIComponent(id)}`, { method: "DELETE" }),
  saveSupplier: (id: string | undefined, supplier: Record<string, unknown>) => request<{ id: string }>(id ? `/suppliers/${encodeURIComponent(id)}` : "/suppliers", { method: id ? "PATCH" : "POST", body: JSON.stringify(supplier) }),
  archiveSupplier: (id: string) => request<{ ok: true }>(`/suppliers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createUser: (user: { username: string; fullName: string; email: string; password: string; role: string }) => request<{ id: string }>("/users", { method: "POST", body: JSON.stringify(user) }),
  updateUser: (id: string, user: { fullName: string; email: string; role: string }) => request<{ id: string }>(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(user) }),
  deactivateUser: (id: string) => request<{ id: string; status: string }>(`/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
  resetUserPassword: (id: string, password: string) => request<{ id: string; ok: true }>(`/users/${encodeURIComponent(id)}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
};