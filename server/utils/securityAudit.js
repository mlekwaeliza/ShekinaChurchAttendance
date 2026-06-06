// I5-fix: security-event audit helper.
//
// Centralized logger for security-sensitive events that don't
// otherwise have a "before" / "after" entity to log. The events
// covered are:
//
//   - login_success / login_failure
//   - logout
//   - 2fa_enabled / 2fa_disabled / 2fa_login_success / 2fa_login_failure
//   - password_changed
//   - session_regenerated
//   - csrf_violation
//   - rate_limited
//   - account_locked
//   - permission_denied
//
// Each event becomes a row in audit_log with entity_type='security'.
// The PII logger (utils/piiLogger) redacts any accidentally-leaked
// password/email/etc. before stdout.

const { queries } = require('../database');

function safeStringify(v, maxLen = 1024) {
  try {
    const s = JSON.stringify(v);
    if (s.length > maxLen) return s.slice(0, maxLen) + '...';
    return s;
  } catch (_) {
    return String(v).slice(0, maxLen);
  }
}

function recordSecurityEvent(event, userId, details, req) {
  const payload = {
    event,
    userId: userId || null,
    requestId: req?.id || req?.headers?.['x-request-id'] || null,
    ip: req?.ip || req?.headers?.['x-forwarded-for'] || null,
    userAgent: req?.headers?.['user-agent'] || null,
    at: new Date().toISOString(),
    ...(details && typeof details === 'object' ? details : { value: details })
  };
  // Best-effort: never throw into the caller.
  try {
    return queries.createAuditEntry(
      userId || null,
      event,
      'security',
      userId || null,
      null,
      safeStringify(payload),
      req?.ip || null,
      req?.headers?.['user-agent'] || null
    );
  } catch (e) {
    console.error('[security-audit] failed to record', event, e.message);
    return null;
  }
}

module.exports = { recordSecurityEvent };
