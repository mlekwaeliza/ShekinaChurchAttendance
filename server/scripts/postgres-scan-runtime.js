const fs = require('fs');
const path = require('path');

const serverRoot = path.resolve(__dirname, '..');
const runtimeRoots = [
  'database.js',
  'scheduler.js',
  'backup.js',
  'middleware',
  'routes',
  'utils'
];
const ignoredDirs = new Set(['node_modules', 'backups', 'uploads', '__tests__', 'scripts']);
const scannedExtensions = new Set(['.js']);
const sqliteOnlyPatterns = [
  { name: 'strftime', pattern: /strftime\s*\(/i },
  { name: 'SQLite DATETIME now', pattern: /DATETIME\s*\(\s*['"]now['"]/i },
  { name: 'SQLite DATE modifier', pattern: /DATE\s*\([^)]*['"]weekday/i },
  { name: 'INSERT OR REPLACE', pattern: /INSERT\s+OR\s+REPLACE/i },
  { name: 'GROUP_CONCAT', pattern: /GROUP_CONCAT\s*\(/i },
  { name: 'json_extract', pattern: /json_extract\s*\(/i },
  { name: 'PRAGMA outside database bootstrap', pattern: /PRAGMA\s+/i }
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(path.join(dir, entry.name), files);
      }
      continue;
    }

    if (scannedExtensions.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function scanFile(filePath) {
  const relativePath = path.relative(serverRoot, filePath);
  const normalizedRelativePath = relativePath.replace(/\\/g, '/');
  const isRuntimeFile = runtimeRoots.some((root) => (
    normalizedRelativePath === root || normalizedRelativePath.startsWith(`${root}/`)
  ));

  if (!isRuntimeFile || normalizedRelativePath === 'utils/sqlDialect.js') {
    return [];
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    for (const { name, pattern } of sqliteOnlyPatterns) {
      if (!pattern.test(line)) continue;

      if (relativePath === 'database.js' && name === 'PRAGMA outside database bootstrap') {
        continue;
      }

      findings.push({
        file: relativePath,
        line: index + 1,
        name,
        text: line.trim()
      });
    }
  });

  return findings;
}

const findings = walk(serverRoot).flatMap(scanFile);

if (findings.length > 0) {
  console.error('SQLite-only runtime SQL patterns remain:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.name}] ${finding.text}`);
  }
  process.exitCode = 1;
} else {
  console.log('No SQLite-only runtime SQL patterns found in server JavaScript files.');
}
