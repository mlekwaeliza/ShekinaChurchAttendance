const express = require('express');
const { queries } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin', 'leader', 'accountant']));

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function parseIds(value) {
  if (!value) return null;
  const parts = String(value).split(',').map(v => Number(v.trim())).filter(n => Number.isInteger(n));
  return parts.length > 0 ? parts : null;
}

async function resolveLeaderId(req) {
  const queryLeaderId = parseId(req.query.leader_id);
  if (queryLeaderId) return queryLeaderId;
  if (req.session?.user?.role === 'leader') {
    const { get } = require('../database');
    const row = await get('SELECT id FROM leaders WHERE user_id = ?', [req.session.userId]);
    return row ? row.id : null;
  }
  return null;
}

// ── Contribution Types ─────────────────────────────────────────────────────

router.get('/contribution-types', async (req, res) => {
  try {
    const types = await queries.getContributionTypes();
    res.json(types);
  } catch (err) {
    console.error('Error fetching contribution types:', err);
    res.status(500).json({ error: 'Failed to fetch contribution types' });
  }
});

router.get('/contribution-types/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const type = await queries.getContributionTypeById(id);
    if (!type) return res.status(404).json({ error: 'Contribution type not found' });
    res.json(type);
  } catch (err) {
    console.error('Error fetching contribution type:', err);
    res.status(500).json({ error: 'Failed to fetch contribution type' });
  }
});

router.post('/contribution-types', async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = await queries.createContributionType({ name: name.trim(), description, sort_order });
    res.status(201).json({ id: result.lastID, name: name.trim() });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'A contribution type with this name already exists' });
    }
    console.error('Error creating contribution type:', err);
    res.status(500).json({ error: 'Failed to create contribution type' });
  }
});

router.put('/contribution-types/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const existing = await queries.getContributionTypeById(id);
    if (!existing) return res.status(404).json({ error: 'Contribution type not found' });
    await queries.updateContributionType(id, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating contribution type:', err);
    res.status(500).json({ error: 'Failed to update contribution type' });
  }
});

router.delete('/contribution-types/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const existing = await queries.getContributionTypeById(id);
    if (!existing) return res.status(404).json({ error: 'Contribution type not found' });
    await queries.deleteContributionType(id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes('FOREIGN KEY')) {
      return res.status(409).json({ error: 'Cannot delete: contributions exist for this type. Deactivate it instead.' });
    }
    console.error('Error deleting contribution type:', err);
    res.status(500).json({ error: 'Failed to delete contribution type' });
  }
});

// ── Contributions ──────────────────────────────────────────────────────────

router.get('/contributions', async (req, res) => {
  try {
    const { member_id, contribution_type_id, payment_method, date_from, date_to } = req.query;
    const leader_id = await resolveLeaderId(req);
    const contributions = await queries.getContributions({
      member_id: parseId(member_id),
      leader_id,
      contribution_type_id: parseIds(contribution_type_id),
      payment_method,
      date_from,
      date_to
    });
    res.json(contributions);
  } catch (err) {
    console.error('Error fetching contributions:', err);
    res.status(500).json({ error: 'Failed to fetch contributions' });
  }
});

// ── Reports (defined BEFORE /:id so static segments win over the param) ──
router.get('/contributions/summary', async (req, res) => {
  try {
    const { date_from, date_to, contribution_type_id, member_id } = req.query;
    const summary = await queries.getContributionSummary({
      date_from, date_to,
      contribution_type_id: parseIds(contribution_type_id),
      member_id: parseId(member_id)
    });
    const grandTotal = summary.reduce((sum, s) => sum + s.total, 0);
    const grandCount = summary.reduce((sum, s) => sum + s.count, 0);
    res.json({ rows: summary, grandTotal, grandCount });
  } catch (err) {
    console.error('Error fetching contribution summary:', err);
    res.status(500).json({ error: 'Failed to fetch contribution summary' });
  }
});

router.get('/contributions/detail', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to query params required' });
    const rows = await queries.getContributionsByDateRange(from, to);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching contribution detail:', err);
    res.status(500).json({ error: 'Failed to fetch contribution detail' });
  }
});

router.get('/contributions/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const contribution = await queries.getContributionById(id);
    if (!contribution) return res.status(404).json({ error: 'Contribution not found' });
    res.json(contribution);
  } catch (err) {
    console.error('Error fetching contribution:', err);
    res.status(500).json({ error: 'Failed to fetch contribution' });
  }
});

router.post('/contributions', async (req, res) => {
  try {
    const { member_id, contribution_type_id, amount, payment_date, payment_method, reference_number, notes } = req.body;
    if (!member_id || !contribution_type_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'member_id, contribution_type_id, amount, and payment_date are required' });
    }
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    const result = await queries.createContribution({
      member_id, contribution_type_id, amount, payment_date,
      payment_method: payment_method || 'Cash',
      reference_number, notes, recorded_by: req.session.userId
    });
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error('Error creating contribution:', err);
    res.status(500).json({ error: 'Failed to create contribution' });
  }
});

router.put('/contributions/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const existing = await queries.getContributionById(id);
    if (!existing) return res.status(404).json({ error: 'Contribution not found' });
    if (req.body.amount !== undefined && req.body.amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }
    await queries.updateContribution(id, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating contribution:', err);
    res.status(500).json({ error: 'Failed to update contribution' });
  }
});

router.delete('/contributions/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const existing = await queries.getContributionById(id);
    if (!existing) return res.status(404).json({ error: 'Contribution not found' });
    await queries.deleteContribution(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting contribution:', err);
    res.status(500).json({ error: 'Failed to delete contribution' });
  }
});

module.exports = router;
