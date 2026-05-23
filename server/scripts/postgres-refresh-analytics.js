require('dotenv').config();

const { query, close } = require('../db/postgres');

const materializedViews = [
  'attendance_daily_summary',
  'leader_performance_summary',
  'member_engagement_summary'
];

async function refreshView(viewName) {
  const startedAt = Date.now();
  await query(`REFRESH MATERIALIZED VIEW "${viewName}"`);
  console.log(`Refreshed ${viewName} in ${Date.now() - startedAt}ms`);
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
    throw new Error('Set DATABASE_URL, or set PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD before refreshing analytics.');
  }

  for (const viewName of materializedViews) {
    await refreshView(viewName);
  }
}

main()
  .catch((error) => {
    console.error('PostgreSQL analytics refresh failed:', error.message);
    process.exitCode = 1;
  })
  .finally(close);
