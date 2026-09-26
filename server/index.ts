import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Pool, type PoolClient } from "pg";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { auditFilterSchema, inventoryMovementSchema, isRequestOriginAllowed, listFilterSchema, loginSchema, medicineSchema, medicineUpdateSchema, passwordResetSchema, purchaseSchema, reportFilterSchema, saleSchema, supplierSchema, userCreateSchema, userUpdateSchema } from "./validation.js";
import { allocateFefo } from "./inventory.js";
import { createLogicalBackup, dumpDatabase } from "./backup.js";
import { createPaymentProvider, type PaymentStatus } from "./payment-provider.js";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRESQL_ADDON_URI;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 1), ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined });
const paymentProvider = createPaymentProvider();
const app = express();
const sessionCookie = "pharmasync_session";
const sessionLifetime = 8 * 60 * 60 * 1000;
const production = process.env.NODE_ENV === "production";
app.disable("x-powered-by");
const logError = (event: string, error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const redactedMessage = message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database-url]")
    .replace(/(password|token|secret|api[_-]?key)=([^&\s]+)/gi, "$1=[REDACTED]");
  console.error(JSON.stringify({ level: "error", event, message: redactedMessage, code: (error as { code?: string })?.code ?? null, timestamp: new Date().toISOString() }));
};

app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  const origin = req.header("Origin");
  const allowedOrigin = process.env.CLIENT_ORIGIN;
  if (!isRequestOriginAllowed(req.method, origin, allowedOrigin, production)) return res.status(403).json({ code: "ORIGIN_REJECTED", error: "Request origin is not allowed" });
  if (origin && allowedOrigin && origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  } else if (origin && !production) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

type SessionUser = { id: string; username: string; role: "ADMIN" | "PHARMACIST" | "CASHIER" };
type AuthRequest = Request & { user?: SessionUser };
const cookieToken = (req: Request) => req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = cookieToken(req);
    if (!token) return res.status(401).json({ code: "UNAUTHORIZED", error: "Authentication required" });
    const result = await pool.query("SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'ACTIVE'", [hashToken(decodeURIComponent(token))]);
    if (!result.rowCount) return res.status(401).json({ code: "UNAUTHORIZED", error: "Authentication required" });
    req.user = result.rows[0] as SessionUser;
    next();
  } catch (error) { next(error); }
};
const allow = (...roles: SessionUser["role"][]) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (roles.includes(req.user!.role)) return next();
  try {
    await pool.query("INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,metadata,success) VALUES ($1,$2,'AUTHORIZATION_FAILED','USER',$2,$3,false)", [`log-${randomUUID()}`,req.user!.id,{ role: req.user!.role, path: req.path }]);
  } catch { logError("authorization_denial_audit_failed", "Audit insert failed"); }
  return res.status(403).json({ code: "FORBIDDEN", error: "You do not have permission to perform this action" });
};
const audit = async (client: PoolClient, userId: string, action: string, entityType: string, entityId: string, metadata: object, success = true) => {
  await client.query("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, success) VALUES ($1,$2,$3,$4,$5,$6,$7)", [`log-${randomUUID()}`, userId, action, entityType, entityId, metadata, success]);
};
const validText = (value: unknown, max = 250) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const safeUserSelect = 'SELECT id, username, full_name AS "fullName", role, email, status, created_at AS "createdAt", updated_at AS "updatedAt", last_login AS "lastLogin" FROM users';

app.get("/api/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, database: "postgresql" }); }
  catch { res.status(503).json({ ok: false, code: "DATABASE_UNAVAILABLE", error: "Database is unavailable" }); }
});
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { code: "RATE_LIMITED", error: "Too many login attempts. Try again later." } });
const backupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 1, standardHeaders: "draft-8", legacyHeaders: false, message: { code: "RATE_LIMITED", error: "A backup was already requested recently" } });
app.post("/api/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Username and password are required" });
  const { username, password } = parsed.data;
  const result = await pool.query("SELECT id, username, password_hash FROM users WHERE lower(username) = lower($1) AND status = 'ACTIVE'", [username]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    await pool.query("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, success) VALUES ($1,$2,'LOGIN_FAILED','USER',$3,$4,false)", [`log-${randomUUID()}`, user?.id ?? null, user?.id ?? "unknown", { username }]);
    return res.status(401).json({ code: "INVALID_CREDENTIALS", error: "Invalid username or password" });
  }
  const token = randomBytes(32).toString("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [hashToken(token), user.id, new Date(Date.now() + sessionLifetime)]);
    await client.query("UPDATE users SET last_login = now(), updated_at = now() WHERE id = $1", [user.id]);
    await audit(client, user.id, "LOGIN", "USER", user.id, { username: user.username });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.cookie(sessionCookie, token, { httpOnly: true, secure: production, sameSite: "lax", maxAge: sessionLifetime, path: "/" });
  const safeUser = await pool.query(`${safeUserSelect} WHERE id = $1`, [user.id]);
  res.json({ user: safeUser.rows[0] });
});
app.get("/api/session", auth, async (req: AuthRequest, res) => {
  const result = await pool.query(`${safeUserSelect} WHERE id = $1`, [req.user!.id]);
  res.json({ user: result.rows[0] });
});
app.post("/api/logout", auth, async (req: AuthRequest, res) => {
  const token = cookieToken(req)!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(decodeURIComponent(token))]);
    await audit(client, req.user!.id, "LOGOUT", "USER", req.user!.id, { username: req.user!.username });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.clearCookie(sessionCookie, { httpOnly: true, secure: production, sameSite: "lax", path: "/" });
  res.json({ ok: true });
});

app.get("/api/state", auth, async (req: AuthRequest, res) => {
  const isAdmin = req.user!.role === "ADMIN";
  const isCashier = req.user!.role === "CASHIER";
  const [users, suppliers, medicines, medicineBatches, sales, saleItems, inventoryTransactions, auditLogs, purchases, purchaseItems] = await Promise.all([
    isAdmin ? pool.query(`${safeUserSelect} ORDER BY created_at`) : Promise.resolve({ rows: [] }),
    isCashier ? Promise.resolve({ rows: [] }) : pool.query('SELECT id, supplier_name AS "supplierName", contact_person AS "contactPerson", phone, email, address, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM suppliers WHERE status = \'ACTIVE\' ORDER BY supplier_name'),
    pool.query('SELECT id, barcode, generic_name AS "genericName", brand_name AS "brandName", medicine_type AS "medicineType", dosage_form AS "dosageForm", strength, prescription_required AS "prescriptionRequired", description, dosage_information AS "dosageInformation", precautions, contraindications, storage_information AS "storageInformation", supplier_id AS "supplierId", unit_price::float AS "unitPrice", COALESCE((SELECT sum(b.quantity) FROM medicine_batches b WHERE b.medicine_id = medicines.id), quantity)::int AS quantity, reorder_level AS "reorderLevel", COALESCE((SELECT min(b.expiration_date)::text FROM medicine_batches b WHERE b.medicine_id = medicines.id AND b.quantity > 0), expiration_date::text) AS "expirationDate", batch_number AS "batchNumber", status, created_at AS "createdAt", updated_at AS "updatedAt" FROM medicines WHERE status = \'ACTIVE\' ORDER BY brand_name'),
    pool.query('SELECT b.id, b.medicine_id AS "medicineId", b.batch_number AS "batchNumber", b.expiration_date::text AS "expirationDate", b.quantity, b.created_at AS "createdAt", b.updated_at AS "updatedAt" FROM medicine_batches b JOIN medicines m ON m.id = b.medicine_id WHERE m.status = \'ACTIVE\' ORDER BY b.expiration_date, b.created_at'),
    pool.query(`SELECT s.id, s.cashier_id AS "cashierId", u.full_name AS "cashierName", s.transaction_date AS "transactionDate", s.subtotal::float, s.discount::float, s.tax::float, s.total_amount::float AS "totalAmount", s.payment_method AS "paymentMethod", s.amount_received::float AS "amountReceived", s.change_amount::float AS "changeAmount", s.status FROM sales s JOIN users u ON u.id = s.cashier_id WHERE s.status = 'COMPLETED' ${isCashier ? "AND s.cashier_id = $1" : ""} ORDER BY s.transaction_date DESC LIMIT 200`, isCashier ? [req.user!.id] : []),
    pool.query(`SELECT si.id, si.sale_id AS "saleId", si.medicine_id AS "medicineId", m.brand_name AS "medicineName", si.quantity, si.unit_price::float AS "unitPrice", si.subtotal::float FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN medicines m ON m.id = si.medicine_id WHERE s.status = 'COMPLETED' ${isCashier ? "AND s.cashier_id = $1" : ""} ORDER BY s.transaction_date DESC LIMIT 1000`, isCashier ? [req.user!.id] : []),
    isCashier ? Promise.resolve({ rows: [] }) : pool.query('SELECT id, medicine_id AS "medicineId", transaction_type AS "transactionType", quantity, previous_quantity AS "previousQuantity", resulting_quantity AS "resultingQuantity", reference_id AS "referenceId", performed_by AS "performedBy", occurred_at AS timestamp, notes FROM inventory_transactions ORDER BY occurred_at DESC LIMIT 500'),
    isAdmin ? pool.query('SELECT l.id, l.user_id AS "userId", actor.full_name AS "actorName", actor.username AS "actorUsername", l.action, l.entity_type AS "entityType", l.entity_id AS "entityId", CASE WHEN l.entity_type = \'MEDICINE\' THEN (SELECT brand_name FROM medicines WHERE id = l.entity_id) WHEN l.entity_type = \'SUPPLIER\' THEN (SELECT supplier_name FROM suppliers WHERE id = l.entity_id) WHEN l.entity_type = \'USER\' THEN (SELECT full_name FROM users WHERE id = l.entity_id) ELSE l.entity_id END AS "entityName", l.occurred_at AS timestamp, l.metadata, l.success FROM audit_logs l LEFT JOIN users actor ON actor.id = l.user_id ORDER BY l.occurred_at DESC LIMIT 200') : Promise.resolve({ rows: [] }),
    isCashier ? Promise.resolve({ rows: [] }) : pool.query('SELECT id, supplier_id AS "supplierId", purchase_date AS "purchaseDate", reference_number AS "referenceNumber", total_amount::float AS "totalAmount", status, created_by AS "createdBy" FROM purchases ORDER BY purchase_date DESC LIMIT 200'),
    isCashier ? Promise.resolve({ rows: [] }) : pool.query('SELECT id, purchase_id AS "purchaseId", medicine_id AS "medicineId", quantity, unit_cost::float AS "unitCost", subtotal::float, batch_number AS "batchNumber", expiration_date::text AS "expirationDate" FROM purchase_items ORDER BY id'),
  ]);
  res.json({ users: users.rows, suppliers: suppliers.rows, medicines: medicines.rows, medicineBatches: medicineBatches.rows, purchases: purchases.rows, purchaseItems: purchaseItems.rows, sales: sales.rows, saleItems: saleItems.rows, inventoryTransactions: inventoryTransactions.rows, auditLogs: auditLogs.rows });
});

app.get("/api/audit", auth, allow("ADMIN"), async (req, res) => {
  const parsed = auditFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_FILTER", error: "Audit filters are invalid" });
  const { page, pageSize, actor, action, entityType, search } = parsed.data;
  const values: unknown[] = [];
  const filters: string[] = [];
  const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (actor) { const p = parameter(`%${actor}%`); filters.push(`(u.username ILIKE ${p} OR u.full_name ILIKE ${p})`); }
  if (action) filters.push(`l.action ILIKE ${parameter(`%${action}%`)}`);
  if (entityType) filters.push(`l.entity_type ILIKE ${parameter(`%${entityType}%`)}`);
  if (search) {
    const p = parameter(`%${search}%`);
    filters.push(`(l.entity_id ILIKE ${p} OR l.action ILIKE ${p} OR l.metadata::text ILIKE ${p} OR COALESCE(u.full_name,'') ILIKE ${p} OR COALESCE(u.username,'') ILIKE ${p})`);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const count = await pool.query(`SELECT count(*)::int AS total FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id ${where}`, values);
  const limit = parameter(pageSize);
  const offset = parameter((page - 1) * pageSize);
  const result = await pool.query(`SELECT l.id,l.user_id AS "userId",u.full_name AS "actorName",u.username AS "actorUsername",l.action,l.entity_type AS "entityType",l.entity_id AS "entityId",CASE WHEN l.entity_type='MEDICINE' THEN (SELECT brand_name FROM medicines WHERE id=l.entity_id) WHEN l.entity_type='SUPPLIER' THEN (SELECT supplier_name FROM suppliers WHERE id=l.entity_id) WHEN l.entity_type='USER' THEN (SELECT full_name FROM users WHERE id=l.entity_id) ELSE l.entity_id END AS "entityName",l.occurred_at AS timestamp,l.metadata,l.success FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id ${where} ORDER BY l.occurred_at DESC,l.id DESC LIMIT ${limit} OFFSET ${offset}`, values);
  res.json({ logs: result.rows, page, pageSize, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total / pageSize) });
});

app.get("/api/reports", auth, allow("ADMIN", "PHARMACIST"), async (req, res) => {
  const parsed = reportFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_FILTER", error: "Report date filters are invalid" });
  const { from, to } = parsed.data;
  if (from && to && from > to) return res.status(400).json({ code: "INVALID_FILTER", error: "Start date must be on or before end date" });
  const dateWhere = "($1::date IS NULL OR s.transaction_date::date >= $1::date) AND ($2::date IS NULL OR s.transaction_date::date <= $2::date)";
  const params = [from ?? null, to ?? null];
  const [summary, monthly, payment, category, topSelling, inventory, movement] = await Promise.all([
    pool.query(`SELECT count(*)::int AS transactions,COALESCE(sum(total_amount),0)::float AS "totalRevenue",COALESCE(avg(total_amount),0)::float AS "averageBasket",COALESCE((SELECT sum(si.quantity)::int FROM sale_items si JOIN sales s2 ON s2.id=si.sale_id WHERE s2.status='COMPLETED' AND ($1::date IS NULL OR s2.transaction_date::date >= $1::date) AND ($2::date IS NULL OR s2.transaction_date::date <= $2::date)),0)::int AS "totalUnits" FROM sales s WHERE s.status='COMPLETED' AND ${dateWhere}`, params),
    pool.query(`SELECT to_char(date_trunc('month',s.transaction_date),'YYYY-MM') AS month,sum(s.total_amount)::float AS revenue,count(*)::int AS transactions FROM sales s WHERE s.status='COMPLETED' AND ${dateWhere} GROUP BY 1 ORDER BY 1`, params),
    pool.query(`SELECT s.payment_method AS name,sum(s.total_amount)::float AS value FROM sales s WHERE s.status='COMPLETED' AND ${dateWhere} GROUP BY 1 ORDER BY value DESC`, params),
    pool.query(`SELECT m.medicine_type AS name,sum(si.quantity)::int AS value FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN medicines m ON m.id=si.medicine_id WHERE s.status='COMPLETED' AND ${dateWhere} GROUP BY 1 ORDER BY value DESC`, params),
    pool.query(`SELECT si.medicine_id AS id,m.brand_name AS name,sum(si.quantity)::int AS quantity,sum(si.subtotal)::float AS revenue FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN medicines m ON m.id=si.medicine_id WHERE s.status='COMPLETED' AND ${dateWhere} GROUP BY si.medicine_id,m.brand_name ORDER BY quantity DESC LIMIT 10`, params),
    pool.query("SELECT COALESCE(sum(quantity*unit_price),0)::float AS value,count(*) FILTER (WHERE quantity<=reorder_level)::int AS low_stock_count,(SELECT count(DISTINCT medicine_id)::int FROM medicine_batches WHERE quantity>0 AND expiration_date>=CURRENT_DATE AND expiration_date<=CURRENT_DATE+90) AS expiring_soon_count FROM medicines WHERE status='ACTIVE'"),
    pool.query("SELECT to_char(date_trunc('month',occurred_at),'YYYY-MM') AS month,COALESCE(sum(quantity) FILTER (WHERE transaction_type='PURCHASE'),0)::int AS received,COALESCE(sum(quantity) FILTER (WHERE transaction_type='SALE'),0)::int AS dispensed FROM inventory_transactions WHERE occurred_at>=date_trunc('month',CURRENT_DATE)-interval '5 months' GROUP BY 1 ORDER BY 1"),
  ]);
  res.json({ summary: summary.rows[0], monthly: monthly.rows, payment: payment.rows, category: category.rows, topSelling: topSelling.rows, inventory: inventory.rows[0], movement: movement.rows });
});

app.get("/api/reports/sales.csv", auth, allow("ADMIN", "PHARMACIST"), async (req, res) => {
  const parsed = reportFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_FILTER", error: "Report date filters are invalid" });
  const { from, to } = parsed.data;
  if (from && to && from > to) return res.status(400).json({ code: "INVALID_FILTER", error: "Start date must be on or before end date" });
  const result = await pool.query('SELECT s.id,s.transaction_date AS "transactionDate",u.full_name AS "cashierName",s.payment_method AS "paymentMethod",s.subtotal::float,s.discount::float,s.tax::float,s.total_amount::float AS "totalAmount",COALESCE((SELECT string_agg(m.brand_name || \' x \' || si.quantity, \'; \' ORDER BY m.brand_name) FROM sale_items si JOIN medicines m ON m.id=si.medicine_id WHERE si.sale_id=s.id),\'\') AS items FROM sales s JOIN users u ON u.id=s.cashier_id WHERE s.status=\'COMPLETED\' AND ($1::date IS NULL OR s.transaction_date::date >= $1::date) AND ($2::date IS NULL OR s.transaction_date::date <= $2::date) ORDER BY s.transaction_date DESC LIMIT 100001', [from ?? null,to ?? null]);
  if ((result.rowCount ?? 0) > 100000) return res.status(413).json({ code: "REPORT_TOO_LARGE", error: "Narrow the date range to export at most 100,000 transactions" });
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g,'""')}"`;
  };
  const columns = ["Transaction","Date","Cashier","Payment","Subtotal","Discount","Tax","Total","Items"];
  const rows = result.rows.map((row) => [row.id,row.transactionDate,row.cashierName,row.paymentMethod,row.subtotal,row.discount,row.tax,row.totalAmount,row.items]);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="sales-${from ?? "all"}-${to ?? "all"}.csv"`);
  res.send([columns,...rows].map((row) => row.map(cell).join(",")).join("\r\n"));
});

app.get("/api/medicines", auth, async (req, res) => {
  const parsed = listFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_FILTER", error: "Medicine search filters are invalid" });
  const { q, page, pageSize } = parsed.data;
  const pattern = `%${q}%`;
  const count = await pool.query("SELECT count(*)::int AS total FROM medicines WHERE status='ACTIVE' AND ($1='' OR barcode ILIKE $2 OR generic_name ILIKE $2 OR brand_name ILIKE $2)", [q,pattern]);
  const result = await pool.query('SELECT m.id,m.barcode,m.generic_name AS "genericName",m.brand_name AS "brandName",m.medicine_type AS "medicineType",m.dosage_form AS "dosageForm",m.strength,m.prescription_required AS "prescriptionRequired",m.description,m.dosage_information AS "dosageInformation",m.precautions,m.contraindications,m.storage_information AS "storageInformation",m.supplier_id AS "supplierId",s.supplier_name AS "supplierName",m.unit_price::float AS "unitPrice",COALESCE((SELECT sum(b.quantity) FROM medicine_batches b WHERE b.medicine_id=m.id),m.quantity)::int AS quantity,COALESCE((SELECT sum(b.quantity) FROM medicine_batches b WHERE b.medicine_id=m.id AND b.expiration_date>=CURRENT_DATE),0)::int AS "availableQuantity",m.reorder_level AS "reorderLevel",COALESCE((SELECT min(b.expiration_date)::text FROM medicine_batches b WHERE b.medicine_id=m.id AND b.quantity>0),m.expiration_date::text) AS "expirationDate",m.batch_number AS "batchNumber",m.status,m.created_at AS "createdAt",m.updated_at AS "updatedAt" FROM medicines m LEFT JOIN suppliers s ON s.id=m.supplier_id WHERE m.status=\'ACTIVE\' AND ($1=\'\' OR m.barcode ILIKE $2 OR m.generic_name ILIKE $2 OR m.brand_name ILIKE $2) ORDER BY m.brand_name LIMIT $3 OFFSET $4', [q,pattern,pageSize,(page-1)*pageSize]);
  res.json({ medicines: result.rows, page, pageSize, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total/pageSize) });
});

app.get("/api/medicines/archived", auth, allow("ADMIN"), async (_req, res) => {
  const result = await pool.query('SELECT m.id,m.barcode,m.generic_name AS "genericName",m.brand_name AS "brandName",m.medicine_type AS "medicineType",m.dosage_form AS "dosageForm",m.strength,m.prescription_required AS "prescriptionRequired",m.description,m.dosage_information AS "dosageInformation",m.precautions,m.contraindications,m.storage_information AS "storageInformation",m.supplier_id AS "supplierId",m.unit_price::float AS "unitPrice",COALESCE((SELECT sum(b.quantity) FROM medicine_batches b WHERE b.medicine_id=m.id),m.quantity)::int AS quantity,m.reorder_level AS "reorderLevel",m.expiration_date::text AS "expirationDate",m.batch_number AS "batchNumber",m.status,m.created_at AS "createdAt",m.updated_at AS "updatedAt" FROM medicines m WHERE m.status=\'INACTIVE\' ORDER BY m.updated_at DESC');
  res.json({ medicines: result.rows });
});

app.post("/api/medicines/:id/restore", auth, allow("ADMIN"), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE medicines SET status='ACTIVE',updated_at=now() WHERE id=$1 AND status='INACTIVE' RETURNING brand_name", [req.params.id]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Archived medicine not found" }); }
    await audit(client, req.user!.id, "RESTORE_MEDICINE", "MEDICINE", String(req.params.id), { brandName: result.rows[0].brand_name });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ id: req.params.id });
});

app.get("/api/medicines/:id", auth, async (req, res) => {
  const medicine = await pool.query('SELECT m.id,m.barcode,m.generic_name AS "genericName",m.brand_name AS "brandName",m.medicine_type AS "medicineType",m.dosage_form AS "dosageForm",m.strength,m.prescription_required AS "prescriptionRequired",m.description,m.dosage_information AS "dosageInformation",m.precautions,m.contraindications,m.storage_information AS "storageInformation",m.supplier_id AS "supplierId",m.unit_price::float AS "unitPrice",m.reorder_level AS "reorderLevel",m.status FROM medicines m WHERE m.id=$1 AND m.status=\'ACTIVE\'', [req.params.id]);
  if (!medicine.rowCount) return res.status(404).json({ code: "NOT_FOUND", error: "Medicine not found" });
  const batches = await pool.query('SELECT id,batch_number AS "batchNumber",expiration_date::text AS "expirationDate",quantity FROM medicine_batches WHERE medicine_id=$1 ORDER BY expiration_date,created_at', [req.params.id]);
  res.json({ ...medicine.rows[0], quantity:batches.rows.reduce((sum,batch)=>sum+batch.quantity,0), batches:batches.rows, notice:"Medicine details are reference information only, not medical advice. Follow the product label and a licensed professional's guidance." });
});

app.get("/api/suppliers", auth, allow("ADMIN", "PHARMACIST"), async (req, res) => {
  const parsed = listFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_FILTER", error: "Supplier search filters are invalid" });
  const { q, page, pageSize } = parsed.data;
  const pattern = `%${q}%`;
  const count = await pool.query("SELECT count(*)::int AS total FROM suppliers WHERE status='ACTIVE' AND ($1='' OR supplier_name ILIKE $2 OR contact_person ILIKE $2 OR phone ILIKE $2)", [q,pattern]);
  const result = await pool.query('SELECT id,supplier_name AS "supplierName",contact_person AS "contactPerson",phone,email,address,status,created_at AS "createdAt",updated_at AS "updatedAt" FROM suppliers WHERE status=\'ACTIVE\' AND ($1=\'\' OR supplier_name ILIKE $2 OR contact_person ILIKE $2 OR phone ILIKE $2) ORDER BY supplier_name LIMIT $3 OFFSET $4', [q,pattern,pageSize,(page-1)*pageSize]);
  res.json({ suppliers:result.rows,page,pageSize,total:count.rows[0].total,totalPages:Math.ceil(count.rows[0].total/pageSize) });
});

app.get("/api/suppliers/:id", auth, allow("ADMIN", "PHARMACIST"), async (req, res) => {
  const result = await pool.query('SELECT id,supplier_name AS "supplierName",contact_person AS "contactPerson",phone,email,address,status,created_at AS "createdAt",updated_at AS "updatedAt" FROM suppliers WHERE id=$1 AND status=\'ACTIVE\'', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ code: "NOT_FOUND", error: "Supplier not found" });
  const medicines = await pool.query('SELECT id,brand_name AS "brandName",barcode,quantity FROM medicines WHERE supplier_id=$1 AND status=\'ACTIVE\' ORDER BY brand_name', [req.params.id]);
  res.json({ ...result.rows[0], medicines:medicines.rows });
});

app.post("/api/medicines", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const parsed = medicineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Medicine details are invalid" });
  const b = parsed.data;
  const id = `med-${randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO medicines (id,barcode,generic_name,brand_name,medicine_type,dosage_form,strength,prescription_required,description,dosage_information,precautions,contraindications,storage_information,supplier_id,unit_price,quantity,reorder_level,expiration_date,batch_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)", [id,b.barcode.trim(),b.genericName.trim(),b.brandName.trim(),b.medicineType,b.dosageForm,b.strength,Boolean(b.prescriptionRequired),b.description ?? "",b.dosageInformation ?? "",b.precautions ?? "",b.contraindications ?? "",b.storageInformation ?? "",b.supplierId || null,Number(b.unitPrice),Number(b.quantity),Number(b.reorderLevel),b.expirationDate,b.batchNumber.trim()]);
    await client.query("INSERT INTO medicine_batches (id,medicine_id,batch_number,expiration_date,quantity) VALUES ($1,$2,$3,$4,$5)", [`batch-${randomUUID()}`,id,b.batchNumber.trim(),b.expirationDate,Number(b.quantity)]);
    await client.query("INSERT INTO inventory_transactions (id,medicine_id,transaction_type,quantity,previous_quantity,resulting_quantity,reference_id,performed_by,notes) VALUES ($1,$2,'ADJUSTMENT',$3,0,$3,$2,$4,'Initial stock')", [`inv-${randomUUID()}`,id,Number(b.quantity),req.user!.id]);
    await audit(client, req.user!.id, "CREATE_MEDICINE", "MEDICINE", id, { brandName: b.brandName, barcode: b.barcode, initialQuantity: Number(b.quantity) });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.status(201).json({ id });
});
app.patch("/api/medicines/:id", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const parsed = medicineUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Medicine details are invalid" });
  const b = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const old = await client.query("SELECT * FROM medicines WHERE id = $1 AND status = 'ACTIVE' FOR UPDATE", [req.params.id]);
    if (!old.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Medicine not found" }); }
    await client.query("UPDATE medicines SET barcode=$2,generic_name=$3,brand_name=$4,medicine_type=$5,dosage_form=$6,strength=$7,prescription_required=$8,description=$9,dosage_information=$10,precautions=$11,contraindications=$12,storage_information=$13,supplier_id=$14,unit_price=$15,reorder_level=$16,updated_at=now() WHERE id=$1", [req.params.id,b.barcode.trim(),b.genericName.trim(),b.brandName.trim(),b.medicineType,b.dosageForm,b.strength,Boolean(b.prescriptionRequired),b.description ?? "",b.dosageInformation ?? "",b.precautions ?? "",b.contraindications ?? "",b.storageInformation ?? "",b.supplierId || null,Number(b.unitPrice),Number(b.reorderLevel)]);
    const current = old.rows[0];
    const changes = [
      { field: "barcode", from: current.barcode, to: b.barcode.trim() },
      { field: "genericName", from: current.generic_name, to: b.genericName.trim() },
      { field: "brandName", from: current.brand_name, to: b.brandName.trim() },
      { field: "medicineType", from: current.medicine_type, to: b.medicineType },
      { field: "dosageForm", from: current.dosage_form, to: b.dosageForm },
      { field: "strength", from: current.strength, to: b.strength },
      { field: "prescriptionRequired", from: current.prescription_required, to: Boolean(b.prescriptionRequired) },
      { field: "description", from: current.description, to: b.description ?? "" },
      { field: "dosageInformation", from: current.dosage_information, to: b.dosageInformation ?? "" },
      { field: "precautions", from: current.precautions, to: b.precautions ?? "" },
      { field: "contraindications", from: current.contraindications, to: b.contraindications ?? "" },
      { field: "storageInformation", from: current.storage_information, to: b.storageInformation ?? "" },
      { field: "supplierId", from: current.supplier_id, to: b.supplierId || null },
      { field: "unitPrice", from: Number(current.unit_price), to: Number(b.unitPrice) },
      { field: "reorderLevel", from: current.reorder_level, to: Number(b.reorderLevel) },
    ].filter((change) => String(change.from ?? "") !== String(change.to ?? ""));
    await audit(client, req.user!.id, "UPDATE_MEDICINE", "MEDICINE", String(req.params.id), { brandName: b.brandName, changes });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ id: req.params.id });
});
app.delete("/api/medicines/:id", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE medicines SET status='INACTIVE',updated_at=now() WHERE id=$1 AND status='ACTIVE' RETURNING brand_name", [req.params.id]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Medicine not found" }); }
    await audit(client, req.user!.id, "ARCHIVE_MEDICINE", "MEDICINE", String(req.params.id), { brandName: result.rows[0].brand_name });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ ok: true });
});

app.post("/api/suppliers", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Supplier details are invalid" });
  const b = parsed.data;
  const id = `sup-${randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO suppliers (id,supplier_name,contact_person,phone,email,address) VALUES ($1,$2,$3,$4,$5,$6)", [id,b.supplierName.trim(),b.contactPerson ?? "",b.phone.trim(),b.email ?? "",b.address ?? ""]);
    await audit(client, req.user!.id, "CREATE_SUPPLIER", "SUPPLIER", id, { supplierName: b.supplierName, contactPerson: b.contactPerson ?? "", phone: b.phone, email: b.email ?? "", address: b.address ?? "" });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.status(201).json({ id });
});
app.patch("/api/suppliers/:id", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Supplier details are invalid" });
  const b = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const old = await client.query("SELECT * FROM suppliers WHERE id=$1 AND status='ACTIVE' FOR UPDATE", [req.params.id]);
    if (!old.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Supplier not found" }); }
    await client.query("UPDATE suppliers SET supplier_name=$2,contact_person=$3,phone=$4,email=$5,address=$6,updated_at=now() WHERE id=$1", [req.params.id,b.supplierName.trim(),b.contactPerson ?? "",b.phone.trim(),b.email ?? "",b.address ?? ""]);
    const before = old.rows[0];
    const changes = [
      { field: "supplierName", from: before.supplier_name, to: b.supplierName.trim() },
      { field: "contactPerson", from: before.contact_person, to: b.contactPerson ?? "" },
      { field: "phone", from: before.phone, to: b.phone.trim() },
      { field: "email", from: before.email, to: b.email ?? "" },
      { field: "address", from: before.address, to: b.address ?? "" },
    ].filter((change) => String(change.from ?? "") !== String(change.to ?? ""));
    await audit(client, req.user!.id, "UPDATE_SUPPLIER", "SUPPLIER", String(req.params.id), { changes });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ id: req.params.id });
});
app.delete("/api/suppliers/:id", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE suppliers SET status='INACTIVE',updated_at=now() WHERE id=$1 AND status='ACTIVE' RETURNING supplier_name", [req.params.id]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Supplier not found" }); }
    await audit(client, req.user!.id, "DEACTIVATE_SUPPLIER", "SUPPLIER", String(req.params.id), { supplierName: result.rows[0].supplier_name });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ ok: true });
});
app.post("/api/users", auth, allow("ADMIN"), async (req: AuthRequest, res) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "User details are invalid; passwords must be at least 10 characters" });
  const b = parsed.data;
  const id = `u-${randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO users (id,username,password_hash,full_name,role,email) VALUES ($1,$2,$3,$4,$5,$6)", [id,b.username.trim(),await bcrypt.hash(b.password,12),b.fullName.trim(),b.role,b.email.trim().toLowerCase()]);
    await audit(client, req.user!.id, "CREATE_USER", "USER", id, { username: b.username, fullName: b.fullName, role: b.role, email: b.email.trim().toLowerCase() });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.status(201).json({ id });
});

app.patch("/api/users/:id", auth, allow("ADMIN"), async (req: AuthRequest, res) => {
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "User details are invalid" });
  const body = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const old = await client.query("SELECT full_name,email,role FROM users WHERE id=$1 AND status='ACTIVE' FOR UPDATE", [req.params.id]);
    if (!old.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Active user not found" }); }
    if (req.params.id === req.user!.id && body.role !== req.user!.role) { await client.query("ROLLBACK"); return res.status(409).json({ code: "SELF_ROLE_CHANGE", error: "You cannot change your own role" }); }
    const before = old.rows[0];
    await client.query("UPDATE users SET full_name=$2,email=$3,role=$4,updated_at=now() WHERE id=$1", [req.params.id,body.fullName.trim(),body.email.trim().toLowerCase(),body.role]);
    const changes = [
      { field: "fullName", from: before.full_name, to: body.fullName.trim() },
      { field: "email", from: before.email, to: body.email.trim().toLowerCase() },
      { field: "role", from: before.role, to: body.role },
    ].filter((change) => change.from !== change.to);
    await audit(client,req.user!.id,"UPDATE_USER","USER",String(req.params.id),{ changes });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ id: req.params.id });
});

app.delete("/api/users/:id", auth, allow("ADMIN"), async (req: AuthRequest, res) => {
  if (req.params.id === req.user!.id) return res.status(409).json({ code: "SELF_DEACTIVATION", error: "You cannot deactivate your own account" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE users SET status='INACTIVE',updated_at=now() WHERE id=$1 AND status='ACTIVE' RETURNING username,full_name", [req.params.id]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Active user not found" }); }
    await client.query("DELETE FROM sessions WHERE user_id=$1", [req.params.id]);
    await audit(client,req.user!.id,"DEACTIVATE_USER","USER",String(req.params.id),{ username:result.rows[0].username,fullName:result.rows[0].full_name });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ id: req.params.id, status: "INACTIVE" });
});

app.post("/api/users/:id/reset-password", auth, allow("ADMIN"), async (req: AuthRequest, res) => {
  if (req.params.id === req.user!.id) return res.status(409).json({ code: "SELF_PASSWORD_RESET", error: "Use the account recovery flow to change your own password" });
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Password must be at least 10 characters" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query("SELECT username FROM users WHERE id=$1 AND status='ACTIVE' FOR UPDATE", [req.params.id]);
    if (!user.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Active user not found" }); }
    await client.query("UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1", [req.params.id,await bcrypt.hash(parsed.data.password,12)]);
    await client.query("DELETE FROM sessions WHERE user_id=$1", [req.params.id]);
    await audit(client,req.user!.id,"RESET_USER_PASSWORD","USER",String(req.params.id),{ username:user.rows[0].username,sessionsRevoked:true });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ id: req.params.id, ok: true });
});

app.post("/api/purchases", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Purchase details are invalid" });
  const body = parsed.data;
  const total = Number(body.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toFixed(2));
  const id = `po-${randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const supplier = await client.query("SELECT id FROM suppliers WHERE id=$1 AND status='ACTIVE' FOR SHARE", [body.supplierId]);
    if (!supplier.rowCount) throw Object.assign(new Error("Supplier is unavailable"), { status: 400, code: "INVALID_REFERENCE" });
    for (const item of body.items) {
      const medicine = await client.query("SELECT id FROM medicines WHERE id=$1 AND status='ACTIVE' FOR SHARE", [item.medicineId]);
      if (!medicine.rowCount) throw Object.assign(new Error("Medicine is unavailable"), { status: 400, code: "INVALID_REFERENCE" });
    }
    await client.query("INSERT INTO purchases (id,supplier_id,reference_number,total_amount,status,created_by) VALUES ($1,$2,$3,$4,'PENDING',$5)", [id,body.supplierId,body.referenceNumber,total,req.user!.id]);
    for (const item of body.items) {
      const subtotal = Number((item.quantity * item.unitCost).toFixed(2));
      await client.query("INSERT INTO purchase_items (id,purchase_id,medicine_id,quantity,unit_cost,subtotal,batch_number,expiration_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [`purchase-item-${randomUUID()}`,id,item.medicineId,item.quantity,item.unitCost,subtotal,item.batchNumber,item.expirationDate]);
    }
    await audit(client,req.user!.id,"CREATE_PURCHASE","PURCHASE",id,{ referenceNumber:body.referenceNumber,totalAmount:total,itemCount:body.items.length });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    const failure = error as Error & { status?: number; code?: string };
    if (failure.status) return res.status(failure.status).json({ code: failure.code, error: failure.message });
    throw error;
  } finally { client.release(); }
  res.status(201).json({ id, totalAmount: total });
});

app.post("/api/purchases/:id/receive", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const purchase = await client.query("SELECT id,status,reference_number FROM purchases WHERE id=$1 FOR UPDATE", [req.params.id]);
    if (!purchase.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Purchase not found" }); }
    if (purchase.rows[0].status !== "PENDING") { await client.query("ROLLBACK"); return res.status(409).json({ code: "INVALID_STATE", error: "Only pending purchases can be received" }); }
    const items = await client.query("SELECT medicine_id,quantity,batch_number,expiration_date::text AS expiration_date FROM purchase_items WHERE purchase_id=$1 ORDER BY id", [req.params.id]);
    for (const item of items.rows) {
      if (item.expiration_date < new Date().toISOString().slice(0, 10)) throw Object.assign(new Error(`Cannot receive expired batch ${item.batch_number}`), { status: 400, code: "EXPIRED_BATCH" });
      const medicine = await client.query("SELECT id,quantity FROM medicines WHERE id=$1 AND status='ACTIVE' FOR UPDATE", [item.medicine_id]);
      if (!medicine.rowCount) throw Object.assign(new Error("Medicine is no longer active"), { status: 409, code: "MEDICINE_UNAVAILABLE" });
      const batch = await client.query("SELECT id,expiration_date::text AS expiration_date FROM medicine_batches WHERE medicine_id=$1 AND batch_number=$2 FOR UPDATE", [item.medicine_id,item.batch_number]);
      let batchId: string;
      if (batch.rowCount) {
        if (batch.rows[0].expiration_date !== item.expiration_date) throw Object.assign(new Error(`Batch ${item.batch_number} has a different expiration date`), { status: 409, code: "BATCH_CONFLICT" });
        batchId = batch.rows[0].id;
        await client.query("UPDATE medicine_batches SET quantity=quantity+$1,updated_at=now() WHERE id=$2", [item.quantity,batchId]);
      } else {
        batchId = `batch-${randomUUID()}`;
        await client.query("INSERT INTO medicine_batches (id,medicine_id,batch_number,expiration_date,quantity) VALUES ($1,$2,$3,$4,$5)", [batchId,item.medicine_id,item.batch_number,item.expiration_date,item.quantity]);
      }
      const updated = await client.query("UPDATE medicines SET quantity=quantity+$1,updated_at=now() WHERE id=$2 RETURNING quantity", [item.quantity,item.medicine_id]);
      const previous = updated.rows[0].quantity - item.quantity;
      await client.query("INSERT INTO inventory_transactions (id,medicine_id,transaction_type,quantity,previous_quantity,resulting_quantity,reference_id,performed_by,notes) VALUES ($1,$2,'PURCHASE',$3,$4,$5,$6,$7,$8)", [`inv-${randomUUID()}`,item.medicine_id,item.quantity,previous,updated.rows[0].quantity,req.params.id,req.user!.id,`Received ${purchase.rows[0].reference_number}, batch ${item.batch_number}`]);
    }
    await client.query("UPDATE purchases SET status='RECEIVED' WHERE id=$1", [req.params.id]);
    await audit(client,req.user!.id,"RECEIVE_PURCHASE","PURCHASE",String(req.params.id),{ referenceNumber:purchase.rows[0].reference_number,itemCount:items.rowCount });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    const failure = error as Error & { status?: number; code?: string };
    if (failure.status) return res.status(failure.status).json({ code: failure.code, error: failure.message });
    throw error;
  } finally { client.release(); }
  res.json({ id: req.params.id, status: "RECEIVED" });
});

app.post("/api/purchases/:id/cancel", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const purchase = await client.query("UPDATE purchases SET status='CANCELLED' WHERE id=$1 AND status='PENDING' RETURNING reference_number", [req.params.id]);
    if (!purchase.rowCount) {
      const existing = await client.query("SELECT status FROM purchases WHERE id=$1", [req.params.id]);
      await client.query("ROLLBACK");
      return res.status(existing.rowCount ? 409 : 404).json({ code: existing.rowCount ? "INVALID_STATE" : "NOT_FOUND", error: existing.rowCount ? "Only pending purchases can be cancelled" : "Purchase not found" });
    }
    await audit(client,req.user!.id,"CANCEL_PURCHASE","PURCHASE",String(req.params.id),{ referenceNumber:purchase.rows[0].reference_number });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  res.json({ id: req.params.id, status: "CANCELLED" });
});

app.post("/api/inventory/movements", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const parsed = inventoryMovementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Inventory movement details are invalid" });
  const body = parsed.data;
  if (["EXPIRED", "DAMAGED"].includes(body.movement) && body.direction !== "OUT") return res.status(400).json({ code: "INVALID_MOVEMENT", error: "Expired and damaged stock can only be removed" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT b.id,b.medicine_id,b.batch_number,b.expiration_date::text AS expiration_date,b.quantity AS batch_quantity,m.brand_name,m.quantity AS medicine_quantity,(b.expiration_date<CURRENT_DATE) AS expired FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id WHERE b.id=$1 AND m.status='ACTIVE' FOR UPDATE OF b,m", [body.batchId]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Stock batch not found" }); }
    const batch = result.rows[0];
    if (body.movement === "EXPIRED" && !batch.expired) throw Object.assign(new Error("This batch has not expired"), { status: 400, code: "INVALID_MOVEMENT" });
    if (body.direction === "IN" && batch.expired) throw Object.assign(new Error("Expired stock cannot be returned to available inventory"), { status: 400, code: "EXPIRED_BATCH" });
    const delta = body.direction === "IN" ? body.quantity : -body.quantity;
    if (batch.batch_quantity + delta < 0) throw Object.assign(new Error("Insufficient stock available in this batch"), { status: 409, code: "INSUFFICIENT_STOCK" });
    await client.query("UPDATE medicine_batches SET quantity=quantity+$1,updated_at=now() WHERE id=$2", [delta,body.batchId]);
    const updated = await client.query("UPDATE medicines SET quantity=quantity+$1,updated_at=now() WHERE id=$2 AND quantity+$1>=0 RETURNING quantity", [delta,batch.medicine_id]);
    if (!updated.rowCount) throw Object.assign(new Error("Inventory aggregate would become negative"), { status: 409, code: "INSUFFICIENT_STOCK" });
    await client.query("INSERT INTO inventory_transactions (id,medicine_id,transaction_type,quantity,previous_quantity,resulting_quantity,reference_id,performed_by,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [`inv-${randomUUID()}`,batch.medicine_id,body.movement,delta,batch.medicine_quantity,updated.rows[0].quantity,body.batchId,req.user!.id,body.notes]);
    await audit(client,req.user!.id,"INVENTORY_MOVEMENT",body.movement,batch.medicine_id,{ brandName:batch.brand_name,batchNumber:batch.batch_number,quantity:body.quantity,direction:body.direction,notes:body.notes });
    await client.query("COMMIT");
    res.status(201).json({ id: body.batchId, resultingQuantity: updated.rows[0].quantity });
  } catch (error) {
    await client.query("ROLLBACK");
    const failure = error as Error & { status?: number; code?: string };
    if (failure.status) return res.status(failure.status).json({ code: failure.code, error: failure.message });
    throw error;
  } finally { client.release(); }
});

app.post("/api/sales", auth, allow("ADMIN", "CASHIER"), async (req: AuthRequest, res) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", error: "Sale details are invalid" });
  const body = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [body.idempotencyKey]);
    const existing = await client.query("SELECT s.id,s.status,p.id AS payment_id,p.status AS payment_status FROM sales s LEFT JOIN LATERAL (SELECT id,status FROM payment_records WHERE sale_id=s.id ORDER BY created_at DESC LIMIT 1) p ON true WHERE s.idempotency_key=$1", [body.idempotencyKey]);
    if (existing.rowCount) {
      await client.query("COMMIT");
      const prior = existing.rows[0];
      const paymentStatus = prior.payment_status ?? (prior.status === "COMPLETED" ? "PAID" : prior.status);
      const statusCode = paymentStatus === "PENDING" ? 202 : paymentStatus === "PAID" ? 200 : 402;
      return res.status(statusCode).json({ id: prior.id, paymentId: prior.payment_id, status: paymentStatus, duplicate: true, ...(statusCode === 402 ? { error: "Payment was not confirmed. Start a new attempt to retry." } : {}) });
    }
    const lines: { id: string; quantity: number; unitPrice: number; subtotal: number; brandName: string; allocations: { batchId: string; quantity: number }[]; saleItemId?: string }[] = [];
    for (const item of body.items) {
      if (!validText(item.medicineId, 100) || !Number.isInteger(item.quantity) || item.quantity < 1) throw Object.assign(new Error("Sale quantities must be positive whole numbers"), { status: 400, code: "INVALID_INPUT" });
      const result = await client.query("SELECT id,brand_name,unit_price FROM medicines WHERE id=$1 AND status='ACTIVE' FOR UPDATE", [item.medicineId]);
      const medicine = result.rows[0];
      if (!medicine) throw Object.assign(new Error(`Medicine is unavailable: ${item.medicineId}`), { status: 400, code: "MEDICINE_UNAVAILABLE" });
      const batches = await client.query("SELECT id,quantity FROM medicine_batches WHERE medicine_id=$1 AND quantity>0 AND expiration_date>=CURRENT_DATE ORDER BY expiration_date,created_at,id FOR UPDATE", [medicine.id]);
      if (!batches.rowCount) throw Object.assign(new Error(`No unexpired stock available for ${medicine.brand_name}`), { status: 400, code: "MEDICINE_UNAVAILABLE" });
      const allocations = allocateFefo(batches.rows, item.quantity);
      if (!allocations) throw Object.assign(new Error(`Insufficient stock available for ${medicine.brand_name}`), { status: 409, code: "INSUFFICIENT_STOCK" });
      lines.push({ id: medicine.id, brandName: medicine.brand_name, quantity: item.quantity, unitPrice: Number(medicine.unit_price), subtotal: Number(medicine.unit_price) * item.quantity, allocations });
    }
    const subtotal = Number(lines.reduce((sum, line) => sum + line.subtotal, 0).toFixed(2));
    const discount = Number(body.discount ?? 0);
    if (discount > subtotal) throw Object.assign(new Error("Discount cannot exceed subtotal"), { status: 400, code: "INVALID_INPUT" });
    const tax = Number((subtotal * 0.1).toFixed(2));
    const total = Number((subtotal - discount + tax).toFixed(2));
    const cash = body.paymentMethod === "Cash";
    const received = Number(body.amountReceived ?? total);
    if (!Number.isFinite(received) || received < 0 || (cash && received < total)) throw Object.assign(new Error("Cash amount must cover the total"), { status: 400, code: "CASH_SHORTFALL" });
    const saleId = `TXN-${randomUUID()}`;
    await client.query("INSERT INTO sales (id,cashier_id,subtotal,discount,tax,total_amount,payment_method,amount_received,change_amount,status,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING',$10)", [saleId,req.user!.id,subtotal,discount,tax,total,body.paymentMethod,cash ? received : total,cash ? received-total : 0,body.idempotencyKey]);
    for (const line of lines) {
      const itemResult = await client.query("INSERT INTO sale_items (id,sale_id,medicine_id,quantity,unit_price,subtotal) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [`sale-item-${randomUUID()}`,saleId,line.id,line.quantity,line.unitPrice,line.subtotal]);
      line.saleItemId = itemResult.rows[0].id;
    }
    let paymentStatus: PaymentStatus = "PAID";
    let paymentId: string | null = null;
    if (!cash) {
      const result = await paymentProvider.createPayment({ saleId,amount:total,currency:"PHP",method:body.paymentMethod === "Card" ? "CARD" : "E_WALLET",idempotencyKey:`payment-${body.idempotencyKey}` });
      paymentStatus = result.status;
      paymentId = `pay-${randomUUID()}`;
      await client.query("INSERT INTO payment_records (id,sale_id,method,status,provider,provider_reference,idempotency_key,amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [paymentId,saleId,body.paymentMethod === "Card" ? "CARD" : "E_WALLET",result.status,result.provider,result.providerReference,`payment-${body.idempotencyKey}`,total]);
      await client.query("INSERT INTO payment_events (id,payment_id,previous_status,status,event_type,performed_by,metadata) VALUES ($1,$2,NULL,$3,'CREATED',$4,$5)", [`payment-event-${randomUUID()}`,paymentId,result.status,req.user!.id,{ provider:result.provider,failureCode:result.failureCode ?? null }]);
    }
    if (paymentStatus === "PAID") {
      await client.query("UPDATE sales SET status='COMPLETED' WHERE id=$1", [saleId]);
      for (const line of lines) {
        for (const allocation of line.allocations) {
          const batch = await client.query("UPDATE medicine_batches SET quantity=quantity-$1,updated_at=now() WHERE id=$2 AND quantity >= $1 RETURNING quantity", [allocation.quantity,allocation.batchId]);
          if (!batch.rowCount) throw new Error("Batch stock changed during checkout");
          await client.query("INSERT INTO sale_item_batches (sale_item_id,batch_id,quantity) VALUES ($1,$2,$3)", [line.saleItemId,allocation.batchId,allocation.quantity]);
        }
        const stock = await client.query("UPDATE medicines SET quantity=quantity-$1,updated_at=now() WHERE id=$2 RETURNING quantity", [line.quantity,line.id]);
        await client.query("INSERT INTO inventory_transactions (id,medicine_id,transaction_type,quantity,previous_quantity,resulting_quantity,reference_id,performed_by,notes) VALUES ($1,$2,'SALE',$3,$4,$5,$6,$7,$8)", [`inv-${randomUUID()}`,line.id,line.quantity,stock.rows[0].quantity+line.quantity,stock.rows[0].quantity,saleId,req.user!.id,`POS sale ${saleId}`]);
      }
      await audit(client,req.user!.id,"SALE_COMPLETED","SALE",saleId,{ total,paymentMethod:body.paymentMethod, simulated:!cash });
      if (!cash) await audit(client,req.user!.id,"PAYMENT_PAID","PAYMENT",paymentId!,{ provider:"DUMMY",saleId });
    } else {
      if (paymentStatus !== "PENDING") await client.query("UPDATE sales SET status='VOIDED' WHERE id=$1", [saleId]);
      await audit(client,req.user!.id,"PAYMENT_ATTEMPT","PAYMENT",paymentId ?? saleId,{ paymentStatus,simulated:true,saleId });
    }
    await client.query("COMMIT");
    res.status(paymentStatus === "PAID" ? 201 : paymentStatus === "PENDING" ? 202 : 402).json({ id: saleId, paymentId, status: paymentStatus, simulated: !cash, totalAmount: total, changeAmount: cash ? received-total : 0, items: lines });
  } catch (error) {
    await client.query("ROLLBACK");
    const failure = error as Error & { status?: number; code?: string };
    res.status(failure.status ?? 500).json({ code: failure.code ?? "SALE_FAILED", error: failure.status ? failure.message : "The sale could not be completed" });
  } finally { client.release(); }
});

app.get("/api/payments/:id", auth, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT p.id,p.sale_id AS "saleId",p.status,p.provider,p.provider_reference AS "providerReference",s.cashier_id AS "cashierId" FROM payment_records p JOIN sales s ON s.id=p.sale_id WHERE p.id=$1', [req.params.id]);
  if (!result.rowCount || (req.user!.role === "CASHIER" && result.rows[0].cashierId !== req.user!.id)) return res.status(404).json({ code: "NOT_FOUND", error: "Payment attempt not found" });
  const { cashierId: _cashierId, ...payment } = result.rows[0];
  res.json(payment);
});

app.post("/api/payments/:id/cancel", auth, allow("ADMIN", "PHARMACIST", "CASHIER"), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const payment = await client.query('SELECT p.id,p.sale_id AS "saleId",p.status,p.provider,p.provider_reference AS "providerReference",s.cashier_id AS "cashierId" FROM payment_records p JOIN sales s ON s.id=p.sale_id WHERE p.id=$1 FOR UPDATE OF p,s', [req.params.id]);
    if (!payment.rowCount || (req.user!.role === "CASHIER" && payment.rows[0].cashierId !== req.user!.id)) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Payment attempt not found" }); }
    const current = payment.rows[0];
    if (!["PENDING", "AUTHORIZED"].includes(current.status)) { await client.query("COMMIT"); return res.json({ id: current.id, status: current.status }); }
    const result = await paymentProvider.cancelPayment(current.providerReference);
    if (!result || result.status !== "CANCELLED") throw Object.assign(new Error("Payment provider could not cancel this attempt"), { status: 409, code: "PAYMENT_CANCEL_FAILED" });
    await client.query("UPDATE payment_records SET status='CANCELLED',updated_at=now() WHERE id=$1", [current.id]);
    await client.query("UPDATE sales SET status='VOIDED' WHERE id=$1 AND status='PENDING'", [current.saleId]);
    await client.query("INSERT INTO payment_events (id,payment_id,previous_status,status,event_type,performed_by,metadata) VALUES ($1,$2,$3,'CANCELLED','CANCELLED',$4,$5)", [`payment-event-${randomUUID()}`,current.id,current.status,req.user!.id,{ provider:current.provider }]);
    await audit(client,req.user!.id,"PAYMENT_CANCELLED","PAYMENT",current.id,{ saleId:current.saleId,provider:current.provider });
    await client.query("COMMIT");
    res.json({ id: current.id, status: "CANCELLED" });
  } catch (error) {
    await client.query("ROLLBACK");
    const failure = error as Error & { status?: number; code?: string };
    if (failure.status) return res.status(failure.status).json({ code: failure.code, error: failure.message });
    throw error;
  } finally { client.release(); }
});

app.post("/api/payments/:id/refund", auth, allow("ADMIN", "PHARMACIST"), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const payment = await client.query("SELECT id,sale_id,status,provider,provider_reference,amount::float FROM payment_records WHERE id=$1 FOR UPDATE", [req.params.id]);
    if (!payment.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ code: "NOT_FOUND", error: "Payment attempt not found" }); }
    const current = payment.rows[0];
    if (current.status === "REFUNDED") { await client.query("COMMIT"); return res.json({ id: current.id, status: current.status }); }
    if (current.status !== "PAID") { await client.query("ROLLBACK"); return res.status(409).json({ code: "INVALID_PAYMENT_STATE", error: "Only paid attempts can be refunded" }); }
    const result = await paymentProvider.refundPayment(current.provider_reference);
    if (!result || result.status !== "REFUNDED") throw Object.assign(new Error("Payment provider could not refund this attempt"), { status: 409, code: "PAYMENT_REFUND_FAILED" });
    await client.query("UPDATE payment_records SET status='REFUNDED',refund_amount=amount,updated_at=now() WHERE id=$1", [current.id]);
    await client.query("INSERT INTO payment_events (id,payment_id,previous_status,status,event_type,performed_by,metadata) VALUES ($1,$2,'PAID','REFUNDED','REFUND',$3,$4)", [`payment-event-${randomUUID()}`,current.id,req.user!.id,{ amount:current.amount,provider:current.provider }]);
    await audit(client,req.user!.id,"PAYMENT_REFUNDED","PAYMENT",current.id,{ saleId:current.sale_id,amount:current.amount,provider:current.provider });
    await client.query("COMMIT");
    res.json({ id: current.id, status: "REFUNDED" });
  } catch (error) {
    await client.query("ROLLBACK");
    const failure = error as Error & { status?: number; code?: string };
    if (failure.status) return res.status(failure.status).json({ code: failure.code, error: failure.message });
    throw error;
  } finally { client.release(); }
});

app.get("/api/sales/:id/receipt", auth, async (req: AuthRequest, res) => {
  const sale = await pool.query('SELECT s.id,s.cashier_id AS "cashierId",u.full_name AS "cashierName",s.transaction_date AS "transactionDate",s.subtotal::float,s.discount::float,s.tax::float,s.total_amount::float AS "totalAmount",s.payment_method AS "paymentMethod",s.amount_received::float AS "amountReceived",s.change_amount::float AS "changeAmount",s.status,p.status AS "paymentStatus",p.provider,p.provider_reference AS "providerReference" FROM sales s JOIN users u ON u.id=s.cashier_id LEFT JOIN LATERAL (SELECT status,provider,provider_reference FROM payment_records WHERE sale_id=s.id ORDER BY created_at DESC LIMIT 1) p ON true WHERE s.id=$1', [req.params.id]);
  if (!sale.rowCount || (req.user!.role === "CASHIER" && sale.rows[0].cashierId !== req.user!.id)) return res.status(404).json({ code: "NOT_FOUND", error: "Receipt not found" });
  const items = await pool.query('SELECT si.id AS "saleItemId",si.medicine_id AS "medicineId",m.brand_name AS "medicineName",si.quantity,si.unit_price::float AS "unitPrice",si.subtotal::float FROM sale_items si JOIN medicines m ON m.id=si.medicine_id WHERE si.sale_id=$1 ORDER BY si.id', [req.params.id]);
  const allocations = await pool.query('SELECT sib.sale_item_id AS "saleItemId",b.batch_number AS "batchNumber",b.expiration_date::text AS "expirationDate",sib.quantity FROM sale_item_batches sib JOIN medicine_batches b ON b.id=sib.batch_id JOIN sale_items si ON si.id=sib.sale_item_id WHERE si.sale_id=$1 ORDER BY b.expiration_date', [req.params.id]);
  const bySaleItem = new Map<string, typeof allocations.rows>();
  for (const allocation of allocations.rows) bySaleItem.set(allocation.saleItemId, [...(bySaleItem.get(allocation.saleItemId) ?? []),allocation]);
  const details = sale.rows[0];
  res.json({
    ...details,
    transactionTime: new Date(details.transactionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    paymentStatus: details.paymentStatus ?? (details.status === "COMPLETED" ? "PAID" : details.status),
    simulated: details.provider === "DUMMY",
    items: items.rows.map((item) => ({ ...item, batches: bySaleItem.get(item.saleItemId) ?? [] })),
  });
});

app.get("/api/backups", auth, allow("ADMIN"), async (req, res) => {
  const parsed = listFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_FILTER", error: "Backup history filters are invalid" });
  const { page, pageSize } = parsed.data;
  const [count, results] = await Promise.all([
    pool.query("SELECT count(*)::int AS total FROM backup_history"),
    pool.query('SELECT b.id,b.requested_at AS "requestedAt",b.completed_at AS "completedAt",b.status,b.file_name AS "fileName",b.file_format AS "fileFormat",b.file_size_bytes AS "fileSizeBytes",b.error_message AS "errorMessage",u.full_name AS "requestedBy" FROM backup_history b LEFT JOIN users u ON u.id=b.requested_by ORDER BY b.requested_at DESC LIMIT $1 OFFSET $2', [pageSize,(page-1)*pageSize]),
  ]);
  res.json({ backups: results.rows, page, pageSize, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total/pageSize) });
});

app.get("/api/backups/changes", auth, allow("ADMIN"), async (_req, res) => {
  const result = await pool.query(`SELECT l.id,l.user_id AS "userId",u.full_name AS "actorName",u.username AS "actorUsername",l.action,l.entity_type AS "entityType",l.entity_id AS "entityId",CASE WHEN l.entity_type='MEDICINE' THEN (SELECT brand_name FROM medicines WHERE id=l.entity_id) WHEN l.entity_type='SUPPLIER' THEN (SELECT supplier_name FROM suppliers WHERE id=l.entity_id) WHEN l.entity_type='USER' THEN (SELECT full_name FROM users WHERE id=l.entity_id) ELSE l.entity_id END AS "entityName",l.occurred_at AS timestamp,l.metadata,l.success FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.action NOT IN ('LOGIN','LOGOUT','LOGIN_FAILED','AUTHORIZATION_FAILED','BACKUP_REQUESTED','BACKUP_COMPLETED','BACKUP_FAILED','DOWNLOAD_BACKUP') ORDER BY l.occurred_at DESC LIMIT 500`);
  res.json({ logs: result.rows });
});

app.get("/api/backups/:id/download", auth, allow("ADMIN"), async (req: AuthRequest, res) => {
  const result = await pool.query("SELECT file_name FROM backup_history WHERE id=$1 AND status='COMPLETED'", [req.params.id]);
  if (!result.rowCount || !result.rows[0].file_name || basename(result.rows[0].file_name) !== result.rows[0].file_name) return res.status(404).json({ code: "NOT_FOUND", error: "Completed backup not found" });
  const backupDirectory = join(process.env.BACKUP_DIRECTORY ?? join(process.cwd(), ".backups"), "pharmasync");
  const outputPath = join(backupDirectory,result.rows[0].file_name);
  try { await stat(outputPath); }
  catch { return res.status(404).json({ code: "BACKUP_FILE_MISSING", error: "Backup file is unavailable" }); }
  await pool.query("INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,metadata,success) VALUES ($1,$2,'DOWNLOAD_BACKUP','BACKUP',$3,'{}',true)", [`log-${randomUUID()}`,req.user!.id,req.params.id]);
  res.download(outputPath,result.rows[0].file_name,(error)=>{ if(error&&!res.headersSent)res.status(404).json({code:"BACKUP_FILE_MISSING",error:"Backup file is unavailable"}); });
});

app.post("/api/backups", auth, allow("ADMIN"), backupLimiter, async (req: AuthRequest, res) => {
  const id = `backup-${randomUUID()}`;
  const stamp = `${new Date().toISOString().replace(/[:.]/g,"-")}-${randomUUID()}`;
  let fileName = `pharmasync-${stamp}.dump`;
  let fileFormat = "pg_dump-custom";
  const backupDirectory = join(process.env.BACKUP_DIRECTORY ?? join(process.cwd(), ".backups"), "pharmasync");
  let outputPath = join(backupDirectory,fileName);
  await pool.query("INSERT INTO backup_history (id,status,file_name,requested_by) VALUES ($1,'PENDING',$2,$3)", [id,fileName,req.user!.id]);
  await pool.query("INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,metadata,success) VALUES ($1,$2,'BACKUP_REQUESTED','BACKUP',$3,'{}',true)", [`log-${randomUUID()}`,req.user!.id,id]);
  try {
    await mkdir(backupDirectory,{ recursive:true,mode:0o700 });
    try {
      await dumpDatabase(connectionString!,outputPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "PG_DUMP_CATALOG_PERMISSION" && code !== "ENOENT") throw error;
      await unlink(outputPath).catch(() => undefined);
      fileName = `pharmasync-${stamp}.json.gz`;
      outputPath = join(backupDirectory,fileName);
      fileFormat = "logical-json-gzip";
      await writeFile(outputPath,await createLogicalBackup(pool),{ mode:0o600,flag:"wx" });
    }
    const fileSize = (await stat(outputPath)).size;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE backup_history SET status='COMPLETED',completed_at=now(),file_name=$2,file_format=$3,file_size_bytes=$4,error_message=NULL WHERE id=$1", [id,fileName,fileFormat,fileSize]);
      await audit(client,req.user!.id,"BACKUP_COMPLETED","BACKUP",id,{ fileName,fileFormat,fileSizeBytes:fileSize });
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    res.status(201).json({ id,status:"COMPLETED",fileName,fileFormat,fileSizeBytes:fileSize });
  } catch (error) {
    await unlink(outputPath).catch(() => undefined);
    await pool.query("UPDATE backup_history SET status='FAILED',completed_at=now(),error_message='Backup failed; check server tooling and backup permissions' WHERE id=$1", [id]);
    await pool.query("INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,metadata,success) VALUES ($1,$2,'BACKUP_FAILED','BACKUP',$3,'{}',false)", [`log-${randomUUID()}`,req.user!.id,id]);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return res.status(503).json({ code: "BACKUP_TOOL_UNAVAILABLE", error: "The PostgreSQL backup tool is not installed on the server" });
    res.status(500).json({ code: "BACKUP_FAILED", error: "Backup could not be completed; check backup configuration" });
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logError("api_request_failed", error);
  if (res.headersSent) return;
  const code = (error as { code?: string }).code;
  if (code === "23505") return res.status(409).json({ code: "CONFLICT", error: "A record with these details already exists" });
  if (code === "23503") return res.status(400).json({ code: "INVALID_REFERENCE", error: "A referenced record does not exist" });
  res.status(500).json({ code: "INTERNAL_ERROR", error: "The request could not be completed" });
});

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
if (!process.env.VERCEL) app.listen(port, "0.0.0.0", () => console.log(`PharmaSync API listening on port ${port}`));

export default app;