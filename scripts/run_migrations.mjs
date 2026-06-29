import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const { Client } = pg;
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL');

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log('Running:', file);
    try {
      await client.query(sql);
      console.log('  OK');
    } catch(e) {
      console.log('  Error:', e.message);
    }
  }

  const res = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('agent_memory', 'analysis_history', 'coder_projects', 'coder_notifications')"
  );
  console.log('\nExisting tables:', res.rows.map(r => r.table_name));

  await client.end();
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
