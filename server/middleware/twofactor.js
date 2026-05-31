const { queries } = require('../database');

function requires2FA(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.session.twoFactorVerified) {
    return next();
  }

  res.status(403).json({ error: 'Two-factor authentication required', requires2FA: true });
}

async function checkUser2FA(req, res, next) {
  if (!req.session.userId) {
    return next();
  }

  try {
    const user2FA = await queries.getUser2FA(req.session.userId);
    if (user2FA && user2FA.totp_enabled) {
      if (!req.session.twoFactorVerified) {
        return res.json({ requires2FA: true });
      }
    }
    next();
  } catch (error) {
    console.error('2FA check error:', error);
    next();
  }
}

module.exports = { requires2FA, checkUser2FA };
