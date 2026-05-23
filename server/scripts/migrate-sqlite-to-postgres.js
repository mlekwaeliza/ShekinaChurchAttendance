require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const serverRoot = path.resolve(__dirname, '..');
const sqlitePath = process.env.SQLITE_PATH || process.env.DB_PATH || path.join(serverRoot, 'database.sqlite');
const schemaPath = path.join(serverRoot, 'db', 'postgres-schema.sql');
const analyticsPath = path.join(serverRoot, 'db', 'postgres-analytics.sql');

const orderedTables = [
  'users',
  'sections',
  'leaders',
  'members',
  'service_types',
  'attendance',
  'submission_log',
  'notifications',
  'announcements',
  'admin_followup_tasks',
  'visitor_intake',
  'church_calendar_events',
  'absent_followups',
  'audit_log',
  'service_instances',
  'offline_attendance_imports',
  'settings',
  'outreach_logs',
  'scheduled_reminders',
  'pastoral_care_queue',
  'hall_of_fame_adjustments'
];

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
    throw new Error('Set DATABASE_URL, or set PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD before running the migration.');
  }
}

function openSqlite() {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found at ${sqlitePath}`);
  }

  return new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY);
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function sqliteClose(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

function buildPool() {
  const sslEnabled = ['1', 'true', 'yes', 'require'].includes(String(process.env.PGSSL || '').toLowerCase());
  return new Pool(process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false
      }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || undefined,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false
      });
}

async function ensureSchema(pool) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
}

async function ensureAnalytics(pool) {
  const analytics = fs.readFileSync(analyticsPath, 'utf8');
  await pool.query(analytics);
}

async function sqliteTableExists(sqlite, tableName) {
  const rows = await sqliteAll(
    sqlite,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  return rows.length > 0;
}

async function sqliteColumns(sqlite, tableName) {
  const rows = await sqliteAll(sqlite, `PRAGMA table_info(${tableName})`);
  return rows.map((row) => row.name);
}

async function postgresColumns(pool, tableName) {
  const result = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
}

function normalizeValue(column, value) {
  if (value === undefined) return null;
  if (
    value === '' &&
    /(^date$|_date$|date_|_at$|locked_until|scheduled_for|sent_at|completed_at|due_date|week_start)/i.test(column)
  ) {
    return null;
  }
  return value;
}

async function copyTable(sqlite, pool, tableName) {
  if (!(await sqliteTableExists(sqlite, tableName))) {
    console.log(`- ${tableName}: skipped, missing in SQLite`);
    return;
  }

  const [sourceColumns, targetColumns] = await Promise.all([
    sqliteColumns(sqlite, tableName),
    postgresColumns(pool, tableName)
  ]);

  const columns = sourceColumns.filter((column) => targetColumns.includes(column));
  if (!columns.length) {
    console.log(`- ${tableName}: skipped, no matching columns`);
    return;
  }

  const rows = await sqliteAll(sqlite, `SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM ${tableName}`);
  if (!rows.length) {
    console.log(`- ${tableName}: 0 rows`);
    return;
  }

  const conflictTarget = columns.includes('id') ? 'id' : columns.includes('key') ? 'key' : null;
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ');

  const client = await pool.connect();
  let copied = 0;
  let skippedForeignKeys = 0;
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const values = columns.map((column) => normalizeValue(column, row[column]));
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      const conflict = conflictTarget ? ` ON CONFLICT ("${conflictTarget}") DO NOTHING` : '';
      await client.query('SAVEPOINT migrate_row');
      try {
        const result = await client.query(`INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders})${conflict}`, values);
        copied += result.rowCount;
        await client.query('RELEASE SAVEPOINT migrate_row');
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT migrate_row');
        await client.query('RELEASE SAVEPOINT migrate_row');
        if (error.code === '23503') {
          skippedForeignKeys += 1;
          continue;
        }
        throw error;
      }
    }

    if (columns.includes('id')) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id')::regclass, GREATEST(COALESCE((SELECT MAX(id) FROM "${tableName}"), 0), 1), true)`,
        [tableName]
      );
    }

    await client.query('COMMIT');
    const skippedText = skippedForeignKeys ? `, skipped ${skippedForeignKeys} orphaned row(s)` : '';
    console.log(`- ${tableName}: copied ${copied} rows${skippedText}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureLegacyReferencedSections(sqlite, pool) {
  const rows = await sqliteAll(sqlite, `
    SELECT DISTINCT section_id
    FROM (
      SELECT section_id FROM leaders
      UNION ALL
      SELECT section_id FROM members
    ) referenced_sections
    WHERE section_id IS NOT NULL
      AND section_id NOT IN (SELECT id FROM sections)
    ORDER BY section_id
  `);

  if (!rows.length) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(
        `INSERT INTO sections (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [row.section_id, `Legacy Section ${row.section_id}`]
      );
    }

    await client.query(
      `SELECT setval(pg_get_serial_sequence('sections', 'id')::regclass, GREATEST(COALESCE((SELECT MAX(id) FROM sections), 0), 1), true)`
    );
    await client.query('COMMIT');
    console.log(`- sections: added ${rows.length} legacy placeholder section(s) for orphaned references`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  requireDatabaseUrl();

  const sqlite = openSqlite();
  const pool = buildPool();

  try {
    const health = await pool.query('SELECT current_database() AS database');
    console.log(`Migrating SQLite data from ${sqlitePath}`);
    console.log(`Target PostgreSQL database: ${health.rows[0].database}`);

    await ensureSchema(pool);
    for (const tableName of orderedTables) {
      await copyTable(sqlite, pool, tableName);
      if (tableName === 'sections') {
        await ensureLegacyReferencedSections(sqlite, pool);
      }
    }

    await ensureAnalytics(pool);
    console.log('PostgreSQL analytics views and materialized summaries are ready.');
    console.log('Migration complete. Keep the SQLite file until you have verified the Postgres deployment.');
  } finally {
    await sqliteClose(sqlite);
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});
