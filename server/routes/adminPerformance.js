const express = require('express');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const { all, get, run, usePostgres } = require('../database');
const engine = require('../performanceEngine');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin', 'pastor']));

// Dashboard for the Recognition Center (members/leaders/cells/sections/departments)
router.get('/performance/dashboard', async (req, res) => {
  try {
    const { filter = 'month', service_id = 'all' } = req.query;
    const data = await engine.getDashboard(filter, service_id, req.session.user?.id);
    res.json(data);
  } catch (e) {
    console.error('Performance dashboard error:', e);
    res.status(500).json({ error: 'Failed to load performance dashboard', detail: e.message });
  }
});

// Configurable weights
router.get('/performance/weights', async (req, res) => {
  try {
    res.json(await engine.loadWeights());
  } catch (e) { res.status(500).json({ error: 'Failed to load weights' }); }
});

router.put('/performance/weights', async (req, res) => {
  try {
    const { weights } = req.body;
    const updated = await engine.updateWeights(weights);
    res.json({ message: 'Weights updated', weights: updated });
  } catch (e) {
    console.error('Update weights error:', e);
    res.status(500).json({ error: 'Failed to update weights' });
  }
});

// Detailed profile for one ranked entity
router.get('/performance/profile/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { filter = 'month' } = req.query;
    const profile = await engine.getProfile(entityType, entityId, filter, req.session.user?.id);
    if (!profile) return res.status(404).json({ error: 'Entity not found' });
    res.json(profile);
  } catch (e) {
    console.error('Performance profile error:', e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Recognition history (seasonal champions etc.)
router.get('/performance/recognition', async (req, res) => {
  try {
    const { season_type, season_key } = req.query;
    res.json(await engine.getRecognitionHistory(season_type, season_key));
  } catch (e) { res.status(500).json({ error: 'Failed to load recognition history' }); }
});

// Audit log of every point awarded/deducted
router.get('/performance/audit', async (req, res) => {
  try {
    const { entity_type, entity_id, season_type, limit } = req.query;
    res.json(await engine.getAuditLog({ entityType: entity_type, entityId: entity_id, seasonType: season_type, limit }));
  } catch (e) { res.status(500).json({ error: 'Failed to load audit log' }); }
});

// Configurable negative-point penalties
router.get('/performance/penalties', async (req, res) => {
  try {
    res.json(await engine.getPenalties());
  } catch (e) { res.status(500).json({ error: 'Failed to load penalties' }); }
});

router.put('/performance/penalties', async (req, res) => {
  try {
    const { penalties } = req.body;
    for (const p of (penalties || [])) {
      await require('../database').run(
        `UPDATE performance_penalties SET points = ?, label = ?, description = ? WHERE key = ?`,
        [Number(p.points), p.label, p.description, p.key]
      );
    }
    res.json({ message: 'Penalties updated' });
  } catch (e) { res.status(500).json({ error: 'Failed to update penalties' }); }
});

// Finalize a season: record top performers as recognition history
router.post('/performance/award-season', async (req, res) => {
  try {
    const { filter = 'month' } = req.body;
    const data = await engine.getDashboard(filter, 'all', req.session.user?.id);
    const season = data.season;
    const record = async (category, entityType, list, recognitionType) => {
      const top = list.slice(0, 5);
      for (let i = 0; i < top.length; i++) {
        const e = top[i];
        await engine.awardRecognition(season, category, entityType, e.id, e.full_name || e.name, i + 1, e.overallScore, recognitionType);
      }
    };
    await record('members', 'member', data.members, 'champion');
    await record('leaders', 'leader', data.leaders, 'champion');
    await record('cells', 'cell', data.cells, 'best_cell');
    await record('sections', 'section', data.sections, 'best_section');
    await record('departments', 'department', data.departments, 'best_ministry');
    res.json({ message: 'Season champions recorded', season: season.seasonKey });
  } catch (e) {
    console.error('Award season error:', e);
    res.status(500).json({ error: 'Failed to award season' });
  }
});

// Families CRUD
router.get('/performance/families', async (req, res) => {
  try {
    const families = await all(
      `SELECT f.*, COUNT(fm.member_id) AS member_count
       FROM families f
       LEFT JOIN family_members fm ON fm.family_id = f.id
       GROUP BY f.id, f.name, f.head_member_id, f.created_at
       ORDER BY f.name`
    );
    res.json(families);
  } catch (e) { res.status(500).json({ error: 'Failed to load families' }); }
});

router.post('/performance/families', async (req, res) => {
  try {
    const { name, head_member_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Family name is required' });
    const result = await run(
      `INSERT INTO families (name, head_member_id) VALUES (?, ?)`,
      [name, head_member_id || null]
    );
    if (head_member_id) {
      await run(
        `INSERT INTO family_members (family_id, member_id, role) VALUES (?, ?, 'head')`,
        [result.lastID || result.insertId, head_member_id]
      );
    }
    res.json({ id: result.lastID || result.insertId, message: 'Family created' });
  } catch (e) { res.status(500).json({ error: 'Failed to create family' }); }
});

router.post('/performance/families/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { member_id, role = 'member' } = req.body;
    if (!member_id) return res.status(400).json({ error: 'Member ID is required' });
    const sql = usePostgres
      ? `INSERT INTO family_members (family_id, member_id, role) VALUES (?, ?, ?) ON CONFLICT (family_id, member_id) DO NOTHING`
      : `INSERT OR IGNORE INTO family_members (family_id, member_id, role) VALUES (?, ?, ?)`;
    await run(sql, [id, member_id, role]);
    res.json({ message: 'Member added to family' });
  } catch (e) { res.status(500).json({ error: 'Failed to add member to family' }); }
});

router.delete('/performance/families/:id/members/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;
    await run(`DELETE FROM family_members WHERE family_id = ? AND member_id = ?`, [id, memberId]);
    res.json({ message: 'Member removed from family' });
  } catch (e) { res.status(500).json({ error: 'Failed to remove member from family' }); }
});

router.delete('/performance/families/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(`DELETE FROM family_members WHERE family_id = ?`, [id]);
    await run(`DELETE FROM families WHERE id = ?`, [id]);
    res.json({ message: 'Family deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete family' }); }
});

module.exports = router;
