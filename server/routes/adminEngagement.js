const express = require('express');
const { queries, run, all, db } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin']));

const allowedPriorities = new Set(['normal', 'important', 'urgent']);
const allowedFollowUpTypes = new Set(['Member', 'Visitor']);
// --- Announcements ---
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await queries.allAnnouncements?.() || await new Promise((resolve, reject) => {
      db.all(`
        SELECT a.*, u.full_name AS created_by_name
        FROM announcements a
        LEFT JOIN users u ON u.id = a.created_by
        ORDER BY a.created_at DESC
        LIMIT 50
      `, [], (err, rows) => err ? reject(err) : resolve(rows));
    });
    res.json(announcements);
  } catch (error) {
    console.error('Fetch announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const audience = String(req.body.audience || 'all').trim();
    const priority = allowedPriorities.has(req.body.priority) ? req.body.priority : 'normal';
    const scheduledAt = req.body.scheduled_at || req.body.scheduledDate || null;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const result = await run(`
      INSERT INTO announcements (title, message, audience, priority, scheduled_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, message, audience, priority, scheduledAt || null, req.session.userId]);

    res.status(201).json({ id: result.id, message: 'Announcement saved' });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to save announcement' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    await run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ message: 'Announcement removed' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to remove announcement' });
  }
});

// --- Follow-up workspace ---
router.get('/follow-up-tasks', async (req, res) => {
  try {
    const rows = await all(`
      SELECT t.*, owner_user.full_name AS owner_name
      FROM admin_followup_tasks t
      LEFT JOIN leaders l ON l.id = t.owner_id
      LEFT JOIN users owner_user ON owner_user.id = l.user_id
      ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    console.error('Fetch follow-up tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch follow-up tasks' });
  }
});

router.post('/follow-up-tasks', async (req, res) => {
  try {
    const personType = allowedFollowUpTypes.has(req.body.person_type) ? req.body.person_type : req.body.type;
    const fullName = String(req.body.full_name || '').trim();

    if (!allowedFollowUpTypes.has(personType) || !fullName) {
      return res.status(400).json({ error: 'Person type and full name are required' });
    }

    const result = await run(`
      INSERT INTO admin_followup_tasks
        (person_type, person_id, full_name, section_name, reason, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      personType,
      req.body.person_id || null,
      fullName,
      req.body.section_name || null,
      req.body.reason || null,
      req.body.owner_id || null,
      req.session.userId
    ]);

    res.status(201).json({ id: result.id, message: 'Follow-up task created' });
  } catch (error) {
    console.error('Create follow-up task error:', error);
    res.status(500).json({ error: 'Failed to create follow-up task' });
  }
});

router.put('/follow-up-tasks/:id', async (req, res) => {
  try {
    const status = req.body.status === 'done' ? 'done' : 'open';
    await run(`
      UPDATE admin_followup_tasks
      SET status = ?,
          completed_at = CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE NULL END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, status, req.params.id]);
    res.json({ message: 'Follow-up task updated' });
  } catch (error) {
    console.error('Update follow-up task error:', error);
    res.status(500).json({ error: 'Failed to update follow-up task' });
  }
});

// --- Visitor intake ---
router.get('/visitors', async (req, res) => {
  try {
    const rows = await all(`
      SELECT v.*, u.full_name AS created_by_name
      FROM visitor_intake v
      LEFT JOIN users u ON u.id = v.created_by
      ORDER BY v.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    console.error('Fetch visitors error:', error);
    res.status(500).json({ error: 'Failed to fetch visitors' });
  }
});

router.post('/visitors', async (req, res) => {
  try {
    const fullName = String(req.body.full_name || '').trim();
    if (!fullName) {
      return res.status(400).json({ error: 'Visitor name is required' });
    }

    const result = await run(`
      INSERT INTO visitor_intake (full_name, phone, email, invitation_source, address, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      fullName,
      req.body.phone || null,
      req.body.email || null,
      req.body.invitation_source || null,
      req.body.address || null,
      req.body.notes || null,
      req.session.userId
    ]);

    res.status(201).json({ id: result.id, message: 'Visitor saved' });
  } catch (error) {
    console.error('Create visitor error:', error);
    res.status(500).json({ error: 'Failed to save visitor' });
  }
});

module.exports = router;
