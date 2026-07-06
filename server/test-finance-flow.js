// Test script to simulate the exact finance POST flow
const express = require('express');
const { queries, run, get, all } = require('./database');
const { isAuthenticated, requireRole } = require('./middleware/auth');

// Set up minimal Express app
const app = express();
app.use(express.json());

// Mock session middleware
app.use((req, res, next) => {
  req.session = { userId: 3, user: { role: 'accountant' } };
  req.cookies = {};
  next();
});

// Copy the calcFinance and route logic
function calcFinance(morning, afternoon, tithes, evangelism = 0) {
  const m = Number(morning) || 0;
  const a = Number(afternoon) || 0;
  const t = Number(tithes) || 0;
  const e = Number(evangelism) || 0;
  const total = m + a + t + e;
  const mission = Math.round(total * 0.1 * 100) / 100;
  const remaining = Math.round((total - mission) * 100) / 100;
  const bishop = Math.round(remaining * 0.1 * 100) / 100;
  const usable = Math.round((remaining - bishop) * 100) / 100;
  return { total, mission, remaining, bishop, usable };
}

// Simulate POST /finance/records exactly as in the route handler
app.post('/test/finance/records', async (req, res) => {
  try {
    const { record_date, morning_offering, afternoon_offering, evangelism_offering, tithe_entries, expenses, notes } = req.body;
    console.log('POST /test/finance/records body:', JSON.stringify(req.body, null, 2));

    if (!record_date) return res.status(400).json({ error: 'Record date is required' });

    // Save tithe entries as Contributions
    const titheType = await get(`SELECT id FROM contribution_types WHERE name = 'Tithes'`);
    console.log('Tithe type found:', !!titheType);

    if (Array.isArray(tithe_entries) && titheType) {
      for (const entry of tithe_entries) {
        if (entry.member_id && Number(entry.amount) > 0) {
          await run(
            `INSERT INTO contributions (member_id, contribution_type_id, amount, payment_date, payment_method, recorded_by) VALUES (?, ?, ?, ?, 'Cash', ?)`,
            [entry.member_id, titheType.id, Number(entry.amount), record_date, req.session.userId]
          );
          console.log('Inserted tithe entry for member:', entry.member_id);
        }
      }
    }

    // Calculate auto tithes
    const tithesResult = await get(`SELECT COALESCE(SUM(amount), 0) as total FROM contributions c JOIN contribution_types ct ON c.contribution_type_id = ct.id WHERE ct.name = 'Tithes' AND c.payment_date = ?`, [record_date]);
    const auto_tithes = tithesResult?.total || 0;
    console.log('Auto tithes:', auto_tithes);

    // Calculate finance
    const c = calcFinance(morning_offering, afternoon_offering, auto_tithes, evangelism_offering);
    console.log('Calc finance result:', JSON.stringify(c));

    // Create record
    await queries.createFinanceRecord({
      record_date, morning_offering: Number(morning_offering) || 0, afternoon_offering: Number(afternoon_offering) || 0,
      evangelism_offering: Number(evangelism_offering) || 0,
      total_tithes: auto_tithes, total_income: c.total, mission_fund: c.mission,
      remaining_after_mission: c.remaining, bishop_fund: c.bishop,
      usable_church_funds: c.usable, notes, created_by: req.session.userId
    });
    console.log('Finance record created');

    // Get created record
    const createdRecord = await get("SELECT * FROM finance_daily_records WHERE record_date = ?", [record_date]);
    console.log('Created record:', JSON.stringify(createdRecord));

    if (!createdRecord) {
      return res.status(500).json({ error: 'Created record not found after insert!' });
    }

    // Save expenses
    if (Array.isArray(expenses)) {
      for (const exp of expenses) {
        if (exp.category && Number(exp.amount) > 0) {
          await queries.createFinanceExpense({ record_id: createdRecord.id, category: exp.category, amount: Number(exp.amount), description: exp.description || '' });
          console.log('Inserted expense:', exp.category);
        }
      }
    }

    res.status(201).json({ message: 'Record created', record: createdRecord });
  } catch (err) {
    console.error('Error creating finance record:', err);
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'A record for this date already exists' });
    res.status(500).json({ error: 'Failed to create record', details: err.message });
  }
});

// Test the endpoint
async function runTests() {
  try {
    // Clean up any existing test data
    const existing = await get("SELECT id FROM finance_daily_records WHERE record_date = '2026-07-06'");
    if (existing) {
      await run('DELETE FROM finance_expenses WHERE record_id = ?', [existing.id]);
      await run('DELETE FROM contributions WHERE payment_date = ?', ['2026-07-06']);
      await run('DELETE FROM finance_daily_records WHERE id = ?', [existing.id]);
      console.log('Cleaned up existing data');
    }

    // Test 1: Basic record (no tithes, no expenses)
    console.log('\n=== Test 1: Basic record ===');
    const req1 = { body: { record_date: '2026-07-06', morning_offering: '5000', afternoon_offering: '3000', evangelism_offering: '1000', tithe_entries: [], expenses: [], notes: 'Test' } };
    const res1 = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(d) { this.body = d; } };
    await app.handle(req1, res1, () => {});
    console.log('Status:', res1.statusCode, 'Body:', JSON.stringify(res1.body));

    // Test 2: Record with tithes and expenses
    console.log('\n=== Test 2: Record with tithes and expenses ===');
    const record_date2 = '2026-07-07';
    const existing2 = await get("SELECT id FROM finance_daily_records WHERE record_date = ?", [record_date2]);
    if (existing2) {
      await run('DELETE FROM finance_expenses WHERE record_id = ?', [existing2.id]);
      await run('DELETE FROM contributions WHERE payment_date = ?', [record_date2]);
      await run('DELETE FROM finance_daily_records WHERE id = ?', [existing2.id]);
    }
    const req2 = { body: { record_date: record_date2, morning_offering: '10000', afternoon_offering: '5000', evangelism_offering: '2000', tithe_entries: [{ member_id: 1, amount: '5000' }, { member_id: 2, amount: '3000' }], expenses: [{ category: 'Transport', amount: '2000', description: 'Fuel' }], notes: 'Full test' } };
    const res2 = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(d) { this.body = d; } };
    await app.handle(req2, res2, () => {});
    console.log('Status:', res2.statusCode, 'Body:', JSON.stringify(res2.body));

    if (res2.statusCode === 201 && res2.body?.record?.id) {
      // Test 3: Submit the record
      console.log('\n=== Test 3: Submit record ===');
      try {
        await queries.submitFinanceRecord(res2.body.record.id, 3);
        const submitted = await queries.getFinanceRecordById(res2.body.record.id);
        console.log('Submitted status:', submitted?.status);
      } catch (e) {
        console.error('Submit failed:', e.message);
      }

      // Cleanup
      await run('DELETE FROM finance_expenses WHERE record_id = ?', [res2.body.record.id]);
      await run('DELETE FROM contributions WHERE payment_date = ?', [record_date2]);
      await run('DELETE FROM finance_daily_records WHERE id = ?', [res2.body.record.id]);
    }

    // Cleanup test 1
    const rec1 = await get("SELECT id FROM finance_daily_records WHERE record_date = '2026-07-06'");
    if (rec1) {
      await run('DELETE FROM finance_expenses WHERE record_id = ?', [rec1.id]);
      await run('DELETE FROM contributions WHERE payment_date = ?', ['2026-07-06']);
      await run('DELETE FROM finance_daily_records WHERE id = ?', [rec1.id]);
    }

    console.log('\n=== All tests completed ===');
  } catch (err) {
    console.error('Test error:', err);
  }
}

runTests().then(() => process.exit(0));
