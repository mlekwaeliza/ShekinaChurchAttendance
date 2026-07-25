const { Pool } = require('pg');
const dns = require('dns');

const isTruthy = (value) => ['1', 'true', 'yes', 'require'].includes(String(value || '').toLowerCase());
const isFalsy = (value) => ['0', 'false', 'no', 'off'].includes(String(value || '').toLowerCase());

// Resolve hostname to IPv4 — Supabase DNS may return IPv6
// which some hosting environments (Render) cannot reach.
// For Supabase: automatically switch to pooler endpoint (port 6543) which has IPv4.
function forceIPv4(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname;

    // Supabase direct connection → switch to pooler endpoint (IPv4)
    if (hostname.endsWith('.supabase.co') && u.port === '5432') {
      // Pooler hostname: db.<ref>.supabase.co → aws-0-<region>.pooler.supabase.com
      // But simpler: just change port to 6543 and add pgbouncer=true
      u.port = '6543';
      u.searchParams.set('pgbouncer', 'true');
      console.log(`Supabase: switched to pooler endpoint (port 6543) for IPv4`);
      return u.toString();
    }

    // For other hosts: try to resolve to IPv4
    try {
      const { address } = dns.lookupSync(hostname, { family: 4 });
      if (address && address !== hostname) {
        u.hostname = address;
        console.log(`Resolved ${hostname} -> ${address} (IPv4)`);
        return u.toString();
      }
    } catch (_) {}
  } catch (_) {}
  return url;
}

function buildPoolConfig() {
  let connectionString = process.env.DATABASE_URL || null;

  // Force IPv4 and strip unsupported query params
  if (connectionString) {
    connectionString = forceIPv4(connectionString);
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
