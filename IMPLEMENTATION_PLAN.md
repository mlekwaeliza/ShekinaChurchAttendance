# Implementation Plan — Church Attendance System

> Last updated: 2026-04-05

## Completed

### Critical Bug Fixes (2026-04-05)
- [x] **Bug 1**: Added missing `getAllLeaders()` query to `server/database.js` — `server/routes/admin.js:744` was calling undefined function
- [x] **Bug 2**: Removed stray `});` tokens (lines 28, 57) and duplicate `getISOWeek`/`getWeekString` functions in `client/src/hooks/useAdminData.js`
- [x] **Bug 3**: Added `GET /api/pastor/export` endpoint to `server/routes/leader.js` and updated `PastorDashboard.jsx` to use `pastorAPI.exportAttendance()` instead of the admin-only endpoint
- [x] **Bug 4**: Rotated exposed `SESSION_SECRET` in `server/.env` — confirmed `.env` and `server/.env` already in `.gitignore`

---

## Pending — Recommended Order

### Phase 1: Stability & Quality of Life (2026-04-05)
- [x] **Fix: Profile picture cache busting** — Replaced `Date.now()` with `profileImgKey` state in `Layout.jsx` — only refreshes on actual upload
- [x] **Fix: CSV upload temp file cleanup** — Removed invalid callback from `fs.unlinkSync(tempPath)` in `admin.js:342`
- [x] **Fix: ChangePasswordPage redirect** — Now navigates to role-specific dashboard (`/admin`, `/leader`, `/pastor`) instead of `/`
- [x] **Fix: SQL LIMIT string interpolation** — Added integer validation before LIMIT in `leader.js:280`
- [x] **Fix: Member creation validation** — `POST /admin/members` now verifies `section_id` exists, `leader_id` exists, and leader belongs to that section
- [x] **Fix: Date format validation** — Added `validateDate` middleware to `middleware/auth.js`, applied to all `:date` route params in `leader.js` and `admin.js`, plus `validateQueryDates` on all pastor routes
- [x] **Add: Global React ErrorBoundary** — Created `ErrorBoundary.jsx` wrapping `AppRoutes` in `App.jsx`
- [x] **Add: Express 404 catch-all** — Added `/api/*` catch-all returning `{ error: 'Route not found' }` in `server.js`
- [x] **Add: Database connection error handling** — Added DB health check in `startServer()` with graceful error message and exit in `server.js`

### Phase 2: Dark Mode
- [x] Add dark mode toggle in Layout header
- [x] Create `dark:` Tailwind variants for all components
- [x] Persist preference in localStorage
- [x] Respect `prefers-color-scheme` system default on first visit
- [x] Update all custom utility classes (`toast-*`, `btn-*`, `card`, `modal-*`, etc.) in `index.css`

### Phase 3: Offline Support (Leader Attendance)
- [x] Create Service Worker (`sw.js`) for caching static assets and API responses
- [x] Register Service Worker in `index.jsx` (Vite serves `public/` automatically)
- [x] Create IndexedDB helper (`offlineDB.js`) — queue, retrieve, mark synced/conflict, delete
- [x] Create `useOffline` hook — online/offline detection, queue management, auto-sync, conflict tracking
- [x] Update `TakeAttendance.jsx` — offline banner, queued status, offline-styled submit button
- [x] Update `useLeaderData.js` — queue submissions when offline, auto-sync when reconnected, load queued data
- [x] Add online/offline indicator to Layout header with pending count badge
- [x] Add sync button when back online with pending items
- [x] Create `ConflictResolutionModal` — discard or overwrite server data
- [x] Integrate conflict modal into `LeaderDashboard.jsx`

### Phase 4: Notifications & Alerts
- [x] Add `notifications` table to database schema with indexes
- [x] Add `absent_followups` table to database schema with indexes
- [x] Create `NotificationBell` component with dropdown, unread count badge, mark read/mark all read
- [x] Add notification bell to Layout header (replaced placeholder)
- [x] Add notification API routes: unread-count, all, read, read-all, consecutive-absences, follow-ups
- [x] Auto-detect leaders who missed submission deadline — `generateNotifications()` runs on startup and every 24h
- [x] Flag members absent 2+ consecutive Sundays — `getConsecutiveAbsentMembers` query with streak detection
- [x] Leader "contacted" status with notes for absent member follow-up — full CRUD in LeaderMembers
- [x] Add follow-up tracking to `LeaderMembers.jsx` — badges, follow-up modal with contact method and notes
- [x] Add `leaderAPI` methods for consecutive absences and follow-ups
- [x] Update `useLeaderData.js` to load absences, follow-ups, and handle updates
- [ ] Optional: Email notifications (nodemailer integration)

### Phase 5: Audit Log
- [x] Add `audit_log` table: `(id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, created_at)` with indexes
- [x] Create `auditLog` middleware in `server/middleware/audit.js` — auto-logs all POST/PUT/DELETE with entity type detection, IP capture, body sanitization
- [x] Apply audit middleware globally in `server.js` before routes
- [x] Create `AuditLog` admin view component — filterable table with entity type, action, date range, search, user info badges
- [x] Add audit tab to admin navigation (`/admin/audit`) with ShieldCheck icon
- [x] Add audit API routes: `GET /admin/audit-log` (filtered), `GET /admin/audit-log/member/:id` (per-member history)
- [x] Add member change history to `MemberEditModal.jsx` — collapsible timeline with action badges, timestamps, user attribution, field count
- [x] Add `adminAPI` methods: `getAuditLog`, `getMemberAuditHistory`

### Phase 6: Two-Factor Authentication (2FA)
- [x] Add `totp_secret`, `totp_enabled`, `backup_codes` columns to `users` table via migrations
- [x] Install `otplib` and `qrcode` packages
- [x] Create `twofactor.js` middleware with `requires2FA` and `checkUser2FA`
- [x] Create 2FA API routes: `POST /2fa/setup`, `POST /2fa/verify`, `POST /2fa/disable`, `POST /2fa/verify-login`, `GET /2fa/status`, `POST /2fa/regenerate-backup-codes`
- [x] Update login flow — returns `requires2FA: true` + `userId` when 2FA is enabled, stores partial session
- [x] Update `/auth/me` — returns `requires2FA` if session has unverified 2FA
- [x] Create `TwoFactorSetup` component — multi-step flow: generate → scan QR → verify → save backup codes
- [x] Create `TwoFactorVerify` component — login step with TOTP or backup code input
- [x] Update `Login.jsx` — handles 2FA redirect, shows verification screen
- [x] Add 2FA management to `SettingsView` — enable/disable status, regenerate backup codes, disable with password confirmation
- [x] Add `authAPI` methods for 2FA operations
- [x] Generate 8 backup codes on enable, track remaining count, allow one-time use

### Phase 7: Advanced Analytics
- [x] Attendance prediction — moving average based on last 12 weeks of data (`getAttendancePrediction`)
- [x] Anomaly detection — flags sections with >20% drop vs historical average (`getSectionAnomalies`)
- [x] Member streak tracking — consecutive present Sundays, displayed as badges (`getMemberStreaks`)
- [x] Leader performance trends — ranked table with attendance rate and submission count (`getLeaderPerformanceTrends`)
- [x] Updated `AnalyticsView.jsx` — stat cards, anomaly bar chart, streak grid, leader rankings table

### Phase 8: Data Management
- [x] Bulk member editing — `BulkEditModal` with multi-select, search, section/leader reassignment
- [x] Member CSV export — `GET /admin/members/export` endpoint with all member fields
- [x] Soft deletes — `is_active` flag on members and leaders, delete now deactivates instead of removing
- [x] All member queries filter by `is_active = 1`

### Phase 9: Church-Specific Features
- [x] Birthday reminders — `date_of_birth` column added to members, `getUpcomingBirthdays` query, displayed on admin dashboard
- [x] Upcoming birthdays card on `DashboardOverview` with Cake icon

### Phase 10: Infrastructure
- [x] Automated SQLite backups — `server/backup.js` runs every 6 hours, auto-cleans backups older than 30 days
- [x] Enhanced health monitoring — `/api/health` returns uptime, DB size, connection status, memory usage
- [x] Account lockout — 5 failed login attempts locks account for 30 minutes, tracks `failed_login_attempts` and `locked_until`
- [x] Docker support — `Dockerfile` for server, `docker-compose.yml` with server + client + volumes

---

## Known Issues (Lower Priority)

| # | Issue | File | Severity |
|---|-------|------|----------|
| 1 | `BreadcrumbProvider` recreated on every route change | `Layout.jsx` | Low |
| 2 | Leader drill-down history query inefficient (subquery with LIMIT 1) | `admin.js:811-819` | Low |
| 3 | `submitError` state defined but never exposed in `useLeaderData` | `useLeaderData.js:131` | Low |
| 4 | Hardcoded year options `[2024, 2025, 2026]` in RewardsView | `RewardsView.jsx:55` | Low |
| 5 | `submission_log` UNIQUE constraint conflicts with head leader behavior | Schema | Medium |
| 6 | No input sanitization on text fields (stored XSS possible) | Multiple | Medium |
| 7 | `loadRewards` has no loading state on initial mount | `RewardsView.jsx` | Low |
| 8 | `checkAuth` in AuthContext silently fails on 500 errors | `AuthContext.jsx` | Medium |

---

## Tech Stack Reference

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3 |
| Charts | Recharts 2.10 |
| PDF | jsPDF 4.2 + jspdf-autotable |
| HTTP | Axios 1.6 |
| Backend | Express 4.18 |
| Database | SQLite 3 (WAL mode) |
| Auth | bcryptjs 2.4, express-session 1.17 |
| Security | Helmet 7, express-rate-limit 7, CSRF (double-submit cookie) |
| Uploads | Multer |
| CSV | csv-parser 3.0 |

---

## Quick Start Commands

```bash
# Install all dependencies
npm install
npm run install-all

# Start dev server (both client + server)
npm start

# Start server only
cd server && npm start

# Start client only
cd client && npm run dev

# Build for production
cd client && npm run build

# Seed admin user
node scripts/seed-admin.js
```
