const express = require('express');
const { queries, get } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin', 'pastor', 'leader', 'accountant']));

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function parseIds(value) {
  if (!value) return null;
  const parts = String(value)
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n));
  return parts.length > 0 ? parts : null;
}

async function resolveLeaderId(req) {
  // Security fix: leaders are always scoped to their own leader record.
  // The client-supplied leader_id is only honored for roles that are
  // allowed to view the whole church (admin/pastor/accountant).
  if (req.session?.user?.role === 'leader') {
    const userId = req.session.userId;
    if (userId == null) {
      console.error('[resolveLeaderId] leader session missing userId');
      return null;
    }
    const { get } = require('../database');
    const row = await get('SELECT id FROM leaders WHERE user_id = ?', [userId]);
    return row ? row.id : null;
  }
  const queryLeaderId = parseId(req.query.leader_id);
  if (queryLeaderId) return queryLeaderId;
  return null;
}

// ── Contribution Types ─────────────────────────────────────────────────────

router.get('/contribution-types', async (req, res) => {
  try {
    const types = await queries.getContributionTypes();
    res.json(types);
  } catch (err) {
    console.error('[contribution-types] Error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch contribution types', detail: err.message });
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

// Security fix: contribution *type* configuration is a finance-admin
// concern; only admin/accountant may change it (all roles may read types).
router.post('/contribution-types', requireRole(['admin', 'accountant']), async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = await queries.createContributionType({
      name: name.trim(),
      description,
      sort_order
    });
    res.status(201).json({ id: result.lastID, name: name.trim() });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'A contribution type with this name already exists' });
    }
    console.error('Error creating contribution type:', err);
    res.status(500).json({ error: 'Failed to create contribution type' });
  }
});

router.put('/contribution-types/:id', requireRole(['admin', 'accountant']), async (req, res) => {
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

router.delete('/contribution-types/:id', requireRole(['admin', 'accountant']), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const existing = await queries.getContributionTypeById(id);
    if (!existing) return res.status(404).json({ error: 'Contribution type not found' });
    await queries.deleteContributionType(id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes('FOREIGN KEY')) {
      return res
        .status(409)
        .json({
          error: 'Cannot delete: contributions exist for this type. Deactivate it instead.'
        });
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
    // Security fix: a leader without a linked leader record must never fall
    // through to the unscoped query (which would return every contribution).
    if (req.session?.user?.role === 'leader' && !leader_id) {
      return res.status(403).json({ error: 'No leader profile is linked to this account' });
    }
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
    console.error('[contributions] Error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch contributions', detail: err.message });
  }
});

// ── Reports (defined BEFORE /:id so static segments win over the param) ──
// Security fix: summary/detail/:id are not scoped to a leader, so they are
// only available to the roles that may see church-wide data.
router.get(
  '/contributions/summary',
  requireRole(['admin', 'pastor', 'accountant']),
  async (req, res) => {
    try {
      const { date_from, date_to, contribution_type_id, member_id } = req.query;
      const summary = await queries.getContributionSummary({
        date_from,
        date_to,
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
  }
);

router.get(
  '/contributions/detail',
  requireRole(['admin', 'pastor', 'accountant']),
  async (req, res) => {
    try {
      const { from, to } = req.query;
      if (!from || !to) return res.status(400).json({ error: 'from and to query params required' });
      const rows = await queries.getContributionsByDateRange(from, to);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching contribution detail:', err);
      res.status(500).json({ error: 'Failed to fetch contribution detail' });
    }
  }
);

router.get(
  '/contributions/:id',
  requireRole(['admin', 'pastor', 'accountant']),
  async (req, res) => {
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
  }
);

router.post('/contributions', async (req, res) => {
  try {
    const {
      member_id,
      contribution_type_id,
      amount,
      payment_date,
      payment_method,
      reference_number,
      notes
    } = req.body;
    if (!member_id || !contribution_type_id || !amount || !payment_date) {
      return res
        .status(400)
        .json({ error: 'member_id, contribution_type_id, amount, and payment_date are required' });
    }
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    // Security fix: leaders may only record contributions for members in
    // their own section.
    if (req.session?.user?.role === 'leader') {
      const leaderId = await resolveLeaderId(req);
      const member = await get('SELECT leader_id FROM members WHERE id = ?', [
        parseId(member_id) || 0
      ]);
      if (!leaderId || !member || Number(member.leader_id) !== Number(leaderId)) {
        return res
          .status(403)
          .json({ error: 'You can only record contributions for your own members' });
      }
    }
    const result = await queries.createContribution({
      member_id,
      contribution_type_id,
      amount,
      payment_date,
      payment_method: payment_method || 'Cash',
      reference_number,
      notes,
      recorded_by: req.session.userId
    });
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error('Error creating contribution:', err);
    res.status(500).json({ error: 'Failed to create contribution' });
  }
});

// Security fix: editing or deleting financial records is limited to the
// roles that own the finance workflow.
router.put('/contributions/:id', requireRole(['admin', 'accountant']), async (req, res) => {
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

router.delete('/contributions/:id', requireRole(['admin', 'accountant']), async (req, res) => {
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
