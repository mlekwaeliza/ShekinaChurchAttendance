const {
  addDays,
  formatLocalDate,
  formatMonthDay,
  getWeekStartString,
  parseDateInput,
  startOfLocalDay
} = require('../utils/date');

describe('server date utilities', () => {
  test('parseDateInput keeps YYYY-MM-DD on the intended local calendar day', () => {
    const date = parseDateInput('2026-04-26');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(26);
  });

  test('formatLocalDate does not drift across the local day boundary', () => {
    const date = new Date(2026, 3, 26, 23, 45, 30);

    expect(formatLocalDate(date)).toBe('2026-04-26');
  });

  test('startOfLocalDay resets the time without changing the local day', () => {
    const date = startOfLocalDay('2026-04-26');

    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
    expect(formatMonthDay(date)).toBe('04-26');
  });

  test('getWeekStartString returns the Monday for a Sunday input', () => {
    expect(getWeekStartString('2026-04-26')).toBe('2026-04-20');
  });

  test('addDays works consistently with ISO-like date strings', () => {
    expect(formatLocalDate(addDays('2026-04-26', -1))).toBe('2026-04-25');
  });
});
