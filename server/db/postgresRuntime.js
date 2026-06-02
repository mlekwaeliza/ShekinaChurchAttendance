const { pool } = require('./postgres');

let transactionClient = null;

function toPostgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function maybeReturningId(sql) {
  const trimmed = sql.trim();
  if (!/^insert\s+/i.test(trimmed) || /\sreturning\s+/i.test(trimmed)) {
    return sql;
  }
  return `${sql} RETURNING id`;
}

function normalizeArgs(params, callback) {
  if (typeof params === 'function') {
    return { params: [], callback: params };
  }
  return { params: params || [], callback };
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
  const client = transactionClient || pool;
  return client.query(normalizedSql, params);
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

    const result = await execute(maybeReturningId(sql), params);
    return {
      changes: result.rowCount,
      lastID: result.rows[0]?.id || null,
      rows: result.rows
    };
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
