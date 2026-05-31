require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 60000)
});

function normalizeUsername(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function passwordFromName(name) {
  const firstName = normalizeUsername(name).split('_')[0] || 'leader';
  const displayName = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}`;
  const randomPart = crypto
    .randomBytes(3)
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, '7');

  return `${displayName}@${randomPart}!26`;
}

async function uniqueUsername(base, userId) {
  let username = base || `leader_${userId}`;
  let suffix = 2;

  while (true) {
    const result = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id <> $2',
      [username, userId]
    );
    if (result.rowCount === 0) return username;
    username = `${base}_${suffix}`;
    suffix += 1;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const result = await pool.query(`
    SELECT
      l.id AS leader_id,
      l.is_head,
      l.section_id,
      s.name AS section_name,
      u.id AS user_id,
      u.full_name
    FROM leaders l
    JOIN users u ON u.id = l.user_id
    JOIN sections s ON s.id = l.section_id
    WHERE COALESCE(l.is_active, 1) = 1
      AND u.role = 'leader'
    ORDER BY s.name, l.is_head DESC, u.full_name
  `);

  const rows = [];

  console.log(`Preparing ${result.rows.length} leader account(s)...`);

  await pool.query('BEGIN');
  try {
    for (const leader of result.rows) {
      const username = await uniqueUsername(normalizeUsername(leader.full_name), leader.user_id);
      const password = passwordFromName(leader.full_name);
      const passwordHash = bcrypt.hashSync(password, 10);
      await pool.query(
        `UPDATE users
         SET username = $1,
             password_hash = $2,
             failed_login_attempts = 0,
             locked_until = NULL,
             totp_enabled = 0,
             totp_secret = NULL,
             backup_codes = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [username, passwordHash, leader.user_id]
      );

      rows.push({
        section: leader.section_name,
        role: leader.is_head ? 'Head Leader' : 'Subleader',
        name: leader.full_name,
        username,
        password
      });
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  const reportLines = [
    '# Leader Login Credentials',
    '',
    'These credentials were applied to the deployed Neon database.',
    '',
    '| Section | Role | Name | Username | Password |',
    '|---------|------|------|----------|----------|',
    ...rows.map((row) => `| ${row.section} | ${row.role} | ${row.name} | \`${row.username}\` | \`${row.password}\` |`)
  ];

  const reportPath = path.join(__dirname, '..', '..', 'leader_credentials.md');
  fs.writeFileSync(reportPath, `${reportLines.join('\n')}\n`);

  console.log(`Updated ${rows.length} leader account(s).`);
  console.log(`Credentials report: ${reportPath}`);
  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
