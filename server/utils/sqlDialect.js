const isPostgres = () => String(process.env.DB_CLIENT || '').toLowerCase() === 'postgres';

function yearEquals(column) {
  return isPostgres()
    ? `EXTRACT(YEAR FROM ${column}::date)::text = ?`
    : `strftime('%Y', ${column}) = ?`;
}

function monthEquals(column) {
  return isPostgres()
    ? `TO_CHAR(${column}::date, 'YYYY-MM') = ?`
    : `strftime('%Y-%m', ${column}) = ?`;
}

function weekEquals(column) {
  return isPostgres()
    ? `TO_CHAR(${column}::date, 'IYYY-IW') = ?`
    : `strftime('%Y-%W', ${column}) = ?`;
}

function monthDay(column) {
  return isPostgres()
    ? `TO_CHAR(${column}::date, 'MM-DD')`
    : `strftime('%m-%d', ${column})`;
}

function monthNumber(column) {
  return isPostgres()
    ? `TO_CHAR(${column}::date, 'MM')`
    : `strftime('%m', ${column})`;
}

function yearNumber(column) {
  return isPostgres()
    ? `TO_CHAR(${column}::date, 'YYYY')`
    : `strftime('%Y', ${column})`;
}

function dateOnly(column) {
  return isPostgres()
    ? `${column}::date`
    : `date(${column})`;
}

function pendingNowExpression() {
  return isPostgres() ? 'CURRENT_TIMESTAMP' : "DATETIME('now')";
}

function nowMinusHours(hoursParam = '?') {
  return isPostgres()
    ? `CURRENT_TIMESTAMP + (${hoursParam}::int * INTERVAL '1 hour')`
    : `DATETIME('now', '+' || ${hoursParam} || ' hours')`;
}

// monthsAgo(months) -> dialect-correct expression for "now minus N months".
// Use as: WHERE soft_deleted_at <= ${monthsAgo(6)}
// On Postgres: CURRENT_TIMESTAMP - $1::int * INTERVAL '1 month'
// On SQLite:   DATETIME('now', '-' || $1 || ' months')
function monthsAgo(monthsParam = '?') {
  return isPostgres()
    ? `CURRENT_TIMESTAMP - (${monthsParam}::int * INTERVAL '1 month')`
    : `DATETIME('now', '-' || ${monthsParam} || ' months')`;
}

// Escape % and _ for use inside a LIKE pattern, returning a parameterised
// pattern fragment. The escape character is appended in a way that both
// PG (LIKE '...' ESCAPE '\\') and SQLite (LIKE '...' ESCAPE '\') accept.
//
// Usage:  const pattern = `%${likeEscapePattern(userInput)}%`
//         db.run("... LIKE ? ESCAPE '\\\\'", [pattern])
function likeEscapePattern(value) {
  const ESCAPE = '\\';
  return String(value)
    .replace(/\\/g, ESCAPE + ESCAPE)
    .replace(/%/g, ESCAPE + '%')
    .replace(/_/g, ESCAPE + '_');
}

// likeClause() -> the LIKE pattern fragment "LIKE ? ESCAPE '\\'".
// Use as: `${column} ${likeClause()}` in dynamic SQL, with the bound
// param being `%${likeEscapePattern(value)}%`.
function likeClause() {
  return `LIKE ? ESCAPE '\\'`;
}

function upsertAttendanceSql({ includeServiceType = false } = {}) {
  if (isPostgres()) {
    return includeServiceType
      ? `INSERT INTO attendance (member_id, date, status, service_type_id, submitted_by, submitted_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (member_id, date, service_type_id)
         DO UPDATE SET status = EXCLUDED.status,
                       service_type_id = EXCLUDED.service_type_id,
                       submitted_by = EXCLUDED.submitted_by,
                       submitted_at = CURRENT_TIMESTAMP`
      : `INSERT INTO attendance (member_id, date, status, submitted_by, submitted_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (member_id, date)
         DO UPDATE SET status = EXCLUDED.status,
                       submitted_by = EXCLUDED.submitted_by,
                       submitted_at = CURRENT_TIMESTAMP`;
  }

  return includeServiceType
    ? `INSERT OR REPLACE INTO attendance (member_id, date, status, service_type_id, submitted_by, submitted_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    : `INSERT OR REPLACE INTO attendance (member_id, date, status, submitted_by, submitted_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
}

module.exports = {
  isPostgres,
  yearEquals,
  monthEquals,
  weekEquals,
  monthDay,
  monthNumber,
  yearNumber,
  dateOnly,
  pendingNowExpression,
  nowMinusHours,
  monthsAgo,
  likeEscapePattern,
  likeClause,
  upsertAttendanceSql
};
