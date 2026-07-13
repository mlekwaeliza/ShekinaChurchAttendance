const { queries, get } = require('../database');

const rolePermissions = {
  admin: ['admin', 'leader', 'pastor', 'evangelist'],
  leader: ['leader'],
  pastor: ['pastor'],
  evangelist: ['evangelist']
};

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.session.userId || !req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.session.user.role)) {
      console.error(`[requireRole] 403: path=${req.path}, session.role="${req.session.user.role}", allowed=[${roles}]`);
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
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
    // Refresh user data from DB on every request to keep role in sync
    // (handles stale sessions from previous logins or role changes).
    try {
      const dbUser = await get('SELECT id, username, role, full_name, is_new_member_leader FROM users WHERE id = ?', [req.session.userId]);
      if (dbUser) {
        req.session.user = { id: dbUser.id, username: dbUser.username, role: dbUser.role, full_name: dbUser.full_name, is_new_member_leader: dbUser.is_new_member_leader };
      } else {
        // User not found by ID — try username fallback
        const username = req.session.user?.username;
        if (username) {
          const byUsername = await get('SELECT id, username, role, full_name, is_new_member_leader FROM users WHERE username = ?', [username]);
          if (byUsername) {
            req.session.userId = byUsername.id;
            req.session.user = { id: byUsername.id, username: byUsername.username, role: byUsername.role, full_name: byUsername.full_name, is_new_member_leader: byUsername.is_new_member_leader };
          }
        }
      }
    } catch (e) {
      console.error('isAuthenticated: failed to refresh user from DB:', e.stack || e);
    }

    // Require 2FA if the session flag says it's enabled but not yet verified.
    if (req.session.totpEnabled === true && !req.session.twoFactorVerified) {
      return res.status(401).json({
        error: 'Two-step verification required',
        requires2FA: true,
        userId: req.session.userId,
      });
    }

    // If we still have a valid user after DB refresh, allow through.
    if (req.session.userId && req.session.user) {
      return next();
    }
    return res.status(401).json({ error: 'Not authenticated' });
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
