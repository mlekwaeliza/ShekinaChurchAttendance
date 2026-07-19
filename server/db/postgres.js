const { Pool } = require('pg');

const isTruthy = (value) => ['1', 'true', 'yes', 'require'].includes(String(value || '').toLowerCase());
const isFalsy = (value) => ['0', 'false', 'no', 'off'].includes(String(value || '').toLowerCase());

function buildPoolConfig() {
  let connectionString = process.env.DATABASE_URL || null;

  // Strip unsupported query params from Neon connection string:
  // - channel_binding: not supported by the `pg` library
  // - options: Neon rejects search_path as a startup parameter
  if (connectionString) {
    try {
      const url = new URL(connectionString);
      url.searchParams.delete('channel_binding');
      url.searchParams.delete('options');
      connectionString = url.toString();
    } catch (_) { /* not a parseable URL — use as-is */ }
  }

  // Detect SSL mode from the connection string or env vars
  const sslInUrl = /sslmode\s*=\s*(require|prefer|verify-ca|verify-full)/i.test(process.env.DATABASE_URL || '');
  const sslEnabled = isTruthy(process.env.PGSSL || process.env.POSTGRES_SSL) || sslInUrl;

  // For Neon (sslmode=require), we need SSL but can't verify the cert
  // because Neon uses SNI-based routing. Set rejectUnauthorized=false
  // unless explicitly overridden.
  const rejectUnauthorized = process.env.PG_REJECT_UNAUTHORIZED === undefined
    ? false  // Neon requires false; override with PG_REJECT_UNAUTHORIZED=true for self-signed
    : !isFalsy(process.env.PG_REJECT_UNAUTHORIZED);

  const baseConfig = connectionString
    ? { connectionString }
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
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000),
    ssl: sslEnabled ? { rejectUnauthorized } : false
  };
}

const poolConfig = buildPoolConfig();

const pool = new Pool(poolConfig);

// Set search_path on every new physical connection. This works together with
// the database-level ALTER DATABASE SET search_path (set on startup) to
// ensure all queries can find tables in the public schema. Neon's PgBouncer
// pooler resets session state between transactions, but the database-level
// default and this on-connect hook together cover all cases.
pool.on('connect', (client) => {
  client.query('SET search_path TO public').catch((err) => {
    console.error('Failed to set search_path on new PG connection:', err.message);
  });
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// M2: Startup warning if cert verification is disabled.
if (poolConfig.ssl && poolConfig.ssl.rejectUnauthorized === false) {
  console.warn(
    '[security] PG SSL cert verification is DISABLED. ' +
    'Set PG_REJECT_UNAUTHORIZED=true (and use sslmode=verify-full ' +
    'in DATABASE_URL) to enable MITM protection.'
  );
}

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
