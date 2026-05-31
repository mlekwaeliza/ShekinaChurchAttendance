const { Pool } = require('pg');

const isTruthy = (value) => ['1', 'true', 'yes', 'require'].includes(String(value || '').toLowerCase());

function buildPoolConfig() {
  const sslEnabled = isTruthy(process.env.PGSSL || process.env.POSTGRES_SSL);
  const baseConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'church_attendance',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || undefined
      };

  return {
    ...baseConfig,
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 5000),
    ssl: sslEnabled ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function run(text, params = []) {
  const result = await query(text, params);
  return { changes: result.rowCount, rows: result.rows };
}

async function get(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function all(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const helpers = {
      query: (text, params = []) => client.query(text, params),
      run: async (text, params = []) => {
        const result = await client.query(text, params);
        return { changes: result.rowCount, rows: result.rows };
      },
      get: async (text, params = []) => {
        const result = await client.query(text, params);
        return result.rows[0] || null;
      },
      all: async (text, params = []) => {
        const result = await client.query(text, params);
        return result.rows;
      }
    };

    const value = await callback(helpers);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function checkConnection() {
  const startedAt = Date.now();
  const result = await query('SELECT current_database() AS database, current_user AS user, version() AS version');
  return {
    ok: true,
    latency_ms: Date.now() - startedAt,
    database: result.rows[0].database,
    user: result.rows[0].user,
    version: result.rows[0].version
  };
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  run,
  get,
  all,
  transaction,
  checkConnection,
  close
};
