import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRESQL_ADDON_URI;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 1), ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined });
const client = await pool.connect();
try {
	await client.query("BEGIN");
	await client.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
	await client.query("INSERT INTO schema_migrations (version) VALUES (1),(2),(3),(4) ON CONFLICT (version) DO NOTHING");
	await client.query(await readFile(new URL("../db/seed.sql", import.meta.url), "utf8"));
	await client.query("COMMIT");
} catch (error) {
	await client.query("ROLLBACK");
	throw error;
} finally {
	client.release();
	await pool.end();
}
console.log("PostgreSQL schema and demo seed applied.");