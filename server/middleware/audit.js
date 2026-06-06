const { queries } = require('../database');

const ENTITY_MAP = {
  '/api/admin/members': 'member',
  '/api/admin/sections': 'section',
  '/api/admin/leaders': 'leader',
  '/api/admin/attendance': 'attendance',
  '/api/admin/announcements': 'announcement',
  '/api/admin/follow-up-tasks': 'follow_up_task',
  '/api/admin/visitors': 'visitor',
  '/api/admin/notifications': 'notification',
  '/api/admin/home-cells': 'home_cell',
  '/api/admin/home-cell-members': 'home_cell_member',
  '/api/admin/service-instances': 'service_instance',
  '/api/admin/service-types': 'service_type',
  '/api/admin/backups': 'backup',
  '/api/admin/settings': 'setting',
  '/api/admin/upload-csv': 'csv_import',
  '/api/leader/members': 'member',
  '/api/leader/attendance': 'attendance',
  '/api/leader/home-cell-members': 'home_cell_member',
  '/api/leader/follow-ups': 'follow_up',
  '/api/leader/outreach': 'outreach_log',
  '/api/outreach/log': 'outreach_log',
  '/api/calendar': 'calendar_event',
  '/api/auth/profile': 'user',
  '/api/auth/profile-picture': 'user',
  '/api/auth/change-password': 'user',
  '/api/2fa/setup': 'user_2fa',
  '/api/2fa/verify': 'user_2fa',
  '/api/2fa/disable': 'user_2fa',
  '/api/2fa/regenerate-backup-codes': 'user_2fa',
};

const ACTION_MAP = {
  POST: 'create',
  PUT: 'update',
  DELETE: 'delete',
  PATCH: 'update',
};

const PII_FIELDS = new Set([
  'password', 'password_hash', 'password_reset_token', 'password_reset_expires',
  'phone', 'email', 'address', 'date_of_birth', 'dob',
  'profile_picture', 'profile_picture_url',
]);

const SAFE_FIELDS_BY_ENTITY = {
  member: new Set(['section_id', 'leader_id', 'is_active', 'status', 'flags', 'opt_out_services', 'hide_from_birthday_list', 'show_age_to_leaders', 'membership_id']),
  leader: new Set(['section_id', 'is_head', 'is_active', 'phone_last4', 'username']),
  section: new Set(['name']),
  user: new Set(['full_name', 'role', 'username']),
  attendance: new Set(['date', 'status', 'service_type_id', 'service_id']),
  announcement: new Set(['title', 'is_active', 'audience', 'priority']),
  follow_up_task: new Set(['status', 'priority', 'due_date', 'assigned_to', 'is_active']),
  visitor: new Set(['name', 'visit_date', 'follow_up_status', 'is_active']),
  notification: new Set(['read_at', 'is_read']),
  home_cell: new Set(['name', 'cell_number', 'is_active']),
  home_cell_member: new Set(['is_active', 'cell_id']),
  service_instance: new Set(['date', 'is_active', 'service_type_id']),
  service_type: new Set(['name', 'is_active', 'default_day']),
  backup: new Set(['name', 'created_at']),
  setting: new Set(['key', 'value']),
  csv_import: new Set(['filename', 'row_count']),
  follow_up: new Set(['contacted', 'contact_method', 'notes']),
  outreach_log: new Set(['member_id', 'contact_method', 'outcome', 'service_id', 'message']),
  calendar_event: new Set(['title', 'date', 'is_active', 'assigned_to']),
  user_2fa: new Set(['enabled', 'method']),
};

function hashValue(value) {
  if (value == null) return null;
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function sanitizeBody(body, entityType) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = {};
  const safe = SAFE_FIELDS_BY_ENTITY[entityType] || new Set();
  for (const [key, value] of Object.entries(body)) {
    if (key.startsWith('_')) continue;
    if (PII_FIELDS.has(key)) continue;
    if (safe.has(key) || /_id$/.test(key) || key === 'id') {
      sanitized[key] = value;
    } else {
      // Unknown fields are stored as a short hash so we can still detect changes without leaking PII.
      sanitized[`${key}_hash`] = hashValue(value);
    }
  }
  return sanitized;
}

function auditLog(req, res, next) {
  const method = req.method;
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return next();
  }

  const logEntry = () => {
    try {
      const entityType = getEntityType(req.path);
      if (!entityType) return;

      const action = ACTION_MAP[method] || method.toLowerCase();
      const entityId = extractEntityId(req.path, entityType);
      const ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
      const userAgent = req.headers['user-agent'] || null;
      const userId = req.session?.userId || null;

      // H4-fix: support both legacy 'details' and canonical 'old_value'/'new_value'
      // input field names for backwards compatibility with existing clients.
      const oldValue = extractOldValue(req);
      const newValue = method !== 'DELETE' ? extractNewValue(req, entityType) : null;

      queries.createAuditEntry(userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent).catch((err) => {
        console.error('Audit log write failed:', err.message);
      });
    } catch (e) {
      console.error('Audit logging error:', e.message);
    }
  };

  setImmediate(logEntry);
  next();
}

function extractOldValue(req) {
  if (req.method === 'POST') return null;
  const body = req.body || {};
  return body._oldValue || body.old_value || null;
}

function extractNewValue(req, entityType) {
  // H4-fix: support both 'new_value' and the body itself as the new value.
  const body = req.body || {};
  if (body._newValue && typeof body._newValue === 'object') {
    return sanitizeBody(body._newValue, entityType);
  }
  if (body.new_value && typeof body.new_value === 'object') {
    return sanitizeBody(body.new_value, entityType);
  }
  return sanitizeBody(body, entityType);
}

function getEntityType(path) {
  for (const [route, type] of Object.entries(ENTITY_MAP)) {
    if (path.startsWith(route)) return type;
  }
  return null;
}

function extractEntityId(path, entityType) {
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const id = parseInt(lastPart, 10);
  return Number.isNaN(id) ? null : id;
}

module.exports = { auditLog, sanitizeBody };
