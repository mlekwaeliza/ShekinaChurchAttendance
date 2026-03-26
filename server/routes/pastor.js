const express = require('express');
const { queries } = require('../database');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
router.use(isAuthenticated);

// Get dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Overall attendance stats
    const overall = await new Promise((resolve, reject) => {
      db.all(`
        SELECT date, COUNT(*) as total_members,
               SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
               SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count
        FROM attendance
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Section breakdown for latest date
    const latestDate = overall.length > 0 ? overall[0].date : null;
    let sectionBreakdown = [];
    if (latestDate) {
      sectionBreakdown = await new Promise((resolve, reject) => {
        db.all(`
          SELECT s.name as section_name,
                 COUNT(*) as total,
                 SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
                 ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
          FROM attendance a
          JOIN members m ON a.member_id = m.id
          JOIN sections s ON m.section_id = s.id
          WHERE a.date = ?
          GROUP BY s.name
          ORDER BY attendance_rate DESC
        `, [latestDate], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }

    // Completion rate
    let completion = [];
    if (start_date && end_date) {
      completion = await new Promise((resolve, reject) => {
        db.all(`
          SELECT s.name as section_name, u.full_name as leader_name
          FROM submission_log sl
          JOIN leaders l ON sl.leader_id = l.id
          JOIN users u ON l.user_id = u.id
          JOIN sections s ON l.section_id = s.id
          WHERE sl.date BETWEEN ? AND ?
          GROUP BY l.id
        `, [start_date, end_date], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } else {
      completion = await new Promise((resolve, reject) => {
        db.all(`
          SELECT s.name as section_name, u.full_name as leader_name
          FROM submission_log sl
          JOIN leaders l ON sl.leader_id = l.id
          JOIN users u ON l.user_id = u.id
          JOIN sections s ON l.section_id = s.id
          WHERE sl.date = DATE('now')
          GROUP BY l.id
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }

    const totalLeadersResult = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM leaders', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    const totalLeaders = totalLeadersResult?.count || 0;
    const completionRate = totalLeaders > 0 ? ((completion.length / totalLeaders) * 100).toFixed(1) : 0;

    res.json({
      overallAttendance: overall,
      latestDate,
      sectionBreakdown,
      completion: {
        leadersSubmitted: completion.length,
        totalLeaders,
        rate: parseFloat(completionRate)
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get trends data (for charts)
router.get('/dashboard/trends', async (req, res) => {
  try {
    const { start_date, end_date, section_id } = req.query;
    const params = [start_date, end_date];

    let query = `
      SELECT s.name as section_name, a.date,
             COUNT(*) as total,
             SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      WHERE a.date BETWEEN ? AND ?
    `;

    if (section_id) {
      query += ' AND s.id = ?';
      params.push(section_id);
    }

    query += ' GROUP BY s.name, a.date ORDER BY a.date ASC, s.name';

    const trends = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Get leader performance metrics
router.get('/leaders/metrics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const params = [start_date || '2000-01-01', end_date || '2100-12-31'];

    const metrics = await new Promise((resolve, reject) => {
      db.all(`
        SELECT
          u.full_name as leader_name,
          s.name as section_name,
          COUNT(DISTINCT a.date) as reporting_days,
          COUNT(*) as total_records,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
          ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        JOIN leaders l ON m.leader_id = l.id
        JOIN users u ON l.user_id = u.id
        JOIN sections s ON l.section_id = s.id
        WHERE a.date BETWEEN ? AND ?
        GROUP BY l.id
        ORDER BY attendance_rate DESC
      `, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leader metrics' });
  }
});

// Get at-risk members (multiple absences in last 30 days)
router.get('/members/at-risk', async (req, res) => {
  try {
    const atRisk = await new Promise((resolve, reject) => {
      db.all(`
        SELECT
          m.membership_id,
          m.full_name,
          s.name as section_name,
          u.full_name as leader_name,
          COUNT(*) as absence_count
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        JOIN leaders l ON m.leader_id = l.id
        JOIN users u ON l.user_id = u.id
        JOIN sections s ON m.section_id = s.id
        WHERE a.status = 'absent'
          AND a.date BETWEEN DATE('now', '-30 days') AND DATE('now')
        GROUP BY m.id
        HAVING absence_count >= 3
        ORDER BY absence_count DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(atRisk);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch at-risk members' });
  }
});

// Get member attendance history
router.get('/members/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await new Promise((resolve, reject) => {
      db.all(`
        SELECT a.date, a.status
        FROM attendance a
        WHERE a.member_id = ?
        ORDER BY a.date DESC
        LIMIT 50
      `, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member history' });
  }
});

module.exports = router;
