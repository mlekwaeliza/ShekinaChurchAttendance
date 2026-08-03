const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
      role TEXT NOT NULL CHECK(role IN ('admin', 'leader', 'pastor', 'evangelist', 'accountant', 'children_leader')),
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
      profile_picture TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_followups_absence_date ON absent_followups(absence_date);
    CREATE INDEX IF NOT EXISTS idx_followups_created ON absent_followups(created_at);
    CREATE INDEX IF NOT EXISTS idx_visitor_intake_created ON visitor_intake(created_at);

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

    // Migration: Add profile_picture to members if it doesn't exist
    db.run(`ALTER TABLE members ADD COLUMN profile_picture TEXT`, (err) => {
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

    db.run(
      `ALTER TABLE attendance ADD COLUMN service_type_id INTEGER REFERENCES service_types(id)`,
      (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.log('Migration note:', err.message);
        }
      }
    );

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

    db.run(
      `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `,
      (err) => {
        if (!err) {
          db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('points_attendance', '10')`);
          db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('points_excused', '3')`);
          db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('midweek_day', 'Wednesday')`);

          // Performance Center - Member Weights
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_church_attendance', '30')`
          );
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_cell_attendance', '20')`
          );
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_evangelism', '15')`
          );
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_contributions', '10')`
          );
          db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_member_events', '5')`);

          // Performance Center - Leader Weights
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_submission_rate', '20')`
          );
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_member_attendance', '20')`
          );
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_retention', '15')`
          );
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_cell_growth', '15')`
          );
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_evangelism', '10')`
          );
          db.run(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_followups', '10')`
          );
          db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('perf_leader_reports', '5')`);
        }
      }
    );

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
            name: "Women's Service",
            day: 'Thursday',
            rules: JSON.stringify({ gender: 'Female', sections: ["Women's Ministry"] }),
            points: JSON.stringify({ present: 5, excused: 3 })
          },
          {
            name: 'Prayer Service',
            day: 'Friday',
            rules: JSON.stringify({}),
            points: JSON.stringify({ present: 5, excused: 3 })
          }
        ];

        defaults.forEach((d) => {
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
        const defaults = [
          'Tithes',
          'Evangelism Offering',
          'Offerings',
          'First Fruit',
          'Building Fund',
          'Missions',
          'Thanksgiving',
          'Project'
        ];
        defaults.forEach((name, i) => {
          db.run('INSERT OR IGNORE INTO contribution_types (name, sort_order) VALUES (?, ?)', [
            name,
            i
          ]);
        });
      }
    });

    // Data cleanup: Map old service_type text to service_type_id
    db.run(
      `UPDATE attendance SET service_type_id = 1 WHERE service_type_id IS NULL AND (service_type IN ('main', 'morning', 'evening') OR service_type IS NULL)`
    );
    db.run(
      `UPDATE attendance SET service_type_id = 3 WHERE service_type_id IS NULL AND service_type IN ('youth_service', 'midweek')`
    );
    db.run(
      `UPDATE attendance SET service_type_id = 2 WHERE service_type_id IS NULL AND service_type = 'leaders_gathering'`
    );
    db.run(
      `UPDATE attendance SET service_type_id = 4 WHERE service_type_id IS NULL AND service_type = 'women_service'`
    );
    db.run(
      `UPDATE attendance SET service_type_id = 5 WHERE service_type_id IS NULL AND service_type = 'prayer_service'`
    );

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
    db.run(
      `ALTER TABLE users ADD COLUMN member_id INTEGER REFERENCES members(id) ON DELETE SET NULL`,
      (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.log('Migration note:', err.message);
        }
      }
    );
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL`,
      (err) => {
        if (err) console.log('Migration note:', err.message);
      }
    );

    // Migration: Create outreach_logs table (updated schema)
    db.run(
      `CREATE TABLE IF NOT EXISTS outreach_logs (
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
  )`,
      (err) => {
        if (err && !err.message.includes('already exists')) {
          console.log('Migration note:', err.message);
        }
      }
    );

    db.run(`CREATE INDEX IF NOT EXISTS idx_outreach_leader ON outreach_logs(leader_id)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_outreach_member ON outreach_logs(member_id)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_outreach_week ON outreach_logs(week_start)`, () => {});
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_outreach_leader_week ON outreach_logs(leader_id, week_start)`,
      () => {}
    );

    // Migration: Create scheduled_reminders table
    db.run(
      `CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('submission_reminder', 'follow_up_reminder', 'birthday_greeting', 'weekly_summary')),
    entity_type TEXT,
    entity_id INTEGER,
    scheduled_for DATETIME NOT NULL,
    sent BOOLEAN DEFAULT 0,
    sent_at DATETIME,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
      (err) => {
        if (err && !err.message.includes('already exists')) {
          console.log('Migration note:', err.message);
        }
      }
    );

    db.run(
      `CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON scheduled_reminders(scheduled_for, sent)`,
      () => {}
    );
    db.run(`CREATE INDEX IF NOT EXISTS idx_reminders_type ON scheduled_reminders(type)`, () => {});

    // Migration: Pastoral Care Command Center Additions
    db.run(`ALTER TABLE members ADD COLUMN last_contacted_at DATETIME`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message);
    });
    db.run(
      `ALTER TABLE members ADD COLUMN last_contacted_by INTEGER REFERENCES users(id)`,
      (err) => {
        if (err && !err.message.includes('duplicate column'))
          console.log('Migration:', err.message);
      }
    );
    db.run(`ALTER TABLE members ADD COLUMN prayer_requests TEXT DEFAULT '[]'`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message);
    });
    db.run(`ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'Active'`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message);
    });
    db.run(`ALTER TABLE members ADD COLUMN flags TEXT DEFAULT '[]'`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message);
    });
    db.run(`ALTER TABLE members ADD COLUMN soft_deleted_at DATETIME`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message);
    });
    db.run(`ALTER TABLE members ADD COLUMN pending_deletion_at DATETIME`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message);
    });
    db.run(`ALTER TABLE members ADD COLUMN deletion_confirmed_at DATETIME`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.log('Migration:', err.message);
    });
    db.run(
      `ALTER TABLE members ADD COLUMN deletion_confirmed_by INTEGER REFERENCES users(id)`,
      (err) => {
        if (err && !err.message.includes('duplicate column'))
          console.log('Migration:', err.message);
      }
    );
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_members_pending_deletion ON members(soft_deleted_at, pending_deletion_at) WHERE is_active = 0`,
      (err) => {
        if (err) console.log('Migration:', err.message);
      }
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS pastoral_care_queue (
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
  )`,
      (err) => {
        if (err && !err.message.includes('already exists')) console.log(err.message);
      }
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS hall_of_fame_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    outreach_log_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  )`,
      (err) => {
        if (err && !err.message.includes('already exists')) console.log(err.message);
      }
    );

    // Complex Migration: Rebuilding outreach_logs to support expanded check constraints
    db.all('PRAGMA table_info(outreach_logs)', (err, cols) => {
      if (!err && cols) {
        const hasOutcome = cols.some((c) => c.name === 'outcome');
        if (!hasOutcome) {
          console.log('Migrating outreach_logs schema...');
          db.serialize(() => {
            db.run('PRAGMA foreign_keys=off;');
            db.run('BEGIN TRANSACTION;');
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
            db.run('DROP TABLE outreach_logs');
            db.run('ALTER TABLE outreach_logs_new RENAME TO outreach_logs');

            db.run('CREATE INDEX IF NOT EXISTS idx_outreach_leader ON outreach_logs(leader_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_outreach_member ON outreach_logs(member_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_outreach_week ON outreach_logs(week_start)');
            db.run(
              'CREATE INDEX IF NOT EXISTS idx_outreach_leader_week ON outreach_logs(leader_id, week_start)'
            );

            db.run('COMMIT;');
            db.run('PRAGMA foreign_keys=on;');
            console.log('outreach_logs schema migration complete.');
          });
        }
      }
    });

    // Migration: Ensure Evangelism Offering contribution type exists
    db.run(
      `INSERT OR IGNORE INTO contribution_types (name, description, sort_order) VALUES ('Evangelism Offering', 'Dedicated offering for evangelism ministry', 1)`,
      (err) => {
        if (err) console.log('Migration note (evangelism offering):', err.message);
      }
    );

    // Migration: Add evangelism_offering and receipt columns to finance_daily_records
    const financeMigrations = [
      `ALTER TABLE finance_daily_records ADD COLUMN evangelism_offering REAL DEFAULT 0`,
      `ALTER TABLE finance_daily_records ADD COLUMN bishop_receipt TEXT`,
      `ALTER TABLE finance_daily_records ADD COLUMN evangelism_receipt TEXT`,
      `ALTER TABLE finance_daily_records ADD COLUMN remaining_receipt TEXT`
    ];
    financeMigrations.forEach((sql) => {
      db.run(sql, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.log('Migration note (finance):', err.message);
        }
      });
    });

    // Migration: Recompute finance totals — evangelism_offering must NOT be part of total_income
    // (was incorrectly included, inflating total/mission/bishop/usable for records with evangelism)
    db.run(
      `
    UPDATE finance_daily_records
    SET total_income = morning_offering + afternoon_offering + total_tithes,
        mission_fund = ROUND((morning_offering + afternoon_offering + total_tithes) * 0.1, 2),
        remaining_after_mission = ROUND((morning_offering + afternoon_offering + total_tithes) * 0.9, 2),
        bishop_fund = ROUND((morning_offering + afternoon_offering + total_tithes) * 0.9 * 0.1, 2),
        usable_church_funds = ROUND((morning_offering + afternoon_offering + total_tithes) * 0.9 * 0.9, 2)
    WHERE evangelism_offering > 0
      AND ABS(total_income - (morning_offering + afternoon_offering + total_tithes + evangelism_offering)) < 0.01
  `,
      (err) => {
        if (err) console.log('Migration note (finance recompute):', err.message);
        else console.log('Finance totals recomputed (evangelism excluded from formula).');
      }
    );
  });
}

// Helper function to promisify database operations
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
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
    await run('SELECT category FROM congregation_titles LIMIT 1');
  } catch (err) {
    needRebuild = true;
  }

  // Also check if departments table exists
  if (!needRebuild) {
    try {
      await run('SELECT id FROM departments LIMIT 1');
    } catch (err) {
      needRebuild = true;
    }
  }

  if (needRebuild) {
    console.log('Rebuilding congregation titles, member titles, and departments from scratch...');

    // Drop in correct order of foreign keys
    await run('DROP TABLE IF EXISTS department_history');
    await run('DROP TABLE IF EXISTS department_members');
    await run('DROP TABLE IF EXISTS departments');
    await run('DROP TABLE IF EXISTS member_title_history');
    await run('DROP TABLE IF EXISTS member_titles');
    await run('DROP TABLE IF EXISTS congregation_titles');

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
    await run('CREATE INDEX IF NOT EXISTS idx_member_titles_member ON member_titles(member_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_member_titles_title ON member_titles(title_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_member_titles_status ON member_titles(status)');
    await run(
      'CREATE INDEX IF NOT EXISTS idx_mt_history_member ON member_title_history(member_id, title_id)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_mt_history_created ON member_title_history(created_at)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON department_members(department_id)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_dept_members_member ON department_members(member_id)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_dept_history_dept ON department_history(department_id)'
    );

    // Helper functions for database-independent insertions
    const insertTitle = async (
      name,
      description,
      category,
      sort_order,
      reports_to_title_name = null
    ) => {
      let reports_to_title_id = null;
      if (reports_to_title_name) {
        const parent = await get('SELECT id FROM congregation_titles WHERE name = ?', [
          reports_to_title_name
        ]);
        if (parent) reports_to_title_id = parent.id;
      }
      await run(
        'INSERT INTO congregation_titles (name, description, category, sort_order, reports_to_title_id) VALUES (?, ?, ?, ?, ?)',
        [name, description, category, sort_order, reports_to_title_id]
      );
      const inserted = await get('SELECT id FROM congregation_titles WHERE name = ?', [name]);
      return inserted ? inserted.id : null;
    };

    const insertDept = async (name, description, reports_to_title_name) => {
      let reports_to_title_id = null;
      if (reports_to_title_name) {
        const parent = await get('SELECT id FROM congregation_titles WHERE name = ?', [
          reports_to_title_name
        ]);
        if (parent) reports_to_title_id = parent.id;
      }
      await run(
        'INSERT INTO departments (name, description, reports_to_title_id) VALUES (?, ?, ?)',
        [name, description, reports_to_title_id]
      );
    };

    console.log('Seeding default congregation titles and departments...');

    // Seed Titles
    await insertTitle(
      'Lead Pastor',
      'Head of the Church, overall spiritual and administrative oversight',
      'Pastoral & Spiritual Care',
      1
    );
    await insertTitle(
      'Assistant Pastor',
      'Assists the Lead Pastor in church operations and spiritual oversight',
      'Pastoral & Spiritual Care',
      2,
      'Lead Pastor'
    );
    await insertTitle(
      'Church Elder',
      'Spiritual governance and doctrinal oversight council member',
      'Pastoral & Spiritual Care',
      3,
      'Lead Pastor'
    );
    await insertTitle(
      'Prayer Pastor',
      'Oversees the prayer ministries and intercessory department',
      'Pastoral & Spiritual Care',
      4,
      'Assistant Pastor'
    );
    await insertTitle(
      'Evangelist Pastor',
      'Oversees missions, outreach, and evangelism department',
      'Pastoral & Spiritual Care',
      5,
      'Assistant Pastor'
    );
    await insertTitle(
      'Youth Pastor',
      'Oversees the youth ministry and department activities',
      'Pastoral & Spiritual Care',
      6,
      'Assistant Pastor'
    );
    await insertTitle(
      'Women Pastor',
      'Oversees the women ministry and department activities',
      'Pastoral & Spiritual Care',
      7,
      'Assistant Pastor'
    );
    await insertTitle(
      'Section Pastor',
      'Oversees geographical sections and home fellowships',
      'Pastoral & Spiritual Care',
      8,
      'Assistant Pastor'
    );
    await insertTitle(
      'Section Leader',
      'Coordinates leaders within a geographical section',
      'Small Groups & Discipleship',
      9,
      'Section Pastor'
    );
    await insertTitle(
      'Cell / Home Fellowship Leader',
      'Shepherds weekly small group fellowships in homes',
      'Small Groups & Discipleship',
      10,
      'Section Leader'
    );
    await insertTitle(
      'Department Leader',
      'Oversees departmental planning and execution',
      'Operations & Administration',
      11,
      'Assistant Pastor'
    );

    // Seed Departments
    await insertDept(
      'Prayer Department',
      'Focuses on church prayer chains, intercession, and vigils',
      'Prayer Pastor'
    );
    await insertDept(
      'Evangelism Department',
      'Outreach, missions, and community evangelism activities',
      'Evangelist Pastor'
    );
    await insertDept(
      'Youth Department',
      'Youth services, camps, and spiritual growth events',
      'Youth Pastor'
    );
    await insertDept(
      'Women Department',
      'Women fellowships, conferences, and benevolence programs',
      'Women Pastor'
    );
    await insertDept(
      'Children Department',
      'Sunday school classes, children ministry, and teacher training',
      'Assistant Pastor'
    );
    await insertDept(
      'Worship Department',
      'Choir, praise team, and instrumental music for services',
      'Assistant Pastor'
    );
    await insertDept(
      'Ushers Department',
      'Hospitality, welcoming, security, and orderly seating during services',
      'Assistant Pastor'
    );
    await insertDept(
      'Protocol Department',
      'Distinguished guest hosting, security, and pastor logistics support',
      'Assistant Pastor'
    );
    await insertDept(
      'Media Department',
      'Audio, video production, photography, projection, and livestreaming',
      'Assistant Pastor'
    );
    await insertDept(
      'Finance Department',
      'Tithes, offerings, budget oversight, and church financial planning',
      'Lead Pastor'
    );
    await insertDept(
      'Development Department',
      'Church building maintenance, capital projects, and estate planning',
      'Lead Pastor'
    );
    await insertDept(
      'New Members Department',
      'Visitor follow-up, foundation classes, and baptism classes coordination',
      'Assistant Pastor'
    );

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
        role TEXT NOT NULL CHECK(role IN ('admin', 'leader', 'pastor', 'evangelist', 'accountant', 'children_leader')),
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
    await run(
      `CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL`
    );
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
      await run(
        'CREATE INDEX IF NOT EXISTS idx_new_member_attendance_member ON new_member_attendance(new_member_id)'
      );
      await run('CREATE INDEX IF NOT EXISTS idx_new_members_status ON new_members(status)');
      await run('CREATE INDEX IF NOT EXISTS idx_new_members_joined ON new_members(date_joined)');

      // ── Assimilation Pipeline schema (PostgreSQL) ─────────────────────────
      // Add pipeline_stage and tracking columns to new_members
      const nmCols = [
        ['pipeline_stage', "TEXT DEFAULT 'received'"],
        ['baptism_date', 'DATE'],
        ['soul_won_id', 'INTEGER'],
        ['home_cell_id', 'INTEGER'],
        ['ministry_department_id', 'INTEGER'],
        ['orientation_start_date', 'DATE'],
        ['orientation_completion_date', 'DATE'],
        ['ministry_placement_date', 'DATE'],
        ['graduation_review_date', 'DATE'],
        ['assimilation_score', 'INTEGER DEFAULT 0'],
        ['risk_status', "TEXT DEFAULT 'low'"],
        ['next_action', 'TEXT'],
        ['next_action_date', 'DATE']
      ];
      for (const [col, def] of nmCols) {
        await run(`ALTER TABLE new_members ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {});
      }
      await run(
        'CREATE INDEX IF NOT EXISTS idx_new_members_pipeline ON new_members(pipeline_stage)'
      );

      // Journey timeline table
      await run(`
        CREATE TABLE IF NOT EXISTS new_member_stages (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          new_member_id INTEGER NOT NULL,
          stage TEXT NOT NULL,
          stage_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          recorded_by INTEGER,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await run(
        'CREATE INDEX IF NOT EXISTS idx_nm_stages_member ON new_member_stages(new_member_id)'
      );

      // Follow-up history table
      await run(`
        CREATE TABLE IF NOT EXISTS new_member_followups (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          new_member_id INTEGER NOT NULL,
          followup_type TEXT NOT NULL,
          followup_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          conducted_by INTEGER,
          notes TEXT,
          next_followup_date DATE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await run(
        'CREATE INDEX IF NOT EXISTS idx_nm_followups_member ON new_member_followups(new_member_id)'
      );
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
    await run(
      'CREATE INDEX IF NOT EXISTS idx_new_member_attendance_member ON new_member_attendance(new_member_id)'
    );
    await run('CREATE INDEX IF NOT EXISTS idx_new_members_status ON new_members(status)');
    await run('CREATE INDEX IF NOT EXISTS idx_new_members_joined ON new_members(date_joined)');

    // ── Assimilation Pipeline schema (SQLite) ──────────────────────────────
    const nmColsLite = [
      ['pipeline_stage', "TEXT DEFAULT 'received'"],
      ['baptism_date', 'DATE'],
      ['soul_won_id', 'INTEGER'],
      ['home_cell_id', 'INTEGER'],
      ['ministry_department_id', 'INTEGER'],
      ['orientation_start_date', 'DATE'],
      ['orientation_completion_date', 'DATE'],
      ['ministry_placement_date', 'DATE'],
      ['graduation_review_date', 'DATE'],
      ['assimilation_score', 'INTEGER DEFAULT 0'],
      ['risk_status', "TEXT DEFAULT 'low'"],
      ['next_action', 'TEXT'],
      ['next_action_date', 'DATE']
    ];
    for (const [col, def] of nmColsLite) {
      await run(`ALTER TABLE new_members ADD COLUMN ${col} ${def}`).catch(() => {});
    }
    await run('CREATE INDEX IF NOT EXISTS idx_new_members_pipeline ON new_members(pipeline_stage)');

    await run(`
      CREATE TABLE IF NOT EXISTS new_member_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        new_member_id INTEGER NOT NULL,
        stage TEXT NOT NULL,
        stage_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        recorded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(
      'CREATE INDEX IF NOT EXISTS idx_nm_stages_member ON new_member_stages(new_member_id)'
    );

    await run(`
      CREATE TABLE IF NOT EXISTS new_member_followups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        new_member_id INTEGER NOT NULL,
        followup_type TEXT NOT NULL,
        followup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        conducted_by INTEGER,
        notes TEXT,
        next_followup_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(
      'CREATE INDEX IF NOT EXISTS idx_nm_followups_member ON new_member_followups(new_member_id)'
    );
  }

  const service = await get('SELECT id FROM service_types WHERE LOWER(name) = LOWER(?)', [
    'Home Cell'
  ]);
  if (!service) {
    await run(
      'INSERT INTO service_types (name, default_day, eligibility_rules, points_config, is_active) VALUES (?, ?, ?, ?, 1)',
      [
        'Home Cell',
        'Tuesday',
        JSON.stringify({ home_cells: true }),
        JSON.stringify({ present: 5, excused: 3 })
      ]
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
      await run(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_new_member_leader INTEGER DEFAULT 0'
      );
      await run(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0'
      );
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ');
      await run(
        'CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL'
      );
    } catch (e) {
      console.warn('password-reset column ensure failed (non-fatal):', e.message);
    }

    try {
      await run('ALTER TABLE member_titles ADD COLUMN IF NOT EXISTS appointment_date DATE');
      await run("ALTER TABLE member_titles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'");
      await run('ALTER TABLE member_titles ADD COLUMN IF NOT EXISTS notes TEXT');
    } catch (e) {
      console.warn('member_titles column migration failed (non-fatal):', e.message);
    }

    // Members table missing columns (SQLite path adds these via ALTER TABLE
    // at line 920-929, but PostgreSQL needs them too)
    try {
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ');
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS last_contacted_by INTEGER');
      await run("ALTER TABLE members ADD COLUMN IF NOT EXISTS prayer_requests TEXT DEFAULT '[]'");
      await run("ALTER TABLE members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active'");
      await run("ALTER TABLE members ADD COLUMN IF NOT EXISTS flags TEXT DEFAULT '[]'");
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ');
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS pending_deletion_at TIMESTAMPTZ');
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS deletion_confirmed_at TIMESTAMPTZ');
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS visitor_date DATE');
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_picture TEXT');
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS education_level TEXT');
      await run('ALTER TABLE members ADD COLUMN IF NOT EXISTS secondary_phone TEXT');
      await run(
        'CREATE INDEX IF NOT EXISTS idx_members_pending_deletion ON members(soft_deleted_at, pending_deletion_at) WHERE is_active = 0'
      );
    } catch (e) {
      console.warn('members column migration failed (non-fatal):', e.message);
    }

    try {
      await run('CREATE INDEX IF NOT EXISTS idx_member_titles_status ON member_titles(status)');
    } catch (e) {
      console.warn('member_titles status index creation failed (non-fatal):', e.message);
    }

    // Leaders table missing columns (exists in postgres-schema.sql)
    try {
      await run('ALTER TABLE leaders ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1');
    } catch (e) {
      console.warn('leaders is_active column migration failed (non-fatal):', e.message);
    }

    // Additional indexes — use pool directly to bypass the enqueue queue
    // (CREATE INDEX can take minutes on large tables and would block all queries)
    // PG-only: the pool is not available in sqlite mode; running this
    // unconditionally would open a pg connection on every sqlite boot.
    if (usePostgres) {
      try {
        const pgPool = require('./db/postgres').pool;
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_attendance_service_type_id ON attendance(service_type_id)'
        );
        await pgPool.query('CREATE INDEX IF NOT EXISTS idx_leaders_user_id ON leaders(user_id)');
        await pgPool.query('CREATE INDEX IF NOT EXISTS idx_leaders_section ON leaders(section_id)');
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at)'
        );
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_submission_log_leader_id ON submission_log(leader_id)'
        );
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_submission_log_leader_date ON submission_log(leader_id, date)'
        );
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_attendance_date_service ON attendance(date, service_type_id)'
        );
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_followups_absence_date ON absent_followups(absence_date)'
        );
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_followups_created ON absent_followups(created_at)'
        );
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_visitor_intake_created ON visitor_intake(created_at)'
        );
        // Critical for leader profile: filter members by leader_id
        await pgPool.query('CREATE INDEX IF NOT EXISTS idx_members_leader ON members(leader_id)');
        // Critical for leader profile: join attendance by member_id + date range
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance(member_id, date)'
        );
        await pgPool.query(
          'CREATE INDEX IF NOT EXISTS idx_attendance_submitted_by ON attendance(submitted_by)'
        );
        await pgPool.query('CREATE INDEX IF NOT EXISTS idx_members_email ON members(email)');
        await pgPool.query('CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone)');
      } catch (e) {
        console.warn('Additional index creation failed (non-fatal):', e.message);
      }
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
      await run(
        'CREATE INDEX IF NOT EXISTS idx_contribution_types_active ON contribution_types(is_active, sort_order)'
      );
      await run('CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_id)');
      await run(
        'CREATE INDEX IF NOT EXISTS idx_contributions_type ON contributions(contribution_type_id)'
      );
      await run('CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(payment_date)');
      await run(
        'CREATE INDEX IF NOT EXISTS idx_contributions_method ON contributions(payment_method)'
      );
      await run(
        'CREATE INDEX IF NOT EXISTS idx_contributions_recorded_by ON contributions(recorded_by)'
      );
      await run(
        'CREATE INDEX IF NOT EXISTS idx_finance_records_date ON finance_daily_records(record_date)'
      );
      await run(
        'CREATE INDEX IF NOT EXISTS idx_finance_records_status ON finance_daily_records(status)'
      );
      await run(
        'CREATE INDEX IF NOT EXISTS idx_finance_records_created_by ON finance_daily_records(created_by)'
      );
      await run(
        'CREATE INDEX IF NOT EXISTS idx_finance_expenses_record ON finance_expenses(record_id)'
      );
      await run(
        'CREATE INDEX IF NOT EXISTS idx_finance_expenses_category ON finance_expenses(category)'
      );

      // Seed contribution types
      const countRow = await get('SELECT COUNT(*) as count FROM contribution_types');
      if (countRow && Number(countRow.count) === 0) {
        const types = [
          'Tithes',
          'Morning Offering',
          'Afternoon Offering',
          'Building Fund',
          'Other'
        ];
        for (let i = 0; i < types.length; i++) {
          await run(
            'INSERT INTO contribution_types (name, sort_order) VALUES (?, ?) ON CONFLICT (name) DO NOTHING',
            [types[i], i]
          );
        }
      }
      await run(
        "INSERT INTO contribution_types (name, description, sort_order) VALUES ('Evangelism Offering', 'Dedicated offering for evangelism ministry', 1) ON CONFLICT (name) DO NOTHING"
      );

      // Migration: Recompute finance totals — evangelism_offering must NOT be part of total_income
      await run(`
        UPDATE finance_daily_records
        SET total_income = morning_offering + afternoon_offering + total_tithes,
            mission_fund = ROUND((morning_offering + afternoon_offering + total_tithes) * 0.1, 2),
            remaining_after_mission = ROUND((morning_offering + afternoon_offering + total_tithes) * 0.9, 2),
            bishop_fund = ROUND((morning_offering + afternoon_offering + total_tithes) * 0.9 * 0.1, 2),
            usable_church_funds = ROUND((morning_offering + afternoon_offering + total_tithes) * 0.9 * 0.9, 2)
        WHERE evangelism_offering > 0
          AND ABS(total_income - (morning_offering + afternoon_offering + total_tithes + evangelism_offering)) < 0.01
      `)
        .then(() => {
          console.log('Finance totals recomputed (evangelism excluded from formula).');
        })
        .catch(() => {});
    } catch (e) {
      console.warn(
        'Finance/contribution table initialization failed (fatal for finance features):',
        e.message
      );
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
      await run(
        `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'leader', 'pastor', 'evangelist', 'accountant', 'children_leader'))`
      );
      await run(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id INTEGER REFERENCES members(id) ON DELETE SET NULL`
      );
      console.log('PostgreSQL users role constraint migrated.');
    } else {
      const row = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`);
      if (
        row &&
        row.sql &&
        (!row.sql.includes('children_leader') || !row.sql.includes('accountant'))
      ) {
        await run(`PRAGMA foreign_keys=OFF`);
        await run(`BEGIN TRANSACTION`);
        await run(`CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'leader', 'pastor', 'evangelist', 'accountant', 'children_leader')),
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
        await run(
          `CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL`
        );
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
    const users = await all('SELECT id, full_name, member_id FROM users WHERE member_id IS NULL');
    let linked = 0;
    for (const user of users) {
      if (!user.full_name) continue;
      // Split name into parts and build a LIKE search
      const parts = user.full_name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) continue;
      const conditions = parts
        .map((p) => `full_name LIKE '%${p.replace(/'/g, "''")}%'`)
        .join(' AND ');
      const member = await get(`SELECT id, full_name FROM members WHERE ${conditions} LIMIT 1`);
      if (member) {
        await run(
          'UPDATE users SET full_name = ?, member_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [member.full_name, member.id, user.id]
        );
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

// Children's Ministry tables
async function createChildrensMinistryTables() {
  try {
    const idType = usePostgres ? 'SERIAL' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    const tsType = usePostgres ? 'TIMESTAMPTZ' : 'DATETIME';

    await run(`
      CREATE TABLE IF NOT EXISTS children_classes (
        id ${idType},
        name TEXT NOT NULL,
        age_group TEXT,
        description TEXT,
        max_capacity INTEGER,
        room_number TEXT,
        schedule TEXT,
        is_active INTEGER DEFAULT 1,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS children_teachers (
        id ${idType},
        member_id INTEGER,
        user_id INTEGER,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        qualification TEXT,
        background_check INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS children (
        id ${idType},
        member_id INTEGER,
        full_name TEXT NOT NULL,
        date_of_birth DATE,
        gender TEXT,
        parent_guardian_name TEXT,
        parent_guardian_phone TEXT,
        parent_guardian_email TEXT,
        emergency_contact TEXT,
        emergency_phone TEXT,
        medical_notes TEXT,
        allergies TEXT,
        class_id INTEGER,
        children_leader_id INTEGER,
        age_group TEXT,
        photo_consent INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS children_class_assignments (
        id ${idType},
        child_id INTEGER NOT NULL,
        class_id INTEGER NOT NULL,
        assigned_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(child_id, class_id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS children_teacher_assignments (
        id ${idType},
        teacher_id INTEGER NOT NULL,
        class_id INTEGER NOT NULL,
        assigned_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(teacher_id, class_id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS children_attendance (
        id ${idType},
        child_id INTEGER NOT NULL,
        class_id INTEGER NOT NULL,
        date DATE NOT NULL,
        status TEXT DEFAULT 'present'
          CHECK(status IN ('present','absent','excused','late')),
        checked_in_at ${tsType},
        checked_out_at ${tsType},
        checked_in_by INTEGER,
        checked_out_by INTEGER,
        notes TEXT,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(child_id, class_id, date)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS children_promotions (
        id ${idType},
        child_id INTEGER NOT NULL,
        from_class_id INTEGER,
        to_class_id INTEGER NOT NULL,
        promotion_date DATE NOT NULL,
        notes TEXT,
        created_by INTEGER,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run('CREATE INDEX IF NOT EXISTS idx_children_class ON children(class_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_children_dob ON children(date_of_birth)');
    await run(
      'CREATE INDEX IF NOT EXISTS idx_children_attendance_date ON children_attendance(date)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_children_attendance_child ON children_attendance(child_id)'
    );

    // Children's ministry leaders table
    await run(`
      CREATE TABLE IF NOT EXISTS children_leaders (
        id ${idType},
        user_id INTEGER NOT NULL,
        phone TEXT,
        email TEXT,
        is_head INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    // Children submission log
    await run(`
      CREATE TABLE IF NOT EXISTS children_submission_log (
        id ${idType},
        children_leader_id INTEGER NOT NULL,
        date DATE NOT NULL,
        class_id INTEGER,
        records_count INTEGER DEFAULT 0,
        created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(children_leader_id, date, class_id)
      )
    `);

    // Add leader_id to children table if missing
    const childrenCols = await all(
      usePostgres
        ? `SELECT column_name FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'leader_id'`
        : `PRAGMA table_info(children)`
    );
    const hasLeaderId = usePostgres
      ? childrenCols.some((c) => c.column_name === 'leader_id')
      : childrenCols.some((c) => c.name === 'leader_id');
    if (!hasLeaderId) {
      await run(`ALTER TABLE children ADD COLUMN leader_id INTEGER`);
    }

    // Add children_leader_id to children table if missing
    const childrenLeaderCols = await all(
      usePostgres
        ? `SELECT column_name FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'children_leader_id'`
        : `PRAGMA table_info(children)`
    );
    const hasChildrenLeaderId = usePostgres
      ? childrenLeaderCols.some((c) => c.column_name === 'children_leader_id')
      : childrenLeaderCols.some((c) => c.name === 'children_leader_id');
    if (!hasChildrenLeaderId) {
      await run(`ALTER TABLE children ADD COLUMN children_leader_id INTEGER`);
    }

    // Add indexes for children_leaders and children_submission_log
    await run('CREATE INDEX IF NOT EXISTS idx_children_leaders_user ON children_leaders(user_id)');
    await run(
      'CREATE INDEX IF NOT EXISTS idx_children_submission_log_leader ON children_submission_log(children_leader_id)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_children_submission_log_date ON children_submission_log(date)'
    );
    await run('CREATE INDEX IF NOT EXISTS idx_children_leader ON children(leader_id)');
    await run(
      'CREATE INDEX IF NOT EXISTS idx_children_children_leader ON children(children_leader_id)'
    );

    // Repair orphaned children_leaders records on PostgreSQL/Supabase.
    // Before the user_id fix, existing users were reassigned as children leaders
    // without a matching children_leaders row with correct user_id = users.id.
    // This migration finds such orphaned records and removes them so they do not
    // silently hide from the admin children-leaders list.
    try {
      const orphaned = await all(
        `SELECT cl.id, cl.user_id FROM children_leaders cl
         LEFT JOIN users u ON cl.user_id = u.id
         WHERE u.id IS NULL`
      );
      if (orphaned && orphaned.length > 0) {
        for (const row of orphaned) {
          await run('DELETE FROM children_leaders WHERE id = ?', [row.id]);
          console.log(
            `[children-leaders-repair] Removed orphaned children_leaders row id=${row.id} (user_id=${row.user_id} does not exist in users)`
          );
        }
        console.log(
          `[children-leaders-repair] Removed ${orphaned.length} orphaned children_leaders record(s)`
        );
      }
    } catch (repairErr) {
      console.warn('[children-leaders-repair] Skipped:', repairErr.message);
    }
  } catch (e) {
    console.warn("Children's Ministry tables migration skipped (non-fatal):", e.message);
  }
}

// Prepared statement wrappers

const queries = require('./db/queries').createQueries({ run, get, all, usePostgres });

// ── Transaction helper ───────────────────────────────────────────────────────
async function transaction(callback) {
  // PostgreSQL: delegate to the client-scoped transaction helper so the
  // callback's { run, get, all } are bound to one dedicated connection and can
  // run concurrently with unrelated pool queries. SQLite keeps the
  // serialize/begin/commit dance below on the single shared connection.
  if (usePostgres) {
    return db.transaction(callback);
  }
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
  // ── Multi-Period Executive Comparison Queries ────────────────────────────────
  getMultiPeriodOverall: (start, end) =>
    get(
      `
    SELECT
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'present'), 0) as present,
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'absent'), 0) as absent,
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status = 'excused'), 0) as excused,
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ?), 0) as total_attendees,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active = 1), 0) as total_members,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE date BETWEEN ? AND ?), 0) as total_records,
      COALESCE((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 0) as service_days,
      COALESCE((SELECT ROUND(CAST(AVG(CASE WHEN status='present' THEN 1.0 ELSE 0.0 END)*100 AS NUMERIC), 1) FROM attendance WHERE date BETWEEN ? AND ?), 0) as attendance_rate,
      COALESCE((SELECT COUNT(DISTINCT m.section_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE a.date BETWEEN ? AND ?), 0) as active_sections,
      COALESCE((SELECT COUNT(DISTINCT leader_id) FROM submission_log WHERE date BETWEEN ? AND ?), 0) as leaders_submitted,
      COALESCE((SELECT COUNT(*) FROM leaders WHERE is_active = 1), 0) as total_leaders,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at <= ?), 0) as registered_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE DATE(last_contacted_at) BETWEEN ? AND ?), 0) as members_contacted,
      COALESCE(ROUND(CAST((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM members WHERE is_active=1), 0) AS NUMERIC), 1), 0) as retention_rate,
      COALESCE(ROUND(CAST((SELECT AVG(engagement) FROM (
        SELECT m.id, COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) * 1.0 /
          NULLIF((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 0) as engagement
        FROM members m WHERE m.is_active=1
      )) AS NUMERIC), 2), 0) as engagement_score,
      COALESCE((SELECT COUNT(*) FROM visitor_intake WHERE created_at BETWEEN ? AND ?), 0) as visitors,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_registrations,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND status='Active'), 0) as active_member_count,
      COALESCE((SELECT COUNT(*) FROM absent_followups WHERE created_at BETWEEN ? AND ? AND contacted=1), 0) as followups_completed,
      COALESCE((SELECT COUNT(*) FROM absent_followups WHERE absence_date BETWEEN ? AND ?), 0) as total_followups_needed,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?) -
        (SELECT COUNT(*) FROM members WHERE is_active=0 AND soft_deleted_at BETWEEN ? AND ?), 0) as net_growth
    `,
      [
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end
      ]
    ),

  getMultiPeriodSections: (start, end) =>
    all(
      `
    SELECT
      s.id, s.name,
      COALESCE((SELECT COUNT(*) FROM members WHERE section_id=s.id AND is_active=1), 0) as members,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ? AND a.status='present'), 0) as present,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ? AND a.status='absent'), 0) as absent,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ? AND a.status='excused'), 0) as excused,
      COALESCE(ROUND(CAST((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ? AND a.status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM members WHERE section_id=s.id AND is_active=1), 0) AS NUMERIC), 1), 0) as attendance_rate,
      COALESCE((SELECT COUNT(*) FROM submission_log sl JOIN leaders l ON sl.leader_id=l.id WHERE l.section_id=s.id AND sl.date BETWEEN ? AND ?), 0) as submissions,
      COALESCE((SELECT COUNT(DISTINCT date) FROM attendance a JOIN members m ON a.member_id=m.id WHERE m.section_id=s.id AND a.date BETWEEN ? AND ?), 0) as service_days,
      COALESCE((SELECT COUNT(*) FROM absent_followups af JOIN members m ON af.member_id=m.id WHERE m.section_id=s.id AND af.absence_date BETWEEN ? AND ? AND af.contacted=1), 0) as followups_completed,
      COALESCE((SELECT COUNT(*) FROM absent_followups af JOIN members m ON af.member_id=m.id WHERE m.section_id=s.id AND af.absence_date BETWEEN ? AND ?), 0) as followups_needed,
      COALESCE((SELECT COUNT(*) FROM members WHERE section_id=s.id AND is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE section_id=s.id AND is_active=1 AND last_contacted_at BETWEEN ? AND ?), 0) as members_contacted
    FROM sections s WHERE s.id IN (SELECT DISTINCT section_id FROM members WHERE is_active=1)
    ORDER BY attendance_rate DESC
  `,
      [
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end
      ]
    ),

  getMultiPeriodLeaders: (start, end) =>
    all(
      `
    SELECT
      l.id, u.full_name as leader_name, s.name as section_name,
      COALESCE(l.is_head, 0) as is_head,
      COALESCE((SELECT COUNT(*) FROM members WHERE (leader_id=l.id OR (COALESCE(l.is_head,0)=1 AND section_id=l.section_id)) AND is_active=1), 0) as assigned_members,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE (m.leader_id=l.id OR (COALESCE(l.is_head,0)=1 AND m.section_id=l.section_id)) AND a.date BETWEEN ? AND ? AND a.status='present'), 0) as present,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE (m.leader_id=l.id OR (COALESCE(l.is_head,0)=1 AND m.section_id=l.section_id)) AND a.date BETWEEN ? AND ?), 0) as total_attendees,
      COALESCE(ROUND(CAST((SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN members m ON a.member_id=m.id WHERE (m.leader_id=l.id OR (COALESCE(l.is_head,0)=1 AND m.section_id=l.section_id)) AND a.date BETWEEN ? AND ? AND a.status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM members WHERE (leader_id=l.id OR (COALESCE(l.is_head,0)=1 AND section_id=l.section_id)) AND is_active=1), 0) AS NUMERIC), 1), 0) as attendance_rate,
      COALESCE(ROUND(CAST((SELECT COUNT(*) FROM submission_log WHERE leader_id=l.id AND date BETWEEN ? AND ?) * 100.0 /
        NULLIF((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 0) AS NUMERIC), 1), 0) as submission_rate,
      COALESCE((SELECT COUNT(*) FROM absent_followups WHERE leader_id=l.id AND absence_date BETWEEN ? AND ? AND contacted=1), 0) as followups_completed,
      COALESCE((SELECT COUNT(*) FROM absent_followups WHERE leader_id=l.id AND absence_date BETWEEN ? AND ?), 0) as followups_needed,
      COALESCE((SELECT COUNT(*) FROM members WHERE (leader_id=l.id OR (COALESCE(l.is_head,0)=1 AND section_id=l.section_id)) AND is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE (leader_id=l.id OR (COALESCE(l.is_head,0)=1 AND section_id=l.section_id)) AND is_active=1 AND last_contacted_at BETWEEN ? AND ?), 0) as members_contacted,
      COALESCE(ROUND(CAST((SELECT COUNT(*) FROM absent_followups WHERE leader_id=l.id AND absence_date BETWEEN ? AND ? AND contacted=1) * 100.0 /
        NULLIF((SELECT COUNT(*) FROM absent_followups WHERE leader_id=l.id AND absence_date BETWEEN ? AND ?), 0) AS NUMERIC), 1), 100) as follow_up_completion
    FROM leaders l
    JOIN users u ON u.id = l.user_id
    JOIN sections s ON s.id = l.section_id
    WHERE l.is_active = 1
    ORDER BY attendance_rate DESC
  `,
      [
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end
      ]
    ),

  getMultiPeriodDepartments: (start, end) =>
    all(
      `
    SELECT
      d.id, d.name,
      COALESCE((SELECT COUNT(*) FROM department_members WHERE department_id=d.id), 0) as members,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a
        JOIN department_members dm ON dm.member_id=a.member_id
        WHERE dm.department_id=d.id AND a.date BETWEEN ? AND ? AND a.status='present'), 0) as present,
      COALESCE((SELECT COUNT(DISTINCT a.member_id) FROM attendance a
        JOIN department_members dm ON dm.member_id=a.member_id
        WHERE dm.department_id=d.id AND a.date BETWEEN ? AND ?), 0) as total,
      COALESCE(ROUND(CAST((SELECT COUNT(DISTINCT a.member_id) FROM attendance a
        JOIN department_members dm ON dm.member_id=a.member_id
        WHERE dm.department_id=d.id AND a.date BETWEEN ? AND ? AND a.status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM department_members WHERE department_id=d.id), 0) AS NUMERIC), 1), 0) as attendance_rate
    FROM departments d WHERE d.is_active=1
    ORDER BY attendance_rate DESC
  `,
      [start, end, start, end, start, end]
    ),

  getMultiPeriodMembers: (start, end) =>
    all(
      `
    SELECT
      m.id, m.full_name, m.gender, m.age_group, m.status,
      s.name as section_name,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) as present_count,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='absent'), 0) as absent_count,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='excused'), 0) as excused_count,
      COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ?), 0) as total_attendances,
      COALESCE(ROUND(CAST((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present') * 100.0 /
        NULLIF((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ?), 0) AS NUMERIC), 1), 0) as attendance_rate,
      COALESCE(CAST((SELECT date FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? ORDER BY date DESC LIMIT 1) AS TEXT), 'never') as last_attendance,
      CASE
        WHEN COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) = 0 THEN 'critical'
        WHEN COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) * 1.0 /
          NULLIF((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 0) < 0.3 THEN 'high'
        WHEN COALESCE((SELECT COUNT(*) FROM attendance WHERE member_id=m.id AND date BETWEEN ? AND ? AND status='present'), 0) * 1.0 /
          NULLIF((SELECT COUNT(DISTINCT date) FROM attendance WHERE date BETWEEN ? AND ?), 0) < 0.6 THEN 'medium'
        ELSE 'low'
      END as risk_level
    FROM members m
    JOIN sections s ON s.id = m.section_id
    WHERE m.is_active = 1
    ORDER BY attendance_rate DESC
  `,
      [
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end,
        start,
        end
      ]
    ),

  getAttendanceMovement: (start, end) =>
    get(
      `
    SELECT
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?), 0) as new_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE soft_deleted_at BETWEEN ? AND ?), 0) as members_lost,
      COALESCE((SELECT COUNT(DISTINCT member_id) FROM attendance WHERE date BETWEEN ? AND ? AND status='present' AND member_id NOT IN
        (SELECT DISTINCT member_id FROM attendance WHERE date < ? AND status='present')), 0) as returning_members,
      COALESCE((SELECT COUNT(*) FROM members WHERE is_active=1 AND created_at BETWEEN ? AND ?) -
        (SELECT COUNT(*) FROM members WHERE soft_deleted_at BETWEEN ? AND ?), 0) as net_membership_growth,
      COALESCE((SELECT COUNT(*) FROM visitor_intake WHERE created_at BETWEEN ? AND ? AND status='converted'), 0) as visitors_converted
    `,
      [start, end, start, end, start, end, start, start, end, start, end, start, end]
    ),
  all,
  transaction,
  usePostgres,
  ensureHomeCellSchema,
  ensureEvangelismSchema,
  createChildrensMinistryTables,
  migrateUsersRoleConstraint,
  linkUsersToMembers
};
