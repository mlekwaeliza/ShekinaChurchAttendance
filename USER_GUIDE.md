# Shekina Church Attendance — User Guide

This guide covers the day-to-day use of the system for **admins**,
**pastors**, and **leaders**. It assumes the application is already
deployed and you have a username and password.

## Table of contents

- [Getting started](#getting-started)
- [For admins](#for-admins)
  - [Member management](#member-management)
  - [Leader management](#leader-management)
  - [CSV upload](#csv-upload)
  - [Backups](#backups)
  - [Two-factor authentication](#two-factor-authentication)
- [For pastors](#for-pastors)
- [For leaders](#for-leaders)
  - [Submitting attendance](#submitting-attendance)
  - [Follow-ups](#follow-ups)
- [Troubleshooting](#troubleshooting)

---

## Getting started

1. Open the app URL in your browser.
2. Sign in with your **username** and **password**.
3. If you have 2FA enabled, enter the 6-digit code from your authenticator app.
4. You will be taken to the dashboard for your role:
   - **admin** → `/admin`
   - **leader** → `/leader`
   - **pastor** → `/pastor`

> **Tip:** if you cannot remember your password, ask an admin to reset it
> from the **Leader Directory** or **Member Directory**.

---

## For admins

### Member management

- **Add a member:** *Members → Add Member*. Required fields: full name,
  membership ID, section. Optional: phone, email, date of birth, address.
- **Edit a member:** click the row in the member table and choose *Edit*.
- **Bulk update:** select multiple members with the checkboxes and use
  *Bulk Update* to reassign them to a different section or leader.
- **Soft delete:** the *Delete* button deactivates the member without
  removing historical attendance records.

### Leader management

- *Admin → Leaders → Add Leader*. Required: username, password, section,
  full name.
- *Reset password:* open the leader row and choose *Reset Password*. A
  new random password will be displayed once — copy it to a secure channel
  (in-person, encrypted chat) for the leader to use immediately.

### CSV upload

1. *Admin → Members → Upload CSV*.
2. CSV columns (header row required): `full_name, membership_id, section, leader_username, phone, email, date_of_birth`.
3. The system validates each row. Invalid rows are reported in the upload
   summary and **not** imported. You can re-export the report as CSV.

### Backups

- *Admin → Backups* shows the list of recent automatic backups
  (every 6 hours, plus one at boot).
- *Create backup* makes a manual `.sql` (Postgres) or `.sqlite` snapshot.
- *Restore* overwrites the live database. **This is irreversible** — only
  do it when recovering from data loss.

### Two-factor authentication

- *Account → Security → Enable 2FA*. Scan the QR code in Google
  Authenticator, 1Password, or Authy.
- Save the **backup codes** shown once — they let you in if you lose
  your phone.
- *Disable 2FA* requires your password.

---

## For pastors

- **Dashboard:** aggregated attendance, trends, leader metrics.
- **At-risk members:** members with 3+ consecutive absences.
- **Birthdays & follow-up alerts** appear on the dashboard sidebar.
- **Engagement scores** combine attendance, follow-up activity, and
  outreach touch-points.

---

## For leaders

### Submitting attendance

1. *Leader → Submit Attendance*.
2. Pick the **date** and **service** (Main, Midweek, Youth, etc.).
3. Each member is shown with a tri-state selector: **Present / Absent / Excused**.
4. Click *Save*.
5. If the network drops, the submission is **queued offline** and
   re-sent when the connection returns. The system uses an
   `Idempotency-Key` header to prevent duplicates.

> **Note:** you can edit a submission up until 11:59 PM local time on
> the same day. After that, contact an admin.

### Follow-ups

- *Leader → Follow-ups* lists members you've contacted (or need to).
- Click a member to log a phone call, visit, or prayer request.
- The system auto-flags members with 2+ consecutive absences.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Login fails with "too many attempts" | Per-account (5/30min) or per-IP (25/15min) lockout | Wait 30 min or contact an admin to unlock your account |
| Attendance submission returns 409 | Submission already exists for that date+service+leader | Edit the existing submission instead of resubmitting |
| Health endpoint shows `degraded` | Database connection lost | Check the server logs; the app will auto-reconnect on the next request |
| Cannot see the calendar | Your role doesn't have access | Calendars are available to admin, leader, and pastor roles |
| "CSRF token not found" warning | Session expired or cookies blocked | Hard-refresh and log in again; ensure third-party cookies are allowed for the app domain |

---

## Security reminders

- Never share your password or 2FA backup codes.
- Always log out when leaving a shared computer.
- Report any suspicious activity to your admin immediately.
- See `SECURITY.md` for the responsible-disclosure process.
