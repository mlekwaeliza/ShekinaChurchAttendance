const { all, get } = require('../database');
const { addDays, formatLocalDate } = require('../utils/date');
const { yearEquals, monthEquals, weekEquals, dateOnly, likeClauseCaseInsensitive } = require('../utils/sqlDialect');

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

  query += ' ORDER BY a.date DESC, m.full_name LIMIT 200';

  return all(query, params);
}

async function searchAttendanceForCorrection(filters = {}) {
  const {
    q,
    start_date,
    end_date,
    section_id,
    leader_id,
    service_id,
    status,
    page = 1,
    pageSize = 50,
  } = filters;

  const conditions = ['1=1'];
  const params = [];

  if (q) {
    const trimmed = String(q).trim();
    if (trimmed) {
      const likeOp = likeClauseCaseInsensitive();
      conditions.push(`(m.full_name ${likeOp} OR m.membership_id ${likeOp})`);
      const like = `%${trimmed}%`;
      params.push(like, like);
    }
  }
  if (start_date) {
    conditions.push('a.date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    conditions.push('a.date <= ?');
    params.push(end_date);
  }
  if (section_id) {
    conditions.push('m.section_id = ?');
    params.push(Number(section_id));
  }
  if (leader_id) {
    conditions.push('m.leader_id = ?');
    params.push(Number(leader_id));
  }
  if (service_id && service_id !== 'all') {
    conditions.push('a.service_type_id = ?');
    params.push(Number(service_id));
  }
  if (status && ['present', 'absent', 'excused'].includes(status)) {
    conditions.push('a.status = ?');
    params.push(status);
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * pageSize;

  const rows = await all(
    `SELECT a.id, a.date, a.status, a.service_type_id, a.submitted_at, a.member_id,
            m.full_name AS member_name, m.membership_id, m.section_id,
            s.name AS section_name, l.id AS leader_id,
            u.full_name AS leader_name, st.name AS service_name,
            sub_u.id AS submitted_by_id, sub_u.full_name AS submitted_by_name
       FROM attendance a
       JOIN members m ON a.member_id = m.id
       JOIN sections s ON m.section_id = s.id
       JOIN leaders l ON m.leader_id = l.id
       JOIN users u ON l.user_id = u.id
       LEFT JOIN service_types st ON a.service_type_id = st.id
       LEFT JOIN users sub_u ON a.submitted_by = sub_u.id
      WHERE ${whereClause}
      ORDER BY a.date DESC, a.submitted_at DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const countRow = await get(`SELECT COUNT(*) AS total FROM attendance a JOIN members m ON a.member_id = m.id WHERE ${whereClause}`, params);
  return { rows, total: countRow?.total || 0, page, pageSize };
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
  listAttendance,
  searchAttendanceForCorrection
};
