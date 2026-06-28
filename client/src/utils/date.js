function pad2(value) {
  return String(value).padStart(2, '0');
}

export function parseLocalDate(value = new Date()) {
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

export function startOfLocalDay(value = new Date()) {
  const date = parseLocalDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatLocalDate(value = new Date()) {
  const date = startOfLocalDay(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function addDays(value, days) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function getWeekStartString(value = new Date()) {
  const date = startOfLocalDay(value);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return formatLocalDate(date);
}

export function formatDisplayDate(value, options = {}) {
  const date = parseLocalDate(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  }).format(date);
}

export function formatEATDate(value, options = {}) {
  if (!value) return '-';
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function formatEATTime(value, options = {}) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).format(date)} EAT`;
}

export function formatEATDateTime(value, options = {}) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).format(date).replace(',', '') + ' EAT';
}

export function formatEATDateTimeParts(value) {
  if (!value) return { date: '-', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: String(value), time: '' };
  return {
    date: formatEATDate(value),
    time: formatEATTime(value),
  };
}
