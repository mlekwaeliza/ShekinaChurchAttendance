const express = require('express');
const { queries, run, get, all, transaction } = require('../database');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);

// Allow admins or users with is_new_member_leader flag
router.use((req, res, next) => {
  if (req.session.user?.role === 'admin' || req.session.user?.is_new_member_leader) {
    return next();
  }
  res.status(403).json({ error: 'Insufficient permissions' });
});

// ── New Members CRUD ────────────────────────────────────────────────────

router.get('/new-members', async (req, res) => {
  try {
    const status = req.query.status || 'probation';
    const members = await queries.getNewMembers(status);
    res.json(members);
  } catch (err) {
    console.error('Error fetching new members:', err);
    res.status(500).json({ error: 'Failed to fetch new members' });
  }
});

router.get('/new-members/:id', async (req, res) => {
  try {
    const member = await queries.getNewMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: 'New member not found' });
    res.json(member);
  } catch (err) {
    console.error('Error fetching new member:', err);
    res.status(500).json({ error: 'Failed to fetch new member' });
  }
});

router.post('/new-members', async (req, res) => {
  try {
    const { full_name, phone, email, address, date_joined, decision_type, mentor_id, notes } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Full name is required' });
    const result = await queries.createNewMember({
      full_name, phone, email, address,
      date_joined: date_joined || new Date().toISOString().split('T')[0],
      decision_type, added_by: req.session.userId, mentor_id, notes
    });
    res.status(201).json({ id: result.lastID || result.id, message: 'New member added' });
  } catch (err) {
    console.error('Error creating new member:', err);
    res.status(500).json({ error: 'Failed to create new member' });
  }
});

router.put('/new-members/:id', async (req, res) => {
  try {
    const { full_name, phone, email, address, date_joined, decision_type, mentor_id, notes } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Full name is required' });
    await queries.updateNewMember(req.params.id, {
      full_name, phone, email, address, date_joined, decision_type, mentor_id, notes
    });
    res.json({ message: 'New member updated' });
  } catch (err) {
    console.error('Error updating new member:', err);
    res.status(500).json({ error: 'Failed to update new member' });
  }
});

router.delete('/new-members/:id', async (req, res) => {
  try {
    await queries.deleteNewMember(req.params.id);
    res.json({ message: 'New member deleted' });
  } catch (err) {
    console.error('Error deleting new member:', err);
    res.status(500).json({ error: 'Failed to delete new member' });
  }
});

// ── Graduation ──────────────────────────────────────────────────────────

router.post('/new-members/:id/graduate', async (req, res) => {
  try {
    const { section_id } = req.body;
    if (!section_id) return res.status(400).json({ error: 'Section ID is required' });
    await queries.graduateNewMember(req.params.id, section_id, req.session.userId);
    res.json({ message: 'Member graduated' });
  } catch (err) {
    console.error('Error graduating member:', err);
    res.status(500).json({ error: 'Failed to graduate member' });
  }
});

router.post('/new-members/:id/permanent', async (req, res) => {
  try {
    await queries.makePermanent(req.params.id);
    res.json({ message: 'Member marked as permanent' });
  } catch (err) {
    console.error('Error marking permanent:', err);
    res.status(500).json({ error: 'Failed to mark as permanent' });
  }
});

// ── Attendance ──────────────────────────────────────────────────────────

router.get('/new-members/:id/attendance', async (req, res) => {
  try {
    const records = await queries.getNewMemberAttendance(req.params.id);
    res.json(records);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.post('/new-members/:id/attendance', async (req, res) => {
  try {
    const { week_start, attended, notes } = req.body;
    if (!week_start) return res.status(400).json({ error: 'Week start date is required' });
    await queries.upsertNewMemberAttendance(req.params.id, week_start, attended ? 1 : 0, notes, req.session.userId);
    res.json({ message: 'Attendance recorded' });
  } catch (err) {
    console.error('Error recording attendance:', err);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// ── Reports ─────────────────────────────────────────────────────────────

router.get('/reports/new-members', async (req, res) => {
  try {
    const { start_date, end_date, year } = req.query;
    if (year) {
      const data = await queries.getNewMembersByMonth(parseInt(year));
      return res.json(data);
    }
    if (start_date && end_date) {
      const data = await queries.getNewMembersReport(start_date, end_date);
      return res.json(data);
    }
    res.status(400).json({ error: 'Provide year or start_date/end_date' });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ── Sections (for graduation suggestion) ────────────────────────────────

router.get('/sections/least-members', async (req, res) => {
  try {
    const section = await queries.getSectionWithLeastMembers();
    res.json(section);
  } catch (err) {
    console.error('Error fetching section:', err);
    res.status(500).json({ error: 'Failed to fetch section' });
  }
});

router.get('/sections', async (req, res) => {
  try {
    const sections = await queries.getAllSections();
    res.json(sections);
  } catch (err) {
    console.error('Error fetching sections:', err);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

module.exports = router;
