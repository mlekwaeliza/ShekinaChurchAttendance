const express = require('express');
const { queries } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
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
      const recentAvg = recentWeeks.slice(0, 2).reduce((s, w) => s + w.rate, 0) / 2;
      const olderAvg = recentWeeks.slice(2, 4).reduce((s, w) => s + w.rate, 0) / 2;
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
router.get('/leader-trends', async (req, res) => {
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

    // Fetch last session for this service (for empty state UI)
    const { all: allDb } = require('../database');
    let lastSession = null;
    if (serviceId !== 'all') {
      const lastSessions = await allDb(
        `SELECT date, COUNT(*) as total, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present
         FROM attendance WHERE service_type_id = ? GROUP BY date ORDER BY date DESC LIMIT 1`,
        [serviceId]
      );
      if (lastSessions.length > 0) {
        lastSession = lastSessions[0];
      }
    }

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
      todayStats: todayStats || { present: 0, absent: 0, excused: 0 }
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

module.exports = router;
