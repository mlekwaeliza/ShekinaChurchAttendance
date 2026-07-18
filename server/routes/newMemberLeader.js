const express = require('express');
const { queries, run, get, all, transaction } = require('../database');
const { isAuthenticated } = require('../middleware/auth');
const { addDays, formatLocalDate } = require('../utils/date');

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
    const { full_name, phone, email, address, date_joined, decision_type, marital_status, date_of_birth, occupation, invitation_source, mentor_id, notes } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Full name is required' });
    const result = await queries.createNewMember({
      full_name, phone, email, address,
      date_joined: date_joined || new Date().toISOString().split('T')[0],
      decision_type, marital_status, date_of_birth, occupation, invitation_source,
      added_by: req.session.userId, mentor_id, notes
    });
    res.status(201).json({ id: result.lastID || result.id, message: 'New member added' });
  } catch (err) {
    console.error('Error creating new member:', err);
    res.status(500).json({ error: 'Failed to create new member' });
  }
});

router.put('/new-members/:id', async (req, res) => {
  try {
    const { full_name, phone, email, address, date_joined, decision_type, marital_status, date_of_birth, occupation, invitation_source, mentor_id, notes } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Full name is required' });
    await queries.updateNewMember(req.params.id, {
      full_name, phone, email, address, date_joined, decision_type, marital_status, date_of_birth, occupation, invitation_source, mentor_id, notes
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

router.get('/attendance/:weekStart', async (req, res) => {
  try {
    const records = await queries.getNewMembersAttendanceByWeek(req.params.weekStart);
    res.json(records);
  } catch (err) {
    console.error('Error fetching week attendance:', err);
    res.status(500).json({ error: 'Failed to fetch week attendance' });
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

// ── Assimilation Pipeline ─────────────────────────────────────────────────

// List all pipeline members or filter by stage
router.get('/pipeline', async (req, res) => {
  try {
    const stage = req.query.stage || null;
    const members = await queries.getPipelineMembers(stage);
    res.json(members);
  } catch (err) {
    console.error('Error fetching pipeline:', err);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// Move member to a new pipeline stage
router.post('/pipeline/:id/move', async (req, res) => {
  try {
    const { stage, notes } = req.body;
    if (!stage) return res.status(400).json({ error: 'Stage is required' });
    if (!queries.PIPELINE_STAGES.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }
    await queries.updatePipelineStage(req.params.id, stage, req.session.userId);
    await queries.recordStageTransition(req.params.id, stage, notes, req.session.userId);
    res.json({ message: 'Member moved to ' + stage });
  } catch (err) {
    console.error('Error moving pipeline member:', err);
    res.status(500).json({ error: 'Failed to move member' });
  }
});

// Get member journey timeline
router.get('/pipeline/:id/journey', async (req, res) => {
  try {
    const journey = await queries.getMemberJourney(req.params.id);
    res.json(journey);
  } catch (err) {
    console.error('Error fetching journey:', err);
    res.status(500).json({ error: 'Failed to fetch journey' });
  }
});

// Add follow-up record
router.post('/pipeline/:id/followup', async (req, res) => {
  try {
    const { followup_type, notes, next_followup_date } = req.body;
    if (!followup_type) return res.status(400).json({ error: 'Follow-up type is required' });
    await queries.addFollowup(req.params.id, followup_type, notes, next_followup_date, req.session.userId);
    res.status(201).json({ message: 'Follow-up recorded' });
  } catch (err) {
    console.error('Error adding follow-up:', err);
    res.status(500).json({ error: 'Failed to add follow-up' });
  }
});

// Get follow-up history
router.get('/pipeline/:id/followups', async (req, res) => {
  try {
    const followups = await queries.getMemberFollowups(req.params.id);
    res.json(followups);
  } catch (err) {
    console.error('Error fetching follow-ups:', err);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

// Dashboard stats
router.get('/pipeline/stats', async (req, res) => {
  try {
    const stageCounts = await queries.getPipelineDashboardStats();
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const { getNewMembersReport, getNewMembersByMonth } = queries;
    const stageMap = {};
    stageCounts.forEach(s => { stageMap[s.pipeline_stage] = Number(s.count); });
    const totalInPipeline = Object.values(stageMap).reduce((a, b) => a + b, 0);
    const receivedThisMonth = await all(`SELECT COUNT(*) as c FROM new_members WHERE pipeline_stage = 'received' AND date_joined >= ?`, [monthStart]);
    const orientationScheduled = stageMap['orientation_scheduled'] || 0;
    const orientationInProgress = stageMap['orientation_in_progress'] || 0;
    const orientationCompleted = stageMap['orientation_completed'] || 0;
    const totalOrientation = orientationScheduled + orientationInProgress + orientationCompleted;
    const completionRate = totalOrientation > 0 ? Math.round((orientationCompleted / (totalOrientation + (stageMap['home_cell_assigned'] || 0) + (stageMap['section_assigned'] || 0) + (stageMap['mentor_assigned'] || 0) + (stageMap['ministry_placement'] || 0) + (stageMap['graduation_review'] || 0) + (stageMap['permanent'] || 0)) * 100)) : 0;
    const awaitCell = stageMap['orientation_completed'] || 0;
    const awaitMentor = stageMap['section_assigned'] || 0;
    const readyGraduation = stageMap['ministry_placement'] || 0;
    const permanent = stageMap['permanent'] || 0;
    const graduationRate = totalInPipeline > 0 ? Math.round((permanent / totalInPipeline) * 100) : 0;
    res.json({
      stageCounts: stageMap,
      totalInPipeline,
      receivedThisMonth: Number(receivedThisMonth?.[0]?.c || 0),
      orientationScheduled,
      orientationCompletionRate: completionRate,
      awaitCellAssignment: awaitCell,
      awaitMentor: awaitMentor,
      readyGraduation: readyGraduation,
      graduationRate,
      permanentMembers: permanent,
    });
  } catch (err) {
    console.error('Error fetching pipeline stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Today's ministry tasks
router.get('/pipeline/tasks', async (req, res) => {
  try {
    const tasks = await queries.getPipelineTasks();
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Assimilation funnel
router.get('/pipeline/funnel', async (req, res) => {
  try {
    const funnel = await queries.getAssimilationFunnel();
    res.json(funnel);
  } catch (err) {
    console.error('Error fetching funnel:', err);
    res.status(500).json({ error: 'Failed to fetch funnel' });
  }
});

// Transfer baptized souls from evangelism to new members
router.post('/pipeline/transfer-baptized', async (req, res) => {
  try {
    const { soul_won_id } = req.body;
    if (soul_won_id) {
      const result = await queries.transferBaptizedToNewMembers(soul_won_id, req.session.userId);
      return res.status(201).json(result);
    }
    // Bulk transfer all baptized awaiting
    const awaiting = await queries.getBaptizedAwaitingTransfer();
    const results = [];
    for (const soul of awaiting) {
      try {
        const r = await queries.transferBaptizedToNewMembers(soul.id, req.session.userId);
        results.push(r);
      } catch (e) { /* skip duplicates */ }
    }
    res.status(201).json({ transferred: results.length, members: results });
  } catch (err) {
    console.error('Error transferring baptized:', err);
    res.status(500).json({ error: 'Failed to transfer baptized members' });
  }
});

// List baptized souls awaiting transfer
router.get('/pipeline/awaiting-transfer', async (req, res) => {
  try {
    const awaiting = await queries.getBaptizedAwaitingTransfer();
    res.json(awaiting);
  } catch (err) {
    console.error('Error fetching awaiting transfer:', err);
    res.status(500).json({ error: 'Failed to fetch awaiting transfer' });
  }
});

module.exports = router;
