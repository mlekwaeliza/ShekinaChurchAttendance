const express = require('express');
const { queries, run, get } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const router = express.Router();
router.use(isAuthenticated);
router.use(requireRole(['admin', 'accountant']));

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']);
const uploadsDir = path.join(__dirname, '../uploads/finance');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return cb(new Error('Invalid file type'));
    cb(null, `receipt-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function calcFinance(morning, afternoon, tithes) {
  const m = Number(morning) || 0;
  const a = Number(afternoon) || 0;
  const t = Number(tithes) || 0;
  const total = m + a + t;
  const mission = Math.round(total * 0.1 * 100) / 100;
  const remaining = Math.round((total - mission) * 100) / 100;
  const bishop = Math.round(remaining * 0.1 * 100) / 100;
  const usable = Math.round((remaining - bishop) * 100) / 100;
  return { total, mission, remaining, bishop, usable };
}

router.post('/finance/records', async (req, res) => {
  try {
    const { record_date, morning_offering, afternoon_offering, evangelism_offering, notes } = req.body;
    if (!record_date) return res.status(400).json({ error: 'Record date is required' });
    const tithesResult = await get(`SELECT COALESCE(SUM(amount), 0) as total FROM contributions c JOIN contribution_types ct ON c.contribution_type_id = ct.id WHERE ct.name = 'Tithes' AND c.payment_date = ?`, [record_date]);
    const auto_tithes = tithesResult?.total || 0;
    const c = calcFinance(morning_offering, afternoon_offering, auto_tithes);
    await queries.createFinanceRecord({
      record_date, morning_offering: Number(morning_offering) || 0, afternoon_offering: Number(afternoon_offering) || 0,
      evangelism_offering: Number(evangelism_offering) || 0,
      total_tithes: auto_tithes, total_income: c.total, mission_fund: c.mission,
      remaining_after_mission: c.remaining, bishop_fund: c.bishop,
      usable_church_funds: c.usable, notes, created_by: req.session.userId
    });
    res.status(201).json({ message: 'Record created' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'A record for this date already exists' });
    console.error('Error creating finance record:', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

router.get('/finance/records', async (req, res) => {
  try {
    const records = await queries.getFinanceRecords(req.query);
    for (const r of records) {
      const tithes = await get(`SELECT COALESCE(SUM(amount), 0) as total FROM contributions c JOIN contribution_types ct ON c.contribution_type_id = ct.id WHERE ct.name = 'Tithes' AND c.payment_date = ?`, [r.record_date]);
      r.auto_tithes = tithes?.total || 0;
    }
    res.json(records);
  } catch (err) {
    console.error('Error fetching finance records:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

router.get('/finance/records/:id', async (req, res) => {
  try {
    const record = await queries.getFinanceRecordById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const expenses = await queries.getFinanceExpenses(req.params.id);
    const tithes = await get(`SELECT COALESCE(SUM(amount), 0) as total FROM contributions c JOIN contribution_types ct ON c.contribution_type_id = ct.id WHERE ct.name = 'Tithes' AND c.payment_date = ?`, [record.record_date]);
    record.auto_tithes = tithes?.total || 0;
    res.json({ ...record, expenses });
  } catch (err) {
    console.error('Error fetching finance record:', err);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

router.put('/finance/records/:id', async (req, res) => {
  try {
    const existing = await queries.getFinanceRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    if (!['draft', 'rejected'].includes(existing.status)) return res.status(400).json({ error: 'Only draft or rejected records can be edited' });
    const { morning_offering, afternoon_offering, evangelism_offering, notes } = req.body;
    const data = {};
    if (existing.status === 'rejected') { data.status = 'draft'; data.rejection_reason = null; }
    if (morning_offering !== undefined) data.morning_offering = Number(morning_offering);
    if (afternoon_offering !== undefined) data.afternoon_offering = Number(afternoon_offering);
    if (evangelism_offering !== undefined) data.evangelism_offering = Number(evangelism_offering);
    if (notes !== undefined) data.notes = notes;
    const tithesResult = await get(`SELECT COALESCE(SUM(amount), 0) as total FROM contributions c JOIN contribution_types ct ON c.contribution_type_id = ct.id WHERE ct.name = 'Tithes' AND c.payment_date = ?`, [existing.record_date]);
    const auto_tithes = tithesResult?.total || 0;
    data.total_tithes = auto_tithes;
    const c = calcFinance(
      data.morning_offering ?? existing.morning_offering,
      data.afternoon_offering ?? existing.afternoon_offering,
      auto_tithes
    );
    Object.assign(data, {
      total_income: c.total, mission_fund: c.mission,
      remaining_after_mission: c.remaining, bishop_fund: c.bishop,
      usable_church_funds: c.usable
    });
    await queries.updateFinanceRecord(req.params.id, data);
    res.json({ message: 'Record updated' });
  } catch (err) {
    console.error('Error updating finance record:', err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

router.delete('/finance/records/:id', async (req, res) => {
  try {
    const existing = await queries.getFinanceRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    if (!['draft', 'rejected'].includes(existing.status)) return res.status(400).json({ error: 'Only draft or rejected records can be deleted' });
    await queries.deleteFinanceRecord(req.params.id);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    console.error('Error deleting finance record:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

router.post('/finance/records/:id/submit', async (req, res) => {
  try {
    const existing = await queries.getFinanceRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    if (!['draft', 'rejected'].includes(existing.status)) return res.status(400).json({ error: 'Only draft or rejected records can be submitted' });
    await queries.submitFinanceRecord(req.params.id, req.session.userId);
    res.json({ message: 'Record submitted for approval' });
  } catch (err) {
    console.error('Error submitting finance record:', err);
    res.status(500).json({ error: 'Failed to submit record' });
  }
});

router.post('/finance/records/:id/expenses', async (req, res) => {
  try {
    const { category, amount, description } = req.body;
    if (!category || !amount) return res.status(400).json({ error: 'Category and amount are required' });
    const existing = await queries.getFinanceRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    if (!['draft', 'rejected'].includes(existing.status)) return res.status(400).json({ error: 'Only draft or rejected records can be edited' });
    await queries.createFinanceExpense({ record_id: req.params.id, category, amount, description });
    res.status(201).json({ message: 'Expense added' });
  } catch (err) {
    console.error('Error adding expense:', err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

router.put('/finance/expenses/:id', async (req, res) => {
  try {
    const { category, amount, description } = req.body;
    if (!category || !amount) return res.status(400).json({ error: 'Category and amount are required' });
    await queries.updateFinanceExpense(req.params.id, { category, amount, description, receipt_path: undefined });
    res.json({ message: 'Expense updated' });
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

router.delete('/finance/expenses/:id', async (req, res) => {
  try {
    await queries.deleteFinanceExpense(req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

router.post('/finance/expenses/:id/receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Receipt file is required' });
    const receiptPath = '/uploads/finance/' + req.file.filename;
    await queries.updateFinanceExpenseReceipt(req.params.id, receiptPath);
    res.json({ message: 'Receipt uploaded', path: receiptPath });
  } catch (err) {
    console.error('Error uploading receipt:', err);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

router.post('/finance/records/:id/receipt/:type', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Receipt file is required' });
    const { type } = req.params;
    if (!['bishop', 'evangelism', 'remaining'].includes(type)) return res.status(400).json({ error: 'Invalid receipt type' });
    const receiptPath = `/uploads/finance/${req.file.filename}`;
    const fieldMap = { bishop: 'bishop_receipt', evangelism: 'evangelism_receipt', remaining: 'remaining_receipt' };
    await queries.updateFinanceRecord(req.params.id, { [fieldMap[type]]: receiptPath });
    res.json({ message: `${type} receipt uploaded`, path: receiptPath });
  } catch (err) {
    console.error('Error uploading receipt:', err);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

router.put('/finance/records/:id/approve', async (req, res) => {
  try {
    const existing = await queries.getFinanceRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    if (existing.status !== 'submitted') return res.status(400).json({ error: 'Only submitted records can be approved' });
    await queries.approveFinanceRecord(req.params.id, req.session.userId);
    res.json({ message: 'Record approved' });
  } catch (err) {
    console.error('Error approving record:', err);
    res.status(500).json({ error: 'Failed to approve record' });
  }
});

router.put('/finance/records/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
    const existing = await queries.getFinanceRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    if (existing.status !== 'submitted') return res.status(400).json({ error: 'Only submitted records can be rejected' });
    await queries.rejectFinanceRecord(req.params.id, req.session.userId, reason);
    res.json({ message: 'Record rejected' });
  } catch (err) {
    console.error('Error rejecting record:', err);
    res.status(500).json({ error: 'Failed to reject record' });
  }
});

router.put('/finance/records/:id/send-back', async (req, res) => {
  try {
    const existing = await queries.getFinanceRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    if (!['submitted', 'rejected'].includes(existing.status)) return res.status(400).json({ error: 'Only submitted or rejected records can be sent back' });
    await run(`UPDATE finance_daily_records SET status='draft', rejection_reason=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [req.params.id]);
    res.json({ message: 'Record sent back for correction' });
  } catch (err) {
    console.error('Error sending back record:', err);
    res.status(500).json({ error: 'Failed to send back record' });
  }
});

router.put('/finance/records/:id/recalculate', async (req, res) => {
  try {
    const existing = await queries.getFinanceRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    const tithesResult = await get(`SELECT COALESCE(SUM(amount), 0) as total FROM contributions c JOIN contribution_types ct ON c.contribution_type_id = ct.id WHERE ct.name = 'Tithes' AND c.payment_date = ?`, [existing.record_date]);
    const auto_tithes = tithesResult?.total || 0;
    const c = calcFinance(existing.morning_offering, existing.afternoon_offering, auto_tithes);
    await queries.updateFinanceRecord(req.params.id, {
      total_tithes: auto_tithes, total_income: c.total, mission_fund: c.mission,
      remaining_after_mission: c.remaining, bishop_fund: c.bishop, usable_church_funds: c.usable
    });
    res.json({ message: 'Tithes recalculated', total_tithes: auto_tithes, ...c });
  } catch (err) {
    console.error('Error recalculating tithes:', err);
    res.status(500).json({ error: 'Failed to recalculate tithes' });
  }
});

router.get('/finance/submissions', async (req, res) => {
  try {
    const { status } = req.query;
    const records = await queries.getFinanceSubmissions(status || null);
    for (const r of records) {
      r.expenses = await queries.getFinanceExpenses(r.id);
    }
    res.json(records);
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

router.get('/finance/reports/summary', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to are required' });
    const summary = await queries.getFinanceSummary(date_from, date_to);
    res.json(summary);
  } catch (err) {
    console.error('Error fetching finance summary:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.get('/finance/reports/trend', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const trend = await queries.getFinanceYearTrend(year);
    res.json(trend);
  } catch (err) {
    console.error('Error fetching finance trend:', err);
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

router.get('/finance/reports/export', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to are required' });
    const records = await queries.getFinanceRecords({ date_from, date_to });
    for (const r of records) {
      r.expenses = await queries.getFinanceExpenses(r.id);
    }
    res.json(records);
  } catch (err) {
    console.error('Error exporting finance data:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
