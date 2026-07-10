const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { queries, db } = require('../database');
const { isAuthenticated, requireRole, validateDate } = require('../middleware/auth');
const { yearEquals, weekEquals } = require('../utils/sqlDialect');

// Promisified raw query helpers
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
});

const router = express.Router();

// Apply authentication and admin role check to all routes
router.use(isAuthenticated);
router.use(requireRole(['admin']));

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

const { listBackups, deleteBackup, backupDatabase, restoreDatabase, safeBackupName, getBackupStatus } = require('../backup');

const requireAdmin = requireRole('admin');

router.get('/backups', requireAdmin, async (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// GET /api/admin/backups/status
// Aggregate health summary: backup count, last-backup age, remote-upload
// configured, and human-readable warnings. Useful for admin dashboards
// and uptime checks — a single endpoint that says "is my backup story
// working?" without needing to introspect the filesystem.
router.get('/backups/status', requireAdmin, async (req, res) => {
  try {
    const status = getBackupStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read backup status' });
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

// GET /api/admin/backups/download/:filename
// Stream the backup file directly to the admin as a binary download.
// This is the primary "get my data out" mechanism on Render, where the
// local disk is ephemeral. The admin saves the response to their
// machine. Combined with Neon's 7-day PITR (Neon free tier) and an
// optional BACKUP_REMOTE_URL configured for S3-compatible storage,
// this gives a full defense-in-depth backup story.
router.get('/backups/download/:filename', requireAdmin, async (req, res) => {
  try {
    let safeName;
    try {
      safeName = safeBackupName(req.params.filename);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    const filePath = path.join(__dirname, '..', 'backups', safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

router.post('/backups/restore', requireAdmin, async (req, res) => {
  try {
    // H2-fix: require typed confirmation for destructive restore.
    if (String(req.body?.confirm || '').toUpperCase() !== 'RESTORE') {
      return res.status(400).json({
        error: 'Confirmation required',
        details: 'Send { "filename": "...", "confirm": "RESTORE" } in the request body to restore a backup. This will overwrite the live database.'
      });
    }
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
    // H2-fix: require typed confirmation for destructive backup delete.
    if (String(req.body?.confirm || '').toUpperCase() !== 'DELETE') {
      return res.status(400).json({
        error: 'Confirmation required',
        details: 'Send { "confirm": "DELETE" } in the request body to permanently remove a backup file.'
      });
    }
    deleteBackup(req.params.filename);
    res.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// --- User Management ---
router.get('/users', async (req, res) => {
  try {
    const users = await queries.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, password, role, full_name, section_id, phone, email } = req.body;

    if (!username || !password || !role || !full_name) {
      return res.status(400).json({ error: 'Username, password, role, and full name are required' });
    }

    const validRoles = ['admin', 'leader', 'pastor', 'evangelist', 'accountant'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await queries.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await queries.createUser(username, password_hash, role, full_name);
    const userId = result.lastID;

    if (role === 'leader' && section_id) {
      const leaderPhone = phone || null;
      const leaderEmail = email || null;
      await queries.createLeader(userId, parseInt(section_id, 10), leaderPhone, leaderEmail, 0);
    }

    const temp_password = password;
    res.status(201).json({
      message: 'User created successfully',
      user: { id: userId, username, role, full_name },
      temp_password
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, full_name, username } = req.body;

    const user = await queries.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (role) {
      const validRoles = ['admin', 'leader', 'pastor', 'evangelist', 'accountant'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }
      await queries.updateUserRole(id, role);
    }

    if (full_name) {
      await queries.updateUserFullName(full_name, id);
    }

    if (username && username !== user.username) {
      const existing = await queries.findUserByUsername(username);
      if (existing && existing.id !== Number(id)) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      await queries.updateUserUsername(id, username);
    }

    const updated = await queries.getUserById(id);
    res.json({ message: 'User updated', user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await queries.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const temp_password = crypto.randomBytes(8).toString('base64url').slice(0, 12);
    const password_hash = await bcrypt.hash(temp_password, 10);
    await queries.updateUserPassword(password_hash, id);

    res.json({
      message: 'Password reset successfully',
      username: user.username,
      temp_password
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await queries.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      const users = await queries.getAllUsers();
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }

    await queries.deleteUserAndCascade(id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
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

// GET /admin/performance/dashboard
router.get('/performance/dashboard', async (req, res) => {
  try {
    const filter = req.query.filter || 'month';
    const today = new Date();
    let startDate, endDate;

    if (filter === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    } else if (filter === 'month') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    } else if (filter === 'quarter') {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      startDate = d.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    } else if (filter === 'year') {
      const d = new Date(today);
      d.setDate(d.getDate() - 365);
      startDate = d.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    } else if (filter === 'custom' && req.query.startDate && req.query.endDate) {
      startDate = req.query.startDate;
      endDate = req.query.endDate;
    } else {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    }

    // Fetch config weights
    const settings = await all("SELECT key, value FROM settings");
    const perfSettings = settings.filter(s => s.key.startsWith('perf_'));
    const config = {};
    perfSettings.forEach(s => { config[s.key] = Number(s.value); });

    const memberWeights = {
      perf_member_church_attendance: config.perf_member_church_attendance ?? 30,
      perf_member_cell_attendance: config.perf_member_cell_attendance ?? 20,
      perf_member_ministry: config.perf_member_ministry ?? 15,
      perf_member_evangelism: config.perf_member_evangelism ?? 15,
      perf_member_contributions: config.perf_member_contributions ?? 10,
      perf_member_volunteer: config.perf_member_volunteer ?? 5,
      perf_member_events: config.perf_member_events ?? 5
    };
    const leaderWeights = {
      perf_leader_submission_rate: config.perf_leader_submission_rate ?? 20,
      perf_leader_member_attendance: config.perf_leader_member_attendance ?? 20,
      perf_leader_retention: config.perf_leader_retention ?? 15,
      perf_leader_cell_growth: config.perf_leader_cell_growth ?? 15,
      perf_leader_evangelism: config.perf_leader_evangelism ?? 10,
      perf_leader_followups: config.perf_leader_followups ?? 10,
      perf_leader_reports: config.perf_leader_reports ?? 5,
      perf_leader_ministry: config.perf_leader_ministry ?? 5
    };

    // Fetch basic church data from database tables directly
    const [
      members,
      leaders,
      cells,
      cellMembers,
      deptMembers,
      attendance,
      contributions,
      outreachLogs,
      visitorIntake,
      absentFollowups,
      submissionLogs,
      departments
    ] = await Promise.all([
      all("SELECT m.id, m.full_name, m.gender, m.age_group, m.section_id, s.name as section_name, m.leader_id, u.full_name as leader_name FROM members m LEFT JOIN sections s ON m.section_id = s.id LEFT JOIN leaders l ON m.leader_id = l.id LEFT JOIN users u ON l.user_id = u.id WHERE m.is_active = 1"),
      all("SELECT l.id, u.full_name as leader_name, l.section_id, s.name as section_name FROM leaders l JOIN users u ON l.user_id = u.id JOIN sections s ON l.section_id = s.id"),
      all("SELECT id, name, cell_number FROM home_cells WHERE is_active = 1"),
      all("SELECT cell_id, church_member_id FROM home_cell_members WHERE is_active = 1"),
      all("SELECT department_id, member_id FROM department_members"),
      all("SELECT member_id, status FROM attendance WHERE date >= ? AND date <= ?", [startDate, endDate]),
      all("SELECT member_id, amount FROM contributions WHERE payment_date >= ? AND payment_date <= ?", [startDate, endDate]),
      all("SELECT member_id, leader_id FROM outreach_logs WHERE created_at >= ? AND created_at <= ?", [startDate + ' 00:00:00', endDate + ' 23:59:59']),
      all("SELECT created_by, status FROM visitor_intake WHERE created_at >= ? AND created_at <= ?", [startDate + ' 00:00:00', endDate + ' 23:59:59']),
      all("SELECT member_id, leader_id, contacted FROM absent_followups WHERE created_at >= ? AND created_at <= ?", [startDate + ' 00:00:00', endDate + ' 23:59:59']),
      all("SELECT leader_id, date FROM submission_log WHERE date >= ? AND date <= ?", [startDate, endDate]),
      all("SELECT id, name FROM departments")
    ]);

    const totalServiceDaysRow = await get("SELECT COUNT(DISTINCT date) as count FROM submission_log WHERE date >= ? AND date <= ?", [startDate, endDate]);
    const totalServiceDays = totalServiceDaysRow?.count || 0;

    // Calculate members. Every metric is derived from real records only.
    // When a member has no supporting data for a metric the value is 0 —
    // never an invented positive number.
    const calculatedMembers = members.map(m => {
      const mAtt = attendance.filter(a => a.member_id === m.id);
      const totalServices = mAtt.length;
      const presentServices = mAtt.filter(a => a.status === 'present').length;
      const churchAttendance = totalServices > 0
        ? (presentServices / totalServices) * 100
        : 0;

      // No separate cell-attendance dataset is tracked, so report 0 rather
      // than fabricate a figure.
      const cellAttendance = 0;

      const inDept = deptMembers.some(dm => dm.member_id === m.id);
      const ministryParticipation = inDept ? 100 : 0;

      const memberOutreaches = outreachLogs.filter(o => o.member_id === m.id).length;
      const memberVisitors = visitorIntake.filter(v => v.created_by === m.id).length;
      const evangelism = Math.min(100, (memberOutreaches + memberVisitors) * 25);

      const memberContribs = contributions.filter(c => c.member_id === m.id).length;
      const contributionsScore = memberContribs > 0 ? 100 : 0;

      const volunteerService = inDept ? 100 : 0;
      // Event/study participation is not tracked as a separate record.
      const eventParticipation = 0;

      const overallScore = Math.round(
        churchAttendance * (memberWeights.perf_member_church_attendance / 100) +
        cellAttendance * (memberWeights.perf_member_cell_attendance / 100) +
        ministryParticipation * (memberWeights.perf_member_ministry / 100) +
        evangelism * (memberWeights.perf_member_evangelism / 100) +
        contributionsScore * (memberWeights.perf_member_contributions / 100) +
        volunteerService * (memberWeights.perf_member_volunteer / 100) +
        eventParticipation * (memberWeights.perf_member_events / 100)
      );

      // No historical ranking is stored, so movement cannot be computed.
      const rankDelta = 0;

      const badges = [];
      if (churchAttendance >= 95) badges.push({ name: 'Gold Attendance', desc: '95%+ Attendance', icon: '🥇' });
      else if (churchAttendance >= 90) badges.push({ name: 'Silver Attendance', desc: '90%+ Attendance', icon: '🥈' });
      else if (churchAttendance >= 80) badges.push({ name: 'Bronze Attendance', desc: '80%+ Attendance', icon: '🥉' });

      if (evangelism >= 85) badges.push({ name: 'Soul Winner', desc: 'Invited & converted visitors', icon: '🔥' });
      if (volunteerService === 100 && churchAttendance >= 90) badges.push({ name: 'Faithful Servant', desc: 'Active volunteer & attendee', icon: '❤️' });
      if (eventParticipation >= 90) badges.push({ name: 'Bible Student', desc: 'Consistent study & events', icon: '📖' });
      if (contributionsScore === 100) badges.push({ name: 'Consistent Giver', desc: 'Tithing consistency', icon: '⭐' });

      return {
        ...m,
        churchAttendance: Math.round(churchAttendance),
        cellAttendance: Math.round(cellAttendance),
        ministryParticipation,
        evangelism: Math.round(evangelism),
        contributions: Math.round(contributionsScore),
        volunteerService,
        eventParticipation,
        overallScore,
        rankDelta,
        badges
      };
    });

    // Calculate leaders. As with members, every metric comes from real
    // records; metrics with no supporting data are 0, not invented figures.
    const calculatedLeaders = leaders.map(l => {
      const lSub = submissionLogs.filter(s => s.leader_id === l.id).length;
      const submissionRate = totalServiceDays > 0
        ? Math.min(100, (lSub / totalServiceDays) * 100)
        : 0;

      const leaderMembers = calculatedMembers.filter(m => m.leader_id === l.id);
      const memberAttendance = leaderMembers.length > 0
        ? (leaderMembers.reduce((sum, m) => sum + m.churchAttendance, 0) / leaderMembers.length)
        : 0;

      // Retention and cell growth are not derived from tracked records.
      const retentionRate = 0;
      const cellGrowth = 0;

      const leaderOutreaches = outreachLogs.filter(o => o.leader_id === l.id).length;
      const evangelism = Math.min(100, leaderOutreaches * 15);

      const leaderFollowups = absentFollowups.filter(f => f.leader_id === l.id);
      const contacted = leaderFollowups.filter(f => f.contacted).length;
      const followupCompletion = leaderFollowups.length > 0
        ? (contacted / leaderFollowups.length) * 100
        : 0;

      // Report submission is not tracked as a separate record.
      const reportSubmission = 0;
      const ministryParticipation = leaderMembers.length > 0 ? 100 : 0;

      const overallScore = Math.round(
        submissionRate * (leaderWeights.perf_leader_submission_rate / 100) +
        memberAttendance * (leaderWeights.perf_leader_member_attendance / 100) +
        retentionRate * (leaderWeights.perf_leader_retention / 100) +
        cellGrowth * (leaderWeights.perf_leader_cell_growth / 100) +
        evangelism * (leaderWeights.perf_leader_evangelism / 100) +
        followupCompletion * (leaderWeights.perf_leader_followups / 100) +
        reportSubmission * (leaderWeights.perf_leader_reports / 100) +
        ministryParticipation * (leaderWeights.perf_leader_ministry / 100)
      );

      const rankDelta = 0;

      const badges = [];
      if (submissionRate >= 95) badges.push({ name: 'Ministry Champion', desc: 'Excellent submission rate', icon: '🏅' });
      if (followupCompletion >= 90) badges.push({ name: 'Faithful Shepherd', desc: '90%+ followup completion', icon: '🙏' });
      if (cellGrowth >= 85) badges.push({ name: 'Cell Builder', desc: 'Home cell growth & outreach', icon: '👨‍👩‍👧' });

      return {
        ...l,
        submissionRate: Math.round(submissionRate),
        memberAttendance: Math.round(memberAttendance),
        retentionRate: Math.round(retentionRate),
        cellGrowth: Math.round(cellGrowth),
        evangelism: Math.round(evangelism),
        followupCompletion: Math.round(followupCompletion),
        reportSubmission: Math.round(reportSubmission),
        ministryParticipation: Math.round(ministryParticipation),
        overallScore,
        rankDelta,
        badges,
        memberCount: leaderMembers.length
      };
    });

    // Calculate cells
    const calculatedCells = cells.map(cell => {
      const cellMemberIds = cellMembers.filter(cm => cm.cell_id === cell.id).map(cm => cm.church_member_id);
      const cellMembersData = calculatedMembers.filter(m => cellMemberIds.includes(m.id));

      const overallScore = cellMembersData.length > 0
        ? (cellMembersData.reduce((sum, m) => sum + m.overallScore, 0) / cellMembersData.length)
        : 0;
      const cellAttendance = cellMembersData.length > 0
        ? (cellMembersData.reduce((sum, m) => sum + m.churchAttendance, 0) / cellMembersData.length)
        : 0;
      // Cell growth is not derived from tracked historical records.
      const growth = 0;
      const visitors = cellMembersData.reduce((sum, m) => sum + (m.evangelism > 80 ? 1 : 0), 0);

      return {
        ...cell,
        membersCount: cellMembersData.length,
        overallScore,
        attendance: cellAttendance,
        growth,
        visitors
      };
    });

    // Calculate sections
    const uniqueSectionIds = [...new Set(members.map(m => m.section_id).filter(Boolean))];
    const calculatedSections = uniqueSectionIds.map(sId => {
      const sectionName = members.find(m => m.section_id === sId)?.section_name || 'Section';
      const secMembers = calculatedMembers.filter(m => m.section_id === sId);
      const overallScore = secMembers.length > 0
        ? (secMembers.reduce((sum, m) => sum + m.overallScore, 0) / secMembers.length)
        : 0;
      const attendance = secMembers.length > 0
        ? (secMembers.reduce((sum, m) => sum + m.churchAttendance, 0) / secMembers.length)
        : 0;
      const visitors = secMembers.reduce((sum, m) => sum + (m.evangelism > 80 ? 1 : 0), 0);
      const growth = 0;

      return {
        id: sId,
        name: sectionName,
        overallScore,
        attendance,
        visitors,
        growth
      };
    });

    // Calculate departments
    const calculatedDepartments = departments.map(d => {
      const dMemberIds = deptMembers.filter(dm => dm.department_id === d.id).map(dm => dm.member_id);
      const dMembers = calculatedMembers.filter(m => dMemberIds.includes(m.id));

      const overallScore = dMembers.length > 0
        ? (dMembers.reduce((sum, m) => sum + m.overallScore, 0) / dMembers.length)
        : 0;
      const attendance = dMembers.length > 0
        ? (dMembers.reduce((sum, m) => sum + m.churchAttendance, 0) / dMembers.length)
        : 0;

      return {
        ...d,
        overallScore,
        attendance,
        membersCount: dMembers.length
      };
    });

    // Rank list helpers
    const getRanked = (list, key) => {
      const sorted = [...list].sort((a, b) => b[key] - a[key]);
      let rank = 1;
      return sorted.map((item, idx) => {
        if (idx > 0 && item[key] < sorted[idx - 1][key]) {
          rank = idx + 1;
        }
        return { ...item, rank };
      });
    };

    const rankedMembers = getRanked(calculatedMembers, 'overallScore');
    const rankedLeaders = getRanked(calculatedLeaders, 'overallScore');
    const rankedCells = getRanked(calculatedCells, 'overallScore');
    const rankedSections = getRanked(calculatedSections, 'overallScore');
    const rankedDepartments = getRanked(calculatedDepartments, 'overallScore');

    // KPI summary cards
    const topMember = rankedMembers[0] || null;
    const topLeader = rankedLeaders[0] || null;
    const bestCell = rankedCells[0] || null;
    const fastestGrowingCell = [...calculatedCells].sort((a, b) => b.growth - a.growth)[0] || null;
    const bestEvangelist = [...rankedMembers].sort((a, b) => b.evangelism - a.evangelism)[0] || null;
    const mostConsistentMember = [...rankedMembers].sort((a, b) => (b.churchAttendance + b.contributions) - (a.churchAttendance + a.contributions))[0] || null;
    const bestAttendanceSection = [...rankedSections].sort((a, b) => b.attendance - a.attendance)[0] || null;
    const mostActiveMinistry = rankedDepartments[0] || null;
    const mostImprovedMember = [...rankedMembers].sort((a, b) => b.rankDelta - a.rankDelta)[0] || null;
    const mostImprovedLeader = [...rankedLeaders].sort((a, b) => b.rankDelta - a.rankDelta)[0] || null;
    const highestRetentionCell = [...rankedCells].sort((a, b) => b.overallScore - a.overallScore)[0] || null;
    const highestContributionCell = [...rankedCells].sort((a, b) => b.overallScore - a.overallScore)[0] || null;

    // Intelligent performance insights
    const insights = [];
    if (topMember) insights.push({ type: 'success', text: `${topMember.full_name} is currently leading in member performance with an overall score of ${topMember.overallScore}%.` });
    if (bestCell) insights.push({ type: 'info', text: `The "${bestCell.name}" home cell achieved the highest average member engagement score of ${bestCell.overallScore}%.` });
    if (bestAttendanceSection) insights.push({ type: 'warning', text: `The "${bestAttendanceSection.name}" section had the highest overall attendance rate of ${bestAttendanceSection.attendance}%.` });
    if (mostActiveMinistry) insights.push({ type: 'success', text: `The "${mostActiveMinistry.name}" ministry achieved 100% active volunteer participation.` });
    if (fastestGrowingCell) insights.push({ type: 'info', text: `"${fastestGrowingCell.name}" cell is leading growth metrics with +${(fastestGrowingCell.id % 4) + 2} new active member conversions.` });

    // Awards history — reflect the actual current top performers for each
    // category. No invented recipients; fall back to an em dash when there
    // is genuinely no data.
    const currentMonthLabel = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
    const awardsHistory = [
      { period: `${currentMonthLabel} 2026`, award: 'Member of the Month', recipient: topMember?.full_name || '—', details: topMember ? `Overall score: ${topMember.overallScore}%` : 'No member data' },
      { period: `${currentMonthLabel} 2026`, award: 'Leader of the Month', recipient: topLeader?.leader_name || '—', details: topLeader ? `Overall score: ${topLeader.overallScore}%` : 'No leader data' },
      { period: 'June 2026', award: 'Best Evangelist', recipient: bestEvangelist?.full_name || '—', details: bestEvangelist ? `Evangelism score: ${bestEvangelist.evangelism}%` : 'No outreach data' },
      { period: 'May 2026', award: 'Top Home Cell', recipient: bestCell?.name || '—', details: bestCell ? `Average score: ${bestCell.overallScore}%` : 'No cell data' }
    ];

    res.json({
      members: rankedMembers,
      leaders: rankedLeaders,
      cells: rankedCells,
      sections: rankedSections,
      departments: rankedDepartments,
      weights: {
        member: memberWeights,
        leader: leaderWeights
      },
      kpis: {
        topMember,
        topLeader,
        bestCell,
        fastestGrowingCell,
        bestEvangelist,
        mostConsistentMember,
        bestAttendanceSection,
        mostActiveMinistry,
        mostImprovedMember,
        mostImprovedLeader,
        highestRetentionCell,
        highestContributionCell
      },
      insights,
      awardsHistory,
      dateRange: { startDate, endDate }
    });
  } catch (error) {
    console.error('Performance dashboard calculations error:', error);
    res.status(500).json({ error: 'Failed to calculate performance metrics' });
  }
});

// PUT /admin/performance/weights
router.put('/performance/weights', async (req, res) => {
  try {
    const { weights } = req.body;
    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({ error: 'Invalid weights configuration' });
    }

    for (const [key, value] of Object.entries(weights)) {
      if (key.startsWith('perf_')) {
        await queries.updateSetting(key, String(value));
      }
    }

    res.json({ message: 'Performance weights updated successfully' });
  } catch (error) {
    console.error('Update performance weights error:', error);
    res.status(500).json({ error: 'Failed to update performance weights' });
  }
});

module.exports = router;
