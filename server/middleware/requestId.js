// I2/I4-fix: request-id middleware.
//
// Generates (or accepts) a 12-char request ID, attaches it to
// req.id and res.locals, and echoes it back as the
// X-Request-Id response header. The global error handler picks
// this up when constructing errorId-style responses, and any
// future structured logging can correlate server logs with
// client-side error reports.

const crypto = require('crypto');

function newId() {
  return crypto.randomBytes(6).toString('hex'); // 12 hex chars
}

function requestId(options = {}) {
  const header = options.header || 'X-Request-Id';
  const respHeader = options.responseHeader || 'X-Request-Id';
  const max = options.maxLength || 64;
  return (req, res, next) => {
    // Honor an upstream request id (e.g. from a reverse proxy) if
    // it is a safe shape: short, hex/base64-ish, no control chars.
    const incoming = req.get(header);
    let id;
    if (incoming && /^[A-Za-z0-9._-]+$/.test(incoming) && incoming.length <= max) {
      id = incoming;
    } else {
      id = newId();
    }
    req.id = id;
    res.locals.requestId = id;
    res.setHeader(respHeader, id);
    next();
  };
}

module.exports = { requestId, newId };
