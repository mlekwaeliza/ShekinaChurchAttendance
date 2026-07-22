const { queries } = require('./database');

async function logAudit(userId, action, entityType, entityId, details) {
  try {
    await queries.createAuditEntry(
      userId || null,
      action,
      entityType,
      entityId || null,
      null,
      details || null,
      null,
      null
    );
  } catch (e) {
    console.error('[audit] failed to log', action, e.message);
  }
}

module.exports = { logAudit };
