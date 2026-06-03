// Add soft-delete columns to existing Postgres members table
// Idempotent: uses ADD COLUMN IF NOT EXISTS

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL — skipping');
    process.exit(0);
  }
  const url = process.env.DATABASE_URL;
  const ssl = { rejectUnauthorized: false };
  const client = new Client({ connectionString: url, ssl });
  await client.connect();
  console.log('Connected.');

  const stmts = [
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS pending_deletion_at TIMESTAMPTZ",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS deletion_confirmed_at TIMESTAMPTZ",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS deletion_confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL",
    "CREATE INDEX IF NOT EXISTS idx_members_pending_deletion ON members(soft_deleted_at, pending_deletion_at) WHERE is_active = 0",
  ];
  for (const s of stmts) {
    try { await client.query(s); console.log('OK:', s.slice(0, 80)); }
    catch (e) { console.error('FAIL:', s, e.message); }
  }

  // Verify columns exist
  const r = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name IN ('soft_deleted_at','pending_deletion_at','deletion_confirmed_at','deletion_confirmed_by') ORDER BY column_name"
  );
  console.log('Columns now present:', r.rows.map(x => x.column_name).join(', '));

  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
