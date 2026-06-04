const express = require('express');
const { queries, run, get, all, db, transaction } = require('../database');
const { isAuthenticated, requireRole, validateDate } = require('../middleware/auth');
const { addDays, formatLocalDate } = require('../utils/date');
const { escapeCsvValue, toCsvRow } = require('../utils/csv');
const { yearEquals, weekEquals } = require('../utils/sqlDialect');

const router = express.Router();

// Apply authentication and admin role check to all routes
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
    db.all(`
      SELECT t.*, owner_user.full_name AS owner_name
      FROM admin_followup_tasks t
      LEFT JOIN leaders l ON l.id = t.owner_id
      LEFT JOIN users owner_user ON owner_user.id = l.user_id
      ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.created_at DESC
      LIMIT 100
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch follow-up tasks' });
      res.json(rows);
    });
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
    db.all(`
      SELECT v.*, u.full_name AS created_by_name
      FROM visitor_intake v
      LEFT JOIN users u ON u.id = v.created_by
      ORDER BY v.created_at DESC
      LIMIT 100
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch visitors' });
      res.json(rows);
    });
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
      INSERT INTO visitor_intake (full_name, phone, email, section_interest, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      fullName,
      req.body.phone || null,
      req.body.email || null,
      req.body.section_interest || null,
      req.body.notes || null,
      req.session.userId
    ]);

    res.status(201).json({ id: result.id, message: 'Visitor saved' });
  } catch (error) {
    console.error('Create visitor error:', error);
    res.status(500).json({ error: 'Failed to save visitor' });
  }
});

// --- Service Instances & Assignments ---
router.get('/service-instances/:date', validateDate('date'), async (req, res) => {
  try {
    const { date } = req.params;
    const { service_id } = req.query;

    if (!service_id) {
      return res.status(400).json({ error: 'service_id is required' });
    }

    const instance = await queries.getServiceInstance(service_id, date);
    if (!instance) {
      return res.json({ assigned_leader_ids: [] });
    }

    res.json({
      id: instance.id,
      assigned_leader_ids: JSON.parse(instance.assigned_leader_ids || '[]')
    });
  } catch (error) {
    console.error('Fetch service instances error:', error);
    res.status(500).json({ error: 'Failed to fetch service instance' });
  }
});

router.post('/service-instances', async (req, res) => {
  try {
    const { date, service_id, assigned_leader_ids } = req.body;

    if (!date || !service_id || !Array.isArray(assigned_leader_ids)) {
      return res.status(400).json({ error: 'date, service_id, and assigned_leader_ids array are required' });
    }

    await queries.saveServiceInstance(service_id, date, JSON.stringify(assigned_leader_ids));
    res.json({ message: 'Service assignments updated successfully' });
  } catch (error) {
    console.error('Update service instances error:', error);
    res.status(500).json({ error: 'Failed to update service instance' });
  }
});

// REWARDS & RECOGNITION PROGRAM
// ─────────────────────────────────────────────────────────────

// Helper: build date condition from query params (year + optional week)
function buildRewardDateCondition(query, tableAlias = 'sl') {
  const year = query.year || new Date().getFullYear().toString();
  const week = query.week; // format: "YYYY-Www" or just "Www" if year is separate

  if (week) {
    // Expect week param as "YYYY-Www" e.g. "2026-W13"
    const parts = week.split('-W');
    if (parts.length === 2) {
      const w = parts[1].padStart(2, '0');
      const y = parts[0] || year;
      return {
        condition: weekEquals(`${tableAlias}.date`),
        params: [`${y}-${w}`]
      };
    }
  }

  // Default: full year
  return {
    condition: yearEquals(`${tableAlias}.date`),
    params: [year]
  };
}

// GET /admin/rewards/top-members
// Rankings: members by attendance rate on actual service days
router.get('/rewards/top-members', async (req, res) => {
  try {
    const { condition, params } = buildRewardDateCondition(req.query);

    const rows = await new Promise((resolve, reject) => {
      const query = `
        WITH service_days AS (
          SELECT DISTINCT date
          FROM submission_log sl
          WHERE ${condition}
        ),
        member_stats AS (
          SELECT
            m.id,
            m.membership_id,
            m.full_name,
            s.name            AS section_name,
            u.full_name       AS leader_name,
            (SELECT COUNT(*) FROM service_days) AS total_services,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS times_present
          FROM members m
          JOIN sections  s ON m.section_id = s.id
          JOIN leaders   l ON m.leader_id  = l.id
          JOIN users     u ON l.user_id    = u.id
          LEFT JOIN attendance a
            ON a.member_id = m.id
            AND a.date IN (SELECT date FROM service_days)
          GROUP BY m.id, m.membership_id, m.full_name, s.name, u.full_name
        )
        SELECT
          id, membership_id, full_name, section_name, leader_name,
          total_services, times_present,
          CASE
            WHEN total_services > 0
            THEN ROUND((times_present * 100.0 / total_services), 1)
            ELSE 0
          END AS attendance_rate
        FROM member_stats
        ORDER BY attendance_rate DESC, times_present DESC
      `;
      db.all(query, params, (err, r) => err ? reject(err) : resolve(r || []));
    });

    // Assign shared ranks (dense ranking — ties share the same rank)
    let rank = 1;
    const ranked = rows.map((row, idx) => {
      if (idx > 0 && row.attendance_rate < rows[idx - 1].attendance_rate) {
        rank = idx + 1;
      }
      return { ...row, rank };
    });

    res.json({ members: ranked, total_service_days: ranked[0]?.total_services || 0 });
  } catch (error) {
    console.error('Rewards top-members error:', error);
    res.status(500).json({ error: 'Failed to fetch member leaderboard' });
  }
});

// GET /admin/rewards/top-leaders
// Rankings: leaders by submission consistency on actual service days
router.get('/rewards/top-leaders', async (req, res) => {
  try {
    const { condition, params } = buildRewardDateCondition(req.query);

    const rows = await new Promise((resolve, reject) => {
      const query = `
        WITH service_days AS (
          SELECT DISTINCT date
          FROM submission_log sl
          WHERE ${condition}
        ),
        leader_stats AS (
          SELECT
            l.id,
            u.full_name  AS leader_name,
            s.name       AS section_name,
            (SELECT COUNT(*) FROM service_days) AS total_service_days,
            COUNT(DISTINCT CASE
              WHEN sl.date IN (SELECT date FROM service_days)
              THEN sl.date
            END) AS submitted_count
          FROM leaders  l
          JOIN users    u ON l.user_id    = u.id
          JOIN sections s ON l.section_id = s.id
          LEFT JOIN submission_log sl ON sl.leader_id = l.id
          GROUP BY l.id, u.full_name, s.name
        )
        SELECT
          id, leader_name, section_name,
          total_service_days, submitted_count,
          CASE
            WHEN total_service_days > 0
            THEN ROUND((submitted_count * 100.0 / total_service_days), 1)
            ELSE 0
          END AS submission_rate
        FROM leader_stats
        ORDER BY submission_rate DESC, submitted_count DESC
      `;
      db.all(query, params, (err, r) => err ? reject(err) : resolve(r || []));
    });

    // Dense ranking — ties share the same rank
    let rank = 1;
    const ranked = rows.map((row, idx) => {
      if (idx > 0 && row.submission_rate < rows[idx - 1].submission_rate) {
        rank = idx + 1;
      }
      return { ...row, rank };
    });

    res.json({ leaders: ranked, total_service_days: ranked[0]?.total_service_days || 0 });
  } catch (error) {
    console.error('Rewards top-leaders error:', error);
    res.status(500).json({ error: 'Failed to fetch leader leaderboard' });
  }
});

// Notification routes
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const result = await queries.getUnreadCount(req.session.userId);
    res.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Notification count error:', error);
    res.json({ count: 0 });
  }
});

router.get('/notifications/all', async (req, res) => {
  try {
    const notifications = await queries.getAllNotifications(req.session.userId);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const notifications = await queries.getUnreadNotifications(req.session.userId);
    res.json(notifications);
  } catch (error) {
    console.error('Get unread notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/notifications/:id/read', async (req, res) => {
  try {
    await queries.markNotificationRead(req.params.id);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

router.put('/notifications/read-all', async (req, res) => {
  try {
    await queries.markAllNotificationsRead(req.session.userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all notifications read' });
  }
});

router.get('/notifications/consecutive-absences', async (req, res) => {
  try {
    const { leaderId } = req.query;
    const id = leaderId || req.session.leaderId;
    if (!id) return res.status(400).json({ error: 'Leader ID required' });
    const members = await queries.getConsecutiveAbsentMembers(id, 2);
    res.json(members);
  } catch (error) {
    console.error('Consecutive absences error:', error);
    res.status(500).json({ error: 'Failed to fetch consecutive absences' });
  }
});

router.get('/notifications/follow-ups', async (req, res) => {
  try {
    const { leaderId } = req.query;
    const id = leaderId || req.session.leaderId;
    if (!id) return res.status(400).json({ error: 'Leader ID required' });
    const followUps = await queries.getFollowUpsByLeader(id);
    res.json(followUps);
  } catch (error) {
    console.error('Follow-ups error:', error);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

router.put('/notifications/follow-ups/:id', async (req, res) => {
  try {
    const { contacted, contact_method, notes } = req.body;
    await queries.updateFollowUp(req.params.id, contacted ? 1 : 0, contact_method || null, notes || null);
    res.json({ message: 'Follow-up updated' });
  } catch (error) {
    console.error('Update follow-up error:', error);
    res.status(500).json({ error: 'Failed to update follow-up' });
  }
});

// Audit log routes
router.get('/audit-log', async (req, res) => {
  try {
    const { entityType, entityId, userId, action, startDate, endDate, limit } = req.query;
    const filters = {
      entityType: entityType || null,
      entityId: entityId ? parseInt(entityId) : null,
      userId: userId ? parseInt(userId) : null,
      action: action || null,
      startDate: startDate || null,
      endDate: endDate || null,
      limit: limit ? parseInt(limit) : 200
    };
    const entries = await queries.getAuditLog(filters);
    res.json(entries);
  } catch (error) {
    console.error('Audit log fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

router.get('/audit-log/member/:id', async (req, res) => {
  try {
    const history = await queries.getMemberAuditHistory(req.params.id);
    res.json(history);
  } catch (error) {
    console.error('Member audit history error:', error);
    res.status(500).json({ error: 'Failed to fetch member audit history' });
  }
});

// Advanced Analytics
router.get('/analytics/prediction', async (req, res) => {
  try {
    const prediction = await queries.getAttendancePrediction();
    res.json(prediction[0] || {});
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

router.get('/analytics/anomalies', async (req, res) => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold) : 20;
    const anomalies = await queries.getSectionAnomalies(threshold);
    res.json(anomalies);
  } catch (error) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

router.get('/analytics/streaks', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const streaks = await queries.getMemberStreaks(limit);
    res.json(streaks);
  } catch (error) {
    console.error('Streak query error:', error);
    res.status(500).json({ error: 'Failed to fetch streaks' });
  }
});

router.get('/analytics/leader-performance', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || formatLocalDate(addDays(new Date(), -90));
    const end = end_date || formatLocalDate();
    const trends = await queries.getLeaderPerformanceTrends(start, end);
    res.json(trends);
  } catch (error) {
    console.error('Leader performance error:', error);
    res.status(500).json({ error: 'Failed to fetch leader performance' });
  }
});

router.get('/analytics/birthdays', async (req, res) => {
   try {
     const days = req.query.days ? parseInt(req.query.days) : 30;
     const birthdays = await queries.getUpcomingBirthdays(days);
     res.json(birthdays);
   } catch (error) {
     console.error('Birthday query error:', error);
     res.status(500).json({ error: 'Failed to fetch birthdays' });
   }
 });

// Get all birthdays with filtering
router.get('/birthdays', async (req, res) => {
   try {
     const filters = {};
     
     if (req.query.section_id) {
       filters.section_id = parseInt(req.query.section_id);
     }
     
     if (req.query.month) {
       filters.month = req.query.month;
     }
     
     const birthdays = await queries.getAllBirthdays(filters);
     res.json(birthdays);
   } catch (error) {
     console.error('Get all birthdays error:', error);
     res.status(500).json({ error: 'Failed to fetch birthdays' });
   }
 });

// Export birthdays to CSV
router.get('/birthdays/export', async (req, res) => {
   try {
     const filters = {};
     
     if (req.query.section_id) {
       filters.section_id = parseInt(req.query.section_id);
     }
     
     if (req.query.month) {
       filters.month = req.query.month;
     }
     
     const birthdays = await queries.getAllBirthdays(filters);
     
     // Set CSV headers
     res.setHeader('Content-Type', 'text/csv');
     res.setHeader('Content-Disposition', 'attachment; filename=birthdays.csv');
     
      // Create CSV content
      const csvRows = [];
      csvRows.push(toCsvRow(['ID', 'Full Name', 'Membership ID', 'Phone', 'Address', 'Date of Birth', 'Age Group', 'Gender', 'Section', 'Leader']));

      for (const b of birthdays) {
        const dob = b.date_of_birth ? new Date(b.date_of_birth).toLocaleDateString() : '';
        csvRows.push(toCsvRow([
          b.id,
          b.full_name,
          b.membership_id,
          b.phone || '',
          b.address || '',
          dob,
          b.age_group || '',
          b.gender || '',
          b.section_name,
          b.leader_name || ''
        ]));
      }
     
     res.send(csvRows.join('\n'));
   } catch (error) {
     console.error('Export birthdays error:', error);
     res.status(500).json({ error: 'Failed to export birthdays' });
   }
 });

const { listBackups, deleteBackup, backupDatabase, restoreDatabase } = require('../backup');

const requireAdmin = requireRole('admin');

router.get('/backups', requireAdmin, async (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

router.post('/backups/create', requireAdmin, async (req, res) => {
  try {
    const backupPath = await backupDatabase();
    res.json({ message: 'Backup created successfully', backup: backupPath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

router.post('/backups/restore', requireAdmin, async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Backup filename is required' });
    }
    await restoreDatabase(filename);
    res.json({ message: 'Database restored successfully. Server restart required.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/backups/:filename', requireAdmin, async (req, res) => {
  try {
    deleteBackup(req.params.filename);
    res.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// --- Settings Management ---
router.get('/settings/config', async (req, res) => {
  try {
    const settings = await queries.getSettings();
    const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings/config', async (req, res) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config object' });
    }

    for (const [key, value] of Object.entries(config)) {
      await queries.updateSetting(key, String(value));
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/service-types', async (req, res) => {
  try {
    const services = await queries.getAllServiceTypes();
    res.json(services.map(s => ({
      ...s,
      eligibility_rules: JSON.parse(s.eligibility_rules || '{}'),
      points_config: JSON.parse(s.points_config || '{"present":10,"excused":3}')
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch service types' });
  }
});

router.put('/service-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, default_day, default_time, eligibility_rules, points_config } = req.body;
    await queries.updateServiceType(
      id, 
      name, 
      default_day, 
      default_time, 
      JSON.stringify(eligibility_rules), 
      JSON.stringify(points_config)
    );
    res.json({ message: 'Service type updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service type' });
  }
});

module.exports = router;
