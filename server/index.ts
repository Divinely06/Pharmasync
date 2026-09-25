import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRESQL_ADDON_URI;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 2), ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined });
const sessionSecret = process.env.SESSION_SECRET ?? connectionString;
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => { res.header("Access-Control-Allow-Origin", process.env.CLIENT_ORIGIN ?? "http://localhost:4175"); res.header("Access-Control-Allow-Headers", "Content-Type, Authorization"); res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); next(); });
type AuthRequest = Request & { user?: { id: string; username: string; role: string } };
type SessionPayload = { id: string; username: string; role: string; expiresAt: number };
const signSession = (session: SessionPayload) => {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};
const verifySession = (token?: string): SessionPayload | null => {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret).update(payload).digest();
  const provided = Buffer.from(signature, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
};
const auth = (req: AuthRequest, res: Response, next: NextFunction) => { const token = req.header("Authorization")?.replace("Bearer ", ""); const session = verifySession(token); if (!session || session.expiresAt < Date.now()) return res.status(401).json({ error: "Authentication required" }); req.user = { id: session.id, username: session.username, role: session.role }; next(); };
const audit = async (client: PoolClient, userId: string, action: string, entityType: string, entityId: string, metadata: object) => { await client.query("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, success) VALUES ($1,$2,$3,$4,$5,$6,true)", [`log-${randomBytes(10).toString("hex")}`, userId, action, entityType, entityId, metadata]); };

app.get("/api/health", async (_req, res) => { const result = await pool.query("SELECT 1 AS ok"); res.json({ ok: result.rows[0].ok === 1, database: "postgresql" }); });
app.post("/api/login", async (req, res) => {
  const username = String(req.body.username ?? "").trim(); const password = String(req.body.password ?? "");
  const result = await pool.query("SELECT id, username, password_hash, full_name, role, email, status, created_at, updated_at, last_login FROM users WHERE lower(username) = lower($1)", [username]); const user = result.rows[0];
  if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Invalid username or password" });
  const token = signSession({ id: user.id, username: user.username, role: user.role, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  await pool.query("UPDATE users SET last_login = now(), updated_at = now() WHERE id = $1", [user.id]);
  await pool.query("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, success) VALUES ($1,$2,'LOGIN','USER',$3,$4,true)", [`log-${randomBytes(10).toString("hex")}`, user.id, user.id, { username: user.username }]);
  const { password_hash: _passwordHash, ...safeUser } = user; res.json({ token, user: safeUser });
});
app.get("/api/state", auth, async (_req, res) => {
  const [users, suppliers, medicines, sales, saleItems, inventoryTransactions, auditLogs] = await Promise.all([
    pool.query('SELECT id, username, full_name AS "fullName", role, email, status, created_at AS "createdAt", updated_at AS "updatedAt", last_login AS "lastLogin" FROM users ORDER BY created_at'),
    pool.query('SELECT id, supplier_name AS "supplierName", contact_person AS "contactPerson", phone, email, address, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM suppliers ORDER BY supplier_name'),
    pool.query('SELECT id, barcode, generic_name AS "genericName", brand_name AS "brandName", medicine_type AS "medicineType", dosage_form AS "dosageForm", strength, prescription_required AS "prescriptionRequired", description, dosage_information AS "dosageInformation", precautions, contraindications, storage_information AS "storageInformation", supplier_id AS "supplierId", unit_price AS "unitPrice", quantity, reorder_level AS "reorderLevel", expiration_date AS "expirationDate", batch_number AS "batchNumber", status, created_at AS "createdAt", updated_at AS "updatedAt" FROM medicines WHERE status = \'ACTIVE\' ORDER BY brand_name'),
    pool.query('SELECT s.id, s.cashier_id AS "cashierId", u.full_name AS "cashierName", s.transaction_date AS "transactionDate", s.subtotal::float AS subtotal, s.discount::float AS discount, s.tax::float AS tax, s.total_amount::float AS "totalAmount", s.payment_method AS "paymentMethod", s.amount_received::float AS "amountReceived", s.change_amount::float AS "changeAmount", s.status FROM sales s JOIN users u ON u.id = s.cashier_id ORDER BY s.transaction_date DESC LIMIT 200'),
    pool.query('SELECT id, sale_id AS "saleId", medicine_id AS "medicineId", quantity, unit_price AS "unitPrice", subtotal FROM sale_items ORDER BY id'),
    pool.query('SELECT id, medicine_id AS "medicineId", transaction_type AS "transactionType", quantity, previous_quantity AS "previousQuantity", resulting_quantity AS "resultingQuantity", reference_id AS "referenceId", performed_by AS "performedBy", occurred_at AS timestamp, notes FROM inventory_transactions ORDER BY occurred_at DESC LIMIT 500'),
    pool.query('SELECT id, user_id AS "userId", action, entity_type AS "entityType", entity_id AS "entityId", occurred_at AS timestamp, metadata, success FROM audit_logs ORDER BY occurred_at DESC LIMIT 200'),
  ]); res.json({ users: users.rows, suppliers: suppliers.rows, medicines: medicines.rows, purchases: [], purchaseItems: [], sales: sales.rows, saleItems: saleItems.rows, inventoryTransactions: inventoryTransactions.rows, auditLogs: auditLogs.rows });
});
app.post("/api/medicines", auth, async (req: AuthRequest, res) => {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "PHARMACIST") return res.status(403).json({ error: "Only admins and pharmacists can manage medicines" });
  const medicine = req.body as Record<string, unknown>;
  const required = ["barcode", "genericName", "brandName", "medicineType", "dosageForm", "strength", "expirationDate", "batchNumber"];
  if (required.some((field) => !String(medicine[field] ?? "").trim())) return res.status(400).json({ error: "Required medicine fields are missing" });
  const client = await pool.connect();
  const id = `med-${randomBytes(10).toString("hex")}`;
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO medicines (id, barcode, generic_name, brand_name, medicine_type, dosage_form, strength, prescription_required, description, dosage_information, precautions, contraindications, storage_information, supplier_id, unit_price, quantity, reorder_level, expiration_date, batch_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)", [id, medicine.barcode, medicine.genericName, medicine.brandName, medicine.medicineType, medicine.dosageForm, medicine.strength, Boolean(medicine.prescriptionRequired), medicine.description ?? "", medicine.dosageInformation ?? "", medicine.precautions ?? "", medicine.contraindications ?? "", medicine.storageInformation ?? "", medicine.supplierId || null, Number(medicine.unitPrice ?? 0), Number(medicine.quantity ?? 0), Number(medicine.reorderLevel ?? 0), medicine.expirationDate, medicine.batchNumber]);
    await audit(client, req.user.id, "CREATE_MEDICINE", "MEDICINE", id, { brandName: medicine.brandName });
    await client.query("COMMIT");
    res.status(201).json({ id });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to create medicine" });
  } finally { client.release(); }
});
app.put("/api/medicines/:id", auth, async (req: AuthRequest, res) => {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "PHARMACIST") return res.status(403).json({ error: "Only admins and pharmacists can manage medicines" });
  const medicine = req.body as Record<string, unknown>;
  const required = ["barcode", "genericName", "brandName", "medicineType", "dosageForm", "strength", "expirationDate", "batchNumber"];
  if (required.some((field) => !String(medicine[field] ?? "").trim())) return res.status(400).json({ error: "Required medicine fields are missing" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE medicines SET barcode=$2, generic_name=$3, brand_name=$4, medicine_type=$5, dosage_form=$6, strength=$7, prescription_required=$8, description=$9, dosage_information=$10, precautions=$11, contraindications=$12, storage_information=$13, supplier_id=$14, unit_price=$15, quantity=$16, reorder_level=$17, expiration_date=$18, batch_number=$19, updated_at=now() WHERE id=$1 AND status='ACTIVE' RETURNING id", [req.params.id, medicine.barcode, medicine.genericName, medicine.brandName, medicine.medicineType, medicine.dosageForm, medicine.strength, Boolean(medicine.prescriptionRequired), medicine.description ?? "", medicine.dosageInformation ?? "", medicine.precautions ?? "", medicine.contraindications ?? "", medicine.storageInformation ?? "", medicine.supplierId || null, Number(medicine.unitPrice ?? 0), Number(medicine.quantity ?? 0), Number(medicine.reorderLevel ?? 0), medicine.expirationDate, medicine.batchNumber]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Medicine not found" }); }
    await audit(client, req.user.id, "UPDATE_MEDICINE", "MEDICINE", String(req.params.id), { brandName: medicine.brandName });
    await client.query("COMMIT");
    res.json({ id: req.params.id });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update medicine" });
  } finally { client.release(); }
});
app.delete("/api/medicines/:id", auth, async (req: AuthRequest, res) => {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "PHARMACIST") return res.status(403).json({ error: "Only admins and pharmacists can manage medicines" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE medicines SET status='INACTIVE', updated_at=now() WHERE id=$1 AND status='ACTIVE' RETURNING id, brand_name", [req.params.id]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Medicine not found" }); }
    await audit(client, req.user.id, "DELETE_MEDICINE", "MEDICINE", String(req.params.id), { brandName: result.rows[0].brand_name, softDelete: true });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete medicine" });
  } finally { client.release(); }
});
app.post("/api/sales", auth, async (req: AuthRequest, res) => {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "CASHIER") return res.status(403).json({ error: "Only cashiers and admins can complete sales" });
  const body = req.body as { items?: { medicineId: string; quantity: number }[]; discount?: number; tax?: number; paymentMethod?: string; amountReceived?: number };
  if (!body.items?.length || !body.paymentMethod) return res.status(400).json({ error: "Items and payment method are required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN"); const lines: { id: string; quantity: number; unitPrice: number; subtotal: number; brandName: string }[] = [];
    for (const item of body.items) { const result = await client.query("SELECT id, brand_name, unit_price, quantity FROM medicines WHERE id = $1 AND status = 'ACTIVE' FOR UPDATE", [item.medicineId]); const medicine = result.rows[0]; if (!medicine || !Number.isInteger(item.quantity) || item.quantity < 1 || medicine.quantity < item.quantity) throw new Error(`Insufficient stock for ${medicine?.brand_name ?? item.medicineId}`); lines.push({ id: medicine.id, brandName: medicine.brand_name, quantity: item.quantity, unitPrice: Number(medicine.unit_price), subtotal: Number(medicine.unit_price) * item.quantity }); }
    const subtotal = Number(lines.reduce((sum, line) => sum + line.subtotal, 0).toFixed(2)); const discount = Number(body.discount ?? 0); const tax = Number(body.tax ?? (subtotal * 0.1).toFixed(2)); const total = Number(Math.max(0, subtotal - discount + tax).toFixed(2)); const received = Number(body.amountReceived ?? total); if (body.paymentMethod === "Cash" && received < total) throw new Error("Cash amount must cover the total");
    const saleId = `TXN-${Date.now().toString().slice(-8)}`; await client.query("INSERT INTO sales (id, cashier_id, subtotal, discount, tax, total_amount, payment_method, amount_received, change_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [saleId, req.user.id, subtotal, discount, tax, total, body.paymentMethod, received, body.paymentMethod === "Cash" ? received - total : 0]);
    for (const line of lines) { await client.query("INSERT INTO sale_items (id, sale_id, medicine_id, quantity, unit_price, subtotal) VALUES ($1,$2,$3,$4,$5,$6)", [`sale-item-${randomBytes(8).toString("hex")}`, saleId, line.id, line.quantity, line.unitPrice, line.subtotal]); const stock = await client.query("UPDATE medicines SET quantity = quantity - $1, updated_at = now() WHERE id = $2 RETURNING quantity", [line.quantity, line.id]); await client.query("INSERT INTO inventory_transactions (id, medicine_id, transaction_type, quantity, previous_quantity, resulting_quantity, reference_id, performed_by, notes) VALUES ($1,$2,'SALE',$3,$4,$5,$6,$7,$8)", [`inv-${randomBytes(8).toString("hex")}`, line.id, line.quantity, stock.rows[0].quantity + line.quantity, stock.rows[0].quantity, saleId, req.user.id, `POS sale ${saleId}`]); }
    await audit(client, req.user.id, "SALE_COMPLETED", "SALE", saleId, { total, paymentMethod: body.paymentMethod }); await client.query("COMMIT"); res.status(201).json({ id: saleId, subtotal, discount, tax, totalAmount: total, amountReceived: received, changeAmount: body.paymentMethod === "Cash" ? received - total : 0, items: lines });
  } catch (error) { await client.query("ROLLBACK"); res.status(400).json({ error: error instanceof Error ? error.message : "Sale failed" }); } finally { client.release(); }
});
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
if (!process.env.VERCEL) app.listen(port, "0.0.0.0", () => console.log(`PharmaSync API listening on port ${port}`));

export default app;