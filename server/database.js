const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { addDays, addMonths, formatLocalDate, formatMonthDay } = require('./utils/date');
const {
  monthDay: sqlMonthDay,
  monthNumber,
  yearNumber,
  dateOnly,
  pendingNowExpression,
  nowMinusHours,
  monthsAgo,
  likeEscapePattern,
  likeClause,
  likeClauseCaseInsensitive,
  upsertAttendanceSql,
  todayDate,
  daysAgo,
  monthsAgoDate,
  weeksAgo,
  dayOfWeek,
  dayOfMonth,
  yearMonth,
  yearMonthFirst,
  yearOnly,
  monthOnly,
} = require('./utils/sqlDialect');

const usePostgres = String(process.env.DB_CLIENT || '').toLowerCase() === 'postgres';
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = usePostgres ? require('./db/postgresRuntime').db : new sqlite3.Database(dbPath);

// Enable WAL mode and Foreign Keys for better concurrency and data integrity
if (!usePostgres) {
db.serialize(() => {
  db.run(`PRAGMA journal_mode = WAL`);
  db.run(`PRAGMA foreign_keys = ON`);

  // Initialize database schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'leader', 'pastor', 'evangelist')),
      full_name TEXT NOT NULL,
      profile_picture TEXT,
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      backup_codes TEXT,
      -- C3-fix: password reset columns
      password_reset_token TEXT,
      password_reset_expires DATETIME,
      password_reset_used INTEGER DEFAULT 0,
      -- P1-fix: brute-force lockout tracking with exponential backoff
      lockout_count INTEGER DEFAULT 0,
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- C3 / I5: partial index on password_reset_token to keep the
    -- token lookup hot even with millions of users where the
    -- column is NULL for the vast majority.
    CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL;

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leaders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      phone TEXT,
      email TEXT,
      is_head BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      UNIQUE(user_id, section_id)
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      membership_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      section_id INTEGER NOT NULL,
      leader_id INTEGER NOT NULL,
      phone TEXT,
      email TEXT,
      gender TEXT,
      date_of_birth DATE,
      age_group TEXT,
      show_age_to_leaders INTEGER DEFAULT 0,
      hide_from_birthday_list INTEGER DEFAULT 0,
      opt_out_services TEXT DEFAULT '[]',
      visitor_date DATE,
      status TEXT DEFAULT 'Active',
      flags TEXT DEFAULT '[]',
      last_contacted_at DATETIME,
      last_contacted_by INTEGER,
      prayer_requests TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      soft_deleted_at DATETIME,
      pending_deletion_at DATETIME,
      deletion_confirmed_at DATETIME,
      deletion_confirmed_by INTEGER REFERENCES users(id),
      hall_of_fame_points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE,
      FOREIGN KEY (last_contacted_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      date DATE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'excused')),
      submitted_by INTEGER NOT NULL,
      service_type_id INTEGER NOT NULL DEFAULT 1,
      service_type TEXT DEFAULT 'main',
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE RESTRICT,
      UNIQUE(member_id, date, service_type_id)
    );

    CREATE TABLE IF NOT EXISTS submission_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leader_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      date DATE NOT NULL,
      service_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES service_types(id) ON DELETE SET NULL,
      UNIQUE(leader_id, date, service_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('missed_submission', 'absent_member', 'attendance_drop', 'system')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'all',
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal', 'important', 'urgent')),
      scheduled_at DATETIME,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'archived')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admin_followup_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_type TEXT NOT NULL CHECK(person_type IN ('Member', 'Visitor')),
      person_id INTEGER,
      full_name TEXT NOT NULL,
      section_name TEXT,
      reason TEXT,
      owner_id INTEGER,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'done')),
      created_by INTEGER,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES leaders(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS visitor_intake (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      section_interest TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'converted', 'archived')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ip_login_failures (
      ip TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_until DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_ip_login_failures_locked ON ip_login_failures(locked_until) WHERE locked_until IS NOT NULL;

    CREATE TABLE IF NOT EXISTS church_calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      event_date DATE NOT NULL,
      event_time TEXT,
      event_type TEXT NOT NULL DEFAULT 'service',
      role_title TEXT,
      assigned_to TEXT,
      section_name TEXT,
      location TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_members_section ON members(section_id);
    CREATE INDEX IF NOT EXISTS idx_members_leader ON members(leader_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance(member_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
    CREATE INDEX IF NOT EXISTS idx_submission_service ON submission_log(service_id);
    CREATE INDEX IF NOT EXISTS idx_submission_date_service ON submission_log(date, service_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_followup_tasks_status ON admin_followup_tasks(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_visitor_intake_status ON visitor_intake(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_church_calendar_date ON church_calendar_events(event_date);

    -- Missing indexes (P1 from audit)
    CREATE INDEX IF NOT EXISTS idx_members_dob ON members(date_of_birth) WHERE is_active = 1;
    CREATE INDEX IF NOT EXISTS idx_attendance_service_date ON attendance(service_type_id, date);
    CREATE INDEX IF NOT EXISTS idx_leaders_user_id ON leaders(user_id);

    CREATE TABLE IF NOT EXISTS absent_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      leader_id INTEGER NOT NULL,
      absence_date DATE NOT NULL,
      contacted BOOLEAN DEFAULT 0,
      contact_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_followups_member ON absent_followups(member_id);
    CREATE INDEX IF NOT EXISTS idx_followups_leader ON absent_followups(leader_id);

    CREATE TABLE IF NOT EXISTS service_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      default_day TEXT,
      default_time TEXT,
      eligibility_rules TEXT, -- JSON
      points_config TEXT,     -- JSON
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

    -- DBA P1-#3: previously only created via callback after the
    -- ensureHomeCellSchema block. Moving to the main db.exec
    -- block so a fresh DB has these tables and indexes on first
    -- boot, before any queries run against them. (The legacy
    -- migration callbacks below still run for back-compat with
    -- older SQLite databases that pre-date these tables.)
    CREATE TABLE IF NOT EXISTS outreach_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leader_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      contact_method TEXT NOT NULL CHECK(contact_method IN ('Call', 'WhatsApp', 'SMS', 'Visit', 'Prayer', 'Counseling', 'Hospital Visit', 'Other', 'sms', 'whatsapp', 'phone', 'email', 'visit', 'other')),
      outcome TEXT,
      service_id INTEGER,
      created_by INTEGER,
      message TEXT,
      week_start DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES service_types(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_outreach_leader ON outreach_logs(leader_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_member ON outreach_logs(member_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_week ON outreach_logs(week_start);
    CREATE INDEX IF NOT EXISTS idx_outreach_leader_week ON outreach_logs(leader_id, week_start);

    CREATE TABLE IF NOT EXISTS scheduled_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('submission_reminder', 'follow_up_reminder', 'birthday_greeting', 'weekly_summary')),
      entity_type TEXT,
      entity_id INTEGER,
      scheduled_for DATETIME NOT NULL,
      sent BOOLEAN DEFAULT 0,
      sent_at DATETIME,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON scheduled_reminders(scheduled_for, sent);
    CREATE INDEX IF NOT EXISTS idx_reminders_type ON scheduled_reminders(type);

    -- Partial index for the soft-delete pending-deletion sweep that
    -- runs every 24h. Kept narrow (only inactive members) so the
    -- index stays small and the scheduler's WHERE clause is index-only.
    CREATE INDEX IF NOT EXISTS idx_members_pending_deletion ON members(soft_deleted_at, pending_deletion_at) WHERE is_active = 0;

    CREATE TABLE IF NOT EXISTS service_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      date DATE NOT NULL,
      assigned_leader_ids TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES service_types(id) ON DELETE CASCADE,
      UNIQUE(service_id, date)
    );

    CREATE TABLE IF NOT EXISTS offline_attendance_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id TEXT UNIQUE NOT NULL,
      package_checksum TEXT NOT NULL,
      leader_id INTEGER,
      section_id INTEGER,
      service_id INTEGER,
      attendance_date DATE NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('admin_upload', 'leader_sync')),
      imported_by INTEGER,
      status TEXT NOT NULL,
      original_filename TEXT,
      summary_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE SET NULL,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
      FOREIGN KEY (service_id) REFERENCES service_types(id) ON DELETE SET NULL,
      FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS congregation_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'General',
      reports_to_title_id INTEGER,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reports_to_title_id) REFERENCES congregation_titles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS member_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      title_id INTEGER NOT NULL,
      assigned_by INTEGER,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      appointment_date DATE,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave', 'emeritus', 'probationary', 'retired')),
      notes TEXT,
      UNIQUE(member_id, title_id),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (title_id) REFERENCES congregation_titles(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS member_title_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      title_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('assigned', 'removed', 'status_changed', 'notes_updated')),
      old_status TEXT,
      new_status TEXT,
      old_notes TEXT,
      new_notes TEXT,
      changed_by INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (title_id) REFERENCES congregation_titles(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_member_titles_member ON member_titles(member_id);
    CREATE INDEX IF NOT EXISTS idx_member_titles_title ON member_titles(title_id);
    CREATE INDEX IF NOT EXISTS idx_member_titles_status ON member_titles(status);
    CREATE INDEX IF NOT EXISTS idx_mt_history_member ON member_title_history(member_id, title_id);
    CREATE INDEX IF NOT EXISTS idx_mt_history_created ON member_title_history(created_at);

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      reports_to_title_id INTEGER,
      leader_id INTEGER,
      assistant_leader_id INTEGER,
      secretary_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reports_to_title_id) REFERENCES congregation_titles(id) ON DELETE SET NULL,
      FOREIGN KEY (leader_id) REFERENCES members(id) ON DELETE SET NULL,
      FOREIGN KEY (assistant_leader_id) REFERENCES members(id) ON DELETE SET NULL,
      FOREIGN KEY (secretary_id) REFERENCES members(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS department_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(department_id, member_id),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS department_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      member_id INTEGER,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      notes TEXT,
      changed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON department_members(department_id);
    CREATE INDEX IF NOT EXISTS idx_dept_members_member ON department_members(member_id);
    CREATE INDEX IF NOT EXISTS idx_dept_history_dept ON department_history(department_id);

    CREATE TABLE IF NOT EXISTS new_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      date_joined DATE NOT NULL DEFAULT CURRENT_DATE,
      decision_type TEXT,
      marital_status TEXT,
      date_of_birth DATE,
      occupation TEXT,
      invitation_source TEXT,
      added_by INTEGER,
      mentor_id INTEGER,
      status TEXT DEFAULT 'probation' CHECK(status IN ('probation', 'graduated', 'permanent')),
      graduation_date DATE,
      graduated_to_section_id INTEGER,
      graduated_by INTEGER,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (mentor_id) REFERENCES members(id) ON DELETE SET NULL,
      FOREIGN KEY (graduated_to_section_id) REFERENCES sections(id) ON DELETE SET NULL,
      FOREIGN KEY (graduated_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS new_member_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      new_member_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      attended INTEGER DEFAULT 0,
      notes TEXT,
      recorded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(new_member_id, week_start),
      FOREIGN KEY (new_member_id) REFERENCES new_members(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_new_member_attendance_member ON new_member_attendance(new_member_id);
    CREATE INDEX IF NOT EXISTS idx_new_members_status ON new_members(status);
    CREATE INDEX IF NOT EXISTS idx_new_members_joined ON new_members(date_joined);

    -- ── Contribution Types ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS contribution_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contribution_types_active ON contribution_types(is_active, sort_order);

    -- ── Contributions ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      contribution_type_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      payment_date DATE NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK(payment_method IN ('Cash', 'Mobile Money', 'Bank Transfer', 'Other')),
      reference_number TEXT,
      notes TEXT,
      recorded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (contribution_type_id) REFERENCES contribution_types(id) ON DELETE RESTRICT,
      FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_type ON contributions(contribution_type_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(payment_date);
    CREATE INDEX IF NOT EXISTS idx_contributions_method ON contributions(payment_method);
    CREATE INDEX IF NOT EXISTS idx_contributions_recorded_by ON contributions(recorded_by);

    -- ── Finance Daily Records ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS finance_daily_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_date DATE NOT NULL UNIQUE,
      morning_offering REAL DEFAULT 0,
      afternoon_offering REAL DEFAULT 0,
      total_tithes REAL DEFAULT 0,
      total_income REAL DEFAULT 0,
      mission_fund REAL DEFAULT 0,
      remaining_after_mission REAL DEFAULT 0,
      bishop_fund REAL DEFAULT 0,
      usable_church_funds REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected')),
      notes TEXT,
      submitted_at DATETIME,
      submitted_by INTEGER,
      approved_at DATETIME,
      approved_by INTEGER,
      rejection_reason TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (submitted_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_finance_records_date ON finance_daily_records(record_date);
    CREATE INDEX IF NOT EXISTS idx_finance_records_status ON finance_daily_records(status);
    CREATE INDEX IF NOT EXISTS idx_finance_records_created_by ON finance_daily_records(created_by);

    -- ── Finance Expenses ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS finance_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Food', 'Water', 'Fruits', 'Sugar', 'Media', 'Visitors', 'Transport', 'Other')),
      amount REAL NOT NULL CHECK(amount > 0),
      description TEXT,
      receipt_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES finance_daily_records(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_finance_expenses_record ON finance_expenses(record_id);
    CREATE INDEX IF NOT EXISTS idx_finance_expenses_category ON finance_expenses(category);
  `);

  db.run(`ALTER TABLE new_members ADD COLUMN marital_status TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE new_members ADD COLUMN date_of_birth DATE`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE new_members ADD COLUMN occupation TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE new_members ADD COLUMN invitation_source TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  // Migration: Add columns to member_titles for leadership roles enhancement
  db.run(`ALTER TABLE member_titles ADD COLUMN appointment_date DATE`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE member_titles ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE member_titles ADD COLUMN notes TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  // Migration: Add profile_picture to users if it doesn't exist
  db.run(`ALTER TABLE users ADD COLUMN profile_picture TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  // Migration: Add 2FA columns to users
  db.run(`ALTER TABLE users ADD COLUMN totp_secret TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN backup_codes TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  // Migration: Add is_active to members for soft deletes
  db.run(`ALTER TABLE members ADD COLUMN is_active INTEGER DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  // Migration: Add date_of_birth to members
  db.run(`ALTER TABLE members ADD COLUMN date_of_birth DATE`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE members ADD COLUMN show_age_to_leaders INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE members ADD COLUMN hide_from_birthday_list INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  // Migration: Add is_active to leaders for soft deletes
  db.run(`ALTER TABLE leaders ADD COLUMN is_active INTEGER DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE members ADD COLUMN hall_of_fame_points INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE members ADD COLUMN visitor_date DATE`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE attendance ADD COLUMN service_type_id INTEGER REFERENCES service_types(id)`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE members ADD COLUMN address TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE visitor_intake ADD COLUMN address TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE visitor_intake ADD COLUMN invitation_source TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE members ADD COLUMN marital_status TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`ALTER TABLE members ADD COLUMN occupation TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`UPDATE members SET is_active = 1 WHERE is_active IS NULL`);
  db.run(`UPDATE leaders SET is_active = 1 WHERE is_active IS NULL`);

  db.run(`ALTER TABLE attendance ADD COLUMN service_type TEXT DEFAULT 'main'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `, (err) => {
    if (!err) {
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('points_attendance', '10')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('points_excused', '3')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('midweek_day', 'Wednesday')`);
      
      // Performance Center - Member Weights
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_church_attendance', '30')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_cell_attendance', '20')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_evangelism', '15')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_contributions', '10')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_events', '5')`);

      // Performance Center - Leader Weights
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_submission_rate', '20')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_member_attendance', '20')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_retention', '15')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_cell_growth', '15')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_evangelism', '10')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_followups', '10')`);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_reports', '5')`);
    }
  });

  // Seeding default service types
  db.get('SELECT COUNT(*) as count FROM service_types', (err, row) => {
    if (!err && row.count === 0) {
      const defaults = [
        {
          name: 'Main Service',
          day: 'Sunday',
          rules: JSON.stringify({}),
          points: JSON.stringify({ present: 10, excused: 3 })
        },
        {
          name: 'Leaders Gathering',
          day: 'Tuesday',
          rules: JSON.stringify({ roles: ['admin', 'leader'] }),
          points: JSON.stringify({ present: 5, excused: 3 })
        },
        {
          name: 'Youth Service',
          day: 'Wednesday',
          rules: JSON.stringify({ sections: ['Youth'], age_range: [13, 25] }),
          points: JSON.stringify({ present: 5, excused: 3 })
        },
        {
          name: 'Women\'s Service',
          day: 'Thursday',
          rules: JSON.stringify({ gender: 'Female', sections: ['Women\'s Ministry'] }),
          points: JSON.stringify({ present: 5, excused: 3 })
        },
        {
          name: 'Prayer Service',
          day: 'Friday',
          rules: JSON.stringify({}),
          points: JSON.stringify({ present: 5, excused: 3 })
        }
      ];

      defaults.forEach(d => {
        db.run(
          'INSERT INTO service_types (name, default_day, eligibility_rules, points_config) VALUES (?, ?, ?, ?)',
          [d.name, d.day, d.rules, d.points]
        );
      });
    }
  });

  // Seed default contribution types
  db.get('SELECT COUNT(*) as count FROM contribution_types', (err, row) => {
    if (!err && row.count === 0) {
      const defaults = ['Tithes', 'Evangelism Offering', 'Offerings', 'First Fruit', 'Building Fund', 'Missions', 'Thanksgiving', 'Project'];
      defaults.forEach((name, i) => {
        db.run('INSERT INTO contribution_types (name, sort_order) VALUES (?, ?)', [name, i]);
      });
    }
  });

  // Data cleanup: Map old service_type text to service_type_id
  db.run(`UPDATE attendance SET service_type_id = 1 WHERE service_type_id IS NULL AND (service_type IN ('main', 'morning', 'evening') OR service_type IS NULL)`);
  db.run(`UPDATE attendance SET service_type_id = 3 WHERE service_type_id IS NULL AND service_type IN ('youth_service', 'midweek')`);
  db.run(`UPDATE attendance SET service_type_id = 2 WHERE service_type_id IS NULL AND service_type = 'leaders_gathering'`);
  db.run(`UPDATE attendance SET service_type_id = 4 WHERE service_type_id IS NULL AND service_type = 'women_service'`);
  db.run(`UPDATE attendance SET service_type_id = 5 WHERE service_type_id IS NULL AND service_type = 'prayer_service'`);

  // Migration: Add login failure tracking to users
  db.run(`ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN locked_until DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  // C3-fix: password reset columns
  db.run(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN password_reset_expires DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN is_new_member_leader INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN member_id INTEGER REFERENCES members(id) ON DELETE SET NULL`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL`, (err) => {
    if (err) console.log('Migration note:', err.message);
  });

  // Migration: Create outreach_logs table (updated schema)
  db.run(`CREATE TABLE IF NOT EXISTS outreach_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leader_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    contact_method TEXT NOT NULL CHECK(contact_method IN ('Call', 'WhatsApp', 'SMS', 'Visit', 'Prayer', 'Counseling', 'Hospital Visit', 'Other', 'sms', 'whatsapp', 'phone', 'email', 'visit', 'other')),
    outcome TEXT,
    service_id INTEGER,
    created_by INTEGER,
    message TEXT,
    week_start DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES service_types(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )`, (err) => {
    if (err && !err.message.includes('already exists')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_outreach_leader ON outreach_logs(leader_id)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_outreach_member ON outreach_logs(member_id)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_outreach_week ON outreach_logs(week_start)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_outreach_leader_week ON outreach_logs(leader_id, week_start)`, () => {});

  // Migration: Create scheduled_reminders table
  db.run(`CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('submission_reminder', 'follow_up_reminder', 'birthday_greeting', 'weekly_summary')),
    entity_type TEXT,
    entity_id INTEGER,
    scheduled_for DATETIME NOT NULL,
    sent BOOLEAN DEFAULT 0,
    sent_at DATETIME,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err && !err.message.includes('already exists')) {
      console.log('Migration note:', err.message);
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON scheduled_reminders(scheduled_for, sent)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_reminders_type ON scheduled_reminders(type)`, () => {});

  // Migration: Pastoral Care Command Center Additions
  db.run(`ALTER TABLE members ADD COLUMN last_contacted_at DATETIME`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`ALTER TABLE members ADD COLUMN last_contacted_by INTEGER REFERENCES users(id)`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`ALTER TABLE members ADD COLUMN prayer_requests TEXT DEFAULT '[]'`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'Active'`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`ALTER TABLE members ADD COLUMN flags TEXT DEFAULT '[]'`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`ALTER TABLE members ADD COLUMN soft_deleted_at DATETIME`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`ALTER TABLE members ADD COLUMN pending_deletion_at DATETIME`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`ALTER TABLE members ADD COLUMN deletion_confirmed_at DATETIME`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`ALTER TABLE members ADD COLUMN deletion_confirmed_by INTEGER REFERENCES users(id)`, (err) => { if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message) });
  db.run(`CREATE INDEX IF NOT EXISTS idx_members_pending_deletion ON members(soft_deleted_at, pending_deletion_at) WHERE is_active = 0`, (err) => { if (err) console.log('Migration:', err.message) });

  db.run(`CREATE TABLE IF NOT EXISTS pastoral_care_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    assigned_by INTEGER NOT NULL,
    assigned_to INTEGER NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE
  )`, (err) => { if (err && !err.message.includes('already exists')) console.log(err.message); });

  db.run(`CREATE TABLE IF NOT EXISTS hall_of_fame_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    outreach_log_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  )`, (err) => { if (err && !err.message.includes('already exists')) console.log(err.message); });

  // Complex Migration: Rebuilding outreach_logs to support expanded check constraints
  db.all("PRAGMA table_info(outreach_logs)", (err, cols) => {
    if (!err && cols) {
      const hasOutcome = cols.some(c => c.name === 'outcome');
      if (!hasOutcome) {
        console.log("Migrating outreach_logs schema...");
        db.serialize(() => {
          db.run("PRAGMA foreign_keys=off;");
          db.run("BEGIN TRANSACTION;");
          db.run(`CREATE TABLE outreach_logs_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            leader_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            contact_method TEXT NOT NULL,
            outcome TEXT,
            service_id INTEGER,
            created_by INTEGER,
            message TEXT,
            week_start DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (service_id) REFERENCES service_types(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
          )`);
          db.run(`INSERT INTO outreach_logs_new (id, leader_id, member_id, contact_method, message, week_start, created_at)
                  SELECT id, leader_id, member_id, contact_method, message, week_start, created_at FROM outreach_logs`);
          db.run("DROP TABLE outreach_logs");
          db.run("ALTER TABLE outreach_logs_new RENAME TO outreach_logs");
          
          db.run("CREATE INDEX IF NOT EXISTS idx_outreach_leader ON outreach_logs(leader_id)");
          db.run("CREATE INDEX IF NOT EXISTS idx_outreach_member ON outreach_logs(member_id)");
          db.run("CREATE INDEX IF NOT EXISTS idx_outreach_week ON outreach_logs(week_start)");
          db.run("CREATE INDEX IF NOT EXISTS idx_outreach_leader_week ON outreach_logs(leader_id, week_start)");
          
          db.run("COMMIT;");
          db.run("PRAGMA foreign_keys=on;");
          console.log("outreach_logs schema migration complete.");
        });
      }
    }
  });

  // Migration: Ensure Evangelism Offering contribution type exists
  db.run(`INSERT OR IGNORE INTO contribution_types (name, description, sort_order) VALUES ('Evangelism Offering', 'Dedicated offering for evangelism ministry', 1)`, (err) => {
    if (err) console.log('Migration note (evangelism offering):', err.message);
  });

  // Migration: Add evangelism_offering and receipt columns to finance_daily_records
  const financeMigrations = [
    `ALTER TABLE finance_daily_records ADD COLUMN evangelism_offering REAL DEFAULT 0`,
    `ALTER TABLE finance_daily_records ADD COLUMN bishop_receipt TEXT`,
    `ALTER TABLE finance_daily_records ADD COLUMN evangelism_receipt TEXT`,
    `ALTER TABLE finance_daily_records ADD COLUMN remaining_receipt TEXT`,
  ];
  financeMigrations.forEach(sql => {
    db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('Migration note (finance):', err.message);
      }
    });
  });
});
}

// Helper function to promisify database operations
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function ensureLeadershipAndDepartmentsSchema() {
  // Check if category exists in congregation_titles
  let needRebuild = false;
  try {
    await run("SELECT category FROM congregation_titles LIMIT 1");
  } catch (err) {
    needRebuild = true;
  }

  // Also check if departments table exists
  if (!needRebuild) {
    try {
      await run("SELECT id FROM departments LIMIT 1");
    } catch (err) {
      needRebuild = true;
    }
  }

  if (needRebuild) {
    console.log('Rebuilding congregation titles, member titles, and departments from scratch...');
    
    // Drop in correct order of foreign keys
    await run("DROP TABLE IF EXISTS department_history");
    await run("DROP TABLE IF EXISTS department_members");
    await run("DROP TABLE IF EXISTS departments");
    await run("DROP TABLE IF EXISTS member_title_history");
    await run("DROP TABLE IF EXISTS member_titles");
    await run("DROP TABLE IF EXISTS congregation_titles");

    // Recreate tables based on dialect
    if (usePostgres) {
      await run(`
        CREATE TABLE congregation_titles (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          category TEXT DEFAULT 'General',
          reports_to_title_id INTEGER REFERENCES congregation_titles(id) ON DELETE SET NULL,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await run(`
        CREATE TABLE member_titles (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          title_id INTEGER NOT NULL REFERENCES congregation_titles(id) ON DELETE CASCADE,
          assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          appointment_date DATE,
          status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave', 'emeritus', 'probationary', 'retired')),
          notes TEXT,
          UNIQUE(member_id, title_id)
        )
      `);

      await run(`
        CREATE TABLE member_title_history (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          title_id INTEGER NOT NULL REFERENCES congregation_titles(id) ON DELETE CASCADE,
          action TEXT NOT NULL CHECK(action IN ('assigned', 'removed', 'status_changed', 'notes_updated')),
          old_status TEXT,
          new_status TEXT,
          old_notes TEXT,
          new_notes TEXT,
          changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await run(`
        CREATE TABLE departments (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          reports_to_title_id INTEGER REFERENCES congregation_titles(id) ON DELETE SET NULL,
          leader_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
          assistant_leader_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
          secretary_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await run(`
        CREATE TABLE department_members (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(department_id, member_id)
        )
      `);

      await run(`
        CREATE TABLE department_history (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
          member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
          role TEXT NOT NULL,
          action TEXT NOT NULL,
          notes TEXT,
          changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      // SQLite
      await run(`
        CREATE TABLE congregation_titles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          category TEXT DEFAULT 'General',
          reports_to_title_id INTEGER,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (reports_to_title_id) REFERENCES congregation_titles(id) ON DELETE SET NULL
        )
      `);

      await run(`
        CREATE TABLE member_titles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member_id INTEGER NOT NULL,
          title_id INTEGER NOT NULL,
          assigned_by INTEGER,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          appointment_date DATE,
          status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave', 'emeritus', 'probationary', 'retired')),
          notes TEXT,
          UNIQUE(member_id, title_id),
          FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
          FOREIGN KEY (title_id) REFERENCES congregation_titles(id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      await run(`
        CREATE TABLE member_title_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member_id INTEGER NOT NULL,
          title_id INTEGER NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('assigned', 'removed', 'status_changed', 'notes_updated')),
          old_status TEXT,
          new_status TEXT,
          old_notes TEXT,
          new_notes TEXT,
          changed_by INTEGER,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
          FOREIGN KEY (title_id) REFERENCES congregation_titles(id) ON DELETE CASCADE,
          FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      await run(`
        CREATE TABLE departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          reports_to_title_id INTEGER,
          leader_id INTEGER,
          assistant_leader_id INTEGER,
          secretary_id INTEGER,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (reports_to_title_id) REFERENCES congregation_titles(id) ON DELETE SET NULL,
          FOREIGN KEY (leader_id) REFERENCES members(id) ON DELETE SET NULL,
          FOREIGN KEY (assistant_leader_id) REFERENCES members(id) ON DELETE SET NULL,
          FOREIGN KEY (secretary_id) REFERENCES members(id) ON DELETE SET NULL
        )
      `);

      await run(`
        CREATE TABLE department_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          department_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(department_id, member_id),
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        )
      `);

      await run(`
        CREATE TABLE department_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          department_id INTEGER NOT NULL,
          member_id INTEGER,
          role TEXT NOT NULL,
          action TEXT NOT NULL,
          notes TEXT,
          changed_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
          FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
    }

    // Recreate indexes
    await run("CREATE INDEX IF NOT EXISTS idx_member_titles_member ON member_titles(member_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_member_titles_title ON member_titles(title_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_member_titles_status ON member_titles(status)");
    await run("CREATE INDEX IF NOT EXISTS idx_mt_history_member ON member_title_history(member_id, title_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_mt_history_created ON member_title_history(created_at)");
    await run("CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON department_members(department_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_dept_members_member ON department_members(member_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_dept_history_dept ON department_history(department_id)");

    // Helper functions for database-independent insertions
    const insertTitle = async (name, description, category, sort_order, reports_to_title_name = null) => {
      let reports_to_title_id = null;
      if (reports_to_title_name) {
        const parent = await get("SELECT id FROM congregation_titles WHERE name = ?", [reports_to_title_name]);
        if (parent) reports_to_title_id = parent.id;
      }
      await run("INSERT INTO congregation_titles (name, description, category, sort_order, reports_to_title_id) VALUES (?, ?, ?, ?, ?)",
        [name, description, category, sort_order, reports_to_title_id]);
      const inserted = await get("SELECT id FROM congregation_titles WHERE name = ?", [name]);
      return inserted ? inserted.id : null;
    };

    const insertDept = async (name, description, reports_to_title_name) => {
      let reports_to_title_id = null;
      if (reports_to_title_name) {
        const parent = await get("SELECT id FROM congregation_titles WHERE name = ?", [reports_to_title_name]);
        if (parent) reports_to_title_id = parent.id;
      }
      await run("INSERT INTO departments (name, description, reports_to_title_id) VALUES (?, ?, ?)",
        [name, description, reports_to_title_id]);
    };

    console.log('Seeding default congregation titles and departments...');
    
    // Seed Titles
    await insertTitle('Lead Pastor', 'Head of the Church, overall spiritual and administrative oversight', 'Pastoral & Spiritual Care', 1);
    await insertTitle('Assistant Pastor', 'Assists the Lead Pastor in church operations and spiritual oversight', 'Pastoral & Spiritual Care', 2, 'Lead Pastor');
    await insertTitle('Church Elder', 'Spiritual governance and doctrinal oversight council member', 'Pastoral & Spiritual Care', 3, 'Lead Pastor');
    await insertTitle('Prayer Pastor', 'Oversees the prayer ministries and intercessory department', 'Pastoral & Spiritual Care', 4, 'Assistant Pastor');
    await insertTitle('Evangelist Pastor', 'Oversees missions, outreach, and evangelism department', 'Pastoral & Spiritual Care', 5, 'Assistant Pastor');
    await insertTitle('Youth Pastor', 'Oversees the youth ministry and department activities', 'Pastoral & Spiritual Care', 6, 'Assistant Pastor');
    await insertTitle('Women Pastor', 'Oversees the women ministry and department activities', 'Pastoral & Spiritual Care', 7, 'Assistant Pastor');
    await insertTitle('Section Pastor', 'Oversees geographical sections and home fellowships', 'Pastoral & Spiritual Care', 8, 'Assistant Pastor');
    await insertTitle('Section Leader', 'Coordinates leaders within a geographical section', 'Small Groups & Discipleship', 9, 'Section Pastor');
    await insertTitle('Cell / Home Fellowship Leader', 'Shepherds weekly small group fellowships in homes', 'Small Groups & Discipleship', 10, 'Section Leader');
    await insertTitle('Department Leader', 'Oversees departmental planning and execution', 'Operations & Administration', 11, 'Assistant Pastor');

    // Seed Departments
    await insertDept('Prayer Department', 'Focuses on church prayer chains, intercession, and vigils', 'Prayer Pastor');
    await insertDept('Evangelism Department', 'Outreach, missions, and community evangelism activities', 'Evangelist Pastor');
    await insertDept('Youth Department', 'Youth services, camps, and spiritual growth events', 'Youth Pastor');
    await insertDept('Women Department', 'Women fellowships, conferences, and benevolence programs', 'Women Pastor');
    await insertDept('Children Department', 'Sunday school classes, children ministry, and teacher training', 'Assistant Pastor');
    await insertDept('Worship Department', 'Choir, praise team, and instrumental music for services', 'Assistant Pastor');
    await insertDept('Ushers Department', 'Hospitality, welcoming, security, and orderly seating during services', 'Assistant Pastor');
    await insertDept('Protocol Department', 'Distinguished guest hosting, security, and pastor logistics support', 'Assistant Pastor');
    await insertDept('Media Department', 'Audio, video production, photography, projection, and livestreaming', 'Assistant Pastor');
    await insertDept('Finance Department', 'Tithes, offerings, budget oversight, and church financial planning', 'Lead Pastor');
    await insertDept('Development Department', 'Church building maintenance, capital projects, and estate planning', 'Lead Pastor');
    await insertDept('New Members Department', 'Visitor follow-up, foundation classes, and baptism classes coordination', 'Assistant Pastor');

    console.log('Seeding completed successfully!');
  }
}

async function ensureHomeCellSchema() {
  // Ensure base tables exist first (needed by ensureLeadershipAndDepartmentsSchema)
  if (usePostgres) {
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'leader', 'pastor', 'evangelist')),
        full_name TEXT NOT NULL,
        profile_picture TEXT,
        totp_secret TEXT,
        totp_enabled INTEGER DEFAULT 0,
        backup_codes TEXT,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ,
        password_reset_token TEXT,
        password_reset_expires TIMESTAMPTZ,
        password_reset_used INTEGER DEFAULT 0,
        lockout_count INTEGER DEFAULT 0,
        is_new_member_leader INTEGER DEFAULT 0,
        member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL`);
    await run(`
      CREATE TABLE IF NOT EXISTS sections (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS leaders (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL,
        section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        phone TEXT,
        email TEXT,
        is_head INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, section_id)
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        membership_id TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        leader_id INTEGER NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
        phone TEXT,
        email TEXT,
        gender TEXT,
        date_of_birth DATE,
        age_group TEXT,
        is_active INTEGER DEFAULT 1,
        profile_picture TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  await ensureLeadershipAndDepartmentsSchema();
  if (usePostgres) {
    // Unqualified table names work because the Neon role's default
    // search_path=public is honoured by direct connections (the
    // `-pooler` endpoint is not used; the pg Pool handles pooling
    // application-side). See server/.env DATABASE_URL.
    await run(`
      CREATE TABLE IF NOT EXISTS home_cells (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        cell_number INTEGER UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS home_cell_leaders (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        cell_id INTEGER NOT NULL REFERENCES home_cells(id) ON DELETE CASCADE,
        leader_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cell_id, leader_id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS home_cell_members (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        cell_id INTEGER NOT NULL REFERENCES home_cells(id) ON DELETE CASCADE,
        church_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        duplicate_key TEXT UNIQUE NOT NULL,
        added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS ip_login_failures (
        ip TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        locked_until TIMESTAMPTZ
      )
    `);
    await run(`
      CREATE INDEX IF NOT EXISTS idx_ip_login_failures_locked
      ON ip_login_failures(locked_until)
      WHERE locked_until IS NOT NULL
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS congregation_titles (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'General',
        reports_to_title_id INTEGER REFERENCES congregation_titles(id) ON DELETE SET NULL,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS member_titles (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        title_id INTEGER NOT NULL REFERENCES congregation_titles(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        appointment_date DATE,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave', 'emeritus', 'probationary', 'retired')),
        notes TEXT,
        UNIQUE(member_id, title_id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS member_title_history (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        title_id INTEGER NOT NULL REFERENCES congregation_titles(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK(action IN ('assigned', 'removed', 'status_changed', 'notes_updated')),
        old_status TEXT,
        new_status TEXT,
        old_notes TEXT,
        new_notes TEXT,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        reports_to_title_id INTEGER REFERENCES congregation_titles(id) ON DELETE SET NULL,
        leader_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        assistant_leader_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        secretary_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS department_members (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(department_id, member_id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS department_history (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        role TEXT NOT NULL,
        action TEXT NOT NULL,
        notes TEXT,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_member_titles_member ON member_titles(member_id)
    `);
    await run(`
      CREATE INDEX IF NOT EXISTS idx_member_titles_title ON member_titles(title_id)
    `);
    await run(`
      CREATE INDEX IF NOT EXISTS idx_mt_history_member ON member_title_history(member_id, title_id)
    `);
    await run(`
      CREATE INDEX IF NOT EXISTS idx_mt_history_created ON member_title_history(created_at)
    `);
    await run(`
      CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON department_members(department_id)
    `);
    await run(`
      CREATE INDEX IF NOT EXISTS idx_dept_members_member ON department_members(member_id)
    `);
    await run(`
      CREATE INDEX IF NOT EXISTS idx_dept_history_dept ON department_history(department_id)
    `);

    // New Member Tracking tables (non-fatal if tables already exist)
    try {
      await run(`
        CREATE TABLE IF NOT EXISTS new_members (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          full_name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          date_joined DATE NOT NULL DEFAULT CURRENT_DATE,
          decision_type TEXT,
          marital_status TEXT,
          date_of_birth DATE,
          occupation TEXT,
          invitation_source TEXT,
          added_by INTEGER,
          mentor_id INTEGER,
          status TEXT DEFAULT 'probation',
          graduation_date DATE,
          graduated_to_section_id INTEGER,
          graduated_by INTEGER,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await run(`
        CREATE TABLE IF NOT EXISTS new_member_attendance (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          new_member_id INTEGER NOT NULL,
          week_start DATE NOT NULL,
          attended INTEGER DEFAULT 0,
          notes TEXT,
          recorded_by INTEGER,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(new_member_id, week_start)
        )
      `);
      await run('CREATE INDEX IF NOT EXISTS idx_new_member_attendance_member ON new_member_attendance(new_member_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_new_members_status ON new_members(status)');
      await run('CREATE INDEX IF NOT EXISTS idx_new_members_joined ON new_members(date_joined)');
    } catch (e) {
      console.warn('New member tables migration skipped (non-fatal):', e.message);
    }
  } else {
    await run(`
      CREATE TABLE IF NOT EXISTS home_cells (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        cell_number INTEGER UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS home_cell_leaders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cell_id INTEGER NOT NULL,
        leader_id INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cell_id, leader_id),
        FOREIGN KEY (cell_id) REFERENCES home_cells(id) ON DELETE CASCADE,
        FOREIGN KEY (leader_id) REFERENCES members(id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS home_cell_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cell_id INTEGER NOT NULL,
        church_member_id INTEGER,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        duplicate_key TEXT UNIQUE NOT NULL,
        added_by INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cell_id) REFERENCES home_cells(id) ON DELETE CASCADE,
        FOREIGN KEY (church_member_id) REFERENCES members(id) ON DELETE SET NULL,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS new_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        date_joined DATE NOT NULL DEFAULT CURRENT_DATE,
        decision_type TEXT,
        marital_status TEXT,
        date_of_birth DATE,
        occupation TEXT,
        invitation_source TEXT,
        added_by INTEGER,
        mentor_id INTEGER,
        status TEXT DEFAULT 'probation' CHECK(status IN ('probation', 'graduated', 'permanent')),
        graduation_date DATE,
        graduated_to_section_id INTEGER,
        graduated_by INTEGER,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (mentor_id) REFERENCES members(id) ON DELETE SET NULL,
        FOREIGN KEY (graduated_to_section_id) REFERENCES sections(id) ON DELETE SET NULL,
        FOREIGN KEY (graduated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS new_member_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        new_member_id INTEGER NOT NULL,
        week_start DATE NOT NULL,
        attended INTEGER DEFAULT 0,
        notes TEXT,
        recorded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(new_member_id, week_start),
        FOREIGN KEY (new_member_id) REFERENCES new_members(id) ON DELETE CASCADE,
        FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await run('CREATE INDEX IF NOT EXISTS idx_new_member_attendance_member ON new_member_attendance(new_member_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_new_members_status ON new_members(status)');
    await run('CREATE INDEX IF NOT EXISTS idx_new_members_joined ON new_members(date_joined)');
  }

  const service = await get('SELECT id FROM service_types WHERE LOWER(name) = LOWER(?)', ['Home Cell']);
  if (!service) {
    await run(
      'INSERT INTO service_types (name, default_day, eligibility_rules, points_config, is_active) VALUES (?, ?, ?, ?, 1)',
      ['Home Cell', 'Tuesday', JSON.stringify({ home_cells: true }), JSON.stringify({ present: 5, excused: 3 })]
    );
  }

  for (let number = 1; number <= 5; number += 1) {
    await run(
      'INSERT INTO home_cells (name, cell_number, is_active) VALUES (?, ?, 1) ON CONFLICT DO NOTHING',
      [`Home Cell ${number}`, number]
    );
  }

  // Ensure metadata columns exist in home_cells (idempotent migration)
  if (usePostgres) {
    try {
      await run('ALTER TABLE home_cells ADD COLUMN IF NOT EXISTS meeting_day TEXT');
      await run('ALTER TABLE home_cells ADD COLUMN IF NOT EXISTS location TEXT');
      await run('ALTER TABLE home_cells ADD COLUMN IF NOT EXISTS max_capacity INTEGER');
    } catch (e) {
      console.warn('PostgreSQL home_cells column migration failed (non-fatal):', e.message);
    }
  } else {
    // SQLite
    const addColumn = async (colName, colType) => {
      try {
        await run(`ALTER TABLE home_cells ADD COLUMN ${colName} ${colType}`);
      } catch (e) {
        if (!e.message.includes('duplicate column name') && !e.message.includes('already exists')) {
          console.warn(`SQLite home_cells column migration failed for ${colName}:`, e.message);
        }
      }
    };
    await addColumn('meeting_day', 'TEXT');
    await addColumn('location', 'TEXT');
    await addColumn('max_capacity', 'INTEGER');
  }

  if (usePostgres) {
    // C3-fix: idempotent column add for already-deployed PG databases.
    // These columns exist in postgres-schema.sql (CREATE TABLE), but
    // because the schema file is only read by the one-off migration
    // script, we re-apply ALTER TABLE on every boot. Safe because of
    // IF NOT EXISTS. Non-fatal: a failure here does not block the
    // server from starting; the password-reset feature is degraded
    // but everything else works.
    try {
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT');
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ');
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_used INTEGER DEFAULT 0');
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_count INTEGER DEFAULT 0');
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_new_member_leader INTEGER DEFAULT 0');
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0');
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ');
      await run('CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL');
    } catch (e) {
      console.warn('password-reset column ensure failed (non-fatal):', e.message);
    }

    try {
      await run('ALTER TABLE member_titles ADD COLUMN IF NOT EXISTS appointment_date DATE');
      await run('ALTER TABLE member_titles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'active\'');
      await run('ALTER TABLE member_titles ADD COLUMN IF NOT EXISTS notes TEXT');
    } catch (e) {
      console.warn('member_titles column migration failed (non-fatal):', e.message);
    }

    try {
      await run('CREATE INDEX IF NOT EXISTS idx_member_titles_status ON member_titles(status)');
    } catch (e) {
      console.warn('member_titles status index creation failed (non-fatal):', e.message);
    }

    // Additional indexes
    try {
      await run('CREATE INDEX IF NOT EXISTS idx_attendance_service_type_id ON attendance(service_type_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_leaders_user_id ON leaders(user_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at)');
      await run('CREATE INDEX IF NOT EXISTS idx_submission_log_leader_id ON submission_log(leader_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_attendance_date_service ON attendance(date, service_type_id)');
    } catch (e) {
      console.warn('Additional index creation failed (non-fatal):', e.message);
    }

    try {
      // Create contribution_types table
      await run(`
        CREATE TABLE IF NOT EXISTS contribution_types (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Create contributions table
      await run(`
        CREATE TABLE IF NOT EXISTS contributions (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          contribution_type_id INTEGER NOT NULL REFERENCES contribution_types(id) ON DELETE RESTRICT,
          amount NUMERIC NOT NULL CHECK(amount > 0),
          payment_date DATE NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK(payment_method IN ('Cash', 'Mobile Money', 'Bank Transfer', 'Other')),
          reference_number TEXT,
          notes TEXT,
          recorded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Create finance_daily_records table
      await run(`
        CREATE TABLE IF NOT EXISTS finance_daily_records (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          record_date DATE NOT NULL UNIQUE,
          morning_offering NUMERIC DEFAULT 0,
          afternoon_offering NUMERIC DEFAULT 0,
          total_tithes NUMERIC DEFAULT 0,
          total_income NUMERIC DEFAULT 0,
          mission_fund NUMERIC DEFAULT 0,
          remaining_after_mission NUMERIC DEFAULT 0,
          bishop_fund NUMERIC DEFAULT 0,
          usable_church_funds NUMERIC DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected')),
          notes TEXT,
          submitted_at TIMESTAMPTZ,
          submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          approved_at TIMESTAMPTZ,
          approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          rejection_reason TEXT,
          created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          evangelism_offering NUMERIC DEFAULT 0,
          bishop_receipt TEXT,
          evangelism_receipt TEXT,
          remaining_receipt TEXT
        )
      `);
      // Create finance_expenses table
      await run(`
        CREATE TABLE IF NOT EXISTS finance_expenses (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          record_id INTEGER NOT NULL REFERENCES finance_daily_records(id) ON DELETE CASCADE,
          category TEXT NOT NULL CHECK(category IN ('Food', 'Water', 'Fruits', 'Sugar', 'Media', 'Visitors', 'Transport', 'Other')),
          amount NUMERIC NOT NULL CHECK(amount > 0),
          description TEXT,
          receipt_path TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Indexes
      await run('CREATE INDEX IF NOT EXISTS idx_contribution_types_active ON contribution_types(is_active, sort_order)');
      await run('CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_contributions_type ON contributions(contribution_type_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(payment_date)');
      await run('CREATE INDEX IF NOT EXISTS idx_contributions_method ON contributions(payment_method)');
      await run('CREATE INDEX IF NOT EXISTS idx_contributions_recorded_by ON contributions(recorded_by)');
      await run('CREATE INDEX IF NOT EXISTS idx_finance_records_date ON finance_daily_records(record_date)');
      await run('CREATE INDEX IF NOT EXISTS idx_finance_records_status ON finance_daily_records(status)');
      await run('CREATE INDEX IF NOT EXISTS idx_finance_records_created_by ON finance_daily_records(created_by)');
      await run('CREATE INDEX IF NOT EXISTS idx_finance_expenses_record ON finance_expenses(record_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_finance_expenses_category ON finance_expenses(category)');

      // Seed contribution types
      const countRow = await get('SELECT COUNT(*) as count FROM contribution_types');
      if (countRow && Number(countRow.count) === 0) {
        const types = ['Tithes', 'Morning Offering', 'Afternoon Offering', 'Building Fund', 'Other'];
        for (let i = 0; i < types.length; i++) {
          await run('INSERT INTO contribution_types (name, sort_order) VALUES (?, ?)', [types[i], i]);
        }
      }
      const evType = await get("SELECT id FROM contribution_types WHERE name = 'Evangelism Offering'");
      if (!evType) {
        await run("INSERT INTO contribution_types (name, description, sort_order) VALUES ('Evangelism Offering', 'Dedicated offering for evangelism ministry', 1)");
      }
    } catch (e) {
      console.warn('Finance/contribution table initialization failed (fatal for finance features):', e.message);
    }

    try {
      await run('ALTER TABLE new_members ADD COLUMN IF NOT EXISTS marital_status TEXT');
      await run('ALTER TABLE new_members ADD COLUMN IF NOT EXISTS date_of_birth DATE');
      await run('ALTER TABLE new_members ADD COLUMN IF NOT EXISTS occupation TEXT');
      await run('ALTER TABLE new_members ADD COLUMN IF NOT EXISTS invitation_source TEXT');
    } catch (e) {
      console.warn('new_members column migration failed (non-fatal):', e.message);
    }

    try {
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS marital_status TEXT');
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation TEXT');
    } catch (e) {
      console.warn('members column migration failed (non-fatal):', e.message);
    }
  }
}

// ── Users Role Constraint Migration ──────────────────────────────────────
async function migrateUsersRoleConstraint() {
  try {
    if (usePostgres) {
      await run(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
      await run(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'leader', 'pastor', 'evangelist', 'accountant'))`);
      await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id INTEGER REFERENCES members(id) ON DELETE SET NULL`);
      console.log('PostgreSQL users role constraint migrated.');
    } else {
      const row = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`);
      if (row && row.sql && !row.sql.includes('accountant')) {
        await run(`PRAGMA foreign_keys=OFF`);
        await run(`BEGIN TRANSACTION`);
        await run(`CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'leader', 'pastor', 'evangelist', 'accountant')),
          full_name TEXT NOT NULL,
          profile_picture TEXT,
          totp_secret TEXT,
          totp_enabled INTEGER DEFAULT 0,
          backup_codes TEXT,
          password_reset_token TEXT,
          password_reset_expires DATETIME,
          password_reset_used INTEGER DEFAULT 0,
          lockout_count INTEGER DEFAULT 0,
          member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          failed_login_attempts INTEGER DEFAULT 0,
          locked_until DATETIME,
          is_new_member_leader INTEGER DEFAULT 0
        )`);
        await run(`INSERT INTO users_new SELECT * FROM users`);
        await run(`DROP TABLE users`);
        await run(`ALTER TABLE users_new RENAME TO users`);
        await run(`CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL`);
        await run(`COMMIT`);
        await run(`PRAGMA foreign_keys=ON`);
        console.log('SQLite users role constraint migrated.');
      }
    }
  } catch (err) {
    console.error('Failed to migrate users role constraint:', err.message);
  }
}

// ── Link Users to Members ─────────────────────────────────────────────
async function linkUsersToMembers() {
  try {
    const users = await all("SELECT id, full_name, member_id FROM users WHERE member_id IS NULL");
    let linked = 0;
    for (const user of users) {
      if (!user.full_name) continue;
      // Split name into parts and build a LIKE search
      const parts = user.full_name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) continue;
      const conditions = parts.map(p => `full_name LIKE '%${p.replace(/'/g, "''")}%'`).join(' AND ');
      const member = await get(`SELECT id, full_name FROM members WHERE ${conditions} LIMIT 1`);
      if (member) {
        await run('UPDATE users SET full_name = ?, member_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [member.full_name, member.id, user.id]);
        linked++;
      }
    }
    if (linked > 0) console.log(`Linked ${linked} user(s) to member records.`);
  } catch (err) {
    console.error('Failed to link users to members:', err.message);
  }
}

// ── Evangelism Tables Migration ──────────────────────────────────────────
async function ensureEvangelismSchema() {
  const idType = usePostgres
    ? 'INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY'
    : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const tsType = usePostgres ? 'TIMESTAMPTZ' : 'DATETIME';
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS outreach_events (
        id ${idType},
        name TEXT NOT NULL,
        date DATE NOT NULL,
        location TEXT,
        event_type TEXT,
        organizer TEXT,
        volunteers INTEGER DEFAULT 0,
        budget REAL DEFAULT 0,
        results TEXT,
        created_by INTEGER,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS souls_won (
        id ${idType},
        full_name TEXT NOT NULL,
        phone TEXT,
        gender TEXT,
        age_group TEXT,
        location TEXT,
        date_saved DATE NOT NULL DEFAULT CURRENT_DATE,
        outreach_event_id INTEGER,
        soul_winner TEXT,
        follow_up_status TEXT DEFAULT 'new_convert'
          CHECK(follow_up_status IN ('new_convert','under_follow_up','joined_cell','joined_church','baptized','active_member')),
        assigned_leader_id INTEGER,
        status TEXT DEFAULT 'active',
        created_by INTEGER,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id ${idType},
        soul_won_id INTEGER NOT NULL,
        first_contact_date DATE,
        last_contact_date DATE,
        follow_up_officer TEXT,
        home_visit_status TEXT,
        counseling_status TEXT,
        prayer_needs TEXT,
        notes TEXT,
        created_by INTEGER,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (soul_won_id) REFERENCES souls_won(id) ON DELETE CASCADE
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS evangelism_team (
        id ${idType},
        full_name TEXT NOT NULL,
        role TEXT NOT NULL
          CHECK(role IN ('evangelist','section_evangelist','volunteer','soul_winner')),
        phone TEXT,
        email TEXT,
        section TEXT,
        souls_won INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS baptism_tracking (
        id ${idType},
        soul_won_id INTEGER,
        candidate_name TEXT NOT NULL,
        salvation_date DATE,
        baptism_date DATE,
        baptized_by TEXT,
        status TEXT DEFAULT 'candidate'
          CHECK(status IN ('candidate','class','scheduled','completed')),
        created_by INTEGER,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run('CREATE INDEX IF NOT EXISTS idx_souls_won_status ON souls_won(follow_up_status)');
    await run('CREATE INDEX IF NOT EXISTS idx_souls_won_date ON souls_won(date_saved)');
    await run('CREATE INDEX IF NOT EXISTS idx_follow_ups_soul ON follow_ups(soul_won_id)');
  } catch (e) {
    console.warn('Evangelism tables migration skipped (non-fatal):', e.message);
  }
}

// Prepared statement wrappers
const queries = {
  // Auth queries
  findUserByUsername: (username) => get(`
    SELECT u.*, l.is_head 
    FROM users u 
    LEFT JOIN leaders l ON u.id = l.user_id 
    WHERE u.username = ?
  `, [username]),
  incrementFailedLogin: (userId) => run('UPDATE users SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE id = ?', [userId]),
  resetFailedLogin: (userId) => run('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, lockout_count = 0 WHERE id = ?', [userId]),
  lockUser: (userId, until) => run('UPDATE users SET locked_until = ?, lockout_count = lockout_count + 1 WHERE id = ?', [until, userId]),
  isUserLocked: (userId) => get('SELECT locked_until, lockout_count FROM users WHERE id = ?', [userId]),
  // IP login failure tracking (persisted across restarts)
  getIpLoginState: (ip) => get('SELECT * FROM ip_login_failures WHERE ip = ?', [ip]),
  recordIpLoginFailure: (ip) => run(usePostgres ? `
    INSERT INTO ip_login_failures (ip, count, started_at, locked_until)
    VALUES ($1, 1, NOW(), NULL)
    ON CONFLICT(ip) DO UPDATE SET
      count = ip_login_failures.count + 1,
      locked_until = CASE WHEN ip_login_failures.count + 1 >= 25 THEN NOW() + INTERVAL '15 minutes' ELSE ip_login_failures.locked_until END
  ` : `
    INSERT INTO ip_login_failures (ip, count, started_at, locked_until)
    VALUES (?, 1, datetime('now'), NULL)
    ON CONFLICT(ip) DO UPDATE SET
      count = count + 1,
      locked_until = CASE WHEN count + 1 >= 25 THEN datetime('now', '+15 minutes') ELSE locked_until END
  `, [ip]),
  resetIpLoginState: (ip) => run('DELETE FROM ip_login_failures WHERE ip = ?', [ip]),
  cleanupIpLoginFailures: () => run(usePostgres ? `
    DELETE FROM ip_login_failures
    WHERE (started_at < NOW() - INTERVAL '15 minutes' AND (locked_until IS NULL OR locked_until < NOW()))
  ` : `
    DELETE FROM ip_login_failures
    WHERE (started_at < datetime('now', '-15 minutes') AND (locked_until IS NULL OR locked_until < datetime('now')))
  `),
  // Password reset token queries (single-use enforcement)
  validatePasswordResetToken: (tokenHash) => get(`
    SELECT id, password_reset_expires, password_reset_used
    FROM users
    WHERE password_reset_token = ? AND password_reset_used = 0
  `, [tokenHash]),
  invalidatePasswordResetToken: (userId) => run(`
    UPDATE users SET password_reset_used = 1, password_reset_token = NULL, password_reset_expires = NULL
    WHERE id = ?
  `, [userId]),
  createUser: (username, password_hash, role, full_name, profile_picture = null) =>
    run('INSERT INTO users (username, password_hash, role, full_name, profile_picture) VALUES (?, ?, ?, ?, ?)', [username, password_hash, role, full_name, profile_picture]),
  updateUserPassword: (password_hash, userId) =>
    run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [password_hash, userId]),
  updateUserFullName: (full_name, userId, member_id = null) =>
    member_id
      ? run('UPDATE users SET full_name = ?, member_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name, member_id, userId])
      : run('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name, userId]),

  // User Management queries (admin)
  getAllUsers: () => all(`
    SELECT u.id, u.username, u.role, u.full_name, u.profile_picture, u.totp_enabled,
           u.member_id, u.created_at, u.updated_at, u.failed_login_attempts, u.locked_until,
           l.id as leader_id, s.name as section_name
    FROM users u
    LEFT JOIN leaders l ON l.user_id = u.id
    LEFT JOIN sections s ON l.section_id = s.id
    ORDER BY u.role, u.full_name
  `),
  getUserById: (userId) => get(`
    SELECT u.id, u.username, u.role, u.full_name, u.profile_picture, u.totp_enabled,
           u.member_id, u.created_at, u.updated_at, l.id as leader_id, s.name as section_name
    FROM users u
    LEFT JOIN leaders l ON l.user_id = u.id
    LEFT JOIN sections s ON l.section_id = s.id
    WHERE u.id = ?
  `, [userId]),
  updateUserRole: (userId, role) =>
    run('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]),
  updateUserUsername: (userId, username) =>
    run('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [username, userId]),

  // Section queries
  getAllSections: () => all('SELECT * FROM sections ORDER BY name'),
  getSectionByName: (name) => get('SELECT * FROM sections WHERE name = ?', [name]),
  createSection: (name) => run('INSERT INTO sections (name) VALUES (?)', [name]),
  updateSection: (id, name) => run('UPDATE sections SET name = ? WHERE id = ?', [name, id]),
  deleteSection: (id) => run('DELETE FROM sections WHERE id = ?', [id]),

  updateMemberFlags: (id, flagsJson) =>
    run('UPDATE members SET flags = ? WHERE id = ?', [flagsJson, id]),

  // Leader queries
  getLeaderByUserId: (userId) => get(`
    SELECT l.*, s.name as section_name, u.username
    FROM leaders l
    JOIN sections s ON l.section_id = s.id
    JOIN users u ON l.user_id = u.id
    WHERE l.user_id = ?
  `, [userId]),
  getLeaderById: (leaderId) => get(`
    SELECT l.*, s.name as section_name, u.username, u.full_name
    FROM leaders l
    JOIN sections s ON l.section_id = s.id
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ?
  `, [leaderId]),
  getLeadersBySection: (sectionId) => all(`
    SELECT l.id, u.username, u.full_name, l.phone, l.email, l.is_head
    FROM leaders l
    JOIN users u ON l.user_id = u.id
    WHERE l.section_id = ?
  `, [sectionId]),
  createLeader: (userId, sectionId, phone, email, is_head = 0) =>
    run('INSERT INTO leaders (user_id, section_id, phone, email, is_head) VALUES (?, ?, ?, ?, ?)', [userId, sectionId, phone, email, is_head]),
  updateLeaderInfo: (leaderId, sectionId, phone, email, is_head = 0) =>
    run('UPDATE leaders SET section_id = ?, phone = ?, email = ?, is_head = ? WHERE id = ?', [sectionId, phone, email, is_head, leaderId]),
  deleteUserAndCascade: (userId) =>
    run('DELETE FROM users WHERE id = ?', [userId]),

  // Member queries
  getMembersByLeader: (leaderId) => all(`
    SELECT m.*, s.name as section_name
    FROM members m
    LEFT JOIN sections s ON m.section_id = s.id
    WHERE m.leader_id = ? AND m.is_active = 1
    ORDER BY m.full_name
  `, [leaderId]),
  getMembersBySection: (sectionId) => all(`
    SELECT m.*, u.full_name as leader_name
    FROM members m
    LEFT JOIN leaders l ON m.leader_id = l.id
    LEFT JOIN users u ON l.user_id = u.id
    WHERE m.section_id = ? AND m.is_active = 1
    ORDER BY m.full_name
  `, [sectionId]),
  // --- Dashboard Overhaul: Advanced Metrics ---
  getDashboardComparisons: (monthStart = formatLocalDate(addMonths(new Date(), -1))) => all(`
    SELECT 
      (SELECT COUNT(*) FROM members WHERE is_active = 1) as total_members,
      (SELECT COUNT(*) FROM members WHERE is_active = 1 AND created_at >= ?) as new_members_month,
      (SELECT COUNT(*) FROM sections) as total_sections,
      (SELECT COUNT(*) FROM leaders WHERE is_active = 1) as total_leaders
  `, [monthStart]),

  getTodayAttendanceStats: (serviceId = 1, today = formatLocalDate()) => {
    const isAll = String(serviceId) === 'all';
    const query = `
      SELECT 
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused
      FROM attendance
      WHERE date = ?
      ${isAll ? '' : 'AND service_type_id = ?'}
    `;
    const params = isAll ? [today] : [today, serviceId];
    return get(query, params);
  },

  getNeedsAttention: async (serviceId = 1, today = formatLocalDate()) => {
    const todayMonthDay = formatMonthDay(today);
    const visitorCutoff = formatLocalDate(addDays(today, -7));

    // 1. Birthdays Today
    const birthdays = await all(`
      SELECT 'birthday' as reason, m.id, m.full_name, m.section_id, s.name as section_name, m.date_of_birth, m.show_age_to_leaders
      FROM members m
      JOIN sections s ON m.section_id = s.id
      WHERE m.is_active = 1 AND m.hide_from_birthday_list = 0
      AND ${sqlMonthDay('m.date_of_birth')} = ?
    `, [todayMonthDay]);

    // 2. New Visitors This Week
    const visitors = await all(`
      SELECT 'visitor' as reason, m.id, m.full_name, m.section_id, s.name as section_name, m.visitor_date as date
      FROM members m
      JOIN sections s ON m.section_id = s.id
      WHERE m.is_active = 1 AND m.visitor_date >= ?
    `, [visitorCutoff]);

    // 3. Absent 3+ Weeks PER SERVICE Logic.
    //
    // DBA P1-#2: collapsed the per-service loop (2*N queries) into
    // three batched queries: services, last-3-dates-per-service,
    // absent members in one shot. The final visitor-present-count
    // query is also a single round-trip across all services.
    const services = serviceId === 'all'
      ? await all('SELECT id, name FROM service_types WHERE is_active = 1')
      : await all('SELECT id, name FROM service_types WHERE id = ?', [serviceId]);
    if (services.length === 0) {
      return [...birthdays, ...visitors].slice(0, 50);
    }
    const serviceIds = services.map((s) => s.id);
    const serviceNameById = new Map(services.map((s) => [Number(s.id), s.name]));

    // 3a. Last 3 distinct dates per service in a single query.
    // ROW_NUMBER() partitions the attendance rows by service and
    // orders by date desc; we keep only rn <= 3.
    const datesPerService = usePostgres
      ? await all(`
        SELECT service_type_id, date
        FROM (
          SELECT service_type_id, date,
                 ROW_NUMBER() OVER (PARTITION BY service_type_id ORDER BY date DESC) AS rn
          FROM attendance
          WHERE service_type_id = ANY($1::int[])
        ) ranked
        WHERE rn <= 3
      `, [serviceIds])
      : (() => {
        // SQLite: single batched query with IN clause + ROW_NUMBER()
        // (supported since SQLite 3.25). Filter to 3 dates per service in JS.
        const placeholders = serviceIds.map(() => '?').join(',');
        return all(`
          SELECT service_type_id, date
          FROM (
            SELECT service_type_id, date,
                   ROW_NUMBER() OVER (PARTITION BY service_type_id ORDER BY date DESC) AS rn
            FROM attendance
            WHERE service_type_id IN (${placeholders})
          ) ranked
          WHERE rn <= 3
        `, serviceIds);
      })();

    // Group dates by service: Map<serviceId, string[]>
    const datesByService = new Map();
    for (const row of datesPerService) {
      const sid = Number(row.service_type_id);
      if (!datesByService.has(sid)) datesByService.set(sid, []);
      datesByService.get(sid).push(row.date);
    }

    // Only proceed for services that have at least 3 dates.
    const eligibleServices = services.filter((s) => (datesByService.get(Number(s.id)) || []).length >= 3);
    if (eligibleServices.length === 0) {
      return [...birthdays, ...visitors].slice(0, 50);
    }

    // 3b. Oldest "third" date across eligible services is the
    // universal "is the member old enough?" cutoff. The original
    // per-service query used the oldest of the 3 dates for that
    // service, which is correct but can differ across services.
    // Use the earliest such oldest-date so we don't miss any
    // member.
    const cutoff = eligibleServices
      .map((s) => datesByService.get(Number(s.id))[2])
      .sort()[0];

    // 3c. Single batched query: members absent on all 3 dates for a
    // given service, in one round-trip. Returns one row per
    // (member_id, service_type_id).
    const eligibleServiceIds = eligibleServices.map((s) => Number(s.id));
    const absentRows = usePostgres
      ? await all(`
        SELECT a.member_id, a.service_type_id, a.date,
               m.full_name, m.section_id, m.opt_out_services, m.status, m.created_at,
               sec.name AS section_name
        FROM attendance a
        JOIN members m ON m.id = a.member_id
        JOIN sections sec ON m.section_id = sec.id
        WHERE a.service_type_id = ANY($1::int[])
          AND a.status = 'absent'
          AND ${dateOnly('m.created_at')} <= $2::date
        GROUP BY a.member_id, a.service_type_id, a.date,
                 m.full_name, m.section_id, m.opt_out_services, m.status, m.created_at,
                 sec.name
        HAVING COUNT(DISTINCT a.date) >= 1
      `, [eligibleServiceIds, cutoff])
      : (() => {
        // SQLite: build a single IN-list for service ids, then group
        // by member to count distinct dates.
        const placeholders = eligibleServiceIds.map(() => '?').join(',');
        return all(`
          SELECT a.member_id, a.service_type_id, a.date,
                 m.full_name, m.section_id, m.opt_out_services, m.status, m.created_at,
                 sec.name AS section_name
          FROM attendance a
          JOIN members m ON m.id = a.member_id
          JOIN sections sec ON m.section_id = sec.id
          WHERE a.service_type_id IN (${placeholders})
            AND a.status = 'absent'
            AND ${dateOnly('m.created_at')} <= ${dateOnly('?')}
          GROUP BY a.member_id, a.service_type_id, a.date,
                   m.full_name, m.section_id, m.opt_out_services, m.status, m.created_at,
                   sec.name
          HAVING COUNT(DISTINCT a.date) >= 1
        `, [...eligibleServiceIds, cutoff]);
      })();

    // 3d. Keep only members whose absent-row count for a service
    // equals the 3 dates we know about. This is the "missed all 3"
    // condition from the original code.
    const absentMembersByService = new Map();
    for (const r of absentRows) {
      const sid = Number(r.service_type_id);
      const knownDates = datesByService.get(sid) || [];
      const key = `${r.member_id}_${sid}`;
      if (!absentMembersByService.has(key)) {
        absentMembersByService.set(key, { ...r, _absentDates: [] });
      }
      absentMembersByService.get(key)._absentDates.push(r.date);
    }

    // 3e. Single batched visitor-present-count query across all
    // eligible services. Use distinct (member_id, service_type_id)
    // pairs.
    const visitorKeys = Array.from(absentMembersByService.values())
      .filter((a) => a.status === 'Visitor')
      .map((a) => `${a.member_id}_${a.service_type_id}`);
    const visitorPresentCounts = new Map();
    if (visitorKeys.length > 0) {
      const visitorMemberIds = Array.from(new Set(visitorKeys.map((k) => Number(k.split('_')[0]))));
      const visitorServiceIds = Array.from(new Set(visitorKeys.map((k) => Number(k.split('_')[1]))));
      const visitorRows = usePostgres
        ? await all(`
          SELECT member_id, service_type_id, COUNT(*) AS c
          FROM attendance
          WHERE status = 'present'
            AND member_id = ANY($1::int[])
            AND service_type_id = ANY($2::int[])
          GROUP BY member_id, service_type_id
        `, [visitorMemberIds, visitorServiceIds])
        : (() => {
          const mh = visitorMemberIds.map(() => '?').join(',');
          const sh = visitorServiceIds.map(() => '?').join(',');
          return all(`
            SELECT member_id, service_type_id, COUNT(*) AS c
            FROM attendance
            WHERE status = 'present'
              AND member_id IN (${mh})
              AND service_type_id IN (${sh})
            GROUP BY member_id, service_type_id
          `, [...visitorMemberIds, ...visitorServiceIds]);
        })();
      for (const r of visitorRows) {
        visitorPresentCounts.set(`${Number(r.member_id)}_${Number(r.service_type_id)}`, Number(r.c));
      }
    }

    // 3f. Build the per-member absentee map.
    const absenteesMap = new Map();
    for (const a of absentMembersByService.values()) {
      const sid = Number(a.service_type_id);
      const knownDates = datesByService.get(sid) || [];
      // Must have absent on ALL 3 known dates for this service.
      const allThree = knownDates.length === 3 &&
        knownDates.every((d) => a._absentDates.includes(d));
      if (!allThree) continue;

      // Opt-out check.
      let optOuts = [];
      try { optOuts = JSON.parse(a.opt_out_services || '[]'); } catch (_) { /* noop */ }
      if (optOuts.includes(serviceNameById.get(sid))) continue;

      // Visitor present-count check.
      if (a.status === 'Visitor') {
        const c = visitorPresentCounts.get(`${Number(a.member_id)}_${sid}`) || 0;
        if (c < 3) continue;
      }

      if (absenteesMap.has(Number(a.member_id))) {
        absenteesMap.get(Number(a.member_id)).missed_services.push(serviceNameById.get(sid));
      } else {
        absenteesMap.set(Number(a.member_id), {
          reason: 'absentee',
          id: Number(a.member_id),
          full_name: a.full_name,
          section_id: a.section_id,
          section_name: a.section_name,
          missed_services: [serviceNameById.get(sid)],
          missed_dates: knownDates
        });
      }
    }

    return [...birthdays, ...visitors, ...Array.from(absenteesMap.values())].slice(0, 50);
  },

  getAttendanceSparkline: (serviceId = 1, startDate = formatLocalDate(addDays(new Date(), -28))) => {
    const isAll = String(serviceId) === 'all';
    const query = `
      SELECT date, COUNT(*) as present_count
      FROM attendance
      WHERE status = 'present'
      ${isAll ? '' : 'AND service_type_id = ?'}
      AND date >= ?
      GROUP BY date
      ORDER BY date ASC
    `;
    const params = isAll ? [startDate] : [serviceId, startDate];
    return all(query, params);
  },

  getHallOfFameSummary: (year) => all(`
    SELECT m.id, m.full_name, m.hall_of_fame_points as points, s.name as section_name
    FROM members m
    JOIN sections s ON m.section_id = s.id
    WHERE m.is_active = 1
    ORDER BY points DESC
    LIMIT 3
  `),

  getSettings: () => all('SELECT * FROM settings'),
  updateSetting: (key, value) => run('UPDATE settings SET value = ? WHERE key = ?', [value, key]),

  // Service Types
  getAllServiceTypes: () => all('SELECT * FROM service_types WHERE is_active = 1'),
  getServiceTypeById: (id) => get('SELECT * FROM service_types WHERE id = ?', [id]),
  updateServiceType: (id, name, day, time, rules, points) =>
    run(`UPDATE service_types SET name = ?, default_day = ?, default_time = ?, eligibility_rules = ?, points_config = ? WHERE id = ?`,
      [name, day, time, rules, points, id]),
      
  // Service Instances / Assignments
  getServiceInstance: (serviceId, date) => get('SELECT * FROM service_instances WHERE service_id = ? AND date = ?', [serviceId, date]),
  saveServiceInstance: (serviceId, date, leaderIdsJson) => 
    run(`
      INSERT INTO service_instances (service_id, date, assigned_leader_ids) 
      VALUES (?, ?, ?) 
      ON CONFLICT(service_id, date) 
      DO UPDATE SET assigned_leader_ids = excluded.assigned_leader_ids
    `, [serviceId, date, leaderIdsJson]),
  getAssignedInstancesByLeader: (leaderId) => all(`
    SELECT * FROM service_instances 
    WHERE assigned_leader_ids LIKE ? OR assigned_leader_ids LIKE ? OR assigned_leader_ids LIKE ? OR assigned_leader_ids LIKE ?
  `, ['%['+leaderId+']%', '%['+leaderId+',%', '%,'+leaderId+',%', '%,'+leaderId+']%']),

  getAllMembers: () => all(`
    SELECT
      m.*,
      s.name as section_name,
      u.full_name as leader_name,
      u.role as user_role,
      hcm.cell_id as home_cell_id,
      hc.name as home_cell_name
    FROM members m
    LEFT JOIN sections s ON m.section_id = s.id
    LEFT JOIN leaders l ON m.leader_id = l.id
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN home_cell_members hcm ON hcm.church_member_id = m.id AND hcm.is_active = 1
    LEFT JOIN home_cells hc ON hc.id = hcm.cell_id
    WHERE m.is_active = 1
    ORDER BY s.name, m.full_name LIMIT 1000
  `),
  createMember: (membershipId, fullName, sectionId, leaderId, phone, email, gender, maritalStatus, occupation, ageGroup, dob = null, showAge = 0, hideBday = 0, optOuts = '[]', address = null) =>
    run(`
      INSERT INTO members (membership_id, full_name, section_id, leader_id, phone, email, gender, marital_status, occupation, age_group, date_of_birth, show_age_to_leaders, hide_from_birthday_list, opt_out_services, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [membershipId, fullName, sectionId, leaderId, phone, email, gender, maritalStatus, occupation, ageGroup, dob, showAge, hideBday, optOuts, address]),
  updateMember: (fullName, phone, email, gender, maritalStatus, occupation, ageGroup, dob, showAge, hideBday, optOuts, address, sectionId, leaderId, memberId) =>
    run(`
      UPDATE members
      SET full_name = ?, phone = ?, email = ?, gender = ?, marital_status = ?, occupation = ?, age_group = ?, date_of_birth = ?, show_age_to_leaders = ?, hide_from_birthday_list = ?, opt_out_services = ?, address = ?, section_id = ?, leader_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [fullName, phone, email, gender, maritalStatus, occupation, ageGroup, dob, showAge, hideBday, optOuts, address, sectionId, leaderId, memberId]),
  deleteMember: (id) => run('DELETE FROM members WHERE id = ?', [id]),
  getMemberByMembershipId: (membershipId) => get('SELECT * FROM members WHERE membership_id = ?', [membershipId]),
  findActiveMemberByName: (fullName, excludeMemberId = null) => get(`
    SELECT id, membership_id, full_name
    FROM members
    WHERE is_active = 1
      AND LOWER(TRIM(full_name)) = LOWER(TRIM(?))
      AND (CAST(? AS INTEGER) IS NULL OR id != CAST(? AS INTEGER))
    LIMIT 1
  `, [fullName, excludeMemberId, excludeMemberId]),

  // Attendance queries
  getAttendanceByLeaderAndDate: (leaderId, date) => all(`
    SELECT a.*, m.full_name as member_name, m.membership_id
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    WHERE m.leader_id = ? AND a.date = ?
  `, [leaderId, date]),
  bulkInsertAttendance: (memberId, date, status, submittedBy, serviceId = 1) =>
    run(`
      ${upsertAttendanceSql({ includeServiceType: true })}
    `, [memberId, date, status, serviceId, submittedBy]),
  checkSubmissionExists: (leaderId, date, serviceId) => get('SELECT * FROM submission_log WHERE leader_id = ? AND date = ? AND service_id = ?', [leaderId, date, serviceId]),
  logSubmission: (leaderId, sectionId, date, serviceId = 1) =>
    run('INSERT INTO submission_log (leader_id, section_id, date, service_id) VALUES (?, ?, ?, ?)', [leaderId, sectionId, date, serviceId]),
  getAttendanceByDateAndSection: (date, sectionId, serviceId = 1) => {
    const isAll = String(serviceId) === 'all';
    const query = `
      SELECT a.status, m.full_name, m.membership_id, u.full_name as leader_name, submitter.full_name as submitted_by_name
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      JOIN users submitter ON submitter.id = a.submitted_by
      WHERE a.date = ? AND m.section_id = ?
      ${isAll ? '' : 'AND a.service_type_id = ?'}
    `;
    const params = isAll ? [date, sectionId] : [date, sectionId, serviceId];
    return all(query, params);
  },

  // Dashboard/Stats queries
  getOverallAttendanceStats: () => all(`
    SELECT
      date,
      COUNT(*) as total_members,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count
    FROM attendance
    GROUP BY date
    ORDER BY date DESC
    LIMIT 30
  `),
  getLeaderSectionAttendanceStats: (leaderId, startDate, endDate) => all(`
    SELECT
      a.date,
      COUNT(*) as total_members,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    WHERE m.leader_id = ? AND a.date BETWEEN ? AND ?
    GROUP BY a.date
    ORDER BY a.date ASC
  `, [leaderId, startDate, endDate]),
  getSectionAttendanceStats: (startDate, endDate) => all(`
    SELECT
      s.name as section_name,
      a.date,
      COUNT(*) as total,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN sections s ON m.section_id = s.id
    WHERE a.date BETWEEN ? AND ?
    GROUP BY s.name, a.date
    ORDER BY a.date DESC, s.name
  `, [startDate, endDate]),
  getLeaderMetrics: (startDate, endDate) => all(`
    SELECT
      u.full_name as leader_name,
      s.name as section_name,
      COUNT(DISTINCT a.date) as reporting_days,
      COUNT(*) as total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    WHERE a.date BETWEEN ? AND ?
    GROUP BY l.id
    ORDER BY attendance_rate DESC
  `, [startDate, endDate]),
  getAtRiskMembersByRange: (startDate = formatLocalDate(addDays(new Date(), -30)), endDate = formatLocalDate()) => all(`
    SELECT
      m.membership_id,
      m.full_name,
      s.name as section_name,
      u.full_name as leader_name,
      COUNT(*) as absence_count
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON m.section_id = s.id
    WHERE a.status = 'absent'
      AND a.date BETWEEN ? AND ?
    GROUP BY m.id, m.full_name, m.membership_id, m.phone, s.name, u.full_name, l.id, l.user_id
    HAVING absence_count >= 3
    ORDER BY absence_count DESC
  `, [startDate, endDate]),
  getSubmissionCompletion: (startDate, endDate) => all(`
    SELECT
      s.name as section_name,
      u.full_name as leader_name,
      COUNT(DISTINCT sl.date) as days_submitted
    FROM submission_log sl
    JOIN leaders l ON sl.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    WHERE sl.date BETWEEN ? AND ?
    GROUP BY l.id
    ORDER BY s.name, u.full_name
  `, [startDate, endDate]),
  
  // Profile Picture Queries
  updateUserProfilePicture: (profilePicturePath, userId) =>
    run('UPDATE users SET profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [profilePicturePath, userId]),

  // 2FA Queries
  updateUser2FA: (userId, totpSecret, totpEnabled, backupCodes) =>
    run('UPDATE users SET totp_secret = ?, totp_enabled = ?, backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [totpSecret, totpEnabled ? 1 : 0, backupCodes ? JSON.stringify(backupCodes) : null, userId]),
  getUser2FA: (userId) => get('SELECT id, totp_secret, totp_enabled, backup_codes FROM users WHERE id = ?', [userId]),
  disableUser2FA: (userId) =>
    run('UPDATE users SET totp_secret = NULL, totp_enabled = 0, backup_codes = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]),

  // Advanced Analytics queries
  getAttendancePrediction: (weeks = 4) => all(`
    WITH weekly_totals AS (
      SELECT date,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
             ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as rate
      FROM attendance
      GROUP BY date
      ORDER BY date DESC
      LIMIT 12
    )
    SELECT
      ROUND(CAST(AVG(rate) AS NUMERIC), 1) as avg_rate,
      ROUND(CAST(AVG(present) AS NUMERIC), 0) as avg_present,
      ROUND(CAST(AVG(total) AS NUMERIC), 0) as avg_total,
      COUNT(*) as weeks_analyzed
    FROM weekly_totals
  `),
  getSectionAnomalies: (
    threshold = 20,
    startDate = formatLocalDate(addDays(new Date(), -90))
  ) => all(`
    WITH section_avgs AS (
      SELECT s.id as section_id, s.name as section_name,
             ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as avg_rate
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      WHERE a.date >= ?
      GROUP BY s.id
    ),
    latest_rates AS (
      SELECT s.id as section_id, s.name as section_name,
             ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as latest_rate
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      WHERE a.date = (SELECT MAX(date) FROM attendance)
      GROUP BY s.id
    )
    SELECT sa.section_name, sa.avg_rate as historical_avg, lr.latest_rate,
           ROUND(sa.avg_rate - lr.latest_rate, 1) as drop_amount
    FROM section_avgs sa
    JOIN latest_rates lr ON sa.section_id = lr.section_id
    WHERE sa.avg_rate - lr.latest_rate > ?
    ORDER BY drop_amount DESC
  `, [startDate, threshold]),
  getMemberStreaks: (limit = 50) => all(`
    WITH member_attendance AS (
      SELECT m.id as member_id, m.full_name, m.membership_id,
             s.name as section_name,
             a.date, a.status,
             ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY a.date DESC) as rn
      FROM members m
      JOIN attendance a ON m.id = a.member_id
      JOIN sections sec ON m.section_id = sec.id
      JOIN sections s ON m.section_id = s.id
    ),
    streak_break AS (
      SELECT member_id, full_name, membership_id, section_name,
             MIN(CASE WHEN status != 'present' THEN rn END) as first_break
      FROM member_attendance
      GROUP BY member_id, full_name, membership_id, section_name
    ),
    streaks AS (
      SELECT sb.member_id, sb.full_name, sb.membership_id, sb.section_name,
             CASE
               WHEN sb.first_break IS NULL THEN (SELECT COUNT(*) FROM member_attendance ma2 WHERE ma2.member_id = sb.member_id)
               ELSE sb.first_break - 1
             END as current_streak
      FROM streak_break sb
      -- Only include members whose most recent attendance is 'present'
      WHERE EXISTS (
        SELECT 1 FROM member_attendance ma3
        WHERE ma3.member_id = sb.member_id AND ma3.rn = 1 AND ma3.status = 'present'
      )
    )
    SELECT member_id, full_name, membership_id, section_name, current_streak
    FROM streaks
    WHERE current_streak >= 3
    ORDER BY current_streak DESC
    LIMIT ?
  `, [limit]),
  getLeaderPerformanceTrends: (startDate, endDate) => all(`
    SELECT l.id as leader_id, s.name as section_name, u.full_name as leader_name,
           COUNT(DISTINCT sl.date) as submissions,
           ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as avg_rate,
           COUNT(DISTINCT sl.date) as total_dates
    FROM submission_log sl
    JOIN leaders l ON sl.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    LEFT JOIN attendance a ON sl.date = a.date AND a.submitted_by = u.id
    WHERE sl.date BETWEEN ? AND ?
    GROUP BY l.id, s.name, u.full_name
    ORDER BY avg_rate DESC
    LIMIT 500
  `, [startDate, endDate]),
  getUpcomingBirthdays: (days = 30, referenceMonthDay = formatMonthDay()) => {
    const monthDay = typeof days === 'string' ? days : referenceMonthDay;

    return all(`
      SELECT m.id, m.full_name, m.membership_id, m.phone, m.date_of_birth,
             m.show_age_to_leaders, m.hide_from_birthday_list,
             m.section_id, s.name as section_name,
             u.full_name as leader_name
      FROM members m
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE m.date_of_birth IS NOT NULL
      AND m.is_active = 1
      AND m.hide_from_birthday_list = 0
      ORDER BY
        CASE WHEN ${sqlMonthDay('m.date_of_birth')} >= ? THEN 0 ELSE 1 END,
        ${sqlMonthDay('m.date_of_birth')}
      LIMIT 100
    `, [monthDay]);
  },

  // --- Advanced Analytics: New Queries ---

  getMemberEngagementScores: (limit = 20, endDate = formatLocalDate()) => {
    const consistencyStart = formatLocalDate(addDays(endDate, -90));
    const recentStart = formatLocalDate(addDays(endDate, -30));
    const priorStart = formatLocalDate(addDays(endDate, -60));

    return all(`
    WITH member_consistency AS (
      SELECT m.id as member_id, m.full_name, m.membership_id,
             s.name as section_name,
             COUNT(*) as total_records,
             SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
             ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as consistency
      FROM members m
      JOIN attendance a ON m.id = a.member_id
      JOIN sections s ON m.section_id = s.id
      WHERE a.date >= ?
      GROUP BY m.id, m.full_name, m.membership_id, s.name
    ),
    member_streaks AS (
      SELECT m.id as member_id,
             MIN(CASE WHEN a.status != 'present' THEN rn END) as first_break
      FROM (
        SELECT m2.id, a2.status,
               ROW_NUMBER() OVER (PARTITION BY m2.id ORDER BY a2.date DESC) as rn
        FROM members m2
        JOIN attendance a2 ON m2.id = a2.member_id
      ) sub
      JOIN members m ON sub.id = m.id
      JOIN attendance a ON m.id = a.member_id
      WHERE sub.id = m.id
      GROUP BY m.id
    ),
    member_trend AS (
      SELECT m.id as member_id,
             ROUND(CAST(AVG(CASE WHEN a.date >= ? AND a.status = 'present' THEN 1.0
                            WHEN a.date >= ? THEN 0.0 END) * 100 AS NUMERIC), 1) as recent_rate,
             ROUND(CAST(AVG(CASE WHEN a.date >= ? AND a.date < ? AND a.status = 'present' THEN 1.0
                            WHEN a.date >= ? AND a.date < ? THEN 0.0 END) * 100 AS NUMERIC), 1) as prior_rate
      FROM members m
      JOIN attendance a ON m.id = a.member_id
      WHERE a.date >= ?
      GROUP BY m.id
    )
    SELECT mc.member_id, mc.full_name, mc.membership_id, mc.section_name,
           mc.consistency,
           COALESCE(ms.first_break - 1, mc.total_records) as streak,
           COALESCE(mt.recent_rate, 0) as recent_rate,
           COALESCE(mt.prior_rate, 0) as prior_rate,
            ROUND(
              (mc.consistency * 0.4) +
              ((CASE WHEN COALESCE(ms.first_break - 1, mc.total_records) < 12 THEN COALESCE(ms.first_break - 1, mc.total_records) ELSE 12 END) / 12.0 * 100 * 0.3) +
              (COALESCE(mt.recent_rate, 0) * 0.3),
              1
            ) as engagement_score
    FROM member_consistency mc
    LEFT JOIN member_streaks ms ON mc.member_id = ms.member_id
    LEFT JOIN member_trend mt ON mc.member_id = mt.member_id
    ORDER BY engagement_score DESC
    LIMIT ?
  `, [consistencyStart, recentStart, recentStart, priorStart, recentStart, priorStart, recentStart, priorStart, limit]);
  },

  getDemographicBreakdown: (startDate = formatLocalDate(addDays(new Date(), -90))) => all(`
    SELECT
      'gender' as category_type,
      COALESCE(m.gender, 'Unknown') as category_value,
      COUNT(DISTINCT m.id) as member_count,
      COUNT(a.id) as total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate
    FROM members m
    LEFT JOIN attendance a ON m.id = a.member_id AND a.date >= ?
    GROUP BY m.gender

    UNION ALL

    SELECT
      'age_group' as category_type,
      COALESCE(m.age_group, 'Unknown') as category_value,
      COUNT(DISTINCT m.id) as member_count,
      COUNT(a.id) as total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate
    FROM members m
    LEFT JOIN attendance a ON m.id = a.member_id AND a.date >= ?
    GROUP BY m.age_group
    ORDER BY category_type, attendance_rate DESC
  `, [startDate, startDate]),

  getYearOverYear: (currentYear = new Date().getFullYear()) => all(`
    WITH current_year AS (
      SELECT ${monthNumber('a.date')} as month,
             ${yearNumber('a.date')} as year,
             ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
             COUNT(DISTINCT a.date) as service_count
      FROM attendance a
      WHERE ${yearNumber('a.date')} = ?
      GROUP BY ${monthNumber('a.date')}
    ),
    previous_year AS (
      SELECT ${monthNumber('a.date')} as month,
             ${yearNumber('a.date')} as year,
             ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
             COUNT(DISTINCT a.date) as service_count
      FROM attendance a
      WHERE ${yearNumber('a.date')} = ?
      GROUP BY ${monthNumber('a.date')}
    )
    SELECT
      COALESCE(cy.month, py.month) as month,
      cy.attendance_rate as current_year_rate,
      py.attendance_rate as previous_year_rate,
      cy.service_count as current_services,
      py.service_count as previous_services,
      ROUND(COALESCE(cy.attendance_rate, 0) - COALESCE(py.attendance_rate, 0), 1) as difference
    FROM current_year cy
    LEFT JOIN previous_year py ON cy.month = py.month

    UNION

    SELECT
      py.month,
      NULL as current_year_rate,
      py.attendance_rate as previous_year_rate,
      NULL as current_services,
      py.service_count as previous_services,
      0 - py.attendance_rate as difference
    FROM previous_year py
    WHERE py.month NOT IN (SELECT month FROM current_year)
    ORDER BY month
  `, [String(currentYear), String(currentYear - 1)]),

  getNewMemberRetention: (days = 90, today = formatLocalDate()) => {
    const recentAttendanceStart = formatLocalDate(addDays(today, -30));
    const newMemberStart = formatLocalDate(addDays(today, -days));

    return all(`
    SELECT
      COUNT(*) as total_new_members,
      SUM(CASE WHEN recent_attendance > 0 THEN 1 ELSE 0 END) as still_attending,
      ROUND(
        CAST(SUM(CASE WHEN recent_attendance > 0 THEN 1 ELSE 0 END) AS FLOAT) /
        NULLIF(COUNT(*), 0) * 100, 1
      ) as retention_rate,
      ROUND(CAST(AVG(total_attendance) AS NUMERIC), 1) as avg_services_attended
    FROM (
      SELECT m.id,
             (SELECT COUNT(*) FROM attendance a
              WHERE a.member_id = m.id
              AND a.status = 'present'
              AND a.date >= ?) as recent_attendance,
             (SELECT COUNT(*) FROM attendance a2
              WHERE a2.member_id = m.id
              AND a2.status = 'present') as total_attendance
      FROM members m
      WHERE m.created_at >= ?
    ) sub
  `, [recentAttendanceStart, newMemberStart]);
  },

  // ── Section Comparison Analytics ─────────────────────────────────────────
  getSectionComparison: (days = 90, startDate, endDate) => {
    const useRange = startDate && endDate;
    if (useRange) {
      return all(`
        SELECT
          s.id,
          s.name,
          COUNT(DISTINCT m.id) as member_count,
          COUNT(DISTINCT a.date) as submission_days,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
          SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as total_excused,
          ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
          (SELECT COUNT(*) FROM members WHERE section_id = s.id AND created_at >= ?) as new_members,
          (SELECT COUNT(*) FROM members WHERE section_id = s.id AND is_active = 1) as active_members,
          (SELECT MAX(date) FROM attendance a2
            JOIN members m2 ON a2.member_id = m2.id
            WHERE m2.section_id = s.id AND a2.date >= ? AND a2.date <= ?) as last_submission_date
        FROM sections s
        LEFT JOIN members m ON m.section_id = s.id AND m.is_active = 1
        LEFT JOIN attendance a ON a.member_id = m.id AND a.date >= ? AND a.date <= ?
        GROUP BY s.id, s.name
        ORDER BY attendance_rate DESC
      `, [startDate, startDate, endDate, startDate, endDate]);
    }
    return all(`
      SELECT
        s.id,
        s.name,
        COUNT(DISTINCT m.id) as member_count,
        COUNT(DISTINCT a.date) as submission_days,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as total_excused,
        ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
        (SELECT COUNT(*) FROM members WHERE section_id = s.id AND created_at >= ${daysAgo()}) as new_members,
        (SELECT COUNT(*) FROM members WHERE section_id = s.id AND is_active = 1) as active_members,
        (SELECT MAX(date) FROM attendance a2
          JOIN members m2 ON a2.member_id = m2.id
          WHERE m2.section_id = s.id AND a2.date >= ${daysAgo()}) as last_submission_date
      FROM sections s
      LEFT JOIN members m ON m.section_id = s.id AND m.is_active = 1
      LEFT JOIN attendance a ON a.member_id = m.id
        AND a.date >= ${daysAgo()}
      GROUP BY s.id, s.name
      ORDER BY attendance_rate DESC
    `, [days, days, days]);
  },

  getServiceComparison: (days = 90, startDate, endDate) => {
    const useRange = startDate && endDate;
    if (useRange) {
      return all(`
        SELECT
          st.id,
          st.name as name,
          COUNT(DISTINCT a.member_id) as member_count,
          COUNT(DISTINCT a.date) as submission_days,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
          SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as total_excused,
          ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
          (SELECT MAX(date) FROM attendance a2 WHERE a2.service_type_id = st.id AND a2.date >= ? AND a2.date <= ?) as last_submission_date
        FROM service_types st
        LEFT JOIN attendance a ON a.service_type_id = st.id AND a.date >= ? AND a.date <= ?
        WHERE st.is_active = 1
        GROUP BY st.id, st.name
        ORDER BY attendance_rate DESC
      `, [startDate, endDate, startDate, endDate]);
    }
    return all(`
      SELECT
        st.id,
        st.name as name,
        COUNT(DISTINCT a.member_id) as member_count,
        COUNT(DISTINCT a.date) as submission_days,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as total_excused,
        ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
        (SELECT MAX(date) FROM attendance a2 WHERE a2.service_type_id = st.id AND a2.date >= ${daysAgo()}) as last_submission_date
      FROM service_types st
      LEFT JOIN attendance a ON a.service_type_id = st.id AND a.date >= ${daysAgo()}
      WHERE st.is_active = 1
      GROUP BY st.id, st.name
      ORDER BY attendance_rate DESC
    `, [days, days]);
  },

  // ── Service Type Attendance Breakdown ─────────────────────────────────────
  getServiceTypeBreakdown: (days = 90) => all(`
    SELECT
      st.id,
      st.name as service_type_name,
      COUNT(DISTINCT a.date) as total_services,
      COUNT(*) as total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
      SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as total_excused,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate
    FROM service_types st
    LEFT JOIN attendance a ON a.service_type_id = st.id
      AND a.date >= ${daysAgo()}
    GROUP BY st.id, st.name
    HAVING total_records > 0
    ORDER BY attendance_rate DESC
  `, [days]),

  // ── Attendance by Day-of-Week Pattern ────────────────────────────────────
  getAttendanceDayPatterns: (days = 180) => all(`
    SELECT
      CASE ${dayOfWeek('a.date')}
        WHEN '0' THEN 'Sunday (Main Service)'
        WHEN '1' THEN 'Monday'
        WHEN '2' THEN 'Tuesday (Leaders Gathering)'
        WHEN '3' THEN 'Wednesday (Youth Service)'
        WHEN '4' THEN 'Thursday (Women''s Service)'
        WHEN '5' THEN 'Friday (Prayer Service)'
        WHEN '6' THEN 'Saturday'
      END as day_name,
      ${dayOfWeek('a.date')} as day_num,
      COUNT(DISTINCT a.date) as service_count,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as avg_rate,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * COUNT(DISTINCT m.id) AS NUMERIC), 0) as avg_present
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    WHERE a.date >= ${daysAgo()}
    GROUP BY day_num, day_name
    ORDER BY day_num
  `, [days]),

  // ── Monthly Attendance + Contributions Combined Trend ────────────────────
  getMonthlyAttendanceContribTrends: (months = 12) => all(`
    SELECT
      ${yearMonth('a.date')} as month,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
      COUNT(*) as total_members
    FROM attendance a
    WHERE a.date >= ${monthsAgoDate()}
    GROUP BY month
    ORDER BY month
  `, [months]),

  getMonthlyContributionTrends: (months = 12) => all(`
    SELECT
      ${yearMonth('payment_date')} as month,
      ct.name as type_name,
      SUM(c.amount) as total_amount,
      COUNT(*) as transaction_count
    FROM contributions c
    JOIN contribution_types ct ON ct.id = c.contribution_type_id
    WHERE c.payment_date >= ${monthsAgoDate()}
    GROUP BY month, ct.name
    ORDER BY month
  `, [months]),

  // ── Monthly Attendance by Section (for trend comparison) ──────────────────
  getMonthlySectionTrends: (months = 6) => all(`
    SELECT
      ${yearMonth('a.date')} as month,
      s.name as section_name,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
      COUNT(DISTINCT a.date) as service_days,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN sections s ON s.id = m.section_id
    WHERE a.date >= ${monthsAgoDate()}
    GROUP BY month, s.name
    ORDER BY month
  `, [months]),

  // ── Evangelism Funnel ────────────────────────────────────────────────────
  getEvangelismFunnel: () => get(`
    SELECT
      (SELECT COUNT(*) FROM outreach_logs) as total_outreach,
      (SELECT COUNT(*) FROM souls_won) as souls_won,
      (SELECT COUNT(*) FROM souls_won WHERE follow_up_status IN ('joined_cell','joined_church','active_member')) as members_joined,
      (SELECT COUNT(*) FROM souls_won WHERE follow_up_status = 'baptized') as baptized,
      (SELECT COUNT(*) FROM new_members) as new_members,
      (SELECT COUNT(*) FROM new_members WHERE status = 'graduated') as graduated
  `),

  // ── New Member Funnel ────────────────────────────────────────────────────
  getNewMemberFunnel: () => all(`
    SELECT
      status,
      COUNT(*) as count
    FROM new_members
    GROUP BY status
    ORDER BY CASE status
      WHEN 'probation' THEN 1
      WHEN 'graduated' THEN 2
      WHEN 'permanent' THEN 3
      ELSE 4
    END
  `),

  // ── Executive Dashboard ────────────────────────────────────────────────
  getExecutiveDashboard: () => get(`
    SELECT
      (SELECT COUNT(*) FROM members WHERE is_active = 1 AND soft_deleted_at IS NULL) as total_members,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date = ${todayDate()} AND status = 'present') as present_today,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date = ${todayDate()} AND status = 'absent') as absent_today,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date = ${todayDate()}) as total_today,
      (SELECT COUNT(*) FROM members WHERE visitor_date IS NOT NULL AND visitor_date >= ${daysAgo(7)}) as visitors_this_week,
      (SELECT COUNT(*) FROM members WHERE visitor_date IS NOT NULL AND visitor_date >= ${daysAgo(30)}) as visitors_this_month,
      (SELECT COUNT(*) FROM attendance WHERE status = 'excused' AND date = ${todayDate()}) as excused_today
  `),

  getGrowthPercentages: () => get(`
    SELECT
      (SELECT ROUND(
        (CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(7)} THEN a.member_id END) AS NUMERIC) -
         CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(14)} AND a.date < ${daysAgo(7)} THEN a.member_id END) AS NUMERIC))
        / MAX(1, CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(14)} AND a.date < ${daysAgo(7)} THEN a.member_id END) AS NUMERIC)) * 100, 1)
      FROM attendance a) as weekly_growth,
      (SELECT ROUND(
        (CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(30)} THEN a.member_id END) AS NUMERIC) -
         CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(60)} AND a.date < ${daysAgo(30)} THEN a.member_id END) AS NUMERIC))
        / MAX(1, CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(60)} AND a.date < ${daysAgo(30)} THEN a.member_id END) AS NUMERIC)) * 100, 1)
      FROM attendance a) as monthly_growth,
      (SELECT ROUND(
        (CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(365)} THEN a.member_id END) AS NUMERIC) -
         CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(730)} AND a.date < ${daysAgo(365)} THEN a.member_id END) AS NUMERIC))
        / MAX(1, CAST(COUNT(DISTINCT CASE WHEN a.date >= ${daysAgo(730)} AND a.date < ${daysAgo(365)} THEN a.member_id END) AS NUMERIC)) * 100, 1)
      FROM attendance a) as annual_growth
  `),

  // ── Comparison Analytics ──────────────────────────────────────────────
  getComparisonAnalytics: (period1Start, period1End, period2Start, period2End) => get(`
    SELECT
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'present') as p1_present,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'present') as p2_present,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'absent') as p1_absent,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'absent') as p2_absent,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'excused') as p1_excused,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'excused') as p2_excused,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ?) as p1_total,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ?) as p2_total,
      (SELECT COUNT(*) FROM attendance WHERE date BETWEEN ? AND ?) as p1_records,
      (SELECT COUNT(*) FROM attendance WHERE date BETWEEN ? AND ?) as p2_records,
      (SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?) as p1_service_days,
      (SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?) as p2_service_days,
      (SELECT COUNT(DISTINCT leader_id) FROM submission_log WHERE date BETWEEN ? AND ?) as p1_leaders_submitted,
      (SELECT COUNT(DISTINCT leader_id) FROM submission_log WHERE date BETWEEN ? AND ?) as p2_leaders_submitted,
      (SELECT COUNT(*) FROM leaders WHERE is_active = 1) as total_leaders,
      (SELECT ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) FROM attendance WHERE date BETWEEN ? AND ?) as p1_rate,
      (SELECT ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) FROM attendance WHERE date BETWEEN ? AND ?) as p2_rate,
      (SELECT COUNT(DISTINCT m.section_id) FROM attendance a
        JOIN members m ON a.member_id = m.id
        WHERE a.date BETWEEN ? AND ?
      ) as p1_active_sections,
      (SELECT COUNT(DISTINCT m.section_id) FROM attendance a
        JOIN members m ON a.member_id = m.id
        WHERE a.date BETWEEN ? AND ?
      ) as p2_active_sections
  `, [period1Start, period1End, period2Start, period2End,
      period1Start, period1End, period2Start, period2End,
      period1Start, period1End, period2Start, period2End,
      period1Start, period1End, period2Start, period2End,
      period1Start, period1End, period2Start, period2End,
      period1Start, period1End, period2Start, period2End,
      period1Start, period1End, period2Start, period2End,
      period1Start, period1End, period2Start, period2End,
      period1Start, period1End, period2Start, period2End]),

  // ── Historical Stats ──────────────────────────────────────────────────
  getHistoricalStats: (startDate, endDate) => get(`
    SELECT
      COUNT(DISTINCT date) as service_days,
      COUNT(*) as total_records,
      ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as avg_rate,
      MAX(daily_present) as highest_attendance,
      MIN(daily_present) as lowest_attendance
    FROM (
      SELECT date,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as daily_present,
        AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) as daily_rate
      FROM attendance
      WHERE date BETWEEN ? AND ?
      GROUP BY date
    )
  `, [startDate, endDate]),

  getHistoricalDaily: (startDate, endDate) => all(`
    SELECT
      date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused,
      ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as rate
    FROM attendance
    WHERE date BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date
  `, [startDate, endDate]),

  // ── Enhanced Section Rankings ──────────────────────────────────────────
  getSectionRankings: (days = 90, startDate, endDate, prevStartDate, prevEndDate) => {
    const now = formatLocalDate(new Date());
    const start = startDate || formatLocalDate(addDays(new Date(), -days));
    const end = endDate || now;
    const prevStart = prevStartDate || formatLocalDate(addDays(new Date(), -(days * 2)));
    const prevEnd = prevEndDate || formatLocalDate(addDays(new Date(), -days));
    const wkAgo = formatLocalDate(addDays(new Date(), -7));
    const moAgo = formatLocalDate(addDays(new Date(), -30));
    const yrAgo = formatLocalDate(addDays(new Date(), -365));

    return all(`
      SELECT
        s.id,
        s.name,
        (SELECT COUNT(*) FROM members mx WHERE mx.section_id = s.id) as registered_members,
        (SELECT COUNT(*) FROM members mx WHERE mx.section_id = s.id AND mx.is_active = 1) as member_count,
        (SELECT COUNT(*) FROM members mx WHERE mx.section_id = s.id AND mx.is_active = 0) as inactive_members,
        (SELECT COUNT(*) FROM members mx WHERE mx.section_id = s.id AND mx.visitor_date IS NOT NULL) as visitors,
        (SELECT COUNT(*) FROM members mx WHERE mx.section_id = s.id AND mx.created_at >= ?) as new_members,
        ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as total_excused,
        (SELECT MAX(dr) FROM (
          SELECT AVG(CASE WHEN a2.status = 'present' THEN 1.0 ELSE 0.0 END) as dr
          FROM attendance a2
          JOIN members m2 ON a2.member_id = m2.id
          WHERE m2.section_id = s.id AND a2.date >= ? AND a2.date <= ?
          GROUP BY a2.date
        ) sub1) as best_day_rate,
        (SELECT MIN(dr) FROM (
          SELECT AVG(CASE WHEN a2.status = 'present' THEN 1.0 ELSE 0.0 END) as dr
          FROM attendance a2
          JOIN members m2 ON a2.member_id = m2.id
          WHERE m2.section_id = s.id AND a2.date >= ? AND a2.date <= ?
          GROUP BY a2.date
        ) sub2) as worst_day_rate,
        (
          SELECT ROUND(CAST(AVG(CASE WHEN a2.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1)
          FROM attendance a2
          JOIN members m2 ON a2.member_id = m2.id
          WHERE m2.section_id = s.id AND m2.is_active = 1
            AND a2.date >= ? AND a2.date <= ?
        ) as prev_rate,
        (
          SELECT ROUND(
            CAST(COUNT(DISTINCT CASE WHEN ap.status = 'present' THEN ap.member_id END) AS NUMERIC) /
            NULLIF(COUNT(DISTINCT mx2.id), 0) * 100, 1
          )
          FROM members mx2
          LEFT JOIN attendance ap ON ap.member_id = mx2.id AND ap.date >= ? AND ap.date <= ?
          WHERE mx2.section_id = s.id AND mx2.is_active = 1
        ) as retention_rate,
        (SELECT COUNT(*) FROM members mx WHERE mx.section_id = s.id AND mx.created_at >= ?) as weekly_growth,
        (SELECT COUNT(*) FROM members mx WHERE mx.section_id = s.id AND mx.created_at >= ?) as monthly_growth,
        (SELECT COUNT(*) FROM members mx WHERE mx.section_id = s.id AND mx.created_at >= ?) as yearly_growth,
        (
          SELECT ROUND(
            CAST(COUNT(DISTINCT f.member_id) AS NUMERIC) /
            NULLIF(COUNT(DISTINCT a4.member_id), 0) * 100, 1
          )
          FROM attendance a4
          JOIN members m4 ON a4.member_id = m4.id
          LEFT JOIN absent_followups f ON f.member_id = m4.id AND f.contacted = 1
            AND f.absence_date = a4.date
          WHERE m4.section_id = s.id AND a4.status = 'absent'
            AND a4.date >= ? AND a4.date <= ?
        ) as follow_up_rate
      FROM sections s
      LEFT JOIN members m ON m.section_id = s.id AND m.is_active = 1
      LEFT JOIN attendance a ON a.member_id = m.id AND a.date >= ? AND a.date <= ?
      GROUP BY s.id, s.name
      ORDER BY attendance_rate DESC
    `, [
      start,                // new_members cutoff
      start, end,           // best_day_rate
      start, end,           // worst_day_rate
      prevStart, prevEnd,   // prev_rate
      start, end,           // retention_rate
      wkAgo,                // weekly_growth
      moAgo,                // monthly_growth
      yrAgo,                // yearly_growth
      start, end,           // follow_up_rate
      start, end            // main attendance join
    ]);
  },

  // ── Head Leader Analytics ──────────────────────────────────────────────
  getHeadLeaderAnalytics: (days = 90, startDate, endDate) => {
    const now = formatLocalDate(new Date());
    const start = startDate || formatLocalDate(addDays(new Date(), -days));
    const end = endDate || now;
    return all(`
      SELECT
        l.id as leader_id,
        u.full_name as leader_name,
        s.name as section_name,
        s.id as section_id,
        (SELECT COUNT(*) FROM leaders WHERE section_id = l.section_id AND is_head = 0 AND is_active = 1) as leaders_supervised,
        (SELECT COUNT(*) FROM members WHERE section_id = l.section_id AND is_active = 1) as members_managed,
        ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as overall_attendance,
        (SELECT COUNT(DISTINCT sub.date) FROM submission_log sub WHERE sub.section_id = l.section_id AND sub.date >= ? AND sub.date <= ?) as submissions_made,
        (SELECT COUNT(DISTINCT date) FROM attendance WHERE date >= ? AND date <= ?) as total_services
      FROM leaders l
      JOIN users u ON l.user_id = u.id
      JOIN sections s ON l.section_id = s.id
      LEFT JOIN members m ON m.section_id = l.section_id AND m.is_active = 1
      LEFT JOIN attendance a ON a.member_id = m.id AND a.date >= ? AND a.date <= ?
      WHERE l.is_head = 1 AND l.is_active = 1
      GROUP BY l.id, u.full_name, s.name, s.id
      ORDER BY overall_attendance DESC
    `, [start, end, start, end, start, end]);
  },

  getAbsentStreaks: (limit = 100) => {
    return all(`
      WITH member_attendance AS (
        SELECT m.id as member_id, m.full_name, m.membership_id,
               s.name as section_name, s.id as section_id,
               a.date, a.status,
               ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY a.date DESC) as rn
        FROM members m
        JOIN attendance a ON m.id = a.member_id
        JOIN sections s ON m.section_id = s.id
        WHERE m.is_active = 1
      ),
      streak_break AS (
        SELECT member_id, full_name, membership_id, section_name, section_id,
               MIN(CASE WHEN status != 'absent' THEN rn END) as first_break
        FROM member_attendance
        GROUP BY member_id, full_name, membership_id, section_name, section_id
      ),
      streaks AS (
        SELECT sb.member_id, sb.full_name, sb.membership_id, sb.section_name, sb.section_id,
               CASE
                 WHEN sb.first_break IS NULL THEN (SELECT COUNT(*) FROM member_attendance ma2 WHERE ma2.member_id = sb.member_id)
                 ELSE sb.first_break - 1
               END as current_streak,
               (SELECT MAX(date) FROM member_attendance ma4 WHERE ma4.member_id = sb.member_id AND ma4.status = 'absent') as last_absent_date
        FROM streak_break sb
        WHERE EXISTS (
          SELECT 1 FROM member_attendance ma3
          WHERE ma3.member_id = sb.member_id AND ma3.rn = 1 AND ma3.status = 'absent'
        )
      )
      SELECT member_id, full_name, membership_id, section_name, section_id, current_streak, last_absent_date
      FROM streaks
      WHERE current_streak >= 1
      ORDER BY current_streak DESC, last_absent_date DESC
      LIMIT ?
    `, [limit]);
  },

  // ── Enhanced Leader Rankings ───────────────────────────────────────────
  getLeaderRankings: (days = 90, startDate, endDate, prevStartDate, prevEndDate) => {
    const now = formatLocalDate(new Date());
    const start = startDate || formatLocalDate(addDays(new Date(), -days));
    const end = endDate || now;
    const prevStart = prevStartDate || formatLocalDate(addDays(new Date(), -(days * 2)));
    const prevEnd = prevEndDate || formatLocalDate(addDays(new Date(), -days));
    const wkAgo = formatLocalDate(addDays(new Date(), -7));
    const moAgo = formatLocalDate(addDays(new Date(), -30));
    const yrAgo = formatLocalDate(addDays(new Date(), -365));

    return all(`
      SELECT
        l.id as leader_id,
        u.full_name as leader_name,
        s.id as section_id,
        s.name as section_name,
        COUNT(DISTINCT m.id) as assigned_members,
        COUNT(DISTINCT CASE WHEN m.is_active = 1 THEN m.id END) as active_members,
        COUNT(DISTINCT CASE WHEN m.is_active = 0 THEN m.id END) as inactive_members,
        COUNT(DISTINCT CASE WHEN m.created_at >= ? AND m.created_at <= ? THEN m.id END) as new_members,
        COUNT(DISTINCT CASE WHEN m.visitor_date IS NOT NULL THEN m.id END) as visitor_conversions,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as total_excused,
        ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
        (
          SELECT ROUND(CAST(AVG(CASE WHEN ap.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1)
          FROM attendance ap
          JOIN members mp ON ap.member_id = mp.id
          WHERE mp.leader_id = l.id AND mp.is_active = 1 AND ap.date >= ? AND ap.date <= ?
        ) as prev_rate,
        (
          SELECT COUNT(DISTINCT a2.member_id)
          FROM attendance a2
          JOIN members m2 ON a2.member_id = m2.id
          WHERE m2.leader_id = l.id AND m2.is_active = 1 AND a2.status = 'present' AND a2.date >= ? AND a2.date <= ?
        ) as unique_attendees,
        (
          SELECT ROUND(CAST(COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN ar.member_id END) AS NUMERIC) /
            NULLIF(COUNT(DISTINCT mr.id), 0) * 100, 1)
          FROM members mr
          LEFT JOIN attendance ar ON ar.member_id = mr.id AND ar.date >= ? AND ar.date <= ?
          WHERE mr.leader_id = l.id AND mr.is_active = 1
        ) as retention_rate,
        (
          SELECT COUNT(DISTINCT sub.date)
          FROM submission_log sub
          WHERE sub.leader_id = l.id AND sub.date >= ? AND sub.date <= ?
        ) as submissions_count,
        (
          SELECT ROUND(
            CAST((SELECT COUNT(DISTINCT sub.date) FROM submission_log sub WHERE sub.leader_id = l.id AND sub.date >= ? AND sub.date <= ?) AS NUMERIC) /
            NULLIF((SELECT COUNT(DISTINCT ad.date) FROM attendance ad WHERE ad.date >= ? AND ad.date <= ?), 0) * 100,
            1
          )
        ) as leader_submission_rate,
        (
          SELECT COUNT(*)
          FROM absent_followups af
          WHERE af.leader_id = l.id AND af.absence_date >= ? AND af.absence_date <= ?
        ) as follow_up_required,
        (
          SELECT COUNT(*)
          FROM absent_followups af
          WHERE af.leader_id = l.id AND af.contacted = 1 AND af.absence_date >= ? AND af.absence_date <= ?
        ) as follow_up_completed,
        (
          SELECT ROUND(CAST(COUNT(CASE WHEN af.contacted = 1 THEN 1 END) AS NUMERIC) /
            NULLIF(COUNT(*), 0) * 100, 1)
          FROM absent_followups af
          WHERE af.leader_id = l.id AND af.absence_date >= ? AND af.absence_date <= ?
        ) as follow_up_completion,
        (
          SELECT COUNT(*)
          FROM absent_followups af
          WHERE af.leader_id = l.id AND af.contacted = 1 AND LOWER(COALESCE(af.contact_method, '')) LIKE '%visit%'
            AND af.absence_date >= ? AND af.absence_date <= ?
        ) as visits_completed,
        (
          SELECT COUNT(*)
          FROM absent_followups af
          WHERE af.leader_id = l.id AND LOWER(COALESCE(af.notes, '')) LIKE '%counsel%'
            AND af.absence_date >= ? AND af.absence_date <= ?
        ) as counseling_cases,
        (SELECT COUNT(*) FROM members mw WHERE mw.leader_id = l.id AND mw.created_at >= ?) as weekly_growth,
        (SELECT COUNT(*) FROM members mm WHERE mm.leader_id = l.id AND mm.created_at >= ?) as monthly_growth,
        (SELECT COUNT(*) FROM members my WHERE my.leader_id = l.id AND my.created_at >= ?) as yearly_growth
      FROM leaders l
      JOIN users u ON l.user_id = u.id
      JOIN sections s ON l.section_id = s.id
      LEFT JOIN members m ON m.leader_id = l.id
      LEFT JOIN attendance a ON a.member_id = m.id AND a.date >= ? AND a.date <= ?
      WHERE l.is_active = 1 AND COALESCE(l.is_head, 0) = 0
      GROUP BY l.id, u.full_name, s.id, s.name
      ORDER BY attendance_rate DESC
    `, [
      start, end,
      prevStart, prevEnd,
      start, end,
      start, end,
      start, end,
      start, end, start, end,
      start, end,
      start, end,
      start, end,
      start, end,
      start, end,
      wkAgo, moAgo, yrAgo,
      start, end
    ]);
  },

  // ── Department Analytics ───────────────────────────────────────────────
  getDepartmentAnalytics: (days = 90, startDate, endDate) => {
    const useRange = startDate && endDate;
    if (useRange) {
      return all(`
        SELECT
          d.id,
          d.name,
          COUNT(DISTINCT dm.member_id) as member_count,
          ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent
        FROM departments d
        LEFT JOIN department_members dm ON dm.department_id = d.id
        LEFT JOIN members m ON m.id = dm.member_id AND m.is_active = 1
        LEFT JOIN attendance a ON a.member_id = m.id AND a.date >= ? AND a.date <= ?
        WHERE d.is_active = 1
        GROUP BY d.id, d.name
        HAVING member_count > 0
        ORDER BY attendance_rate DESC
      `, [startDate, endDate]);
    }
    return all(`
      SELECT
        d.id,
        d.name,
        COUNT(DISTINCT dm.member_id) as member_count,
        ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent
      FROM departments d
      LEFT JOIN department_members dm ON dm.department_id = d.id
      LEFT JOIN members m ON m.id = dm.member_id AND m.is_active = 1
      LEFT JOIN attendance a ON a.member_id = m.id AND a.date >= ${daysAgo()}
      WHERE d.is_active = 1
      GROUP BY d.id, d.name
      HAVING member_count > 0
      ORDER BY attendance_rate DESC
    `, [days]);
  },

  // ── Member Attendance Intelligence ─────────────────────────────────────
  getMemberIntelligence: (days = 90, startDate, endDate, serviceId = 'all') => {
    const end = endDate || formatLocalDate(new Date());
    const start = startDate || formatLocalDate(addDays(end, -days));
    const rangeDays = Math.max(1, Math.floor((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000) + 1);
    const previousEnd = formatLocalDate(addDays(start, -1));
    const previousStart = formatLocalDate(addDays(start, -rangeDays));
    const serviceFilter = serviceId && serviceId !== 'all' ? ' AND service_type_id = ?' : '';
    const addRangeParams = (params, from, to) => {
      params.push(from, to);
      if (serviceFilter) params.push(serviceId);
    };
    const params = [];
    addRangeParams(params, start, end);
    addRangeParams(params, previousStart, previousEnd);
    addRangeParams(params, start, end);
    addRangeParams(params, start, end);

    return all(`
    SELECT
      m.id,
      m.full_name,
      m.membership_id,
      m.gender,
      m.age_group,
      m.created_at as registered_date,
      m.visitor_date,
      m.status as member_status,
      m.is_active,
      m.flags,
      m.prayer_requests,
      m.last_contacted_at,
      s.id as section_id,
      s.name as section_name,
      head_u.full_name as head_leader_name,
      lu.full_name as leader_name,
      COALESCE(cur.present_count, 0) as present_count,
      COALESCE(cur.absent_count, 0) as absent_count,
      COALESCE(cur.excused_count, 0) as excused_count,
      COALESCE(cur.total_records, 0) as total_records,
      COALESCE(cur.attendance_rate, 0) as attendance_rate,
      COALESCE(prev.attendance_rate, 0) as previous_attendance_rate,
      COALESCE(wk.weekly_present, 0) as weekly_present,
      COALESCE(wk.prev_weekly_present, 0) as previous_weekly_present,
      COALESCE(mo.monthly_present, 0) as monthly_present,
      COALESCE(mo.prev_monthly_present, 0) as previous_monthly_present,
      COALESCE(ret.retention_score, 0) as retention_score,
      COALESCE(eng.engagement_score, 0) as engagement_score,
      COALESCE(st.current_attendance_streak, 0) as current_attendance_streak,
      COALESCE(st.consecutive_absences, 0) as consecutive_absences,
      COALESCE(st.longest_attendance_streak, 0) as longest_attendance_streak,
      last.last_attendance_date,
      last.last_status,
      follow.follow_up_status,
      follow.last_follow_up_date,
      follow.last_visitation_date,
      follow.last_counseling_date,
      follow.follow_up_required,
      follow.follow_up_completed,
      follow.notes as follow_up_notes
    FROM members m
    LEFT JOIN sections s ON m.section_id = s.id
    LEFT JOIN leaders l ON m.leader_id = l.id
    LEFT JOIN users lu ON l.user_id = lu.id
    LEFT JOIN leaders head_l ON head_l.section_id = m.section_id AND head_l.is_head = 1 AND head_l.is_active = 1
    LEFT JOIN users head_u ON head_l.user_id = head_u.id
    LEFT JOIN (
      SELECT
        member_id,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'excused' THEN 1 ELSE 0 END) as excused_count,
        COUNT(*) as total_records,
        ROUND(CAST(AVG(CASE WHEN LOWER(TRIM(status)) = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate
      FROM attendance
      WHERE date BETWEEN ? AND ?${serviceFilter}
      GROUP BY member_id
    ) cur ON cur.member_id = m.id
    LEFT JOIN (
      SELECT
        member_id,
        ROUND(CAST(AVG(CASE WHEN LOWER(TRIM(status)) = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate
      FROM attendance
      WHERE date BETWEEN ? AND ?${serviceFilter}
      GROUP BY member_id
    ) prev ON prev.member_id = m.id
    LEFT JOIN (
      SELECT
        member_id,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'present' AND date >= ${daysAgo(7)} THEN 1 ELSE 0 END) as weekly_present,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'present' AND date >= ${daysAgo(14)} AND date < ${daysAgo(7)} THEN 1 ELSE 0 END) as prev_weekly_present
      FROM attendance
      WHERE date >= ${daysAgo(14)}
      GROUP BY member_id
    ) wk ON wk.member_id = m.id
    LEFT JOIN (
      SELECT
        member_id,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'present' AND date >= ${daysAgo(30)} THEN 1 ELSE 0 END) as monthly_present,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'present' AND date >= ${daysAgo(60)} AND date < ${daysAgo(30)} THEN 1 ELSE 0 END) as prev_monthly_present
      FROM attendance
      WHERE date >= ${daysAgo(60)}
      GROUP BY member_id
    ) mo ON mo.member_id = m.id
    LEFT JOIN (
      SELECT
        member_id,
        ROUND(CAST(COUNT(DISTINCT CASE WHEN LOWER(TRIM(status)) = 'present' THEN date END) AS NUMERIC) / NULLIF(COUNT(DISTINCT date), 0) * 100, 1) as retention_score
      FROM attendance
      WHERE date BETWEEN ? AND ?${serviceFilter}
      GROUP BY member_id
    ) ret ON ret.member_id = m.id
    LEFT JOIN (
      SELECT
        member_id,
        ROUND(CAST((
          SUM(CASE WHEN LOWER(TRIM(status)) = 'present' THEN 1 ELSE 0 END) * 2 +
          SUM(CASE WHEN LOWER(TRIM(status)) = 'excused' THEN 1 ELSE 0 END)
        ) AS NUMERIC) / NULLIF(COUNT(*) * 2, 0) * 100, 1) as engagement_score
      FROM attendance
      WHERE date BETWEEN ? AND ?${serviceFilter}
      GROUP BY member_id
    ) eng ON eng.member_id = m.id
    LEFT JOIN (
      SELECT
        mx.id as member_id,
        (
          SELECT COUNT(*)
          FROM attendance ap
          WHERE ap.member_id = mx.id AND LOWER(TRIM(ap.status)) = 'present'
            AND ap.date > COALESCE((SELECT MAX(ab.date) FROM attendance ab WHERE ab.member_id = mx.id AND LOWER(TRIM(ab.status)) != 'present'), '1900-01-01')
        ) as current_attendance_streak,
        (
          SELECT COUNT(*)
          FROM attendance aa
          WHERE aa.member_id = mx.id AND LOWER(TRIM(aa.status)) = 'absent'
            AND aa.date > COALESCE((SELECT MAX(an.date) FROM attendance an WHERE an.member_id = mx.id AND LOWER(TRIM(an.status)) != 'absent'), '1900-01-01')
        ) as consecutive_absences,
        (
          SELECT COUNT(*)
          FROM attendance lp
          WHERE lp.member_id = mx.id AND LOWER(TRIM(lp.status)) = 'present'
        ) as longest_attendance_streak
      FROM members mx
    ) st ON st.member_id = m.id
    LEFT JOIN (
      SELECT a1.member_id, a1.date as last_attendance_date, a1.status as last_status
      FROM attendance a1
      JOIN (
        SELECT member_id, MAX(date) as max_date
        FROM attendance
        GROUP BY member_id
      ) a2 ON a1.member_id = a2.member_id AND a1.date = a2.max_date
    ) last ON last.member_id = m.id
    LEFT JOIN (
      SELECT
        af.member_id,
        CASE WHEN SUM(CASE WHEN af.contacted = 0 THEN 1 ELSE 0 END) > 0 THEN 'Pending'
             WHEN COUNT(*) > 0 THEN 'Completed'
             ELSE 'Not Required'
        END as follow_up_status,
        MAX(af.created_at) as last_follow_up_date,
        MAX(CASE WHEN LOWER(COALESCE(af.contact_method, '')) LIKE '%visit%' THEN af.created_at END) as last_visitation_date,
        MAX(CASE WHEN LOWER(COALESCE(af.notes, '')) LIKE '%counsel%' THEN af.created_at END) as last_counseling_date,
        COUNT(*) as follow_up_required,
        SUM(CASE WHEN af.contacted = 1 THEN 1 ELSE 0 END) as follow_up_completed,
        MAX(af.notes) as notes
      FROM absent_followups af
      GROUP BY af.member_id
    ) follow ON follow.member_id = m.id
    WHERE m.soft_deleted_at IS NULL
    ORDER BY attendance_rate DESC, present_count DESC
  `, params);
  },

  getMemberStreakDetails: (memberId) => get(`
    SELECT
      (SELECT COUNT(*) FROM (
        SELECT date, status,
          ROW_NUMBER() OVER (ORDER BY date DESC) as rn,
          ROW_NUMBER() OVER (PARTITION BY status ORDER BY date DESC) as grp
        FROM attendance WHERE member_id = ?
        ORDER BY date DESC
      ) WHERE status = 'present' AND rn = grp
    ) as current_present_streak,
    (SELECT COUNT(*) FROM (
      SELECT date, status,
        ROW_NUMBER() OVER (ORDER BY date DESC) as rn,
        ROW_NUMBER() OVER (PARTITION BY status ORDER BY date DESC) as grp
        FROM attendance WHERE member_id = ?
        ORDER BY date DESC
      ) WHERE status = 'absent' AND rn = grp
    ) as current_absent_streak
  `, [memberId, memberId]),

  // ── Attendance Heat Map Data ───────────────────────────────────────────
  getAttendanceHeatMap: (months = 6) => all(`
    SELECT
      date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
      ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as rate,
      ${dayOfWeek('date')} as day_of_week,
      ${dayOfMonth('date')} as day_of_month,
      ${yearMonth('date')} as month
    FROM attendance
    WHERE date >= ${monthsAgoDate()}
    GROUP BY date
    ORDER BY date
  `, [months]),

  getSectionHeatMap: (months = 6) => all(`
    SELECT
      s.name as section_name,
      a.date,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as rate
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN sections s ON m.section_id = s.id
    WHERE a.date >= ${monthsAgoDate()}
    GROUP BY s.name, a.date
    ORDER BY a.date
  `, [months]),

  // ── Attendance Trends with Moving Average ─────────────────────────────
  getAttendanceTrendsWithMA: (weeks = 26) => all(`
    SELECT
      date,
      daily_present,
      daily_total,
      daily_rate,
      ROUND(CAST(AVG(daily_rate) OVER (ORDER BY date ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS NUMERIC), 1) as ma_4week,
      ROUND(CAST(AVG(daily_rate) OVER (ORDER BY date ROWS BETWEEN 7 PRECEDING AND CURRENT ROW) AS NUMERIC), 1) as ma_8week
    FROM (
      SELECT
        date,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as daily_present,
        COUNT(*) as daily_total,
        ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as daily_rate
      FROM attendance
      WHERE date >= ${weeksAgo()}
      GROUP BY date
    )
    ORDER BY date
  `, [weeks]),

  // ── Risk Analysis ─────────────────────────────────────────────────────
  getAttendanceRiskAnalysis: () => all(`
    SELECT
      m.id,
      m.full_name,
      s.name as section_name,
      lu.full_name as leader_name,
      COALESCE(stats.attendance_rate, 0) as attendance_rate,
      COALESCE(stats.total_present, 0) as total_present,
      COALESCE(stats.total_services, 0) as total_services,
      COALESCE(CAST(stats.last_present AS TEXT), 'Never') as last_present,
      CASE
        WHEN COALESCE(stats.attendance_rate, 0) >= 80 THEN 'Highly Active'
        WHEN COALESCE(stats.attendance_rate, 0) >= 60 THEN 'Active'
        WHEN COALESCE(stats.attendance_rate, 0) >= 40 THEN 'Moderately Active'
        WHEN COALESCE(stats.attendance_rate, 0) >= 20 THEN 'At Risk'
        ELSE 'Critical Follow-up Required'
      END as risk_level
    FROM members m
    LEFT JOIN sections s ON m.section_id = s.id
    LEFT JOIN leaders l ON m.leader_id = l.id
    LEFT JOIN users lu ON l.user_id = lu.id
    LEFT JOIN (
      SELECT
        member_id,
        ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as total_present,
        COUNT(*) as total_services,
        MAX(CASE WHEN status = 'present' THEN date END) as last_present
      FROM attendance
      WHERE date >= ${daysAgo(90)}
      GROUP BY member_id
    ) stats ON m.id = stats.member_id
    WHERE m.is_active = 1 AND m.soft_deleted_at IS NULL
    ORDER BY stats.attendance_rate DESC
  `),

  // ── Leader Workload ───────────────────────────────────────────────────
  getLeaderWorkload: (days = 90) => all(`
    SELECT
      l.id as leader_id,
      u.full_name as leader_name,
      s.name as section_name,
      COUNT(DISTINCT m.id) as assigned_members,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as members_present,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as members_absent,
      (SELECT COUNT(*) FROM absent_followups af
        JOIN members m2 ON af.member_id = m2.id
        WHERE m2.leader_id = l.id AND af.contacted = 0
      ) as pending_followups,
      (SELECT COUNT(*) FROM absent_followups af
        JOIN members m2 ON af.member_id = m2.id
        WHERE m2.leader_id = l.id AND af.contacted = 1
      ) as completed_followups,
      (SELECT COUNT(DISTINCT sub.date) FROM submission_log sub
        WHERE sub.leader_id = l.id AND sub.date >= ${daysAgo()}) as submissions
    FROM leaders l
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    LEFT JOIN members m ON m.leader_id = l.id AND m.is_active = 1
    LEFT JOIN attendance a ON a.member_id = m.id AND a.date >= ${daysAgo()}
    WHERE l.is_active = 1
    GROUP BY l.id, u.full_name, s.name
    ORDER BY assigned_members DESC
  `, [days, days]),

  // ── Correlation Analytics ──────────────────────────────────────────────
  getCorrelationAnalytics: (months = 6) => all(`
    SELECT
      ${yearMonth('a.date')} as month,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as attendance_rate,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as attendance_count,
      COALESCE(c.total_tithes, 0) as tithes,
      COALESCE(c.total_offerings, 0) as offerings,
      COALESCE(c.total_missions, 0) as missions,
      COALESCE(c.total_other, 0) as other_contributions,
      COALESCE(c.total_all, 0) as total_contributions,
      COALESCE(v.visitor_count, 0) as visitors,
      COALESCE(sw.souls_won, 0) as souls_won
    FROM (
      SELECT DISTINCT date FROM attendance WHERE date >= ${monthsAgoDate()}
    ) dates
    LEFT JOIN attendance a ON a.date = dates.date
    LEFT JOIN (
      SELECT
        ${yearMonth('payment_date')} as month,
        SUM(CASE WHEN ct.name = 'Tithes' THEN amount ELSE 0 END) as total_tithes,
        SUM(CASE WHEN ct.name = 'Offerings' THEN amount ELSE 0 END) as total_offerings,
        SUM(CASE WHEN ct.name = 'Missions' THEN amount ELSE 0 END) as total_missions,
        SUM(CASE WHEN ct.name NOT IN ('Tithes', 'Offerings', 'Missions') THEN amount ELSE 0 END) as total_other,
        SUM(amount) as total_all
      FROM contributions c
      JOIN contribution_types ct ON ct.id = c.contribution_type_id
      WHERE c.payment_date >= ${monthsAgoDate()}
      GROUP BY month
    ) c ON ${yearMonth('a.date')} = c.month
    LEFT JOIN (
      SELECT ${yearMonth('visitor_date')} as month, COUNT(*) as visitor_count
      FROM members WHERE visitor_date >= ${monthsAgoDate()}
      GROUP BY month
    ) v ON ${yearMonth('a.date')} = v.month
    LEFT JOIN (
      SELECT ${yearMonth('date_saved')} as month, COUNT(*) as souls_won
      FROM souls_won WHERE date_saved >= ${monthsAgoDate()}
      GROUP BY month
    ) sw ON ${yearMonth('a.date')} = sw.month
    GROUP BY month
    ORDER BY month
  `, [months, months, months, months]),

  // ── Church Growth Index ───────────────────────────────────────────────
  getChurchGrowthIndex: () => get(`
    SELECT
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date >= ${daysAgo(30)}) as current_active,
      (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date >= ${daysAgo(60)} AND date < ${daysAgo(30)}) as previous_active,
      (SELECT COUNT(*) FROM members WHERE is_active = 1 AND soft_deleted_at IS NULL) as total_members,
      (SELECT COUNT(*) FROM leaders WHERE is_active = 1) as total_leaders,
      (SELECT COUNT(*) FROM departments WHERE is_active = 1) as total_departments,
      (SELECT ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) FROM attendance WHERE date >= ${daysAgo(30)}) as current_rate,
      (SELECT ROUND(CAST(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) FROM attendance WHERE date >= ${daysAgo(60)} AND date < ${daysAgo(30)}) as previous_rate,
      (SELECT COUNT(DISTINCT sub.leader_id) FROM submission_log sub WHERE sub.date >= ${daysAgo(30)}) as active_leaders,
      (SELECT COUNT(*) FROM members WHERE visitor_date >= ${daysAgo(90)}) as new_visitors_90d,
      (SELECT COUNT(*) FROM souls_won WHERE date_saved >= ${daysAgo(90)}) as souls_won_90d,
      (SELECT COUNT(*) FROM souls_won WHERE date_saved >= ${daysAgo(365)}) as souls_won_year
  `),

  // ── AI Insights Generation ────────────────────────────────────────────
  getAIInsights: () => all(`
    SELECT 'attendance_trend' as insight_type, 'section' as category, s.name as subject,
      ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as current_value,
      NULL as previous_value, NULL as change_pct
    FROM sections s
    JOIN members m ON m.section_id = s.id
    JOIN attendance a ON a.member_id = m.id AND a.date >= ${daysAgo(30)}
    GROUP BY s.id, s.name
    ORDER BY current_value DESC
  `),

  getAtRiskMembers: () => all(`
    SELECT m.id, m.full_name, s.name as section_name, lu.full_name as leader_name,
      l.id as leader_id,
      COUNT(a.id) as total_services,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
    FROM members m
    LEFT JOIN sections s ON m.section_id = s.id
    LEFT JOIN leaders l ON m.leader_id = l.id
    LEFT JOIN users lu ON l.user_id = lu.id
    LEFT JOIN attendance a ON a.member_id = m.id AND a.date >= ${daysAgo(90)}
    WHERE m.is_active = 1 AND m.soft_deleted_at IS NULL
    GROUP BY m.id, m.full_name, s.name, lu.full_name, l.id
    HAVING present_count < total_services * 0.2
    ORDER BY present_count ASC
  `),

  getConsecutiveAbsentees: () => all(`
    SELECT m.id, m.full_name, s.name as section_name, lu.full_name as leader_name,
      COUNT(*) as consecutive_absences
    FROM (
      SELECT member_id, date, status,
        ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY date DESC) as rn,
        ROW_NUMBER() OVER (PARTITION BY member_id, status ORDER BY date DESC) as grp
      FROM attendance
      WHERE date >= ${daysAgo(90)}
    ) ranked
    JOIN members m ON ranked.member_id = m.id
    LEFT JOIN sections s ON m.section_id = s.id
    LEFT JOIN leaders l ON m.leader_id = l.id
    LEFT JOIN users lu ON l.user_id = lu.id
    WHERE ranked.status = 'absent' AND ranked.rn = ranked.grp
    GROUP BY m.id, m.full_name, s.name, lu.full_name
    HAVING consecutive_absences >= 3
    ORDER BY consecutive_absences DESC
  `),

  createNotification: (userId, type, title, message, entityType = null, entityId = null) =>
    run('INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, type, title, message, entityType, entityId])
      .then((res) => {
        // Best-effort: push a real-time event to any SSE subscriber for
        // this user. Failures here must NOT roll back the DB write.
        try {
          const realtimeBus = require('./realtime/bus');
          realtimeBus.publish(userId, 'notification', {
            id: res.lastID,
            type, title, message, entityType, entityId
          });
        } catch (_) { /* bus not loaded yet (tests) */ }
        return res;
      }),
  getUnreadCount: (userId) => get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [userId]),
  getUnreadNotifications: (userId) => all(
    'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC',
    [userId]),
  getNotifications: (userId, limit = 50) => all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]),
  getAllNotifications: (userId) => all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 500',
    [userId]),
  markNotificationRead: (notificationId, userId) =>
    run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notificationId, userId]),
  markAllNotificationsRead: (userId) =>
    run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]),
  getConsecutiveAbsentMembers: (leaderId, minStreak = 2) => all(`
    WITH member_absences AS (
      SELECT m.id as member_id, m.full_name, m.membership_id, s.name as section_name,
             a.date
      FROM members m
      JOIN attendance a ON m.id = a.member_id
      JOIN sections s ON m.section_id = s.id
      WHERE m.leader_id = ? AND a.status = 'absent'
    ),
    ordered AS (
      SELECT member_id, full_name, membership_id, section_name, date,
             LAG(date) OVER (PARTITION BY member_id ORDER BY date DESC) AS prev_date
      FROM member_absences
    ),
    runs AS (
      SELECT member_id, full_name, membership_id, section_name, date,
              SUM(CASE WHEN prev_date IS NULL OR (CAST(prev_date AS DATE) - CAST(date AS DATE)) > 9 THEN 1 ELSE 0 END)
               OVER (PARTITION BY member_id ORDER BY date DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS run_id
      FROM ordered
    ),
    streaks AS (
      SELECT member_id, full_name, membership_id, section_name,
             MAX(date) AS last_absent,
             COUNT(*) AS streak
      FROM runs
      GROUP BY member_id, full_name, membership_id, section_name, run_id
    )
    SELECT member_id, full_name, membership_id, section_name, last_absent, streak
    FROM streaks
    WHERE streak >= ?
    ORDER BY streak DESC, last_absent DESC
  `, [leaderId, minStreak]),

  // Follow-up queries
  createFollowUp: (memberId, leaderId, absenceDate) =>
    run('INSERT INTO absent_followups (member_id, leader_id, absence_date) VALUES (?, ?, ?)',
      [memberId, leaderId, absenceDate]),
  updateFollowUp: (followUpId, contacted, contactMethod, notes) =>
    run('UPDATE absent_followups SET contacted = ?, contact_method = ?, notes = ? WHERE id = ?',
      [contacted ? 1 : 0, contactMethod, notes, followUpId]),
  getFollowUpsByLeader: (leaderId) => all(
    'SELECT af.*, m.full_name as member_name, m.membership_id FROM absent_followups af JOIN members m ON af.member_id = m.id WHERE af.leader_id = ? ORDER BY af.created_at DESC',
    [leaderId]),
  getFollowUpByMemberAndDate: (memberId, absenceDate) => get(
    'SELECT * FROM absent_followups WHERE member_id = ? AND absence_date = ?',
    [memberId, absenceDate]),

  // Audit log queries
  getAuditLog: (filters = {}) => {
    // L12-fix (no-op confirmation): ORDER BY is hardcoded; the only
    // user-controlled interpolation is `filters.search` (handled in
    // the body below with LIKE escape) and bind parameters. Do not
    // accept a `sort` or `order_by` parameter from callers — keep
    // ORDER BY in this allowlist.
    let sql = `SELECT al.*, u.username, u.full_name FROM audit_log al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1`;
    const params = [];
    if (filters.entityType) { sql += ` AND al.entity_type = ?`; params.push(filters.entityType); }
    if (filters.action) { sql += ` AND al.action = ?`; params.push(filters.action); }
    if (filters.userId) { sql += ` AND al.user_id = ?`; params.push(filters.userId); }
    if (filters.startDate) { sql += ` AND al.created_at >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { sql += ` AND al.created_at <= ?`; params.push(filters.endDate); }
    if (filters.search) {
      // H8-fix: escape % and _ so a user can't transform an exact
      // substring match into a wildcard scan that returns every row
      // (mass-disclosure) or skip rows (audit-log tampering indicator).
      const pattern = `%${likeEscapePattern(filters.search)}%`;
      sql += ` AND (al.old_value ${likeClause()} OR al.new_value ${likeClause()})`;
      params.push(pattern, pattern);
    }
    sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(filters.limit || 50, filters.offset || 0);
    return all(sql, params);
  },
  getMemberAuditHistory: (memberId) => all(
    'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
    ['member', memberId]),
  createAuditLog: (userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent) =>
    run('INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress, userAgent]),
  createAuditEntry: (userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent) =>
    run('INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress, userAgent]),

  // Member export
  getAllMembersForExport: () => all(`
    SELECT m.*, s.name as section_name, u.full_name as leader_name
    FROM members m
    JOIN sections s ON m.section_id = s.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    ORDER BY s.name, m.full_name
  `),

  // Leader queries (additional)
  getAllLeaders: () => all(`
    SELECT l.*, u.username, u.full_name, l.email as user_email, s.name as section_name
    FROM leaders l
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    WHERE l.is_active = 1
    ORDER BY s.name, u.full_name
  `),

  // Outreach log queries
  createOutreachLog: (leaderId, memberId, contactMethod, message, weekStart) =>
    run('INSERT INTO outreach_logs (leader_id, member_id, contact_method, message, week_start) VALUES (?, ?, ?, ?, ?)',
      [leaderId, memberId, contactMethod, message, weekStart]),
  getOutreachByLeaderAndWeek: (leaderId, weekStart) => all(
    'SELECT ol.*, m.full_name as member_name, m.membership_id FROM outreach_logs ol JOIN members m ON ol.member_id = m.id WHERE ol.leader_id = ? AND ol.week_start = ? ORDER BY ol.created_at DESC',
    [leaderId, weekStart]),
  getOutreachByLeader: (leaderId, limit = 50) => all(
    'SELECT ol.*, m.full_name as member_name, m.membership_id, s.name as section_name FROM outreach_logs ol JOIN members m ON ol.member_id = m.id JOIN sections s ON m.section_id = s.id WHERE ol.leader_id = ? ORDER BY ol.created_at DESC LIMIT ?',
    [leaderId, limit]),
  getAllOutreachForWeek: (weekStart) => all(
    'SELECT ol.*, m.full_name as member_name, m.membership_id, u.full_name as leader_name, s.name as section_name FROM outreach_logs ol JOIN members m ON ol.member_id = m.id JOIN leaders l ON ol.leader_id = l.id JOIN users u ON l.user_id = u.id JOIN sections s ON l.section_id = s.id WHERE ol.week_start = ? ORDER BY ol.created_at DESC',
    [weekStart]),
  getLeaderOutreachStats: (leaderId, weeks = 4, today = formatLocalDate()) => {
    const cutoffWeekStart = formatLocalDate(addDays(today, -(weeks * 7)));

    return all(`
    SELECT ol.week_start,
           COUNT(*) as total_outreach,
           COUNT(DISTINCT ol.member_id) as unique_members,
           COUNT(DISTINCT CASE WHEN ol.contact_method = 'sms' THEN ol.member_id END) as sms_count,
           COUNT(DISTINCT CASE WHEN ol.contact_method = 'whatsapp' THEN ol.member_id END) as whatsapp_count,
           COUNT(DISTINCT CASE WHEN ol.contact_method = 'phone' THEN ol.member_id END) as phone_count
    FROM outreach_logs ol
    WHERE ol.leader_id = ? AND ol.week_start >= ?
    GROUP BY ol.week_start
    ORDER BY ol.week_start DESC
  `, [leaderId, cutoffWeekStart]);
  },
  getLeaderOutreachMembersNotContacted: (leaderId, weekStart) => all(`
    SELECT m.id, m.full_name, m.membership_id, m.phone
    FROM members m
    LEFT JOIN outreach_logs ol
      ON ol.member_id = m.id
     AND ol.leader_id = ?
     AND ol.week_start = ?
    WHERE m.leader_id = ? AND m.is_active = 1
    AND ol.id IS NULL
    ORDER BY m.full_name
  `, [leaderId, weekStart, leaderId]),

  // Engagement score queries (leader-level)
  getLeaderEngagementScores: (startDate, endDate) => {
    const outreachCutoffStart = formatLocalDate(addDays(startDate, -7));

    return all(`
    WITH leader_submissions AS (
      SELECT l.id as leader_id,
             COUNT(DISTINCT sl.date) as submission_count,
             COUNT(DISTINCT sl.date) * 1.0 / NULLIF((SELECT COUNT(DISTINCT a2.date) FROM attendance a2 WHERE a2.date BETWEEN ? AND ?), 0) * 100 as submission_rate
      FROM leaders l
      LEFT JOIN submission_log sl ON l.id = sl.leader_id AND sl.date BETWEEN ? AND ?
      GROUP BY l.id
    ),
    leader_outreach AS (
      SELECT l.id as leader_id,
             COUNT(DISTINCT ol.member_id) as members_contacted,
             COUNT(*) as total_outreach
      FROM leaders l
      LEFT JOIN outreach_logs ol ON l.id = ol.leader_id AND ol.week_start >= ?
      GROUP BY l.id
    ),
    leader_followups AS (
      SELECT l.id as leader_id,
             SUM(CASE WHEN af.contacted = 1 THEN 1 ELSE 0 END) as contacted_count,
             COUNT(*) as total_followups
      FROM leaders l
      LEFT JOIN absent_followups af ON l.id = af.leader_id
      GROUP BY l.id
    ),
    leader_attendance AS (
      SELECT l.id as leader_id,
             ROUND(CAST(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 AS NUMERIC), 1) as section_rate
      FROM leaders l
      LEFT JOIN members m ON l.id = m.leader_id
      LEFT JOIN attendance a ON m.id = a.member_id AND a.date BETWEEN ? AND ?
      GROUP BY l.id
    )
    SELECT l.id as leader_id,
           u.full_name as leader_name,
           s.name as section_name,
           COALESCE(ls.submission_count, 0) as submissions,
           COALESCE(ls.submission_rate, 0) as submission_rate,
           COALESCE(lo.members_contacted, 0) as members_contacted,
           COALESCE(lo.total_outreach, 0) as total_outreach,
           COALESCE(lf.contacted_count, 0) as followups_completed,
           COALESCE(lf.total_followups, 0) as total_followups,
           COALESCE(la.section_rate, 0) as section_attendance_rate,
            ROUND(
              (COALESCE(ls.submission_rate, 0) * 0.35) +
              (CASE WHEN COALESCE(lo.total_outreach, 0) > 0 THEN (CASE WHEN (COALESCE(lo.members_contacted, 0) * 1.0 / NULLIF((SELECT COUNT(*) FROM members WHERE leader_id = l.id), 0) * 100) > 100 THEN 100 ELSE (COALESCE(lo.members_contacted, 0) * 1.0 / NULLIF((SELECT COUNT(*) FROM members WHERE leader_id = l.id), 0) * 100) END) ELSE 0 END * 0.30) +
              (CASE WHEN COALESCE(lf.total_followups, 0) > 0 THEN COALESCE(lf.contacted_count, 0) * 1.0 / lf.total_followups * 100 ELSE 0 END * 0.20) +
              (COALESCE(la.section_rate, 0) * 0.15),
              1
            ) as engagement_score
    FROM leaders l
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    LEFT JOIN leader_submissions ls ON l.id = ls.leader_id
    LEFT JOIN leader_outreach lo ON l.id = lo.leader_id
    LEFT JOIN leader_followups lf ON l.id = lf.leader_id
    LEFT JOIN leader_attendance la ON l.id = la.leader_id
    WHERE l.is_active = 1
    ORDER BY engagement_score DESC
  `, [startDate, endDate, startDate, endDate, outreachCutoffStart, startDate, endDate]);
  },

  // Weekly summary data
  getWeeklySummary: (weekStart) => {
    const weekEnd = formatLocalDate(addDays(weekStart, 6));

    return all(`
    WITH submission_summary AS (
      SELECT s.name as section_name,
             u.full_name as leader_name,
             l.id as leader_id,
             COUNT(sl.id) as submitted,
             (SELECT COUNT(DISTINCT a.date) FROM attendance a WHERE a.date BETWEEN ? AND ?) as total_services
      FROM leaders l
      JOIN users u ON l.user_id = u.id
      JOIN sections s ON l.section_id = s.id
      LEFT JOIN submission_log sl ON l.id = sl.leader_id AND sl.date BETWEEN ? AND ?
      WHERE l.is_active = 1
      GROUP BY l.id
    ),
    outreach_summary AS (
      SELECT l.id as leader_id,
             COUNT(*) as outreach_count,
             COUNT(DISTINCT ol.member_id) as members_contacted
      FROM leaders l
      LEFT JOIN outreach_logs ol ON l.id = ol.leader_id AND ol.week_start = ?
      GROUP BY l.id
    ),
    absent_summary AS (
      SELECT l.id as leader_id,
             COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN m.id END) as absent_members
      FROM leaders l
      LEFT JOIN members m ON l.id = m.leader_id
      LEFT JOIN attendance a ON m.id = a.member_id AND a.date = (
        SELECT MAX(date) FROM attendance WHERE date BETWEEN ? AND ?
      )
      GROUP BY l.id
    )
    SELECT ss.section_name,
           ss.leader_name,
           ss.submitted,
           ss.total_services,
           COALESCE(os.outreach_count, 0) as outreach_count,
           COALESCE(os.members_contacted, 0) as members_contacted,
           COALESCE(abs.absent_members, 0) as absent_members
    FROM submission_summary ss
    LEFT JOIN outreach_summary os ON ss.leader_id = os.leader_id
    LEFT JOIN absent_summary abs ON ss.leader_id = abs.leader_id
    ORDER BY ss.section_name, ss.leader_name
  `, [weekStart, weekEnd, weekStart, weekEnd, weekStart, weekStart, weekEnd]);
  },

  // Auto-alert: members needing follow-up
  getMembersNeedingFollowUp: (startDate = formatLocalDate(addDays(new Date(), -14))) => all(`
    SELECT m.id, m.full_name, m.membership_id, m.phone,
           s.name as section_name,
           u.full_name as leader_name,
           l.id as leader_id,
           l.user_id as leader_user_id,
           COUNT(*) as recent_absences,
           MAX(a.date) as last_absent
    FROM members m
    JOIN attendance a ON m.id = a.member_id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON m.section_id = s.id
    LEFT JOIN absent_followups af ON m.id = af.member_id AND af.absence_date = a.date
    WHERE a.status = 'absent'
      AND a.date >= ?
      AND af.id IS NULL
    GROUP BY m.id, m.full_name, m.membership_id, m.phone, s.name, u.full_name, l.id, l.user_id
    HAVING COUNT(*) >= 2
    ORDER BY recent_absences DESC, last_absent DESC
  `, [startDate]),

   // Birthday reminders for today
   getTodayBirthdays: (todayMonthDay = formatMonthDay()) => all(`
     SELECT m.id, m.full_name, m.membership_id, m.phone, m.date_of_birth,
            s.name as section_name,
            u.full_name as leader_name,
            l.id as leader_id,
            l.user_id as leader_user_id
     FROM members m
     JOIN leaders l ON m.leader_id = l.id
     JOIN users u ON l.user_id = u.id
     JOIN sections s ON m.section_id = s.id
     WHERE m.date_of_birth IS NOT NULL
       AND m.is_active = 1
       AND ${sqlMonthDay('m.date_of_birth')} = ?
   `, [todayMonthDay]),

   // Get all birthdays with optional filtering
   getAllBirthdays: (filters = {}) => {
     let query = `
       SELECT m.id, m.full_name, m.membership_id, m.phone, m.date_of_birth,
              m.age_group, m.gender,
             s.name as section_name,
             u.full_name as leader_name
      FROM members m
      JOIN sections s ON m.section_id = s.id
      LEFT JOIN leaders l ON m.leader_id = l.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE m.date_of_birth IS NOT NULL
         AND m.is_active = 1
     `;
     const params = [];

     if (filters.section_id) {
       query += ' AND m.section_id = ?';
       params.push(filters.section_id);
     }

     if (filters.month) {
       query += ` AND ${monthNumber('m.date_of_birth')} = ?`;
       params.push(filters.month.padStart(2, '0'));
     }

      query += ` ORDER BY ${sqlMonthDay('m.date_of_birth')} LIMIT 500`;

      return all(query, params);
   },

  // Scheduled reminder queries
  createScheduledReminder: (type, entityType, entityId, scheduledFor, payload) =>
    run('INSERT INTO scheduled_reminders (type, entity_type, entity_id, scheduled_for, payload) VALUES (?, ?, ?, ?, ?)',
      [type, entityType, entityId, scheduledFor, payload ? JSON.stringify(payload) : null]),
  getPendingReminders: () => all(
    `SELECT * FROM scheduled_reminders WHERE sent = 0 AND scheduled_for <= ${pendingNowExpression()} ORDER BY scheduled_for ASC LIMIT 500`,
    []),
  markReminderSent: (reminderId) =>
    run("UPDATE scheduled_reminders SET sent = 1, sent_at = CURRENT_TIMESTAMP WHERE id = ?", [reminderId]),
  getUpcomingReminders: (type, hours = 24) => all(
    `SELECT * FROM scheduled_reminders WHERE type = ? AND sent = 0 AND scheduled_for <= ${nowMinusHours(hours)} ORDER BY scheduled_for ASC LIMIT 500`,
    [type]),

  // Congregation title queries
  getAllTitles: () => all('SELECT * FROM congregation_titles ORDER BY sort_order ASC, name ASC'),
  getActiveTitles: () => all('SELECT * FROM congregation_titles WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'),
  getTitleById: (id) => get('SELECT * FROM congregation_titles WHERE id = ?', [id]),
  createTitle: (name, description = null, sort_order = 0) =>
    run('INSERT INTO congregation_titles (name, description, sort_order) VALUES (?, ?, ?)', [name, description, sort_order]),
  updateTitle: (id, name, description, is_active, sort_order) =>
    run('UPDATE congregation_titles SET name = ?, description = ?, is_active = ?, sort_order = ? WHERE id = ?', [name, description, is_active, sort_order, id]),
  deleteTitle: (id) => run('DELETE FROM congregation_titles WHERE id = ?', [id]),

  getMemberTitles: (memberId) => all(`
    SELECT ct.*, mt.assigned_at, mt.appointment_date, mt.status, mt.notes, u.full_name as assigned_by_name
    FROM member_titles mt
    JOIN congregation_titles ct ON mt.title_id = ct.id
    LEFT JOIN users u ON mt.assigned_by = u.id
    WHERE mt.member_id = ?
    ORDER BY ct.sort_order ASC, ct.name ASC
  `, [memberId]),
  assignMemberTitle: (memberId, titleId, assignedBy, appointmentDate = null, notes = null) =>
    run('INSERT INTO member_titles (member_id, title_id, assigned_by, appointment_date, notes) VALUES (?, ?, ?, ?, ?) ON CONFLICT(member_id, title_id) DO NOTHING', [memberId, titleId, assignedBy, appointmentDate, notes]),
  updateMemberTitle: (memberId, titleId, status, notes) =>
    run('UPDATE member_titles SET status = ?, notes = ? WHERE member_id = ? AND title_id = ?', [status, notes, memberId, titleId]),
  removeMemberTitle: (memberId, titleId) =>
    run('DELETE FROM member_titles WHERE member_id = ? AND title_id = ?', [memberId, titleId]),
  getMembersByTitle: (titleId) => all(`
    SELECT m.id, m.full_name, m.membership_id, s.name as section_name
    FROM member_titles mt
    JOIN members m ON mt.member_id = m.id
    LEFT JOIN sections s ON m.section_id = s.id
    WHERE mt.title_id = ? AND m.is_active = 1
    ORDER BY m.full_name
  `, [titleId]),

  // Member title history (audit trail)
  addMemberTitleHistory: (memberId, titleId, action, changedBy, oldStatus, newStatus, oldNotes, newNotes, notes) =>
    run('INSERT INTO member_title_history (member_id, title_id, action, changed_by, old_status, new_status, old_notes, new_notes, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [memberId, titleId, action, changedBy, oldStatus, newStatus, oldNotes, newNotes, notes]),
  getMemberTitleHistory: (memberId, titleId) => all(`
    SELECT mth.*, u.full_name as changed_by_name
    FROM member_title_history mth
    LEFT JOIN users u ON mth.changed_by = u.id
    WHERE mth.member_id = ? AND mth.title_id = ?
    ORDER BY mth.created_at DESC
  `, [memberId, titleId]),

  // Leadership directory
  getLeadershipDirectory: (filters = {}) => {
    const { titleId = null, status = null, search = null, sectionId = null, appointmentFrom = null, appointmentTo = null, limit = 500, offset = 0 } = filters;
    const conditions = ['m.is_active = 1', 'mt.id IS NOT NULL'];
    const params = [];
    const likeCI = likeClauseCaseInsensitive();
    if (titleId) {
      conditions.push('mt.title_id = ?');
      params.push(titleId);
    }
    if (status) {
      conditions.push('mt.status = ?');
      params.push(status);
    }
    if (search) {
      const like = `%${likeEscapePattern(search)}%`;
      conditions.push(`(m.full_name ${likeCI} OR ct.name ${likeCI})`);
      params.push(like, like);
    }
    if (sectionId) {
      conditions.push('m.section_id = ?');
      params.push(sectionId);
    }
    if (appointmentFrom) {
      conditions.push('mt.appointment_date >= ?');
      params.push(appointmentFrom);
    }
    if (appointmentTo) {
      conditions.push('mt.appointment_date <= ?');
      params.push(appointmentTo);
    }
    return all(`
      SELECT m.id, m.full_name, m.membership_id, m.phone, m.email,
             s.name as section_name, ct.name as title_name, ct.id as title_id,
             mt.status as title_status, mt.appointment_date, mt.assigned_at,
             u2.full_name as assigned_by_name
      FROM member_titles mt
      JOIN members m ON mt.member_id = m.id
      JOIN congregation_titles ct ON mt.title_id = ct.id
      LEFT JOIN sections s ON m.section_id = s.id
      LEFT JOIN users u2 ON mt.assigned_by = u2.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.full_name, ct.sort_order ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
  },
  getLeadershipDirectoryCount: (filters = {}) => {
    const { titleId = null, status = null, search = null, sectionId = null, appointmentFrom = null, appointmentTo = null } = filters;
    const conditions = ['m.is_active = 1', 'mt.id IS NOT NULL'];
    const params = [];
    const likeCI = likeClauseCaseInsensitive();
    if (titleId) {
      conditions.push('mt.title_id = ?');
      params.push(titleId);
    }
    if (status) {
      conditions.push('mt.status = ?');
      params.push(status);
    }
    if (search) {
      const like = `%${likeEscapePattern(search)}%`;
      conditions.push(`(m.full_name ${likeCI} OR ct.name ${likeCI})`);
      params.push(like, like);
    }
    if (sectionId) {
      conditions.push('m.section_id = ?');
      params.push(sectionId);
    }
    if (appointmentFrom) {
      conditions.push('mt.appointment_date >= ?');
      params.push(appointmentFrom);
    }
    if (appointmentTo) {
      conditions.push('mt.appointment_date <= ?');
      params.push(appointmentTo);
    }
    return all(`
      SELECT COUNT(DISTINCT m.id) as total
      FROM member_titles mt
      JOIN members m ON mt.member_id = m.id
      JOIN congregation_titles ct ON mt.title_id = ct.id
      LEFT JOIN sections s ON m.section_id = s.id
      WHERE ${conditions.join(' AND ')}
    `, params);
  },
  getLeadershipStats: () => all(`
    SELECT ct.id, ct.name, ct.description,
           SUM(CASE WHEN mt.status = 'active' THEN 1 ELSE 0 END) as active_count,
           SUM(CASE WHEN mt.status = 'inactive' THEN 1 ELSE 0 END) as inactive_count,
           COUNT(mt.id) as total_count
    FROM congregation_titles ct
    LEFT JOIN member_titles mt ON mt.title_id = ct.id
    WHERE ct.is_active = 1
    GROUP BY ct.id, ct.name, ct.description
    ORDER BY ct.sort_order ASC, ct.name ASC
  `),

  // Extended title query including category
  getAllTitlesWithCategory: () => all(`
    SELECT ct.*, p.name as reports_to_title_name
    FROM congregation_titles ct
    LEFT JOIN congregation_titles p ON ct.reports_to_title_id = p.id
    ORDER BY ct.sort_order ASC, ct.name ASC
  `),
  createTitleFull: (name, description, category, sort_order, reports_to_title_id, is_active) =>
    run('INSERT INTO congregation_titles (name, description, category, sort_order, reports_to_title_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, category || 'General', sort_order || 0, reports_to_title_id || null, is_active !== undefined ? (is_active ? 1 : 0) : 1]),
  updateTitleFull: (id, name, description, category, sort_order, reports_to_title_id, is_active) =>
    run('UPDATE congregation_titles SET name = ?, description = ?, category = ?, sort_order = ?, reports_to_title_id = ?, is_active = ? WHERE id = ?',
      [name, description || null, category || 'General', sort_order || 0, reports_to_title_id || null, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]),

  // Department queries
  getAllDepartments: () => all(`
    SELECT d.*,
           ct.name as reports_to_title_name,
           m1.full_name as leader_name,
           m2.full_name as assistant_leader_name,
           m3.full_name as secretary_name,
           (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id) as member_count
    FROM departments d
    LEFT JOIN congregation_titles ct ON d.reports_to_title_id = ct.id
    LEFT JOIN members m1 ON d.leader_id = m1.id
    LEFT JOIN members m2 ON d.assistant_leader_id = m2.id
    LEFT JOIN members m3 ON d.secretary_id = m3.id
    ORDER BY d.name ASC
  `),
  getDepartmentById: (id) => get(`
    SELECT d.*,
           ct.name as reports_to_title_name,
           m1.full_name as leader_name,
           m2.full_name as assistant_leader_name,
           m3.full_name as secretary_name
    FROM departments d
    LEFT JOIN congregation_titles ct ON d.reports_to_title_id = ct.id
    LEFT JOIN members m1 ON d.leader_id = m1.id
    LEFT JOIN members m2 ON d.assistant_leader_id = m2.id
    LEFT JOIN members m3 ON d.secretary_id = m3.id
    WHERE d.id = ?
  `, [id]),
  createDepartment: (name, description, reports_to_title_id, leader_id, assistant_leader_id, secretary_id) =>
    run('INSERT INTO departments (name, description, reports_to_title_id, leader_id, assistant_leader_id, secretary_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, reports_to_title_id || null, leader_id || null, assistant_leader_id || null, secretary_id || null]),
  updateDepartment: (id, name, description, reports_to_title_id, leader_id, assistant_leader_id, secretary_id, is_active) =>
    run('UPDATE departments SET name = ?, description = ?, reports_to_title_id = ?, leader_id = ?, assistant_leader_id = ?, secretary_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description || null, reports_to_title_id || null, leader_id || null, assistant_leader_id || null, secretary_id || null, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]),
  deleteDepartment: (id) => run('DELETE FROM departments WHERE id = ?', [id]),

  // Department members
  getDepartmentMembers: (departmentId) => all(`
    SELECT dm.id, dm.joined_at, m.id as member_id, m.full_name as member_name, m.membership_id, m.phone, m.email,
           s.name as member_section
    FROM department_members dm
    JOIN members m ON dm.member_id = m.id
    LEFT JOIN sections s ON m.section_id = s.id
    WHERE dm.department_id = ? AND m.is_active = 1
    ORDER BY m.full_name ASC
  `, [departmentId]),
  addDepartmentMember: (departmentId, memberId) =>
    run('INSERT INTO department_members (department_id, member_id) VALUES (?, ?) ON CONFLICT(department_id, member_id) DO NOTHING', [departmentId, memberId]),
  removeDepartmentMember: (departmentId, memberId) =>
    run('DELETE FROM department_members WHERE department_id = ? AND member_id = ?', [departmentId, memberId]),
  removeDepartmentMemberById: (id) =>
    run('DELETE FROM department_members WHERE id = ?', [id]),

  // Department history
  addDepartmentHistory: (departmentId, memberId, role, action, notes, changedBy) =>
    run('INSERT INTO department_history (department_id, member_id, role, action, notes, changed_by) VALUES (?, ?, ?, ?, ?, ?)',
      [departmentId, memberId || null, role, action, notes || null, changedBy || null]),
  getDepartmentHistory: (departmentId) => all(`
    SELECT dh.*, m.full_name as member_name, u.full_name as changed_by_name,
           CASE WHEN dh.role IS NOT NULL THEN 'department_' || dh.role ELSE 'department_member' END as entity_type,
           CASE WHEN dh.notes IS NOT NULL AND dh.notes != '' THEN (COALESCE(m.full_name, 'Unknown') || ' — ' || dh.notes) ELSE COALESCE(m.full_name, 'Unknown') END as details,
           u.full_name as operator_name
    FROM department_history dh
    LEFT JOIN members m ON dh.member_id = m.id
    LEFT JOIN users u ON dh.changed_by = u.id
    WHERE dh.department_id = ?
    ORDER BY dh.created_at DESC
    LIMIT 100
  `, [departmentId]),

  // Member's department memberships
  getMemberDepartments: (memberId) => all(`
    SELECT d.id, d.name, d.description, dm.joined_at,
           CASE WHEN d.leader_id = ? THEN 'Leader'
                WHEN d.assistant_leader_id = ? THEN 'Assistant Leader'
                WHEN d.secretary_id = ? THEN 'Secretary'
                ELSE 'Member' END as role
    FROM department_members dm
    JOIN departments d ON dm.department_id = d.id
    WHERE dm.member_id = ? AND d.is_active = 1
    ORDER BY d.name ASC
  `, [memberId, memberId, memberId, memberId]),

  // ── New Member Leader ──────────────────────────────────────────────────
  getNewMembers: (status = 'probation') => all(`
    SELECT nm.*, u.full_name as added_by_name, m.full_name as mentor_name, s.name as section_name
    FROM new_members nm
    LEFT JOIN users u ON nm.added_by = u.id
    LEFT JOIN members m ON nm.mentor_id = m.id
    LEFT JOIN sections s ON nm.graduated_to_section_id = s.id
    WHERE nm.status = ? AND nm.is_active = 1
    ORDER BY nm.date_joined DESC
  `, [status]),
  getNewMemberById: (id) => get(`
    SELECT nm.*, u.full_name as added_by_name, m.full_name as mentor_name, s.name as section_name
    FROM new_members nm
    LEFT JOIN users u ON nm.added_by = u.id
    LEFT JOIN members m ON nm.mentor_id = m.id
    LEFT JOIN sections s ON nm.graduated_to_section_id = s.id
    WHERE nm.id = ?
  `, [id]),
  createNewMember: (data) => run(`
    INSERT INTO new_members (full_name, phone, email, address, date_joined, decision_type, marital_status, date_of_birth, occupation, invitation_source, added_by, mentor_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [data.full_name, data.phone || null, data.email || null, data.address || null, data.date_joined, data.decision_type || null, data.marital_status || null, data.date_of_birth || null, data.occupation || null, data.invitation_source || null, data.added_by || null, data.mentor_id || null, data.notes || null]),
  updateNewMember: (id, data) => run(`
    UPDATE new_members SET full_name = ?, phone = ?, email = ?, address = ?, date_joined = ?, decision_type = ?, marital_status = ?, date_of_birth = ?, occupation = ?, invitation_source = ?, mentor_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [data.full_name, data.phone || null, data.email || null, data.address || null, data.date_joined, data.decision_type || null, data.marital_status || null, data.date_of_birth || null, data.occupation || null, data.invitation_source || null, data.mentor_id || null, data.notes || null, id]),
  graduateNewMember: (id, sectionId, graduatedBy) => run(`
    UPDATE new_members SET status = 'graduated', graduation_date = CURRENT_DATE, graduated_to_section_id = ?, graduated_by = ?, is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [sectionId, graduatedBy, id]),
  makePermanent: (id) => run(`
    UPDATE new_members SET status = 'permanent', is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id]),
  deleteNewMember: (id) => run('DELETE FROM new_members WHERE id = ?', [id]),

  // New member attendance
  getNewMemberAttendance: (newMemberId) => all(`
    SELECT * FROM new_member_attendance WHERE new_member_id = ? ORDER BY week_start ASC
  `, [newMemberId]),
  getNewMembersAttendanceByWeek: (weekStart) => all(`
    SELECT * FROM new_member_attendance WHERE week_start = ?
  `, [weekStart]),
  upsertNewMemberAttendance: (newMemberId, weekStart, attended, notes, recordedBy) => run(usePostgres ? `
    INSERT INTO new_member_attendance (new_member_id, week_start, attended, notes, recorded_by)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (new_member_id, week_start) DO UPDATE SET
      attended = EXCLUDED.attended,
      notes = EXCLUDED.notes,
      recorded_by = EXCLUDED.recorded_by
  ` : `
    INSERT INTO new_member_attendance (new_member_id, week_start, attended, notes, recorded_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(new_member_id, week_start) DO UPDATE SET
      attended = excluded.attended,
      notes = excluded.notes,
      recorded_by = excluded.recorded_by
  `, [newMemberId, weekStart, attended, notes || null, recordedBy || null]),

  // Reports
  getNewMembersReport: (startDate, endDate) => all(usePostgres ? `
    SELECT DATE_TRUNC('month', date_joined) as month, COUNT(*) as count
    FROM new_members
    WHERE date_joined >= $1 AND date_joined <= $2 AND is_active = 1
    GROUP BY month ORDER BY month
  ` : `
    SELECT ${yearMonthFirst('date_joined')} as month, COUNT(*) as count
    FROM new_members
    WHERE date_joined >= ? AND date_joined <= ? AND is_active = 1
    GROUP BY month ORDER BY month
  `, [startDate, endDate]),
  getNewMembersByMonth: (year) => all(usePostgres ? `
    SELECT
      DATE_TRUNC('month', date_joined) as month,
      COUNT(*) FILTER (WHERE status = 'probation') as probation,
      COUNT(*) FILTER (WHERE status = 'graduated') as graduated,
      COUNT(*) FILTER (WHERE status = 'permanent') as permanent
    FROM new_members
    WHERE EXTRACT(YEAR FROM date_joined) = $1
    GROUP BY month ORDER BY month
  ` : `
    SELECT
      ${yearMonthFirst('date_joined')} as month,
      SUM(CASE WHEN status = 'probation' THEN 1 ELSE 0 END) as probation,
      SUM(CASE WHEN status = 'graduated' THEN 1 ELSE 0 END) as graduated,
      SUM(CASE WHEN status = 'permanent' THEN 1 ELSE 0 END) as permanent
    FROM new_members
    WHERE ${yearOnly('date_joined')} = ?
    GROUP BY month ORDER BY month
  `, [year]),
  // Section with least members for graduation suggestion
  getSectionWithLeastMembers: () => get(`
    SELECT s.id, s.name, COUNT(m.id) as member_count
    FROM sections s
    LEFT JOIN members m ON m.section_id = s.id AND m.is_active = 1
    GROUP BY s.id, s.name
    ORDER BY member_count ASC
    LIMIT 1
  `),

  // ── Evangelism Queries ──────────────────────────────────────────────────
  getOutreachEvents: (filters = {}) => {
    let sql = 'SELECT * FROM outreach_events WHERE 1=1';
    const params = [];
    if (filters.event_type) { sql += ' AND event_type = ?'; params.push(filters.event_type); }
    sql += ' ORDER BY date DESC';
    return all(sql, params);
  },
  getOutreachEventById: (id) => get('SELECT * FROM outreach_events WHERE id = ?', [id]),
  createOutreachEvent: (data) => run(`
    INSERT INTO outreach_events (name, date, location, event_type, organizer, volunteers, budget, results, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [data.name, data.date, data.location, data.event_type, data.organizer, data.volunteers, data.budget, data.results, data.created_by]),
  updateOutreachEvent: (id, data) => run(`
    UPDATE outreach_events SET name=?, date=?, location=?, event_type=?, organizer=?, volunteers=?, budget=?, results=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [data.name, data.date, data.location, data.event_type, data.organizer, data.volunteers, data.budget, data.results, id]),
  deleteOutreachEvent: (id) => run('DELETE FROM outreach_events WHERE id = ?', [id]),

  getSoulsWon: (filters = {}) => {
    let sql = `
      SELECT sw.*, oe.name as outreach_name,
        (SELECT COUNT(*) FROM follow_ups WHERE soul_won_id = sw.id) as follow_up_count
      FROM souls_won sw
      LEFT JOIN outreach_events oe ON sw.outreach_event_id = oe.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.status) { sql += ' AND sw.follow_up_status = ?'; params.push(filters.status); }
    if (filters.start_date) { sql += ' AND sw.date_saved >= ?'; params.push(filters.start_date); }
    if (filters.end_date) { sql += ' AND sw.date_saved <= ?'; params.push(filters.end_date); }
    sql += ' ORDER BY sw.date_saved DESC';
    return all(sql, params);
  },
  getSoulWonById: (id) => get(`
    SELECT sw.*, oe.name as outreach_name
    FROM souls_won sw
    LEFT JOIN outreach_events oe ON sw.outreach_event_id = oe.id
    WHERE sw.id = ?
  `, [id]),
  createSoulWon: (data) => run(`
    INSERT INTO souls_won (full_name, phone, gender, age_group, location, date_saved, outreach_event_id, soul_winner, follow_up_status, assigned_leader_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [data.full_name, data.phone, data.gender, data.age_group, data.location, data.date_saved, data.outreach_event_id, data.soul_winner, data.follow_up_status || 'new_convert', data.assigned_leader_id, data.created_by]),
  updateSoulWon: (id, data) => run(`
    UPDATE souls_won SET full_name=?, phone=?, gender=?, age_group=?, location=?, date_saved=?, outreach_event_id=?, soul_winner=?, follow_up_status=?, assigned_leader_id=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [data.full_name, data.phone, data.gender, data.age_group, data.location, data.date_saved, data.outreach_event_id, data.soul_winner, data.follow_up_status, data.assigned_leader_id, id]),
  deleteSoulWon: (id) => run('DELETE FROM souls_won WHERE id = ?', [id]),

  getFollowUps: (soulWonId) => all(`
    SELECT fu.*, sw.full_name as soul_won_name
    FROM follow_ups fu
    JOIN souls_won sw ON fu.soul_won_id = sw.id
    WHERE fu.soul_won_id = ?
    ORDER BY fu.last_contact_date DESC
  `, [soulWonId]),
  createEvangelismFollowUp: (data) => run(`
    INSERT INTO follow_ups (soul_won_id, first_contact_date, last_contact_date, follow_up_officer, home_visit_status, counseling_status, prayer_needs, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [data.soul_won_id, data.first_contact_date, data.last_contact_date, data.follow_up_officer, data.home_visit_status, data.counseling_status, data.prayer_needs, data.notes, data.created_by]),
  updateEvangelismFollowUp: (id, data) => run(`
    UPDATE follow_ups SET first_contact_date=?, last_contact_date=?, follow_up_officer=?, home_visit_status=?, counseling_status=?, prayer_needs=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [data.first_contact_date, data.last_contact_date, data.follow_up_officer, data.home_visit_status, data.counseling_status, data.prayer_needs, data.notes, id]),

  getEvangelismTeam: () => all('SELECT * FROM evangelism_team WHERE is_active = 1 ORDER BY souls_won DESC'),
  createEvangelismTeamMember: (data) => run(`
    INSERT INTO evangelism_team (full_name, role, phone, email, section, souls_won, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [data.full_name, data.role, data.phone, data.email, data.section, data.souls_won || 0, data.created_by]),
  updateEvangelismTeamMember: (id, data) => run(`
    UPDATE evangelism_team SET full_name=?, role=?, phone=?, email=?, section=?, souls_won=? WHERE id=?
  `, [data.full_name, data.role, data.phone, data.email, data.section, data.souls_won, id]),
  deleteEvangelismTeamMember: (id) => run('DELETE FROM evangelism_team WHERE id = ?', [id]),

  getBaptismTracking: () => all(usePostgres
    ? 'SELECT * FROM baptism_tracking ORDER BY baptism_date DESC NULLS LAST'
    : 'SELECT * FROM baptism_tracking ORDER BY baptism_date DESC'),
  getBaptismTrackingById: (id) => get('SELECT * FROM baptism_tracking WHERE id = ?', [id]),
  createBaptismTracking: (data) => run(`
    INSERT INTO baptism_tracking (soul_won_id, candidate_name, salvation_date, baptism_date, baptized_by, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [data.soul_won_id, data.candidate_name, data.salvation_date, data.baptism_date, data.baptized_by, data.status || 'candidate', data.created_by]),
  updateBaptismTracking: (id, data) => run(`
    UPDATE baptism_tracking SET candidate_name=?, salvation_date=?, baptism_date=?, baptized_by=?, status=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [data.candidate_name, data.salvation_date, data.baptism_date, data.baptized_by, data.status, id]),
  deleteBaptismTracking: (id) => run('DELETE FROM baptism_tracking WHERE id = ?', [id]),

  // ── Evangelism Stats ────────────────────────────────────────────────────
  getEvangelismStats: async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const soulsMonth = await get('SELECT COUNT(*) as count FROM souls_won WHERE date_saved >= ?', [monthStartStr]);
    const soulsYear = await get('SELECT COUNT(*) as count FROM souls_won WHERE date_saved >= ?', [yearStart]);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const newConvertsWeek = await get('SELECT COUNT(*) as count FROM souls_won WHERE date_saved >= ? AND follow_up_status = ?', [weekStartStr, 'new_convert']);
    const newConvertsMonth = await get('SELECT COUNT(*) as count FROM souls_won WHERE date_saved >= ? AND follow_up_status = ?', [monthStartStr, 'new_convert']);
    const baptisms = await get('SELECT COUNT(*) as count FROM baptism_tracking WHERE status = ?', ['completed']);
    const activeOutreach = await get('SELECT COUNT(*) as count FROM outreach_events WHERE date >= ?', [monthStartStr]);
    const pendingFollowUps = await get('SELECT COUNT(*) as count FROM souls_won WHERE follow_up_status IN (?,?)', ['new_convert', 'under_follow_up']);
    const totalVisitors = await get('SELECT COUNT(*) as count FROM souls_won');
    const totalSaved = await get("SELECT COUNT(*) as count FROM souls_won WHERE follow_up_status != 'new_convert'");
    const conversionRate = totalVisitors.count > 0 ? ((totalSaved.count / totalVisitors.count) * 100).toFixed(1) : 0;

    return {
      souls_won_month: soulsMonth.count,
      souls_won_year: soulsYear.count,
      new_converts_week: newConvertsWeek.count,
      new_converts_month: newConvertsMonth.count,
      baptisms: baptisms.count,
      active_outreach: activeOutreach.count,
      pending_follow_ups: pendingFollowUps.count,
      conversion_rate: conversionRate,
      total_souls_won: totalVisitors.count
    };
  },
  getSoulWinningTrend: () => all(usePostgres ? `
    SELECT to_char(date_saved, 'YYYY-MM') as month, COUNT(*) as count
    FROM souls_won
    WHERE date_saved >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY month ORDER BY month ASC
  ` : `
    SELECT ${yearMonth('date_saved')} as month, COUNT(*) as count
    FROM souls_won
    WHERE date_saved >= ${monthsAgoDate(12)}
    GROUP BY month ORDER BY month ASC
  `),
  getConversionFunnel: async () => {
    const visitors = await get('SELECT COUNT(*) as count FROM souls_won');
    const saved = await get("SELECT COUNT(*) as count FROM souls_won WHERE follow_up_status != 'new_convert'");
    const followedUp = await get("SELECT COUNT(*) as count FROM souls_won WHERE follow_up_status IN ('under_follow_up','joined_cell','joined_church','baptized','active_member')");
    const baptized = await get('SELECT COUNT(DISTINCT soul_won_id) as count FROM baptism_tracking WHERE status = ?', ['completed']);
    const members = await get("SELECT COUNT(*) as count FROM souls_won WHERE follow_up_status IN ('active_member','joined_church')");
    return { visitors: visitors.count, saved: saved.count, followed_up: followedUp.count, baptized: baptized.count, members: members.count };
  },
  getEvangelismMonthlyReport: (year) => all(usePostgres ? `
    SELECT EXTRACT(MONTH FROM date_saved) as month,
      COUNT(*) as souls_won,
      COUNT(*) FILTER (WHERE follow_up_status IN ('joined_cell','joined_church','active_member')) as members_added
    FROM souls_won
    WHERE EXTRACT(YEAR FROM date_saved) = $1
    GROUP BY month ORDER BY month
  ` : `
    SELECT ${monthOnly('date_saved')} as month,
      COUNT(*) as souls_won,
      SUM(CASE WHEN follow_up_status IN ('joined_cell','joined_church','active_member') THEN 1 ELSE 0 END) as members_added
    FROM souls_won
    WHERE ${yearOnly('date_saved')} = ?
    GROUP BY month ORDER BY month
  `, [String(year)]),
  getEvangelismAnnualStats: (year) => get(usePostgres ? `
    SELECT COUNT(*) as souls_won,
      COUNT(*) FILTER (WHERE follow_up_status IN ('joined_cell','joined_church','active_member')) as members_added
    FROM souls_won
    WHERE EXTRACT(YEAR FROM date_saved) = $1
  ` : `
    SELECT COUNT(*) as souls_won,
      SUM(CASE WHEN follow_up_status IN ('joined_cell','joined_church','active_member') THEN 1 ELSE 0 END) as members_added
    FROM souls_won
    WHERE ${yearOnly('date_saved')} = ?
  `, [String(year)]),

  // ── Contribution Types ──────────────────────────────────────────────────
  getContributionTypes: () => all('SELECT * FROM contribution_types ORDER BY sort_order, name'),

  getContributionTypeById: (id) => get('SELECT * FROM contribution_types WHERE id = ?', [id]),

  createContributionType: ({ name, description, sort_order }) => run(
    'INSERT INTO contribution_types (name, description, sort_order) VALUES (?, ?, ?)',
    [name, description, sort_order]
  ),

  updateContributionType: (id, { name, description, is_active, sort_order }) => {
    const SET = [], params = [];
    if (name !== undefined) { SET.push('name=?'); params.push(name); }
    if (description !== undefined) { SET.push('description=?'); params.push(description); }
    if (is_active !== undefined) { SET.push('is_active=?'); params.push(is_active); }
    if (sort_order !== undefined) { SET.push('sort_order=?'); params.push(sort_order); }
    SET.push('updated_at=CURRENT_TIMESTAMP');
    params.push(id);
    return run(`UPDATE contribution_types SET ${SET.join(', ')} WHERE id=?`, params);
  },

  deleteContributionType: (id) => run('DELETE FROM contribution_types WHERE id = ?', [id]),

  // ── Contributions ───────────────────────────────────────────────────────
  getContributions: (filters = {}) => {
    const WHERE = [], params = [];
    if (filters.member_id) { WHERE.push('c.member_id=?'); params.push(filters.member_id); }
    if (filters.leader_id) { WHERE.push('m.leader_id=?'); params.push(filters.leader_id); }
    if (filters.contribution_type_id) {
      if (Array.isArray(filters.contribution_type_id)) {
        const placeholders = filters.contribution_type_id.map(() => '?').join(',');
        WHERE.push(`c.contribution_type_id IN (${placeholders})`);
        params.push(...filters.contribution_type_id);
      } else {
        WHERE.push('c.contribution_type_id=?');
        params.push(filters.contribution_type_id);
      }
    }
    if (filters.payment_method) { WHERE.push('c.payment_method=?'); params.push(filters.payment_method); }
    if (filters.date_from) { WHERE.push('c.payment_date>=?'); params.push(filters.date_from); }
    if (filters.date_to) { WHERE.push('c.payment_date<=?'); params.push(filters.date_to); }
    const where = WHERE.length ? `WHERE ${WHERE.join(' AND ')}` : '';
    return all(`
      SELECT c.*, ct.name as contribution_type_name, m.full_name, m.email, m.phone
      FROM contributions c
      LEFT JOIN contribution_types ct ON ct.id = c.contribution_type_id
      LEFT JOIN members m ON m.id = c.member_id
      ${where}
      ORDER BY c.payment_date DESC, c.created_at DESC
    `, params);
  },

  getContributionById: (id) => get(`
    SELECT c.*, ct.name as contribution_type_name, m.full_name, m.email, m.phone
    FROM contributions c
    LEFT JOIN contribution_types ct ON ct.id = c.contribution_type_id
    LEFT JOIN members m ON m.id = c.member_id
    WHERE c.id=?
  `, [id]),

  createContribution: (data) => run(`
    INSERT INTO contributions (member_id, contribution_type_id, amount, payment_date, payment_method, reference_number, notes, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [data.member_id, data.contribution_type_id, data.amount, data.payment_date, data.payment_method, data.reference_number, data.notes, data.recorded_by]),

  updateContribution: (id, data) => {
    const SET = [], params = [];
    if (data.member_id !== undefined) { SET.push('member_id=?'); params.push(data.member_id); }
    if (data.contribution_type_id !== undefined) { SET.push('contribution_type_id=?'); params.push(data.contribution_type_id); }
    if (data.amount !== undefined) { SET.push('amount=?'); params.push(data.amount); }
    if (data.payment_date !== undefined) { SET.push('payment_date=?'); params.push(data.payment_date); }
    if (data.payment_method !== undefined) { SET.push('payment_method=?'); params.push(data.payment_method); }
    if (data.reference_number !== undefined) { SET.push('reference_number=?'); params.push(data.reference_number); }
    if (data.notes !== undefined) { SET.push('notes=?'); params.push(data.notes); }
    SET.push('updated_at=CURRENT_TIMESTAMP');
    params.push(id);
    return run(`UPDATE contributions SET ${SET.join(', ')} WHERE id=?`, params);
  },

  deleteContribution: (id) => run('DELETE FROM contributions WHERE id = ?', [id]),

  getContributionSummary: (filters = {}) => {
    const WHERE = [], params = [];
    if (filters.date_from) { WHERE.push('c.payment_date>=?'); params.push(filters.date_from); }
    if (filters.date_to) { WHERE.push('c.payment_date<=?'); params.push(filters.date_to); }
    if (filters.contribution_type_id) {
      if (Array.isArray(filters.contribution_type_id)) {
        const placeholders = filters.contribution_type_id.map(() => '?').join(',');
        WHERE.push(`c.contribution_type_id IN (${placeholders})`);
        params.push(...filters.contribution_type_id);
      } else {
        WHERE.push('c.contribution_type_id=?');
        params.push(filters.contribution_type_id);
      }
    }
    if (filters.member_id) { WHERE.push('c.member_id=?'); params.push(filters.member_id); }
    const where = WHERE.length ? `WHERE ${WHERE.join(' AND ')}` : '';
    return all(`
      SELECT ct.id as type_id, ct.name as type_name,
        COUNT(c.id) as count, SUM(c.amount) as total,
        MIN(c.amount) as min_amount, MAX(c.amount) as max_amount
      FROM contributions c
      JOIN contribution_types ct ON ct.id = c.contribution_type_id
      ${where}
      GROUP BY ct.id, ct.name
      ORDER BY ct.sort_order, ct.name
    `, params);
  },

  getContributionsByDateRange: (from, to) => all(`
    SELECT c.*, ct.name as contribution_type_name, m.full_name
    FROM contributions c
    LEFT JOIN contribution_types ct ON ct.id = c.contribution_type_id
    LEFT JOIN members m ON m.id = c.member_id
    WHERE c.payment_date >= ? AND c.payment_date <= ?
    ORDER BY c.payment_date DESC
  `, [from, to]),

  // ── Finance Daily Records ──────────────────────────────────────────────
  getFinanceRecords: (filters = {}) => {
    const WHERE = [], params = [];
    if (filters.status) { WHERE.push('f.status=?'); params.push(filters.status); }
    if (filters.created_by) { WHERE.push('f.created_by=?'); params.push(filters.created_by); }
    if (filters.date_from) { WHERE.push('f.record_date>=?'); params.push(filters.date_from); }
    if (filters.date_to) { WHERE.push('f.record_date<=?'); params.push(filters.date_to); }
    const where = WHERE.length ? `WHERE ${WHERE.join(' AND ')}` : '';
    return all(`
      SELECT f.*,
        (SELECT COALESCE(SUM(amount), 0) FROM finance_expenses WHERE record_id = f.id) as total_expenses,
        u.full_name as created_by_name, sb.full_name as submitted_by_name, ap.full_name as approved_by_name
      FROM finance_daily_records f
      LEFT JOIN users u ON u.id = f.created_by
      LEFT JOIN users sb ON sb.id = f.submitted_by
      LEFT JOIN users ap ON ap.id = f.approved_by
      ${where}
      ORDER BY f.record_date DESC
    `, params);
  },

  getFinanceRecordById: (id) => get(`
    SELECT f.*,
      (SELECT COALESCE(SUM(amount), 0) FROM finance_expenses WHERE record_id = f.id) as total_expenses,
      u.full_name as created_by_name, sb.full_name as submitted_by_name, ap.full_name as approved_by_name
    FROM finance_daily_records f
    LEFT JOIN users u ON u.id = f.created_by
    LEFT JOIN users sb ON sb.id = f.submitted_by
    LEFT JOIN users ap ON ap.id = f.approved_by
    WHERE f.id = ?
  `, [id]),

  createFinanceRecord: (data) => run(`
    INSERT INTO finance_daily_records (record_date, morning_offering, afternoon_offering, total_tithes,
      total_income, mission_fund, remaining_after_mission, bishop_fund, usable_church_funds, evangelism_offering, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [data.record_date, data.morning_offering, data.afternoon_offering, data.total_tithes,
    data.total_income, data.mission_fund, data.remaining_after_mission, data.bishop_fund, data.usable_church_funds,
    data.evangelism_offering || 0, data.notes, data.created_by]),

  updateFinanceRecord: (id, data) => {
    const SET = [], params = [];
    if (data.record_date !== undefined) { SET.push('record_date=?'); params.push(data.record_date); }
    if (data.morning_offering !== undefined) { SET.push('morning_offering=?'); params.push(data.morning_offering); }
    if (data.afternoon_offering !== undefined) { SET.push('afternoon_offering=?'); params.push(data.afternoon_offering); }
    if (data.total_tithes !== undefined) { SET.push('total_tithes=?'); params.push(data.total_tithes); }
    if (data.total_income !== undefined) { SET.push('total_income=?'); params.push(data.total_income); }
    if (data.mission_fund !== undefined) { SET.push('mission_fund=?'); params.push(data.mission_fund); }
    if (data.remaining_after_mission !== undefined) { SET.push('remaining_after_mission=?'); params.push(data.remaining_after_mission); }
    if (data.bishop_fund !== undefined) { SET.push('bishop_fund=?'); params.push(data.bishop_fund); }
    if (data.usable_church_funds !== undefined) { SET.push('usable_church_funds=?'); params.push(data.usable_church_funds); }
    if (data.status !== undefined) { SET.push('status=?'); params.push(data.status); }
    if (data.rejection_reason !== undefined) { SET.push('rejection_reason=?'); params.push(data.rejection_reason); }
    if (data.evangelism_offering !== undefined) { SET.push('evangelism_offering=?'); params.push(data.evangelism_offering); }
    if (data.notes !== undefined) { SET.push('notes=?'); params.push(data.notes); }
    if (data.bishop_receipt !== undefined) { SET.push('bishop_receipt=?'); params.push(data.bishop_receipt); }
    if (data.evangelism_receipt !== undefined) { SET.push('evangelism_receipt=?'); params.push(data.evangelism_receipt); }
    if (data.remaining_receipt !== undefined) { SET.push('remaining_receipt=?'); params.push(data.remaining_receipt); }
    SET.push('updated_at=CURRENT_TIMESTAMP');
    params.push(id);
    return run(`UPDATE finance_daily_records SET ${SET.join(', ')} WHERE id=?`, params);
  },

  deleteFinanceRecord: (id) => run('DELETE FROM finance_daily_records WHERE id = ?', [id]),

  submitFinanceRecord: (id, userId) => run(`
    UPDATE finance_daily_records SET status='submitted', submitted_at=CURRENT_TIMESTAMP, submitted_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `, [userId, id]),

  approveFinanceRecord: (id, userId) => run(`
    UPDATE finance_daily_records SET status='approved', approved_at=CURRENT_TIMESTAMP, approved_by=?, rejection_reason=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `, [userId, id]),

  rejectFinanceRecord: (id, userId, reason) => run(`
    UPDATE finance_daily_records SET status='rejected', approved_at=CURRENT_TIMESTAMP, approved_by=?, rejection_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `, [userId, reason, id]),

  // ── Finance Expenses ────────────────────────────────────────────────────
  getFinanceExpenses: (recordId) => all(`
    SELECT * FROM finance_expenses WHERE record_id = ? ORDER BY category, created_at
  `, [recordId]),

  createFinanceExpense: (data) => run(`
    INSERT INTO finance_expenses (record_id, category, amount, description, receipt_path) VALUES (?, ?, ?, ?, ?)
  `, [data.record_id, data.category, data.amount, data.description, data.receipt_path || null]),

  updateFinanceExpense: (id, data) => run(`
    UPDATE finance_expenses SET category=?, amount=?, description=?, receipt_path=? WHERE id=?
  `, [data.category, data.amount, data.description, data.receipt_path || null, id]),

  deleteFinanceExpense: (id) => run('DELETE FROM finance_expenses WHERE id = ?', [id]),

  updateFinanceExpenseReceipt: (id, receiptPath) => run(`
    UPDATE finance_expenses SET receipt_path=? WHERE id=?
  `, [receiptPath, id]),

  // ── Finance Reports ─────────────────────────────────────────────────────
  getFinanceSubmissions: (status) => {
    const where = status ? 'WHERE f.status=?' : '';
    const params = status ? [status] : [];
    return all(`
      SELECT f.*, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM finance_expenses WHERE record_id = f.id) as expense_count,
        (SELECT COALESCE(SUM(amount), 0) FROM finance_expenses WHERE record_id = f.id) as total_expenses
      FROM finance_daily_records f
      LEFT JOIN users u ON u.id = f.created_by
      ${where}
      ORDER BY f.updated_at DESC
    `, params);
  },

  getFinanceSummary: (dateFrom, dateTo) => {
    const WHERE = ['f.record_date>=?', 'f.record_date<=?'];
    return get(`
      SELECT
        COUNT(*) as day_count,
        COALESCE(SUM(f.morning_offering), 0) as total_morning,
        COALESCE(SUM(f.afternoon_offering), 0) as total_afternoon,
        COALESCE(SUM(f.total_tithes), 0) as total_tithes,
        COALESCE(SUM(f.total_income), 0) as total_income,
        COALESCE(SUM(f.mission_fund), 0) as total_mission,
        COALESCE(SUM(f.bishop_fund), 0) as total_bishop,
        COALESCE(SUM(f.usable_church_funds), 0) as total_usable,
        COALESCE(SUM((SELECT COALESCE(SUM(amount), 0) FROM finance_expenses WHERE record_id = f.id)), 0) as total_expenses
      FROM finance_daily_records f
      WHERE ${WHERE.join(' AND ')}
    `, [dateFrom, dateTo]);
  },

  getFinanceYearTrend: (year) => all(`
    SELECT
      ${monthOnly('record_date')} as month,
      COUNT(*) as day_count,
      COALESCE(SUM(total_income), 0) as total_income,
      COALESCE(SUM(usable_church_funds), 0) as total_usable
    FROM finance_daily_records
    WHERE ${yearOnly('record_date')} = ? AND status IN ('submitted', 'approved')
    GROUP BY ${monthOnly('record_date')}
    ORDER BY month
  `, [String(year)]),
};

// Transaction helper
async function transaction(callback) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) return reject(err);
        try {
          const result = callback({ run, get, all });
          // If callback returns a promise, wait for it before committing
          Promise.resolve(result)
            .then((resolvedResult) => {
              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
                resolve(resolvedResult);
              });
            })
            .catch((err) => {
              db.run('ROLLBACK');
              reject(err);
            });
        } catch (err) {
          db.run('ROLLBACK');
          reject(err);
        }
      });
    });
  });
}

module.exports = {
  db,
  queries,
  run,
  get,
  // ── Multi-Period Executive Comparison Queries ────────────────────────
  getMultiPeriodOverall: (start, end) => get(`
    SELECT
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'present'), 0) as present,
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'absent'), 0) as absent,
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'excused'), 0) as excused,
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ?), 0) as total_attendees,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active = 1), 0) as total_members,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE date BETWEEN ? AND ?), 0) as total_records,
      COALESCE((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 0) as service_days,
      COALESCE((SELECT ROUND(AVG(CASE WHEN status='present' THEN 1.0 ELSE 0.0 END)*100, 1) FROM attendance WHERE date BETWEEN ? AND ?), 0) as attendance_rate,
      COALESCE((SELECT COUNT(DISTINCT m.section_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE a.date BETWEEN ? AND ?), 0) as active_sections,
      COALESCE((SELECT COUNT(DISTINCT leader_id) FROM submission_log WHERE date BETWEEN ? AND ?), 0) as leaders_submitted,
      COALESCE((SELECT COUNT(*) FROM leaders WHERE is_active = 1), 0) as total_leaders,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at <= ?), 0) as registered_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE DATE(last_contacted_at) BETWEEN ? AND ?), 0) as members_contacted,
      COALESCE(ROUND((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM members WHERE is_active=1), 0), 1), 0) as retention_rate,
      COALESCE(ROUND((SELECT AVG(engagement) FROM (
        SELECT m.id, COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) * 1.0 /
          NULLIF((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 1) as engagement
        FROM members m WHERE m.is_active=1
      )), 2), 0) as engagement_score,
      COALESCE((SELECT COUNT(*) FROM visitor_intake WHERE created_at BETWEEN ? AND ?), 0) as visitors,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_registrations,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND status='Active'), 0) as active_member_count,
      COALESCE((SELECT COUNT(*) FROM absent_followups WHERE created_at BETWEEN ? AND ? AND contacted=1), 0) as followups_completed,
      COALESCE((SELECT COUNT(*) FROM absent_followups WHERE absence_date BETWEEN ? AND ?), 0) as total_followups_needed,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?) -
        (SELECT COUNT(*) FROM members WHERE is_active=0 AND soft_deleted_at BETWEEN ? AND ?), 0) as net_growth
    `, [start, end, start, end, start, end, start, end, start, end, start, end,
        start, end, start, end, start, end,
        end,
        start, end, start, end, start, end, start, end, start, end,
        start, end, start, end, start, end, start, end, start, end,
        start, end]),

  getMultiPeriodSections: (start, end) => all(`
    SELECT
      s.id, s.name,
      COALESCE((SELECT COUNT(*) FROM members WHERE section_id=s.id AND is_active=1), 0) as members,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ? AND a.status='present'), 0) as present,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ? AND a.status='absent'), 0) as absent,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ? AND a.status='excused'), 0) as excused,
      COALESCE(ROUND((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ? AND a.status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM members WHERE section_id=s.id AND is_active=1), 0), 1), 0) as attendance_rate,
      COALESCE((SELECT COUNT(*) FROM submission_log sl JOIN leaders l ON sl.leader_id=l.id WHERE l.section_id=s.id AND sl.date BETWEEN ? AND ?), 0) as submissions,
      COALESCE((SELECT COUNT(DISTINCT date) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ?), 0) as service_days,
      COALESCE((SELECT COUNT(*) FROM absent_followups af JOIN members m ON af.member_id=m.id WHERE m.section_id=s.id AND af.absence_date BETWEEN ? AND ? AND af.contacted=1), 0) as followups_completed,
      COALESCE((SELECT COUNT(*) FROM absent_followups af JOIN members m ON af.member_id=m.id WHERE m.section_id=s.id AND af.absence_date BETWEEN ? AND ?), 0) as followups_needed,
      COALESCE((SELECT COUNT(*) FROM members WHERE section_id=s.id AND is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE section_id=s.id AND is_active=1 AND last_contacted_at BETWEEN ? AND ?), 0) as members_contacted
    FROM sections s WHERE s.id IN (SELECT DISTINCT section_id FROM members WHERE is_active=1)
    ORDER BY attendance_rate DESC
  `, [start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end]),

  getMultiPeriodLeaders: (start, end) => all(`
    SELECT
      l.id, u.full_name as leader_name, s.name as section_name,
      COALESCE((SELECT COUNT(*) FROM members WHERE leader_id=l.id AND is_active=1), 0) as assigned_members,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.leader_id=l.id AND a.date BETWEEN ? AND ? AND a.status='present'), 0) as present,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.leader_id=l.id AND a.date BETWEEN ? AND ?), 0) as total_attendees,
      COALESCE(ROUND((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.leader_id=l.id AND a.date BETWEEN ? AND ? AND a.status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM members WHERE leader_id=l.id AND is_active=1), 0), 1), 0) as attendance_rate,
      COALESCE(ROUND((SELECT COUNT(*) FROM submission_log WHERE leader_id=l.id AND date BETWEEN ? AND ?) * 100.0 /
        NULLIF((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 1), 1), 0) as submission_rate,
      COALESCE((SELECT COUNT(*) FROM absent_followups WHERE leader_id=l.id AND absence_date BETWEEN ? AND ? AND contacted=1), 0) as followups_completed,
      COALESCE((SELECT COUNT(*) FROM absent_followups WHERE leader_id=l.id AND absence_date BETWEEN ? AND ?), 0) as followups_needed,
      COALESCE((SELECT COUNT(*) FROM members WHERE leader_id=l.id AND is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE leader_id=l.id AND is_active=1 AND last_contacted_at BETWEEN ? AND ?), 0) as members_contacted,
      COALESCE(ROUND((SELECT COUNT(*) FROM absent_followups WHERE leader_id=l.id AND absence_date BETWEEN ? AND ? AND contacted=1) * 100.0 /
        NULLIF((SELECT COUNT(*) FROM absent_followups WHERE leader_id=l.id AND absence_date BETWEEN ? AND ?), 0), 1), 100) as follow_up_completion
    FROM leaders l
    JOIN users u ON u.id = l.user_id
    JOIN sections s ON s.id = l.section_id
    WHERE l.is_active = 1
    ORDER BY attendance_rate DESC
  `, [start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end]),

  getMultiPeriodDepartments: (start, end) => all(`
    SELECT
      d.id, d.name,
      COALESCE((SELECT COUNT(*) FROM department_members WHERE department_id=d.id), 0) as members,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a
        JOIN department_members dm ON dm.member_id=a.member_id
        WHERE dm.department_id=d.id AND a.date BETWEEN ? AND ? AND a.status='present'), 0) as present,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a
        JOIN department_members dm ON dm.member_id=a.member_id
        WHERE dm.department_id=d.id AND a.date BETWEEN ? AND ?), 0) as total,
      COALESCE(ROUND((SELECT COUNT(DISTINCT a.member_id) FROM attendance a
        JOIN department_members dm ON dm.member_id=a.member_id
        WHERE dm.department_id=d.id AND a.date BETWEEN ? AND ? AND a.status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM department_members WHERE department_id=d.id), 0), 1), 0) as attendance_rate
    FROM departments d WHERE d.is_active=1
    ORDER BY attendance_rate DESC
  `, [start, end, start, end, start, end]),

  getMultiPeriodMembers: (start, end) => all(`
    SELECT
      m.id, m.full_name, m.gender, m.age_group, m.status,
      s.name as section_name,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) as present_count,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='absent'), 0) as absent_count,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='excused'), 0) as excused_count,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ?), 0) as total_attendances,
      COALESCE(ROUND((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ?), 0), 1), 0) as attendance_rate,
      COALESCE((SELECT date FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? ORDER BY date DESC LIMIT 1), 'never') as last_attendance,
      CASE
        WHEN COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) = 0 THEN 'critical'
        WHEN COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) * 1.0 /
          NULLIF((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 1) < 0.3 THEN 'high'
        WHEN COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) * 1.0 /
          NULLIF((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 1) < 0.6 THEN 'medium'
        ELSE 'low'
      END as risk_level
    FROM members m
    JOIN sections s ON s.id = m.section_id
    WHERE m.is_active = 1
    ORDER BY attendance_rate DESC
  `, [start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end]),

  getAttendanceMovement: (start, end) => get(`
    SELECT
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE soft_deleted_at BETWEEN ? AND ?), 0) as members_lost,
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status='present' AND member_id NOT IN
        (SELECT DISTINCT member_id FROM attendance WHERE date < ? AND status='present')), 0) as returning_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?) -
        (SELECT COUNT(*) FROM members WHERE soft_deleted_at BETWEEN ? AND ?), 0) as net_membership_growth,
      COALESCE((SELECT COUNT(*) FROM visitor_intake WHERE created_at BETWEEN ? AND ? AND status='converted'), 0) as visitors_converted
    `, [start, end, start, end, start, end, start, start, end, start, end, start, end]),
  all,
  transaction,
  ensureHomeCellSchema,
  ensureEvangelismSchema,
  migrateUsersRoleConstraint,
  linkUsersToMembers
};
