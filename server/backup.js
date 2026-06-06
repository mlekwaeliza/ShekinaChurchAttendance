const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
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
    const fileName = `backup-${timestamp}.sql`;
    const backupPath = path.join(BACKUP_DIR, fileName);
    const pgDump = findPgDump();

    execFile(pgDump, [cleanUrl, '--file', backupPath, '--format', 'plain'], async (error, stdout, stderr) => {
      if (error) {
        console.error('PostgreSQL backup failed:', stderr || error.message);
        reject(error);
        return;
      }

      console.log(`PostgreSQL database backed up to: ${backupPath}`);
      cleanupOldBackups();

      // DBA P0-1: also push a copy off-host when BACKUP_REMOTE_URL is
      // configured. The local copy on Render's ephemeral disk is not
      // durable, so we treat it as a short-lived staging area and
      // stream the same file to a remote object store as soon as the
      // dump completes. Supports S3-compatible PUT (Backblaze B2,
      // Cloudflare R2, etc.) and any HTTP endpoint that accepts the
      // configured method (default PUT) with the configured headers
      // (e.g. Authorization: Bearer ...).
      const remoteUrl = process.env.BACKUP_REMOTE_URL;
      if (remoteUrl) {
        try {
          await uploadBackupToRemote(backupPath, fileName);
        } catch (uploadErr) {
          // Don't fail the backup; local copy exists and the operator
          // can replay later. We log loudly so it's visible in
          // Sentry/log streams.
          console.error('Remote backup upload failed:', uploadErr.message);
        }
      }

      resolve(backupPath);
    });
  });
}

// uploadBackupToRemote(localPath, fileName) -> streams a backup file
// to the URL configured in BACKUP_REMOTE_URL. The method, headers,
// and request body shape are derived from environment variables so we
// can support S3-style "PUT body=file" with custom auth headers, plus
// plain "POST multipart" endpoints in the future.
//
// Environment variables consumed:
//   BACKUP_REMOTE_URL       - https://... endpoint (required)
//   BACKUP_REMOTE_METHOD    - HTTP method, default "PUT"
//   BACKUP_REMOTE_HEADERS   - JSON object of extra headers
//                             (e.g. {"Authorization":"Bearer ..."})
//   BACKUP_REMOTE_PATH_TPL  - optional, e.g. "/{filename}"; appended
//                             to BACKUP_REMOTE_URL. Default empty.
//
// Any failure (network, non-2xx, file missing) rejects with a
// descriptive Error so the caller can log and continue.
function uploadBackupToRemote(localPath, fileName) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(localPath)) {
      return reject(new Error(`Local backup missing: ${localPath}`));
    }
    const baseUrl = process.env.BACKUP_REMOTE_URL;
    if (!baseUrl) {
      return reject(new Error('BACKUP_REMOTE_URL not set'));
    }
    const method = (process.env.BACKUP_REMOTE_METHOD || 'PUT').toUpperCase();
    let parsed;
    try {
      parsed = new URL(baseUrl);
    } catch (err) {
      return reject(new Error(`Invalid BACKUP_REMOTE_URL: ${baseUrl}`));
    }
    const pathTpl = process.env.BACKUP_REMOTE_PATH_TPL || '';
    if (pathTpl) {
      parsed.pathname = (parsed.pathname || '/').replace(/\/?$/, '/') + pathTpl.replace(/^\//, '').replace(/\{filename\}/g, encodeURIComponent(fileName));
    }

    let extraHeaders = {};
    if (process.env.BACKUP_REMOTE_HEADERS) {
      try {
        extraHeaders = JSON.parse(process.env.BACKUP_REMOTE_HEADERS);
        if (typeof extraHeaders !== 'object' || Array.isArray(extraHeaders)) {
          throw new Error('not an object');
        }
      } catch (err) {
        return reject(new Error(`Invalid BACKUP_REMOTE_HEADERS (must be JSON object): ${err.message}`));
      }
    }

    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const fileSize = fs.statSync(localPath).size;

    const req = lib.request({
      method,
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      headers: {
        'Content-Type': 'application/sql',
        'Content-Length': fileSize,
        ...extraHeaders
      }
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 200 && status < 300) {
        res.resume();
        console.log(`Remote backup upload OK (${status}): ${parsed.pathname} (${fileSize} bytes)`);
        resolve({ status, bytes: fileSize });
      } else {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          reject(new Error(`Remote upload HTTP ${status}: ${body.slice(0, 200)}`));
        });
      }
    });
    req.on('error', (err) => reject(err));
    fs.createReadStream(localPath).on('error', (err) => {
      req.destroy(err);
    }).pipe(req);
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

// Aggregate status of the local backup directory plus remote-upload
// configuration. Returns a plain object safe for JSON serialization.
// The `warning` field is a non-empty human-readable string when the
// admin should investigate (e.g. no recent backup, remote upload
// configured but most-recent backup looks old, or the backup dir
// is missing entirely).
function getBackupStatus() {
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30;
  const remoteUrl = process.env.BACKUP_REMOTE_URL || null;
  const now = Date.now();

  let totalBackups = 0;
  let totalSizeKb = 0;
  let lastBackupAt = null;

  if (fs.existsSync(BACKUP_DIR)) {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.sqlite') || f.endsWith('.sql'));
      totalBackups = files.length;
      for (const f of files) {
        try {
          const stat = fs.statSync(path.join(BACKUP_DIR, f));
          totalSizeKb += Math.round(stat.size / 1024);
          if (!lastBackupAt || stat.mtimeMs > new Date(lastBackupAt).getTime()) {
            lastBackupAt = stat.mtime.toISOString();
          }
        } catch (_) { /* skip unreadable file */ }
      }
    } catch (_) { /* dir read failed; leave counts at 0 */ }
  }

  let lastBackupAgeHours = null;
  if (lastBackupAt) {
    lastBackupAgeHours = Math.round((now - new Date(lastBackupAt).getTime()) / (60 * 60 * 1000));
  }

  const warnings = [];
  if (!fs.existsSync(BACKUP_DIR)) {
    warnings.push('Backup directory is missing on disk. Run POST /api/admin/backups/create to recreate it.');
  }
  if (!lastBackupAt) {
    warnings.push('No backups have been created yet. The initial backup may have failed — check server logs.');
  } else if (lastBackupAgeHours > 48) {
    warnings.push(`Most recent backup is ${lastBackupAgeHours}h old (>48h). Scheduled backups may be failing.`);
  }
  if (remoteUrl && lastBackupAgeHours !== null && lastBackupAgeHours > 24) {
    warnings.push(`BACKUP_REMOTE_URL is configured but the most recent backup is ${lastBackupAgeHours}h old — remote uploads may be failing.`);
  }

  return {
    backup_dir: BACKUP_DIR,
    backup_dir_exists: fs.existsSync(BACKUP_DIR),
    total_backups: totalBackups,
    total_size_kb: totalSizeKb,
    last_backup_at: lastBackupAt,
    last_backup_age_hours: lastBackupAgeHours,
    retention_days: retentionDays,
    remote_upload_configured: Boolean(remoteUrl),
    remote_upload_host: remoteUrl ? (() => { try { return new URL(remoteUrl).host; } catch (_) { return null; } })() : null,
    warning: warnings.length > 0 ? warnings.join(' ') : null
  };
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

module.exports = { backupDatabase, restoreDatabase, listBackups, deleteBackup, safeBackupName, uploadBackupToRemote, getBackupStatus };
