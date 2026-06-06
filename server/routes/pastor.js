const express = require('express');
const { queries, all, get, db } = require('../database');
const { isAuthenticated, requireRole, validateDate } = require('../middleware/auth');
const { addDays, formatLocalDate, getWeekStartString } = require('../utils/date');

const router = express.Router();
router.use(isAuthenticated);
router.use(requireRole(['admin', 'pastor']));

// H5-fix: redact PII in pastor-facing list responses. Pastors get the
// full name and membership_id (for tracking), but phone and DOB are
// masked to last-4 and month/day respectively. The full values are
// only available through /api/admin/people/members/:id or
// /api/leader/members/:id where the caller is the assigned leader.
function maskMemberPII(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((r) => {
    if (!r || typeof r !== 'object') return r;
    const out = { ...r };
    if ('phone' in out) {
      const digits = String(out.phone || '').replace(/\D/g, '');
      out.phone_masked = digits.length >= 4 ? `***-***-${digits.slice(-4)}` : null;
      delete out.phone;
    }
    if ('date_of_birth' in out && out.date_of_birth) {
      const dob = String(out.date_of_birth);
      // Keep month-day only; drop year.
      const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
      out.birthday = m ? `${m[2]}-${m[3]}` : null;
      delete out.date_of_birth;
    }
    if ('address' in out) {
      out.address_masked = out.address ? `${String(out.address).slice(0, 2)}***` : null;
      delete out.address;
    }
    if ('email' in out) {
      const e = String(out.email || '');
      const at = e.indexOf('@');
      out.email_masked = at > 1 ? `${e[0]}***${e.slice(at)}` : null;
      delete out.email;
    }
    return out;
  });
}

function validateQueryDates(req, res, next) {
  const { start_date, end_date } = req.query;
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (start_date && (!isoDateRegex.test(start_date) || isNaN(new Date(start_date + 'T00:00:00').getTime()))) {
    return res.status(400).json({ error: 'Invalid start_date format. Use YYYY-MM-DD' });
  }
  if (end_date && (!isoDateRegex.test(end_date) || isNaN(new Date(end_date + 'T00:00:00').getTime()))) {
    return res.status(400).json({ error: 'Invalid end_date format. Use YYYY-MM-DD' });
  }
  next();
}

router.use(validateQueryDates);

router.get('/dashboard/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const overall = await queries.getOverallAttendanceStats();

    const latestDate = overall.length > 0 ? overall[0].date : null;
    let sectionBreakdown = [];
    if (latestDate) {
      sectionBreakdown = await all(`
        SELECT s.name as section_name,
               COUNT(*) as total,
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
               ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        JOIN sections s ON m.section_id = s.id
        WHERE a.date = ?
        GROUP BY s.name
        ORDER BY attendance_rate DESC
      `, [latestDate]);
    }

    let completion = [];
    if (start_date && end_date) {
      completion = await queries.getSubmissionCompletion(start_date, end_date);
    } else {
      const today = formatLocalDate();
      completion = await all(`
        SELECT s.name as section_name, u.full_name as leader_name
        FROM submission_log sl
        JOIN leaders l ON sl.leader_id = l.id
        JOIN users u ON l.user_id = u.id
        JOIN sections s ON l.section_id = s.id
        WHERE sl.date = ?
        GROUP BY l.id
      `, [today]);
    }

    const totalLeadersResult = await get('SELECT COUNT(*) as count FROM leaders');
    const totalLeaders = totalLeadersResult?.count || 0;
    const completionRate = totalLeaders > 0 ? ((completion.length / totalLeaders) * 100).toFixed(1) : 0;

    res.json({
      overallAttendance: overall,
      latestDate,
      sectionBreakdown,
      completion: {
        leadersSubmitted: completion.length,
        totalLeaders,
        rate: parseFloat(completionRate)
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

router.get('/dashboard/trends', async (req, res) => {
  try {
    const { start_date, end_date, section_id } = req.query;
    const params = [start_date, end_date];

    let query = `
      SELECT s.name as section_name, a.date,
             COUNT(*) as total,
             SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      WHERE a.date BETWEEN ? AND ?
    `;

    if (section_id) {
      query += ' AND s.id = ?';
      params.push(section_id);
    }

    query += ' GROUP BY s.name, a.date ORDER BY a.date ASC, s.name';

    const trends = await all(query, params);
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

router.get('/leaders/metrics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || formatLocalDate(addDays(new Date(), -90));
    const endDate = end_date || formatLocalDate();

    const metrics = await queries.getLeaderMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leader metrics' });
  }
});

router.get('/members/at-risk', async (req, res) => {
  try {
    const atRisk = await queries.getAtRiskMembers();
    res.json(maskMemberPII(atRisk));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch at-risk members' });
  }
});

router.get('/members/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await all(`
      SELECT a.date, a.status
      FROM attendance a
      WHERE a.member_id = ?
      ORDER BY a.date DESC
      LIMIT 50
    `, [id]);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member history' });
  }
});

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

    const headers = ['Date', 'Section', 'Leader', 'MembershipID', 'MemberName', 'Status'];
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
    console.error('Pastor export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// GET leader engagement scores
router.get('/engagement', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const endDate = end_date || formatLocalDate();
    const startDate = start_date || formatLocalDate(addDays(new Date(), -30));

    const scores = await queries.getLeaderEngagementScores(startDate, endDate);
    res.json(scores);
  } catch (error) {
    console.error('Engagement scores error:', error);
    res.status(500).json({ error: 'Failed to fetch engagement scores' });
  }
});

// GET weekly summary
router.get('/weekly-summary', async (req, res) => {
  try {
    const { week } = req.query;
    const weekStart = week || getWeekStartString();

    const summary = await queries.getWeeklySummary(weekStart);
    const weekEnd = addDays(weekStart, 6);

    res.json({
      week_start: weekStart,
      week_end: formatLocalDate(weekEnd),
      leaders: summary
    });
  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

// GET members needing follow-up (auto-alerts)
router.get('/alerts/follow-up-needed', async (req, res) => {
  try {
    const members = await queries.getMembersNeedingFollowUp();
    res.json(maskMemberPII(members));
  } catch (error) {
    console.error('Follow-up alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch follow-up alerts' });
  }
});

// GET today's birthdays
router.get('/alerts/birthdays', async (req, res) => {
  try {
    const birthdays = await queries.getTodayBirthdays();
    res.json(maskMemberPII(birthdays));
  } catch (error) {
    console.error('Birthday alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch birthday alerts' });
  }
});

module.exports = router;
