// L3-fix: PII redaction for structured logs.
//
// Wraps console.log/info/warn/error to redact known PII fields from
// any object payloads before they reach stdout (and Sentry). Field
// names are matched case-insensitively, and PII values are replaced
// with a length-preserving placeholder (e.g. "+1234567890" -> "+1***89").
//
// This is a defense-in-depth control: the primary path is to never
// log PII in the first place, but with dynamic payloads and audit
// details, accidental leaks are easy. This wrapper is the safety net.

const PII_FIELDS = new Set([
  'password',
  'new_password',
  'current_password',
  'old_password',
  'token',
  'csrf_token',
  'session',
  'cookie',
  'authorization',
  'phone',
  'phone_number',
  'mobile',
  'date_of_birth',
  'dob',
  'birthday',
  'address',
  'email',
  'email_address',
  'full_name',
  'first_name',
  'last_name',
  'surname',
  'id_number',
  'national_id',
  'passport',
  'tax_id',
  'taxpayer_identification',
  'ssn',
  'reset_url',
  'password_reset_url',
  'invite_url'
]);

function maskValue(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length === 0) return value;
    if (value.length <= 4) return '*'.repeat(value.length);
    return `${value.slice(0, 2)}${'*'.repeat(Math.max(2, value.length - 4))}${value.slice(-2)}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return '[redacted]';
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (typeof value === 'object') return redact(value);
  return '[redacted]';
}

function redact(input) {
  if (input == null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((v) => redact(v));
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (PII_FIELDS.has(k.toLowerCase())) {
      out[k] = maskValue(v);
    } else if (v && typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function scrub(args) {
  return Array.from(args).map((a) => {
    if (a && typeof a === 'object') return redact(a);
    return a;
  });
}

function install() {
  const methods = ['log', 'info', 'warn', 'error', 'debug'];
  for (const m of methods) {
    const original = console[m].bind(console);
    console[m] = function (...args) {
      try {
        return original(...scrub(args));
      } catch (_) {
        // If scrubbing itself fails, fall back to original so logs
        // are never silently swallowed.
        return original(...args);
      }
    };
  }
}

module.exports = { install, redact, maskValue, PII_FIELDS };
