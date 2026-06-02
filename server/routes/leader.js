const express = require('express');
const { db, queries, get, all, run, transaction } = require('../database');
const { isAuthenticated, validateDate } = require('../middleware/auth');
const { addDays, formatLocalDate, getWeekStartString } = require('../utils/date');
const { upsertAttendanceSql } = require('../utils/sqlDialect');

const router = express.Router();
router.use(isAuthenticated);

// Idempotency-Key cache: 5 min TTL, max 1000 entries (FIFO eviction)
const idemCache = new Map();
const IDEM_MAX = 1000;
function idemCacheSet(key, status, body) {
  if (idemCache.size >= IDEM_MAX) {
    const firstKey = idemCache.keys().next().value;
    idemCache.delete(firstKey);
  }
  idemCache.set(key, { ts: Date.now(), status, body });
}
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [k, v] of idemCache.entries()) {
    if (v.ts < cutoff) idemCache.delete(k);
  }
}, 60 * 1000).unref?.();

const normalizePersonKey = (name, phone = '') => {
  const normalizedName = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  return `${normalizedName}|${normalizedPhone}`;
};

async function getTargetLeaderRecord(currentLeader, targetLeaderId) {
  if (!targetLeaderId || Number(targetLeaderId) === Number(currentLeader.id)) {
    return currentLeader;
  }

  if (!currentLeader.is_head) {
    const error = new Error('Only head leaders can submit for another leader');
    error.statusCode = 403;
    throw error;
  }

  const target = await new Promise((resolve, reject) => {
    db.get(`
      SELECT l.*, s.name as section_name, u.username, u.full_name
      FROM leaders l
      JOIN sections s ON l.section_id = s.id
      JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `, [targetLeaderId], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });

  if (!target || Number(target.section_id) !== Number(currentLeader.section_id)) {
    const error = new Error('Selected leader does not belong to your section');
    error.statusCode = 403;
    throw error;
  }

  return target;
}

// GET members assigned to this leader
router.get('/members', async (req, res) => {
  try {
    const { target_leader_id } = req.query;
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const targetLeader = await getTargetLeaderRecord(leaderRecord, target_leader_id);
    const members = await queries.getMembersByLeader(targetLeader.id);
    const sectionLeaders = leaderRecord.is_head
      ? await queries.getLeadersBySection(leaderRecord.section_id)
      : [];

    res.json({
      section_id: leaderRecord.section_id,
      section_name: leaderRecord.section_name,
      leader_id: leaderRecord.id,
      leader_name: req.session.user.full_name,
      attendance_leader_id: targetLeader.id,
      attendance_leader_name: targetLeader.full_name || req.session.user.full_name,
      acting_on_behalf: Number(targetLeader.id) !== Number(leaderRecord.id),
      section_leaders: sectionLeaders,
      is_head: Boolean(leaderRecord.is_head),
      members
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch members' });
  }
});

// Create a new member for this leader
router.post('/members', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });
    
    if (!leaderRecord.is_head) {
      return res.status(403).json({ error: 'Access denied: Only head leaders can add members' });
    }

    const { membership_id, full_name, phone, email, gender, age_group, address } = req.body;
    if (!membership_id || !full_name) {
      return res.status(400).json({ error: 'Membership ID and Full Name are required' });
    }

    const existingMember = await queries.getMemberByMembershipId(membership_id);
    if (existingMember) {
      return res.status(400).json({ error: 'Membership ID already exists' });
    }

    const duplicateName = await queries.findActiveMemberByName(full_name);
    if (duplicateName) {
      return res.status(400).json({ error: `A member named "${duplicateName.full_name}" already exists (${duplicateName.membership_id})` });
    }

    await queries.createMember(
      membership_id, full_name, leaderRecord.section_id, leaderRecord.id,
      phone || null, email || null, gender || null, age_group || null,
      null, 0, 0, '[]', address || null
    );

    res.json({ message: 'Member created successfully' });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update a member
router.put('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, gender, age_group, address } = req.body;

    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    if (!leaderRecord.is_head) {
      return res.status(403).json({ error: 'Access denied: Only head leaders can edit members' });
    }

    const member = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM members WHERE id = ? AND leader_id = ?', [id, leaderRecord.id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!member) return res.status(404).json({ error: 'Member not found' });

    const duplicateName = await queries.findActiveMemberByName(full_name, id);
    if (duplicateName) {
      return res.status(400).json({ error: `A member named "${duplicateName.full_name}" already exists (${duplicateName.membership_id})` });
    }

    await queries.updateMember(
      full_name, phone, email, gender, age_group,
      member.date_of_birth, member.show_age_to_leaders, member.hide_from_birthday_list,
      member.opt_out_services || '[]',
      address || member.address,
      member.section_id,
      member.leader_id,
      id
    );
    res.json({ message: 'Member updated successfully' });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Delete a member
router.delete('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    if (!leaderRecord.is_head) {
      return res.status(403).json({ error: 'Access denied: Only head leaders can delete members' });
    }

    const member = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM members WHERE id = ? AND leader_id = ?', [id, leaderRecord.id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!member) return res.status(404).json({ error: 'Member not found' });

    await queries.deleteMember(id);
    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// GET home cells assigned to this leader
router.get('/home-cells', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    const cells = await all(`
      SELECT hc.*
      FROM home_cells hc
      JOIN home_cell_leaders hcl ON hcl.cell_id = hc.id
      WHERE hcl.leader_id = ? AND hc.is_active = 1
      ORDER BY hc.cell_number
    `, [leaderRecord.id]);

    const members = await all(`
      SELECT hcm.*, hc.name AS cell_name, m.membership_id AS church_membership_id
      FROM home_cell_members hcm
      JOIN home_cells hc ON hc.id = hcm.cell_id
      JOIN home_cell_leaders hcl ON hcl.cell_id = hc.id
      LEFT JOIN members m ON m.id = hcm.church_member_id
      WHERE hcl.leader_id = ? AND hcm.is_active = 1
      ORDER BY hc.cell_number, hcm.full_name
    `, [leaderRecord.id]);

    res.json({ cells, members });
  } catch (error) {
    console.error('Fetch leader home cells error:', error);
    res.status(500).json({ error: 'Failed to fetch home cells' });
  }
});

router.post('/home-cell-members', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    const cellId = Number(req.body.cell_id);
    const fullName = String(req.body.full_name || '').trim();
    const phone = req.body.phone || null;
    const churchMembershipId = String(req.body.membership_id || '').trim();

    if (!Number.isInteger(cellId) || !fullName) {
      return res.status(400).json({ error: 'Home cell and full name are required' });
    }

    const assignment = await get(
      'SELECT id FROM home_cell_leaders WHERE cell_id = ? AND leader_id = ?',
      [cellId, leaderRecord.id]
    );
    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to this home cell' });
    }

    let churchMember = null;
    if (churchMembershipId) {
      churchMember = await queries.getMemberByMembershipId(churchMembershipId);
      if (!churchMember) {
        return res.status(400).json({ error: 'Church member ID was not found' });
      }
    }

    const duplicateKey = churchMember
      ? `member:${churchMember.id}`
      : `person:${normalizePersonKey(fullName, phone)}`;

    const duplicate = await get(
      'SELECT id, full_name FROM home_cell_members WHERE duplicate_key = ? AND is_active = 1',
      [duplicateKey]
    );
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
      phone,
      req.body.email || null,
      req.body.address || null,
      duplicateKey,
      req.session.userId
    ]);

    res.status(201).json({ message: 'Home cell member added' });
  } catch (error) {
    console.error('Create home cell member error:', error);
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'This person is already registered in a home cell' });
    }
    res.status(500).json({ error: 'Failed to add home cell member' });
  }
});

router.delete('/home-cell-members/:id', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    const member = await get(`
      SELECT hcm.id
      FROM home_cell_members hcm
      JOIN home_cell_leaders hcl ON hcl.cell_id = hcm.cell_id
      WHERE hcm.id = ? AND hcl.leader_id = ?
    `, [req.params.id, leaderRecord.id]);
    if (!member) {
      return res.status(404).json({ error: 'Home cell member not found' });
    }

    await run('UPDATE home_cell_members SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ message: 'Home cell member removed' });
  } catch (error) {
    console.error('Delete home cell member error:', error);
    res.status(500).json({ error: 'Failed to remove home cell member' });
  }
});

// GET attendance status for a date + service
router.get('/attendance/:date', validateDate('date'), async (req, res) => {
  try {
    const { date } = req.params;
    const { service_id = 1, target_leader_id } = req.query;
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });
    const targetLeader = await getTargetLeaderRecord(leaderRecord, target_leader_id);
    
    // --- AUTHORIZATION CHECK ---
    if (String(service_id) !== '1') {
      const instance = await queries.getServiceInstance(service_id, date);
      if (instance) {
        const assignedIds = JSON.parse(instance.assigned_leader_ids || '[]');
        if (!assignedIds.includes(leaderRecord.id) && !assignedIds.includes(targetLeader.id)) {
           return res.json({ unauthorized: true, submitted: false, attendance: [] });
        }
      } else {
         return res.json({ unauthorized: true, submitted: false, attendance: [] });
      }
    } else {
      const instance = await queries.getServiceInstance(service_id, date);
      if (instance) {
        const assignedIds = JSON.parse(instance.assigned_leader_ids || '[]');
        if (!assignedIds.includes(leaderRecord.id) && !assignedIds.includes(targetLeader.id)) {
           return res.json({ unauthorized: true, submitted: false, attendance: [] });
        }
      }
    }
    
    const submission = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM submission_log WHERE leader_id = ? AND date = ? AND service_id = ?', 
        [targetLeader.id, date, service_id], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
    });

    const attendance = await new Promise((resolve, reject) => {
      db.all(`
        SELECT a.member_id, a.status, submitter.full_name as submitted_by_name
        FROM attendance a
        JOIN members m ON m.id = a.member_id
        JOIN users submitter ON submitter.id = a.submitted_by
        WHERE m.leader_id = ? AND a.date = ? AND a.service_type_id = ?
      `, [targetLeader.id, date, service_id], (err, rows) => {
          if (err) reject(err); else resolve(rows);
        });
    });

    res.json({
      submitted: !!submission,
      attendance,
      attendance_leader_id: targetLeader.id,
      attendance_leader_name: targetLeader.full_name || leaderRecord.section_name,
      submitted_by_name: attendance[0]?.submitted_by_name || null
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to check attendance status' });
  }
});

// GET all assignments for leader
router.get('/assignments', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });
    const assignments = await queries.getAssignedInstancesByLeader(leaderRecord.id);
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// GET all service types (public info for eligibility checking)
router.get('/service-types', async (req, res) => {
  try {
    const services = await queries.getAllServiceTypes();
    res.json(services.map(s => ({
      ...s,
      eligibility_rules: JSON.parse(s.eligibility_rules || '{}'),
      points_config: JSON.parse(s.points_config || '{}')
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch service types' });
  }
});

// Get section overview for head leaders
router.get('/section-overview/:date', validateDate('date'), async (req, res) => {
  try {
    const { date } = req.params;
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    
    if (!leaderRecord || !leaderRecord.is_head) {
      return res.status(403).json({ error: 'Access denied. Not a head leader.' });
    }

    const { service_id = 1 } = req.query;
    const allLeaders = await queries.getLeadersBySection(leaderRecord.section_id);
    const attendance = await queries.getAttendanceByDateAndSection(date, leaderRecord.section_id, service_id);

    const logs = await new Promise((resolve, reject) => {
      db.all('SELECT leader_id FROM submission_log WHERE section_id = ? AND date = ? AND service_id = ?', 
        [leaderRecord.section_id, date, service_id], (err, rows) => {
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
      const submittedByNames = [...new Set(leaderAttendance.map(a => a.submitted_by_name).filter(Boolean))];

      return {
        leader_id: l.id,
        leader_name: l.full_name,
        phone: l.phone,
        submitted: submittedLeaderIds.has(l.id),
        submitted_by_name: submittedByNames[0] || null,
        submitted_on_behalf: submittedByNames.length > 0 && !submittedByNames.includes(l.full_name),
        stats: lStats
      };
    });

    res.json({
      section_name: leaderRecord.section_name,
      date,
      stats,
      subleaders: subleaderReport
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch section overview' });
  }
});

// Submit attendance for a service
router.post('/attendance', async (req, res) => {
  try {
    const { date, attendance, service_id = 1, target_leader_id } = req.body;

    if (!date || !Array.isArray(attendance) || attendance.length === 0) {
      return res.status(400).json({ error: 'Date and attendance array required' });
    }

    // Idempotency-Key: if the client retries with the same key within 5
    // minutes, return the cached response instead of inserting again.
    const idemKey = req.get('Idempotency-Key');
    if (idemKey && /^[A-Za-z0-9_\-]{1,128}$/.test(idemKey)) {
      const cached = idemCache.get(idemKey);
      if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
        return res.status(cached.status).json(cached.body);
      }
    }

    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }
    const targetLeader = await getTargetLeaderRecord(leaderRecord, target_leader_id);

    // --- AUTHORIZATION CHECK ---
    if (String(service_id) !== '1') {
      const instance = await queries.getServiceInstance(service_id, date);
      if (instance) {
        const assignedIds = JSON.parse(instance.assigned_leader_ids || '[]');
        if (!assignedIds.includes(leaderRecord.id) && !assignedIds.includes(targetLeader.id)) {
           return res.status(403).json({ error: 'You are not assigned to take attendance for this service.' });
        }
      } else {
         return res.status(403).json({ error: 'You are not assigned to take attendance for this service.' });
      }
    } else {
      const instance = await queries.getServiceInstance(service_id, date);
      if (instance) {
        const assignedIds = JSON.parse(instance.assigned_leader_ids || '[]');
        if (!assignedIds.includes(leaderRecord.id) && !assignedIds.includes(targetLeader.id)) {
           return res.status(403).json({ error: 'You are not assigned to this Main Service instance.' });
        }
      }
    }

    // Check if already submitted for this date + service
    const existingSubmission = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM submission_log WHERE leader_id = ? AND date = ? AND service_id = ?', 
        [targetLeader.id, date, service_id], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
    });
    
    if (existingSubmission) {
      return res.status(400).json({ error: 'Attendance already submitted for this service today' });
    }

    const leaderMembers = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id FROM members WHERE leader_id = ?',
        [targetLeader.id],
        (err, rows) => {
          if (err) reject(err); else resolve(rows || []);
        }
      );
    });

    const validMemberIds = new Set(leaderMembers.map((m) => Number(m.id)));

    // Filter submitted attendance to only include members that belong to this leader
    const filteredAttendance = attendance.filter((record) =>
      validMemberIds.has(Number(record.member_id))
    );

    if (filteredAttendance.length === 0) {
      return res.status(400).json({ error: 'Attendance contains no valid members for the selected leader roster' });
    }

    if (filteredAttendance.length !== attendance.length) {
      console.warn(
        `[Attendance] Filtered out ${attendance.length - filteredAttendance.length} member IDs from submission that do not belong to leader ${targetLeader.id}`
      );
    }

    // Begin transaction
    const serviceRow = await get('SELECT points_config FROM service_types WHERE id = ?', [service_id]);
    if (!serviceRow) {
      return res.status(400).json({ error: 'Service type not found' });
    }
    const pointsConfig = JSON.parse(serviceRow.points_config || '{"present":10,"excused":3}');

    for (const record of filteredAttendance) {
      if (!['present', 'absent', 'excused'].includes(record.status)) {
        return res.status(400).json({ error: `Invalid status for member ${record.member_id}` });
      }
    }

    await transaction(async (tx) => {
      for (const record of filteredAttendance) {
        await tx.run(
          upsertAttendanceSql({ includeServiceType: true }),
          [record.member_id, date, record.status, service_id, req.session.userId]
        );
        if (record.status === 'present' && pointsConfig.present > 0) {
          await tx.run(
            'UPDATE members SET hall_of_fame_points = hall_of_fame_points + ? WHERE id = ?',
            [pointsConfig.present, record.member_id]
          );
        } else if (record.status === 'excused' && pointsConfig.excused > 0) {
          await tx.run(
            'UPDATE members SET hall_of_fame_points = hall_of_fame_points + ? WHERE id = ?',
            [pointsConfig.excused, record.member_id]
          );
        }
      }
      await tx.run(
        'INSERT INTO submission_log (leader_id, section_id, date, service_id) VALUES (?, ?, ?, ?)',
        [targetLeader.id, targetLeader.section_id, date, service_id]
      );
    });

    const responseBody = {
      message: Number(targetLeader.id) === Number(leaderRecord.id)
        ? 'Attendance submitted successfully'
        : `Attendance submitted on behalf of ${targetLeader.full_name}`
    };
    if (idemKey) idemCacheSet(idemKey, 200, responseBody);
    res.json(responseBody);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Failed to submit attendance', details: error.message });
  }
});

// Get leader's submission history
router.get('/history', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const history = await new Promise((resolve, reject) => {
      const isHead = Boolean(leaderRecord.is_head);
      const whereClause = isHead ? 'sl.section_id = ?' : 'sl.leader_id = ?';
      const filterParam = isHead ? leaderRecord.section_id : leaderRecord.id;
      const limit = isHead ? 100 : 20;
      const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 1000 ? limit : 100;

      db.all(`
        SELECT sl.date, sl.created_at as submitted_at, sl.service_id, st.name as service_name,
               u.full_name as leader_name,
               submitter.full_name as submitted_by_name,
               COUNT(a.id) as records_count
        FROM submission_log sl
        JOIN leaders l ON sl.leader_id = l.id
        JOIN users u ON l.user_id = u.id
        LEFT JOIN service_types st ON sl.service_id = st.id
        LEFT JOIN members m ON m.leader_id = l.id
        LEFT JOIN attendance a ON a.member_id = m.id AND sl.date = a.date AND a.service_type_id = sl.service_id
        LEFT JOIN users submitter ON submitter.id = a.submitted_by
        WHERE ${whereClause}
        GROUP BY sl.date, sl.leader_id, sl.service_id, st.name, u.full_name, submitter.full_name, sl.created_at
        ORDER BY sl.date DESC, sl.created_at DESC
        LIMIT ${safeLimit}
      `, [filterParam], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get attendance trends data for charts
router.get('/attendance-trends', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const { days = 90 } = req.query; // Default to last 90 days (approx 12 Sundays)
    const parsedDays = parseInt(days, 10);
    const endDate = formatLocalDate();
    const startDateStr = formatLocalDate(addDays(new Date(), -parsedDays));

    const trends = await queries.getLeaderSectionAttendanceStats(leaderRecord.id, startDateStr, endDate);
    res.json({ trends, date_range: { start: startDateStr, end: endDate } });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance trends' });
  }
});

router.get('/consecutive-absences', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });
    const members = await queries.getConsecutiveAbsentMembers(leaderRecord.id, 2);
    res.json(members);
  } catch (error) {
    console.error('Consecutive absences error:', error);
    res.status(500).json({ error: 'Failed to fetch consecutive absences' });
  }
});

router.get('/follow-ups', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });
    const followUps = await queries.getFollowUpsByLeader(leaderRecord.id);
    res.json(followUps);
  } catch (error) {
    console.error('Follow-ups error:', error);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

router.put('/follow-ups/:memberId', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    if (!leaderRecord.is_head) {
      return res.status(403).json({ error: 'Access denied: Only head leaders can update follow-ups' });
    }

    const { contacted, contact_method, notes } = req.body;
    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT id, absence_date FROM absent_followups WHERE member_id = ? AND leader_id = ? ORDER BY absence_date DESC LIMIT 1',
        [req.params.memberId, leaderRecord.id], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
    });

    if (existing) {
      await queries.updateFollowUp(existing.id, contacted ? 1 : 0, contact_method || null, notes || null);
    } else {
      await queries.createFollowUp(req.params.memberId, leaderRecord.id, formatLocalDate());
    }

    res.json({ message: 'Follow-up saved' });
  } catch (error) {
    console.error('Save follow-up error:', error);
    res.status(500).json({ error: 'Failed to save follow-up' });
  }
});

// POST outreach log — leader logs a contact with a member
router.post('/outreach', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const { member_id, contact_method, message } = req.body;
    if (!member_id || !contact_method) {
      return res.status(400).json({ error: 'member_id and contact_method are required' });
    }

    const weekStart = getWeekStartString();
    await queries.createOutreachLog(leaderRecord.id, member_id, contact_method, message || null, weekStart);
    res.json({ message: 'Outreach logged' });
  } catch (error) {
    console.error('Outreach log error:', error);
    res.status(500).json({ error: 'Failed to log outreach' });
  }
});

// GET outreach history for this leader
router.get('/outreach', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const { week } = req.query;
    if (week) {
      const logs = await queries.getOutreachByLeaderAndWeek(leaderRecord.id, week);
      return res.json({ logs, week_start: week });
    }

    const logs = await queries.getOutreachByLeader(leaderRecord.id, 100);
    const stats = await queries.getLeaderOutreachStats(leaderRecord.id, 8);
    res.json({ logs, stats });
  } catch (error) {
    console.error('Outreach fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch outreach' });
  }
});

// GET members not yet contacted this week
router.get('/outreach/not-contacted', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const weekStart = getWeekStartString();
    const members = await queries.getLeaderOutreachMembersNotContacted(leaderRecord.id, weekStart);
    res.json({ members, week_start: weekStart });
  } catch (error) {
    console.error('Not contacted fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// GET consecutive absences for this leader
router.get('/absences/consecutive', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const absences = await queries.getConsecutiveAbsentMembers(leaderRecord.id);
    res.json(absences);
  } catch (error) {
    console.error('Fetch consecutive absences error:', error);
    res.status(500).json({ error: 'Failed to fetch absences' });
  }
});

// GET follow-ups for this leader
router.get('/follow-ups', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const followUps = await queries.getFollowUpsByLeader(leaderRecord.id);
    res.json(followUps);
  } catch (error) {
    console.error('Fetch follow-ups error:', error);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

// GET leader trends (personal attendance over time)
router.get('/trends', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    const trends = await queries.getLeaderSectionAttendanceStats(
      leaderRecord.id,
      formatLocalDate(startDate),
      formatLocalDate(endDate)
    );

    res.json(trends);
  } catch (error) {
    console.error('Fetch trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

module.exports = router;
