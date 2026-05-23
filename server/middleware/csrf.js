const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 *
 * Uses double-submit cookie pattern:
 * 1. Generates a token and sets it as a cookie on authenticated requests for safe methods
 * 2. Verifies that the token in request headers matches the cookie for state-changing methods
 *
 * This is appropriate for SPAs using cookie-based authentication.
 */

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function verifyToken(headerToken, cookieToken) {
  if (!headerToken || !cookieToken) return false;
  const headerBuf = Buffer.from(headerToken, 'utf8');
  const cookieBuf = Buffer.from(cookieToken, 'utf8');
  if (headerBuf.length !== cookieBuf.length) return false;
  return crypto.timingSafeEqual(headerBuf, cookieBuf);
}

function csrfProtect(options = {}) {
  const {
    cookieName = 'csrfToken',
    headerName = 'X-CSRF-Token',
    ignoredMethods = ['GET', 'HEAD', 'OPTIONS']
  } = options;

  return (req, res, next) => {
    const method = req.method;

    // Always ensure CSRF token cookie exists (needed for login page too)
    if (!req.cookies[cookieName]) {
      const token = generateToken();
      res.cookie(cookieName, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });
    }

    // For safe methods (GET/HEAD/OPTIONS), no validation needed
    if (ignoredMethods.includes(method)) {
      return next();
    }

    // For state-changing methods (POST/PUT/DELETE etc):
    // Only require CSRF token if user is authenticated
    if (!req.session.userId) {
      // Unauthenticated requests can proceed (e.g., login route)
      return next();
    }

    const headerToken = req.get(headerName);
    const cookieToken = req.cookies[cookieName];

    if (!headerToken) {
      return res.status(403).json({
        error: 'CSRF token missing',
        details: `Request must include '${headerName}' header`
      });
    }

    if (!cookieToken) {
      // Token cookie not found - may have been expired or not set
      return res.status(403).json({
        error: 'CSRF token not found',
        details: 'Please reload the page and try again'
      });
    }

    if (!verifyToken(headerToken, cookieToken)) {
      return res.status(403).json({
        error: 'CSRF token mismatch',
        details: 'Invalid CSRF token - possible cross-site request forgery'
      });
    }

    next();
  };
}

module.exports = { csrfProtect };
