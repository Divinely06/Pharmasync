import { chmod } from "node:fs/promises";
import { gzip } from "node:zlib";
import { spawn } from "node:child_process";
import type { Pool } from "pg";

export const logicalTables = [
  "users",
  "suppliers",
  "medicines",
  "medicine_batches",
  "sales",
  "purchases",
  "purchase_items",
  "sale_items",
  "sale_item_batches",
  "inventory_transactions",
  "payment_records",
  "payment_events",
  "audit_logs",
] as const;

const postgresEnvironment = (connectionString: string) => {
  const url = new URL(connectionString);
  const { DATABASE_URL: _databaseUrl, POSTGRESQL_ADDON_URI: _addonUri, ...parentEnvironment } = process.env;
  return {
    ...parentEnvironment,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    ...(url.searchParams.has("sslmode") ? { PGSSLMODE: url.searchParams.get("sslmode")! } : {}),
  };
};

export const dumpDatabase = async (connectionString: string, outputPath: string) => {
  const env = postgresEnvironment(connectionString);
  await new Promise<void>((resolve, reject) => {
    const process = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--no-publications", "--no-subscriptions", "--file", outputPath], { env, stdio: ["ignore", "ignore", "pipe"] });
    let errorOutput = "";
    process.stderr?.on("data", (chunk: Buffer) => { errorOutput += chunk.toString(); });
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) return resolve();
      const error = new Error("Database backup process failed") as Error & { code?: string };
      error.code = errorOutput.includes("permission denied for table pg_database") ? "PG_DUMP_CATALOG_PERMISSION" : "PG_DUMP_FAILED";
      reject(error);
    });
  });
  await chmod(outputPath, 0o600);
};

const gzipBuffer = (input: Buffer) => new Promise<Buffer>((resolve, reject) => {
  gzip(input, { level: 9 }, (error, output) => error ? reject(error) : resolve(output));
});

export const createLogicalBackup = async (pool: Pool) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const version = await client.query("SELECT COALESCE(max(version),0)::int AS version FROM schema_migrations");
    const tables: Record<string, unknown[]> = {};
    for (const table of logicalTables) {
      const result = await client.query(`SELECT COALESCE(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) AS rows FROM public.${table} AS row_data`);
      tables[table] = result.rows[0].rows;
    }
    await client.query("COMMIT");
    return gzipBuffer(Buffer.from(JSON.stringify({ format: "pharmasync-logical-v1", createdAt: new Date().toISOString(), schemaVersion: version.rows[0].version, tables })));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
};