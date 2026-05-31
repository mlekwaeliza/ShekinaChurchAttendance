function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseDateInput(value = new Date()) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  return new Date(value);
}

function startOfLocalDay(value = new Date()) {
  const date = parseDateInput(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatLocalDate(value = new Date()) {
  const date = startOfLocalDay(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatMonthDay(value = new Date()) {
  const date = startOfLocalDay(value);
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(value, days) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

function addMonths(value, months) {
  const date = startOfLocalDay(value);
  date.setMonth(date.getMonth() + months);
  return date;
}

function getWeekStartDate(value = new Date()) {
  const date = startOfLocalDay(value);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function getWeekStartString(value = new Date()) {
  return formatLocalDate(getWeekStartDate(value));
}

module.exports = {
  addDays,
  addMonths,
  formatLocalDate,
  formatMonthDay,
  getWeekStartDate,
  getWeekStartString,
  parseDateInput,
  startOfLocalDay
};
