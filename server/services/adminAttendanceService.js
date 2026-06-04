const { all } = require('../database');
const { addDays, formatLocalDate } = require('../utils/date');
const { yearEquals, monthEquals, weekEquals, dateOnly } = require('../utils/sqlDialect');

async function listAttendance(filters = {}) {
  const { date, section_id, leader_id, filterType, filterValue } = filters;

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

  if (filterType && filterValue) {
    if (filterType === 'daily') {
      query += ` AND ${dateOnly('a.date')} = ?`;
      params.push(filterValue);
    } else if (filterType === 'yearly') {
      query += ` AND ${yearEquals('a.date')}`;
      params.push(filterValue);
    } else if (filterType === 'monthly') {
      query += ` AND ${monthEquals('a.date')}`;
      params.push(filterValue);
    } else if (filterType === 'weekly') {
      const parts = String(filterValue).split('-W');
      query += ` AND ${weekEquals('a.date')}`;
      params.push(`${parts[0]}-${parts[1].padStart(2, '0')}`);
    }
  } else if (date) {
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

  return all(query, params);
}

function getAttendanceHistory(serviceId = 'all') {
  const serviceCondition = serviceId === 'all' ? '' : 'WHERE a.service_type_id = ?';
  const params = serviceId === 'all' ? [] : [serviceId];

  return all(`
    SELECT
      a.date,
      COALESCE(MAX(sl.created_at), MAX(a.submitted_at)) as submitted_at,
      u.full_name as leader_name,
      s.name as section_name,
      COALESCE(st.name, 'Selected service') as service_name,
      COUNT(DISTINCT a.id) as records_count
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON m.section_id = s.id
    LEFT JOIN service_types st ON a.service_type_id = st.id
    LEFT JOIN submission_log sl
      ON sl.leader_id = l.id
     AND sl.date = a.date
     AND sl.service_id = a.service_type_id
    ${serviceCondition}
    GROUP BY a.date, a.service_type_id, st.name, l.id, u.full_name, s.name
    ORDER BY a.date DESC, submitted_at DESC
    LIMIT 200
  `, params);
}

async function getAttendanceTrends(days = 90) {
  const parsedDays = parseInt(days, 10);
  const endDate = formatLocalDate();
  const startDate = formatLocalDate(addDays(new Date(), -parsedDays));
  const trends = await all(`
    SELECT
      date,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count,
      COUNT(*) as total_members
    FROM attendance
    WHERE date >= ? AND date <= ?
    GROUP BY date
    ORDER BY date ASC
  `, [startDate, endDate]);

  return { trends: trends || [], date_range: { start: startDate, end: endDate } };
}

module.exports = {
  getAttendanceHistory,
  getAttendanceTrends,
  listAttendance
};
