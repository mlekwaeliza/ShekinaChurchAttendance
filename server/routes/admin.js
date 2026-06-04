const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { queries, run, get, all, db, transaction } = require('../database');
const { isAuthenticated, requireRole, validateDate } = require('../middleware/auth');
const { addDays, formatLocalDate } = require('../utils/date');
const { escapeCsvValue, toCsvRow } = require('../utils/csv');
const { yearEquals, weekEquals } = require('../utils/sqlDialect');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv' && !file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
});

// Apply authentication and admin role check to all routes
router.use(isAuthenticated);
router.use(requireRole(['admin']));

const allowedPriorities = new Set(['normal', 'important', 'urgent']);
const allowedFollowUpTypes = new Set(['Member', 'Visitor']);

const parseLeaderIds = (value) => Array.isArray(value)
  ? value.map((id) => Number(id)).filter((id) => Number.isInteger(id))
  : [];

const normalizePersonKey = (name, phone = '') => {
  const normalizedName = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  return `${normalizedName}|${normalizedPhone}`;
};

async function syncChurchMemberHomeCell(memberId, cellId, userId) {
  const parsedMemberId = Number(memberId);
  const parsedCellId = cellId ? Number(cellId) : null;
  if (!Number.isInteger(parsedMemberId)) return;

  if (!Number.isInteger(parsedCellId)) {
    await run(
      'UPDATE home_cell_members SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE church_member_id = ? AND is_active = 1',
      [parsedMemberId]
    );
    return;
  }

  const member = await get('SELECT id, membership_id, full_name, phone, email, address FROM members WHERE id = ? AND is_active = 1', [parsedMemberId]);
  if (!member) return;

  const cell = await get('SELECT id FROM home_cells WHERE id = ? AND is_active = 1', [parsedCellId]);
  if (!cell) {
    const error = new Error('Selected home cell does not exist');
    error.statusCode = 400;
    throw error;
  }

  const duplicate = await get(`
    SELECT id, full_name
    FROM home_cell_members
    WHERE church_member_id = ? AND is_active = 1 AND cell_id != ?
  `, [parsedMemberId, parsedCellId]);
  if (duplicate) {
    const error = new Error(`${duplicate.full_name} is already assigned to another home cell`);
    error.statusCode = 400;
    throw error;
  }

  const active = await get('SELECT id FROM home_cell_members WHERE church_member_id = ? AND is_active = 1', [parsedMemberId]);
  const duplicateKey = `member:${parsedMemberId}`;
  if (active) {
    await run(`
      UPDATE home_cell_members
      SET cell_id = ?, full_name = ?, phone = ?, email = ?, address = ?, duplicate_key = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [parsedCellId, member.full_name, member.phone || null, member.email || null, member.address || null, duplicateKey, active.id]);
    return;
  }

  await run(`
    INSERT INTO home_cell_members
      (cell_id, church_member_id, full_name, phone, email, address, duplicate_key, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    parsedCellId,
    parsedMemberId,
    member.full_name,
    member.phone || null,
    member.email || null,
    member.address || null,
    duplicateKey,
    userId || null
  ]);
}

// Helper for date calculations
function getISOWeekRange(weekStr) {
  const parts = weekStr.split('-W');
  const year = parseInt(parts[0]);
  const week = parseInt(parts[1]);
  
  // Find the first Thursday of the year
  const firstThursday = new Date(year, 0, 4);
  const day = firstThursday.getDay() || 7;
  firstThursday.setDate(firstThursday.getDate() - day + 4);
  
  // Find the start of the requested week
  const weekStart = new Date(firstThursday);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7 - 3);
  
  // Format as YYYY-MM-DD
  const formatDate = formatLocalDate;
  
  const start = formatDate(weekStart);
  const endD = new Date(weekStart);
  endD.setDate(endD.getDate() + 6);
  const end = formatDate(endD);
  
  return { start, end };
}

function getISOWeekString(dateValue) {
  const date = new Date(`${formatLocalDate(new Date(dateValue))}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

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

// --- Home Cells ---
router.get('/home-cells', async (req, res) => {
  try {
    const cells = await all(`
      SELECT hc.*, COALESCE(COUNT(DISTINCT hcm.id), 0) AS member_count
      FROM home_cells hc
      LEFT JOIN home_cell_members hcm ON hcm.cell_id = hc.id AND hcm.is_active = 1
      WHERE hc.is_active = 1
      GROUP BY hc.id, hc.name, hc.cell_number, hc.is_active, hc.created_at
      ORDER BY hc.cell_number
    `);

    const leaders = await all(`
      SELECT hcl.cell_id, l.id AS leader_id, u.full_name, s.name AS section_name
      FROM home_cell_leaders hcl
      JOIN leaders l ON l.id = hcl.leader_id
      JOIN users u ON u.id = l.user_id
      JOIN sections s ON s.id = l.section_id
      WHERE l.is_active = 1
      ORDER BY u.full_name
    `);

    const members = await all(`
      SELECT
        hcm.*,
        hc.name AS cell_name,
        m.membership_id AS church_membership_id,
        s.name AS church_section_name,
        u.full_name AS church_leader_name
      FROM home_cell_members hcm
      JOIN home_cells hc ON hc.id = hcm.cell_id
      LEFT JOIN members m ON m.id = hcm.church_member_id
      LEFT JOIN sections s ON s.id = m.section_id
      LEFT JOIN leaders l ON l.id = m.leader_id
      LEFT JOIN users u ON u.id = l.user_id
      WHERE hcm.is_active = 1
      ORDER BY hc.cell_number, hcm.full_name
    `);

    res.json(cells.map((cell) => ({
      ...cell,
      leaders: leaders.filter((leader) => Number(leader.cell_id) === Number(cell.id)),
      members: members.filter((member) => Number(member.cell_id) === Number(cell.id))
    })));
  } catch (error) {
    console.error('Fetch home cells error:', error);
    res.status(500).json({ error: 'Failed to fetch home cells' });
  }
});

router.post('/home-cells', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Home cell name is required' });
    }

    const nextNumberRow = await get('SELECT COALESCE(MAX(cell_number), 0) + 1 AS next_number FROM home_cells');
    const cellNumber = Number(req.body.cell_number) || Number(nextNumberRow?.next_number || 1);
    const existing = await get(
      'SELECT id FROM home_cells WHERE LOWER(name) = LOWER(?) OR cell_number = ?',
      [name, cellNumber]
    );
    if (existing) {
      return res.status(400).json({ error: 'A home cell with that name or number already exists' });
    }

    const result = await run(
      'INSERT INTO home_cells (name, cell_number, is_active) VALUES (?, ?, 1)',
      [name, cellNumber]
    );
    res.status(201).json({ id: result.lastID, message: 'Home cell created' });
  } catch (error) {
    console.error('Create home cell error:', error);
    res.status(500).json({ error: 'Failed to create home cell' });
  }
});

router.put('/home-cells/:id/leaders', async (req, res) => {
  try {
    const cellId = Number(req.params.id);
    const leaderIds = parseLeaderIds(req.body.leader_ids);
    if (!Number.isInteger(cellId)) {
      return res.status(400).json({ error: 'Invalid home cell' });
    }

    const cell = await get('SELECT id FROM home_cells WHERE id = ? AND is_active = 1', [cellId]);
    if (!cell) {
      return res.status(404).json({ error: 'Home cell not found' });
    }

    const validLeaderIds = [];
    for (const leaderId of leaderIds) {
      const leader = await get('SELECT id FROM leaders WHERE id = ? AND is_active = 1', [leaderId]);
      if (leader) validLeaderIds.push(leaderId);
    }

    await transaction(async (tx) => {
      await tx.run('DELETE FROM home_cell_leaders WHERE cell_id = ?', [cellId]);
      for (const leaderId of validLeaderIds) {
        await tx.run('INSERT INTO home_cell_leaders (cell_id, leader_id) VALUES (?, ?)', [cellId, leaderId]);
      }
    });

    res.json({ message: 'Home cell leaders updated' });
  } catch (error) {
    console.error('Update home cell leaders error:', error);
    res.status(500).json({ error: 'Failed to update home cell leaders' });
  }
});

router.post('/home-cell-members', async (req, res) => {
  try {
    const cellId = Number(req.body.cell_id);
    const churchMembershipId = String(req.body.membership_id || '').trim();
    let fullName = String(req.body.full_name || '').trim();
    const phone = req.body.phone || null;

    if (!Number.isInteger(cellId)) {
      return res.status(400).json({ error: 'Home cell is required' });
    }

    const cell = await get('SELECT id FROM home_cells WHERE id = ? AND is_active = 1', [cellId]);
    if (!cell) {
      return res.status(404).json({ error: 'Home cell not found' });
    }

    let churchMember = null;
    if (churchMembershipId) {
      churchMember = await queries.getMemberByMembershipId(churchMembershipId);
      if (!churchMember) {
        return res.status(400).json({ error: 'Church member ID was not found' });
      }
      fullName = fullName || churchMember.full_name;
    }

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const duplicateKey = churchMember
      ? `member:${churchMember.id}`
      : `person:${normalizePersonKey(fullName, phone)}`;

    const duplicate = await get(`
      SELECT id, full_name
      FROM home_cell_members
      WHERE is_active = 1
        AND (duplicate_key = ? OR (? IS NOT NULL AND church_member_id = ?))
    `, [duplicateKey, churchMember?.id || null, churchMember?.id || null]);
    if (duplicate) {
      return res.status(400).json({ error: `${duplicate.full_name} is already registered in a home cell` });
    }

    await run(`
      INSERT INTO home_cell_members
        (cell_id, church_member_id, full_name, phone, email, address, duplicate_key, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cellId,
      churchMember?.id || null,
      fullName,
      phone || churchMember?.phone || null,
      req.body.email || churchMember?.email || null,
      req.body.address || churchMember?.address || null,
      duplicateKey,
      req.session.userId
    ]);

    res.status(201).json({ message: 'Home cell member assigned' });
  } catch (error) {
    console.error('Create admin home cell member error:', error);
    res.status(500).json({ error: 'Failed to assign home cell member' });
  }
});

router.delete('/home-cell-members/:id', async (req, res) => {
  try {
    await run('UPDATE home_cell_members SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ message: 'Home cell member removed' });
  } catch (error) {
    console.error('Remove admin home cell member error:', error);
    res.status(500).json({ error: 'Failed to remove home cell member' });
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

// GET all sections
router.get('/sections', async (req, res) => {
  try {
    const sections = await queries.getAllSections();
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// POST create section
router.post('/sections', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Section name required' });
    }
    await queries.createSection(name);
    res.json({ message: 'Section created' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Section already exists' });
    }
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// PUT update section
router.put('/sections/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const { id } = req.params;
    if (!name) {
      return res.status(400).json({ error: 'Section name required' });
    }
    await queries.updateSection(id, name);
    res.json({ message: 'Section updated successfully' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Section name already exists' });
    }
    res.status(500).json({ error: 'Failed to update section' });
  }
});

// DELETE section
router.delete('/sections/:id', async (req, res) => {
  try {
    await queries.deleteSection(req.params.id);
    res.json({ message: 'Section deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// GET all members (with optional filters)
router.get('/members', async (req, res) => {
  try {
    const { section_id, leader_id, membership_id } = req.query;

    if (membership_id) {
      const member = await queries.getMemberByMembershipId(membership_id);
      return res.json(member ? [member] : []);
    }

    let members;
    if (section_id) {
      members = await queries.getMembersBySection(section_id);
    } else if (leader_id) {
      const membersByLeader = await queries.getMembersByLeader(leader_id);
      members = membersByLeader.map(m => ({
        ...m,
        section_name: m.section_name || 'Unknown'
      }));
    } else {
      members = await queries.getAllMembers();
    }
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// PUT bulk-update members. This must be registered before /members/:id.
router.put('/members/bulk-update', async (req, res) => {
  try {
    const { member_ids, section_id, leader_id } = req.body;
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({ error: 'member_ids array required' });
    }
    if (member_ids.length > 500) {
      return res.status(400).json({ error: 'Cannot update more than 500 members at once' });
    }

    const sectionId = Number(section_id);
    const leaderId = Number(leader_id);
    const memberIds = member_ids.map((id) => Number(id));
    if (!Number.isInteger(sectionId) || !Number.isInteger(leaderId) || memberIds.some((id) => !Number.isInteger(id))) {
      return res.status(400).json({ error: 'Invalid section, leader, or member selection' });
    }

    const leader = await get('SELECT id, section_id, user_id FROM leaders WHERE id = ?', [leaderId]);
    if (!leader || Number(leader.section_id) !== sectionId) {
      return res.status(400).json({ error: 'Leader does not belong to the selected section' });
    }

    const placeholders = memberIds.map(() => '?').join(',');
    const params = [sectionId, leaderId, ...memberIds];
    let updatedCount = 0;
    await new Promise((resolve, reject) => {
      db.run(`UPDATE members SET section_id = ?, leader_id = ? WHERE id IN (${placeholders})`, params, function (err) {
        if (err) reject(err);
        else { updatedCount = this.changes || 0; resolve(); }
      });
    });

    const userId = req.session?.userId;
    const auditPromises = [];
    for (const memberId of memberIds) {
      auditPromises.push(
        queries.createAuditEntry(userId, 'update', 'member', memberId, null, { section_id: sectionId, leader_id: leaderId }, req.ip, req.headers['user-agent'])
          .catch((e) => console.error('bulk-update audit error:', e.message))
      );
    }
    await Promise.allSettled(auditPromises);

    res.json({ message: `${updatedCount} member(s) updated` });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update members' });
  }
});

// PUT update member
router.put('/members/:id', async (req, res) => {
  try {
    const { 
      full_name, phone, email, gender, age_group, 
      date_of_birth, show_age_to_leaders, hide_from_birthday_list, 
      opt_out_services, section_id, leader_id
    } = req.body;
    const { id } = req.params;

    if (!full_name || !section_id || !leader_id) {
      return res.status(400).json({ error: 'Name, Section, and Leader are required' });
    }

    const duplicateName = await queries.findActiveMemberByName(full_name, id);
    if (duplicateName) {
      return res.status(400).json({ error: `A member named "${duplicateName.full_name}" already exists (${duplicateName.membership_id})` });
    }

    const sectionId = Number(section_id);
    const leaderId = Number(leader_id);
    if (!Number.isInteger(sectionId) || !Number.isInteger(leaderId)) {
      return res.status(400).json({ error: 'Invalid section or leader selection' });
    }

    const leader = await get('SELECT id, section_id FROM leaders WHERE id = ?', [leaderId]);
    if (!leader || Number(leader.section_id) !== sectionId) {
      return res.status(400).json({ error: 'Leader does not belong to the selected section' });
    }

    await queries.updateMember(
      full_name, phone, email, gender, age_group, 
      date_of_birth || null, show_age_to_leaders ? 1 : 0, 
      hide_from_birthday_list ? 1 : 0, 
      JSON.stringify(opt_out_services || []),
      req.body.address || null,
      sectionId,
      leaderId,
      id
    );

    await syncChurchMemberHomeCell(id, req.body.home_cell_id || null, req.session.userId);
    
    res.json({ message: 'Member updated' });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update member' });
  }
});

// DELETE member (soft delete) — will be flagged for permanent deletion after 6 months
router.delete('/members/:id', async (req, res) => {
  try {
    await run(
      "UPDATE members SET is_active = 0, soft_deleted_at = CURRENT_TIMESTAMP, pending_deletion_at = NULL, deletion_confirmed_at = NULL, deletion_confirmed_by = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.id]
    );
    res.json({ message: 'Member deactivated; will be eligible for permanent deletion after 6 months of inactivity' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// POST bulk soft-delete (selected members) — they will be flagged for permanent deletion after 6 months
router.post('/members/bulk-soft-delete', async (req, res) => {
  const { member_ids } = req.body || {};
  if (!Array.isArray(member_ids) || member_ids.length === 0) {
    return res.status(400).json({ error: 'member_ids array required' });
  }
  const ids = member_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) {
    return res.status(400).json({ error: 'No valid member ids' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    const result = await run(
      `UPDATE members
       SET is_active = 0,
           soft_deleted_at = CURRENT_TIMESTAMP,
           pending_deletion_at = NULL,
           deletion_confirmed_at = NULL,
           deletion_confirmed_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})
         AND is_active = 1`,
      ids
    );
    res.json({
      message: `${result.changes || 0} member(s) deactivated; will be eligible for permanent deletion after 6 months of inactivity`,
      deactivated: result.changes || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk soft-delete members', details: error.message });
  }
});

// GET members pending permanent deletion (is_active=0 AND soft_deleted_at > 6 months ago)
router.get('/members/pending-deletion', async (req, res) => {
  try {
    const rows = await all(`
      SELECT m.id, m.membership_id, m.full_name, m.phone, m.email, m.soft_deleted_at,
             m.pending_deletion_at, m.deletion_confirmed_at, m.deletion_confirmed_by,
             s.name AS section_name, l.id AS leader_id, u.full_name AS leader_name,
             (SELECT COUNT(*) FROM attendance WHERE member_id = m.id) AS attendance_count,
             CAST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - m.soft_deleted_at)) / 86400 AS INTEGER) AS days_inactive
      FROM members m
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE m.is_active = 0
        AND m.soft_deleted_at IS NOT NULL
        AND m.deletion_confirmed_at IS NULL
        AND m.soft_deleted_at <= (CURRENT_TIMESTAMP - INTERVAL '6 months')
      ORDER BY m.soft_deleted_at ASC
    `);
    res.json({ count: rows.length, members: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending-deletion members', details: error.message });
  }
});

// POST confirm permanent deletion of one or more members (admin confirmation)
router.post('/members/confirm-deletion', async (req, res) => {
  const { member_ids, confirm } = req.body || {};
  if (!confirm) {
    return res.status(400).json({ error: 'Confirmation required; send { confirm: true, member_ids: [...] }' });
  }
  if (!Array.isArray(member_ids) || member_ids.length === 0) {
    return res.status(400).json({ error: 'member_ids array required' });
  }
  const ids = member_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) {
    return res.status(400).json({ error: 'No valid member ids' });
  }
  try {
    // Verify each member is actually pending deletion
    const placeholders = ids.map(() => '?').join(',');
    const pending = await all(
      `SELECT id, full_name FROM members
       WHERE id IN (${placeholders})
         AND is_active = 0
         AND soft_deleted_at IS NOT NULL
         AND deletion_confirmed_at IS NULL
         AND soft_deleted_at <= (CURRENT_TIMESTAMP - INTERVAL '6 months')`,
      ids
    );
    if (pending.length === 0) {
      return res.status(404).json({ error: 'No members match the pending-deletion criteria' });
    }

    const auditEntries = [];
    let deletedCount = 0;
    await transaction(async (tx) => {
      for (const m of pending) {
        // Audit BEFORE deleting
        auditEntries.push({
          user_id: req.session.userId,
          action: 'permanent_delete_member',
          entity_type: 'member',
          entity_id: m.id,
          details: JSON.stringify({ full_name: m.full_name, confirmed_by: req.session.user.username })
        });
        await tx.run('DELETE FROM members WHERE id = ?', [m.id]);
        deletedCount += 1;
      }
      for (const a of auditEntries) {
        await tx.run(
          'INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [a.user_id, a.action, a.entity_type, a.entity_id, a.details]
        );
      }
    });

    res.json({ message: `Permanently deleted ${deletedCount} member(s)`, deleted: deletedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm deletion', details: error.message });
  }
});

// POST restore a soft-deleted member (cancel pending deletion)
router.post('/members/restore', async (req, res) => {
  const { member_ids } = req.body || {};
  if (!Array.isArray(member_ids) || member_ids.length === 0) {
    return res.status(400).json({ error: 'member_ids array required' });
  }
  const ids = member_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) {
    return res.status(400).json({ error: 'No valid member ids' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    const result = await run(
      `UPDATE members
       SET is_active = 1,
           soft_deleted_at = NULL,
           pending_deletion_at = NULL,
           deletion_confirmed_at = NULL,
           deletion_confirmed_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})
         AND is_active = 0`,
      ids
    );
    // Audit
    try {
      const { auditLog } = require('../middleware/audit');
      await auditLog(req, 'restore_member', 'member', null, JSON.stringify({ member_ids: ids }));
    } catch (_) { /* noop */ }
    res.json({ message: `Restored ${result.changes || 0} member(s)`, restored: result.changes || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore members', details: error.message });
  }
});

// --- Leader CRUD ---
// POST create leader
router.post('/leaders', async (req, res) => {
  try {
    const { username, full_name, section_id, phone, email, is_head } = req.body;
    if (!username || !full_name || !section_id) {
      return res.status(400).json({ error: 'Username, full name, and section are required' });
    }
    const existingUser = await queries.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    // Generate a password-set token; the leader sets their own password via emailed link.
    const crypto = require('crypto');
    const setToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(setToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72h
    // Random unusable initial hash so the token is the only way to set the password.
    const placeholderHash = crypto.createHash('sha256').update(`placeholder:${setToken}`).digest('hex');
    const { lastID: userId } = await queries.createUser(username, placeholderHash, 'leader', full_name);
    await queries.createLeader(userId, section_id, phone, email, is_head ? 1 : 0);
    await run(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [tokenHash, expiresAt, userId]
    );
    const setUrl = `${String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/set-password?token=${setToken}`;
    res.json({ message: 'Leader created. Share the password-set link with the user.', userId, set_url: setUrl, expires_at: expiresAt });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Failed to create leader' });
  }
});

// PUT update leader
router.put('/leaders/:id', async (req, res) => {
  try {
    const { full_name, section_id, phone, email, is_head } = req.body;
    const { id } = req.params; // this is the leader id
    
    // First, get the leader to find the user_id
    const db = require('../database').get;
    const leader = await db('SELECT user_id FROM leaders WHERE id = ?', [id]);
    if (!leader) return res.status(404).json({ error: 'Leader not found' });
    
    // Update users table
    if (full_name) {
      const { run } = require('../database');
      await run('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name, leader.user_id]);
    }
    // Update leaders table
    await queries.updateLeaderInfo(id, section_id, phone, email, is_head ? 1 : 0);
    res.json({ message: 'Leader updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leader' });
  }
});

// DELETE leader
router.delete('/leaders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = require('../database').get;
    const leader = await db('SELECT user_id FROM leaders WHERE id = ?', [id]);
    if (!leader) return res.status(404).json({ error: 'Leader not found' });
    
    // Deleting the user will securely cascade delete the leader and members
    await queries.deleteUserAndCascade(leader.user_id);
    res.json({ message: 'Leader deleted successfully along with associated records' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete leader' });
  }
});

// POST upload CSV
router.post('/upload-csv', upload.single('csv'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file required' });
  }

  const results = {
    sectionsCreated: 0,
    leadersCreated: 0,
    membersCreated: 0,
    errors: []
  };

  const tempDir = path.join(__dirname, '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempPath = path.join(tempDir, `${uuidv4()}.csv`);

  try {
    fs.writeFileSync(tempPath, req.file.buffer);

    const rows = await new Promise((resolve, reject) => {
      const data = [];
      fs.createReadStream(tempPath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/^\ufeff/, '')
        }))
        .on('data', (row) => data.push(row))
        .on('end', () => resolve(data))
        .on('error', reject);
    });

    const sectionsMap = new Map();
    const leadersMap = new Map();
    const userPasswords = new Map();

    // Pre-populate existing sections
    const existingSections = await queries.getAllSections();
    existingSections.forEach(s => sectionsMap.set(s.name.toLowerCase().trim(), s.id));

    const getValue = (row, keys) => {
      for (const key of keys) {
        const lowerKey = key.toLowerCase();
        if (row[lowerKey] !== undefined && row[lowerKey] !== null) {
          const val = String(row[lowerKey]).trim();
          if (val) return val;
        }
      }
      return null;
    };

    if (rows.length > 0) {
      console.log('--- CSV Upload Debug ---');
      console.log('Raw Row Keys:', Object.keys(rows[0]));
      console.log('Sample Row 0:', rows[0]);
    }

    for (const row of rows) {
      try {
        const fullName = getValue(row, ['fullname', 'full_name', 'name']);
        const membershipId = getValue(row, ['membershipid', 'membership_id', 'id']);
        const sectionNameOrId = getValue(row, ['section', 'section_id', 'section_name', 'sectionname']);
        const leaderNameOrId = getValue(row, ['leadername', 'leader_id', 'leader_name', 'leader']);

        if (!membershipId || !fullName || !sectionNameOrId || !leaderNameOrId) {
          const missing = [];
          if (!fullName) missing.push('FullName');
          if (!membershipId) missing.push('MembershipID');
          if (!sectionNameOrId) missing.push('Section');
          if (!leaderNameOrId) missing.push('Leader');
          
          results.errors.push(`Row skipped: missing [${missing.join(', ')}] for ${fullName || 'unknown member'}`);
          continue;
        }

        // Resolve Section
        let sectionId;
        if (/^\d+$/.test(sectionNameOrId)) {
          sectionId = parseInt(sectionNameOrId);
        } else {
          sectionId = sectionsMap.get(sectionNameOrId.toLowerCase());
          if (!sectionId) {
            try {
              await queries.createSection(sectionNameOrId);
              const section = await queries.getSectionByName(sectionNameOrId);
              sectionId = section.id;
              sectionsMap.set(sectionNameOrId.toLowerCase(), sectionId);
              results.sectionsCreated++;
            } catch (error) {
              if (error.message.includes('UNIQUE')) {
                const section = await queries.getSectionByName(sectionNameOrId);
                sectionId = section.id;
                sectionsMap.set(sectionNameOrId.toLowerCase(), sectionId);
              } else {
                results.errors.push(`Failed to create section "${sectionNameOrId}": ${error.message}`);
                continue;
              }
            }
          }
        }

        // Resolve Leader
        let leaderId;
        if (/^\d+$/.test(leaderNameOrId)) {
          leaderId = parseInt(leaderNameOrId);
        } else {
          const leaderUsername = leaderNameOrId.toLowerCase().replace(/\s+/g, '_');
          let leaderUser = await queries.findUserByUsername(leaderUsername);

          if (!leaderUser) {
            const crypto = require('crypto');
            const setToken = crypto.randomBytes(24).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(setToken).digest('hex');
            const placeholderHash = crypto.createHash('sha256').update(`placeholder:${setToken}`).digest('hex');
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
            try {
              await queries.createUser(leaderUsername, placeholderHash, 'leader', leaderNameOrId);
              leaderUser = await queries.findUserByUsername(leaderUsername);
              await run(
                'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
                [tokenHash, expiresAt, leaderUser.id]
              );
              const setUrl = `${String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/set-password?token=${setToken}`;
              userPasswords.set(leaderUsername, { url: setUrl, expires_at: expiresAt });
              results.leadersCreated++;
            } catch (error) {
              results.errors.push(`Failed to create leader user "${leaderUsername}": ${error.message}`);
              continue;
            }
          }

          let leaderRecord = await queries.getLeaderByUserId(leaderUser.id);
          if (!leaderRecord) {
            try {
              const leaderPhone = getValue(row, ['leaderphone', 'leader_phone', 'leader_contact']);
              const leaderEmail = getValue(row, ['leaderemail', 'leader_email']);
              await queries.createLeader(leaderUser.id, sectionId, leaderPhone, leaderEmail);
              leaderRecord = await queries.getLeaderByUserId(leaderUser.id);
            } catch (error) {
              results.errors.push(`Failed to create leader record for ${leaderNameOrId}: ${error.message}`);
              continue;
            }
          }
          leaderId = leaderRecord.id;
        }

        // Check if member exists
        const existingMember = await queries.getMemberByMembershipId(membershipId);
        const memberPhone = getValue(row, ['phone', 'member_phone', 'mobile']);
        const memberEmail = getValue(row, ['email', 'member_email']);
        const memberGender = getValue(row, ['gender']);
        const memberAgeGroup = getValue(row, ['agegroup', 'age_group', 'age']);
        const address = getValue(row, ['address', 'addressline1']);

        if (existingMember) {
          const duplicateName = await queries.findActiveMemberByName(fullName, existingMember.id);
          if (duplicateName) {
            results.errors.push(`Row skipped: member name "${fullName}" already exists as ${duplicateName.membership_id}`);
            continue;
          }

          await queries.updateMember(
            fullName,
            memberPhone,
            memberEmail,
            memberGender,
            memberAgeGroup,
            existingMember.date_of_birth,
            existingMember.show_age_to_leaders,
            existingMember.hide_from_birthday_list,
            existingMember.opt_out_services,
            address || existingMember.address,
            sectionId,
            leaderId,
            existingMember.id
          );
          continue;
        }

        const duplicateName = await queries.findActiveMemberByName(fullName);
        if (duplicateName) {
          results.errors.push(`Row skipped: member name "${fullName}" already exists as ${duplicateName.membership_id}`);
          continue;
        }

        // Create new member
        try {
          const dob = getValue(row, ['dateofbirth', 'date_of_birth', 'dob']);
          await queries.createMember(
            membershipId,
            fullName,
            sectionId,
            leaderId,
            memberPhone,
            memberEmail,
            memberGender,
            memberAgeGroup,
            dob,
            0,
            0,
            '[]',
            address
          );
          results.membersCreated++;
        } catch (error) {
          results.errors.push(`Failed to create member ${membershipId}: ${error.message}`);
        }
      } catch (error) {
        results.errors.push(`Unexpected error: ${error.message}`);
      }
    }

    // Cleanup temp file
    fs.unlinkSync(tempPath);

    res.json({
      message: 'CSV uploaded successfully',
      results,
      leaderInviteLinks: userPasswords.size > 0 ? Array.from(userPasswords.entries()).map(([username, info]) => ({ username, ...info })) : null
    });
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// GET leaders list (for admin management)
router.get('/leaders', async (req, res) => {
  try {
    const leaders = await new Promise((resolve, reject) => {
      db.all(`
        SELECT l.id, l.section_id, u.username, u.full_name, s.name as section_name, l.phone, l.email, l.is_head
        FROM leaders l
        JOIN users u ON l.user_id = u.id
        JOIN sections s ON l.section_id = s.id
        ORDER BY s.name, u.full_name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(leaders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaders' });
  }
});

// POST reset leader password
router.post('/leaders/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;

    const leader = await new Promise((resolve, reject) => {
      db.get(`
        SELECT l.user_id, u.username
        FROM leaders l
        JOIN users u ON l.user_id = u.id
        WHERE l.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!leader) {
      return res.status(404).json({ error: 'Leader not found' });
    }

    // Generate a one-time reset token instead of returning the new password.
    // The admin shares the link with the user, who sets their own password.
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    await run(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [tokenHash, expiresAt, leader.user_id]
    );

    const resetUrl = `${String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/reset-password?token=${resetToken}`;

    res.json({
      message: 'Password reset link generated. Share it with the user; it expires in 1 hour.',
      username: leader.username,
      reset_url: resetUrl,
      expires_at: expiresAt
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST create a member (Admin override)
router.post('/members', async (req, res) => {
  try {
    const { 
      membership_id, full_name, section_id, leader_id, 
      phone, email, gender, age_group, 
      date_of_birth, show_age_to_leaders, hide_from_birthday_list, address 
    } = req.body;
    
    if (!membership_id || !full_name || !section_id || !leader_id) {
      return res.status(400).json({ error: 'Membership ID, Name, Section, and Leader are required' });
    }

    const existingMember = await queries.getMemberByMembershipId(membership_id);
    if (existingMember) {
      return res.status(400).json({ error: 'Membership ID already exists' });
    }

    const duplicateName = await queries.findActiveMemberByName(full_name);
    if (duplicateName) {
      return res.status(400).json({ error: `A member named "${duplicateName.full_name}" already exists (${duplicateName.membership_id})` });
    }

    const sectionId = Number(section_id);
    const leaderId = Number(leader_id);
    if (!Number.isInteger(sectionId) || !Number.isInteger(leaderId)) {
      return res.status(400).json({ error: 'Invalid section or leader selection' });
    }

    const section = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM sections WHERE id = ?', [sectionId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    if (!section) {
      return res.status(400).json({ error: 'Invalid section ID' });
    }

    const leader = await new Promise((resolve, reject) => {
      db.get('SELECT id, section_id FROM leaders WHERE id = ?', [leaderId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    if (!leader) {
      return res.status(400).json({ error: 'Invalid leader ID' });
    }
    if (Number(leader.section_id) !== sectionId) {
      return res.status(400).json({ error: 'Leader does not belong to the specified section' });
    }

    const created = await queries.createMember(
      membership_id, full_name, sectionId, leaderId, 
      phone || null, email || null, gender || null, age_group || null,
      date_of_birth || null, 
      show_age_to_leaders ? 1 : 0, 
      hide_from_birthday_list ? 1 : 0,
      JSON.stringify(req.body.opt_out_services || []),
      address || null
    );

    let memberId = created.lastID;
    if (!memberId) {
      const createdMember = await queries.getMemberByMembershipId(membership_id);
      memberId = createdMember?.id;
    }
    await syncChurchMemberHomeCell(memberId, req.body.home_cell_id || null, req.session.userId);

    res.json({ message: 'Member created successfully' });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create member' });
  }
});

// ─────────────────────────────────────────────────────────────
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

// Member CSV export
router.get('/members/export', async (req, res) => {
  try {
    const members = await all(`
      SELECT m.membership_id, m.full_name, m.phone, m.address, m.email, m.gender, m.age_group,
             s.name as section_name, u.full_name as leader_name
      FROM members m
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE m.is_active = 1
      ORDER BY s.name, m.full_name
    `);

    const headers = ['MembershipID', 'FullName', 'Phone', 'Address', 'Email', 'Gender', 'AgeGroup', 'Section', 'Leader'];
    const csvRows = [headers.map(escapeCsvValue).join(',')];
    members.forEach(row => {
      csvRows.push(toCsvRow([row.membership_id, row.full_name, row.phone, row.address, row.email, row.gender, row.age_group, row.section_name, row.leader_name]));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="members-${formatLocalDate()}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    console.error('Member export error:', error);
    res.status(500).json({ error: 'Failed to export members' });
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
