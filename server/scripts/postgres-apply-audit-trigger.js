/**
 * Apply the audit_log append-only triggers to an existing Postgres DB.
 *
 * Safe to run multiple times: it uses CREATE OR REPLACE and DROP TRIGGER IF EXISTS.
 * Required when upgrading a database that was initialized before Phase 2.
 *
 *   node scripts/postgres-apply-audit-trigger.js
 */

require('dotenv').config();
const { pool } = require('../db/postgres');
const fs = require('fs');
const path = require('path');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'postgres-audit-trigger.sql'), 'utf8');
  console.log('Applying audit_log append-only trigger...');
  await pool.query(sql);
  console.log('OK: audit_log is now append-only.');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to apply trigger:', err.message);
  process.exit(1);
});
