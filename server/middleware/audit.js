const { queries } = require('../database');

const ENTITY_MAP = {
  '/api/admin/members': 'member',
  '/api/admin/sections': 'section',
  '/api/admin/leaders': 'leader',
  '/api/admin/attendance': 'attendance',
  '/api/leader/members': 'member',
  '/api/leader/attendance': 'attendance',
  '/api/auth/profile': 'user',
  '/api/auth/profile-picture': 'user',
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
  member: new Set(['section_id', 'leader_id', 'is_active', 'status', 'flags', 'opt_out_services', 'hide_from_birthday_list', 'show_age_to_leaders']),
  leader: new Set(['section_id', 'is_head', 'is_active', 'phone_last4']),
  section: new Set(['name']),
  user: new Set(['full_name', 'role']),
  attendance: new Set(['date', 'status', 'service_type_id', 'service_id']),
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

      const oldValue = method !== 'POST' && req.body?._oldValue ? req.body._oldValue : null;
      const newValue = method !== 'DELETE' ? sanitizeBody(req.body, entityType) : null;

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
