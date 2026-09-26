export type UserRole = "ADMIN" | "PHARMACIST" | "CASHIER"
export type AccessArea = "DASHBOARD" | "POS" | "INVENTORY" | "SUPPLIERS" | "USERS" | "REPORTS" | "AUDIT" | "SETTINGS"

export type PharmacyUser = {
  id: string;
  username: string;
  passwordHash?: string;
  fullName: string;
  role: UserRole;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
};

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

export type MedicineBatch = {
  id: string;
  medicineId: string;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

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
  id: string;
  userId: string | null;
  actorName?: string | null;
  actorUsername?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
  success: boolean;
};

export type PharmacyState = {
  users: PharmacyUser[];
  suppliers: Supplier[];
  medicines: Medicine[];
  medicineBatches: MedicineBatch[];
  purchases: PurchaseRecord[];
  purchaseItems: PurchaseItem[];
  sales: SaleRecord[];
  saleItems: SaleItem[];
  inventoryTransactions: InventoryTransaction[];
  auditLogs: AuditLog[];
};

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

export const calculateTotals = (items: { quantity: number; unitPrice: number }[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = Number((subtotal * 0.1).toFixed(2));
  return { subtotal, tax, total: Number((subtotal + tax).toFixed(2)) };
};

const now = () => new Date().toISOString();

const seededUsers: PharmacyUser[] = [
  {
    id: "u-admin",
    username: "admin",
    passwordHash: "",
    fullName: "Admin User",
    role: "ADMIN",
    email: "admin@pharmasync.local",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
    lastLogin: null,
  },
  {
    id: "u-pharmacist",
    username: "pharmacist",
    passwordHash: "",
    fullName: "Alicia Mercado",
    role: "PHARMACIST",
    email: "pharmacist@pharmasync.local",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
    lastLogin: null,
  },
  {
    id: "u-cashier",
    username: "cashier",
    passwordHash: "",
    fullName: "Maria Santos",
    role: "CASHIER",
    email: "cashier@pharmasync.local",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
    lastLogin: null,
  },
];

const seededSuppliers: Supplier[] = [
  {
    id: "sup-001",
    supplierName: "MedPharm Inc.",
    contactPerson: "Ruben Basco",
    phone: "+63 917 123 4567",
    email: "orders@medpharm.ph",
    address: "Quezon City, Metro Manila",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "sup-002",
    supplierName: "UniChem Corp.",
    contactPerson: "Nina Reyes",
    phone: "+63 918 654 3210",
    email: "sales@unichem.ph",
    address: "Mandaluyong City, Metro Manila",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "sup-003",
    supplierName: "CardioMed PH",
    contactPerson: "Karl Ramos",
    phone: "+63 919 888 1122",
    email: "support@cardiomed.ph",
    address: "Davao City",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
  },
];

const seededMedicines: Medicine[] = [
  {
    id: "med-001",
    barcode: "480123456001",
    genericName: "Amoxicillin",
    brandName: "Amoxicillin 500mg",
    medicineType: "Antibiotic",
    dosageForm: "Capsule",
    strength: "500mg",
    prescriptionRequired: true,
    description: "Broad-spectrum antibiotic for bacterial infections.",
    dosageInformation: "Reference information only: follow a licensed professional's prescription and standard dosing guidance.",
    precautions: "Reference information only: review allergy history and complete the full treatment course as advised by a professional.",
    contraindications: "Reference information only: avoid use without professional advice if allergic to penicillin or cephalosporins.",
    storageInformation: "Store below 30°C in a dry place away from direct sunlight.",
    supplierId: "sup-001",
    unitPrice: 12.5,
    quantity: 240,
    reorderLevel: 50,
    expirationDate: "2026-03-31",
    batchNumber: "BT-2024-01",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "med-002",
    barcode: "480123456002",
    genericName: "Paracetamol",
    brandName: "Paracetamol 500mg",
    medicineType: "Analgesic",
    dosageForm: "Tablet",
    strength: "500mg",
    prescriptionRequired: false,
    description: "Pain reliever and fever reducer.",
    dosageInformation: "Reference information only: dosing should follow the product label and professional guidance.",
    precautions: "Reference information only: avoid exceeding the recommended dose and consult a professional if symptoms persist.",
    contraindications: "Reference information only: avoid use with other products containing acetaminophen without professional guidance.",
    storageInformation: "Store in a cool, dry place below 30°C.",
    supplierId: "sup-002",
    unitPrice: 4.75,
    quantity: 580,
    reorderLevel: 100,
    expirationDate: "2027-06-30",
    batchNumber: "BT-2024-02",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "med-003",
    barcode: "480123456003",
    genericName: "Losartan Potassium",
    brandName: "Losartan 50mg",
    medicineType: "Cardiovascular",
    dosageForm: "Tablet",
    strength: "50mg",
    prescriptionRequired: true,
    description: "Blood pressure medication for long-term management.",
    dosageInformation: "Reference information only: dosing must follow professional advice and lab monitoring guidance.",
    precautions: "Reference information only: monitor blood pressure and kidney function as advised by a clinician.",
    contraindications: "Reference information only: use with professional guidance in pregnancy or kidney disease.",
    storageInformation: "Store between 15°C and 30°C in the original packaging.",
    supplierId: "sup-003",
    unitPrice: 18.25,
    quantity: 180,
    reorderLevel: 40,
    expirationDate: "2026-09-30",
    batchNumber: "BT-2024-04",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "med-004",
    barcode: "480123456004",
    genericName: "Metformin HCl",
    brandName: "Metformin 500mg",
    medicineType: "Diabetes",
    dosageForm: "Tablet",
    strength: "500mg",
    prescriptionRequired: true,
    description: "Oral medication used for blood sugar control.",
    dosageInformation: "Reference information only: dosing, timing, and monitoring should be guided by a physician.",
    precautions: "Reference information only: professional supervision is important in renal impairment or with GI side effects.",
    contraindications: "Reference information only: avoid without medical guidance if there are severe kidney concerns or acute illness.",
    storageInformation: "Store below 30°C, protected from moisture and light.",
    supplierId: "sup-002",
    unitPrice: 7.5,
    quantity: 22,
    reorderLevel: 30,
    expirationDate: "2026-11-30",
    batchNumber: "BT-2024-05",
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
  },
];

const seededSales: SaleRecord[] = [
  {
    id: "TXN-1001",
    cashierId: "u-cashier",
    cashierName: "Maria Santos",
    transactionDate: "2026-09-10",
    transactionTime: "08:14",
    subtotal: 77.5,
    discount: 0,
    tax: 9.3,
    totalAmount: 86.8,
    paymentMethod: "Cash",
    amountReceived: 100,
    changeAmount: 13.2,
    status: "COMPLETED",
    items: [
      { medicineId: "med-002", medicineName: "Paracetamol 500mg", quantity: 10, unitPrice: 4.75, subtotal: 47.5 },
      { medicineId: "med-004", medicineName: "Metformin 500mg", quantity: 2, unitPrice: 7.5, subtotal: 15 },
    ],
  },
  {
    id: "TXN-1002",
    cashierId: "u-cashier",
    cashierName: "Maria Santos",
    transactionDate: "2026-09-10",
    transactionTime: "09:02",
    subtotal: 75,
    discount: 0,
    tax: 9,
    totalAmount: 84,
    paymentMethod: "GCash",
    amountReceived: 84,
    changeAmount: 0,
    status: "COMPLETED",
    items: [{ medicineId: "med-001", medicineName: "Amoxicillin 500mg", quantity: 6, unitPrice: 12.5, subtotal: 75 }],
  },
];

export const seedState = (): PharmacyState => ({
  users: seededUsers,
  suppliers: seededSuppliers,
  medicines: seededMedicines,
  medicineBatches: seededMedicines.map((medicine) => ({ id: `batch-${medicine.id}`, medicineId: medicine.id, batchNumber: medicine.batchNumber, expirationDate: medicine.expirationDate, quantity: medicine.quantity, createdAt: medicine.createdAt, updatedAt: medicine.updatedAt })),
  purchases: [],
  purchaseItems: [],
  sales: seededSales,
  saleItems: [],
  inventoryTransactions: [],
  auditLogs: [
    buildAuditLog({
      userId: "u-admin",
      action: "LOGIN",
      entityType: "USER",
      entityId: "u-admin",
      success: true,
      metadata: { ipAddress: "127.0.0.1" },
    }),
    buildAuditLog({
      userId: "u-cashier",
      action: "SALE_COMPLETED",
      entityType: "SALE",
      entityId: "TXN-1001",
      success: true,
      metadata: { amount: 86.8 },
    }),
  ],
});

export const WEEKLY_SALES = [
  { day: "Mon", revenue: 2480, transactions: 18 },
  { day: "Tue", revenue: 3120, transactions: 24 },
  { day: "Wed", revenue: 1890, transactions: 15 },
  { day: "Thu", revenue: 4250, transactions: 31 },
  { day: "Fri", revenue: 3780, transactions: 28 },
  { day: "Sat", revenue: 5100, transactions: 42 },
  { day: "Sun", revenue: 2960, transactions: 22 },
];
