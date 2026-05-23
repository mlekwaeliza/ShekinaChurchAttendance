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

function auditLog(req, res, next) {
  const method = req.method;
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return next();
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let capturedBody = null;
  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };
  res.send = (body) => {
    capturedBody = body;
    return originalSend(body);
  };

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
      const newValue = method !== 'DELETE' ? sanitizeBody(req.body) : null;

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

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  delete sanitized._oldValue;
  delete sanitized.password;
  delete sanitized.password_hash;
  return sanitized;
}

module.exports = { auditLog };
