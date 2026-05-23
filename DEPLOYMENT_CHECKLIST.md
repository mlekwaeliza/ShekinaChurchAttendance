# Deployment Checklist

## Required Environment

- `NODE_ENV=production`
- `PORT=3001` or the platform-provided port
- `CLIENT_URL=https://your-public-domain`
- `SESSION_SECRET=<32+ byte random secret>`
- `DB_CLIENT=postgres` after the PostgreSQL migration and checks pass
- `DATABASE_URL=postgres://church_app:<password>@<host>:5432/church_attendance`
- `PGSSL=true` if your database host requires SSL
- `COOKIE_SECURE=true`
- `TRUST_PROXY=true` when the app runs behind a reverse proxy
- `BACKUP_RETENTION_DAYS=30`

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Build And Start

```bash
cd client
npm run build

cd ../server
npm test -- --runInBand
npm run start
```

The server serves `client/dist` in production, so deploy both `server` and the built `client/dist` folder together.

## Database And Backups

- For PostgreSQL, create a dedicated database and user before migration.
- Run the schema and data migration from the server folder:

```bash
cd server
npm install
npm run postgres:migrate
npm run postgres:check
npm run postgres:scan-runtime
```

- Verify the migrated counts before switching production traffic:

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM members;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM attendance;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

- Refresh PostgreSQL analytics summaries after large imports:

```bash
cd server
npm run postgres:refresh-analytics
```

- Back up PostgreSQL with `pg_dump "$DATABASE_URL" > church_attendance_backup.sql`.
- Test restore with `createdb church_attendance_restore` and `psql church_attendance_restore < church_attendance_backup.sql`.
- Keep the SQLite database file until the PostgreSQL deployment has passed smoke testing.
- Keep the admin password and recovery process documented outside the repo.

## PostgreSQL Cutover Notes

The PostgreSQL schema, connection pool, SQLite-to-PostgreSQL migration script, reporting views, materialized analytics summaries, and `DB_CLIENT=postgres` runtime switch are ready. Run the migration, `postgres:check`, and `postgres:scan-runtime` before switching production traffic.

PostgreSQL reporting objects now available after migration:

- `attendance_report_view`
- `member_directory_view`
- `missed_submission_candidates`
- `calendar_role_schedule_view`
- `attendance_daily_summary`
- `leader_performance_summary`
- `member_engagement_summary`

## Security

- Use HTTPS only.
- Rotate any shared/default passwords before go-live.
- Keep `.env` out of source control.
- Confirm recovery codes are shown once to the user and then stored as hashes.
- Review `/api/health` after deployment; it should return `status: ok`.

## Post-Deploy Smoke Test

- Log in as admin.
- Open Dashboard, Members, Sections, Reports, Announcements, Follow-ups, and Visitors.
- Generate a report PDF.
- Create and delete a test announcement.
- Create a test visitor intake record.
- Create and mark done a test follow-up.
