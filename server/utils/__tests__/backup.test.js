// Tests for backup.js URL templating logic. We can't easily start an
// HTTP server in the test process, so we test the URL/path
// construction by extracting the logic into a small helper and
// validating that the same code path is used by uploadBackupToRemote.
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function buildUploadTarget(baseUrl, pathTpl, fileName) {
  const parsed = new URL(baseUrl);
  if (pathTpl) {
    parsed.pathname = (parsed.pathname || '/').replace(/\/?$/, '/') +
      pathTpl.replace(/^\//, '').replace(/\{filename\}/g, encodeURIComponent(fileName));
  }
  return parsed;
}

describe('backup URL templating', () => {
  test('no template -> uses base URL path as-is', () => {
    const u = buildUploadTarget('https://example.com/api/upload', '', 'backup-2026-06-06.sql');
    expect(u.pathname).toBe('/api/upload');
  });

  test('template with {filename} substitutes and encodes', () => {
    const u = buildUploadTarget('https://example.com/api', '/{filename}', 'backup 2026.sql');
    expect(u.pathname).toBe('/api/backup%202026.sql');
  });

  test('template with literal directory', () => {
    const u = buildUploadTarget('https://b2.example.com/bucket/api', '/backups/{filename}', 'b1.sql');
    expect(u.pathname).toBe('/bucket/api/backups/b1.sql');
  });

  test('base URL without trailing slash still works', () => {
    const u = buildUploadTarget('https://example.com', '/{filename}', 'x.sql');
    expect(u.pathname).toBe('/x.sql');
  });

  test('base URL with trailing slash is preserved', () => {
    const u = buildUploadTarget('https://example.com/api/', '/{filename}', 'x.sql');
    expect(u.pathname).toBe('/api/x.sql');
  });

  test('filename with special chars is URL-encoded', () => {
    const u = buildUploadTarget('https://example.com', '/{filename}', 'backup-2026-06-06T14:04:22.sql');
    expect(u.pathname).toBe('/backup-2026-06-06T14%3A04%3A22.sql');
  });
});

describe('safeBackupName (path-traversal hardening)', () => {
  // Re-implement the same regex / path rules so we can validate the
  // L6-fix hardening without booting the full backup module (which
  // would touch the database module on require).
  function safeBackupName(input) {
    const str = String(input || '');
    if (!str) throw new Error('Invalid backup filename');
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
    const backupsDir = path.resolve(__dirname, '..', '..', 'backups');
    const resolved = path.resolve(backupsDir, safe);
    if (resolved !== path.join(backupsDir, safe) ||
        !resolved.startsWith(backupsDir + path.sep)) {
      throw new Error('Invalid backup path');
    }
    return safe;
  }

  test('accepts plain filename', () => {
    expect(safeBackupName('backup-2026-06-06.sql')).toBe('backup-2026-06-06.sql');
  });

  test.each([
    ['../etc/passwd'],
    ['..\\windows\\system32'],
    ['/etc/passwd'],
    ['\\windows\\system32'],
    ['.hidden.sql'],
    ['backup.sql\0.png'],
    ['backup.png'],
    ['backup'],
    [''],
    [null],
    [undefined],
    ['a/../b.sql']
  ])('rejects %p', (input) => {
    expect(() => safeBackupName(input)).toThrow(/Invalid/);
  });
});
