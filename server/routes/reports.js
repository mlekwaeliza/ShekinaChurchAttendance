const express = require('express');
const router = express.Router();
const { all, get } = require('../database');
const { yearMonth, dayOfWeek } = require('../utils/sqlDialect');
const { isAuthenticated, requireRole, validateDateRange } = require('../middleware/auth');

router.use(isAuthenticated, requireRole(['admin']), validateDateRange());

const isPostgres = () => String(process.env.DB_CLIENT || '').toLowerCase() === 'postgres';

const REPORT_TYPES = {
  attendance: {
    label: 'Attendance Report',
    description: 'Comprehensive attendance data with trends and analysis',
  },
  membership: {
    label: 'Membership Report',
    description: 'Member demographics, growth, and retention metrics',
  },
  leadership: {
    label: 'Leadership Report',
    description: 'Leader performance, rankings, and workload analysis',
  },
  finance: {
    label: 'Finance Report',
    description: 'Contributions, expenses, and financial trends',
  },
  evangelism: {
    label: 'Evangelism Report',
    description: 'Outreach events, souls won, and baptism tracking',
  },
  newMembers: {
    label: 'New Members Report',
    description: 'New member pipeline, stages, and conversion rates',
  },
  homeCells: {
    label: 'Home Cells Report',
    description: 'Home cell attendance, growth, and engagement',
  },
  children: {
    label: 'Children Ministry Report',
    description: 'Classes, enrollment, attendance, and promotions',
  },
};

// GET /api/admin/reports/types
router.get('/types', async (req, res) => {
  res.json(REPORT_TYPES);
});

// GET /api/admin/reports/attendance
router.get('/attendance', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const [overall, bySection, byDate, byDayOfWeek, topPerformers, riskMembers] = await Promise.all([
      get(`
        SELECT 
          COUNT(DISTINCT member_id) as total_attendees,
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN status = 'excused' THEN 1 END) as excused_count,
          COUNT(DISTINCT date) as service_days,
          ROUND(CAST(COUNT(CASE WHEN status = 'present' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) AS NUMERIC), 1) as attendance_rate
        FROM attendance WHERE date BETWEEN ? AND ?
      `, [start, end]),
      all(`
        SELECT s.name as section_name,
          COUNT(DISTINCT a.member_id) as total_attendees,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
          ROUND(CAST(COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) AS NUMERIC), 1) as attendance_rate
        FROM attendance a JOIN members m ON a.member_id = m.id JOIN sections s ON m.section_id = s.id
        WHERE a.date BETWEEN ? AND ? AND m.is_active = 1
        GROUP BY s.id, s.name ORDER BY attendance_rate DESC
      `, [start, end]),
      all(`
        SELECT date, 
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
          COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
          COUNT(CASE WHEN status = 'excused' THEN 1 END) as excused
        FROM attendance WHERE date BETWEEN ? AND ?
        GROUP BY date ORDER BY date
      `, [start, end]),
      all(`
        SELECT CASE ${dayOfWeek('date')}
          WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday' END as day_name,
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
          COUNT(*) as total
        FROM attendance WHERE date BETWEEN ? AND ?
        GROUP BY ${dayOfWeek('date')} ORDER BY ${dayOfWeek('date')}
      `, [start, end]),
      all(`
        SELECT m.id, m.full_name as name, s.name as section_name,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as attended,
          COUNT(*) as total,
          ROUND(CAST(COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) AS NUMERIC), 1) as rate
        FROM members m JOIN attendance a ON m.id = a.member_id JOIN sections s ON m.section_id = s.id
        WHERE a.date BETWEEN ? AND ? AND m.is_active = 1
        GROUP BY m.id ORDER BY rate DESC LIMIT 20
      `, [start, end]),
      all(`
        SELECT m.id, m.full_name as name, s.name as section_name,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as attended,
          COUNT(*) as total,
          ROUND(CAST(COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) AS NUMERIC), 1) as rate
        FROM members m JOIN attendance a ON m.id = a.member_id JOIN sections s ON m.section_id = s.id
        WHERE a.date BETWEEN ? AND ? AND m.is_active = 1
        GROUP BY m.id HAVING rate < 30 ORDER BY rate ASC LIMIT 20
      `, [start, end]),
    ]);

    res.json({
      reportType: 'attendance',
      period: { start, end },
      overall: overall || {},
      bySection,
      byDate,
      byDayOfWeek,
      topPerformers,
      riskMembers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({ error: 'Failed to generate attendance report' });
  }
});

// GET /api/admin/reports/membership
router.get('/membership', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const ageCaseSql = isPostgres()
      ? `CASE 
          WHEN EXTRACT(YEAR FROM age(date_of_birth::date)) < 13 THEN 'Children (0-12)'
          WHEN EXTRACT(YEAR FROM age(date_of_birth::date)) < 18 THEN 'Youth (13-17)'
          WHEN EXTRACT(YEAR FROM age(date_of_birth::date)) < 30 THEN 'Young Adult (18-29)'
          WHEN EXTRACT(YEAR FROM age(date_of_birth::date)) < 50 THEN 'Adult (30-49)'
          WHEN EXTRACT(YEAR FROM age(date_of_birth::date)) < 65 THEN 'Senior (50-64)'
          ELSE 'Elder (65+)'
        END`
      : `CASE 
          WHEN CAST((julianday('now') - julianday(date_of_birth)) / 365.25 AS INTEGER) < 13 THEN 'Children (0-12)'
          WHEN CAST((julianday('now') - julianday(date_of_birth)) / 365.25 AS INTEGER) < 18 THEN 'Youth (13-17)'
          WHEN CAST((julianday('now') - julianday(date_of_birth)) / 365.25 AS INTEGER) < 30 THEN 'Young Adult (18-29)'
          WHEN CAST((julianday('now') - julianday(date_of_birth)) / 365.25 AS INTEGER) < 50 THEN 'Adult (30-49)'
          WHEN CAST((julianday('now') - julianday(date_of_birth)) / 365.25 AS INTEGER) < 65 THEN 'Senior (50-64)'
          ELSE 'Elder (65+)'
        END`;

    const [overview, bySection, byGender, byAgeGroup, recentJoins, topSections] = await Promise.all([
      get(`
        SELECT 
          COUNT(*) as total_members,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_members,
          COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_members,
          COUNT(CASE WHEN created_at BETWEEN ? AND ? THEN 1 END) as new_joins,
          COUNT(CASE WHEN gender = 'Male' THEN 1 END) as male_count,
          COUNT(CASE WHEN gender = 'Female' THEN 1 END) as female_count
        FROM members
      `, [start, end]),
      all(`
        SELECT s.name as section_name,
          COUNT(*) as total,
          COUNT(CASE WHEN m.is_active = 1 THEN 1 END) as active,
          COUNT(CASE WHEN m.created_at BETWEEN ? AND ? THEN 1 END) as new_joins
        FROM members m JOIN sections s ON m.section_id = s.id
        GROUP BY s.id, s.name ORDER BY active DESC
      `, [start, end]),
      all(`
        SELECT COALESCE(gender, 'Unknown') as gender, COUNT(*) as count
        FROM members WHERE is_active = 1 GROUP BY gender
      `),
      all(`
        SELECT ${ageCaseSql} as age_group, COUNT(*) as count
        FROM members WHERE is_active = 1 AND date_of_birth IS NOT NULL
        GROUP BY age_group ORDER BY age_group
      `),
      all(`
        SELECT m.id, m.full_name as name, s.name as section_name, m.created_at as join_date
        FROM members m JOIN sections s ON m.section_id = s.id
        WHERE m.created_at BETWEEN ? AND ? AND m.is_active = 1
        ORDER BY m.created_at DESC LIMIT 20
      `, [start, end]),
      all(`
        SELECT s.name as section_name,
          COUNT(CASE WHEN m.is_active = 1 THEN 1 END) as active_members,
          ROUND(CAST(COUNT(CASE WHEN m.is_active = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) AS NUMERIC), 1) as retention_rate
        FROM members m JOIN sections s ON m.section_id = s.id
        GROUP BY s.id, s.name ORDER BY active_members DESC LIMIT 10
      `),
    ]);

    res.json({
      reportType: 'membership',
      period: { start, end },
      overview: overview || {},
      bySection,
      byGender,
      byAgeGroup,
      recentJoins,
      topSections,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Membership report error:', error);
    res.status(500).json({ error: 'Failed to generate membership report' });
  }
});

// GET /api/admin/reports/leadership
router.get('/leadership', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const [overview, rankings, workload, submissionRates] = await Promise.all([
      get(`
        SELECT 
          COUNT(*) as total_leaders,
          COUNT(CASE WHEN l.is_head = 1 THEN 1 END) as head_leaders,
          COUNT(*) as active_leaders
        FROM leaders l
      `),
      all(`
        SELECT l.id, u.username,
          COALESCE(u.full_name, u.username) as name,
          s.name as section_name,
          COUNT(DISTINCT sl.date) as submissions,
          COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.member_id END) as members_present,
          COUNT(DISTINCT a.member_id) as total_members
        FROM leaders l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN sections s ON l.section_id = s.id
        LEFT JOIN submission_log sl ON l.id = sl.leader_id AND sl.date BETWEEN ? AND ?
        LEFT JOIN attendance a ON sl.date = a.date AND a.member_id IN (
          SELECT id FROM members WHERE section_id = l.section_id AND is_active = 1
        )
        GROUP BY l.id ORDER BY submissions DESC
      `, [start, end]),
      all(`
        SELECT l.id, u.username,
          COALESCE(u.full_name, u.username) as name,
          s.name as section_name,
          (SELECT COUNT(*) FROM members WHERE section_id = l.section_id AND is_active = 1) as member_count,
          (SELECT COUNT(*) FROM home_cell_leaders WHERE leader_id = l.id) as home_cells,
          (SELECT COUNT(*) FROM leaders WHERE section_id = l.section_id) as peers
        FROM leaders l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN sections s ON l.section_id = s.id
        ORDER BY member_count DESC
      `),
      all(`
        SELECT l.id, u.username,
          COALESCE(u.full_name, u.username) as name,
          COUNT(DISTINCT sl.date) as total_submissions,
          COUNT(DISTINCT CASE WHEN a.status = 'present' THEN sl.date END) as days_with_attendance
        FROM leaders l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN submission_log sl ON l.id = sl.leader_id AND sl.date BETWEEN ? AND ?
        LEFT JOIN attendance a ON a.date = sl.date
          AND a.member_id IN (
            SELECT id FROM members WHERE section_id = l.section_id AND is_active = 1
          )
        GROUP BY l.id ORDER BY total_submissions DESC
      `, [start, end]),
    ]);

    res.json({
      reportType: 'leadership',
      period: { start, end },
      overview: overview || {},
      rankings,
      workload,
      submissionRates,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Leadership report error:', error);
    res.status(500).json({ error: 'Failed to generate leadership report' });
  }
});

// GET /api/admin/reports/finance
router.get('/finance', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const ymExpr = yearMonth('c.payment_date');

    const [overview, byType, byMonth, expenses, topContributors] = await Promise.all([
      get(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_contributions,
          COUNT(DISTINCT member_id) as unique_contributors,
          COUNT(DISTINCT payment_date) as contribution_days,
          ROUND(COALESCE(SUM(amount), 0) / NULLIF(COUNT(DISTINCT payment_date), 0), 2) as avg_per_day
        FROM contributions WHERE payment_date BETWEEN ? AND ?
      `, [start, end]),
      all(`
        SELECT ct.name as type_name, 
          COALESCE(SUM(c.amount), 0) as total,
          COUNT(*) as count
        FROM contribution_types ct
        LEFT JOIN contributions c ON ct.id = c.contribution_type_id AND c.payment_date BETWEEN ? AND ?
        WHERE ct.is_active = 1
        GROUP BY ct.id, ct.name ORDER BY total DESC
      `, [start, end]),
      all(`
        SELECT ${ymExpr} as month,
          COALESCE(SUM(c.amount), 0) as total
        FROM contributions c WHERE c.payment_date BETWEEN ? AND ?
        GROUP BY month ORDER BY month
      `, [start, end]),
      all(`
        SELECT COALESCE(fe.description, fe.category) as description,
          fe.amount, fdr.record_date as date, fe.category
        FROM finance_daily_records fdr
        JOIN finance_expenses fe ON fe.record_id = fdr.id
        WHERE fdr.record_date BETWEEN ? AND ?
        ORDER BY fe.amount DESC LIMIT 20
      `, [start, end]),
      all(`
        SELECT m.id, m.full_name as name,
          COALESCE(SUM(c.amount), 0) as total_contributed,
          COUNT(*) as contribution_count
        FROM members m JOIN contributions c ON m.id = c.member_id
        WHERE c.payment_date BETWEEN ? AND ? AND m.is_active = 1
        GROUP BY m.id ORDER BY total_contributed DESC LIMIT 20
      `, [start, end]),
    ]);

    res.json({
      reportType: 'finance',
      period: { start, end },
      overview: overview || {},
      byType,
      byMonth,
      expenses,
      topContributors,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Finance report error:', error);
    res.status(500).json({ error: 'Failed to generate finance report' });
  }
});

// GET /api/admin/reports/evangelism
router.get('/evangelism', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const ymExpr = yearMonth('date_saved');

    const [overview, byMonth, followUps, baptisms, teamStats] = await Promise.all([
      get(`
        SELECT 
          COUNT(*) as total_souls_won,
          COUNT(CASE WHEN follow_up_status IN ('joined_cell', 'joined_church', 'baptized', 'active_member') THEN 1 END) as follow_ups_completed,
          COUNT(CASE WHEN follow_up_status = 'new_convert' THEN 1 END) as follow_ups_pending,
          COUNT(CASE WHEN follow_up_status = 'under_follow_up' THEN 1 END) as follow_ups_in_progress
        FROM souls_won WHERE date_saved BETWEEN ? AND ?
      `, [start, end]),
      all(`
        SELECT ${ymExpr} as month,
          COUNT(*) as souls_won
        FROM souls_won WHERE date_saved BETWEEN ? AND ?
        GROUP BY month ORDER BY month
      `, [start, end]),
      all(`
        SELECT COUNT(*) as total,
          COUNT(CASE WHEN last_contact_date IS NOT NULL THEN 1 END) as completed,
          COUNT(CASE WHEN last_contact_date IS NULL THEN 1 END) as pending
        FROM follow_ups WHERE created_at BETWEEN ? AND ?
      `, [start, end]),
      all(`
        SELECT 
          COUNT(*) as total_baptisms,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
          COUNT(CASE WHEN status = 'candidate' THEN 1 END) as candidates
        FROM baptism_tracking
      `),
      all(`
        SELECT role as team_name, COUNT(*) as member_count,
          COALESCE(SUM(souls_won), 0) as souls_won
        FROM evangelism_team
        WHERE is_active = 1
        GROUP BY role
        ORDER BY member_count DESC
      `),
    ]);

    res.json({
      reportType: 'evangelism',
      period: { start, end },
      overview: overview || {},
      byMonth,
      followUps: followUps || {},
      baptisms: baptisms || {},
      teamStats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Evangelism report error:', error);
    res.status(500).json({ error: 'Failed to generate evangelism report' });
  }
});

// GET /api/admin/reports/new-members
router.get('/new-members', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const ymExpr = yearMonth('created_at');

    const [overview, byStage, byMonth, recentMembers, conversionRates] = await Promise.all([
      get(`
        SELECT 
          COUNT(*) as total_new_members,
          COUNT(CASE WHEN status IN ('graduated', 'permanent') THEN 1 END) as active,
          COUNT(CASE WHEN status = 'probation' THEN 1 END) as inactive
        FROM new_members WHERE created_at BETWEEN ? AND ?
      `, [start, end]),
      all(`
        SELECT COALESCE(pipeline_stage, 'received') as stage, COUNT(*) as count
        FROM new_members WHERE created_at BETWEEN ? AND ?
        GROUP BY COALESCE(pipeline_stage, 'received') ORDER BY
          CASE COALESCE(pipeline_stage, 'received')
            WHEN 'received' THEN 1 WHEN 'orientation_scheduled' THEN 2
            WHEN 'orientation_in_progress' THEN 3 WHEN 'orientation_completed' THEN 4
            WHEN 'home_cell_assigned' THEN 5 WHEN 'section_assigned' THEN 6
            WHEN 'mentor_assigned' THEN 7 WHEN 'ministry_placement' THEN 8
            WHEN 'graduation_review' THEN 9 WHEN 'permanent' THEN 10 ELSE 11
          END
      `, [start, end]),
      all(`
        SELECT ${ymExpr} as month,
          COUNT(*) as count
        FROM new_members WHERE created_at BETWEEN ? AND ?
        GROUP BY month ORDER BY month
      `, [start, end]),
      all(`
        SELECT nm.id, nm.full_name as name,
          COALESCE(nm.pipeline_stage, 'received') as stage,
          nm.created_at as join_date,
          nm.phone, nm.email
        FROM new_members nm
        WHERE nm.created_at BETWEEN ? AND ?
        ORDER BY nm.created_at DESC LIMIT 20
      `, [start, end]),
      all(`
        SELECT 
          COUNT(CASE WHEN pipeline_stage = 'permanent' THEN 1 END) * 100.0 /
          NULLIF(COUNT(*), 0) as conversion_rate
        FROM new_members WHERE created_at BETWEEN ? AND ?
      `, [start, end]),
    ]);

    res.json({
      reportType: 'newMembers',
      period: { start, end },
      overview: overview || {},
      byStage,
      byMonth,
      recentMembers,
      conversionRates: conversionRates || {},
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('New members report error:', error);
    res.status(500).json({ error: 'Failed to generate new members report' });
  }
});

// GET /api/admin/reports/home-cells
router.get('/home-cells', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const leadersAgg = isPostgres()
      ? `(SELECT STRING_AGG(COALESCE(u.full_name, u.username), ', ')
          FROM home_cell_leaders hcl
          JOIN leaders l ON hcl.leader_id = l.id
          JOIN users u ON l.user_id = u.id
          WHERE hcl.cell_id = hc.id)`
      : `(SELECT GROUP_CONCAT(COALESCE(u.full_name, u.username), ', ')
          FROM home_cell_leaders hcl
          JOIN leaders l ON hcl.leader_id = l.id
          JOIN users u ON l.user_id = u.id
          WHERE hcl.cell_id = hc.id)`;

    const [overview, byCell, topCells] = await Promise.all([
      get(`
        SELECT 
          COUNT(DISTINCT hc.id) as total_cells,
          COUNT(DISTINCT hcm.id) as total_members,
          COUNT(DISTINCT hcl.leader_id) as total_leaders
        FROM home_cells hc
        LEFT JOIN home_cell_members hcm ON hc.id = hcm.cell_id AND hcm.is_active = 1
        LEFT JOIN home_cell_leaders hcl ON hc.id = hcl.cell_id
        WHERE hc.is_active = 1
      `),
      all(`
        SELECT hc.name as cell_name, hc.cell_number,
          (SELECT COUNT(*) FROM home_cell_members WHERE cell_id = hc.id AND is_active = 1) as member_count,
          ${leadersAgg} as leaders
        FROM home_cells hc WHERE hc.is_active = 1 ORDER BY member_count DESC
      `),
      all(`
        SELECT hc.name as cell_name,
          (SELECT COUNT(*) FROM home_cell_members WHERE cell_id = hc.id AND is_active = 1) as member_count
        FROM home_cells hc WHERE hc.is_active = 1
        ORDER BY member_count DESC LIMIT 10
      `),
    ]);

    res.json({
      reportType: 'homeCells',
      period: { start, end },
      overview: overview || {},
      byCell,
      topCells,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Home cells report error:', error);
    res.status(500).json({ error: 'Failed to generate home cells report' });
  }
});

// GET /api/admin/reports/children
router.get('/children', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const [overview, byClass, attendanceTrends, recentPromotions, medicalAlerts] = await Promise.all([
      get(`
        SELECT 
          (SELECT COUNT(*) FROM children WHERE is_active = 1) as total_children,
          (SELECT COUNT(*) FROM children_classes WHERE is_active = 1) as total_classes,
          (SELECT COUNT(*) FROM children_teachers WHERE is_active = 1) as total_teachers
      `),
      all(`
        SELECT cc.name as class_name, cc.age_group,
          (SELECT COUNT(*) FROM children WHERE class_id = cc.id AND is_active = 1) as enrolled,
          cc.max_capacity,
          (SELECT COUNT(*) FROM children_attendance ca WHERE ca.class_id = cc.id AND ca.date BETWEEN ? AND ? AND ca.status = 'present') as attendance_count
        FROM children_classes cc WHERE cc.is_active = 1 ORDER BY enrolled DESC
      `, [start, end]),
      all(`
        SELECT ca.date,
          COUNT(CASE WHEN ca.status = 'present' THEN 1 END) as present,
          COUNT(*) as total
        FROM children_attendance ca WHERE ca.date BETWEEN ? AND ?
        GROUP BY ca.date ORDER BY ca.date
      `, [start, end]),
      all(`
        SELECT cp.promotion_date, ch.full_name as child_name, 
          fc.name as from_class, tc.name as to_class
        FROM children_promotions cp
        JOIN children ch ON cp.child_id = ch.id
        LEFT JOIN children_classes fc ON cp.from_class_id = fc.id
        JOIN children_classes tc ON cp.to_class_id = tc.id
        WHERE cp.promotion_date BETWEEN ? AND ?
        ORDER BY cp.promotion_date DESC LIMIT 10
      `, [start, end]),
      all(`
        SELECT full_name, medical_notes, allergies
        FROM children WHERE is_active = 1 
        AND (medical_notes IS NOT NULL AND medical_notes != '' OR allergies IS NOT NULL AND allergies != '')
      `),
    ]);

    res.json({
      reportType: 'children',
      period: { start, end },
      overview: overview || {},
      byClass,
      attendanceTrends,
      recentPromotions,
      medicalAlerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Children report error:', error);
    res.status(500).json({ error: 'Failed to generate children ministry report' });
  }
});

// GET /api/admin/reports/export/:type - Export report as CSV
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { start_date, end_date } = req.query;
    
    const start = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    let csvData = [];
    let filename = `${type}_report_${start}_to_${end}.csv`;

    if (type === 'attendance') {
      csvData = await all(`
        SELECT a.date, m.full_name as member_name, s.name as section_name,
          a.status, a.reason
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        JOIN sections s ON m.section_id = s.id
        WHERE a.date BETWEEN ? AND ?
        ORDER BY a.date, m.full_name
      `, [start, end]);
    } else if (type === 'membership') {
      csvData = await all(`
        SELECT m.full_name, m.email, m.phone, m.gender,
          s.name as section_name, m.created_at as join_date, m.is_active
        FROM members m JOIN sections s ON m.section_id = s.id
        ORDER BY m.full_name
      `);
    } else if (type === 'finance') {
      csvData = await all(`
        SELECT c.payment_date, m.full_name as contributor_name,
          ct.name as contribution_type, c.amount, c.notes
        FROM contributions c
        JOIN members m ON c.member_id = m.id
        JOIN contribution_types ct ON c.contribution_type_id = ct.id
        WHERE c.payment_date BETWEEN ? AND ?
        ORDER BY c.payment_date DESC
      `, [start, end]);
    }

    if (csvData.length === 0) {
      return res.status(404).json({ error: 'No data found for this report type' });
    }

    const headers = Object.keys(csvData[0]);
    const csvRows = [headers.join(',')];
    for (const row of csvData) {
      csvRows.push(headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

module.exports = router;
