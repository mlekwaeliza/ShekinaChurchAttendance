const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { queries, run, get, db } = require('../database');
const { isAuthenticated, requireRole, validateDate } = require('../middleware/auth');
const { addDays, formatLocalDate } = require('../utils/date');
const { inspectPackage, commitPackage, listRecentImports } = require('../utils/offlineAttendanceImport');
const {
  createServerSyncPackage,
  inspectServerSyncPackage,
  commitServerSyncPackage
} = require('../utils/serverSyncPackage');
const { yearEquals, monthEquals, weekEquals, upsertAttendanceSql } = require('../utils/sqlDialect');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply authentication and admin role check to all routes
router.use(isAuthenticated);
router.use(requireRole(['admin']));

const allowedPriorities = new Set(['normal', 'important', 'urgent']);
const allowedFollowUpTypes = new Set(['Member', 'Visitor']);

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

    const sectionId = Number(section_id);
    const leaderId = Number(leader_id);
    const memberIds = member_ids.map((id) => Number(id));
    if (!Number.isInteger(sectionId) || !Number.isInteger(leaderId) || memberIds.some((id) => !Number.isInteger(id))) {
      return res.status(400).json({ error: 'Invalid section, leader, or member selection' });
    }

    const leader = await get('SELECT id, section_id FROM leaders WHERE id = ?', [leaderId]);
    if (!leader || Number(leader.section_id) !== sectionId) {
      return res.status(400).json({ error: 'Leader does not belong to the selected section' });
    }

    const placeholders = memberIds.map(() => '?').join(',');
    const params = [sectionId, leaderId, ...memberIds];
    await new Promise((resolve, reject) => {
      db.run(`UPDATE members SET section_id = ?, leader_id = ? WHERE id IN (${placeholders})`, params, (err) => {
        if (err) reject(err); else resolve();
      });
    });

    const userId = req.session?.userId;
    for (const memberId of memberIds) {
      queries.createAuditEntry(userId, 'update', 'member', memberId, null, { section_id: sectionId, leader_id: leaderId }, req.ip, req.headers['user-agent']).catch(() => {});
    }

    res.json({ message: `${memberIds.length} member(s) updated` });
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
    
    res.json({ message: 'Member updated' });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE member
router.delete('/members/:id', async (req, res) => {
  try {
    await run('UPDATE members SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Member deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete member' });
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
    // Check if user exists
    const existingUser = await queries.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    // Default password for new leaders
    const crypto = require('crypto');
    const tempPassword = `temp_${crypto.randomBytes(8).toString('hex')}`;
    const passwordHash = bcrypt.hashSync(tempPassword, 10);
    const { lastID: userId } = await queries.createUser(username, passwordHash, 'leader', full_name);
    await queries.createLeader(userId, section_id, phone, email, is_head ? 1 : 0);
    res.json({ message: 'Leader created successfully', userId });
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
            const tempPassword = `temp_${uuidv4().substring(0, 8)}`;
            const passwordHash = bcrypt.hashSync(tempPassword, 10);
            try {
              await queries.createUser(leaderUsername, passwordHash, 'leader', leaderNameOrId);
              leaderUser = await queries.findUserByUsername(leaderUsername);
              userPasswords.set(leaderUsername, tempPassword);
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
            existingMember.id
          );
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
      tempPasswords: userPasswords.size > 0 ? Array.from(userPasswords.entries()).map(([username, password]) => ({ username, password })) : null
    });
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// GET all attendance (with filters)
router.get('/attendance', async (req, res) => {
  try {
    const { date, section_id, leader_id } = req.query;

    let query = `
      SELECT a.*, m.full_name as member_name, m.membership_id, s.name as section_name, u.full_name as leader_name
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.filterType && req.query.filterValue) {
      if (req.query.filterType === 'yearly') {
        query += ` AND ${yearEquals('a.date')}`;
        params.push(req.query.filterValue);
      } else if (req.query.filterType === 'monthly') {
        query += ` AND ${monthEquals('a.date')}`;
        params.push(req.query.filterValue);
      } else if (req.query.filterType === 'weekly') {
        const parts = req.query.filterValue.split('-W');
        query += ` AND ${weekEquals('a.date')}`;
        params.push(`${parts[0]}-${parts[1].padStart(2, '0')}`);
      }
    } else if (date) {
      query += ' AND a.date = ?';
      params.push(date);
    }
    if (section_id) {
      query += ' AND m.section_id = ?';
      params.push(section_id);
    }
    if (leader_id) {
      query += ' AND m.leader_id = ?';
      params.push(leader_id);
    }

    query += ' ORDER BY a.date DESC, m.full_name';

    const attendance = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(attendance);
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// PUT update attendance (admin override)
router.put('/attendance/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!['present', 'absent', 'excused'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await run('UPDATE attendance SET status = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    res.json({ message: 'Attendance updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// GET export attendance as CSV
router.get('/export', async (req, res) => {
  try {
    const { start_date, end_date, section_id } = req.query;

    let query = `
      SELECT
        a.date,
        st.name as service_name,
        s.name as section_name,
        u.full_name as leader_name,
        m.membership_id,
        m.full_name as member_name,
        a.status
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN service_types st ON a.service_type_id = st.id
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND a.date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND a.date <= ?';
      params.push(end_date);
    }
    if (section_id) {
      query += ' AND s.id = ?';
      params.push(section_id);
    }

    query += ' ORDER BY a.date DESC, s.name, m.full_name';

    const records = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Convert to CSV
    const headers = ['Date', 'Service', 'Section', 'Leader', 'MembershipID', 'MemberName', 'Status'];
    const csvRows = [];
    csvRows.push(headers.join(','));

    records.forEach(row => {
      const escapeCsvValue = (val) => {
        const str = String(val ?? '');
        if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
          return `"'${str}"`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const values = [
        escapeCsvValue(row.date),
        escapeCsvValue(row.service_name),
        escapeCsvValue(row.section_name),
        escapeCsvValue(row.leader_name),
        escapeCsvValue(row.membership_id),
        escapeCsvValue(row.member_name),
        escapeCsvValue(row.status)
      ];
      csvRows.push(values.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${formatLocalDate()}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
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

    // Get leader's user account with username
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

    // Generate temporary password
    const tempPassword = `temp_${uuidv4().substring(0, 8)}`;
    const passwordHash = bcrypt.hashSync(tempPassword, 10);

    // Update user password
    await run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passwordHash, leader.user_id]);

    res.json({
      message: 'Password reset successful',
      temp_password: tempPassword,
      username: leader.username
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

    await queries.createMember(
      membership_id, full_name, sectionId, leaderId, 
      phone || null, email || null, gender || null, age_group || null,
      date_of_birth || null, 
      show_age_to_leaders ? 1 : 0, 
      hide_from_birthday_list ? 1 : 0,
      JSON.stringify(req.body.opt_out_services || []),
      address || null
    );

    res.json({ message: 'Member created successfully' });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

router.post('/offline-import/preview', async (req, res) => {
  try {
    const { package: offlinePackage } = req.body;
    const { summary } = await inspectPackage(offlinePackage);
    res.json(summary);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to inspect offline package' });
  }
});

router.post('/offline-import/commit', async (req, res) => {
  try {
    const { package: offlinePackage, original_filename } = req.body;
    const summary = await commitPackage(offlinePackage, {
      source: 'admin_upload',
      importedByUserId: req.session.userId,
      originalFilename: original_filename || null
    });
    res.json({ message: 'Offline attendance processed', summary });
  } catch (error) {
    console.error('Offline import error:', error);
    res.status(400).json({ error: error.message || 'Failed to import offline package' });
  }
});

router.get('/offline-imports', async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(Number.parseInt(req.query.limit, 10) || 20, 100) : 20;
    const imports = await listRecentImports(limit);
    res.json(imports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch offline imports' });
  }
});

router.get('/sync/export', async (req, res) => {
  try {
    const syncPackage = await createServerSyncPackage({
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      serviceId: req.query.service_id || 'all'
    });
    const datePart = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="church-attendance-sync-${datePart}.json"`);
    res.json(syncPackage);
  } catch (error) {
    console.error('Sync export error:', error);
    res.status(400).json({ error: error.message || 'Failed to export sync package' });
  }
});

router.post('/sync/preview', async (req, res) => {
  try {
    const summary = await inspectServerSyncPackage(req.body.package);
    res.json(summary);
  } catch (error) {
    console.error('Sync preview error:', error);
    res.status(400).json({ error: error.message || 'Failed to preview sync package' });
  }
});

router.post('/sync/import', async (req, res) => {
  try {
    const summary = await commitServerSyncPackage(req.body.package, {
      importedByUserId: req.session.userId,
      originalFilename: req.body.original_filename || null
    });
    res.json({ message: 'Sync package imported', summary });
  } catch (error) {
    console.error('Sync import error:', error);
    res.status(400).json({ error: error.message || 'Failed to import sync package' });
  }
});

// GET global history
router.get('/history', async (req, res) => {
  try {
    const { service_id = 'all' } = req.query;
    const history = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          sl.date, 
          sl.created_at as submitted_at, 
          u.full_name as leader_name, 
          s.name as section_name, 
          st.name as service_name,
          COUNT(a.id) as records_count
        FROM submission_log sl
        JOIN leaders l ON sl.leader_id = l.id
        JOIN users u ON l.user_id = u.id
        JOIN sections s ON sl.section_id = s.id
        JOIN service_types st ON sl.service_id = st.id
        LEFT JOIN attendance a ON sl.date = a.date AND a.submitted_by = u.id AND a.service_type_id = sl.service_id
        WHERE (sl.service_id = ? OR ? = 'all')
        GROUP BY sl.id
        ORDER BY sl.date DESC, sl.created_at DESC
        LIMIT 200
      `, [service_id, service_id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global history' });
  }
});

// GET global attendance trends
router.get('/attendance-trends', async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const parsedDays = parseInt(days, 10);
    const endDate = formatLocalDate();
    const startDateStr = formatLocalDate(addDays(new Date(), -parsedDays));

    const trends = await new Promise((resolve, reject) => {
        const query = `
          SELECT 
            date,
            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count,
            COUNT(*) as total_members
          FROM attendance
          WHERE date >= ? AND date <= ?
          GROUP BY date
          ORDER BY date ASC
        `;
        db.all(query, [startDateStr, endDate], (err, rows) => {
          if (err) reject(err); else resolve(rows || []);
        });
    });

    res.json({ trends, date_range: { start: startDateStr, end: endDate } });
  } catch (error) {
    console.error('Global Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch global attendance trends' });
  }
});

// GET section overview for admin
router.get('/section-overview/:date', validateDate('date'), async (req, res) => {
  try {
    const { date } = req.params;
    const { section_id } = req.query;

    const allLeaders = await new Promise((resolve, reject) => {
        let q = `SELECT l.id, u.full_name as full_name, l.phone, s.name as section_name, l.section_id FROM leaders l JOIN users u ON l.user_id = u.id JOIN sections s ON l.section_id = s.id`;
        let params = [];
        if (section_id) { q += ` WHERE l.section_id = ?`; params.push(section_id); }
        db.all(q, params, (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    const attendance = await new Promise((resolve, reject) => {
        let q = `SELECT a.*, u.full_name as leader_name FROM attendance a JOIN members m ON a.member_id = m.id JOIN leaders l ON m.leader_id = l.id JOIN users u ON l.user_id = u.id WHERE a.date = ?`;
        let params = [date];
        if (section_id) { q += ` AND m.section_id = ?`; params.push(section_id); }
        db.all(q, params, (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    const logs = await new Promise((resolve, reject) => {
      let q = 'SELECT leader_id FROM submission_log WHERE date = ?';
      let params = [date];
      if (section_id) { q += ' AND section_id = ?'; params.push(section_id); }
      db.all(q, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    
    const submittedLeaderIds = new Set(logs.map(l => l.leader_id));
    const stats = { present: 0, absent: 0, excused: 0, total_submitted_leaders: submittedLeaderIds.size, total_leaders: allLeaders.length };
    
    const subleaderReport = allLeaders.map(l => {
      const leaderAttendance = attendance.filter(a => a.leader_name === l.full_name);
      const lStats = { present: 0, absent: 0, excused: 0 };
      leaderAttendance.forEach(a => {
        if (a.status === 'present') { lStats.present++; stats.present++; }
        if (a.status === 'absent') { lStats.absent++; stats.absent++; }
        if (a.status === 'excused') { lStats.excused++; stats.excused++; }
      });

      return {
        leader_id: l.id,
        leader_name: l.full_name,
        section_name: l.section_name,
        phone: l.phone,
        submitted: submittedLeaderIds.has(l.id),
        stats: lStats
      };
    });

    res.json({
      section_name: section_id ? subleaderReport[0]?.section_name : 'Global',
      date,
      stats,
      subleaders: subleaderReport
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET aggregated overview for weekly, monthly, yearly
router.get('/aggregated-overview', async (req, res) => {
  try {
    const { filterType, filterValue, service_id = 'all' } = req.query;
    
    if (!['weekly', 'monthly', 'yearly'].includes(filterType) || !filterValue) {
      return res.status(400).json({ error: 'Valid filterType and filterValue required' });
    }

    let dateCondition = '';
    let params = [];
    
    if (filterType === 'yearly') {
      dateCondition = yearEquals('a.date');
      params.push(filterValue);
    } else if (filterType === 'monthly') {
      dateCondition = monthEquals('a.date');
      params.push(filterValue);
    } else if (filterType === 'weekly') {
      const { start, end } = getISOWeekRange(filterValue);
      dateCondition = "a.date BETWEEN ? AND ?";
      params.push(start, end);
    }

    const attendance = await new Promise((resolve, reject) => {
        let q = `SELECT a.*, l.id as leader_id FROM attendance a JOIN members m ON a.member_id = m.id JOIN leaders l ON m.leader_id = l.id WHERE ${dateCondition} AND (a.service_type_id = ? OR ? = 'all')`;
        db.all(q, [...params, service_id, service_id], (err, rows) => {
          if (err) reject(err); else resolve(rows);
        });
    });

    const allLeaders = await queries.getAllLeaders();
    const stats = { present: 0, absent: 0, excused: 0, total_submitted_leaders: 0, total_leaders: allLeaders.length };
    
    const logs = await new Promise((resolve, reject) => {
       db.all(`SELECT leader_id FROM submission_log a WHERE ${dateCondition} AND (a.service_id = ? OR ? = 'all')`, [...params, service_id, service_id], (err, rows) => {
          if(err) resolve([]); else resolve(rows);
       });
    });
    
    const submittedCount = {};
    logs.forEach(log => {
       submittedCount[log.leader_id] = (submittedCount[log.leader_id] || 0) + 1;
    });

    let submittedLeadersSet = new Set(logs.map(l => l.leader_id));
    stats.total_submitted_leaders = submittedLeadersSet.size;

      const subleaderReport = allLeaders.map(l => {
        const leaderAttendance = attendance.filter(a => a.leader_id === l.id);
        const lStats = { present: 0, absent: 0, excused: 0 };
        leaderAttendance.forEach(a => {
          if (a.status === 'present') { lStats.present++; stats.present++; }
          if (a.status === 'absent') { lStats.absent++; stats.absent++; }
        if (a.status === 'excused') { lStats.excused++; stats.excused++; }
      });

      return {
        leader_id: l.id,
        leader_name: l.full_name,
        section_name: l.section_name,
        phone: l.phone,
          submissions_count: submittedCount[l.id] || 0,
          stats: lStats
        };
      }).sort((left, right) => {
        if (right.submissions_count !== left.submissions_count) {
          return right.submissions_count - left.submissions_count;
        }

        const rightTotal = right.stats.present + right.stats.absent + right.stats.excused;
        const leftTotal = left.stats.present + left.stats.absent + left.stats.excused;
        if (rightTotal !== leftTotal) {
          return rightTotal - leftTotal;
        }

        return left.leader_name.localeCompare(right.leader_name);
      });

      res.json({ filterType, filterValue, stats, subleaders: subleaderReport });
    } catch (error) {
      console.error('Aggregated overview error:', error);
      res.status(500).json({ error: 'Failed to aggregate overview' });
    }
  });

// GET comprehensive details for a specific leader dashboard (Admin Drill-Down)
router.get('/leader-dashboard/:id', async (req, res) => {
  try {
    const leaderId = req.params.id;
    
    // Fetch leader base info
    const leader = await new Promise((resolve, reject) => {
      db.get(`
        SELECT l.*, u.full_name, u.username, s.name as section_name 
        FROM leaders l 
        JOIN users u ON l.user_id = u.id 
        JOIN sections s ON l.section_id = s.id 
        WHERE l.id = ?
      `, [leaderId], (err, row) => err ? reject(err) : resolve(row));
    });

    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    // Roster
    const members = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM members WHERE leader_id = ? ORDER BY full_name', [leaderId], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // History log
    const history = await new Promise((resolve, reject) => {
      db.all(`
        SELECT sl.date, sl.created_at as submitted_at, COUNT(a.id) as records_count
        FROM submission_log sl
        LEFT JOIN attendance a ON sl.date = a.date AND sl.leader_id = (SELECT m.leader_id FROM members m WHERE m.id = a.member_id LIMIT 1)
        WHERE sl.leader_id = ?
        GROUP BY sl.id
        ORDER BY sl.date DESC, sl.created_at DESC
        LIMIT 20
      `, [leaderId], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Trends calculation (last 90 days)
    const trendStartDate = formatLocalDate(addDays(new Date(), -90));
    const trends = await new Promise((resolve, reject) => {
      db.all(`
        SELECT date, 
               SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
               SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count
        FROM attendance
        WHERE member_id IN (SELECT id FROM members WHERE leader_id = ?)
          AND date >= ?
        GROUP BY date
        ORDER BY date ASC
      `, [leaderId, trendStartDate], (err, rows) => err ? reject(err) : resolve(rows));
    });

    res.json({
      leader,
      roster: members,
      history,
      trends
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch leader drill-down dashboard' });
  }
});

// POST bulk attendance (Admin bulk substitute)
router.post('/attendance', async (req, res) => {
  try {
    const { date, attendance, leader_id, section_id, service_id = 1 } = req.body;

    if (!date || !Array.isArray(attendance) || attendance.length === 0 || !leader_id || !section_id) {
      return res.status(400).json({ error: 'Date, leader_id, section_id, and attendance array required' });
    }

    const existingSubmission = await queries.checkSubmissionExists(leader_id, date);
    if (existingSubmission) {
      return res.status(400).json({ error: 'Attendance already submitted for this leader on this date' });
    }

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);

          try {
            attendance.forEach(record => {
              if (!['present', 'absent', 'excused'].includes(record.status)) {
                throw new Error(`Invalid status for member ${record.member_id}`);
              }
              db.run(
                upsertAttendanceSql({ includeServiceType: true }),
                [record.member_id, date, record.status, service_id, req.session.userId]
              );
            });

            db.run(
              'INSERT INTO submission_log (leader_id, section_id, date, service_id) VALUES (?, ?, ?, ?)',
              [leader_id, section_id, date, service_id],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    db.run('ROLLBACK');
                    return reject(commitErr);
                  }
                  resolve();
                });
              }
            );
          } catch (err) {
            db.run('ROLLBACK');
            reject(err);
          }
        });
      });
    });

    res.json({ message: 'Attendance submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit attendance', details: error.message });
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
          GROUP BY m.id
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
          GROUP BY l.id
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
     csvRows.push(['ID', 'Full Name', 'Membership ID', 'Phone', 'Address', 'Date of Birth', 'Age Group', 'Gender', 'Section', 'Leader']);
     
     for (const b of birthdays) {
       const dob = b.date_of_birth ? new Date(b.date_of_birth).toLocaleDateString() : '';
       csvRows.push([
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
       ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
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
    const csvRows = [headers.join(',')];
    members.forEach(row => {
      const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      csvRows.push([row.membership_id, row.full_name, row.phone, row.address, row.email, row.gender, row.age_group, row.section_name, row.leader_name].map(escape).join(','));
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
