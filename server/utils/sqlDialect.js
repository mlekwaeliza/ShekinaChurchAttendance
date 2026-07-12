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

// likeClauseCaseInsensitive() -> "ILIKE ? ESCAPE '\\'" on PostgreSQL,
// "LIKE ? ESCAPE '\\'" on SQLite (SQLite LIKE is ASCII-case-insensitive
// by default).  Drop-in replacement for likeClause when the search
// should be case-insensitive on both databases.
function likeClauseCaseInsensitive() {
  return isPostgres() ? `ILIKE ? ESCAPE '\\'` : `LIKE ? ESCAPE '\\'`;
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

// todayDate() -> dialect-correct expression for today's date
// On Postgres: CURRENT_DATE
// On SQLite:   date('now')
function todayDate() {
  return isPostgres() ? 'CURRENT_DATE' : "date('now')";
}

// daysAgo(n) -> dialect-correct expression for "today minus N days"
// On Postgres: CURRENT_DATE - ($1::int * INTERVAL '1 day')
// On SQLite:   date('now', '-N days')
// Use as a value in WHERE clauses: WHERE date >= ${daysAgo(7)}
function daysAgo(daysParam = '?') {
  return isPostgres()
    ? `CURRENT_DATE - (${daysParam}::int * INTERVAL '1 day')`
    : `date('now', '-' || ${daysParam} || ' days')`;
}

// monthsAgoDate(n) -> dialect-correct expression for "today minus N months"
// On Postgres: CURRENT_DATE - ($1::int * INTERVAL '1 month')
// On SQLite:   date('now', '-N months')
function monthsAgoDate(monthsParam = '?') {
  return isPostgres()
    ? `CURRENT_DATE - (${monthsParam}::int * INTERVAL '1 month')`
    : `date('now', '-' || ${monthsParam} || ' months')`;
}

// weeksAgo(n) -> dialect-correct expression for "today minus N weeks"
// On Postgres: CURRENT_DATE - ($1::int * INTERVAL '1 week')
// On SQLite:   date('now', '-N weeks')
function weeksAgo(weeksParam = '?') {
  return isPostgres()
    ? `CURRENT_DATE - (${weeksParam}::int * INTERVAL '1 week')`
    : `date('now', '-' || ${weeksParam} || ' weeks')`;
}

// dayOfWeek(column) -> integer day of week (0=Sunday, 6=Saturday)
// On Postgres: EXTRACT(DOW FROM column::date)::int
// On SQLite:   CAST(strftime('%w', column) AS INTEGER)
function dayOfWeek(column) {
  return isPostgres()
    ? `EXTRACT(DOW FROM ${column}::date)::int`
    : `CAST(strftime('%w', ${column}) AS INTEGER)`;
}

// dayOfMonth(column) -> integer day of month
// On Postgres: EXTRACT(DAY FROM column::date)::int
// On SQLite:   CAST(strftime('%d', column) AS INTEGER)
function dayOfMonth(column) {
  return isPostgres()
    ? `EXTRACT(DAY FROM ${column}::date)::int`
    : `CAST(strftime('%d', ${column}) AS INTEGER)`;
}

// yearMonth(column) -> 'YYYY-MM' string
// On Postgres: TO_CHAR(column::date, 'YYYY-MM')
// On SQLite:   strftime('%Y-%m', column)
function yearMonth(column) {
  return isPostgres()
    ? `TO_CHAR(${column}::date, 'YYYY-MM')`
    : `strftime('%Y-%m', ${column})`;
}

// yearMonthFirst(column) -> 'YYYY-MM-01' string (first day of month)
// On Postgres: TO_CHAR(column::date, 'YYYY-MM-01')
// On SQLite:   strftime('%Y-%m-01', column)
function yearMonthFirst(column) {
  return isPostgres()
    ? `TO_CHAR(${column}::date, 'YYYY-MM-01')`
    : `strftime('%Y-%m-01', ${column})`;
}

// yearOnly(column) -> 'YYYY' string
// On Postgres: EXTRACT(YEAR FROM column::date)::text
// On SQLite:   strftime('%Y', column)
function yearOnly(column) {
  return isPostgres()
    ? `EXTRACT(YEAR FROM ${column}::date)::text`
    : `strftime('%Y', ${column})`;
}

// monthOnly(column) -> 'MM' string
// On Postgres: TO_CHAR(column::date, 'MM')
// On SQLite:   strftime('%m', column)
function monthOnly(column) {
  return isPostgres()
    ? `TO_CHAR(${column}::date, 'MM')`
    : `strftime('%m', ${column})`;
}

// daysAgoRange(days) -> { start, end } with dialect-correct expressions
// end = todayDate(), start = daysAgo(days)
function daysAgoRange(daysParam = '?') {
  return {
    start: daysAgo(daysParam),
    end: todayDate(),
  };
}

// ── Aggregate rounding helpers ────────────────────────────────────────────
//
// PostgreSQL's ROUND(x, n) requires x to be NUMERIC. AVG() returns
// double-precision on Postgres, so CAST(... AS NUMERIC) is mandatory on PG
// but is a safe no-op on SQLite.
//
// Use these helpers instead of writing ROUND(AVG(...)) directly to avoid
// the "function round(double precision, integer) does not exist" error on PG.
//
// roundAvg(caseExpr, multiplier, decimals)
//   For attendance-rate style calculations:
//   ${roundAvg("CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END", 100, 1)}
//   -> ROUND(CAST(AVG(CASE WHEN ...) * 100 AS NUMERIC), 1)
//
function roundAvg(caseExpr, multiplier = 100, decimals = 1) {
  return `ROUND(CAST(AVG(${caseExpr}) * ${multiplier} AS NUMERIC), ${decimals})`;
}

// roundExpr(expr, decimals)
//   Wraps any expression in a Postgres-safe ROUND.
//   ${roundExpr('SUM(x) / NULLIF(COUNT(*), 0) * 100', 1)}
//   -> ROUND(CAST(SUM(x) / NULLIF(COUNT(*), 0) * 100 AS NUMERIC), 1)
//
function roundExpr(expr, decimals = 1) {
  return `ROUND(CAST(${expr} AS NUMERIC), ${decimals})`;
}

// castToNumeric(expr)
//   Explicit cast to NUMERIC — safe on both dialects.
//   ${castToNumeric('SUM(x)')} -> (SUM(x))::numeric  [PG]  or  CAST(SUM(x) AS REAL)  [SQLite]
//
function castToNumeric(expr) {
  return isPostgres() ? `(${expr})::numeric` : `CAST(${expr} AS REAL)`;
}

// timeToSeconds(column) -> seconds since midnight from a DATETIME/TIMESTAMPTZ column
// On Postgres: EXTRACT(EPOCH FROM (column::time))
// On SQLite:   strftime('%H', column) * 3600 + strftime('%M', column) * 60 + strftime('%S', column)
function timeToSeconds(column) {
  return isPostgres()
    ? `EXTRACT(EPOCH FROM (${column}::time))::int`
    : `(CAST(strftime('%H', ${column}) AS INTEGER) * 3600 + CAST(strftime('%M', ${column}) AS INTEGER) * 60 + CAST(strftime('%S', ${column}) AS INTEGER))`;
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
  likeClauseCaseInsensitive,
  upsertAttendanceSql,
  todayDate,
  daysAgo,
  daysAgoRange,
  monthsAgoDate,
  weeksAgo,
  dayOfWeek,
  dayOfMonth,
  yearMonth,
  yearMonthFirst,
  yearOnly,
  monthOnly,
  // Postgres-safe rounding helpers
  roundAvg,
  roundExpr,
  castToNumeric,
  // Time helpers
  timeToSeconds,
};
