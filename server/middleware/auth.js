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

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return requireRole(['admin', 'leader', 'pastor'])(req, res, next);
  }
  res.status(401).json({ error: 'Not authenticated' });
}

module.exports = { requireRole, isAuthenticated, rolePermissions };
