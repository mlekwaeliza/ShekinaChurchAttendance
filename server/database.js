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
  upsertAttendanceSql
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
      role TEXT NOT NULL CHECK(role IN ('admin', 'leader', 'pastor')),
      full_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
  `);

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

async function ensureHomeCellSchema() {
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
        leader_id INTEGER NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
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
        FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE
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
      await run('CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL');
    } catch (e) {
      console.warn('password-reset column ensure failed (non-fatal):', e.message);
    }
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
  resetFailedLogin: (userId) => run('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [userId]),
  lockUser: (userId, until) => run('UPDATE users SET locked_until = ? WHERE id = ?', [until, userId]),
  isUserLocked: (userId) => get('SELECT locked_until FROM users WHERE id = ?', [userId]),
  createUser: (username, password_hash, role, full_name, profile_picture = null) =>
    run('INSERT INTO users (username, password_hash, role, full_name, profile_picture) VALUES (?, ?, ?, ?, ?)', [username, password_hash, role, full_name, profile_picture]),
  updateUserPassword: (password_hash, userId) =>
    run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [password_hash, userId]),
  updateUserFullName: (full_name, userId) =>
    run('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name, userId]),

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
    JOIN sections s ON m.section_id = s.id
    WHERE m.leader_id = ? AND m.is_active = 1
    ORDER BY m.full_name
  `, [leaderId]),
  getMembersBySection: (sectionId) => all(`
    SELECT m.*, u.full_name as leader_name
    FROM members m
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
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

    // 3. Absent 3+ Weeks PER SERVICE Logic
    let servicesToProcess = [];
    if (serviceId === 'all') {
      servicesToProcess = await all('SELECT id, name FROM service_types WHERE is_active = 1');
    } else {
      servicesToProcess = await all('SELECT id, name FROM service_types WHERE id = ?', [serviceId]);
    }

    let absenteesMap = new Map();

    for (const s of servicesToProcess) {
      // Find the last 3 exact dates this service occurred
      const datesRow = await all(`SELECT DISTINCT date FROM attendance WHERE service_type_id = ? ORDER BY date DESC LIMIT 3`, [s.id]);
      if (datesRow.length < 3) continue; // Cannot have missed 3 consecutive if 3 haven't occurred
      
      const dates = datesRow.map(d => d.date);
      const oldestDate = dates[2];

      // Query members who explicitly have 'absent' on strictly these 3 dates for this service
      const absentMembers = await all(`
        SELECT m.id, m.full_name, m.section_id, m.opt_out_services, m.status, m.created_at, sec.name as section_name
        FROM members m
        JOIN sections sec ON m.section_id = sec.id
        WHERE m.is_active = 1
        AND ${dateOnly('m.created_at')} <= ${dateOnly('?')}
        AND (
          SELECT COUNT(*) FROM attendance a 
          WHERE a.member_id = m.id 
          AND a.service_type_id = ? 
          AND a.date IN (?, ?, ?) 
          AND a.status = 'absent'
        ) = 3
      `, [oldestDate, s.id, dates[0], dates[1], dates[2]]);

      // Pre-load visitor present-counts for ALL members in the absent list
      // in a single GROUP BY query, to avoid the N+1 inside the loop below.
      const visitorIds = absentMembers
        .filter((a) => a.status === 'Visitor')
        .map((a) => a.id);
      const visitorPresentCounts = new Map();
      if (visitorIds.length > 0) {
        const placeholders = visitorIds.map(() => '?').join(',');
        const rows = await all(
          `SELECT member_id, COUNT(*) AS c FROM attendance
           WHERE service_type_id = ? AND status = 'present' AND member_id IN (${placeholders})
           GROUP BY member_id`,
          [s.id, ...visitorIds]
        );
        for (const r of rows) visitorPresentCounts.set(Number(r.member_id), Number(r.c));
      }

      for (const a of absentMembers) {
        // Evaluate Opt-Outs
        let optOuts = [];
        try { optOuts = JSON.parse(a.opt_out_services || '[]'); } catch(e) { /* noop */ }
        if (optOuts.includes(s.name)) continue;

        // Evaluate Visitors limitation using pre-loaded map (no extra query).
        if (a.status === 'Visitor' && (visitorPresentCounts.get(Number(a.id)) || 0) < 3) {
          continue;
        }

        // Add or merge into map
        if (absenteesMap.has(a.id)) {
          const existing = absenteesMap.get(a.id);
          existing.missed_services.push(s.name);
        } else {
          absenteesMap.set(a.id, {
            reason: 'absentee',
            id: a.id,
            full_name: a.full_name,
            section_id: a.section_id,
            section_name: a.section_name,
            missed_services: [s.name],
            missed_dates: dates
          });
        }
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
    JOIN sections s ON m.section_id = s.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    LEFT JOIN home_cell_members hcm ON hcm.church_member_id = m.id AND hcm.is_active = 1
    LEFT JOIN home_cells hc ON hc.id = hcm.cell_id
    WHERE m.is_active = 1
    ORDER BY s.name, m.full_name
  `),
  createMember: (membershipId, fullName, sectionId, leaderId, phone, email, gender, ageGroup, dob = null, showAge = 0, hideBday = 0, optOuts = '[]', address = null) =>
    run(`
      INSERT INTO members (membership_id, full_name, section_id, leader_id, phone, email, gender, age_group, date_of_birth, show_age_to_leaders, hide_from_birthday_list, opt_out_services, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [membershipId, fullName, sectionId, leaderId, phone, email, gender, ageGroup, dob, showAge, hideBday, optOuts, address]),
  updateMember: (fullName, phone, email, gender, ageGroup, dob, showAge, hideBday, optOuts, address, sectionId, leaderId, memberId) =>
    run(`
      UPDATE members
      SET full_name = ?, phone = ?, email = ?, gender = ?, age_group = ?, date_of_birth = ?, show_age_to_leaders = ?, hide_from_birthday_list = ?, opt_out_services = ?, address = ?, section_id = ?, leader_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [fullName, phone, email, gender, ageGroup, dob, showAge, hideBday, optOuts, address, sectionId, leaderId, memberId]),
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
      ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    WHERE a.date BETWEEN ? AND ?
    GROUP BY l.id
    ORDER BY attendance_rate DESC
  `, [startDate, endDate]),
  getAtRiskMembers: (startDate = formatLocalDate(addDays(new Date(), -30)), endDate = formatLocalDate()) => all(`
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
             ROUND(AVG(CASE WHEN status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as rate
      FROM attendance
      GROUP BY date
      ORDER BY date DESC
      LIMIT 12
    )
    SELECT
      ROUND(AVG(rate), 1) as avg_rate,
      ROUND(AVG(present), 0) as avg_present,
      ROUND(AVG(total), 0) as avg_total,
      COUNT(*) as weeks_analyzed
    FROM weekly_totals
  `),
  getSectionAnomalies: (
    threshold = 20,
    startDate = formatLocalDate(addDays(new Date(), -90))
  ) => all(`
    WITH section_avgs AS (
      SELECT s.id as section_id, s.name as section_name,
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as avg_rate
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      WHERE a.date >= ?
      GROUP BY s.id
    ),
    latest_rates AS (
      SELECT s.id as section_id, s.name as section_name,
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as latest_rate
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
           ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as avg_rate,
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
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as consistency
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
             ROUND(AVG(CASE WHEN a.date >= ? AND a.status = 'present' THEN 1.0
                            WHEN a.date >= ? THEN 0.0 END) * 100, 1) as recent_rate,
             ROUND(AVG(CASE WHEN a.date >= ? AND a.date < ? AND a.status = 'present' THEN 1.0
                            WHEN a.date >= ? AND a.date < ? THEN 0.0 END) * 100, 1) as prior_rate
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
      ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
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
      ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
    FROM members m
    LEFT JOIN attendance a ON m.id = a.member_id AND a.date >= ?
    GROUP BY m.age_group
    ORDER BY category_type, attendance_rate DESC
  `, [startDate, startDate]),

  getYearOverYear: (currentYear = new Date().getFullYear()) => all(`
    WITH current_year AS (
      SELECT ${monthNumber('a.date')} as month,
             ${yearNumber('a.date')} as year,
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate,
             COUNT(DISTINCT a.date) as service_count
      FROM attendance a
      WHERE ${yearNumber('a.date')} = ?
      GROUP BY ${monthNumber('a.date')}
    ),
    previous_year AS (
      SELECT ${monthNumber('a.date')} as month,
             ${yearNumber('a.date')} as year,
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate,
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
      ROUND(AVG(total_attendance), 1) as avg_services_attended
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

  // Notification queries
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
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
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
    WHERE m.leader_id = ? AND m.is_active = 1
    AND m.id NOT IN (SELECT member_id FROM outreach_logs WHERE leader_id = ? AND week_start = ?)
    ORDER BY m.full_name
  `, [leaderId, leaderId, weekStart]),

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
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as section_rate
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

     query += ` ORDER BY ${sqlMonthDay('m.date_of_birth')}`;

     return all(query, params);
   },

  // Scheduled reminder queries
  createScheduledReminder: (type, entityType, entityId, scheduledFor, payload) =>
    run('INSERT INTO scheduled_reminders (type, entity_type, entity_id, scheduled_for, payload) VALUES (?, ?, ?, ?, ?)',
      [type, entityType, entityId, scheduledFor, payload ? JSON.stringify(payload) : null]),
  getPendingReminders: () => all(
    `SELECT * FROM scheduled_reminders WHERE sent = 0 AND scheduled_for <= ${pendingNowExpression()} ORDER BY scheduled_for ASC`,
    []),
  markReminderSent: (reminderId) =>
    run("UPDATE scheduled_reminders SET sent = 1, sent_at = CURRENT_TIMESTAMP WHERE id = ?", [reminderId]),
  getUpcomingReminders: (type, hours = 24) => all(
    `SELECT * FROM scheduled_reminders WHERE type = ? AND sent = 0 AND scheduled_for <= ${nowMinusHours(hours)} ORDER BY scheduled_for ASC`,
    [type]),
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
  all,
  transaction,
  ensureHomeCellSchema
};
