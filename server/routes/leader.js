const express = require('express');
const { db, queries } = require('../database');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
router.use(isAuthenticated);

// GET members assigned to this leader
router.get('/members', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const members = await queries.getMembersByLeader(leaderRecord.id);
    res.json({
      section_name: leaderRecord.section_name,
      leader_name: req.session.user.full_name,
      members
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Check submission status for a specific date
router.get('/attendance/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);

    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    // Check if submission exists
    const existing = await queries.checkSubmissionExists(leaderRecord.id, date);
    if (existing) {
      return res.json({ submitted: true, submitted_at: existing.submitted_at });
    }

    // Get existing attendance for this date if any
    const attendance = await queries.getAttendanceByLeaderAndDate(leaderRecord.id, date);
    res.json({ submitted: false, attendance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check attendance status' });
  }
});

// Submit attendance for a Sunday
router.post('/attendance', async (req, res) => {
  try {
    const { date, attendance } = req.body;

    if (!date || !Array.isArray(attendance) || attendance.length === 0) {
      return res.status(400).json({ error: 'Date and attendance array required' });
    }

    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    // Check if already submitted for this date
    const existingSubmission = await queries.checkSubmissionExists(leaderRecord.id, date);
    if (existingSubmission) {
      return res.status(400).json({ error: 'Attendance already submitted for this date' });
    }

    // Begin transaction
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);

          try {
            // Insert/replace attendance records
            attendance.forEach(record => {
              if (!['present', 'absent', 'excused'].includes(record.status)) {
                throw new Error(`Invalid status for member ${record.member_id}`);
              }
              // Use run directly since we're in a transaction
              db.run(
                'INSERT OR REPLACE INTO attendance (member_id, date, status, submitted_by, submitted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [record.member_id, date, record.status, req.session.userId]
              );
            });

            // Log the submission
            db.run(
              'INSERT INTO submission_log (leader_id, section_id, date) VALUES (?, ?, ?)',
              [leaderRecord.id, leaderRecord.section_id, date],
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

// Get leader's submission history
router.get('/history', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const history = await new Promise((resolve, reject) => {
      db.all(`
        SELECT sl.date, sl.submitted_at, COUNT(a.id) as records_count
        FROM submission_log sl
        LEFT JOIN attendance a ON sl.date = a.date AND a.submitted_by = ?
        WHERE sl.leader_id = ?
        GROUP BY sl.date
        ORDER BY sl.date DESC
        LIMIT 20
      `, [req.session.userId, leaderRecord.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
