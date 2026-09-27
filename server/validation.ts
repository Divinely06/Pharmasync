import { z } from "zod";

const requiredText = (max = 250) => z.string().trim().min(1).max(max);
const optionalText = (max = 1000) => z.string().max(max).optional().default("");
const nonNegativeMoney = z.coerce.number().finite().nonnegative().refine((value) => Math.round(value * 100) / 100 === value);
const nonNegativeInteger = z.coerce.number().int().nonnegative();
const bcryptCompatiblePassword = (minimumLength: number) => z.string().min(minimumLength).max(256).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 UTF-8 bytes");

const normalizeOrigin = (value: string | undefined) => value ? value.replace(/\/$/, "") : value;

export const isRequestOriginAllowed = (method: string, origin: string | undefined, allowedOrigin: string | undefined, production: boolean) => {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!production) return true;

  if (!normalizedOrigin) {
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
    return false;
  }

  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  const configuredOrigins = (allowedOrigin ?? "")
    .split(",")
    .map((entry) => normalizeOrigin(entry.trim()))
    .filter((entry): entry is string => Boolean(entry));
  return configuredOrigins.includes(normalizedOrigin);
};

export const loginSchema = z.object({
  username: requiredText(100),
  password: bcryptCompatiblePassword(1),
});
export const sessionTokenSchema = z.string().regex(/^[a-f0-9]{64}$/i);

export const medicineSchema = z.object({
  barcode: requiredText(100),
  genericName: requiredText(250),
  brandName: requiredText(250),
  medicineType: requiredText(100),
  dosageForm: requiredText(100),
  strength: requiredText(100),
  prescriptionRequired: z.boolean().default(false),
  description: optionalText(),
  dosageInformation: optionalText(),
  precautions: optionalText(),
  contraindications: optionalText(),
  storageInformation: optionalText(),
  supplierId: z.string().nullable().optional().default(null),
  unitPrice: nonNegativeMoney,
  quantity: nonNegativeInteger,
  reorderLevel: nonNegativeInteger,
  expirationDate: z.iso.date(),
  batchNumber: requiredText(100),
});
export const medicineUpdateSchema = medicineSchema.omit({ quantity: true, expirationDate: true, batchNumber: true });

export const supplierSchema = z.object({
  supplierName: requiredText(250),
  contactPerson: optionalText(250),
  phone: requiredText(100),
  email: z.string().email().max(254).or(z.literal("")).optional().default(""),
  address: optionalText(1000),
});

export const userCreateSchema = z.object({
  username: requiredText(100).transform((username) => username.toLowerCase()),
  fullName: requiredText(200),
  email: z.string().email().max(254),
  password: bcryptCompatiblePassword(10),
  role: z.enum(["ADMIN", "PHARMACIST", "CASHIER"]),
});

export const userUpdateSchema = z.object({
  fullName: requiredText(200),
  email: z.string().email().max(254),
  role: z.enum(["ADMIN", "PHARMACIST", "CASHIER"]),
});

export const passwordResetSchema = z.object({ password: bcryptCompatiblePassword(10) });
export const passwordChangeSchema = z.object({
  currentPassword: bcryptCompatiblePassword(1),
  newPassword: bcryptCompatiblePassword(10),
});

export const saleSchema = z.object({
  items: z.array(z.object({ medicineId: requiredText(100), quantity: z.coerce.number().int().positive() })).min(1).max(100).refine((items) => new Set(items.map((item) => item.medicineId)).size === items.length, "Each medicine may only appear once"),
  discount: nonNegativeMoney.default(0),
  discountType: z.enum(["none", "pwd", "senior"]).default("none"),
  discountId: z.string().trim().max(100).default(""),
  paymentMethod: z.enum(["Cash", "GCash", "Maya", "Card"]),
  amountReceived: nonNegativeMoney.optional(),
  idempotencyKey: requiredText(100),
});

export const purchaseSchema = z.object({
  supplierId: requiredText(100),
  referenceNumber: requiredText(100),
  items: z.array(z.object({
    medicineId: requiredText(100),
    quantity: z.coerce.number().int().positive(),
    unitCost: nonNegativeMoney,
    batchNumber: requiredText(100),
    expirationDate: z.iso.date(),
  })).min(1).max(100),
});

export const inventoryMovementSchema = z.object({
  batchId: requiredText(100),
  movement: z.enum(["RETURN", "ADJUSTMENT", "EXPIRED", "DAMAGED"]),
  quantity: z.coerce.number().int().positive(),
  direction: z.enum(["IN", "OUT"]),
  notes: optionalText(1000),
});

export const auditFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  actor: z.string().trim().max(100).optional(),
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
});

export const reportFilterSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const listFilterSchema = z.object({
  q: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type MedicineInput = z.infer<typeof medicineSchema>;
export type MedicineUpdateInput = z.infer<typeof medicineUpdateSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;