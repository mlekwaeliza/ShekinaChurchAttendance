const express = require('express');
const { db, run } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const { formatLocalDate } = require('../utils/date');
const { escapeCsvValue, toCsvRow } = require('../utils/csv');
const { yearEquals, monthEquals, weekEquals, dateOnly } = require('../utils/sqlDialect');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin']));

// GET all attendance with filters
router.get('/attendance', async (req, res) => {
  try {
    const { date, section_id, leader_id } = req.query;

    let query = `
      SELECT a.*, m.full_name as member_name, m.membership_id, s.name as section_name, u.full_name as leader_name
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.filterType && req.query.filterValue) {
      if (req.query.filterType === 'daily') {
        query += ` AND ${dateOnly('a.date')} = ?`;
        params.push(req.query.filterValue);
      } else if (req.query.filterType === 'yearly') {
        query += ` AND ${yearEquals('a.date')}`;
        params.push(req.query.filterValue);
      } else if (req.query.filterType === 'monthly') {
        query += ` AND ${monthEquals('a.date')}`;
        params.push(req.query.filterValue);
      } else if (req.query.filterType === 'weekly') {
        const parts = req.query.filterValue.split('-W');
        query += ` AND ${weekEquals('a.date')}`;
        params.push(`${parts[0]}-${parts[1].padStart(2, '0')}`);
      }
    } else if (date) {
      query += ' AND a.date = ?';
      params.push(date);
    }
    if (section_id) {
      query += ' AND m.section_id = ?';
      params.push(section_id);
    }
    if (leader_id) {
      query += ' AND m.leader_id = ?';
      params.push(leader_id);
    }

    query += ' ORDER BY a.date DESC, m.full_name';

    const attendance = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(attendance);
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// PUT update attendance (admin override)
router.put('/attendance/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!['present', 'absent', 'excused'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await run('UPDATE attendance SET status = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    res.json({ message: 'Attendance updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// GET export attendance as CSV
router.get('/export', async (req, res) => {
  try {
    const { start_date, end_date, section_id } = req.query;

    let query = `
      SELECT
        a.date,
        st.name as service_name,
        s.name as section_name,
        u.full_name as leader_name,
        m.membership_id,
        m.full_name as member_name,
        a.status
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN service_types st ON a.service_type_id = st.id
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND a.date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND a.date <= ?';
      params.push(end_date);
    }
    if (section_id) {
      query += ' AND s.id = ?';
      params.push(section_id);
    }

    query += ' ORDER BY a.date DESC, s.name, m.full_name';

    const records = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const headers = ['Date', 'Service', 'Section', 'Leader', 'MembershipID', 'MemberName', 'Status'];
    const csvRows = [];
    csvRows.push(headers.map(escapeCsvValue).join(','));

    records.forEach(row => {
      csvRows.push(toCsvRow([
        row.date,
        row.service_name,
        row.section_name,
        row.leader_name,
        row.membership_id,
        row.member_name,
        row.status
      ]));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${formatLocalDate()}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
