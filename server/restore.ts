import "dotenv/config";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { Pool } from "pg";
import { logicalTables } from "./backup.js";

type LogicalBackup = { format: string; schemaVersion: number; tables: Record<string, unknown[]> };
const filePath = process.argv[2];
const targetConnectionString = process.env.RESTORE_DATABASE_URL;
if (!filePath || !targetConnectionString) throw new Error("Usage: RESTORE_DATABASE_URL=<disposable test database> pnpm db:restore -- <backup.json.gz>");

const targetUrl = new URL(targetConnectionString);
const sourceConnectionString = process.env.DATABASE_URL ?? process.env.POSTGRESQL_ADDON_URI;
const sourceUrl = sourceConnectionString ? new URL(sourceConnectionString) : null;
const targetDatabase = decodeURIComponent(targetUrl.pathname.replace(/^\//, ""));
if (!/(test|restore|disposable)/i.test(targetDatabase)) throw new Error("Refusing restore: target database name must include test, restore, or disposable");
if (sourceUrl && sourceUrl.hostname === targetUrl.hostname && (sourceUrl.port || "5432") === (targetUrl.port || "5432") && sourceUrl.pathname === targetUrl.pathname) throw new Error("Refusing restore into the configured application database");

const backup = JSON.parse(gunzipSync(await readFile(filePath)).toString("utf8")) as LogicalBackup;
if (backup.format !== "pharmasync-logical-v1" || !Number.isInteger(backup.schemaVersion)) throw new Error("Unsupported PharmaSync logical backup format");
for (const table of logicalTables) {
  if (!Array.isArray(backup.tables[table])) throw new Error(`Backup is missing table data for ${table}`);
  if (backup.tables[table].some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error(`Backup contains invalid rows for ${table}`);
}

const pool = new Pool({ connectionString: targetConnectionString, max: 1, ssl: targetConnectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("TRUNCATE TABLE public.sessions,public.backup_history,public.payment_events,public.payment_records,public.sale_item_batches,public.sale_items,public.purchase_items,public.inventory_transactions,public.purchases,public.sales,public.medicine_batches,public.medicines,public.suppliers,public.audit_logs,public.users CASCADE");
  for (const table of logicalTables) {
    for (const row of backup.tables[table]) {
      await client.query(`INSERT INTO public.${table} SELECT (jsonb_populate_record(NULL::public.${table},$1::jsonb)).*`, [JSON.stringify(row)]);
    }
  }
  await client.query("COMMIT");
  const counts = await Promise.all(logicalTables.map(async (table) => {
    const result = await client.query(`SELECT count(*)::int AS count FROM public.${table}`);
    return { table, count: result.rows[0].count };
  }));
  console.log(JSON.stringify({ restoredAt: new Date().toISOString(), schemaVersion: backup.schemaVersion, counts }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}