const express = require('express');
const { all, run } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);

router.get('/', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const events = await all(`
      SELECT e.*, u.full_name AS created_by_name
      FROM church_calendar_events e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.event_date BETWEEN ? AND ?
      ORDER BY e.event_date ASC, COALESCE(e.event_time, '') ASC, e.title ASC
    `, [start, end]);
    res.json(events);
  } catch (error) {
    console.error('Calendar fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch church calendar' });
  }
});

router.post('/', requireRole(['admin']), async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const eventDate = String(req.body.event_date || '').trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: 'Event title and valid date are required' });
    }

    const result = await run(`
      INSERT INTO church_calendar_events
        (title, event_date, event_time, event_type, role_title, assigned_to, section_name, location, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      eventDate,
      req.body.event_time || null,
      req.body.event_type || 'service',
      req.body.role_title || null,
      req.body.assigned_to || null,
      req.body.section_name || null,
      req.body.location || null,
      req.body.notes || null,
      req.session.userId
    ]);

    res.status(201).json({ id: result.id, message: 'Calendar event saved' });
  } catch (error) {
    console.error('Calendar create error:', error);
    res.status(500).json({ error: 'Failed to save calendar event' });
  }
});

router.put('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const eventDate = String(req.body.event_date || '').trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: 'Event title and valid date are required' });
    }

    await run(`
      UPDATE church_calendar_events
      SET title = ?,
          event_date = ?,
          event_time = ?,
          event_type = ?,
          role_title = ?,
          assigned_to = ?,
          section_name = ?,
          location = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title,
      eventDate,
      req.body.event_time || null,
      req.body.event_type || 'service',
      req.body.role_title || null,
      req.body.assigned_to || null,
      req.body.section_name || null,
      req.body.location || null,
      req.body.notes || null,
      req.params.id
    ]);

    res.json({ message: 'Calendar event updated' });
  } catch (error) {
    console.error('Calendar update error:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res) => {
  try {
    await run('DELETE FROM church_calendar_events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Calendar event removed' });
  } catch (error) {
    console.error('Calendar delete error:', error);
    res.status(500).json({ error: 'Failed to remove calendar event' });
  }
});

module.exports = router;
