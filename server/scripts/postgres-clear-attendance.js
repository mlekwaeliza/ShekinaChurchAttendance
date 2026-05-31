require('dotenv').config();

const { Pool } = require('pg');

const tables = [
  'attendance',
  'submission_log',
  'offline_attendance_imports',
  'absent_followups'
];

const materializedViews = [
  'attendance_daily_summary',
  'leader_performance_summary',
  'member_engagement_summary'
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000)
});

async function relationExists(name) {
  const result = await pool.query('SELECT to_regclass($1) AS name', [`public.${name}`]);
  return Boolean(result.rows[0].name);
}

async function countRows(tableName) {
  if (!(await relationExists(tableName))) return null;
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
  return result.rows[0].count;
}

async function printCounts(label) {
  console.log(label);
  for (const tableName of tables) {
    const count = await countRows(tableName);
    console.log(`${tableName}: ${count === null ? 'missing' : count}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  await printCounts('Before cleanup');

  await pool.query('BEGIN');
  try {
    await pool.query("DELETE FROM notifications WHERE type IN ('missed_submission', 'absent_member', 'attendance_drop')");
    await pool.query('DELETE FROM absent_followups');
    await pool.query('DELETE FROM offline_attendance_imports');
    await pool.query('DELETE FROM submission_log');
    await pool.query('DELETE FROM attendance');
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  for (const viewName of materializedViews) {
    if (await relationExists(viewName)) {
      await pool.query(`REFRESH MATERIALIZED VIEW "${viewName}"`);
      console.log(`refreshed ${viewName}`);
    }
  }

  await printCounts('After cleanup');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
