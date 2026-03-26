const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { queries, run } = require('../database');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply authentication to all routes
router.use(isAuthenticated);

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

// PUT update member
router.put('/members/:id', async (req, res) => {
  try {
    const { full_name, phone, email, gender, age_group } = req.body;
    const { id } = req.params;

    await queries.updateMember(full_name, phone, email, gender, age_group, id);
    res.json({ message: 'Member updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE member
router.delete('/members/:id', async (req, res) => {
  try {
    await queries.deleteMember(req.params.id);
    res.json({ message: 'Member deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete member' });
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
        .pipe(csv())
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

    for (const row of rows) {
      try {
        const sectionName = row.Section?.trim();
        const leaderName = row.LeaderName?.trim();
        const membershipId = row.MembershipID?.trim();
        const fullName = row.FullName?.trim();

        if (!sectionName || !leaderName || !membershipId || !fullName) {
          results.errors.push(`Row skipped: missing required fields for ${fullName || 'unknown member'}`);
          continue;
        }

        // Create or get section
        let sectionId = sectionsMap.get(sectionName.toLowerCase());
        if (!sectionId) {
          try {
            await queries.createSection(sectionName);
            const section = await queries.getSectionByName(sectionName);
            sectionId = section.id;
            sectionsMap.set(sectionName.toLowerCase(), sectionId);
            results.sectionsCreated++;
          } catch (error) {
            if (error.message.includes('UNIQUE')) {
              const section = await queries.getSectionByName(sectionName);
              sectionId = section.id;
              sectionsMap.set(sectionName.toLowerCase(), sectionId);
            } else {
              results.errors.push(`Failed to create section "${sectionName}": ${error.message}`);
              continue;
            }
          }
        }

        // Create leader user if not exists
        const leaderUsername = leaderName.toLowerCase().replace(/\s+/g, '_');
        let leaderUser = await queries.findUserByUsername(leaderUsername);

        if (!leaderUser) {
          const tempPassword = `temp_${uuidv4().substring(0, 8)}`;
          const passwordHash = bcrypt.hashSync(tempPassword, 10);
          try {
            await queries.createUser(leaderUsername, passwordHash, 'leader', leaderName);
            leaderUser = await queries.findUserByUsername(leaderUsername);
            userPasswords.set(leaderUsername, tempPassword);
            results.leadersCreated++;
          } catch (error) {
            results.errors.push(`Failed to create leader user "${leaderUsername}": ${error.message}`);
            continue;
          }
        }

        // Get or create leader record
        let leaderRecord = await queries.getLeaderByUserId(leaderUser.id);
        if (!leaderRecord) {
          try {
            await queries.createLeader(leaderUser.id, sectionId, row.LeaderPhone || null, row.LeaderEmail || null);
            leaderRecord = await queries.getLeaderByUserId(leaderUser.id);
          } catch (error) {
            results.errors.push(`Failed to create leader record for ${leaderName}: ${error.message}`);
            continue;
          }
        }

        const leaderId = leaderRecord.id;

        // Check if member exists
        const existingMember = await queries.getMemberByMembershipId(membershipId);
        if (existingMember) {
          await queries.updateMember(
            fullName,
            row.Phone || null,
            row.Email || null,
            row.Gender || null,
            row.AgeGroup || null,
            existingMember.id
          );
          continue;
        }

        // Create new member
        try {
          await queries.createMember(
            membershipId,
            fullName,
            sectionId,
            leaderId,
            row.Phone || null,
            row.Email || null,
            row.Gender || null,
            row.AgeGroup || null
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
      tempPasswords: userPasswords.size > 0 ? 'Temporary passwords generated for new leader accounts' : null
    });
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath, () => {});
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

    if (date) {
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
        s.name as section_name,
        u.full_name as leader_name,
        m.membership_id,
        m.full_name as member_name,
        a.status
      FROM attendance a
      JOIN members m ON a.member_id = m.id
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
    const headers = ['Date', 'Section', 'Leader', 'MembershipID', 'MemberName', 'Status'];
    const csvRows = [];
    csvRows.push(headers.join(','));

    records.forEach(row => {
      const values = [
        row.date,
        `"${row.section_name}"`,
        `"${row.leader_name}"`,
        row.membership_id,
        `"${row.member_name}"`,
        row.status
      ];
      csvRows.push(values.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${new Date().toISOString().split('T')[0]}.csv"`);
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
        SELECT l.id, u.username, u.full_name, s.name as section_name, l.phone, l.email
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

module.exports = router;
