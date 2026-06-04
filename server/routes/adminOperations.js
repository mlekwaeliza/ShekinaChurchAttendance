const express = require('express');
const { queries } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin']));
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

module.exports = router;
