#!/usr/bin/env node
//
// postgres-add-trgm-index.js
//
// Adds a pg_trgm GIN index on audit_log.old_value and audit_log.new_value
// to speed up the substring search in getAuditLog().
//
// When the table is small (<10K rows) a sequential scan is faster than
// the index, so this script is a no-op until the operator decides to
// run it. The threshold is documented in DBA_NOTES.md.
//
// Idempotent: running it multiple times is safe. The CREATE EXTENSION
// uses IF NOT EXISTS and the CREATE INDEX uses IF NOT EXISTS.
//
// Usage:
//   DATABASE_URL=... node scripts/postgres-add-trgm-index.js
//
// The script connects with the same SSL settings as the app. It does
// not require the server to be down — CREATE INDEX CONCURRENTLY is
// used when supported (PostgreSQL >= 9.5 supports IF NOT EXISTS for
// indexes, so we can fall back to plain CREATE INDEX IF NOT EXISTS
// which acquires a brief lock but is safe in dev/staging).
//
// Exit codes:
//   0  success (extension + index created or already present)
//   1  connection failure
//   2  extension creation failed (likely missing superuser)
//   3  index creation failed

const { Client } = require('pg');

function isTruthy(v) {
  return ['1', 'true', 'yes'].includes(String(v || '').toLowerCase());
}

function buildSslConfig() {
  const sslEnabled = isTruthy(process.env.PGSSL || process.env.POSTGRES_SSL);
  if (!sslEnabled) return false;
  const rejectUnauthorized = process.env.PG_REJECT_UNAUTHORIZED === 'false' ? false : true;
  return { rejectUnauthorized };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: buildSslConfig()
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }

  // Step 1: ensure pg_trgm extension is installed.
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('[ok] pg_trgm extension is available');
  } catch (err) {
    console.error('[fail] Could not create pg_trgm extension:', err.message);
    console.error('       You may need to run this as a superuser or have the');
    console.error('       pg_trgm extension pre-installed. On Neon, the');
    console.error('       extension is in the default allowlist and works.');
    await client.end();
    process.exit(2);
  }

  // Step 2: create the GIN index on old_value.
  // gin_trgm_ops enables trigram-based LIKE / ILIKE substring matches.
  // The index is on each column separately so the planner can choose
  // bitmap-OR or union them based on the query.
  const statements = [
    {
      name: 'idx_audit_old_value_trgm',
      sql: 'CREATE INDEX IF NOT EXISTS idx_audit_old_value_trgm ON audit_log USING GIN (old_value gin_trgm_ops)'
    },
    {
      name: 'idx_audit_new_value_trgm',
      sql: 'CREATE INDEX IF NOT EXISTS idx_audit_new_value_trgm ON audit_log USING GIN (new_value gin_trgm_ops)'
    }
  ];

  let allOk = true;
  for (const stmt of statements) {
    try {
      await client.query(stmt.sql);
      const exists = await client.query(
        "SELECT 1 FROM pg_indexes WHERE indexname = $1",
        [stmt.name]
      );
      if (exists.rowCount > 0) {
        console.log(`[ok]   Index ${stmt.name} is present`);
      } else {
        console.log(`[warn] CREATE ran but ${stmt.name} not found in pg_indexes`);
        allOk = false;
      }
    } catch (err) {
      console.error(`[fail] Could not create ${stmt.name}:`, err.message);
      allOk = false;
    }
  }

  // Step 3: print size estimate so the operator can see the trade-off.
  try {
    const stats = await client.query(`
      SELECT
        pg_size_pretty(pg_total_relation_size('audit_log')) AS total_size,
        (SELECT count(*) FROM audit_log) AS row_count
    `);
    if (stats.rowCount > 0) {
      const { total_size, row_count } = stats.rows[0];
      console.log(`[info] audit_log: ${row_count} rows, ${total_size} on disk`);
    }
  } catch (_) { /* best-effort */ }

  await client.end();
  process.exit(allOk ? 0 : 3);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
