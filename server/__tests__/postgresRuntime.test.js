// Postgres runtime adapter tests. The pg Pool is mocked so tests never need a
// live database; PG_QUERY_CONCURRENCY is pinned so gate behaviour is
// deterministic regardless of the host environment.
process.env.PG_QUERY_CONCURRENCY = '2';

jest.mock('../db/postgres', () => {
  const pool = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn().mockResolvedValue(),
    on: jest.fn()
  };
  return { pool };
});

const { db, runAsync, allAsync, toPostgresSql } = require('../db/postgresRuntime');

function makeClient() {
  const client = { query: jest.fn(), release: jest.fn() };
  client.query.mockImplementation(async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }
    if (/INSERT/i.test(sql)) return { rows: [{ id: 7 }], rowCount: 1 };
    if (/^SELECT/i.test(sql)) return { rows: [{ id: 9 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  return client;
}

describe('PostgreSQL runtime adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('converts SQLite placeholders to PostgreSQL placeholders in order', () => {
    expect(toPostgresSql('SELECT * FROM members WHERE section_id = ? AND leader_id = ?')).toBe(
      'SELECT * FROM members WHERE section_id = $1 AND leader_id = $2'
    );
  });

  test('keeps PostgreSQL casts attached to converted placeholders', () => {
    expect(toPostgresSql('SELECT ?::date <= created_at::date')).toBe(
      'SELECT $1::date <= created_at::date'
    );
  });

  test('db.transaction runs BEGIN/COMMIT on one dedicated client', async () => {
    const { pool } = require('../db/postgres');
    const client = makeClient();
    pool.connect.mockResolvedValue(client);

    const result = await db.transaction(async (tx) => {
      const insert = await tx.run('INSERT INTO users (username) VALUES (?)', ['alice']);
      const row = await tx.get('SELECT id FROM users WHERE username = ?', ['alice']);
      const rows = await tx.all('SELECT * FROM users');
      return { lastID: insert.lastID, id: row.id, count: rows.length };
    });

    expect(result).toEqual({ lastID: 7, id: 9, count: 1 });
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();

    const calls = client.query.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe('BEGIN');
    expect(calls).toContain('COMMIT');
    expect(calls).toContain('INSERT INTO users (username) VALUES ($1) RETURNING id');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('db.transaction rolls back and rethrows on callback error', async () => {
    const { pool } = require('../db/postgres');
    const client = makeClient();
    pool.connect.mockResolvedValue(client);

    await expect(db.transaction(async () => {
      throw new Error('nope');
    })).rejects.toThrow('nope');

    const calls = client.query.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('runAsync executes independent queries in parallel up to the gate limit', async () => {
    const { pool } = require('../db/postgres');
    const resolvers = [];
    pool.query.mockImplementation(
      () => new Promise((resolve) => resolvers.push(() => resolve({ rows: [], rowCount: 0 })))
    );

    const pending = Array.from({ length: 6 }, (_, i) => allAsync(`SELECT ${i}`));

    await new Promise((r) => setTimeout(r, 0));
    expect(pool.query).toHaveBeenCalledTimes(2);

    // Drain in waves: resolve the in-flight batch, then let the next batch start.
    while (resolvers.length > 0) {
      resolvers.splice(0).forEach((resolve) => resolve());
      await new Promise((r) => setTimeout(r, 0));
    }

    await Promise.all(pending);
    expect(pool.query).toHaveBeenCalledTimes(6);
  });

  test('runAsync self-heals tables without an id column', async () => {
    const { pool } = require('../db/postgres');
    pool.query
      .mockRejectedValueOnce(Object.assign(new Error('column "id" does not exist'), { message: 'column "id" does not exist' }))
      .mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await runAsync('INSERT INTO no_id_thing (key, name) VALUES (?, ?)', ['a1', 'first']);
    expect(result.lastID).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][0]).toBe('INSERT INTO no_id_thing (key, name) VALUES ($1, $2) RETURNING id');
    expect(pool.query.mock.calls[1][0]).toBe('INSERT INTO no_id_thing (key, name) VALUES ($1, $2)');
  });

  test('runAsync rejects direct transaction control commands', async () => {
    await expect(runAsync('BEGIN')).rejects.toThrow('use db.transaction()');
    await expect(runAsync('COMMIT')).rejects.toThrow('use db.transaction()');
  });
});
