const { pool } = require('./postgres');
const { createQueryGate } = require('./queryGate');

// Tables whose primary key is not `id` (e.g. `key TEXT PRIMARY KEY`).
// `maybeReturningId` won't append `RETURNING id` to INSERTs targeting these,
// and `runAsync` self-heals this set if it encounters a "column id does not
// exist" error on first insert into a previously-unknown no-id table.
const TABLES_WITHOUT_ID = new Set(['performance_penalties', 'achievements']);

// Bounded concurrency: independent queries run in parallel up to this limit.
// Transactions are client-scoped (they never touch the gate), so no exclusive
// mode is needed. Override via PG_QUERY_CONCURRENCY.
const QUERY_CONCURRENCY = (() => {
  const n = Number(process.env.PG_QUERY_CONCURRENCY);
  if (Number.isInteger(n) && n >= 1) return n;
  return 5;
})();
const gate = createQueryGate(QUERY_CONCURRENCY);

function toPostgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function extractTableName(sql) {
  const m = String(sql).trim().match(/^insert\s+into\s+["`]?(\w+)["`]?/i);
  return m ? m[1].toLowerCase() : null;
}

function maybeReturningId(sql) {
  const trimmed = sql.trim();
  if (!/^insert\s+/i.test(trimmed) || /\sreturning\s+/i.test(trimmed)) {
    return sql;
  }
  const table = extractTableName(sql);
  if (table && TABLES_WITHOUT_ID.has(table)) {
    return sql;
  }
  return `${sql} RETURNING id`;
}

function normalizeArgs(params, callback) {
  if (typeof params === 'function') {
    return { params: [], callback: params };
  }
  const safe = (params || []).map((p) => (p === undefined ? null : p));
  return { params: safe, callback };
}

function sanitizeParams(params) {
  return (params || []).map((p) => (p === undefined ? null : p));
}

function isTransactionCommand(sql) {
  const command = String(sql || '').trim().toUpperCase();
  return (
    command === 'BEGIN' ||
    command === 'BEGIN TRANSACTION' ||
    command === 'COMMIT' ||
    command === 'ROLLBACK'
  );
}

async function runOnClient(client, sql, params = []) {
  const safe = sanitizeParams(params);
  try {
    const result = await client.query(toPostgresSql(maybeReturningId(sql)), safe);
    return { changes: result.rowCount, lastID: result.rows[0]?.id || null, rows: result.rows };
  } catch (err) {
    // Self-heal: if `RETURNING id` was appended but the target table has
    // no `id` column, remember the table and retry the INSERT bare.
    if (err && /column "id" does not exist/i.test(err.message)) {
      const table = extractTableName(sql);
      if (table) TABLES_WITHOUT_ID.add(table);
      const result = await client.query(toPostgresSql(sql), safe);
      return { changes: result.rowCount, lastID: null, rows: result.rows };
    }
    throw err;
  }
}

async function getOnClient(client, sql, params = []) {
  const result = await client.query(toPostgresSql(sql), sanitizeParams(params));
  return result.rows[0] || null;
}

async function allOnClient(client, sql, params = []) {
  const result = await client.query(toPostgresSql(sql), sanitizeParams(params));
  return result.rows;
}

// Runs `callback` inside a real PostgreSQL transaction on a dedicated pool
// client. The callback receives promise-based `{ run, get, all }` helpers
// bound to that client, so its statements are atomic and isolated even while
// unrelated queries execute concurrently on the pool. Returns the callback's
// return value.
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      run: (sql, params) => runOnClient(client, sql, params),
      get: (sql, params) => getOnClient(client, sql, params),
      all: (sql, params) => allOnClient(client, sql, params)
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* connection already broken — nothing to roll back */
    }
    throw err;
  } finally {
    client.release();
  }
}

async function runAsync(sql, params = []) {
  if (isTransactionCommand(sql)) {
    throw new Error(
      `Direct transaction control (${String(sql).trim()}) is not supported — use db.transaction()`
    );
  }
  return gate.run(() => runOnClient(pool, sql, params));
}

async function getAsync(sql, params = []) {
  return gate.run(() => getOnClient(pool, sql, params));
}

async function allAsync(sql, params = []) {
  return gate.run(() => allOnClient(pool, sql, params));
}

function callbackify(promise, callback, context = {}) {
  promise
    .then((value) => {
      if (callback) callback.call(context, null, value);
    })
    .catch((error) => {
      if (callback) callback.call(context, error);
      else console.error('PostgreSQL runtime query failed:', error);
    });
}

const db = {
  run(sql, params, callback) {
    const args = normalizeArgs(params, callback);
    runAsync(sql, args.params)
      .then((result) => {
        if (args.callback) {
          args.callback.call({ changes: result.changes, lastID: result.lastID }, null);
        }
      })
      .catch((error) => {
        if (args.callback) args.callback.call({ changes: 0, lastID: null }, error);
        else console.error('PostgreSQL runtime query failed:', error);
      });
  },

  get(sql, params, callback) {
    const args = normalizeArgs(params, callback);
    callbackify(getAsync(sql, args.params), args.callback);
  },

  all(sql, params, callback) {
    const args = normalizeArgs(params, callback);
    callbackify(allAsync(sql, args.params), args.callback);
  },

  serialize(callback) {
    callback();
  },

  exec(sql, callback) {
    callbackify(gate.run(() => pool.query(sql)), callback);
  },

  transaction(callback) {
    return withTransaction(callback);
  },

  close(callback) {
    pool
      .end()
      .then(() => callback && callback(null))
      .catch((error) => callback && callback(error));
  }
};

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync,
  toPostgresSql
};
