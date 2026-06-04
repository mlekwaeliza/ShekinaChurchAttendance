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

function getISOWeekRange(weekStr) {
  const [yearStr, weekPart] = String(weekStr || '').split('-W');
  const year = Number(yearStr);
  const week = Number(weekPart);

  if (!Number.isInteger(year) || !Number.isInteger(week)) {
    throw new Error('Invalid ISO week format');
  }

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const day = simple.getUTCDay();
  const isoWeekStart = simple;
  if (day <= 4) {
    isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }

  const isoWeekEnd = new Date(isoWeekStart);
  isoWeekEnd.setUTCDate(isoWeekStart.getUTCDate() + 6);

  return {
    start: isoWeekStart.toISOString().slice(0, 10),
    end: isoWeekEnd.toISOString().slice(0, 10)
  };
}

function getISOWeekString(dateValue) {
  const date = new Date(`${formatLocalDate(new Date(dateValue))}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

module.exports = {
  addDays,
  addMonths,
  formatLocalDate,
  formatMonthDay,
  getISOWeekRange,
  getISOWeekString,
  getWeekStartDate,
  getWeekStartString,
  parseDateInput,
  startOfLocalDay
};
