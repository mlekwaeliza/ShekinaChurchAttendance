const { toPostgresSql } = require('../db/postgresRuntime');

describe('PostgreSQL runtime adapter', () => {
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
});
