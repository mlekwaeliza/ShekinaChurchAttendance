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

async function isAuthenticated(req, res, next) {
  if (req.session.userId && req.session.user) {
    try {
      const twoFactor = await queries.getUser2FA(req.session.userId);
      if (twoFactor?.totp_enabled && !req.session.twoFactorVerified) {
        return res.status(401).json({
          error: 'Two-step verification required',
          requires2FA: true,
          userId: req.session.userId,
        });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to verify authentication state' });
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
