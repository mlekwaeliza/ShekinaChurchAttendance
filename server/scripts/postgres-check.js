require('dotenv').config();

const { query, checkConnection, close } = require('../db/postgres');

const expectedRelations = [
  'attendance_report_view',
  'member_directory_view',
  'attendance_daily_summary',
  'leader_performance_summary',
  'member_engagement_summary',
  'missed_submission_candidates',
  'calendar_role_schedule_view'
];

async function relationExists(name) {
  const result = await query(
    `SELECT to_regclass($1) AS relation_name`,
    [`public.${name}`]
  );
  return Boolean(result.rows[0].relation_name);
}

async function countRows(tableName) {
  const result = await query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
  return result.rows[0].count;
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
    throw new Error('Set DATABASE_URL, or set PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD before checking PostgreSQL.');
  }

  const health = await checkConnection();
  console.log(`Connected to PostgreSQL database "${health.database}" as "${health.user}" (${health.latency_ms}ms)`);

  const migrations = await query('SELECT name, applied_at FROM schema_migrations ORDER BY id');
  console.log('Applied migrations:');
  for (const migration of migrations.rows) {
    console.log(`- ${migration.name} at ${migration.applied_at.toISOString()}`);
  }

  console.log('Core table counts:');
  for (const tableName of ['users', 'sections', 'leaders', 'members', 'attendance', 'submission_log']) {
    console.log(`- ${tableName}: ${await countRows(tableName)}`);
  }

  console.log('PostgreSQL reporting relations:');
  for (const relationName of expectedRelations) {
    console.log(`- ${relationName}: ${(await relationExists(relationName)) ? 'ok' : 'missing'}`);
  }
}

main()
  .catch((error) => {
    console.error('PostgreSQL check failed:', error.message);
    process.exitCode = 1;
  })
  .finally(close);
