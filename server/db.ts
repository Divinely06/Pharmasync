import { readFile } from "node:fs/promises";
import type { Pool } from "pg";

export const requiredDatabaseTables = [
  "users",
  "sessions",
  "suppliers",
  "medicines",
  "medicine_batches",
  "sales",
  "purchases",
  "purchase_items",
  "payment_records",
  "payment_events",
  "backup_history",
  "schema_migrations",
  "sale_items",
  "sale_item_batches",
  "inventory_transactions",
  "audit_logs",
] as const;

export const missingDatabaseTables = (availableTables: readonly string[]) => {
  const available = new Set(availableTables);
  return requiredDatabaseTables.filter((table) => !available.has(table));
};

export const normalizeDatabaseUrl = (input: string) => {
  if (!input) return input;
  try {
    const url = new URL(input);
    if (url.searchParams.get("sslmode") === "require" && !url.searchParams.has("uselibpqcompat")) {
      url.searchParams.set("uselibpqcompat", "true");
      return url.toString();
    }
    return input;
  } catch {
    return input;
  }
};

const repairNullTimestampColumns = `
  ALTER TABLE sessions ALTER COLUMN created_at SET DEFAULT now();
  UPDATE sessions SET created_at = now() WHERE created_at IS NULL;
  ALTER TABLE audit_logs ALTER COLUMN occurred_at SET DEFAULT now();
  UPDATE audit_logs SET occurred_at = now() WHERE occurred_at IS NULL;
  ALTER TABLE medicine_batches ALTER COLUMN created_at SET DEFAULT now();
  ALTER TABLE medicine_batches ALTER COLUMN updated_at SET DEFAULT now();
  UPDATE medicine_batches SET created_at = now() WHERE created_at IS NULL;
  UPDATE medicine_batches SET updated_at = now() WHERE updated_at IS NULL;
`;

export const applyDatabaseSchema = async (pool: Pool) => {
  await pool.query(repairNullTimestampColumns);
  const schemaSql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await pool.query(schemaSql);
};
