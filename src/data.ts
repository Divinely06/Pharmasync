export type UserRole = "ADMIN" | "PHARMACIST" | "CASHIER"
export type AccessArea = "DASHBOARD" | "POS" | "INVENTORY" | "SUPPLIERS" | "USERS" | "REPORTS" | "AUDIT" | "SETTINGS"

export type PharmacyUser = {
  id: string
  username: string
  passwordHash: string
  fullName: string
  role: UserRole
  email: string
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
  updatedAt: string
  lastLogin: string | null
}

export type Supplier = {
  id: string
  supplierName: string
  contactPerson: string
  phone: string
  email: string
  address: string
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
  updatedAt: string
}

export type Medicine = {
  id: string
  barcode: string
  genericName: string
  brandName: string
  medicineType: string
  dosageForm: string
  strength: string
  prescriptionRequired: boolean
  description: string
  dosageInformation: string
  precautions: string
  contraindications: string
  storageInformation: string
  supplierId: string
  unitPrice: number
  quantity: number
  reorderLevel: number
  expirationDate: string
  batchNumber: string
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
  updatedAt: string
}

export type PurchaseRecord = {
  id: string
  supplierId: string
  purchaseDate: string
  referenceNumber: string
  totalAmount: number
  status: "PENDING" | "RECEIVED" | "CANCELLED"
  createdBy: string
}

export type PurchaseItem = {
  id: string
  purchaseId: string
  medicineId: string
  quantity: number
  unitCost: number
  subtotal: number
  batchNumber: string
  expirationDate: string
}

export type SaleItem = {
  id: string
  saleId: string
  medicineId: string
  medicineName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export type SaleRecord = {
  id: string
  cashierId: string
  cashierName: string
  transactionDate: string
  transactionTime: string
  subtotal: number
  discount: number
  tax: number
  totalAmount: number
  paymentMethod: string
  amountReceived: number
  changeAmount: number
  status: "COMPLETED" | "VOIDED"
  items: {
    medicineId: string
    medicineName: string
    quantity: number
    unitPrice: number
    subtotal: number
  }[]
}

export type InventoryTransaction = {
  id: string
  medicineId: string
  transactionType: "PURCHASE" | "SALE" | "RETURN" | "ADJUSTMENT" | "EXPIRED" | "DAMAGED"
  quantity: number
  previousQuantity: number
  resultingQuantity: number
  referenceId: string
  performedBy: string
  timestamp: string
  notes: string
}

export type AuditLog = {
  id: string
  userId: string
  action: string
  entityType: string
  entityId: string
  timestamp: string
  metadata: Record<string, unknown>
  success: boolean
}

export type PharmacyState = {
  users: PharmacyUser[]
  suppliers: Supplier[]
  medicines: Medicine[]
  purchases: PurchaseRecord[]
  purchaseItems: PurchaseItem[]
  sales: SaleRecord[]
  saleItems: SaleItem[]
  inventoryTransactions: InventoryTransaction[]
  auditLogs: AuditLog[]
}

export const CATEGORIES = [
  "All",
  "Antibiotics",
  "Analgesics",
  "Cardiovascular",
  "Diabetes",
  "Antihistamine",
  "Antacids",
  "Vitamins",
  "Respiratory",
  "Dermatology",
]

export const WEEKLY_SALES: {
  day: string
  revenue: number
  transactions: number
}[] = []

export const ROLE_ACCESS: Record<UserRole, AccessArea[]> = {
  ADMIN: [
    "DASHBOARD",
    "POS",
    "INVENTORY",
    "SUPPLIERS",
    "USERS",
    "REPORTS",
    "AUDIT",
    "SETTINGS",
  ],
  PHARMACIST: ["DASHBOARD", "INVENTORY", "SUPPLIERS", "REPORTS", "SETTINGS"],
  CASHIER: ["DASHBOARD", "POS"],
}

export const canAccess = (role: UserRole, area: AccessArea) =>
  ROLE_ACCESS[role]?.includes(area) ?? false

export const fmt = (n: number) =>
  "₱" +
  n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export const buildAuditLog = ({
  userId,
  action,
  entityType,
  entityId,
  success,
  metadata,
}: {
  userId: string
  action: string
  entityType: string
  entityId: string
  success: boolean
  metadata?: Record<string, unknown>
}): AuditLog => ({
  id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  userId,
  action,
  entityType,
  entityId,
  timestamp: new Date().toISOString(),
  metadata: metadata ?? {},
  success,
})

export const calculateTotals = (
  items: { quantity: number; unitPrice: number }[],
) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  const tax = Number((subtotal * 0.1).toFixed(2))
  return { subtotal, tax, total: Number((subtotal + tax).toFixed(2)) }
}
