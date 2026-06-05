// Add password_reset columns to existing Postgres users table.
// Idempotent: uses ADD COLUMN IF NOT EXISTS.
// Run automatically by render preDeployCommand so that schema changes
// in postgres-schema.sql are reflected on the live database.

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL -- skipping password-reset column migration');
    process.exit(0);
  }

  const url = process.env.DATABASE_URL;
  const ssl = process.env.PGSSL === 'true' || url.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false;
  const client = new Client({ connectionString: url, ssl });
  await client.connect();
  console.log('Connected to PostgreSQL.');

  const stmts = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ",
    "CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL"
  ];

  for (const s of stmts) {
    try {
      await client.query(s);
      console.log('OK:', s.slice(0, 100));
    } catch (e) {
      console.error('FAIL:', s, e.message);
      throw e;
    }
  }

  const r = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('password_reset_token','password_reset_expires') ORDER BY column_name"
  );
  console.log('Columns now present on users:', r.rows.map(x => x.column_name).join(', '));

  await client.end();
  console.log('Migration complete.');
})().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
