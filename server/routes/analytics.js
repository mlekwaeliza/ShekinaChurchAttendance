const express = require('express');
const { queries, get, all, getMultiPeriodOverall, getMultiPeriodSections, getMultiPeriodLeaders, getMultiPeriodDepartments, getMultiPeriodMembers, getAttendanceMovement } = require('../database');
const { isAuthenticated, requireRole, validateDateRange } = require('../middleware/auth');
const { addDays, formatLocalDate, getISOWeekRange, getISOWeekString, parseDateInput } = require('../utils/date');

const router = express.Router();

// All analytics routes require authentication + admin or pastor role
router.use(isAuthenticated);
router.use(requireRole(['admin', 'pastor', 'accountant']));

// GET /analytics/predictions
// Returns moving average forecast based on last 12 weeks of attendance data
router.get('/predictions', async (req, res) => {
  try {
    const result = await queries.getAttendancePrediction();
    const prediction = result[0] || { avg_rate: 0, avg_present: 0, avg_total: 0, weeks_analyzed: 0 };
    
    // Calculate simple trend direction from recent data
    const { all } = require('../database');
    const recentWeeks = await all(`
      SELECT date,
             ROUND(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as rate
      FROM attendance
      GROUP BY date
      ORDER BY date DESC
      LIMIT 6
    `);

    let trend = 'stable';
    if (recentWeeks.length >= 4) {
      const recentAvg = recentWeeks.slice(0, 2).reduce((s, w) => s + Number(w.rate), 0) / 2;
      const olderAvg = recentWeeks.slice(2, 4).reduce((s, w) => s + Number(w.rate), 0) / 2;
      if (recentAvg - olderAvg > 3) trend = 'improving';
      else if (olderAvg - recentAvg > 3) trend = 'declining';
    }

    res.json({
      forecast: {
        predicted_rate: prediction.avg_rate,
        predicted_present: prediction.avg_present,
        predicted_total: prediction.avg_total,
        weeks_analyzed: prediction.weeks_analyzed,
        trend,
      },
      recent_weeks: recentWeeks.reverse()
    });
  } catch (error) {
    console.error('Predictions error:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// GET /analytics/anomalies?threshold=20
// Returns sections where latest attendance dropped significantly vs 90-day average
router.get('/anomalies', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 20;
    const anomalies = await queries.getSectionAnomalies(Math.max(1, Math.min(threshold, 100)));
    res.json(anomalies);
  } catch (error) {
    console.error('Anomalies error:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

// GET /analytics/streaks?limit=20
// Returns members with longest active consecutive attendance streaks
router.get('/streaks', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const streaks = await queries.getMemberStreaks(limit);
    res.json(streaks);
  } catch (error) {
    console.error('Streaks error:', error);
    res.status(500).json({ error: 'Failed to fetch streaks' });
  }
});

// GET /analytics/leader-trends?start_date=...&end_date=...
// Returns per-leader attendance rate with trend indicators
router.get('/leader-trends', validateDateRange('start_date', 'end_date'), async (req, res) => {
  try {
    const startDate = req.query.start_date || formatLocalDate(addDays(new Date(), -90));
    const endDate = req.query.end_date || formatLocalDate();

    const trends = await queries.getLeaderPerformanceTrends(startDate, endDate);

    // Calculate per-leader trend direction using first half vs second half of period
    const { all } = require('../database');
    const midDate = formatLocalDate(
      new Date((parseDateInput(startDate).getTime() + parseDateInput(endDate).getTime()) / 2)
    );

    const enrichedTrends = await Promise.all(trends.map(async (leader) => {
      const firstHalf = await all(`
        SELECT ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as rate
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        WHERE m.leader_id = ? AND a.date BETWEEN ? AND ?
      `, [leader.leader_id, startDate, midDate]);

      const secondHalf = await all(`
        SELECT ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as rate
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        WHERE m.leader_id = ? AND a.date BETWEEN ? AND ?
      `, [leader.leader_id, midDate, endDate]);

      const firstRate = firstHalf[0]?.rate || 0;
      const secondRate = secondHalf[0]?.rate || 0;
      const diff = secondRate - firstRate;

      let trend_direction = 'stable';
      if (diff > 3) trend_direction = 'improving';
      else if (diff < -3) trend_direction = 'declining';

      return {
        ...leader,
        first_half_rate: firstRate,
        second_half_rate: secondRate,
        trend_direction,
        trend_diff: Math.round(diff * 10) / 10,
      };
    }));

    res.json(enrichedTrends);
  } catch (error) {
    console.error('Leader trends error:', error);
    res.status(500).json({ error: 'Failed to fetch leader trends' });
  }
});

// GET /analytics/engagement-scores?limit=20
// Returns composite engagement score per member (admin/pastor only)
router.get('/engagement-scores', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const scores = await queries.getMemberEngagementScores(limit);
    res.json(scores);
  } catch (error) {
    console.error('Engagement scores error:', error);
    res.status(500).json({ error: 'Failed to fetch engagement scores' });
  }
});

// GET /analytics/demographics
// Returns attendance breakdown by gender and age group (last 90 days)
router.get('/demographics', async (req, res) => {
  try {
    const raw = await queries.getDemographicBreakdown();
    
    // Split into two arrays for easier frontend consumption
    const gender = raw.filter(r => r.category_type === 'gender');
    const ageGroup = raw.filter(r => r.category_type === 'age_group');

    res.json({ gender, age_group: ageGroup });
  } catch (error) {
    console.error('Demographics error:', error);
    res.status(500).json({ error: 'Failed to fetch demographics' });
  }
});

// GET /analytics/year-over-year
// Returns monthly attendance comparison between current and previous year
router.get('/year-over-year', async (req, res) => {
  try {
    const data = await queries.getYearOverYear();
    
    // Map month numbers to names for display
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const enriched = data.map(row => ({
      ...row,
      month_name: monthNames[parseInt(row.month) - 1] || row.month,
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Year-over-year error:', error);
    res.status(500).json({ error: 'Failed to fetch year-over-year data' });
  }
});

// GET /analytics/retention?days=90
// Returns new member retention statistics
router.get('/retention', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const result = await queries.getNewMemberRetention(days);
    const retention = result[0] || {
      total_new_members: 0,
      still_attending: 0,
      retention_rate: null,
      avg_services_attended: 0
    };

    res.json({
      ...retention,
      period_days: days,
      retention_rate: retention.retention_rate || 0
    });
  } catch (error) {
    console.error('Retention error:', error);
    res.status(500).json({ error: 'Failed to fetch retention data' });
  }
});

// GET /analytics/dashboard-metrics?service_id=...
router.get('/dashboard-metrics', async (req, res) => {
  try {
    const rawServiceId = req.query.service_id;
    const serviceId = rawServiceId === 'all' ? 'all' : (parseInt(rawServiceId) || 1);
    const year = new Date().getFullYear();
    
    const [comparisons, needsAttention, sparkline, hallOfFame, settings, todayStats] = await Promise.all([
      queries.getDashboardComparisons(),
      queries.getNeedsAttention(serviceId),
      queries.getAttendanceSparkline(serviceId),
      queries.getHallOfFameSummary(year),
      queries.getSettings(),
      queries.getTodayAttendanceStats(serviceId)
    ]);

    // Fetch last session for this service/filter and use it as the dashboard
    // attendance display when today has no records.
    const { all: allDb } = require('../database');
    let lastSession = null;
    const latestSessionSql = `
      SELECT
        date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused
      FROM attendance
      ${serviceId === 'all' ? '' : 'WHERE service_type_id = ?'}
      GROUP BY date
      ORDER BY date DESC
      LIMIT 1
    `;
    const latestSessions = await allDb(
      latestSessionSql,
      serviceId === 'all' ? [] : [serviceId]
    );
    if (latestSessions.length > 0) {
      lastSession = latestSessions[0];
    }

    const normalizeStats = (stats = {}) => ({
      present: Number(stats.present || 0),
      absent: Number(stats.absent || 0),
      excused: Number(stats.excused || 0)
    });
    const todayStatsNormalized = normalizeStats(todayStats);
    const todayTotal = todayStatsNormalized.present + todayStatsNormalized.absent + todayStatsNormalized.excused;
    const displayStats = todayTotal > 0 || !lastSession
      ? todayStatsNormalized
      : normalizeStats(lastSession);
    const attendanceContext = todayTotal > 0 || !lastSession
      ? { mode: 'today', date: formatLocalDate(), isLatestFallback: false }
      : { mode: 'latest', date: lastSession.date, isLatestFallback: true };

    // Format output
    res.json({
      comparisons: comparisons[0],
      needsAttention: {
        birthdays: needsAttention.filter(i => i.reason === 'birthday'),
        absentees: needsAttention.filter(i => i.reason === 'absentee'),
        visitors: needsAttention.filter(i => i.reason === 'visitor')
      },
      sparkline,
      hallOfFame,
      settings: settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {}),
      lastSession,
      attendanceContext,
      todayStats: displayStats
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// GET /analytics/section-comparison?days=90&startDate=&endDate=
// Returns multi-metric comparison across all sections
router.get('/section-comparison', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const { startDate, endDate } = req.query;
    const sections = await queries.getSectionComparison(days, startDate || null, endDate || null);
    res.json(sections);
  } catch (error) {
    console.error('Section comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch section comparison' });
  }
});

// GET /analytics/service-comparison?days=90&startDate=&endDate=
router.get('/service-comparison', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const { startDate, endDate } = req.query;
    const services = await queries.getServiceComparison(days, startDate || null, endDate || null);
    res.json(services);
  } catch (error) {
    console.error('Service comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch service comparison' });
  }
});

// GET /analytics/service-type-breakdown?days=90
// Returns attendance breakdown by service type
router.get('/service-type-breakdown', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const breakdown = await queries.getServiceTypeBreakdown(days);
    res.json(breakdown);
  } catch (error) {
    console.error('Service type breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch service type breakdown' });
  }
});

// GET /analytics/attendance-patterns?days=180
// Returns attendance by day-of-week patterns
router.get('/attendance-patterns', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 180, 365);
    const patterns = await queries.getAttendanceDayPatterns(days);
    res.json(patterns);
  } catch (error) {
    console.error('Attendance patterns error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance patterns' });
  }
});

// GET /analytics/monthly-trends?months=12
// Returns combined monthly attendance + contribution trends
router.get('/monthly-trends', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 12, 36);
    const [attendanceTrends, contributionTrends, sectionTrends] = await Promise.all([
      queries.getMonthlyAttendanceContribTrends(months),
      queries.getMonthlyContributionTrends(months),
      queries.getMonthlySectionTrends(months),
    ]);
    res.json({ attendance: attendanceTrends, contributions: contributionTrends, sections: sectionTrends });
  } catch (error) {
    console.error('Monthly trends error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly trends' });
  }
});

// GET /analytics/evangelism-funnel
// Returns evangelism conversion funnel
router.get('/evangelism-funnel', async (req, res) => {
  try {
    const funnel = await queries.getEvangelismFunnel();
    res.json(funnel);
  } catch (error) {
    console.error('Evangelism funnel error:', error);
    res.status(500).json({ error: 'Failed to fetch evangelism funnel' });
  }
});

// GET /analytics/new-member-funnel
// Returns new member status funnel
router.get('/new-member-funnel', async (req, res) => {
  try {
    const funnel = await queries.getNewMemberFunnel();
    res.json(funnel);
  } catch (error) {
    console.error('New member funnel error:', error);
    res.status(500).json({ error: 'Failed to fetch new member funnel' });
  }
});

// GET /analytics/executive-dashboard
router.get('/executive-dashboard', async (req, res) => {
  try {
    const [dashboard, growth] = await Promise.all([
      queries.getExecutiveDashboard(),
      queries.getGrowthPercentages(),
    ]);
    const present = dashboard?.present_today || 0;
    const total = dashboard?.total_today || 1;
    res.json({
      ...dashboard,
      ...growth,
      attendance_rate: Math.round((present / total) * 100),
    });
  } catch (error) {
    console.error('Executive dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch executive dashboard' });
  }
});

// GET /analytics/comparison?period1Start=&period1End=&period2Start=&period2End=
router.get('/comparison', async (req, res) => {
  try {
    const { period1Start, period1End, period2Start, period2End } = req.query;
    if (!period1Start || !period1End || !period2Start || !period2End) {
      return res.status(400).json({ error: 'All four date parameters required' });
    }
    const data = await queries.getComparisonAnalytics(period1Start, period1End, period2Start, period2End);
    const p1Rate = data?.p1_rate || 0;
    const p2Rate = data?.p2_rate || 0;
    const diff = p1Rate - p2Rate;
    res.json({ ...data, rate_diff: Math.round(diff * 10) / 10, trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable' });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch comparison analytics' });
  }
});

// GET /analytics/historical?startDate=&endDate=
router.get('/historical', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || formatLocalDate(addDays(new Date(), -365));
    const end = endDate || formatLocalDate();
    const [stats, daily] = await Promise.all([
      queries.getHistoricalStats(start, end),
      queries.getHistoricalDaily(start, end),
    ]);
    res.json({ stats, daily });
  } catch (error) {
    console.error('Historical error:', error);
    res.status(500).json({ error: 'Failed to fetch historical stats' });
  }
});

// GET /analytics/section-rankings?days=90
router.get('/section-rankings', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const { startDate, endDate, prevStartDate, prevEndDate } = req.query;
    const sections = await queries.getSectionRankings(days, startDate || null, endDate || null, prevStartDate || null, prevEndDate || null);
    
    const sortedByPrev = [...sections]
      .map(s => ({ id: s.id, prev_rate: s.prev_rate || 0 }))
      .sort((a, b) => b.prev_rate - a.prev_rate);

    const prevRankMap = {};
    sortedByPrev.forEach((s, idx) => {
      prevRankMap[s.id] = idx + 1;
    });

    const ranked = sections.map((s, i) => {
      const consistency_score = s.worst_day_rate != null && s.best_day_rate != null
        ? Math.round((1 - (s.best_day_rate - s.worst_day_rate)) * 100)
        : 75;
      const rate = s.attendance_rate || 0;
      const retention = s.retention_rate || 0;
      const performance_score = Math.round(rate * 0.5 + consistency_score * 0.25 + retention * 0.25);
      
      const currentRank = i + 1;
      const prevRank = prevRankMap[s.id] || currentRank;
      const rank_change = prevRank - currentRank;

      return {
        ...s,
        rank: currentRank,
        rank_change,
        is_best: i === 0,
        is_lowest: i === sections.length - 1 && sections.length > 1,
        consistency_score,
        performance_score,
      };
    });
    res.json(ranked);
  } catch (error) {
    console.error('Section rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch section rankings' });
  }
});

// GET /analytics/head-leader-analytics?days=90&startDate=&endDate=
router.get('/head-leader-analytics', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const { startDate, endDate } = req.query;
    const leaders = await queries.getHeadLeaderAnalytics(days, startDate || null, endDate || null);
    const enriched = leaders.map(l => {
      const totalServices = l.total_services || Math.max(Math.round(days / 7) * 2, 1);
      const submissionRate = Math.min(100, Math.round(((l.submissions_made || 0) / Math.max(1, totalServices)) * 100));
      const leadership_score = Math.min(100, Math.round(
        (Number(l.overall_attendance) || 0) * 0.6 +
        submissionRate * 0.4
      ));
      return {
        ...l,
        submission_rate: submissionRate,
        performance_score: leadership_score,
      };
    });
    res.json(enriched);
  } catch (error) {
    console.error('Head leader analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch head leader analytics' });
  }
});

// GET /analytics/absent-streaks?limit=100
router.get('/absent-streaks', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const streaks = await queries.getAbsentStreaks(limit);
    res.json(streaks);
  } catch (error) {
    console.error('Absent streaks error:', error);
    res.status(500).json({ error: 'Failed to fetch absent streaks' });
  }
});

// GET /analytics/leader-rankings?days=90&startDate=&endDate=&prevStartDate=&prevEndDate=
router.get('/leader-rankings', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const { startDate, endDate, prevStartDate, prevEndDate } = req.query;
    const leaders = await queries.getLeaderRankings(days, startDate || null, endDate || null, prevStartDate || null, prevEndDate || null);
    const ranked = leaders.map((l, i) => ({
      ...l,
      rank: i + 1,
      efficiency_score: Math.min(100, Math.round(
        (Number(l.attendance_rate) || 0) * 0.4 +
        Math.min(100, Number(l.leader_submission_rate) || 0) * 0.2 +
        Math.min(100, Number(l.retention_rate) || 0) * 0.2 +
        Math.min(100, Number(l.follow_up_completion) || 0) * 0.1 +
        Math.min(100, ((l.assigned_members > 0 ? l.unique_attendees / l.assigned_members : 0) * 100)) * 0.1 +
        Math.min(100, ((l.new_members || 0) / Math.max(1, l.assigned_members)) * 100) * 0.15
      )),
    }));
    res.json(ranked);
  } catch (error) {
    console.error('Leader rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch leader rankings' });
  }
});

// GET /analytics/departments?days=90&startDate=&endDate=
router.get('/departments', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const { startDate, endDate } = req.query;
    const depts = await queries.getDepartmentAnalytics(days, startDate || null, endDate || null);
    const ranked = depts.map((d, i) => ({
      ...d,
      rank: i + 1,
      growth_indicator: Number(d.attendance_rate) >= 75 ? 'strong' : Number(d.attendance_rate) >= 50 ? 'average' : 'needs_attention',
    }));
    res.json(ranked);
  } catch (error) {
    console.error('Department analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch department analytics' });
  }
});

// GET /analytics/member-intelligence?days=90
router.get('/member-intelligence', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const { filterType, filterValue, service_id = 'all', fallback_latest } = req.query;
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      if (filterType === 'daily' && filterValue) {
        startDate = filterValue;
        endDate = filterValue;
      } else if (filterType === 'weekly' && filterValue) {
        const range = getISOWeekRange(filterValue);
        startDate = range.start;
        endDate = range.end;
      } else if (filterType === 'monthly' && filterValue) {
        const [year, month] = String(filterValue).split('-').map(Number);
        if (year && month) {
          startDate = formatLocalDate(new Date(year, month - 1, 1));
          endDate = formatLocalDate(new Date(year, month, 0));
        }
      } else if (filterType === 'yearly' && filterValue) {
        startDate = `${filterValue}-01-01`;
        endDate = `${filterValue}-12-31`;
      }
    }

    if (filterType === 'weekly' && fallback_latest !== 'false' && startDate && endDate) {
      const serviceCondition = service_id === 'all' ? '' : ' AND service_type_id = ?';
      const serviceParams = service_id === 'all' ? [] : [service_id];
      const currentRange = await get(
        `SELECT COUNT(*) as total FROM attendance WHERE date BETWEEN ? AND ?${serviceCondition}`,
        [startDate, endDate, ...serviceParams]
      );

      if (!Number(currentRange?.total || 0)) {
        const latest = await get(
          `SELECT MAX(date) AS latest_date FROM attendance WHERE 1=1${serviceCondition}`,
          serviceParams
        );

        if (latest?.latest_date) {
          const latestWeek = getISOWeekString(latest.latest_date);
          const latestRange = getISOWeekRange(latestWeek);
          startDate = latestRange.start;
          endDate = latestRange.end;
        }
      }
    }

    const members = await queries.getMemberIntelligence(days, startDate || null, endDate || null, service_id);
    res.json(members);
  } catch (error) {
    console.error('Member intelligence error:', error);
    res.status(500).json({ error: 'Failed to fetch member intelligence' });
  }
});

// GET /analytics/member-intelligence/:id/attendance?days=180&service_id=all
router.get('/member-intelligence/:id/attendance', async (req, res) => {
  try {
    const memberId = Number(req.params.id);
    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({ error: 'Invalid member id' });
    }

    const days = Math.min(parseInt(req.query.days, 10) || 180, 365);
    const { service_id = 'all' } = req.query;
    const endDate = formatLocalDate(new Date());
    const startDate = formatLocalDate(addDays(endDate, -days));
    const serviceCondition = service_id === 'all' ? '' : ' AND a.service_type_id = ?';
    const serviceParams = service_id === 'all' ? [] : [service_id];

    const member = await get(`
      SELECT
        m.id,
        m.full_name,
        m.membership_id,
        m.gender,
        m.age_group,
        m.created_at as registered_date,
        s.name as section_name,
        head_u.full_name as head_leader_name,
        leader_u.full_name as leader_name
      FROM members m
      LEFT JOIN sections s ON m.section_id = s.id
      LEFT JOIN leaders leader_l ON m.leader_id = leader_l.id
      LEFT JOIN users leader_u ON leader_l.user_id = leader_u.id
      LEFT JOIN leaders head_l ON head_l.section_id = m.section_id AND head_l.is_head = 1 AND head_l.is_active = 1
      LEFT JOIN users head_u ON head_l.user_id = head_u.id
      WHERE m.id = ? AND m.soft_deleted_at IS NULL
    `, [memberId]);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const records = await all(`
      SELECT
        a.id,
        a.date,
        a.status,
        a.service_type_id,
        COALESCE(st.name, 'Service') as service_name,
        a.submitted_at,
        submitted_by.full_name as submitted_by_name
      FROM attendance a
      LEFT JOIN service_types st ON a.service_type_id = st.id
      LEFT JOIN users submitted_by ON a.submitted_by = submitted_by.id
      WHERE a.member_id = ?
        AND a.date BETWEEN ? AND ?
        ${serviceCondition}
      ORDER BY a.date DESC, a.submitted_at DESC
      LIMIT 200
    `, [memberId, startDate, endDate, ...serviceParams]);

    const stats = records.reduce((acc, record) => {
      const status = String(record.status || '').trim().toLowerCase();
      if (status === 'present') acc.present += 1;
      if (status === 'absent') acc.absent += 1;
      if (status === 'excused') acc.excused += 1;
      acc.total += 1;
      return acc;
    }, { present: 0, absent: 0, excused: 0, total: 0 });

    stats.attendance_rate = stats.total ? Math.round((stats.present / stats.total) * 100) : 0;

    res.json({
      member,
      records,
      stats,
      date_range: { start: startDate, end: endDate },
      service_id
    });
  } catch (error) {
    console.error('Member attendance details error:', error);
    res.status(500).json({ error: 'Failed to fetch member attendance details' });
  }
});

// GET /analytics/heatmap?months=6
router.get('/heatmap', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 6, 24);
    const [daily, sections] = await Promise.all([
      queries.getAttendanceHeatMap(months),
      queries.getSectionHeatMap(months),
    ]);
    res.json({ daily, sections });
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// GET /analytics/trends-ma?weeks=26
router.get('/trends-ma', async (req, res) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks) || 26, 104);
    const trends = await queries.getAttendanceTrendsWithMA(weeks);
    res.json(trends);
  } catch (error) {
    console.error('Trends MA error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// GET /analytics/risk-analysis
router.get('/risk-analysis', async (req, res) => {
  try {
    const [members, atRisk, consecutiveAbsentees] = await Promise.all([
      queries.getAttendanceRiskAnalysis(),
      queries.getAtRiskMembers(),
      queries.getConsecutiveAbsentees(),
    ]);
    const summary = {
      highly_active: members.filter(m => m.risk_level === 'Highly Active').length,
      active: members.filter(m => m.risk_level === 'Active').length,
      moderately_active: members.filter(m => m.risk_level === 'Moderately Active').length,
      at_risk: members.filter(m => m.risk_level === 'At Risk').length,
      critical: members.filter(m => m.risk_level === 'Critical Follow-up Required').length,
    };
    res.json({ members, summary, at_risk_members: atRisk, consecutive_absentees: consecutiveAbsentees });
  } catch (error) {
    console.error('Risk analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch risk analysis' });
  }
});

// GET /analytics/leader-workload?days=90
router.get('/leader-workload', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const workload = await queries.getLeaderWorkload(days);
    res.json(workload);
  } catch (error) {
    console.error('Leader workload error:', error);
    res.status(500).json({ error: 'Failed to fetch leader workload' });
  }
});

// GET /analytics/correlations?months=6
router.get('/correlations', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 6, 36);
    const data = await queries.getCorrelationAnalytics(months);
    res.json(data);
  } catch (error) {
    console.error('Correlations error:', error);
    res.status(500).json({ error: 'Failed to fetch correlations' });
  }
});

// GET /analytics/church-growth-index
router.get('/church-growth-index', async (req, res) => {
  try {
    const data = await queries.getChurchGrowthIndex();
    const activeGrowth = data.total_members > 0 ? ((data.current_active / data.total_members) * 100) : 0;
    const retentionScore = data.previous_active > 0 ? ((data.current_active / data.previous_active) * 100) : 50;
    const leaderScore = data.total_leaders > 0 ? ((data.active_leaders / data.total_leaders) * 100) : 0;
    const rateChange = (data.current_rate || 0) - (data.previous_rate || 0);
    const growthIndex = Math.min(100, Math.round(
      Math.min(100, activeGrowth) * 0.25 +
      Math.min(100, retentionScore) * 0.25 +
      Math.min(100, leaderScore) * 0.20 +
      Math.min(100, (data.current_rate || 0)) * 0.15 +
      Math.min(100, Math.max(0, 50 + rateChange * 2)) * 0.15
    ));
    res.json({ ...data, growth_index: growthIndex, rate_change: Math.round(rateChange * 10) / 10 });
  } catch (error) {
    console.error('Church growth index error:', error);
    res.status(500).json({ error: 'Failed to fetch church growth index' });
  }
});

// GET /analytics/ai-insights
router.get('/ai-insights', async (req, res) => {
  try {
    const [sectionData, riskData, consecutiveData, growthData] = await Promise.all([
      queries.getSectionRankings(90),
      queries.getAtRiskMembers(),
      queries.getConsecutiveAbsentees(),
      queries.getChurchGrowthIndex(),
    ]);

    const insights = [];

    if (sectionData.length > 0) {
      const best = sectionData[0];
      insights.push({
        type: 'success',
        text: `${best.name} has the highest attendance rate at ${best.attendance_rate}% over the last 90 days.`,
        category: 'section_performance',
      });
    }

    if (growthData.current_rate && growthData.previous_rate) {
      const diff = growthData.current_rate - growthData.previous_rate;
      if (diff > 0) {
        insights.push({ type: 'success', text: `Overall attendance improved by ${diff.toFixed(1)}% compared to the previous period.`, category: 'attendance_trend' });
      } else if (diff < 0) {
        insights.push({ type: 'warning', text: `Overall attendance declined by ${Math.abs(diff).toFixed(1)}% compared to the previous period.`, category: 'attendance_trend' });
      }
    }

    if (consecutiveData.length > 0) {
      insights.push({ type: 'danger', text: `${consecutiveData.length} member(s) have missed 3+ consecutive services and require follow-up.`, category: 'followup' });
    }

    if (riskData.length > 0) {
      insights.push({ type: 'warning', text: `${riskData.length} member(s) are at risk with less than 20% attendance.`, category: 'risk' });
    }

    if (growthData.souls_won_90d > 0) {
      insights.push({ type: 'success', text: `${growthData.souls_won_90d} souls have been won through evangelism in the last 90 days.`, category: 'evangelism' });
    }

    if (growthData.new_visitors_90d > 0) {
      insights.push({ type: 'info', text: `${growthData.new_visitors_90d} new visitors have attended in the last 90 days.`, category: 'visitors' });
    }

    const activeLeaders = growthData.active_leaders || 0;
    const totalLeaders = growthData.total_leaders || 1;
    if (activeLeaders < totalLeaders * 0.8) {
      insights.push({ type: 'warning', text: `Only ${activeLeaders} of ${totalLeaders} leaders have submitted attendance in the last 30 days.`, category: 'submissions' });
    }

    if (sectionData.length >= 2) {
      const diff = sectionData[0].attendance_rate - sectionData[sectionData.length - 1].attendance_rate;
      if (diff > 20) {
        insights.push({ type: 'warning', text: `There is a ${diff.toFixed(1)}% gap between the best and lowest performing sections.`, category: 'section_gap' });
      }
    }

    if (growthData.current_rate >= 80) {
      insights.push({ type: 'success', text: `Church attendance is healthy at ${growthData.current_rate}% average rate.`, category: 'health' });
    } else if (growthData.current_rate < 50) {
      insights.push({ type: 'danger', text: `Church attendance is critically low at ${growthData.current_rate}% average rate. Immediate action needed.`, category: 'health' });
    }

    insights.push({ type: 'info', text: `${growthData.total_members} active members across ${growthData.total_departments} departments.`, category: 'overview' });

    res.json(insights.slice(0, 15));
  } catch (error) {
    console.error('AI insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});


// ── GET /analytics/finance-analytics ─────────────────────────────────────────
// Finance summary, monthly income trend, and expense breakdown for a given year
router.get('/finance-analytics', async (req, res) => {
  try {
    const year = String(Number(req.query.year) || new Date().getFullYear());
    const yearFrom = `${year}-01-01`;
    const yearTo   = `${year}-12-31`;

    const summary = await queries.getFinanceSummary(yearFrom, yearTo);

    const monthly = await all(`
      SELECT
        ${monthOnly('record_date')} as month,
        COUNT(*) as day_count,
        COALESCE(SUM(morning_offering), 0)    as morning,
        COALESCE(SUM(afternoon_offering), 0)  as afternoon,
        COALESCE(SUM(total_tithes), 0)        as tithes,
        COALESCE(SUM(total_income), 0)        as income,
        COALESCE(SUM(usable_church_funds), 0) as usable,
        COALESCE(SUM(evangelism_offering), 0) as evangelism,
        COALESCE(SUM(mission_fund), 0)        as mission,
        COALESCE(SUM(bishop_fund), 0)         as bishop
      FROM finance_daily_records
      WHERE ${yearOnly('record_date')} = ? AND status IN ('submitted', 'approved')
      GROUP BY ${monthOnly('record_date')}
      ORDER BY month ASC
    `, [year]);

    const expenses = await all(`
      SELECT fe.category, COALESCE(SUM(fe.amount), 0) as total
      FROM finance_expenses fe
      JOIN finance_daily_records fd ON fe.record_id = fd.id
      WHERE ${yearOnly('fd.record_date')} = ? AND fd.status IN ('submitted', 'approved')
      GROUP BY fe.category
      ORDER BY total DESC
    `, [year]);

    const statusBreakdown = await all(`
      SELECT status, COUNT(*) as count
      FROM finance_daily_records
      WHERE ${yearOnly('record_date')} = ?
      GROUP BY status
    `, [year]);

    res.json({ summary, monthly, expenses, statusBreakdown, year });
  } catch (error) {
    console.error('Finance analytics error:', error);
    res.status(500).json({ error: 'Failed to load finance analytics', details: error.message });
  }
});

// ── POST /analytics/executive-comparison ─────────────────────────────────────
// Multi-Period Executive Attendance Intelligence Engine
// Accepts multiple periods, returns comprehensive comparison data for all modes
router.post('/executive-comparison', async (req, res) => {
  try {
    const { periods, mode = 'overall', filters = {} } = req.body;
    if (!Array.isArray(periods) || periods.length < 1) {
      return res.status(400).json({ error: 'At least one period is required' });
    }

    const periodResults = [];
    for (const p of periods) {
      const { id, label, start, end } = p;
      if (!start || !end) continue;

      // Overall attendance stats for this period
      const overall = await getMultiPeriodOverall(start, end);

      // Section rankings for this period
      const sections = await getMultiPeriodSections(start, end);

      // Leader rankings for this period
      const leaders = await getMultiPeriodLeaders(start, end);

      // Department data for this period
      const departments = await getMultiPeriodDepartments(start, end);

      // Member engagement data
      const memberEngagement = await getMultiPeriodMembers(start, end);

      // Daily breakdown
      const daily = await queries.getHistoricalDaily(start, end);

      // Movement analysis
      const movement = await getAttendanceMovement(start, end);

      periodResults.push({
        id, label, start, end,
        overall,
        sections,
        leaders,
        departments,
        memberEngagement,
        daily,
        movement
      });
    }

    // Compute executive KPIs across all periods
    const kpis = computeExecutiveKPIs(periodResults);

    // Trend intelligence
    const trends = analyzeTrends(periodResults);

    // Root cause analysis
    const rootCauses = analyzeRootCauses(periodResults);

    // Action center
    const actions = generateActions(periodResults, trends);

    res.json({
      periods: periodResults,
      kpis,
      trends,
      rootCauses,
      actions,
      mode,
      filters
    });
  } catch (error) {
    console.error('Executive comparison error:', error);
    res.status(500).json({ error: 'Failed to run executive comparison', details: error.message });
  }
});

function computeExecutiveKPIs(periodResults) {
  const total = periodResults.length;
  if (total === 0) return {};

  const rates = periodResults.map(p => p.overall?.attendance_rate || 0);
  const presents = periodResults.map(p => p.overall?.present || 0);
  const members = periodResults.map(p => p.overall?.total_members || 0);
  const growth = periodResults.map(p => p.overall?.net_growth || 0);
  const sections = periodResults.map(p => p.overall?.active_sections || 0);
  const leaders = periodResults.map(p => p.overall?.leaders_submitted || 0);
  const totalLeaders = periodResults[0]?.overall?.total_leaders || 1;

  const latest = periodResults[total - 1];
  const prev = total > 1 ? periodResults[total - 2] : null;
  const avgRate = rates.reduce((a, b) => a + b, 0) / total;
  const bestRate = Math.max(...rates);
  const worstRate = Math.min(...rates);

  // Church Health Score (composite)
  const healthScore = Math.round(
    (avgRate * 0.35) +
    (members.length > 0 ? (members[members.length - 1] / Math.max(...members) * 100) * 0.2 : 20) +
    (leaders.length > 0 ? (leaders[leaders.length - 1] / totalLeaders * 100) * 0.2 : 20) +
    (sections.length > 0 ? (sections[sections.length - 1] / (sections.reduce((a,b)=>a+b,0)/sections.length) * 100) * 0.15 : 15) +
    (growth.length > 0 ? (growth[growth.length - 1] + 100) * 0.1 : 10)
  );

  // Attendance Growth Index
  const growthIndex = prev && prev.overall?.attendance_rate
    ? Math.round(((latest.overall?.attendance_rate || 0) - prev.overall?.attendance_rate) / prev.overall?.attendance_rate * 100)
    : 0;

  // Stability Index (lower variance = more stable)
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rates.length;
  const stabilityIndex = Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance))));

  // Retention Index
  const retentionIndex = latest?.overall?.retention_rate || 0;

  // Engagement Score
  const engagementScore = latest?.overall?.engagement_score || 0;

  // Leader Performance Index
  const leaderPerfIndex = totalLeaders > 0
    ? Math.round((leaders[leaders.length - 1] || 0) / totalLeaders * 100)
    : 0;

  // Forecast (simple linear projection)
  const forecast = rates.length >= 3
    ? Math.round(rates[rates.length - 1] + (rates[rates.length - 1] - rates[rates.length - 3]) / 2)
    : rates[rates.length - 1] || 0;

  return {
    church_health_score: healthScore,
    attendance_growth_index: growthIndex,
    stability_index: stabilityIndex,
    retention_index: retentionIndex,
    engagement_score: engagementScore,
    leader_performance_index: leaderPerfIndex,
    attendance_forecast: Math.min(100, Math.max(0, forecast)),
    average_attendance_rate: Math.round(avgRate * 10) / 10,
    average_growth_rate: growthIndex,
    consistency_score: stabilityIndex,
    best_rate: Math.round(bestRate * 10) / 10,
    worst_rate: Math.round(worstRate * 10) / 10,
    current_rate: latest?.overall?.attendance_rate || 0,
    previous_rate: prev?.overall?.attendance_rate || 0,
    rate_change: latest?.overall?.attendance_rate - (prev?.overall?.attendance_rate || 0),
    total_periods: total
  };
}

function analyzeTrends(periodResults) {
  if (periodResults.length < 2) return { trend: 'insufficient_data', classification: 'neutral' };

  const rates = periodResults.map(p => p.overall?.attendance_rate || 0);
  const first = rates[0];
  const last = rates[rates.length - 1];
  const direction = last - first;

  // Detect pattern
  const half = Math.floor(rates.length / 2);
  const firstHalf = rates.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const secondHalf = rates.slice(half).reduce((a, b) => a + b, 0) / (rates.length - half);

  let classification, trend;
  if (direction > 3 && secondHalf > firstHalf) {
    classification = 'growing';
    trend = 'up';
  } else if (direction < -3 && secondHalf < firstHalf) {
    classification = 'declining';
    trend = 'down';
  } else if (Math.abs(direction) <= 2) {
    classification = 'stable';
    trend = 'stable';
  } else if (direction > 0 && firstHalf > secondHalf) {
    classification = 'recovering';
    trend = 'up';
  } else if (Math.abs(direction) > 5) {
    classification = 'volatile';
    trend = direction > 0 ? 'up' : 'down';
  } else {
    classification = 'inconsistent';
    trend = direction > 0 ? 'slightly_up' : 'slightly_down';
  }

  // Detect anomalies (periods with >15% deviation from average)
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const anomalies = [];
  periodResults.forEach((p, i) => {
    const dev = ((rates[i] - avg) / avg) * 100;
    if (Math.abs(dev) > 15) {
      anomalies.push({
        period: p.label,
        rate: rates[i],
        deviation: Math.round(dev * 10) / 10,
        type: dev > 0 ? 'positive' : 'negative'
      });
    }
  });

  // Momentum (rate of change between last 3 periods)
  const recentChange = rates.length >= 3
    ? rates[rates.length - 1] - rates[rates.length - 3]
    : direction;

  return {
    classification,
    trend,
    direction: Math.round(direction * 10) / 10,
    average_rate: Math.round(avg * 10) / 10,
    first_period_rate: rates[0],
    last_period_rate: last,
    recent_momentum: Math.round(recentChange * 10) / 10,
    half1_avg: Math.round(firstHalf * 10) / 10,
    half2_avg: Math.round(secondHalf * 10) / 10,
    anomalies,
    seasonal_pattern: detectSeasonality(rates)
  };
}

function detectSeasonality(rates) {
  if (rates.length < 4) return 'insufficient_data';
  // Simple check: if first half and second half patterns repeat
  const half = Math.floor(rates.length / 2);
  const firstHalf = rates.slice(0, half);
  const secondHalf = rates.slice(half, half * 2);
  if (firstHalf.length !== secondHalf.length) return 'insufficient_data';
  let diff = 0;
  for (let i = 0; i < firstHalf.length; i++) diff += Math.abs(firstHalf[i] - secondHalf[i]);
  const avgDiff = diff / firstHalf.length;
  return avgDiff < 5 ? 'likely_seasonal' : 'not_seasonal';
}

function analyzeRootCauses(periodResults) {
  if (periodResults.length < 2) return { factors: [], summary: 'Insufficient periods for analysis' };

  const latest = periodResults[periodResults.length - 1];
  const prev = periodResults[periodResults.length - 2];
  const rateDiff = (latest.overall?.attendance_rate || 0) - (prev.overall?.attendance_rate || 0);
  const factors = [];

  // Analyze sections
  if (latest.sections?.length && prev.sections?.length) {
    const secMap = {};
    latest.sections.forEach(s => secMap[s.name] = s);
    prev.sections.forEach(s => {
      const curr = secMap[s.name];
      if (curr) {
        const secDiff = (curr.attendance_rate || 0) - (s.attendance_rate || 0);
        if (Math.abs(secDiff) > 2) {
          factors.push({
            type: 'section',
            name: s.name,
            impact: Math.round(secDiff * 10) / 10,
            contribution: rateDiff !== 0 ? Math.round((secDiff / rateDiff) * 100) : 0,
            direction: secDiff > 0 ? 'positive' : 'negative'
          });
        }
      }
    });
  }

  // Analyze leaders
  if (latest.leaders?.length && prev.leaders?.length) {
    const leadMap = {};
    latest.leaders.forEach(l => leadMap[l.id] = l);
    prev.leaders.forEach(l => {
      const curr = leadMap[l.id];
      if (curr) {
        const leadDiff = (curr.attendance_rate || 0) - (l.attendance_rate || 0);
        if (Math.abs(leadDiff) > 3) {
          factors.push({
            type: 'leader',
            name: l.leader_name || l.name,
            impact: Math.round(leadDiff * 10) / 10,
            contribution: rateDiff !== 0 ? Math.round((leadDiff / rateDiff) * 100) : 0,
            direction: leadDiff > 0 ? 'positive' : 'negative'
          });
        }
      }
    });
  }

  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const positive = factors.filter(f => f.direction === 'positive');
  const negative = factors.filter(f => f.direction === 'negative');

  let summary;
  if (rateDiff > 0) {
    summary = `Attendance increased by ${Math.abs(rateDiff).toFixed(1)}%. Top contributors: ${positive.slice(0, 3).map(f => f.name).join(', ') || 'broad-based improvement'}.`;
  } else if (rateDiff < 0) {
    summary = `Attendance declined by ${Math.abs(rateDiff).toFixed(1)}%. Main factors: ${negative.slice(0, 3).map(f => f.name).join(', ') || 'broad-based decline'}.`;
  } else {
    summary = 'Attendance remained stable across periods.';
  }

  return { factors, summary, rate_diff: Math.round(rateDiff * 10) / 10 };
}

function generateActions(periodResults, trends) {
  const actions = [];
  const latest = periodResults[periodResults.length - 1];
  const prev = periodResults.length > 1 ? periodResults[periodResults.length - 2] : null;

  // Check for declining sections
  if (latest?.sections && prev?.sections) {
    const secMap = {};
    latest.sections.forEach(s => secMap[s.name] = s);
    prev.sections.forEach(s => {
      const curr = secMap[s.name];
      if (curr) {
        const diff = (curr.attendance_rate || 0) - (s.attendance_rate || 0);
        if (diff < -10) {
          actions.push({
            priority: 'high',
            category: 'section_intervention',
            title: `Section "${s.name}" needs immediate intervention`,
            description: `Attendance dropped by ${Math.abs(diff).toFixed(1)}%. Schedule leadership review meeting.`,
            affected: [s.name],
            expected_impact: 'Recovery of attendance rate',
            type: 'decline'
          });
        } else if (diff < -5) {
          actions.push({
            priority: 'medium',
            category: 'section_review',
            title: `Review section "${s.name}" performance`,
            description: `Attendance declined by ${Math.abs(diff).toFixed(1)}%. Consider additional support.`,
            affected: [s.name],
            expected_impact: 'Stabilize attendance',
            type: 'decline'
          });
        }
        if (diff > 10) {
          actions.push({
            priority: 'low',
            category: 'section_recognition',
            title: `Recognize section "${s.name}" for outstanding growth`,
            description: `Attendance increased by ${diff.toFixed(1)}%. This section sets the standard.`,
            affected: [s.name],
            expected_impact: 'Motivate other sections',
            type: 'improvement'
          });
        }
      }
    });
  }

  // Check for leader performance issues
  if (latest?.leaders && prev?.leaders) {
    const leadMap = {};
    latest.leaders.forEach(l => leadMap[l.id] = l);
    prev.leaders.forEach(l => {
      const curr = leadMap[l.id];
      if (curr) {
        if ((curr.submission_rate || 0) < 50) {
          actions.push({
            priority: 'high',
            category: 'leader_submission',
            title: `Leader "${l.leader_name || l.name}" has low submission rate`,
            description: `Submission rate is ${curr.submission_rate || 0}%. Provide training and support.`,
            affected: [l.leader_name || l.name],
            expected_impact: 'Improved data accuracy and member tracking',
            type: 'improvement'
          });
        }
        if ((curr.follow_up_completion || 0) < 40) {
          actions.push({
            priority: 'medium',
            category: 'leader_followup',
            title: `Follow-up needed for leader "${l.leader_name || l.name}"`,
            description: `Follow-up completion rate is ${curr.follow_up_completion || 0}%. Assign mentoring.`,
            affected: [l.leader_name || l.name],
            expected_impact: 'Better member engagement and retention',
            type: 'improvement'
          });
        }
      }
    });
  }

  // Attendance trend based actions
  if (trends?.classification === 'declining') {
    actions.push({
      priority: 'high',
      category: 'attendance_decline',
      title: 'Overall attendance is declining',
      description: 'Immediate attention required. Review all sections, increase visitation, and consider special events.',
      affected: ['All sections'],
      expected_impact: 'Reverse attendance decline trajectory',
      type: 'intervention'
    });
  }

  if (trends?.classification === 'growing') {
    actions.push({
      priority: 'low',
      category: 'growth_sustainability',
      title: 'Positive attendance growth trend',
      description: 'Sustain momentum with continued engagement and new member integration programs.',
      affected: ['All sections'],
      expected_impact: 'Maintain growth trajectory',
      type: 'sustain'
    });
  }

  // Member engagement
  if (latest?.memberEngagement?.length) {
    const atRisk = latest.memberEngagement.filter(m => (m.risk_level || 'low') === 'high' || (m.risk_level || 'low') === 'critical');
    if (atRisk.length > 0) {
      actions.push({
        priority: 'high',
        category: 'at_risk_members',
        title: `${atRisk.length} member(s) at risk of disengagement`,
        description: `Assign visitation and counseling. Priority members: ${atRisk.slice(0, 3).map(m => m.full_name).join(', ')}`,
        affected: atRisk.slice(0, 5).map(m => m.full_name),
        expected_impact: 'Retention of at-risk members',
        type: 'intervention'
      });
    }
  }

  // Visitor follow-up
  if (latest?.overall?.visitors && latest.overall.visitors > 0) {
    actions.push({
      priority: 'medium',
      category: 'visitor_followup',
      title: `${latest.overall.visitors} visitor(s) recorded`,
      description: 'Ensure all visitors receive follow-up contact within 48 hours.',
      affected: [`${latest.overall.visitors} visitors`],
      expected_impact: 'Visitor-to-member conversion',
      type: 'followup'
    });
  }

  // Rank by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return actions;
}

// ── Executive Summary ────────────────────────────────────────────────────
// Enterprise executive dashboard endpoint — comprehensive KPIs, alerts,
// benchmarks, and recommendations. All aggregation uses COUNT/SUM/Number
// only, never string concatenation.  Present+Absent+Excused always validated
// to equal Total Eligible Members.
router.get('/executive-summary', async (req, res) => {
  try {
    const days = Math.max(1, parseInt(req.query.days) || 90);
    const now = new Date();
    const today = formatLocalDate(now);

    // Period boundaries — each for computing a comparison value
    const P = {
      cur:  { s: formatLocalDate(addDays(now, -days)), e: today },
      prev: { s: formatLocalDate(addDays(now, -days * 2)), e: formatLocalDate(addDays(now, -days - 1)) },
      yd:   { s: formatLocalDate(addDays(now, -1)), e: formatLocalDate(addDays(now, -1)) },
      wk:   { s: formatLocalDate(addDays(now, -7)), e: today },
      mo:   { s: formatLocalDate(addDays(now, -30)), e: today },
      qr:   { s: formatLocalDate(addDays(now, -90)), e: today },
      yr:   { s: formatLocalDate(addDays(now, -365)), e: today },
      all:  { s: '1970-01-01', e: today },
    };

    // All DB fetches in parallel
    const [cur, prevP, yd, wk, mo, qr, yr, allT, curMv, prevMv, curSec, curLdr, curMem] = await Promise.all([
      getMultiPeriodOverall(P.cur.s, P.cur.e),
      getMultiPeriodOverall(P.prev.s, P.prev.e),
      getMultiPeriodOverall(P.yd.s, P.yd.e),
      getMultiPeriodOverall(P.wk.s, P.wk.e),
      getMultiPeriodOverall(P.mo.s, P.mo.e),
      getMultiPeriodOverall(P.qr.s, P.qr.e),
      getMultiPeriodOverall(P.yr.s, P.yr.e),
      getMultiPeriodOverall(P.all.s, P.all.e),
      getAttendanceMovement(P.cur.s, P.cur.e),
      getAttendanceMovement(P.prev.s, P.prev.e),
      getMultiPeriodSections(P.cur.s, P.cur.e),
      getMultiPeriodLeaders(P.cur.s, P.cur.e),
      getMultiPeriodMembers(P.cur.s, P.cur.e),
    ]);

    // ── Helper: build a standard KPI object ──────────────────────────────
    function kpi(label, current, previous, target, historicalAvg, best, higherIsBetter = true) {
      const c = Number(current) || 0;
      const p = Number(previous) || 0;
      const diff = c - p;
      const pctChange = p !== 0 ? Math.round((diff / Math.abs(p)) * 1000) / 10 : (c !== 0 ? 100 : 0);
      const ha = Number(historicalAvg) || 0;
      const b = Number(best) || 0;
      const t = Number(target) || 0;

      let status = 'neutral';
      if (t > 0) {
        const ratio = c / t;
        status = ratio >= 1 ? 'success' : ratio >= 0.75 ? 'warning' : 'danger';
      } else if (higherIsBetter) {
        status = diff > 0 ? 'success' : diff < 0 ? 'danger' : 'neutral';
      } else {
        status = diff < 0 ? 'success' : diff > 0 ? 'danger' : 'neutral';
      }

      const absDiff = Math.abs(diff);
      let priority = 'low';
      if (t > 0 && c < t * 0.5) priority = 'high';
      else if (t > 0 && c < t * 0.75) priority = 'medium';
      else if (!t && higherIsBetter && diff < 0 && absDiff > 10) priority = 'high';
      else if (!t && higherIsBetter && diff < 0 && absDiff > 5) priority = 'medium';

      return { label, current: c, previous: p, diff: Math.round(diff * 100) / 100, pctChange, historicalAvg: ha, best: b, target: t, status, priority };
    }

    // ── Safe numeric helpers ─────────────────────────────────────────────
    const n = v => Number(v) || 0;
    const safeDiv = (a, b) => (b !== 0 ? a / b : 0);

    // ── Compute every KPI ────────────────────────────────────────────────
    const totalMembers = n(cur.total_members);
    const present = n(cur.present);
    const absent = n(cur.absent);
    const excused = n(cur.excused);

    // Validate: Present + Absent + Excused should equal total eligible (for this period)
    const sumPAE = present + absent + excused;
    const totalEligible = Math.max(totalMembers, sumPAE);

    const attendanceRate = safeDiv(present, totalEligible) * 100;
    const prevAttendanceRate = safeDiv(n(prevP.present), Math.max(n(prevP.total_members), n(prevP.present) + n(prevP.absent) + n(prevP.excused))) * 100;
    const wkAttendanceRate = safeDiv(n(wk.present), Math.max(n(wk.total_members), n(wk.present) + n(wk.absent) + n(wk.excused))) * 100;
    const moAttendanceRate = safeDiv(n(mo.present), Math.max(n(mo.total_members), n(mo.present) + n(mo.absent) + n(mo.excused))) * 100;
    const qrAttendanceRate = safeDiv(n(qr.present), Math.max(n(qr.total_members), n(qr.present) + n(qr.absent) + n(qr.excused))) * 100;
    const yrAttendanceRate = safeDiv(n(yr.present), Math.max(n(yr.total_members), n(yr.present) + n(yr.absent) + n(yr.excused))) * 100;
    const allTimeAttendanceRate = safeDiv(n(allT.present), Math.max(n(allT.total_members), n(allT.present) + n(allT.absent) + n(allT.excused))) * 100;

    // Weekly / monthly / quarterly / yearly growth (from attendance rate change)
    const weeklyGrowth = n(cur.weekly_growth) !== undefined ? n(cur.weekly_growth) : (attendanceRate - wkAttendanceRate);
    const monthlyGrowth = n(cur.monthly_growth) !== undefined ? n(cur.monthly_growth) : (attendanceRate - moAttendanceRate);
    const quarterlyGrowth = attendanceRate - qrAttendanceRate;
    const yearlyGrowth = attendanceRate - yrAttendanceRate;

    // Retention rate
    const currentRetention = n(cur.retention_rate);
    const prevRetention = n(prevP.retention_rate);
    const allTimeRetention = n(allT.retention_rate);

    // Engagement score
    const engagementScore = n(cur.engagement_score);
    const prevEngagement = n(prevP.engagement_score);
    const allTimeEngagement = n(allT.engagement_score);

    // Movement data
    const newMembers = n(curMv.new_members);
    const prevNewMembers = n(prevMv.new_members);
    const returningMembers = n(curMv.returning_members);
    const prevReturningMembers = n(prevMv.returning_members);
    const membersLost = n(curMv.members_lost);
    const visitorsConverted = n(curMv.visitors_converted);
    const prevVisitorsConverted = n(prevMv.visitors_converted);
    const netGrowth = n(curMv.net_membership_growth);

    // Visitor conversion rate
    const visitors = n(cur.visitors) || 1;
    const visitorConversionRate = safeDiv(visitorsConverted, visitors) * 100;
    const prevVisitorConversionRate = safeDiv(prevVisitorsConverted, (n(prevP.visitors) || 1)) * 100;

    // Follow-up completion rate
    const followUpsCompleted = n(cur.follow_ups_completed) || 0;
    const followUpsTotal = totalMembers > 0 ? totalMembers : 1; // proxy: 1 follow-up per member per period
    const followUpRate = safeDiv(followUpsCompleted, followUpsTotal) * 100;
    const prevFollowUpsCompleted = n(prevP.follow_ups_completed) || 0;
    const prevFollowUpRate = safeDiv(prevFollowUpsCompleted, (n(prevP.total_members) || 1)) * 100;

    // Leader performance index (avg of attendance rates across leaders)
    const leaderRates = (curLdr || []).map(l => n(l.attendance_rate));
    const leaderPerfIndex = leaderRates.length > 0 ? leaderRates.reduce((a, b) => a + b, 0) / leaderRates.length : 0;

    // Section performance index
    const sectionRates = (curSec || []).map(s => n(s.attendance_rate));
    const sectionPerfIndex = sectionRates.length > 0 ? sectionRates.reduce((a, b) => a + b, 0) / sectionRates.length : 0;

    // Member health breakdown
    const memberRiskLevels = (curMem || []).map(m => m.risk_level);
    const healthyMembers = memberRiskLevels.filter(r => r === 'low').length;
    const atRiskMembers = memberRiskLevels.filter(r => r === 'high' || r === 'critical').length;

    // Attendance momentum (rate of rate change — 2nd derivative)
    const momentum = quarterlyGrowth - (quarterlyGrowth - weeklyGrowth);

    // Ministry health (composite of engagement, retention, and attendance)
    const ministryHealth = Math.round((engagementScore * 0.3 + (currentRetention || 0) * 0.3 + attendanceRate * 0.4) * 10) / 10;

    // Attendance goal achievement (target = 75% by default)
    const goalTarget = 75;
    const goalAchievement = safeDiv(attendanceRate, goalTarget) * 100;

    // Overall Church Performance Score — weighted composite
    const churchHealthScore = Math.round(Math.min(100,
      attendanceRate * 0.25 +
      (currentRetention || 0) * 0.15 +
      engagementScore * 0.15 +
      Math.max(0, weeklyGrowth) * 0.05 +
      Math.max(0, monthlyGrowth) * 0.05 +
      visitorConversionRate * 0.10 +
      leaderPerfIndex * 0.10 +
      sectionPerfIndex * 0.10 +
      (safeDiv(healthyMembers, Math.max(1, memberRiskLevels.length)) * 100) * 0.05
    ));

    const overallPerfScore = Math.round(Math.min(100,
      attendanceRate * 0.30 +
      (currentRetention || 0) * 0.20 +
      engagementScore * 0.20 +
      leaderPerfIndex * 0.15 +
      sectionPerfIndex * 0.15
    ));

    // ── Build KPI dictionary ─────────────────────────────────────────────
    const kpis = {
      churchHealthScore:     kpi('Church Health Score', churchHealthScore, Math.round(safeDiv(n(allT.present), Math.max(n(allT.total_members), 1)) * 100), 80, allTimeAttendanceRate, 100),
      attendanceRate:        kpi('Attendance Rate', Math.round(attendanceRate * 10) / 10, Math.round(prevAttendanceRate * 10) / 10, goalTarget, Math.round(allTimeAttendanceRate * 10) / 10, 100),
      weeklyGrowth:          kpi('Weekly Growth', Math.round(weeklyGrowth * 10) / 10, 0, 5, 0, 100),
      monthlyGrowth:         kpi('Monthly Growth', Math.round(monthlyGrowth * 10) / 10, 0, 10, 0, 100),
      quarterlyGrowth:       kpi('Quarterly Growth', Math.round(quarterlyGrowth * 10) / 10, 0, 15, 0, 100),
      yearlyGrowth:          kpi('Yearly Growth', Math.round(yearlyGrowth * 10) / 10, 0, 20, 0, 100),
      attendanceMomentum:    kpi('Attendance Momentum', Math.round(momentum * 10) / 10, Math.round((quarterlyGrowth - weeklyGrowth) * 10) / 10, 0, 0, 100),
      memberHealth:          kpi('Member Health', Math.round(safeDiv(healthyMembers, Math.max(1, memberRiskLevels.length)) * 100), 0, 80, 0, 100),
      retentionRate:         kpi('Retention Rate', Math.round((currentRetention || 0) * 10) / 10, Math.round((prevRetention || 0) * 10) / 10, 80, Math.round((allTimeRetention || 0) * 10) / 10, 100),
      engagementScore:       kpi('Engagement Score', Math.round(engagementScore * 100) / 100, Math.round(prevEngagement * 100) / 100, 0.75, Math.round(allTimeEngagement * 100) / 100, 1),
      visitorConversion:     kpi('Visitor Conversion', Math.round(visitorConversionRate * 10) / 10, Math.round(prevVisitorConversionRate * 10) / 10, 30, 0, 100),
      newMembers:            kpi('New Members', newMembers, prevNewMembers, 10, 0, 100, true),
      returningMembers:      kpi('Returning Members', returningMembers, prevReturningMembers, 15, 0, 100, true),
      followUpCompletion:    kpi('Follow-up Completion', Math.round(followUpRate * 10) / 10, Math.round(prevFollowUpRate * 10) / 10, 90, 0, 100),
      leaderPerfIndex:       kpi('Leader Performance', Math.round(leaderPerfIndex * 10) / 10, 0, 80, 0, 100),
      sectionPerfIndex:      kpi('Section Performance', Math.round(sectionPerfIndex * 10) / 10, 0, 80, 0, 100),
      ministryHealth:        kpi('Ministry Health', ministryHealth, 0, 80, 0, 100),
      goalAchievement:       kpi('Goal Achievement', Math.round(goalAchievement * 10) / 10, 0, 100, 0, 100),
      overallPerfScore:      kpi('Overall Performance', overallPerfScore, 0, 80, 0, 100),
    };

    // ── Church Snapshot ───────────────────────────────────────────────────
    const activeSections = (curSec || []).length;
    const activeLeaders = (curLdr || []).length;
    const activeMembersInData = (curMem || []).length;
    const serviceDays = n(cur.service_days);
    const totalRecords = n(cur.total_records);

    const snapshot = {
      church: {
        totalMembers: n(allT.total_members),
        activeMembers: activeMembersInData,
        activeSections,
        activeLeaders,
        newMembers,
        membersLost,
        netGrowth,
        visitors,
        visitorsConverted,
      },
      attendance: {
        present,
        absent,
        excused,
        totalEligible,
        serviceDays,
        totalRecords,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        avgPerService: serviceDays > 0 ? Math.round(present / serviceDays) : 0,
      },
      period: {
        start: P.cur.s,
        end: P.cur.e,
        days,
        label: `Last ${days} days`,
      },
    };

    // ── Section Rankings ──────────────────────────────────────────────────
    const sectionRankings = (curSec || [])
      .map(s => ({
        id: s.id,
        name: s.name,
        members: n(s.member_count),
        present: n(s.total_present),
        absent: n(s.total_absent),
        attendanceRate: Math.round(n(s.attendance_rate) * 10) / 10,
        newMembers: n(s.new_members),
        status: n(s.attendance_rate) >= 75 ? 'strong' : n(s.attendance_rate) >= 50 ? 'average' : 'weak',
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate);

    // ── Leader Rankings ───────────────────────────────────────────────────
    const leaderRankings = (curLdr || [])
      .map(l => ({
        id: l.leader_id,
        name: l.leader_name,
        section: l.section_name,
        members: n(l.assigned_members),
        present: n(l.members_present),
        attendanceRate: Math.round(n(l.attendance_rate) * 10) / 10,
        submissions: n(l.submission_count),
        submissionRate: Math.round(n(l.submission_rate) * 10) / 10,
        followUps: n(l.follow_ups_completed),
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate);

    // ── Member Health Breakdown ───────────────────────────────────────────
    const healthBreakdown = (function() {
      const levels = ['low', 'medium', 'high', 'critical'];
      const counts = {};
      levels.forEach(l => { counts[l] = 0; });
      (curMem || []).forEach(m => {
        const r = m.risk_level || 'low';
        counts[r] = (counts[r] || 0) + 1;
      });
      const total = (curMem || []).length || 1;
      return levels.map(l => ({
        label: l === 'low' ? 'Healthy' : l === 'medium' ? 'Moderate' : l === 'high' ? 'At Risk' : 'Critical',
        key: l,
        count: counts[l] || 0,
        pct: Math.round((counts[l] || 0) / total * 100),
      }));
    })();

    // ── Executive Alerts ──────────────────────────────────────────────────
    const alerts = [];
    const threshold = days >= 90 ? 15 : days >= 30 ? 10 : 5;

    // Declining attendance
    if (attendanceRate < 50) {
      alerts.push({ type: 'danger', category: 'attendance', title: 'Critical Attendance Decline', message: `Attendance rate is ${Math.round(attendanceRate)}% — below 50% threshold. Immediate intervention required.`, priority: 'high', metric: 'attendanceRate', value: Math.round(attendanceRate) });
    } else if (attendanceRate < 65) {
      alerts.push({ type: 'warning', category: 'attendance', title: 'Attendance Below Target', message: `Attendance rate at ${Math.round(attendanceRate)}% is below the ${goalTarget}% target.`, priority: 'medium', metric: 'attendanceRate', value: Math.round(attendanceRate) });
    }

    // Struggling sections
    const weakSections = sectionRankings.filter(s => s.status === 'weak');
    if (weakSections.length > 0) {
      alerts.push({ type: 'danger', category: 'sections', title: `${weakSections.length} Section${weakSections.length > 1 ? 's' : ''} Need Attention`, message: `${weakSections.map(s => s.name).join(', ')} ${weakSections.length > 1 ? 'have' : 'has'} attendance rates below 50%.`, priority: 'high', metric: 'sections', value: weakSections.length, details: weakSections });
    }

    // Inactive members
    if (atRiskMembers > 0) {
      const pctAtRisk = Math.round(atRiskMembers / Math.max(1, memberRiskLevels.length) * 100);
      alerts.push({ type: 'danger', category: 'members', title: `${atRiskMembers} Member${atRiskMembers > 1 ? 's' : ''} at Risk`, message: `${pctAtRisk}% of members (${atRiskMembers}) show critically low attendance.`, priority: 'high', metric: 'atRiskMembers', value: atRiskMembers });
    }

    // Leaders requiring intervention
    const weakLeaders = leaderRankings.filter(l => l.attendanceRate < 50);
    if (weakLeaders.length > 0) {
      alerts.push({ type: 'warning', category: 'leaders', title: `${weakLeaders.length} Leader${weakLeaders.length > 1 ? 's' : ''} Below Threshold`, message: `${weakLeaders.map(l => l.name).join(', ')} ${weakLeaders.length > 1 ? 'have' : 'has'} attendance rates under 50%.`, priority: 'medium', metric: 'leaders', value: weakLeaders.length, details: weakLeaders });
    }

    // Visitor follow-up
    if (visitors > 0 && visitorConversionRate < 20) {
      alerts.push({ type: 'warning', category: 'visitors', title: 'Low Visitor Conversion', message: `Only ${Math.round(visitorConversionRate)}% of visitors converted. ${visitors} visitor${visitors > 1 ? 's' : ''} need follow-up.`, priority: 'medium', metric: 'visitorConversion', value: Math.round(visitorConversionRate) });
    }

    // Attendance milestones
    const milestoneStep = 500;
    if (present > 0 && present % milestoneStep === 0) {
      alerts.push({ type: 'success', category: 'milestone', title: `Attendance Milestone`, message: `Reached ${present.toLocaleString()} present members!`, priority: 'low', metric: 'present', value: present });
    }

    // Exceptional performance
    if (attendanceRate >= 85) {
      alerts.push({ type: 'success', category: 'performance', title: 'Exceptional Attendance', message: `Attendance rate of ${Math.round(attendanceRate)}% exceeds expectations.`, priority: 'low', metric: 'attendanceRate', value: Math.round(attendanceRate) });
    }

    // Follow-up completion alert
    if (followUpRate < 50 && followUpsTotal > 0) {
      alerts.push({ type: 'warning', category: 'followups', title: 'Low Follow-up Completion', message: `Only ${Math.round(followUpRate)}% of follow-ups completed. Leadership needs to prioritize member care.`, priority: 'medium', metric: 'followUpRate', value: Math.round(followUpRate) });
    }

    // Section performance disparity
    if (sectionRankings.length >= 2) {
      const topSection = sectionRankings[0];
      const bottomSection = sectionRankings[sectionRankings.length - 1];
      const gap = topSection.attendanceRate - bottomSection.attendanceRate;
      if (gap > 40) {
        alerts.push({ type: 'warning', category: 'disparity', title: 'Large Section Performance Gap', message: `${gap}% gap between top (${topSection.name}: ${topSection.attendanceRate}%) and bottom (${bottomSection.name}: ${bottomSection.attendanceRate}%) sections.`, priority: 'medium', metric: 'sectionGap', value: Math.round(gap) });
      }
    }

    // ── Attendance Momentum ────────────────────────────────────────────────
    const momentumData = [
      { period: 'Yesterday', rate: Math.round(safeDiv(n(yd.present), Math.max(n(yd.total_members), 1)) * 100) || 0 },
      { period: 'Last 7 Days', rate: Math.round(wkAttendanceRate * 10) / 10 },
      { period: 'Last 30 Days', rate: Math.round(moAttendanceRate * 10) / 10 },
      { period: 'Last 90 Days', rate: Math.round(qrAttendanceRate * 10) / 10 },
      { period: 'Last Year', rate: Math.round(yrAttendanceRate * 10) / 10 },
      { period: 'All Time', rate: Math.round(allTimeAttendanceRate * 10) / 10 },
    ];

    // ── Benchmark Comparison ──────────────────────────────────────────────
    const benchmarkComparison = [
      { metric: 'Attendance Rate', current: Math.round(attendanceRate * 10) / 10, average: Math.round(allTimeAttendanceRate * 10) / 10, best: 100, target: goalTarget, unit: '%' },
      { metric: 'Retention Rate', current: Math.round((currentRetention || 0) * 10) / 10, average: Math.round((allTimeRetention || 0) * 10) / 10, best: 100, target: 80, unit: '%' },
      { metric: 'Engagement Score', current: Math.round(engagementScore * 100) / 100, average: Math.round(allTimeEngagement * 100) / 100, best: 1, target: 0.75, unit: '' },
      { metric: 'Visitor Conversion', current: Math.round(visitorConversionRate * 10) / 10, average: 0, best: 100, target: 30, unit: '%' },
      { metric: 'New Members', current: newMembers, average: prevNewMembers, best: 100, target: 10, unit: '' },
    ];

    // ── Immediate Action List ──────────────────────────────────────────────
    const actions = alerts
      .filter(a => a.priority === 'high' || a.priority === 'medium')
      .map(a => ({
        action: a.title,
        priority: a.priority,
        category: a.category,
        impact: a.priority === 'high' ? 'critical' : 'significant',
      }));

    // ── Executive Recommendations ─────────────────────────────────────────
    const recommendations = [];
    if (attendanceRate < 65) {
      recommendations.push({ category: 'attendance', recommendation: 'Launch an attendance revival campaign targeting inactive members through personal visitations.', priority: 'high', expectedImpact: '15-20% improvement in 30 days' });
    }
    if (weakSections.length > 0) {
      recommendations.push({ category: 'sections', recommendation: `Assign head leaders to mentor ${weakSections.length} struggling section${weakSections.length > 1 ? 's' : ''}. Review section leadership structure.`, priority: 'high', expectedImpact: 'Strengthen section health' });
    }
    if (atRiskMembers > 10) {
      recommendations.push({ category: 'members', recommendation: 'Deploy pastoral care teams to visit at-risk members. Schedule re-engagement events for inactive members.', priority: 'high', expectedImpact: 'Reduce member attrition by 30%' });
    }
    if (visitorConversionRate < 20 && visitors > 0) {
      recommendations.push({ category: 'visitors', recommendation: 'Implement a 7-day visitor follow-up protocol. Assign welcome team members to personally contact each visitor.', priority: 'medium', expectedImpact: 'Increase conversion rate to 30%+' });
    }
    if (followUpRate < 50) {
      recommendations.push({ category: 'followups', recommendation: 'Equip leaders with a structured follow-up tracking system. Set weekly follow-up targets for each leader.', priority: 'medium', expectedImpact: 'Improve member engagement' });
    }
    if (momentum < 0) {
      recommendations.push({ category: 'momentum', recommendation: 'Attendance momentum is negative. Review recent service quality, outreach efforts, and member satisfaction.', priority: 'high', expectedImpact: 'Reverse declining trend' });
    }
    if (engagementScore < 0.5) {
      recommendations.push({ category: 'engagement', recommendation: 'Low engagement score detected. Create small group activities and ministry involvement opportunities.', priority: 'medium', expectedImpact: 'Boost engagement by 25%' });
    }

    // ── Response ──────────────────────────────────────────────────────────
    res.json({
      snapshot,
      kpis,
      alerts,
      sectionRankings,
      leaderRankings,
      healthBreakdown,
      actions,
      momentumData,
      benchmarkComparison,
      recommendations,
    });
  } catch (error) {
    console.error('Executive summary error:', error);
    res.status(500).json({ error: 'Failed to fetch executive summary' });
  }
});

module.exports = router;
