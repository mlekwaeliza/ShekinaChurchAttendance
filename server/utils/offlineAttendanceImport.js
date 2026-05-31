const crypto = require('crypto');
const { all, get, run, transaction } = require('../database');

const PACKAGE_SCHEMA = 'church-attendance-offline-package/v1';
const VALID_STATUSES = new Set(['present', 'absent', 'excused']);

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function checksumPackage(pkg) {
  return crypto.createHash('sha256').update(stableJson(pkg)).digest('hex');
}

function parsePositiveId(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} is required`);
  }
  return parsed;
}

function normalizePackage(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    throw new Error('Offline package is required');
  }
  if (pkg.schema !== PACKAGE_SCHEMA) {
    throw new Error('Unsupported offline package format');
  }
  if (!pkg.package_id || typeof pkg.package_id !== 'string') {
    throw new Error('package_id is required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pkg.date || '')) {
    throw new Error('A valid attendance date is required');
  }
  if (!Array.isArray(pkg.attendance) || pkg.attendance.length === 0) {
    throw new Error('Attendance rows are required');
  }

  const serviceId = parsePositiveId(pkg.service_id, 'service_id');
  const leaderId = parsePositiveId(pkg.leader?.id, 'leader.id');
  const sectionId = parsePositiveId(pkg.section?.id, 'section.id');
  const seenMembers = new Set();
  const attendance = pkg.attendance.map((record) => {
    const memberId = parsePositiveId(record.member_id, 'member_id');
    if (seenMembers.has(memberId)) {
      throw new Error(`Duplicate member ${memberId} in offline package`);
    }
    seenMembers.add(memberId);
    if (!VALID_STATUSES.has(record.status)) {
      throw new Error(`Invalid status for member ${memberId}`);
    }
    return {
      member_id: memberId,
      membership_id: record.membership_id || null,
      full_name: record.full_name || null,
      status: record.status
    };
  });

  return {
    package_id: pkg.package_id,
    checksum: checksumPackage(pkg),
    date: pkg.date,
    service_id: serviceId,
    service_name: pkg.service_name || null,
    leader: {
      id: leaderId,
      name: pkg.leader?.name || null
    },
    section: {
      id: sectionId,
      name: pkg.section?.name || null
    },
    attendance,
    raw: pkg
  };
}

async function inspectPackage(pkg, options = {}) {
  const normalized = normalizePackage(pkg);
  if (options.expectedLeaderId && normalized.leader.id !== Number(options.expectedLeaderId)) {
    throw new Error('Offline package belongs to another leader');
  }

  const [existingPackage, leader, service] = await Promise.all([
    get('SELECT * FROM offline_attendance_imports WHERE package_id = ?', [normalized.package_id]),
    get(`
      SELECT l.id, l.section_id, u.full_name as leader_name, s.name as section_name
      FROM leaders l
      JOIN users u ON l.user_id = u.id
      JOIN sections s ON l.section_id = s.id
      WHERE l.id = ? AND l.is_active = 1
    `, [normalized.leader.id]),
    get('SELECT id, name, points_config FROM service_types WHERE id = ? AND is_active = 1', [normalized.service_id])
  ]);

  if (!leader) {
    throw new Error('Leader in offline package was not found');
  }
  if (leader.section_id !== normalized.section.id) {
    throw new Error('Leader and section do not match');
  }
  if (!service) {
    throw new Error('Service in offline package was not found');
  }

  const memberIds = normalized.attendance.map((record) => record.member_id);
  const placeholders = memberIds.map(() => '?').join(',');
  const members = await all(
    `SELECT id, membership_id, full_name, section_id, leader_id FROM members WHERE id IN (${placeholders}) AND is_active = 1`,
    memberIds
  );
  const memberMap = new Map(members.map((member) => [member.id, member]));

  const rowChecks = [];
  for (const record of normalized.attendance) {
    const member = memberMap.get(record.member_id);
    if (!member) {
      rowChecks.push({ ...record, action: 'invalid', reason: 'Member not found or inactive' });
      continue;
    }
    if (member.leader_id !== normalized.leader.id || member.section_id !== normalized.section.id) {
      rowChecks.push({ ...record, action: 'invalid', reason: 'Member no longer belongs to this leader and section' });
      continue;
    }

    const existing = await get(
      'SELECT id, status FROM attendance WHERE member_id = ? AND date = ? AND service_type_id = ?',
      [record.member_id, normalized.date, normalized.service_id]
    );
    if (!existing) {
      rowChecks.push({ ...record, action: 'insert' });
    } else if (existing.status === record.status) {
      rowChecks.push({ ...record, action: 'duplicate' });
    } else {
      rowChecks.push({ ...record, action: 'conflict', existing_status: existing.status });
    }
  }

  const summary = {
    package_id: normalized.package_id,
    checksum: normalized.checksum,
    already_imported: Boolean(existingPackage),
    existing_import: existingPackage || null,
    date: normalized.date,
    service_id: normalized.service_id,
    service_name: normalized.service_name || service.name,
    leader_id: normalized.leader.id,
    leader_name: normalized.leader.name || leader.leader_name,
    section_id: normalized.section.id,
    section_name: normalized.section.name || leader.section_name,
    total_rows: rowChecks.length,
    insertable: rowChecks.filter((row) => row.action === 'insert').length,
    duplicates: rowChecks.filter((row) => row.action === 'duplicate').length,
    conflicts: rowChecks.filter((row) => row.action === 'conflict').length,
    invalid: rowChecks.filter((row) => row.action === 'invalid').length,
    rows: rowChecks
  };

  return { normalized, service, summary };
}

async function commitPackage(pkg, options = {}) {
  const inspection = await inspectPackage(pkg, options);
  const { normalized, service, summary } = inspection;

  if (summary.already_imported) {
    return { ...summary, status: 'duplicate_package', imported: 0 };
  }
  if (summary.invalid > 0) {
    console.warn(`[Offline Import] Skipping ${summary.invalid} invalid or stale rows in offline package ${normalized.package_id}`);
    if (summary.insertable === 0 && summary.duplicates === 0 && summary.conflicts === 0) {
      throw new Error('Offline package contains no valid rows to import');
    }
  }

  const pointsConfig = JSON.parse(service.points_config || '{"present":10,"excused":3}');
  let imported = 0;

  await transaction(async (tx) => {
    for (const row of summary.rows) {
      if (row.action !== 'insert') continue;
      const insertResult = await tx.run(
        `INSERT INTO attendance (member_id, date, status, service_type_id, submitted_by, submitted_at)
         SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
         WHERE NOT EXISTS (
           SELECT 1 FROM attendance WHERE member_id = ? AND date = ? AND service_type_id = ?
         )`,
        [
          row.member_id,
          normalized.date,
          row.status,
          normalized.service_id,
          options.importedByUserId || null,
          row.member_id,
          normalized.date,
          normalized.service_id
        ]
      );
      if (!insertResult.changes) continue;
      imported++;

      const points = row.status === 'present' ? pointsConfig.present : row.status === 'excused' ? pointsConfig.excused : 0;
      if (points > 0) {
        await tx.run('UPDATE members SET hall_of_fame_points = hall_of_fame_points + ? WHERE id = ?', [points, row.member_id]);
      }
    }

    const submission = await tx.get(
      'SELECT id FROM submission_log WHERE leader_id = ? AND date = ? AND service_id = ?',
      [normalized.leader.id, normalized.date, normalized.service_id]
    );
    if (!submission && (imported > 0 || summary.duplicates > 0)) {
      await tx.run(
        'INSERT INTO submission_log (leader_id, section_id, date, service_id) VALUES (?, ?, ?, ?)',
        [normalized.leader.id, normalized.section.id, normalized.date, normalized.service_id]
      );
    }

    const status = summary.conflicts > 0 ? 'partial' : imported > 0 ? 'imported' : 'duplicate_rows';
    await tx.run(
      `INSERT INTO offline_attendance_imports (
        package_id, package_checksum, leader_id, section_id, service_id, attendance_date,
        source, imported_by, status, original_filename, summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized.package_id,
        normalized.checksum,
        normalized.leader.id,
        normalized.section.id,
        normalized.service_id,
        normalized.date,
        options.source || 'admin_upload',
        options.importedByUserId || null,
        status,
        options.originalFilename || null,
        JSON.stringify({ ...summary, imported })
      ]
    );
  });

  return {
    ...summary,
    status: summary.conflicts > 0 ? 'partial' : imported > 0 ? 'imported' : 'duplicate_rows',
    imported
  };
}

async function listRecentImports(limit = 20) {
  return all(`
    SELECT oi.*, u.full_name as imported_by_name, lu.full_name as leader_name, s.name as section_name, st.name as service_name
    FROM offline_attendance_imports oi
    LEFT JOIN users u ON oi.imported_by = u.id
    LEFT JOIN leaders l ON oi.leader_id = l.id
    LEFT JOIN users lu ON l.user_id = lu.id
    LEFT JOIN sections s ON oi.section_id = s.id
    LEFT JOIN service_types st ON oi.service_id = st.id
    ORDER BY oi.created_at DESC
    LIMIT ?
  `, [limit]);
}

module.exports = {
  PACKAGE_SCHEMA,
  normalizePackage,
  inspectPackage,
  commitPackage,
  listRecentImports
};
