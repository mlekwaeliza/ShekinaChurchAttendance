# Backup & Disaster Recovery

## Where the primary data lives
The application database is hosted on **Neon Postgres** at the URL configured in
`DATABASE_URL` (`server/.env` and Render's environment).

## Built-in safety
- **Neon free tier** retains 7 days of point-in-time history on the primary
  branch. You can recover to any second within that window via the Neon
  console (`Branches -> Restore from time`).
- All writes go through the live Neon database. A `pg_dump` snapshot is
  generated every 6 hours as a **defense-in-depth** copy.

## Local backups on Render
`server/backup.js` writes `pg_dump` output to `./backups/` on the local disk.
On Render's free plan, **this disk is ephemeral** and is wiped on every
service restart, deploy, or rebuild. Local backups are therefore not
durable.

The reliable ways to keep a backup:

1. **Download on demand (default)** — admin hits
   `GET /api/admin/backups/download/:filename` to stream a `pg_dump` file
   to their machine. Save the file to your own cloud storage.
2. **Remote URL (recommended)** — set `BACKUP_REMOTE_URL` to an
   S3-compatible endpoint (Backblaze B2, Cloudflare R2, etc.). Every
   scheduled backup is also uploaded there. See the environment
   variables section below.

## Environment variables

| Name | Default | Purpose |
|---|---|---|
| `BACKUP_RETENTION_DAYS` | `30` | Days of local backups to keep. |
| `BACKUP_REMOTE_URL` | unset | HTTPS endpoint to stream each backup to. |
| `BACKUP_REMOTE_METHOD` | `PUT` | HTTP method to use. |
| `BACKUP_REMOTE_HEADERS` | `{}` | JSON object of extra request headers. |
| `BACKUP_REMOTE_PATH_TPL` | `''` | Optional path template appended to URL. `{filename}` is substituted. |

### Example: Backblaze B2 (free 10 GB)
```
BACKUP_REMOTE_URL=https://api.backblazeb2.com
BACKUP_REMOTE_METHOD=POST
BACKUP_REMOTE_PATH_TPL=/b2api/v2/b2_upload_file/.../{filename}
BACKUP_REMOTE_HEADERS={"Authorization":"4_0123456789abcdef..."}
```

### Example: Cloudflare R2 (free 10 GB / month)
```
BACKUP_REMOTE_URL=https://<accountid>.r2.cloudflarestorage.com
BACKUP_REMOTE_METHOD=PUT
BACKUP_REMOTE_PATH_TPL=/my-bucket/backups/{filename}
BACKUP_REMOTE_HEADERS={"Authorization":"Bearer <r2-token>"}
```

## Restore procedure

1. **Recommended** — use Neon's 7-day PITR via the Neon console. This
   restores the primary database to any second within the retention
   window with no app downtime.
2. **From a downloaded file** — install `psql`, then:
   ```
   psql "$DATABASE_URL" -f backup-2026-06-06T14-04-22.sql
   ```
3. **From a local backup on the server** (only if the disk still has
   it) — admin hits `POST /api/admin/backups/restore` with
   `{ "filename": "...", "confirm": "RESTORE" }`. The app stops the
   service; you must restart Render for the restored data to load.

## Why we don't store backups in the container
- Render free plan: ephemeral disk, wiped on every deploy.
- Render paid plan: persistent disk adds cost and a single-region SPOF.
- Neon already provides the actual primary backup story.
