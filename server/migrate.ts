import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRESQL_ADDON_URI;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString, ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined });
await pool.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
await pool.end();
console.log("PostgreSQL schema and demo seed applied.");