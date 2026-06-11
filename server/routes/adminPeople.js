const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { queries, run, get, all, db, transaction } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const { formatLocalDate } = require('../utils/date');
const { escapeCsvValue, toCsvRow } = require('../utils/csv');
const { monthsAgo } = require('../utils/sqlDialect');

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

router.use(isAuthenticated);
router.use(requireRole(['admin']));

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
    // H2-fix: require typed confirmation for cascading destructive delete.
    // Deleting a section cascades to leaders, members, attendance, follow-ups.
    if (String(req.body?.confirm || '').toUpperCase() !== 'DELETE') {
      return res.status(400).json({
        error: 'Confirmation required',
        details: 'Send { "confirm": "DELETE" } in the request body to delete a section. This action cascades to all leaders, members, attendance, and follow-ups.'
      });
    }
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
    // H2-fix: defense-in-depth — require typed confirmation even for soft
    // delete. The member is recoverable via the restore endpoint, but a
    // typo or stuck UI button should not silently deactivate a member.
    if (String(req.body?.confirm || '').toUpperCase() !== 'SOFT-DELETE') {
      return res.status(400).json({
        error: 'Confirmation required',
        details: 'Send { "confirm": "SOFT-DELETE" } in the request body to soft-delete a member. This sets is_active=0 and is recoverable via the restore endpoint.'
      });
    }
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
        AND m.soft_deleted_at <= ${monthsAgo(6)}
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
         AND soft_deleted_at <= ${monthsAgo(6)}`,
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
    // C3-fix: placeholder is now a bcrypt random hash, and the response only
    // includes the set URL when the admin explicitly opts in via ?include_url=true
    // (default: token must be sent out-of-band via email only).
    const setToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(setToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72h
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    // DBA P1-#5: wrap the 3 writes (INSERT users, INSERT leaders, UPDATE
    // users with reset token) in a single transaction so a failure
    // between them cannot leave a leader with no reset token. We use
    // tx.run directly rather than queries.* because the queries
    // helpers capture the module-level run, not the active
    // transaction's bound client.
    const userId = await transaction(async (tx) => {
      const userResult = await tx.run(
        'INSERT INTO users (username, password_hash, role, full_name, profile_picture) VALUES (?, ?, ?, ?, ?)',
        [username, placeholderHash, 'leader', full_name, null]
      );
      const insertedUserId = userResult.lastID;
      await tx.run(
        'INSERT INTO leaders (user_id, section_id, phone, email, is_head) VALUES (?, ?, ?, ?, ?)',
        [insertedUserId, section_id, phone, email, is_head ? 1 : 0]
      );
      await tx.run(
        'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
        [tokenHash, expiresAt, insertedUserId]
      );
      return insertedUserId;
    });
    const setUrl = `${String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/set-password?token=${setToken}`;
    const responseBody = { message: 'Leader created. A password-set link has been queued for email delivery.', userId, expires_at: expiresAt };
    if (String(req.query.include_url) === 'true' || req.body && req.body.include_url === true) {
      responseBody.set_url = setUrl;
    }
    res.json(responseBody);
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

    // DBA P1-#5: update the users.full_name and leaders row atomically
    // so a failure cannot leave the two tables out of sync.
    await transaction(async (tx) => {
      if (full_name) {
        await tx.run(
          'UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [full_name, leader.user_id]
        );
      }
      await tx.run(
        'UPDATE leaders SET section_id = ?, phone = ?, email = ?, is_head = ? WHERE id = ?',
        [section_id, phone, email, is_head ? 1 : 0, id]
      );
    });
    res.json({ message: 'Leader updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leader' });
  }
});

// DELETE leader
router.delete('/leaders/:id', async (req, res) => {
  try {
    // H2-fix: require typed confirmation for cascading destructive delete.
    // Deleting a leader cascades to their members, attendance, and follow-ups.
    if (String(req.body?.confirm || '').toUpperCase() !== 'DELETE') {
      return res.status(400).json({
        error: 'Confirmation required',
        details: 'Send { "confirm": "DELETE" } in the request body to delete a leader. This action cascades to their members, attendance records, and follow-ups.'
      });
    }
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

    // Wrap all row processing in a single transaction for atomicity
    await transaction(async (tx) => {
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
            // C3-fix: bcrypt placeholder + opt-in URL.
            const setToken = crypto.randomBytes(24).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(setToken).digest('hex');
            const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
            try {
              await queries.createUser(leaderUsername, placeholderHash, 'leader', leaderNameOrId);
              leaderUser = await queries.findUserByUsername(leaderUsername);
              await run(
                'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
                [tokenHash, expiresAt, leaderUser.id]
              );
              const setUrl = `${String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/set-password?token=${setToken}`;
              if (String(req.query.include_url) === 'true' || (req.body && req.body.include_url === true)) {
                userPasswords.set(leaderUsername, { url: setUrl, expires_at: expiresAt });
              } else {
                userPasswords.set(leaderUsername, { expires_at: expiresAt });
              }
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
  });

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
    // C3-fix: only include the reset URL in the response when the admin
    // explicitly opts in via ?include_url=true. By default the URL is
    // considered sensitive and must be sent out-of-band via email.
    const resetToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    await run(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [tokenHash, expiresAt, leader.user_id]
    );

    const resetUrl = `${String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/reset-password?token=${resetToken}`;
    const responseBody = {
      message: 'Password reset link generated. It expires in 1 hour.',
      username: leader.username,
      expires_at: expiresAt
    };
    if (String(req.query.include_url) === 'true' || (req.body && req.body.include_url === true)) {
      responseBody.reset_url = resetUrl;
    }
    res.json(responseBody);
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
      LIMIT 10000
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

// --- Congregation Title CRUD ---
// GET all congregation titles
router.get('/titles', async (req, res) => {
  try {
    const titles = await queries.getAllTitles();
    res.json(titles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch titles' });
  }
});

// POST create congregation title
router.post('/titles', async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Title name is required' });
    }
    await queries.createTitle(name.trim(), description || null, sort_order || 0);
    res.json({ message: 'Title created' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'A title with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create title' });
  }
});

// PUT update congregation title
router.put('/titles/:id', async (req, res) => {
  try {
    const { name, description, is_active, sort_order } = req.body;
    const { id } = req.params;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Title name is required' });
    }
    await queries.updateTitle(id, name.trim(), description || null, is_active !== undefined ? (is_active ? 1 : 0) : 1, sort_order || 0);
    res.json({ message: 'Title updated' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'A title with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update title' });
  }
});

// DELETE congregation title
router.delete('/titles/:id', async (req, res) => {
  try {
    await queries.deleteTitle(req.params.id);
    res.json({ message: 'Title deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete title' });
  }
});

// GET member titles
router.get('/members/:id/titles', async (req, res) => {
  try {
    const titles = await queries.getMemberTitles(req.params.id);
    res.json(titles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member titles' });
  }
});

// POST assign title to member
router.post('/members/:id/titles', async (req, res) => {
  try {
    const { title_id } = req.body;
    if (!title_id) {
      return res.status(400).json({ error: 'title_id is required' });
    }
    await queries.assignMemberTitle(req.params.id, title_id, req.session.userId);
    res.json({ message: 'Title assigned' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign title' });
  }
});

// DELETE remove title from member
router.delete('/members/:id/titles/:titleId', async (req, res) => {
  try {
    await queries.removeMemberTitle(req.params.id, req.params.titleId);
    res.json({ message: 'Title removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove title' });
  }
});

module.exports = router;
