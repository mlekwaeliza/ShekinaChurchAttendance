const { queries } = require('../database');

const rolePermissions = {
  admin: ['admin', 'leader', 'pastor', 'evangelist'],
  leader: ['leader'],
  pastor: ['pastor'],
  evangelist: ['evangelist']
};

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.session.user?.role;
    if (!userRole) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Cache the totp_enabled flag in the session after login/2FA to avoid a DB
// hit on every authenticated request. The flag is set explicitly on:
//  - successful password login (auth.js /login)
//  - successful 2FA verification (twofactor.js /verify-login)
//  - when 2FA is enabled/disabled (twofactor.js /enable, /disable)
// The session itself is the trust boundary; this is read-only after auth.
async function isAuthenticated(req, res, next) {
  if (req.session.userId && req.session.user) {
    // Require 2FA if the session flag says it's enabled but not yet verified.
    if (req.session.totpEnabled === true && !req.session.twoFactorVerified) {
      return res.status(401).json({
        error: 'Two-step verification required',
        requires2FA: true,
        userId: req.session.userId,
      });
    }

    return requireRole(['admin', 'leader', 'pastor', 'evangelist'])(req, res, next);
  }
  res.status(401).json({ error: 'Not authenticated' });
}

function validateDate(paramName = 'date') {
  return (req, res, next) => {
    const dateStr = req.params[paramName] || req.query[paramName];
    if (!dateStr) return next();
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(dateStr)) {
      return res.status(400).json({ error: `Invalid date format for ${paramName}. Use YYYY-MM-DD` });
    }
    const parsed = new Date(dateStr + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ error: `Invalid date value for ${paramName}` });
    }
    next();
  };
}

// L11-fix: validate a [start, end] date range in req.query. Rejects
// swapped ranges (start > end) and anything outside YYYY-MM-DD.
function validateDateRange(startParam = 'start_date', endParam = 'end_date') {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return (req, res, next) => {
    const start = req.query[startParam];
    const end = req.query[endParam];
    if (start && !isoDateRegex.test(start)) {
      return res.status(400).json({ error: `Invalid ${startParam} (use YYYY-MM-DD)` });
    }
    if (end && !isoDateRegex.test(end)) {
      return res.status(400).json({ error: `Invalid ${endParam} (use YYYY-MM-DD)` });
    }
    if (start && end && start > end) {
      return res.status(400).json({ error: `${startParam} must be on or before ${endParam}` });
    }
    // Optional range cap to prevent extremely large window queries.
    if (start && end) {
      const startMs = new Date(start + 'T00:00:00').getTime();
      const endMs = new Date(end + 'T00:00:00').getTime();
      const days = Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
      if (days > 365 * 5) {
        return res.status(400).json({ error: 'Date range cannot exceed 5 years' });
      }
    }
    next();
  };
}

module.exports = { requireRole, isAuthenticated, rolePermissions, validateDate, validateDateRange };
