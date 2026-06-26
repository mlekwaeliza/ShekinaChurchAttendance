const express = require('express');
const { queries } = require('../database');
const { isAuthenticated, requireRole, validateDateRange } = require('../middleware/auth');
const { addDays, formatLocalDate, parseDateInput } = require('../utils/date');

const router = express.Router();

// All analytics routes require authentication + admin or pastor role
router.use(isAuthenticated);
router.use(requireRole(['admin', 'pastor']));

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
    const members = await queries.getMemberIntelligence(days);
    res.json(members);
  } catch (error) {
    console.error('Member intelligence error:', error);
    res.status(500).json({ error: 'Failed to fetch member intelligence' });
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

module.exports = router;
