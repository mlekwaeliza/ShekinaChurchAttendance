const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');

// ─── Enhanced Audit Trail ──────────────────────────────────────────────────────────
// Tracks user activity, login/logout, and provides user activity dashboard

// GET /api/admin/audit-trail - Get audit trail with filtering
router.get('/', async (req, res) => {
  try {
    const { user_id, action, entity_type, start_date, end_date, limit = 100, offset = 0 } = req.query;
    
    let sql = `
      SELECT al.*, u.username, u.full_name, u.role
      FROM audit_log al 
      LEFT JOIN users u ON al.user_id = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      sql += ' AND al.user_id = ?';
      params.push(user_id);
    }
    if (action) {
      sql += ' AND al.action = ?';
      params.push(action);
    }
    if (entity_type) {
      sql += ' AND al.entity_type = ?';
      params.push(entity_type);
    }
    if (start_date) {
      sql += ' AND al.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND al.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = await all(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM audit_log WHERE 1=1';
    const countParams = [];
    if (user_id) { countSql += ' AND user_id = ?'; countParams.push(user_id); }
    if (action) { countSql += ' AND action = ?'; countParams.push(action); }
    if (entity_type) { countSql += ' AND entity_type = ?'; countParams.push(entity_type); }
    if (start_date) { countSql += ' AND created_at >= ?'; countParams.push(start_date); }
    if (end_date) { countSql += ' AND created_at <= ?'; countParams.push(end_date + ' 23:59:59'); }
    
    const total = await get(countSql, countParams);

    res.json({
      logs,
      total: total?.total || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Audit trail error:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

// GET /api/admin/audit-trail/activity-summary - User activity summary
router.get('/activity-summary', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [totalActions, actionsByType, actionsByUser, recentActivity, dailyActivity] = await Promise.all([
      get(`
        SELECT COUNT(*) as total 
        FROM audit_log WHERE created_at >= ?
      `, [startDate]),
      all(`
        SELECT action, COUNT(*) as count 
        FROM audit_log WHERE created_at >= ?
        GROUP BY action ORDER BY count DESC
      `, [startDate]),
      all(`
        SELECT u.username, u.full_name, u.role, COUNT(*) as action_count
        FROM audit_log al JOIN users u ON al.user_id = u.id
        WHERE al.created_at >= ?
        GROUP BY al.user_id ORDER BY action_count DESC LIMIT 10
      `, [startDate]),
      all(`
        SELECT al.*, u.username, u.full_name
        FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
        WHERE al.created_at >= ?
        ORDER BY al.created_at DESC LIMIT 20
      `, [startDate]),
      all(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM audit_log WHERE created_at >= ?
        GROUP BY DATE(created_at) ORDER BY date
      `, [startDate]),
    ]);

    res.json({
      period: { days: parseInt(days), start: startDate },
      totalActions: totalActions?.total || 0,
      actionsByType,
      actionsByUser,
      recentActivity,
      dailyActivity,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Activity summary error:', error);
    res.status(500).json({ error: 'Failed to fetch activity summary' });
  }
});

// GET /api/admin/audit-trail/user/:userId - User-specific audit trail
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [user, logs, stats] = await Promise.all([
      get('SELECT id, username, full_name, role FROM users WHERE id = ?', [userId]),
      all(`
        SELECT * FROM audit_log 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [userId, parseInt(limit), parseInt(offset)]),
      get(`
        SELECT 
          COUNT(*) as total_actions,
          COUNT(DISTINCT action) as unique_actions,
          COUNT(DISTINCT entity_type) as entity_types,
          MIN(created_at) as first_action,
          MAX(created_at) as last_action
        FROM audit_log WHERE user_id = ?
      `, [userId]),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user,
      logs,
      stats: stats || {},
    });
  } catch (error) {
    console.error('User audit trail error:', error);
    res.status(500).json({ error: 'Failed to fetch user audit trail' });
  }
});

// GET /api/admin/audit-trail/entity/:entityType/:entityId - Entity-specific audit trail
router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 50 } = req.query;

    const logs = await all(`
      SELECT al.*, u.username, u.full_name
      FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = ? AND al.entity_id = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [entityType, parseInt(entityId), parseInt(limit)]);

    res.json({ logs });
  } catch (error) {
    console.error('Entity audit trail error:', error);
    res.status(500).json({ error: 'Failed to fetch entity audit trail' });
  }
});

// POST /api/admin/audit-trail - Log an action (for client-side logging)
router.post('/', async (req, res) => {
  try {
    const { action, entity_type, entity_id, old_value, new_value } = req.body;
    const user_id = req.user?.id;
    const ip_address = req.ip || req.connection?.remoteAddress;
    const user_agent = req.headers['user-agent'];

    if (!action || !entity_type) {
      return res.status(400).json({ error: 'action and entity_type are required' });
    }

    await run(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, action, entity_type, entity_id || null, old_value || null, new_value || null, ip_address, user_agent]
    );

    res.status(201).json({ message: 'Action logged' });
  } catch (error) {
    console.error('Log action error:', error);
    res.status(500).json({ error: 'Failed to log action' });
  }
});

// GET /api/admin/audit-trail/export - Export audit trail as CSV
router.get('/export', async (req, res) => {
  try {
    const { user_id, action, entity_type, start_date, end_date } = req.query;
    
    let sql = `
      SELECT al.*, u.username, u.full_name, u.role
      FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) { sql += ' AND al.user_id = ?'; params.push(user_id); }
    if (action) { sql += ' AND al.action = ?'; params.push(action); }
    if (entity_type) { sql += ' AND al.entity_type = ?'; params.push(entity_type); }
    if (start_date) { sql += ' AND al.created_at >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND al.created_at <= ?'; params.push(end_date + ' 23:59:59'); }

    sql += ' ORDER BY al.created_at DESC';

    const logs = await all(sql, params);

    if (logs.length === 0) {
      return res.status(404).json({ error: 'No audit logs found' });
    }

    // Convert to CSV
    const headers = ['Date', 'User', 'Full Name', 'Role', 'Action', 'Entity Type', 'Entity ID', 'IP Address'];
    const csvRows = [headers.join(',')];
    for (const log of logs) {
      csvRows.push([
        `"${log.created_at}"`,
        `"${log.username || ''}"`,
        `"${log.full_name || ''}"`,
        `"${log.role || ''}"`,
        `"${log.action}"`,
        `"${log.entity_type}"`,
        `"${log.entity_id || ''}"`,
        `"${log.ip_address || ''}"`,
      ].join(','));
    }

    const filename = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    console.error('Export audit trail error:', error);
    res.status(500).json({ error: 'Failed to export audit trail' });
  }
});

module.exports = router;
