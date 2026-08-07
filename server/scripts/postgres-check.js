const { Pool } = require('pg');

async function check() {
  const dbClient = process.env.DB_CLIENT || 'sqlite';
  const databaseUrl = process.env.DATABASE_URL || '';

  console.log(`DB Client: ${dbClient}`);

  // 1. If using SQLite, success (no DB needed)
  if (dbClient === 'sqlite') {
    console.log('✅ SQLite mode: No database connection check needed.');
    process.exit(0);
  }

  // 2. If running in CI with placeholder credentials, skip connection test
  // This prevents the build from failing when no real DB is available
  if (process.env.CI && databaseUrl.includes('placeholder')) {
    console.log('⚠️ CI Environment with placeholder URL: Skipping connection test.');
    console.log('✅ PostgreSQL driver is installed correctly.');
    process.exit(0);
  }

  // 3. If running locally or with real credentials, try to connect
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is missing.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL.');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ PostgreSQL check failed:', err.message);
    process.exit(1);
  }
}

check();
