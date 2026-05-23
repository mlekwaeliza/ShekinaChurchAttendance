# Free Hosting Deployment

Recommended no-cost setup:

- Render Web Service for the Node/React app.
- Neon or Supabase for managed PostgreSQL.
- One deployed app URL, because the Express server serves the built React app and `/api` from the same origin.

This avoids separate frontend/backend CORS problems and keeps login cookies reliable.

## 1. Create The Online PostgreSQL Database

Create a free PostgreSQL project on Neon or Supabase.

Copy the database connection string. It should look similar to:

```text
postgresql://user:password@host/database?sslmode=require
```

Keep this private.

## 2. Push This Project To GitHub

Render deploys most easily from GitHub.

Before pushing, confirm these files are not committed:

- `.env`
- `server/.env`
- `*.sqlite`
- `server/backups`
- `server/uploads`

## 3. Create The Render Web Service

In Render:

1. Choose `New` -> `Blueprint`.
2. Connect the GitHub repository.
3. Select this project.
4. Render will read `render.yaml`.
5. Set the secret environment variables:

```text
DATABASE_URL=<your Neon/Supabase connection string>
```

The blueprint already sets:

```text
NODE_ENV=production
DB_CLIENT=postgres
PGSSL=true
COOKIE_SECURE=true
TRUST_PROXY=true
```

Render generates `SESSION_SECRET` automatically from `render.yaml`. The app can use Render's `RENDER_EXTERNAL_URL` automatically, so `CLIENT_URL` is optional unless you later add a custom domain.

## 4. Migrate Local Data To The Online Database

From your local server folder, set the online database URL:

```powershell
cd "C:\Users\mlekw\Desktop\antigravity\Demo project\Demo project\server"
$env:DB_CLIENT="postgres"
$env:DATABASE_URL="<your online DATABASE_URL>"
$env:PGSSL="true"
npm run postgres:migrate
npm run postgres:check
npm run postgres:refresh-analytics
```

Only run migration after confirming the target database is the correct online database.

## 5. Smoke Test After Deployment

Open:

```text
https://your-render-app.onrender.com/api/health
```

Expected:

```json
{
  "status": "ok",
  "database": {
    "client": "postgres",
    "status": "connected"
  }
}
```

Then test:

- Login page loads.
- Admin login works.
- Members page loads.
- Reports page loads.
- Calendar page loads.
- Sync page loads.
- Create and delete a test announcement.

## Important Free-Tier Notes

- Render free web services can sleep when idle, so the first visit after inactivity can be slow.
- Do not use Render free PostgreSQL for long-term church data because its free PostgreSQL offering is time-limited.
- Neon and Supabase are better free database choices for this app because they provide managed PostgreSQL free tiers.
- Upgrade the database plan before the app becomes mission-critical or stores years of attendance history.
