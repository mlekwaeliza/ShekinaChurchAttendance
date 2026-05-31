const sqlDialect = require('../utils/sqlDialect');

describe('SQL dialect helper', () => {
  const originalClient = process.env.DB_CLIENT;

  afterEach(() => {
    if (originalClient === undefined) {
      delete process.env.DB_CLIENT;
    } else {
      process.env.DB_CLIENT = originalClient;
    }
  });

  test('emits SQLite date expressions by default', () => {
    delete process.env.DB_CLIENT;

    expect(sqlDialect.yearEquals('a.date')).toBe("strftime('%Y', a.date) = ?");
    expect(sqlDialect.monthDay('m.date_of_birth')).toBe("strftime('%m-%d', m.date_of_birth)");
    expect(sqlDialect.upsertAttendanceSql()).toContain('INSERT OR REPLACE INTO attendance');
  });

  test('emits PostgreSQL date expressions when DB_CLIENT is postgres', () => {
    process.env.DB_CLIENT = 'postgres';

    expect(sqlDialect.yearEquals('a.date')).toBe("EXTRACT(YEAR FROM a.date::date)::text = ?");
    expect(sqlDialect.monthDay('m.date_of_birth')).toBe("TO_CHAR(m.date_of_birth::date, 'MM-DD')");
    expect(sqlDialect.upsertAttendanceSql()).toContain('ON CONFLICT (member_id, date)');
  });
});
