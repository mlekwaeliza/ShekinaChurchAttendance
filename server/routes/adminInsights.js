const express = require('express');
const { queries } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const { addDays, formatLocalDate } = require('../utils/date');
const { toCsvRow } = require('../utils/csv');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin']));
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

module.exports = router;
