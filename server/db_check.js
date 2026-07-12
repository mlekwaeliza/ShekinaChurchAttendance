require('dotenv').config();
console.log('DB_CLIENT in env:', process.env.DB_CLIENT);
console.log('DATABASE_URL is set:', !!process.env.DATABASE_URL);

const { queries, get, all } = require('./database');

async function main() {
  try {
    const counts = {};
    const tables = ['users', 'members', 'sections', 'leaders', 'attendance', 'finance_daily_records', 'finance_expenses', 'contributions'];
    for (const table of tables) {
      const res = await get(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = res.count;
    }
    console.log('--- Database Counts ---', counts);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
