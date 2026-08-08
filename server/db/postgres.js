const { Pool } = require('pg');
const dns = require('dns');

const isTruthy = (value) => ['1', 'true', 'yes', 'require'].includes(String(value || '').toLowerCase());
const isFalsy = (value) => ['0', 'false', 'no', 'off'].includes(String(value || '').toLowerCase());

// Clean up connection string parameters unsupported by pg library or pg_dump
function cleanConnectionString(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('pgbouncer');
    u.searchParams.delete('channel_binding');
    u.searchParams.delete('options');
    return u.toString();
  } catch (_) {
    return url;
  }
}

function buildPoolConfig() {
  let connectionString = process.env.DATABASE_URL || null;

  if (connectionString) {
    connectionString = cleanConnectionString(connectionString);
  }

  // Detect SSL mode from the connection string or env vars
  const sslInUrl = /sslmode\s*=\s*(require|prefer|verify-ca|verify-full)/i.test(process.env.DATABASE_URL || '');
  const sslEnabled = isTruthy(process.env.PGSSL || process.env.POSTGRES_SSL) || sslInUrl;

  const rejectUnauthorized = process.env.PG_REJECT_UNAUTHORIZED === undefined
    ? false
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

  const config = {
    ...baseConfig,
    lookup: (hostname, options, callback) => dns.lookup(hostname, { ...options, family: 4 }, callback),
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000),
    ssl: sslEnabled ? { rejectUnauthorized } : false
  };

  return config;
}

const poolConfig = buildPoolConfig();

const pool = new Pool(poolConfig);

// Set search_path on every new physical connection
pool.on('connect', (client) => {
  client.query('SET search_path TO public').catch((err) => {
    console.error('Failed to set search_path on new PG connection:', err.message);
  });
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Wrapper: pool.query with error logging
async function query(text, params) {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (err) {
    console.error('Query error:', err.message, '\nSQL:', text.slice(0, 200));
    throw err;
  }
}

async function run(text, params) {
  const result = await pool.query(text, params);
  return { changes: result.rowCount, lastID: result.rows?.[0]?.id };
}

async function get(text, params) {
  const result = await pool.query(text, params);
  return result.rows[0] || undefined;
}

async function all(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      query: (text, params) => client.query(text, params),
      run: async (text, params) => {
        const r = await client.query(text, params);
        return { changes: r.rowCount, lastID: r.rows?.[0]?.id };
      },
      get: async (text, params) => {
        const r = await client.query(text, params);
        return r.rows[0];
      },
      all: async (text, params) => {
        const r = await client.query(text, params);
        return r.rows;
      },
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function checkConnection() {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, run, get, all, transaction, checkConnection, close };
