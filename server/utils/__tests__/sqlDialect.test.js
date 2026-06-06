const path = require('path');

function freshRequire(modulePath) {
  const abs = require.resolve(modulePath);
  delete require.cache[abs];
  return require(modulePath);
}

function withEnv(key, value, fn) {
  const prev = process.env[key];
  process.env[key] = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

const dialectPath = path.join(__dirname, '..', 'sqlDialect.js');

describe('sqlDialect.monthsAgo', () => {
  test('postgres: 6 months (inline literal)', () => {
    withEnv('DB_CLIENT', 'postgres', () => {
      const d = freshRequire(dialectPath);
      expect(d.monthsAgo(6)).toBe("CURRENT_TIMESTAMP - (6::int * INTERVAL '1 month')");
    });
  });

  test('postgres: parameterised "?" placeholder', () => {
    withEnv('DB_CLIENT', 'postgres', () => {
      const d = freshRequire(dialectPath);
      expect(d.monthsAgo('?')).toBe("CURRENT_TIMESTAMP - (?::int * INTERVAL '1 month')");
    });
  });

  test('sqlite: 6 months (inline literal)', () => {
    withEnv('DB_CLIENT', 'sqlite', () => {
      const d = freshRequire(dialectPath);
      expect(d.monthsAgo(6)).toBe("DATETIME('now', '-' || 6 || ' months')");
    });
  });

  test('sqlite: parameterised "?" placeholder', () => {
    withEnv('DB_CLIENT', 'sqlite', () => {
      const d = freshRequire(dialectPath);
      expect(d.monthsAgo('?')).toBe("DATETIME('now', '-' || ? || ' months')");
    });
  });
});

describe('sqlDialect.likeEscapePattern (dialect-agnostic)', () => {
  // Output must be byte-identical in both drivers.
  const cases = [
    ['', ''],
    ['normal', 'normal'],
    ['%', '\\%'],
    ['_', '\\_'],
    ['\\', '\\\\'],
    ['%_\\', '\\%\\_\\\\'],
    ['50%_off', '50\\%\\_off'],
    ['no specials', 'no specials'],
    ['underscore_in_word', 'underscore\\_in\\_word'],
    ['C:\\path\\to\\file', 'C:\\\\path\\\\to\\\\file']
  ];

  test.each(cases)('input=%j -> %j in postgres', (input, expected) => {
    withEnv('DB_CLIENT', 'postgres', () => {
      const d = freshRequire(dialectPath);
      expect(d.likeEscapePattern(input)).toBe(expected);
    });
  });

  test.each(cases)('input=%j -> %j in sqlite', (input, expected) => {
    withEnv('DB_CLIENT', 'sqlite', () => {
      const d = freshRequire(dialectPath);
      expect(d.likeEscapePattern(input)).toBe(expected);
    });
  });
});

describe('sqlDialect.likeClause', () => {
  test('postgres: returns "LIKE ? ESCAPE \'\\\'" (dialect-agnostic)', () => {
    withEnv('DB_CLIENT', 'postgres', () => {
      const d = freshRequire(dialectPath);
      expect(d.likeClause()).toBe("LIKE ? ESCAPE '\\'");
    });
  });

  test('sqlite: returns "LIKE ? ESCAPE \'\\\'" (dialect-agnostic)', () => {
    withEnv('DB_CLIENT', 'sqlite', () => {
      const d = freshRequire(dialectPath);
      expect(d.likeClause()).toBe("LIKE ? ESCAPE '\\'");
    });
  });
});

describe('composed SQL is correct', () => {
  test('audit-log search query composes valid SQL', () => {
    withEnv('DB_CLIENT', 'postgres', () => {
      const d = freshRequire(dialectPath);
      const search = '50%_off';
      const pattern = `%${d.likeEscapePattern(search)}%`;
      const sql = `SELECT 1 FROM audit_log al WHERE al.old_value ${d.likeClause()} OR al.new_value ${d.likeClause()}`;
      expect(sql).toBe("SELECT 1 FROM audit_log al WHERE al.old_value LIKE ? ESCAPE '\\' OR al.new_value LIKE ? ESCAPE '\\'");
      expect(pattern).toBe('%50\\%\\_off%');
    });
  });
});
