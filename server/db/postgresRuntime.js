const { pool } = require('./postgres');

let transactionClient = null;

// Tables whose primary key is not `id` (e.g. `key TEXT PRIMARY KEY`).
// `maybeReturningId` won't append `RETURNING id` to INSERTs targeting these,
// and `runAsync` self-heals this set if it encounters a "column id does not
// exist" error on first insert into a previously-unknown no-id table.
const TABLES_WITHOUT_ID = new Set(['performance_penalties', 'achievements']);

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
  const safe = (params || []).map(p => p === undefined ? null : p);
  return { params: safe, callback };
}

// Sequential Execution Queue to prevent PG command concurrency errors
let queryQueue = Promise.resolve();

function enqueue(fn) {
  const next = new Promise((resolve, reject) => {
    queryQueue.then(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
  queryQueue = next.catch(() => {});
  return next;
}

async function execute(sql, params = []) {
  const normalizedSql = toPostgresSql(sql);
  const safe = params.map(p => p === undefined ? null : p);

  // When using the pool (not a transaction client), acquire a dedicated
  // connection so we can set search_path before the query. Neon's pooler
  // resets session state between checkouts, so this ensures every query
  // runs with the correct search_path.
  if (transactionClient) {
    return transactionClient.query(normalizedSql, safe);
  }
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO public');
    return await client.query(normalizedSql, safe);
  } finally {
    client.release();
  }
}

async function runAsync(sql, params = []) {
  return enqueue(async () => {
    const command = sql.trim().toUpperCase();

    if (command === 'BEGIN TRANSACTION' || command === 'BEGIN') {
      if (transactionClient) {
        throw new Error('A PostgreSQL transaction is already active');
      }
      transactionClient = await pool.connect();
      await transactionClient.query('BEGIN');
      return { changes: 0, lastID: null };
    }

    if (command === 'COMMIT') {
      if (!transactionClient) return { changes: 0, lastID: null };
      const client = transactionClient;
      transactionClient = null;
      try {
        await client.query('COMMIT');
        return { changes: 0, lastID: null };
      } finally {
        client.release();
      }
    }

    if (command === 'ROLLBACK') {
      if (!transactionClient) return { changes: 0, lastID: null };
      const client = transactionClient;
      transactionClient = null;
      try {
        await client.query('ROLLBACK');
        return { changes: 0, lastID: null };
      } finally {
        client.release();
      }
    }

    try {
      const result = await execute(maybeReturningId(sql), params);
      return {
        changes: result.rowCount,
        lastID: result.rows[0]?.id || null,
        rows: result.rows
      };
    } catch (err) {
      // Self-heal: if `RETURNING id` was appended but the target table has
      // no `id` column, remember the table and retry the INSERT bare.
      if (err && /column "id" does not exist/i.test(err.message)) {
        const table = extractTableName(sql);
        if (table) TABLES_WITHOUT_ID.add(table);
        const result = await execute(sql, params);
        return {
          changes: result.rowCount,
          lastID: null,
          rows: result.rows
        };
      }
      throw err;
    }
  });
}

async function getAsync(sql, params = []) {
  return enqueue(async () => {
    const result = await execute(sql, params);
    return result.rows[0] || null;
  });
}

async function allAsync(sql, params = []) {
  return enqueue(async () => {
    const result = await execute(sql, params);
    return result.rows;
  });
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
    const nextExec = () => enqueue(() => execute(sql));
    callbackify(nextExec(), callback);
  },

  close(callback) {
    pool.end()
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
