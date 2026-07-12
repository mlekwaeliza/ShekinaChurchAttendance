const { queries, get, all } = require('./database');

async function main() {
  try {
    const counts = {};
    const tables = ['users', 'members', 'sections', 'leaders', 'attendance', 'finance_daily_records', 'finance_expenses', 'contributions'];
    for (const table of tables) {
      const res = await get(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = res.count;
    }
    console.log('--- Table Counts ---', counts);

    const financeRes = await queries.getFinanceRecords({});
    console.log('--- getFinanceRecords result ---');
    console.log(JSON.stringify(financeRes.slice(0, 5), null, 2));

    const contribsRes = await queries.getContributions({});
    console.log('--- getContributions result ---');
    console.log(JSON.stringify(contribsRes.slice(0, 5), null, 2));
  } catch (err) {
    console.error('Error running queries:', err);
  }
}

main();
