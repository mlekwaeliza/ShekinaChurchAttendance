const express = require('express');
const { db, queries, run, all, get, transaction } = require('../database');
const { isAuthenticated } = require('../middleware/auth');
const { addDays, formatLocalDate, formatMonthDay, getWeekStartString, startOfLocalDay } = require('../utils/date');
const { monthDay: sqlMonthDay } = require('../utils/sqlDialect');

const router = express.Router();
router.use(isAuthenticated);

// Ensure user has base permission (Leader or Admin/Pastor)
const checkPermission = async (req, res, next) => {
  try {
    const isPastorOrAdmin = req.session.user.role === 'admin' || req.session.user.role === 'pastor';
    
    // Find leader record if any
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    
    if (!isPastorOrAdmin && !leaderRecord) {
      return res.status(403).json({ error: 'Access denied: Must be a pastor or leader' });
    }
    
    req.outreachContext = {
      isPastorOrAdmin,
      leaderId: leaderRecord ? leaderRecord.id : null,
      sectionId: leaderRecord ? leaderRecord.section_id : null,
      userId: req.session.userId
    };
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Permission check failed' });
  }
};

router.use(checkPermission);

// GET /api/outreach/stats
router.get('/stats', async (req, res) => {
  try {
    const { userId, isPastorOrAdmin, sectionId } = req.outreachContext;
    const weekStart = getWeekStartString();
    const contactCutoff = startOfLocalDay(addDays(new Date(), -7)).toISOString();
    
    const logsThisWeekRaw = await get(`SELECT COUNT(*) as c FROM outreach_logs WHERE created_by = ? AND week_start = ?`, [userId, weekStart]);
    const logsThisWeek = logsThisWeekRaw.c || 0;

    const membersContactedRaw = await get(`SELECT COUNT(DISTINCT member_id) as c FROM outreach_logs WHERE created_by = ? AND week_start = ?`, [userId, weekStart]);
    const membersContacted = membersContactedRaw.c || 0;

    const totalLogsRaw = await get(`SELECT COUNT(*) as c FROM outreach_logs WHERE created_by = ?`, [userId]);
    const totalLogs = totalLogsRaw.c || 0;

    // Filter members assigned to current user (if leader, section. if pastor, all)
    let notContactedQuery = `
      SELECT COUNT(id) as c FROM members m 
      WHERE m.is_active = 1 
      AND NOT EXISTS (
        SELECT 1 FROM outreach_logs ol 
        WHERE ol.member_id = m.id AND ol.created_at >= ?
      )
    `;
    let notContactParams = [contactCutoff];
    if (!isPastorOrAdmin) {
      notContactedQuery += ` AND m.section_id = ?`;
      notContactParams.push(sectionId);
    }

    const notContactedRaw = await get(notContactedQuery, notContactParams);
    const notContactedCount = notContactedRaw.c || 0;

    res.json({
      thisWeek: logsThisWeek,
      membersContacted,
      notContacted: notContactedCount,
      totalLogs
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/outreach/members?filter=...
router.get('/members', async (req, res) => {
  try {
    const { isPastorOrAdmin, sectionId } = req.outreachContext;
    const { filter = 'all', service_id } = req.query;
    const today = formatLocalDate();
    const visitorCutoff = formatLocalDate(addDays(new Date(), -14));
    const contactCutoff = startOfLocalDay(addDays(new Date(), -7)).toISOString();
    const upcomingBirthdayMonthDays = Array.from({ length: 8 }, (_, index) => formatMonthDay(addDays(new Date(), index)));
    
    let baseQuery = `
      SELECT m.*, 
             s.name as section_name, 
             u.full_name as leader_name,
             (SELECT created_at FROM outreach_logs WHERE member_id = m.id ORDER BY created_at DESC LIMIT 1) as latest_contact_date,
             (SELECT contact_method FROM outreach_logs WHERE member_id = m.id ORDER BY created_at DESC LIMIT 1) as latest_contact_method,
             (SELECT u2.full_name FROM outreach_logs ol JOIN users u2 ON ol.created_by = u2.id WHERE ol.member_id = m.id ORDER BY ol.created_at DESC LIMIT 1) as latest_contact_by
      FROM members m
      LEFT JOIN sections s ON m.section_id = s.id
      LEFT JOIN leaders l ON m.leader_id = l.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE m.is_active = 1
    `;
    let params = [];
    
    if (!isPastorOrAdmin) {
      baseQuery += ` AND m.section_id = ?`;
      params.push(sectionId);
    }
    
    if (filter === 'absent') {
      const dbServiceId = service_id || 1;
      const lastServiceDateRaw = await get(`SELECT MAX(date) as last_date FROM attendance WHERE service_type_id = ?`, [dbServiceId]);
      const lastServiceDate = lastServiceDateRaw && lastServiceDateRaw.last_date ? lastServiceDateRaw.last_date : formatLocalDate();
      
      baseQuery += ` AND EXISTS (SELECT 1 FROM attendance a WHERE a.member_id = m.id AND a.date = ? AND a.status = 'absent' AND a.service_type_id = ?)`;
      params.push(lastServiceDate, dbServiceId);
    } else if (filter === 'birthdays') {
      const placeholders = upcomingBirthdayMonthDays.map(() => '?').join(', ');
      baseQuery += ` AND m.date_of_birth IS NOT NULL AND ${sqlMonthDay('m.date_of_birth')} IN (${placeholders})`;
      params.push(...upcomingBirthdayMonthDays);
    } else if (filter === 'visitors') {
      baseQuery += ` AND m.status = 'Visitor' AND m.visitor_date >= ?`;
      params.push(visitorCutoff);
    } else if (filter === 'flagged') {
      baseQuery += ` AND (m.flags LIKE '%Sick%' OR m.flags LIKE '%Flagged%')`;
    } else if (filter === 'overdue') {
      baseQuery += ` AND EXISTS (SELECT 1 FROM pastoral_care_queue pcq WHERE pcq.member_id = m.id AND pcq.status = 'pending' AND pcq.due_date < ?)`;
      params.push(today);
    } else if (filter === 'default_not_contacted') {
       baseQuery += ` AND NOT EXISTS (SELECT 1 FROM outreach_logs ol WHERE ol.member_id = m.id AND ol.created_at >= ?)`;
       params.push(contactCutoff);
    }

    const members = await all(baseQuery, params);
    
    // Parse flags and prayer requests
    const mapped = members.map(m => ({
      ...m,
      flags: JSON.parse(m.flags || '[]'),
      prayer_requests: JSON.parse(m.prayer_requests || '[]')
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Members fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// GET /api/outreach/leaders
// Returns leaders for the assignment dropdown
router.get('/leaders', async (req, res) => {
  try {
    const { isPastorOrAdmin, sectionId } = req.outreachContext;
    let query = `
      SELECT u.id as user_id, u.full_name, s.name as section_name
      FROM leaders l
      JOIN users u ON l.user_id = u.id
      JOIN sections s ON l.section_id = s.id
      WHERE l.is_active = 1
    `;
    let params = [];
    
    if (!isPastorOrAdmin) {
      query += ` AND l.section_id = ?`;
      params.push(sectionId);
    }
    
    const leaders = await all(query, params);
    res.json(leaders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignable leaders' });
  }
});

// POST /api/outreach/log
router.post('/log', async (req, res) => {
  try {
    const { userId, leaderId } = req.outreachContext;
    const {
      member_id, contact_method, outcome, service_id, message,
      new_prayer_request, follow_up_needed, assigned_to_user_id, due_date,
      add_to_hall_of_fame, points, new_flags = []
    } = req.body;

    if (!member_id || !contact_method || !outcome) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const weekStart = getWeekStartString();
    const parsedServiceId = service_id && service_id !== 'all' ? service_id : null;

    // Pre-fetch member state outside the transaction (read-only).
    const member = await get(`SELECT prayer_requests, flags FROM members WHERE id = ?`, [member_id]);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    let prayers = [];
    let flags = [];
    try { prayers = member.prayer_requests ? JSON.parse(member.prayer_requests) : []; } catch (e) { prayers = []; }
    try { flags = member.flags ? JSON.parse(member.flags) : []; } catch (e) { flags = []; }

    if (new_prayer_request && new_prayer_request.trim() !== '') {
      prayers.unshift({ request: new_prayer_request, date: new Date().toISOString() });
    }
    if (Array.isArray(new_flags) && new_flags.length > 0) {
      for (const f of new_flags) {
        if (!f.reason) f.reason = 'Logged via outreach';
        if (!f.created_at) f.created_at = new Date().toISOString();
        flags.push(f);
      }
    }

    await transaction(async (tx) => {
      const logResult = await tx.run(
        `INSERT INTO outreach_logs (leader_id, member_id, contact_method, outcome, service_id, created_by, message, week_start)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [leaderId || 0, member_id, contact_method, outcome, parsedServiceId, userId, message || null, weekStart]
      );
      const logId = logResult.lastID;

      if (add_to_hall_of_fame && points) {
        await tx.run(
          `INSERT INTO hall_of_fame_adjustments (member_id, points, reason, outreach_log_id) VALUES (?, ?, ?, ?)`,
          [member_id, points, `Outreach: ${contact_method}`, logId]
        );
        await tx.run(
          `UPDATE members SET hall_of_fame_points = hall_of_fame_points + ? WHERE id = ?`,
          [points, member_id]
        );
      }

      if (follow_up_needed && due_date && assigned_to_user_id) {
        await tx.run(
          `INSERT INTO pastoral_care_queue (member_id, assigned_by, assigned_to, due_date, status, notes) VALUES (?, ?, ?, ?, 'pending', ?)`,
          [member_id, userId, assigned_to_user_id, due_date, `Follow-up needed after ${contact_method} by user ${userId}`]
        );
      }

      await tx.run(
        `UPDATE members SET last_contacted_at = CURRENT_TIMESTAMP, last_contacted_by = ?, prayer_requests = ?, flags = ? WHERE id = ?`,
        [userId, JSON.stringify(prayers), JSON.stringify(flags), member_id]
      );
    });

    res.json({ message: 'Outreach logged successfully' });
  } catch (error) {
    console.error('Log error:', error);
    res.status(500).json({ error: 'Failed to process outreach log' });
  }
});

// GET /api/outreach/history
router.get('/history', async (req, res) => {
  try {
    const { userId, isPastorOrAdmin, sectionId } = req.outreachContext;
    
    let query = `
      SELECT ol.*, 
             m.full_name as member_name,
             u.full_name as logger_name,
             s.name as service_name,
             hfa.points as awarded_points
      FROM outreach_logs ol
      JOIN members m ON ol.member_id = m.id
      JOIN users u ON ol.created_by = u.id
      LEFT JOIN service_types s ON ol.service_id = s.id
      LEFT JOIN hall_of_fame_adjustments hfa ON hfa.outreach_log_id = ol.id
    `;
    let params = [];
    
    if (!isPastorOrAdmin) {
      query += ` WHERE m.section_id = ?`;
      params.push(sectionId);
    }
    
    query += ` ORDER BY ol.created_at DESC LIMIT 200`;
    
    const logs = await all(query, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
