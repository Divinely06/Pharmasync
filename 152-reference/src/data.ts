export type Product = {
  id: number;
  name: string;
  genericName: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  batch: string;
  expiry: string;
  reorderLevel: number;
  supplier: string;
};

export type CartItem = Product & { qty: number };

export type SaleRecord = {
  id: string;
  date: string;
  time: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  payment: string;
  cashier: string;
  status: "completed" | "voided";
};

export type InventoryLog = {
  id: number;
  date: string;
  product: string;
  type: "sale" | "restock" | "adjustment";
  qty: number;
  user: string;
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
];

export const PRODUCTS: Product[] = [
  { id: 1,  name: "Amoxicillin 500mg",       genericName: "Amoxicillin",         category: "Antibiotics",    price: 12.50,  stock: 240, unit: "capsule", batch: "BT-2024-01", expiry: "2026-03-31", reorderLevel: 50,  supplier: "MedPharm Inc." },
  { id: 2,  name: "Paracetamol 500mg",        genericName: "Paracetamol",         category: "Analgesics",     price: 4.75,   stock: 580, unit: "tablet",  batch: "BT-2024-02", expiry: "2027-06-30", reorderLevel: 100, supplier: "UniChem Corp." },
  { id: 3,  name: "Ibuprofen 400mg",          genericName: "Ibuprofen",           category: "Analgesics",     price: 9.00,   stock: 320, unit: "tablet",  batch: "BT-2024-03", expiry: "2026-12-31", reorderLevel: 80,  supplier: "UniChem Corp." },
  { id: 4,  name: "Losartan 50mg",            genericName: "Losartan Potassium",  category: "Cardiovascular", price: 18.25,  stock: 180, unit: "tablet",  batch: "BT-2024-04", expiry: "2026-09-30", reorderLevel: 40,  supplier: "CardioMed PH" },
  { id: 5,  name: "Metformin 500mg",          genericName: "Metformin HCl",       category: "Diabetes",       price: 7.50,   stock: 22,  unit: "tablet",  batch: "BT-2024-05", expiry: "2026-11-30", reorderLevel: 30,  supplier: "DiaCare Supply" },
  { id: 6,  name: "Cetirizine 10mg",          genericName: "Cetirizine HCl",      category: "Antihistamine",  price: 5.25,   stock: 410, unit: "tablet",  batch: "BT-2024-06", expiry: "2027-01-31", reorderLevel: 60,  supplier: "AllergyCo PH" },
  { id: 7,  name: "Omeprazole 20mg",          genericName: "Omeprazole",          category: "Antacids",       price: 14.00,  stock: 15,  unit: "capsule", batch: "BT-2024-07", expiry: "2026-08-31", reorderLevel: 40,  supplier: "GastroPharm" },
  { id: 8,  name: "Vitamin C 500mg",          genericName: "Ascorbic Acid",       category: "Vitamins",       price: 6.00,   stock: 750, unit: "tablet",  batch: "BT-2024-08", expiry: "2027-12-31", reorderLevel: 120, supplier: "VitaSource PH" },
  { id: 9,  name: "Salbutamol Inhaler",        genericName: "Salbutamol",          category: "Respiratory",    price: 285.00, stock: 34,  unit: "inhaler", batch: "BT-2024-09", expiry: "2026-07-31", reorderLevel: 10,  supplier: "RespiCare Inc." },
  { id: 10, name: "Amlodipine 5mg",           genericName: "Amlodipine Besylate", category: "Cardiovascular", price: 11.75,  stock: 8,   unit: "tablet",  batch: "BT-2024-10", expiry: "2026-10-31", reorderLevel: 30,  supplier: "CardioMed PH" },
  { id: 11, name: "Azithromycin 500mg",        genericName: "Azithromycin",        category: "Antibiotics",    price: 55.00,  stock: 96,  unit: "tablet",  batch: "BT-2024-11", expiry: "2026-05-31", reorderLevel: 20,  supplier: "MedPharm Inc." },
  { id: 12, name: "Multivitamins",             genericName: "Multivitamins",       category: "Vitamins",       price: 8.50,   stock: 500, unit: "tablet",  batch: "BT-2024-12", expiry: "2028-01-31", reorderLevel: 100, supplier: "VitaSource PH" },
  { id: 13, name: "Atorvastatin 20mg",         genericName: "Atorvastatin",        category: "Cardiovascular", price: 22.00,  stock: 145, unit: "tablet",  batch: "BT-2024-13", expiry: "2027-03-31", reorderLevel: 30,  supplier: "CardioMed PH" },
  { id: 14, name: "Mefenamic Acid 500mg",      genericName: "Mefenamic Acid",      category: "Analgesics",     price: 8.00,   stock: 280, unit: "capsule", batch: "BT-2024-14", expiry: "2027-05-31", reorderLevel: 60,  supplier: "UniChem Corp." },
  { id: 15, name: "Clindamycin 300mg",         genericName: "Clindamycin HCl",     category: "Antibiotics",    price: 32.00,  stock: 72,  unit: "capsule", batch: "BT-2024-15", expiry: "2026-06-30", reorderLevel: 20,  supplier: "MedPharm Inc." },
  { id: 16, name: "Hydrocortisone Cream 1%",  genericName: "Hydrocortisone",       category: "Dermatology",    price: 48.00,  stock: 55,  unit: "tube",    batch: "BT-2024-16", expiry: "2027-08-31", reorderLevel: 15,  supplier: "DermaPharm PH" },
  { id: 17, name: "Metronidazole 500mg",       genericName: "Metronidazole",        category: "Antibiotics",    price: 9.50,   stock: 190, unit: "tablet",  batch: "BT-2024-17", expiry: "2027-02-28", reorderLevel: 40,  supplier: "MedPharm Inc." },
  { id: 18, name: "Loperamide 2mg",            genericName: "Loperamide HCl",      category: "Antacids",       price: 6.75,   stock: 310, unit: "capsule", batch: "BT-2024-18", expiry: "2027-04-30", reorderLevel: 50,  supplier: "GastroPharm" },
];

export const SALES: SaleRecord[] = [
  { id: "TXN-1001", date: "2026-09-10", time: "08:14", items: [{ name: "Paracetamol 500mg", qty: 10, price: 4.75 }, { name: "Vitamin C 500mg", qty: 5, price: 6.00 }], subtotal: 77.50, discount: 0, total: 77.50, payment: "Cash", cashier: "Maria Santos", status: "completed" },
  { id: "TXN-1002", date: "2026-09-10", time: "09:02", items: [{ name: "Amoxicillin 500mg", qty: 6, price: 12.50 }], subtotal: 75.00, discount: 0, total: 75.00, payment: "GCash", cashier: "Maria Santos", status: "completed" },
  { id: "TXN-1003", date: "2026-09-10", time: "10:30", items: [{ name: "Losartan 50mg", qty: 14, price: 18.25 }, { name: "Amlodipine 5mg", qty: 7, price: 11.75 }], subtotal: 337.75, discount: 10, total: 327.75, payment: "Maya", cashier: "Juan Dela Cruz", status: "completed" },
  { id: "TXN-1004", date: "2026-09-10", time: "11:15", items: [{ name: "Cetirizine 10mg", qty: 5, price: 5.25 }], subtotal: 26.25, discount: 0, total: 26.25, payment: "Cash", cashier: "Maria Santos", status: "completed" },
  { id: "TXN-1005", date: "2026-09-10", time: "13:45", items: [{ name: "Salbutamol Inhaler", qty: 1, price: 285.00 }, { name: "Multivitamins", qty: 30, price: 8.50 }], subtotal: 540.00, discount: 0, total: 540.00, payment: "Card", cashier: "Juan Dela Cruz", status: "completed" },
  { id: "TXN-1006", date: "2026-09-09", time: "09:30", items: [{ name: "Metformin 500mg", qty: 30, price: 7.50 }], subtotal: 225.00, discount: 5, total: 220.00, payment: "Cash", cashier: "Maria Santos", status: "completed" },
  { id: "TXN-1007", date: "2026-09-09", time: "11:00", items: [{ name: "Atorvastatin 20mg", qty: 30, price: 22.00 }, { name: "Losartan 50mg", qty: 30, price: 18.25 }], subtotal: 1207.50, discount: 50, total: 1157.50, payment: "Card", cashier: "Juan Dela Cruz", status: "completed" },
  { id: "TXN-1008", date: "2026-09-09", time: "14:20", items: [{ name: "Mefenamic Acid 500mg", qty: 10, price: 8.00 }], subtotal: 80.00, discount: 0, total: 80.00, payment: "GCash", cashier: "Ana Reyes", status: "completed" },
  { id: "TXN-1009", date: "2026-09-08", time: "10:05", items: [{ name: "Amoxicillin 500mg", qty: 14, price: 12.50 }, { name: "Ibuprofen 400mg", qty: 10, price: 9.00 }], subtotal: 265.00, discount: 0, total: 265.00, payment: "Cash", cashier: "Maria Santos", status: "completed" },
  { id: "TXN-1010", date: "2026-09-08", time: "15:30", items: [{ name: "Hydrocortisone Cream 1%", qty: 2, price: 48.00 }], subtotal: 96.00, discount: 0, total: 96.00, payment: "Maya", cashier: "Ana Reyes", status: "completed" },
];

export const WEEKLY_SALES = [
  { day: "Mon", revenue: 2480, transactions: 18 },
  { day: "Tue", revenue: 3120, transactions: 24 },
  { day: "Wed", revenue: 1890, transactions: 15 },
  { day: "Thu", revenue: 4250, transactions: 31 },
  { day: "Fri", revenue: 3780, transactions: 28 },
  { day: "Sat", revenue: 5100, transactions: 42 },
  { day: "Sun", revenue: 2960, transactions: 22 },
];

export const fmt = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
