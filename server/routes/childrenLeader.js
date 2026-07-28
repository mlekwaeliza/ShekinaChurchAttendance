const express = require('express');
const { queries, all, get, run } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const { formatLocalDate, addDays } = require('../utils/date');
const { invalidate } = require('../utils/cache');

const isPostgres = String(process.env.DB_CLIENT || '').toLowerCase() === 'postgres';

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['children_leader']));

// GET children leader dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.session.userId;
    const childrenLeader = await queries.getChildrenLeaderByUserId(userId);

    if (!childrenLeader) {
      return res.status(404).json({ error: 'Children leader profile not found' });
    }

    const leaderId = childrenLeader.id;
    const today = formatLocalDate(new Date());
    const weekAgo = formatLocalDate(addDays(new Date(), -7));
    const thirtyDaysAgo = formatLocalDate(addDays(new Date(), -30));

    const [children, classes, todayAttendance, recentSubmissions, weeklyStats] = await Promise.all([
      // Children assigned to this leader
      queries.getChildrenByLeader(leaderId),
      // All active classes
      all(`SELECT id, name, age_group, description, room_number, schedule FROM children_classes WHERE is_active = 1 ORDER BY name`),
      // Today's attendance for this leader's children
      all(`
        SELECT ca.*, c.full_name, cl.name as class_name
        FROM children_attendance ca
        JOIN children c ON ca.child_id = c.id
        LEFT JOIN children_classes cl ON ca.class_id = cl.id
        WHERE c.children_leader_id = ? AND ca.date = ?
        ORDER BY cl.name, c.full_name
      `, [leaderId, today]),
      // Recent submission history
      queries.getChildrenSubmissionLog(leaderId, thirtyDaysAgo, today),
      // Weekly attendance stats
      all(`
        SELECT 
          DATE(ca.date) as date,
          SUM(CASE WHEN ca.status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN ca.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN ca.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
          SUM(CASE WHEN ca.status = 'late' THEN 1 ELSE 0 END) as late_count
        FROM children_attendance ca
        JOIN children c ON ca.child_id = c.id
        WHERE c.children_leader_id = ? AND ca.date >= ?
        GROUP BY DATE(ca.date)
        ORDER BY date DESC
      `, [leaderId, weekAgo])
    ]);

    const totalChildren = children.length;
    const activeChildren = children.filter(c => c.is_active).length;
    const totalPresent = weeklyStats.reduce((s, t) => s + (t.present_count || 0), 0);
    const totalAbsent = weeklyStats.reduce((s, t) => s + (t.absent_count || 0), 0);
    const totalExcused = weeklyStats.reduce((s, t) => s + (t.excused_count || 0), 0);
    const totalLate = weeklyStats.reduce((s, t) => s + (t.late_count || 0), 0);
    const totalRecords = totalPresent + totalAbsent + totalExcused + totalLate;
    const attendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    res.json({
      leader: {
        id: childrenLeader.id,
        full_name: childrenLeader.full_name,
        username: childrenLeader.username,
        phone: childrenLeader.phone,
        email: childrenLeader.email,
        is_head: childrenLeader.is_head,
        is_active: childrenLeader.is_active
      },
      classes,
      children,
      todayAttendance,
      recentSubmissions,
      weeklyStats,
      stats: {
        totalChildren,
        activeChildren,
        attendanceRate,
        totalPresent,
        totalAbsent,
        totalExcused,
        totalLate,
        totalSubmissions: recentSubmissions.length
      }
    });
  } catch (error) {
    console.error('Children leader dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET children list for this leader (supports ?age_group= filter)
router.get('/children', async (req, res) => {
  try {
    const userId = req.session.userId;
    const childrenLeader = await queries.getChildrenLeaderByUserId(userId);
    if (!childrenLeader) return res.status(404).json({ error: 'Children leader not found' });

    const { age_group, class_id } = req.query;
    let sql = `
      SELECT c.*, cl.name as class_name
      FROM children c
      LEFT JOIN children_classes cl ON c.class_id = cl.id
      WHERE c.children_leader_id = ? AND c.is_active = 1
    `;
    const params = [childrenLeader.id];

    if (age_group) {
      sql += ` AND c.age_group = ?`;
      params.push(age_group);
    }
    if (class_id) {
      sql += ` AND c.class_id = ?`;
      params.push(class_id);
    }
    sql += ` ORDER BY c.full_name`;

    const children = await all(sql, params);
    res.json(children);
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Failed to load children' });
  }
});

// GET children by class
router.get('/children/by-class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.session.userId;
    const childrenLeader = await queries.getChildrenLeaderByUserId(userId);
    if (!childrenLeader) return res.status(404).json({ error: 'Children leader not found' });

    const children = await all(`
      SELECT c.*, cl.name as class_name
      FROM children c
      LEFT JOIN children_classes cl ON c.class_id = cl.id
      WHERE c.children_leader_id = ? AND c.class_id = ? AND c.is_active = 1
      ORDER BY c.full_name
    `, [childrenLeader.id, classId]);
    res.json(children);
  } catch (error) {
    console.error('Get children by class error:', error);
    res.status(500).json({ error: 'Failed to load children' });
  }
});

// GET classes
router.get('/classes', async (req, res) => {
  try {
    const classes = await all(`SELECT id, name, age_group, description, room_number, schedule FROM children_classes WHERE is_active = 1 ORDER BY name`);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load classes' });
  }
});

// GET attendance for a specific date (supports ?age_group= filter)
router.get('/attendance', async (req, res) => {
  try {
    const date = req.query.date || formatLocalDate(new Date());
    const userId = req.session.userId;
    const childrenLeader = await queries.getChildrenLeaderByUserId(userId);
    if (!childrenLeader) return res.status(404).json({ error: 'Children leader not found' });

    const { age_group } = req.query;

    const attendance = await all(`
      SELECT ca.*, c.full_name, c.date_of_birth, c.gender, c.age_group, cl.name as class_name
      FROM children_attendance ca
      JOIN children c ON ca.child_id = c.id
      LEFT JOIN children_classes cl ON ca.class_id = cl.id
      WHERE c.children_leader_id = ? AND ca.date = ?
      ${age_group ? 'AND c.age_group = ?' : ''}
      ORDER BY cl.name, c.full_name
    `, age_group ? [childrenLeader.id, date, age_group] : [childrenLeader.id, date]);

    let childrenSql = `
      SELECT c.id, c.full_name, c.date_of_birth, c.gender, c.age_group, c.class_id, cl.name as class_name
      FROM children c
      LEFT JOIN children_classes cl ON c.class_id = cl.id
      WHERE c.children_leader_id = ? AND c.is_active = 1
    `;
    const childrenParams = [childrenLeader.id];
    if (age_group) {
      childrenSql += ` AND c.age_group = ?`;
      childrenParams.push(age_group);
    }
    childrenSql += ` ORDER BY cl.name, c.full_name`;

    const children = await all(childrenSql, childrenParams);

    res.json({ attendance, children });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to load attendance' });
  }
});

// POST submit attendance
router.post('/attendance', async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Date and records are required' });
    }

    const userId = req.session.userId;
    const childrenLeader = await queries.getChildrenLeaderByUserId(userId);
    if (!childrenLeader) return res.status(404).json({ error: 'Children leader not found' });

    const leaderId = childrenLeader.id;
    let recordsCount = 0;

    await run('BEGIN');
    try {
      for (const record of records) {
        const { child_id, status, class_id } = record;
        if (!child_id || !status) continue;

        // Verify child belongs to this leader
        const child = await get('SELECT id FROM children WHERE id = ? AND children_leader_id = ?', [child_id, leaderId]);
        if (!child) continue;

        const classId = class_id || child.class_id;
        const now = new Date().toISOString();

        await run(`
          INSERT INTO children_attendance (child_id, class_id, date, status, checked_in_at, checked_in_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(child_id, class_id, date) DO UPDATE SET
            status = excluded.status,
            checked_in_at = excluded.checked_in_at,
            checked_in_by = excluded.checked_in_by
        `, [child_id, classId, date, status, now, userId, now]);

        recordsCount++;
      }

      // Log submission
      await run(isPostgres
        ? `INSERT INTO children_submission_log (children_leader_id, date, class_id, records_count, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(children_leader_id, date, class_id) DO UPDATE SET
             records_count = EXCLUDED.records_count, created_at = EXCLUDED.created_at`
        : `INSERT OR REPLACE INTO children_submission_log (children_leader_id, date, class_id, records_count, created_at)
           VALUES (?, ?, ?, ?, ?)`,
      [leaderId, date, null, recordsCount, new Date().toISOString()]);

      await run('COMMIT');
      invalidate('admin-children-');
      res.json({ message: 'Attendance saved', records: recordsCount });
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Submit attendance error:', error);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

// GET submission history
router.get('/history', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = formatLocalDate(addDays(new Date(), -parseInt(days)));
    const today = formatLocalDate(new Date());

    const userId = req.session.userId;
    const childrenLeader = await queries.getChildrenLeaderByUserId(userId);
    if (!childrenLeader) return res.status(404).json({ error: 'Children leader not found' });

    const history = await queries.getChildrenSubmissionLog(childrenLeader.id, startDate, today);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// GET weekly attendance trends
router.get('/trends', async (req, res) => {
  try {
    const { days = 12 } = req.query;
    const startDate = formatLocalDate(addDays(new Date(), -parseInt(days)));

    const userId = req.session.userId;
    const childrenLeader = await queries.getChildrenLeaderByUserId(userId);
    if (!childrenLeader) return res.status(404).json({ error: 'Children leader not found' });

    const trends = await all(`
      SELECT 
        DATE(ca.date) as date,
        SUM(CASE WHEN ca.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ca.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ca.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
        SUM(CASE WHEN ca.status = 'late' THEN 1 ELSE 0 END) as late_count
      FROM children_attendance ca
      JOIN children c ON ca.child_id = c.id
        WHERE c.children_leader_id = ? AND ca.date >= ?
        GROUP BY DATE(ca.date)
        ORDER BY date DESC
      `, [childrenLeader.id, startDate]);

    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load trends' });
  }
});

module.exports = router;
