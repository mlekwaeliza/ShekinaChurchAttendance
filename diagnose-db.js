const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = 'postgresql://neondb_owner:npg_pHbTaRmy6h5Z@ep-silent-base-alt3znd6-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require';

// Strip channel_binding which pg doesn't support
let cleanConnStr = connectionString;
try {
  const url = new URL(connectionString);
  url.searchParams.delete('channel_binding');
  cleanConnStr = url.toString();
} catch (_) {}

(async () => {
  const pool = new Pool({
    connectionString: cleanConnStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });

  try {
    console.log('Connecting to Neon database...');
    const client = await pool.connect();
    console.log('Connected!\n');

    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    console.log('users table exists:', tableCheck.rows.length > 0);

    if (tableCheck.rows.length > 0) {
      // List all users
      const users = await client.query('SELECT id, username, role, full_name, password_hash, failed_login_attempts, locked_until FROM users ORDER BY id');
      console.log(`\nFound ${users.rows.length} users in database:\n`);
      console.log('ID | Username | Role | Full Name | FailedAttempts | Locked | HashPrefix');
      console.log('---|----------|------|-----------|----------------|--------|-----------');
      for (const u of users.rows) {
        const hashPrefix = u.password_hash ? u.password_hash.substring(0, 30) + '...' : 'NULL';
        console.log(`${u.id} | ${u.username} | ${u.role} | ${u.full_name} | ${u.failed_login_attempts} | ${u.locked_until || 'no'} | ${hashPrefix}`);
      }

      // Test bcrypt comparison for admin
      const admin = users.rows.find(u => u.username === 'admin');
      if (admin && admin.password_hash) {
        const match = await bcrypt.compare('AdminReset!2026', admin.password_hash);
        console.log(`\nbcrypt.compare("AdminReset!2026", admin.hash) = ${match}`);
      } else {
        console.log('\nNo admin user found or no password_hash');
      }

      // Test ghance
      const ghance = users.rows.find(u => u.username === 'ghance');
      if (ghance && ghance.password_hash) {
        const match = await bcrypt.compare('password123', ghance.password_hash);
        console.log(`bcrypt.compare("password123", ghance.hash) = ${match}`);
      }

      // Test a leader
      const elizabeth = users.rows.find(u => u.username === 'elizabeth_anthony');
      if (elizabeth && elizabeth.password_hash) {
        const match = await bcrypt.compare('Elizabeth@jTfS!26', elizabeth.password_hash);
        console.log(`bcrypt.compare("Elizabeth@jTfS!26", elizabeth.hash) = ${match}`);
      } else {
        console.log('elizabeth_anthony not found in database');
      }
    }

    client.release();
  } catch (err) {
    console.error('Database connection/query error:', err.message);
    console.error('Full error:', err);
  } finally {
    await pool.end();
  }
})();
