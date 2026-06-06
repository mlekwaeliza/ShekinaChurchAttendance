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
- PostgreSQL connections verify the server certificate by default
  (see [PG SSL configuration](#pg-ssl-configuration) below).

## PG SSL configuration

Database connections are encrypted with TLS. Certificate verification
is enabled by default to prevent MITM attacks.

**Production (recommended):** Set `DATABASE_URL` to use `sslmode=verify-full`:

```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=verify-full&channel_binding=require&uselibpqcompat=true
```

This makes libpq (and the `pg` library's libpq-compat layer) verify
the server certificate against the system trust store and check that
the hostname matches the certificate's CN/SAN.

**Environment variables:**

- `PGSSL` / `POSTGRES_SSL` — set to `1` / `true` to enable TLS (required for Neon).
- `PG_REJECT_UNAUTHORIZED` — set to `false` to disable certificate verification.
  Defaults to `true`. Only disable for dev databases with self-signed certs
  that are not in your trust store.
- `DATABASE_URL` query string — for full cert verification use
  `sslmode=verify-full`. The legacy `sslmode=require` setting encrypts
  the connection but does **not** verify the server certificate.

**Auditing:** On startup, the server logs a warning if
`rejectUnauthorized` is set to `false` so the configuration is visible
in deployment logs.
