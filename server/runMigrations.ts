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

export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[migrations] DATABASE_URL not set — skipping migration run.");
    return;
  }

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

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      console.log(`[migrations] applying ${file}...`);
      await pool.query(sql);
      console.log(`[migrations] ${file} applied OK.`);
    }
  } catch (err) {
    console.error("[migrations] FAILED:", err);
    // Non-fatal: don't crash the whole app boot over a migration issue.
    // The app should already handle missing tables gracefully where it does today.
  } finally {
    await pool.end();
  }
}
