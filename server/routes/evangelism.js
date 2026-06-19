const express = require('express');
const { queries, run, get, all } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(isAuthenticated);
router.use(requireRole(['admin', 'pastor']));

// ── Stats ────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await queries.getEvangelismStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching evangelism stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/trend', async (req, res) => {
  try {
    const trend = await queries.getSoulWinningTrend();
    res.json(trend);
  } catch (err) {
    console.error('Error fetching trend:', err);
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

router.get('/funnel', async (req, res) => {
  try {
    const funnel = await queries.getConversionFunnel();
    res.json(funnel);
  } catch (err) {
    console.error('Error fetching funnel:', err);
    res.status(500).json({ error: 'Failed to fetch funnel' });
  }
});

router.get('/report/monthly', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await queries.getEvangelismMonthlyReport(year);
    res.json(data);
  } catch (err) {
    console.error('Error fetching monthly report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

router.get('/report/annual', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await queries.getEvangelismAnnualStats(year);
    res.json(data);
  } catch (err) {
    console.error('Error fetching annual report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// ── Outreach Events ─────────────────────────────────────────────────
router.get('/outreach-events', async (req, res) => {
  try {
    const events = await queries.getOutreachEvents(req.query);
    res.json(events);
  } catch (err) {
    console.error('Error fetching outreach events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/outreach-events', async (req, res) => {
  try {
    const result = await queries.createOutreachEvent({
      ...req.body,
      created_by: req.session.userId
    });
    res.status(201).json({ id: result.lastID || result.id, message: 'Event created' });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/outreach-events/:id', async (req, res) => {
  try {
    await queries.updateOutreachEvent(req.params.id, req.body);
    res.json({ message: 'Event updated' });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/outreach-events/:id', async (req, res) => {
  try {
    await queries.deleteOutreachEvent(req.params.id);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ── Souls Won ───────────────────────────────────────────────────────
router.get('/souls-won', async (req, res) => {
  try {
    const souls = await queries.getSoulsWon(req.query);
    res.json(souls);
  } catch (err) {
    console.error('Error fetching souls won:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

router.get('/souls-won/:id', async (req, res) => {
  try {
    const soul = await queries.getSoulWonById(req.params.id);
    if (!soul) return res.status(404).json({ error: 'Record not found' });
    res.json(soul);
  } catch (err) {
    console.error('Error fetching soul won:', err);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

router.post('/souls-won', async (req, res) => {
  try {
    const result = await queries.createSoulWon({
      ...req.body,
      created_by: req.session.userId
    });
    res.status(201).json({ id: result.lastID || result.id, message: 'Record created' });
  } catch (err) {
    console.error('Error creating soul won:', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

router.put('/souls-won/:id', async (req, res) => {
  try {
    await queries.updateSoulWon(req.params.id, req.body);
    res.json({ message: 'Record updated' });
  } catch (err) {
    console.error('Error updating soul won:', err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

router.delete('/souls-won/:id', async (req, res) => {
  try {
    await queries.deleteSoulWon(req.params.id);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    console.error('Error deleting soul won:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// ── Follow-Ups ──────────────────────────────────────────────────────
router.get('/follow-ups/:soulWonId', async (req, res) => {
  try {
    const followUps = await queries.getFollowUps(req.params.soulWonId);
    res.json(followUps);
  } catch (err) {
    console.error('Error fetching follow-ups:', err);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

router.post('/follow-ups', async (req, res) => {
  try {
    const result = await queries.createFollowUp({
      ...req.body,
      created_by: req.session.userId
    });
    res.status(201).json({ id: result.lastID || result.id, message: 'Follow-up created' });
  } catch (err) {
    console.error('Error creating follow-up:', err);
    res.status(500).json({ error: 'Failed to create follow-up' });
  }
});

router.put('/follow-ups/:id', async (req, res) => {
  try {
    await queries.updateFollowUp(req.params.id, req.body);
    res.json({ message: 'Follow-up updated' });
  } catch (err) {
    console.error('Error updating follow-up:', err);
    res.status(500).json({ error: 'Failed to update follow-up' });
  }
});

// ── Evangelism Team ─────────────────────────────────────────────────
router.get('/team', async (req, res) => {
  try {
    const team = await queries.getEvangelismTeam();
    res.json(team);
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.post('/team', async (req, res) => {
  try {
    const result = await queries.createEvangelismTeamMember({
      ...req.body,
      created_by: req.session.userId
    });
    res.status(201).json({ id: result.lastID || result.id, message: 'Member added' });
  } catch (err) {
    console.error('Error creating team member:', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.put('/team/:id', async (req, res) => {
  try {
    await queries.updateEvangelismTeamMember(req.params.id, req.body);
    res.json({ message: 'Member updated' });
  } catch (err) {
    console.error('Error updating team member:', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

router.delete('/team/:id', async (req, res) => {
  try {
    await queries.deleteEvangelismTeamMember(req.params.id);
    res.json({ message: 'Member deleted' });
  } catch (err) {
    console.error('Error deleting team member:', err);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// ── Baptism Tracking ────────────────────────────────────────────────
router.get('/baptism', async (req, res) => {
  try {
    const records = await queries.getBaptismTracking();
    res.json(records);
  } catch (err) {
    console.error('Error fetching baptism records:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

router.post('/baptism', async (req, res) => {
  try {
    const result = await queries.createBaptismTracking({
      ...req.body,
      created_by: req.session.userId
    });
    res.status(201).json({ id: result.lastID || result.id, message: 'Record created' });
  } catch (err) {
    console.error('Error creating baptism record:', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

router.put('/baptism/:id', async (req, res) => {
  try {
    await queries.updateBaptismTracking(req.params.id, req.body);
    res.json({ message: 'Record updated' });
  } catch (err) {
    console.error('Error updating baptism record:', err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

router.delete('/baptism/:id', async (req, res) => {
  try {
    await queries.deleteBaptismTracking(req.params.id);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    console.error('Error deleting baptism record:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

module.exports = router;
