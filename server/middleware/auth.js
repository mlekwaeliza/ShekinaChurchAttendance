const { queries } = require('../database');

const rolePermissions = {
  admin: ['admin', 'leader', 'pastor'],
  leader: ['leader'],
  pastor: ['pastor']
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

    return requireRole(['admin', 'leader', 'pastor'])(req, res, next);
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

module.exports = { requireRole, isAuthenticated, rolePermissions, validateDate };
