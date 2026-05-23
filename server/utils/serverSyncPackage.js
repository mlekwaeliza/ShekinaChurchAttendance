const { all } = require('../database');
const { inspectPackage, commitPackage } = require('./offlineAttendanceImport');

const SERVER_SYNC_SCHEMA = 'church-attendance-server-sync/v1';
const OFFLINE_PACKAGE_SCHEMA = 'church-attendance-offline-package/v1';

function assertDate(value, label) {
  if (value !== undefined && value !== null && value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new Error(`${label} must use YYYY-MM-DD format`);
  }
}

function normalizeDateFilter(value) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null;
}

function toPackageDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function buildWhereClause(filters = {}) {
  const clauses = [];
  const params = [];
  const startDate = normalizeDateFilter(filters.startDate);
  const endDate = normalizeDateFilter(filters.endDate);
  const serviceId = filters.serviceId && filters.serviceId !== 'all' ? Number.parseInt(filters.serviceId, 10) : null;

  if (startDate) {
    clauses.push('sl.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    clauses.push('sl.date <= ?');
    params.push(endDate);
  }
  if (serviceId) {
    clauses.push('sl.service_id = ?');
    params.push(serviceId);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

async function createServerSyncPackage(filters = {}) {
  assertDate(filters.startDate, 'start_date');
  assertDate(filters.endDate, 'end_date');

  const { sql, params } = buildWhereClause(filters);
  const submissions = await all(`
    SELECT
      sl.leader_id,
      sl.section_id,
      sl.date,
      sl.service_id,
      sl.created_at,
      u.full_name AS leader_name,
      s.name AS section_name,
      st.name AS service_name
    FROM submission_log sl
    JOIN leaders l ON l.id = sl.leader_id
    JOIN users u ON u.id = l.user_id
    JOIN sections s ON s.id = sl.section_id
    JOIN service_types st ON st.id = sl.service_id
    ${sql}
    ORDER BY sl.date ASC, sl.service_id ASC, s.name ASC, u.full_name ASC
  `, params);

  const packages = [];
  let totalRows = 0;

  for (const submission of submissions) {
    const attendance = await all(`
      SELECT
        a.member_id,
        m.membership_id,
        m.full_name,
        a.status
      FROM attendance a
      JOIN members m ON m.id = a.member_id
      WHERE a.date = ?
        AND a.service_type_id = ?
        AND m.leader_id = ?
        AND m.section_id = ?
      ORDER BY m.full_name ASC
    `, [submission.date, submission.service_id, submission.leader_id, submission.section_id]);

    if (!attendance.length) continue;
    const attendanceDate = toPackageDate(submission.date);
    totalRows += attendance.length;

    packages.push({
      schema: OFFLINE_PACKAGE_SCHEMA,
      package_id: `server-sync-${attendanceDate}-${submission.service_id}-${submission.leader_id}`,
      generated_at: new Date().toISOString(),
      source: 'server_sync',
      date: attendanceDate,
      service_id: submission.service_id,
      service_name: submission.service_name,
      leader: {
        id: submission.leader_id,
        name: submission.leader_name
      },
      section: {
        id: submission.section_id,
        name: submission.section_name
      },
      attendance
    });
  }

  return {
    schema: SERVER_SYNC_SCHEMA,
    generated_at: new Date().toISOString(),
    filters: {
      start_date: normalizeDateFilter(filters.startDate),
      end_date: normalizeDateFilter(filters.endDate),
      service_id: filters.serviceId || 'all'
    },
    summary: {
      submissions: packages.length,
      attendance_rows: totalRows
    },
    packages
  };
}

function normalizeServerSyncPackage(syncPackage) {
  if (!syncPackage || typeof syncPackage !== 'object') {
    throw new Error('Sync package is required');
  }
  if (syncPackage.schema !== SERVER_SYNC_SCHEMA) {
    throw new Error('Unsupported sync package format');
  }
  if (!Array.isArray(syncPackage.packages)) {
    throw new Error('Sync package must contain packages');
  }
  return syncPackage;
}

async function inspectServerSyncPackage(syncPackage) {
  const normalized = normalizeServerSyncPackage(syncPackage);
  const results = [];

  for (const offlinePackage of normalized.packages) {
    const { summary } = await inspectPackage(offlinePackage);
    results.push(summary);
  }

  return summarizeResults(results);
}

async function commitServerSyncPackage(syncPackage, options = {}) {
  const normalized = normalizeServerSyncPackage(syncPackage);
  const results = [];

  for (const offlinePackage of normalized.packages) {
    const summary = await commitPackage(offlinePackage, {
      source: 'admin_upload',
      importedByUserId: options.importedByUserId || null,
      originalFilename: options.originalFilename || 'server-sync-package.json'
    });
    results.push(summary);
  }

  return summarizeResults(results);
}

function summarizeResults(results) {
  return {
    package_count: results.length,
    total_rows: results.reduce((sum, item) => sum + (item.total_rows || 0), 0),
    insertable: results.reduce((sum, item) => sum + (item.insertable || 0), 0),
    imported: results.reduce((sum, item) => sum + (item.imported || 0), 0),
    duplicates: results.reduce((sum, item) => sum + (item.duplicates || 0), 0),
    conflicts: results.reduce((sum, item) => sum + (item.conflicts || 0), 0),
    invalid: results.reduce((sum, item) => sum + (item.invalid || 0), 0),
    already_imported: results.filter((item) => item.already_imported || item.status === 'duplicate_package').length,
    packages: results
  };
}

module.exports = {
  SERVER_SYNC_SCHEMA,
  createServerSyncPackage,
  inspectServerSyncPackage,
  commitServerSyncPackage
};
