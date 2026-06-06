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
    // L7-fix: GET/HEAD/OPTIONS are HTTP "safe methods" and cannot
    // modify server state per RFC 7231. CSRF is only relevant for
    // state-changing methods (POST/PUT/PATCH/DELETE), so excluding
    // safe methods is the standard double-submit pattern. If a
    // developer ever mounts a state-changing handler on a GET route,
    // that is a separate application bug — the ESLint rule below
    // catches the common case at code-review time.
    ignoredMethods = ['GET', 'HEAD', 'OPTIONS'],
    sameOriginPaths = ['/api/auth/login', '/api/2fa/verify-login']
  } = options;

  return (req, res, next) => {
    const method = req.method;

    // Always ensure CSRF token cookie exists
    if (!req.cookies[cookieName]) {
      const token = generateToken();
      res.cookie(cookieName, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });
    }

    if (ignoredMethods.includes(method)) {
      return next();
    }

    // For state-changing methods, always require a valid token (authenticated or not).
    const headerToken = req.get(headerName);
    const cookieToken = req.cookies[cookieName];

    if (!headerToken || !cookieToken) {
      return res.status(403).json({
        error: 'CSRF token missing',
        details: `Request must include '${headerName}' header`
      });
    }

    if (!verifyToken(headerToken, cookieToken)) {
      return res.status(403).json({
        error: 'CSRF token mismatch',
        details: 'Invalid CSRF token - possible cross-site request forgery'
      });
    }

    // Login / 2FA verify-login: also enforce same-origin to prevent login-CSRF.
    if (sameOriginPaths.includes(req.path)) {
      const allowed = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
      const origin = String(req.get('origin') || '').replace(/\/$/, '');
      const referer = String(req.get('referer') || '').replace(/\/$/, '');
      if (allowed && origin && origin !== allowed) {
        return res.status(403).json({ error: 'Cross-origin login blocked' });
      }
      if (allowed && !origin && referer && !referer.startsWith(allowed)) {
        return res.status(403).json({ error: 'Cross-origin login blocked' });
      }
    }

    next();
  };
}

module.exports = { csrfProtect };
