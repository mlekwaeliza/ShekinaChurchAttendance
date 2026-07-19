const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_pHbTaRmy6h5Z@ep-silent-base-alt3znd6-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require';

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
    const client = await pool.connect();
    console.log('Connected to Neon\n');

    // Check if session table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'session'
    `);
    console.log('session table exists:', tableCheck.rows.length > 0);

    if (tableCheck.rows.length > 0) {
      // Check session table schema
      const columns = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'session' ORDER BY ordinal_position
      `);
      console.log('session table columns:', columns.rows);

      // Count sessions
      const count = await client.query('SELECT COUNT(*) as cnt FROM session');
      console.log('session count:', count.rows[0].cnt);
    } else {
      console.log('Creating session table...');
      await client.query(`
        CREATE TABLE "session" (
          "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL
        )
      `);
      await client.query(`CREATE INDEX "IDX_session_expire" ON "session" ("expire")`);
      console.log('session table created successfully');
    }

    // Check all tables
    const allTables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log('\nAll tables in public schema:');
    allTables.rows.forEach(r => console.log('  -', r.table_name));

    client.release();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
