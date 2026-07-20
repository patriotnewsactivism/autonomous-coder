// Applies pending SQL migrations from server/migrations/ on boot.
// Runs from inside the deployed container (real network path to the DB),
// intentionally bypassing any external tooling that can't reach the DB directly.
// All migration files are idempotent (CREATE TABLE IF NOT EXISTS, etc.), so
// re-running this on every boot is safe.
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Supabase's direct "db.<ref>.supabase.co:5432" host is IPv6-only on this
// project's tier, and this container's network stack is IPv4-only, so we go
// through Supavisor's IPv4 pooler instead. The pooler is region-specific, so
// try a short list of candidates and use whichever one actually accepts a
// connection for this project ref.
const SUPABASE_REF = "zmrcvrzxnnxozqakuebn";
const POOLER_REGIONS = ["us-east-1", "us-east-2", "us-west-1", "eu-central-1", "ap-southeast-1"];

function poolerUrl(region: string): string | null {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  // Expect postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
  const match = raw.match(/postgresql:\/\/postgres:([^@]+)@/);
  if (!match) return null;
  const password = match[1];
  return `postgresql://postgres.${SUPABASE_REF}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

async function tryConnect(connectionString: string): Promise<Pool | null> {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await pool.query("select 1");
    return pool;
  } catch {
    await pool.end().catch(() => {});
    return null;
  }
}

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.log("[migrations] No migrations directory found — nothing to do.");
    return;
  }
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) {
    console.log("[migrations] No .sql files to run.");
    return;
  }

  let pool: Pool | null = null;

  // First try DATABASE_URL as-is (in case it's already a working pooler/IPv4 URL).
  if (process.env.DATABASE_URL) {
    pool = await tryConnect(process.env.DATABASE_URL);
  }

  if (!pool) {
    for (const region of POOLER_REGIONS) {
      const url = poolerUrl(region);
      if (!url) break;
      console.log(`[migrations] trying pooler region ${region}...`);
      pool = await tryConnect(url);
      if (pool) {
        console.log(`[migrations] connected via pooler region ${region}.`);
        break;
      }
    }
  }

  if (!pool) {
    console.warn("[migrations] could not establish a DB connection via any known route — skipping.");
    return;
  }

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      console.log(`[migrations] applying ${file}...`);
      await pool.query(sql);
      console.log(`[migrations] ${file} applied OK.`);
    }
  } catch (err) {
    console.error("[migrations] FAILED:", err);
  } finally {
    await pool.end();
  }
}
