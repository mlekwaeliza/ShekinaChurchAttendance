# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public issue**.
Email `security@shekina.church` (replace with the real address when known) with:

- A description of the vulnerability and the impact.
- Reproduction steps.
- The version/commit affected.

We aim to acknowledge within **3 business days** and provide a remediation
plan within **10 business days** for high-severity issues.

## Security Practices

- All passwords stored with bcryptjs (cost 10).
- Session cookies are `httpOnly`, `sameSite=strict`, `secure` in production.
- CSRF protection on all mutating routes via `csurf` + `sameSite=strict`.
- Per-account and per-IP login lockouts.
- Audit log is append-only at the database level (PG trigger blocks
  UPDATE/DELETE on `audit_log`).
- Two-factor authentication (TOTP) available for all users.
- Security headers: CSP, HSTS, COEP/CORP, Referrer-Policy, X-Content-Type-Options.
- Rate limiting on auth and submission endpoints.
- Idempotency-Key header on attendance submission to prevent duplicates.
- PII (names, phones, emails, DOBs) is encrypted at rest in the database
  and stripped from Sentry events before transmission.
