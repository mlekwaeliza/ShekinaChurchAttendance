const express = require('express');
const { db, queries, run, get, all, transaction } = require('../database');
const { isAuthenticated, requireRole, validateDate } = require('../middleware/auth');
const { addDays, formatLocalDate, getISOWeekRange, getISOWeekString } = require('../utils/date');
const { escapeCsvValue, toCsvRow } = require('../utils/csv');
const { yearEquals, monthEquals, weekEquals, dateOnly, upsertAttendanceSql } = require('../utils/sqlDialect');
const {
  getAttendanceHistory,
  getAttendanceTrends,
  listAttendance,
  searchAttendanceForCorrection
} = require('../services/adminAttendanceService');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin']));

const VALID_STATUSES = new Set(['present', 'absent', 'excused']);
const REASON_MAX_LENGTH = 500;

// GET all attendance with filters
router.get('/attendance', async (req, res) => {
  try {
    const attendance = await listAttendance(req.query);
    res.json(attendance);
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// GET attendance records for the admin corrections table.
// Supports: q (member name / membership id), start_date, end_date,
// section_id, leader_id, service_id, status, page, page_size.
router.get('/attendance/search', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.page_size, 10) || 50));
    const result = await searchAttendanceForCorrection({
      q: req.query.q,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      section_id: req.query.section_id,
      leader_id: req.query.leader_id,
      service_id: req.query.service_id,
      status: req.query.status,
      page,
      pageSize,
    });
    res.json(result);
  } catch (error) {
    console.error('Attendance search error:', error);
    res.status(500).json({ error: 'Failed to search attendance' });
  }
});

// GET audit history for a single attendance record (most recent first).
router.get('/attendance/:id/audit', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid attendance id' });
    }
    const history = await all(
      `SELECT al.id, al.action, al.old_value, al.new_value, al.ip_address, al.user_agent, al.created_at,
              u.id AS editor_id, u.username AS editor_username, u.full_name AS editor_name
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = 'attendance' AND al.entity_id = ?
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [id]
    );
    res.json(history);
  } catch (error) {
    console.error('Attendance audit fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance audit history' });
  }
});

// PUT update attendance (admin override). Captures old/new values in the
// audit_log so every correction is traceable back to the admin who made
// it. Optional `reason` is stored in the audit_log new_value payload.
router.put('/attendance/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid attendance id' });
    }

    const { status, reason } = req.body || {};
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be present, absent, or excused.' });
    }
    const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, REASON_MAX_LENGTH) : '';

    const existing = await get('SELECT id, member_id, date, status, service_type_id FROM attendance WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    if (existing.status === status && !trimmedReason) {
      return res.status(400).json({ error: 'Status is already set to that value. No changes to save.' });
    }

    await run(
      'UPDATE attendance SET status = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    const ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const oldValue = { status: existing.status };
    const newValue = { status, reason: trimmedReason || null };

    queries.createAuditEntry(
      req.session.userId,
      'update',
      'attendance',
      id,
      oldValue,
      newValue,
      ipAddress,
      userAgent
    ).catch((err) => {
      console.error('Attendance correction audit log write failed:', err.message);
    });

    res.json({ message: 'Attendance updated', id, status, reason: trimmedReason || null });
  } catch (error) {
    console.error('Attendance update error:', error);
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

    query += ' ORDER BY a.date DESC, s.name, m.full_name LIMIT 10000';

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

// GET global history
router.get('/history', async (req, res) => {
  try {
    const { service_id = 'all' } = req.query;
    const history = await getAttendanceHistory(service_id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global history' });
  }
});

// GET global attendance trends
router.get('/attendance-trends', async (req, res) => {
  try {
    const { days = 90 } = req.query;
    res.json(await getAttendanceTrends(days));
  } catch (error) {
    console.error('Global Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch global attendance trends' });
  }
});

// GET section overview for admin
router.get('/section-overview/:date', validateDate('date'), async (req, res) => {
  try {
    const { date } = req.params;
    const { section_id } = req.query;

    const allLeaders = await new Promise((resolve, reject) => {
      let q = `SELECT l.id, u.full_name as full_name, l.phone, s.name as section_name, l.section_id FROM leaders l JOIN users u ON l.user_id = u.id JOIN sections s ON l.section_id = s.id`;
      const params = [];
      if (section_id) { q += ` WHERE l.section_id = ?`; params.push(section_id); }
      db.all(q, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    const attendance = await new Promise((resolve, reject) => {
      let q = `SELECT a.*, u.full_name as leader_name FROM attendance a JOIN members m ON a.member_id = m.id JOIN leaders l ON m.leader_id = l.id JOIN users u ON l.user_id = u.id WHERE a.date = ?`;
      const params = [date];
      if (section_id) { q += ` AND m.section_id = ?`; params.push(section_id); }
      db.all(q, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    const logs = await new Promise((resolve, reject) => {
      let q = 'SELECT leader_id FROM submission_log WHERE date = ?';
      const params = [date];
      if (section_id) { q += ' AND section_id = ?'; params.push(section_id); }
      db.all(q, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    const submittedLeaderIds = new Set(logs.map(l => l.leader_id));
    const stats = { present: 0, absent: 0, excused: 0, total_submitted_leaders: submittedLeaderIds.size, total_leaders: allLeaders.length };

    const subleaderReport = allLeaders.map(l => {
      const leaderAttendance = attendance.filter(a => a.leader_name === l.full_name);
      const lStats = { present: 0, absent: 0, excused: 0 };
      leaderAttendance.forEach(a => {
        if (a.status === 'present') { lStats.present++; stats.present++; }
        if (a.status === 'absent') { lStats.absent++; stats.absent++; }
        if (a.status === 'excused') { lStats.excused++; stats.excused++; }
      });

      return {
        leader_id: l.id,
        leader_name: l.full_name,
        section_name: l.section_name,
        phone: l.phone,
        submitted: submittedLeaderIds.has(l.id),
        stats: lStats
      };
    });

    res.json({
      section_name: section_id ? subleaderReport[0]?.section_name : 'Global',
      date,
      stats,
      subleaders: subleaderReport
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET aggregated overview for weekly, monthly, yearly
router.get('/aggregated-overview', async (req, res) => {
  try {
    let { filterType, filterValue, service_id = 'all', fallback_latest } = req.query;

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(filterType) || !filterValue) {
      return res.status(400).json({ error: 'Valid filterType and filterValue required' });
    }

    let dateCondition = '';
    let params = [];

    if (filterType === 'daily') {
      dateCondition = `${dateOnly('a.date')} = ?`;
      params.push(filterValue);
    } else if (filterType === 'yearly') {
      dateCondition = yearEquals('a.date');
      params.push(filterValue);
    } else if (filterType === 'monthly') {
      dateCondition = monthEquals('a.date');
      params.push(filterValue);
    } else if (filterType === 'weekly') {
      const { start, end } = getISOWeekRange(filterValue);
      dateCondition = 'a.date BETWEEN ? AND ?';
      params.push(start, end);
    }

    const loadAttendance = (condition, conditionParams) => new Promise((resolve, reject) => {
      const serviceCondition = service_id === 'all' ? '' : ' AND a.service_type_id = ?';
      const q = `SELECT a.*, l.id as leader_id FROM attendance a JOIN members m ON a.member_id = m.id JOIN leaders l ON m.leader_id = l.id WHERE ${condition}${serviceCondition}`;
      const queryParams = service_id === 'all' ? conditionParams : [...conditionParams, service_id];
      db.all(q, queryParams, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    let attendance = await loadAttendance(dateCondition, params);
    let usedFallback = false;
    const effectiveServiceId = service_id;

    if (attendance.length === 0 && fallback_latest !== 'false' && filterType === 'weekly') {
      const latest = await new Promise((resolve, reject) => {
        const q = service_id === 'all'
          ? `SELECT MAX(date) AS latest_date FROM attendance`
          : `SELECT MAX(date) AS latest_date FROM attendance WHERE service_type_id = ?`;
        const queryParams = service_id === 'all' ? [] : [service_id];
        db.get(
          q,
          queryParams,
          (err, row) => err ? reject(err) : resolve(row?.latest_date)
        );
      });

      if (latest) {
        filterValue = getISOWeekString(latest);
        const { start, end } = getISOWeekRange(filterValue);
        dateCondition = 'a.date BETWEEN ? AND ?';
        params = [start, end];
        attendance = await loadAttendance(dateCondition, params);
        usedFallback = true;
      }
    }

    const allLeaders = await queries.getAllLeaders();
    const stats = { present: 0, absent: 0, excused: 0, total_submitted_leaders: 0, total_leaders: allLeaders.length };

    const logs = await new Promise((resolve) => {
      const serviceCondition = service_id === 'all' ? '' : ' AND a.service_id = ?';
      const queryParams = service_id === 'all' ? params : [...params, service_id];
      db.all(`SELECT leader_id, date FROM submission_log a WHERE ${dateCondition}${serviceCondition}`, queryParams, (err, rows) => {
        if (err) resolve([]); else resolve(rows);
      });
    });

    const submittedDatesByLeader = {};
    const toDateKey = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || 'unknown').slice(0, 10));
    const addSubmittedDate = (leaderId, date) => {
      if (!leaderId) return;
      if (!submittedDatesByLeader[leaderId]) submittedDatesByLeader[leaderId] = new Set();
      submittedDatesByLeader[leaderId].add(toDateKey(date));
    };

    logs.forEach(log => addSubmittedDate(log.leader_id, log.date));
    attendance.forEach(row => addSubmittedDate(row.leader_id, row.date));

    const submittedLeadersSet = new Set(Object.keys(submittedDatesByLeader).map(Number));
    stats.total_submitted_leaders = submittedLeadersSet.size;

    const subleaderReport = allLeaders.map(l => {
      const leaderAttendance = attendance.filter(a => a.leader_id === l.id);
      const lStats = { present: 0, absent: 0, excused: 0 };
      leaderAttendance.forEach(a => {
        if (a.status === 'present') { lStats.present++; stats.present++; }
        if (a.status === 'absent') { lStats.absent++; stats.absent++; }
        if (a.status === 'excused') { lStats.excused++; stats.excused++; }
      });

      return {
        leader_id: l.id,
        leader_name: l.full_name,
        section_name: l.section_name,
        phone: l.phone,
        submissions_count: submittedDatesByLeader[l.id]?.size || 0,
        stats: lStats
      };
    }).sort((left, right) => {
      if (right.submissions_count !== left.submissions_count) {
        return right.submissions_count - left.submissions_count;
      }

      const rightTotal = right.stats.present + right.stats.absent + right.stats.excused;
      const leftTotal = left.stats.present + left.stats.absent + left.stats.excused;
      if (rightTotal !== leftTotal) {
        return rightTotal - leftTotal;
      }

      return left.leader_name.localeCompare(right.leader_name);
    });

    res.json({ filterType, filterValue, requestedFilterValue: req.query.filterValue, service_id: effectiveServiceId, usedFallback, stats, subleaders: subleaderReport });
  } catch (error) {
    console.error('Aggregated overview error:', error);
    res.status(500).json({ error: 'Failed to aggregate overview' });
  }
});

// GET comprehensive details for a specific leader dashboard (Admin Drill-Down)
router.get('/leader-dashboard/:id', async (req, res) => {
  try {
    const leaderId = req.params.id;

    const leader = await new Promise((resolve, reject) => {
      db.get(`
        SELECT l.*, u.full_name, u.username, s.name as section_name
        FROM leaders l
        JOIN users u ON l.user_id = u.id
        JOIN sections s ON l.section_id = s.id
        WHERE l.id = ?
      `, [leaderId], (err, row) => err ? reject(err) : resolve(row));
    });

    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    const members = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM members WHERE leader_id = ? ORDER BY full_name', [leaderId], (err, rows) => err ? reject(err) : resolve(rows));
    });

    const history = await new Promise((resolve, reject) => {
      db.all(`
        SELECT sl.date, sl.created_at as submitted_at, COUNT(a.id) as records_count
        FROM submission_log sl
        LEFT JOIN attendance a ON sl.date = a.date AND sl.leader_id = (SELECT m.leader_id FROM members m WHERE m.id = a.member_id LIMIT 1)
        WHERE sl.leader_id = ?
        GROUP BY sl.id
        ORDER BY sl.date DESC, sl.created_at DESC
        LIMIT 20
      `, [leaderId], (err, rows) => err ? reject(err) : resolve(rows));
    });

    const trendStartDate = formatLocalDate(addDays(new Date(), -90));
    const trends = await new Promise((resolve, reject) => {
      db.all(`
        SELECT date,
               SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
               SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count
        FROM attendance
        WHERE member_id IN (SELECT id FROM members WHERE leader_id = ?)
          AND date >= ?
        GROUP BY date
        ORDER BY date ASC
      `, [leaderId, trendStartDate], (err, rows) => err ? reject(err) : resolve(rows));
    });

    res.json({
      leader,
      roster: members,
      history,
      trends
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch leader drill-down dashboard' });
  }
});

// POST bulk attendance (Admin bulk substitute)
router.post('/attendance', async (req, res) => {
  try {
    const { date, attendance, leader_id, section_id, service_id = 1 } = req.body;

    if (!date || !Array.isArray(attendance) || attendance.length === 0 || !leader_id || !section_id) {
      return res.status(400).json({ error: 'Date, leader_id, section_id, and attendance array required' });
    }

    const leaderId = Number(leader_id);
    const sectionId = Number(section_id);
    if (!Number.isInteger(leaderId) || !Number.isInteger(sectionId)) {
      return res.status(400).json({ error: 'Invalid leader_id or section_id' });
    }

    const leader = await get('SELECT id, section_id, is_active FROM leaders WHERE id = ?', [leaderId]);
    if (!leader || !leader.is_active || Number(leader.section_id) !== sectionId) {
      return res.status(400).json({ error: 'Leader does not exist, is inactive, or does not belong to the specified section' });
    }

    for (const record of attendance) {
      if (!['present', 'absent', 'excused'].includes(record.status)) {
        return res.status(400).json({ error: `Invalid status for member ${record.member_id}` });
      }
    }

    const existingSubmission = await queries.checkSubmissionExists(leaderId, date, service_id);
    if (existingSubmission) {
      return res.status(400).json({ error: 'Attendance already submitted for this leader on this date' });
    }

    const leaderMembers = await all('SELECT id FROM members WHERE leader_id = ? AND is_active = 1', [leaderId]);
    const validMemberIds = new Set(leaderMembers.map((m) => Number(m.id)));
    for (const record of attendance) {
      if (!validMemberIds.has(Number(record.member_id))) {
        return res.status(400).json({ error: `Member ${record.member_id} does not belong to leader ${leaderId}` });
      }
    }

    const serviceTypeRow = await get('SELECT points_config FROM service_types WHERE id = ?', [service_id]);
    const pointsConfig = serviceTypeRow?.points_config
      ? (typeof serviceTypeRow.points_config === 'string' ? JSON.parse(serviceTypeRow.points_config) : serviceTypeRow.points_config)
      : { present: 1, excused: 1 };

    await transaction(async (tx) => {
      for (const record of attendance) {
        await tx.run(
          upsertAttendanceSql({ includeServiceType: true }),
          [record.member_id, date, record.status, service_id, req.session.userId]
        );
        if (record.status === 'present' && pointsConfig.present > 0) {
          await tx.run('UPDATE members SET hall_of_fame_points = hall_of_fame_points + ? WHERE id = ?', [pointsConfig.present, record.member_id]);
        } else if (record.status === 'excused' && pointsConfig.excused > 0) {
          await tx.run('UPDATE members SET hall_of_fame_points = hall_of_fame_points + ? WHERE id = ?', [pointsConfig.excused, record.member_id]);
        }
      }
      await tx.run(
        'INSERT INTO submission_log (leader_id, section_id, date, service_id) VALUES (?, ?, ?, ?)',
        [leaderId, sectionId, date, service_id]
      );
    });

    res.json({ message: 'Attendance submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit attendance', details: error.message });
  }
});

// GET missing leader submissions for a given date and service.
// Returns each section leader with expected vs recorded member counts and a computed status.
router.get('/attendance/missing-submissions', async (req, res) => {
  try {
    const { date, service_id = 1 } = req.query;
    if (!date) return res.status(400).json({ error: 'Date query parameter required' });

    const leaders = await all(`
      SELECT l.id AS leader_id, u.full_name AS leader_name, s.id AS section_id, s.name AS section_name
      FROM leaders l
      JOIN users u ON l.user_id = u.id
      JOIN sections s ON l.section_id = s.id
      WHERE l.is_active = 1
      ORDER BY s.name, u.full_name
    `);

    const serviceType = await get('SELECT id, name FROM service_types WHERE id = ?', [Number(service_id)]);
    const serviceName = serviceType?.name || 'Main';

    const result = [];
    for (const leader of leaders) {
      const expectedRow = await get(
        'SELECT COUNT(*) AS cnt FROM members WHERE leader_id = ? AND is_active = 1',
        [leader.leader_id]
      );
      const expected = expectedRow?.cnt || 0;

      const recordedRow = await get(
        `SELECT COUNT(*) AS cnt FROM attendance a
         JOIN members m ON a.member_id = m.id
         WHERE m.leader_id = ? AND a.date = ? AND a.service_type_id = ?`,
        [leader.leader_id, date, Number(service_id)]
      );
      const recorded = recordedRow?.cnt || 0;

      const submissionLog = await get(
        'SELECT id, created_at FROM submission_log WHERE leader_id = ? AND date = ? AND service_id = ?',
        [leader.leader_id, date, Number(service_id)]
      );

      let status;
      if (submissionLog && recorded >= expected) {
        status = 'submitted';
      } else if (recorded > 0) {
        status = 'partial';
      } else if (submissionLog && recorded < expected) {
        status = 'late';
      } else {
        status = 'missing';
      }

      result.push({
        leader_id: leader.leader_id,
        leader_name: leader.leader_name,
        section_id: leader.section_id,
        section_name: leader.section_name,
        service_id: Number(service_id),
        service_name: serviceName,
        expected_members: expected,
        recorded_members: recorded,
        status,
        submitted_at: submissionLog?.created_at || null,
      });
    }

    const summary = {
      missing: result.filter(r => r.status === 'missing').length,
      partial: result.filter(r => r.status === 'partial').length,
      late: result.filter(r => r.status === 'late').length,
      submitted: result.filter(r => r.status === 'submitted').length,
      total_leaders: result.length,
    };

    res.json({ summary, leaders: result });
  } catch (error) {
    console.error('Missing submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch missing submissions' });
  }
});

// GET all members for a leader with their current attendance status for a given date+service.
router.get('/attendance/leader-members/:leaderId', async (req, res) => {
  try {
    const leaderId = parseInt(req.params.leaderId, 10);
    if (!Number.isInteger(leaderId) || leaderId <= 0) {
      return res.status(400).json({ error: 'Invalid leader id' });
    }
    const { date, service_id = 1 } = req.query;
    if (!date) return res.status(400).json({ error: 'Date query parameter required' });

    const leader = await get(
      'SELECT l.id, u.full_name AS leader_name, s.name AS section_name FROM leaders l JOIN users u ON l.user_id = u.id JOIN sections s ON l.section_id = s.id WHERE l.id = ?',
      [leaderId]
    );
    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    const members = await all(
      `SELECT m.id AS member_id, m.full_name, m.membership_id,
              a.id AS attendance_id, a.status, a.submitted_at
       FROM members m
       LEFT JOIN attendance a ON a.member_id = m.id AND a.date = ? AND a.service_type_id = ?
       WHERE m.leader_id = ? AND m.is_active = 1
       ORDER BY m.full_name`,
      [date, Number(service_id), leaderId]
    );

    const submittedRow = await get(
      'SELECT created_at FROM submission_log WHERE leader_id = ? AND date = ? AND service_id = ?',
      [leaderId, date, Number(service_id)]
    );

    res.json({
      leader: { id: leaderId, name: leader.leader_name, section_name: leader.section_name },
      date,
      service_id: Number(service_id),
      members,
      previously_submitted: !!submittedRow,
      submitted_at: submittedRow?.created_at || null,
    });
  } catch (error) {
    console.error('Leader members error:', error);
    res.status(500).json({ error: 'Failed to fetch leader members' });
  }
});

// POST bulk attendance correction for a leader's section.
// Handles both create (upsert) and update, with full audit logging.
router.post('/attendance/bulk-correct', async (req, res) => {
  try {
    const { date, service_id = 1, leader_id, reason, records } = req.body;

    if (!date || !leader_id || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'date, leader_id, and records array required' });
    }

    const validReasons = ['Leader forgot', 'Leader absent', 'Paper attendance', 'System recovery', 'Other'];
    const trimmedReason = typeof reason === 'string' && validReasons.includes(reason) ? reason : 'Other';

    for (const record of records) {
      if (!record.member_id || !VALID_STATUSES.has(record.status)) {
        return res.status(400).json({ error: `Invalid member_id or status for record` });
      }
    }

    const leader = await get(
      'SELECT l.id, l.section_id, u.full_name AS leader_name FROM leaders l JOIN users u ON l.user_id = u.id WHERE l.id = ?',
      [Number(leader_id)]
    );
    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    const existingSubmission = await get(
      'SELECT id, created_at FROM submission_log WHERE leader_id = ? AND date = ? AND service_id = ?',
      [Number(leader_id), date, Number(service_id)]
    );

    const ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    await transaction(async (tx) => {
      for (const record of records) {
        const existing = await tx.get(
          'SELECT id, status FROM attendance WHERE member_id = ? AND date = ? AND service_type_id = ?',
          [record.member_id, date, Number(service_id)]
        );

        if (existing) {
          if (existing.status !== record.status) {
            await tx.run(
              'UPDATE attendance SET status = ?, submitted_by = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?',
              [record.status, req.session.userId, existing.id]
            );
            queries.createAuditEntry(
              req.session.userId, 'update', 'attendance', existing.id,
              { status: existing.status },
              { status: record.status, reason: trimmedReason, original_leader: leader.leader_name, corrected_by_admin: true },
              ipAddress, userAgent
            ).catch(e => console.error('Audit write failed:', e.message));
          }
        } else {
          const insertResult = await tx.run(
            'INSERT INTO attendance (member_id, date, status, submitted_by, service_type_id) VALUES (?, ?, ?, ?, ?)',
            [record.member_id, date, record.status, req.session.userId, Number(service_id)]
          );
          queries.createAuditEntry(
            req.session.userId, 'create', 'attendance', insertResult?.lastID || 0,
            null,
            { status: record.status, reason: trimmedReason, original_leader: leader.leader_name, corrected_by_admin: true },
            ipAddress, userAgent
          ).catch(e => console.error('Audit write failed:', e.message));
        }
      }

      // Create submission_log if not exists
      if (!existingSubmission) {
        await tx.run(
          'INSERT INTO submission_log (leader_id, section_id, date, service_id) VALUES (?, ?, ?, ?)',
          [Number(leader_id), leader.section_id, date, Number(service_id)]
        );
      }
    });

    res.json({
      message: 'Bulk correction saved successfully',
      leader: leader.leader_name,
      records_saved: records.length,
      reason: trimmedReason,
    });
  } catch (error) {
    console.error('Bulk correct error:', error);
    res.status(500).json({ error: 'Failed to save bulk correction' });
  }
});

module.exports = router;
