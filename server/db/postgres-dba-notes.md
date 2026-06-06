# Database administrator notes

This file documents **optional** database-side optimizations that
are not part of the boot-time schema (`postgres-schema.sql`) or the
analytics views (`postgres-analytics.sql`). They are pre-staged
here so an operator can run them when the data shape changes.

## pg_trgm GIN index on `audit_log` (DBA P1-#6)

**When to run:** when `audit_log` exceeds ~50K rows **and** the
admin/audit UI is showing slow `LIKE '%search%'` substring searches
in old_value / new_value.

**What it does:** installs the `pg_trgm` PostgreSQL extension
(text-trigram fuzzy matching) and creates a GIN index on
`audit_log.old_value` and `audit_log.new_value` using the
`gin_trgm_ops` operator class. This makes the substring search
in `getAuditLog()` (server/database.js:1709) index-backed instead
of a full-table sequential scan.

**Cost:** the index is roughly the same size as the indexed text.
For 50K rows of audit JSON (~30 chars each on average) the index
adds ~10-15 MB. For 500K rows it's ~100-150 MB.

**Why not auto-run at boot:**
- Indexes larger than the table can hurt small-table workloads.
- `CREATE EXTENSION pg_trgm` requires superuser on the role used
  by the app. Neon grants this by default; some hosted Postgres
  services do not. We don't want boot to fail on a permission
  error that doesn't affect the live app.

**How to run:**

```bash
# Local (against dev PG)
DATABASE_URL=postgres://... node scripts/postgres-add-trgm-index.js

# Or via npm script
npm run postgres:add-trgm-index
```

The script is idempotent. Exit codes:
- `0` success (extension + indexes present)
- `1` DATABASE_URL not set
- `2` pg_trgm extension install failed
- `3` one or more indexes could not be created

**Verify after running:**

```sql
\d audit_log
-- expect: idx_audit_old_value_trgm, idx_audit_new_value_trgm

EXPLAIN ANALYZE
SELECT * FROM audit_log
WHERE old_value LIKE '%login%' OR new_value LIKE '%login%'
LIMIT 50;
-- expect: "Bitmap Index Scan" on the new indexes (not "Seq Scan")
```

## Materialized views (DBA P2)

`server/db/postgres-analytics.sql` defines three materialized
views (`attendance_daily_summary`, `leader_performance_summary`,
`member_engagement_summary`) plus three regular views. The views
are not currently queried by the app — analytics endpoints use
direct joins. If the analytics UI starts to feel slow:

1. Add a `cronJob` to `render.yaml` calling
   `npm run postgres:refresh-analytics` every 15 minutes.
2. Update analytics routes to query the materialized views
   instead of joining `attendance`/`members`/`submission_log`
   directly.

## Session table pruning (DBA P2)

`connect-pg-simple` creates the `session` table on first use and
auto-prunes expired rows every `pruneSessionInterval` (15 min
default in `server.js`). No manual index is needed for pruning.

If the session table grows large (>1M rows) under high churn, the
`pruneSessionInterval` can be lowered or you can run a manual
`DELETE FROM session WHERE expire < NOW()` during a low-traffic
window.

## Soft-delete retention (operational)

`server/scheduler.js` runs `flagPendingPermanentDeletions` every
24 hours. Members inactive for 6+ months are flagged for
permanent deletion; the actual `DELETE` requires an explicit
admin action (`POST /api/admin/people/permanent-delete` with
typed `confirm: "PERMANENTLY DELETE"` body — see H2-fix).

There is no automatic permanent-delete cron. This is intentional:
permanent deletion is irreversible and requires an admin's
conscious action. If the admin queue grows, run a one-off
`DELETE FROM members WHERE pending_deletion = 1` from psql after
reviewing the queue in the admin UI.

## Backup strategy summary

See `BACKUP.md` for the full backup / restore story. In short:

- **Primary:** Neon 7-day PITR (free tier) — point-in-time recovery
  via the Neon console.
- **Defense-in-depth:** local `pg_dump` every 6h via
  `server/backup.js`, plus optional `BACKUP_REMOTE_URL` upload to
  S3/B2/R2 for off-host durability.
- **Admin download:** `GET /api/admin/backups/download/:filename`
  streams the most recent `pg_dump` to the admin's browser.
- **Status:** `GET /api/admin/backups/status` returns
  last-backup age, retention, and remote-upload configuration.
