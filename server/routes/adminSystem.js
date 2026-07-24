const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { queries, db, all, get } = require('../database');
const { isAuthenticated, requireRole, validateDate } = require('../middleware/auth');
const { yearEquals, weekEquals, timeToSeconds } = require('../utils/sqlDialect');
const { withCache } = require('../utils/cache');



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

    const rows = await all(`
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
    `, params);

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

    const rows = await all(`
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
            END) AS submitted_count,
            AVG(CASE
              WHEN sl.created_at IS NOT NULL
              THEN ${timeToSeconds('sl.created_at')}
              ELSE 86399
            END) AS avg_submission_seconds
          FROM leaders  l
          JOIN users    u ON l.user_id    = u.id
          JOIN sections s ON l.section_id = s.id
          LEFT JOIN submission_log sl ON sl.leader_id = l.id
          GROUP BY l.id, u.full_name, s.name
        )
        SELECT
          id, leader_name, section_name,
          total_service_days, submitted_count,
          avg_submission_seconds,
          CASE
            WHEN total_service_days > 0
            THEN ROUND(${String('submitted_count * 100.0 / total_service_days')} , 1)
            ELSE 0
          END AS submission_rate
        FROM leader_stats
    `, params);

    const processed = rows.map((row) => {
      const avgSec = row.avg_submission_seconds;
      let speedScore = 0;
      let avgSubmissionTime = '—';

      if (avgSec !== null && avgSec < 86399) {
        // 11:00 AM (39600s) -> 100 points
        // 02:00 PM (50400s) -> 0 points
        // Scale linearly in between
        speedScore = Math.max(0, Math.min(100, Math.round(100 - ((avgSec - 39600) / (50400 - 39600)) * 100)));

        const hours = Math.floor(avgSec / 3600);
        const minutes = Math.floor((avgSec % 3600) / 60);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        const displayMinutes = String(minutes).padStart(2, '0');
        avgSubmissionTime = `${String(displayHours).padStart(2, '0')}:${displayMinutes} ${ampm}`;
      }

      // Combine consistency (70%) and submission speed (30%)
      const overallScore = Math.round((row.submission_rate * 0.7) + (speedScore * 0.3));

      return {
        ...row,
        speedScore,
        avgSubmissionTime,
        overallScore
      };
    });

    // Sort by overallScore DESC, submission_rate DESC
    processed.sort((a, b) => b.overallScore - a.overallScore || b.submission_rate - a.submission_rate);

    // Dense ranking — ties share the same rank
    let rank = 1;
    const ranked = processed.map((row, idx) => {
      if (idx > 0 && row.overallScore < processed[idx - 1].overallScore) {
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
    const services = await withCache('admin-service-types', 600000, () => queries.getAllServiceTypes());
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