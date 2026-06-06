// L4-fix: input length validation middleware.
//
// Defense-in-depth against payload-size DoS and SQL truncation
// bugs. Runs after the body parser; rejects requests whose body
// is too large or whose string fields exceed per-key caps.
//
// Defaults are conservative; routes can override per-field caps
// by passing a `fields` option keyed by field name.
//
// Usage:
//   app.use('/api/admin/upload-csv', inputLimits({ bodyMax: '5mb', fields: { name: 200 } }));

const DEFAULT_BODY_MAX = '256kb';
const DEFAULT_FIELD_MAX = 5000; // characters per string field

function parseLimit(limit) {
  if (typeof limit === 'number') return limit;
  if (typeof limit !== 'string') return 1024 * 256;
  const m = String(limit).trim().match(/^(\d+)\s*(kb|mb|b)?$/i);
  if (!m) return 1024 * 256;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 'b').toLowerCase();
  if (unit === 'kb') return n * 1024;
  if (unit === 'mb') return n * 1024 * 1024;
  return n;
}

function inputLimits(options = {}) {
  const bodyMax = parseLimit(options.bodyMax || DEFAULT_BODY_MAX);
  const fieldMax = Number.isInteger(options.fieldMax) ? options.fieldMax : DEFAULT_FIELD_MAX;
  const fields = options.fields || {};

  return (req, res, next) => {
    try {
      // L4-fix: cap raw Content-Length before parsing if the client declared it.
      const declared = parseInt(req.headers['content-length'] || '0', 10);
      if (declared > 0 && declared > bodyMax) {
        return res.status(413).json({
          error: 'Payload too large',
          details: `Request body must be at most ${bodyMax} bytes`
        });
      }

      // L4-fix: walk the parsed body and cap string fields.
      if (req.body && typeof req.body === 'object') {
        const cap = (value, key) => {
          if (typeof value === 'string') {
            const limit = Number.isInteger(fields[key]) ? fields[key] : fieldMax;
            if (value.length > limit) {
              const err = new Error(`Field '${key}' exceeds maximum length ${limit}`);
              err.expose = true;
              err.userMessage = `Field '${key}' exceeds maximum length ${limit}`;
              err.status = 400;
              throw err;
            }
          } else if (Array.isArray(value)) {
            for (const item of value) cap(item, key);
          } else if (value && typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) cap(v, k);
          }
        };
        for (const [k, v] of Object.entries(req.body)) cap(v, k);
      }

      next();
    } catch (e) {
      // Forward the error to the global error handler with explicit
      // expose = true so the safe userMessage is returned to the client.
      next(e);
    }
  };
}

module.exports = { inputLimits };
