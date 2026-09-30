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
