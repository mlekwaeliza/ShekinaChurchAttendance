const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { db } = require('./database');

const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function backupDatabase() {
  return new Promise((resolve, reject) => {
    if (String(process.env.DB_CLIENT || '').toLowerCase() === 'postgres') {
      backupPostgres().then(resolve).catch(reject);
      return;
    }

    const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
    
    if (!fs.existsSync(dbPath)) {
      console.log('Backup skipped: database file not found');
      resolve(null);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.sqlite`);

    // Use SQLite's VACUUM INTO for a safe, consistent online backup
    db.run(`VACUUM INTO ?`, [backupPath], function(err) {
      if (err) {
        console.error('VACUUM INTO backup failed, falling back to file copy:', err.message);
        try {
          fs.copyFileSync(dbPath, backupPath);
          console.log(`Database backed up (file copy) to: ${backupPath}`);
          cleanupOldBackups();
          resolve(backupPath);
        } catch (copyErr) {
          console.error('Backup failed:', copyErr.message);
          reject(copyErr);
        }
      } else {
        console.log(`Database backed up (VACUUM INTO) to: ${backupPath}`);
        cleanupOldBackups();
        resolve(backupPath);
      }
    });
  });
}

function findPgDump() {
  if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;
  const bundledPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
  return fs.existsSync(bundledPath) ? bundledPath : 'pg_dump';
}

function backupPostgres() {
  return new Promise((resolve, reject) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.log('PostgreSQL backup skipped: DATABASE_URL is not set');
      resolve(null);
      return;
    }

    // pg_dump is a native libpq client and rejects parameters it does
    // not understand (e.g. uselibpqcompat, channel_binding are pg client
    // extensions). Strip them to get a clean libpq URL.
    let cleanUrl = databaseUrl;
    try {
      const u = new URL(cleanUrl);
      u.searchParams.delete('uselibpqcompat');
      u.searchParams.delete('channel_binding');
      cleanUrl = u.toString();
    } catch (_) {
      // Fallback: leave as-is
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);
    const pgDump = findPgDump();

    execFile(pgDump, [cleanUrl, '--file', backupPath, '--format', 'plain'], (error, stdout, stderr) => {
      if (error) {
        console.error('PostgreSQL backup failed:', stderr || error.message);
        reject(error);
        return;
      }

      console.log(`PostgreSQL database backed up to: ${backupPath}`);
      cleanupOldBackups();
      resolve(backupPath);
    });
  });
}

function safeBackupName(input) {
  const str = String(input || '');
  if (!str) throw new Error('Invalid backup filename');
  // L6-fix: reject obvious traversal patterns BEFORE basename().
  // path.basename() on Windows collapses both forward and backslashes
  // in some Node versions, so we belt-and-suspenders the check.
  if (str.includes('..') || /[/\\]/.test(str) || str.startsWith('.') || str.includes('\0')) {
    throw new Error('Invalid backup filename');
  }
  const safe = path.basename(str);
  if (!safe || safe !== str || !/^[\w.-]+$/.test(safe)) {
    throw new Error('Invalid backup filename');
  }
  if (!/\.(sqlite|sql)$/i.test(safe)) {
    throw new Error('Invalid backup file extension');
  }
  // L6-fix: confirm the resolved absolute path stays inside the backup
  // directory. This catches any future regex bypass via symlinks or
  // platform-specific path quirks.
  const backupsDir = path.resolve(__dirname, 'backups');
  const resolved = path.resolve(backupsDir, safe);
  if (resolved !== path.join(backupsDir, safe) ||
      !resolved.startsWith(backupsDir + path.sep)) {
    throw new Error('Invalid backup path');
  }
  return safe;
}

function restoreDatabase(backupFile) {
  return new Promise((resolve, reject) => {
    if (String(process.env.DB_CLIENT || '').toLowerCase() === 'postgres') {
      reject(new Error('PostgreSQL restore must be performed with psql/pg_restore after stopping the app.'));
      return;
    }

    let safeName;
    try {
      safeName = safeBackupName(backupFile);
    } catch (err) {
      return reject(err);
    }
    const backupPath = path.join(BACKUP_DIR, safeName);
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

    if (!fs.existsSync(backupPath)) {
      reject(new Error(`Backup file not found: ${backupFile}`));
      return;
    }

    try {
      fs.copyFileSync(backupPath, dbPath);
      console.log(`Database restored from: ${backupPath}`);
      resolve(dbPath);
    } catch (error) {
      console.error('Restore failed:', error.message);
      reject(error);
    }
  });
}

function listBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sqlite') || f.endsWith('.sql'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(filePath);
        return {
          filename: f,
          size_kb: Math.round(stat.size / 1024),
          created_at: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return files;
  } catch (error) {
    console.error('Failed to list backups:', error.message);
    return [];
  }
}

function deleteBackup(filename) {
  const safeName = safeBackupName(filename);
  const filePath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${safeName}`);
  }
  fs.unlinkSync(filePath);
  console.log(`Deleted backup: ${safeName}`);
}

function cleanupOldBackups() {
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    files.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old backup: ${file}`);
      }
    });
  } catch (error) {
    console.error('Cleanup failed:', error.message);
  }
}

// Run backup every 6 hours
backupDatabase().catch(err => console.error('Initial backup failed:', err.message));
setInterval(() => {
  backupDatabase().catch(err => console.error('Scheduled backup failed:', err.message));
}, 6 * 60 * 60 * 1000);

module.exports = { backupDatabase, restoreDatabase, listBackups, deleteBackup };
