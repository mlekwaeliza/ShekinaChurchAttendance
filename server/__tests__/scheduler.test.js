// Tests for processPendingReminders null-leader guard.
// The bug: birthday_greeting / follow_up_reminder payloads with a null
// leader_user_id caused `createNotification` to violate the
// notifications.user_id NOT NULL constraint. The reminder stayed unsent
// and the error recurred every 15 minutes.
//
// The fix: skip the notification if leader_user_id is missing AND mark
// the reminder sent (so the queue drains cleanly). Also wrap each
// reminder in its own try/catch so a single bad reminder can't poison
// the loop.
const path = require('path');

describe('processPendingReminders null-leader guard', () => {
  let createdNotifications;
  let markedSent;
  let warnLogs;
  let originalWarn;
  let originalError;
  let scheduler;

  beforeEach(() => {
    jest.resetModules();
    createdNotifications = [];
    markedSent = [];
    warnLogs = [];
    originalWarn = console.warn;
    originalError = console.error;
    console.warn = (msg) => warnLogs.push(String(msg));
    console.error = () => {};
  });

  afterEach(() => {
    console.warn = originalWarn;
    console.error = originalError;
  });

  function loadSchedulerWithMocks(reminders) {
    jest.doMock(path.resolve(__dirname, '../database'), () => ({
      queries: {
        getPendingReminders: jest.fn().mockResolvedValue(reminders),
        getWeeklySummary: jest.fn().mockResolvedValue([]),
        createNotification: jest.fn().mockImplementation((userId, type, title, message, entityType, entityId) => {
          if (userId == null) {
            return Promise.reject(new Error('null value in column "user_id" violates not-null constraint'));
          }
          createdNotifications.push({ userId, type, title, message, entityType, entityId });
          return Promise.resolve();
        }),
        markReminderSent: jest.fn().mockImplementation((id) => {
          markedSent.push(id);
          return Promise.resolve();
        }),
      },
      all: jest.fn().mockResolvedValue([]),
      run: jest.fn().mockResolvedValue({}),
      db: {},
    }));
    jest.doMock(path.resolve(__dirname, '../utils/date'), () => ({
      addDays: (d) => d,
      formatMonthDay: () => '06-07',
      getWeekStartString: () => '2026-06-01',
      startOfLocalDay: (d) => d,
    }));
    jest.doMock(path.resolve(__dirname, '../utils/sqlDialect'), () => ({
      monthsAgo: () => 'now()',
    }));
    scheduler = require('../scheduler');
  }

  test('birthday_greeting with null leader_user_id is skipped and reminder is marked sent', async () => {
    loadSchedulerWithMocks([
      {
        id: 100,
        type: 'birthday_greeting',
        entity_id: 3951,
        payload: JSON.stringify({ member_id: 3951, member_name: 'Anonymous', section_name: 'Unknown', leader_user_id: null }),
      },
    ]);

    await scheduler.processPendingReminders();

    expect(createdNotifications).toHaveLength(0);
    expect(markedSent).toEqual([100]);
    expect(warnLogs.some((m) => m.includes('Birthday reminder 100') && m.includes('no leader_user_id'))).toBe(true);
  });

  test('birthday_greeting with valid leader_user_id creates notification', async () => {
    loadSchedulerWithMocks([
      {
        id: 101,
        type: 'birthday_greeting',
        entity_id: 3952,
        payload: JSON.stringify({ member_id: 3952, member_name: 'Jane', section_name: 'East', leader_user_id: 7 }),
      },
    ]);

    await scheduler.processPendingReminders();

    expect(createdNotifications).toHaveLength(1);
    expect(createdNotifications[0]).toMatchObject({
      userId: 7,
      type: 'system',
      title: 'Birthday Today!',
      entityType: 'member',
      entityId: 3952,
    });
    expect(markedSent).toEqual([101]);
  });

  test('follow_up_reminder with null leader_user_id is skipped and marked sent', async () => {
    loadSchedulerWithMocks([
      {
        id: 200,
        type: 'follow_up_reminder',
        entity_id: 3953,
        payload: JSON.stringify({ member_id: 3953, member_name: 'Bob', leader_user_id: null }),
      },
    ]);

    await scheduler.processPendingReminders();

    expect(createdNotifications).toHaveLength(0);
    expect(markedSent).toEqual([200]);
    expect(warnLogs.some((m) => m.includes('Follow-up reminder 200') && m.includes('no leader_user_id'))).toBe(true);
  });

  test('weekly_summary with null entity_id is skipped', async () => {
    loadSchedulerWithMocks([
      { id: 300, type: 'weekly_summary', entity_id: null, payload: null },
    ]);

    await scheduler.processPendingReminders();

    expect(createdNotifications).toHaveLength(0);
    expect(markedSent).toEqual([300]);
    expect(warnLogs.some((m) => m.includes('Weekly summary reminder 300') && m.includes('no entity_id'))).toBe(true);
  });

  test('one bad reminder does not stop the rest of the batch', async () => {
    loadSchedulerWithMocks([
      {
        id: 400,
        type: 'birthday_greeting',
        entity_id: 1,
        payload: JSON.stringify({ member_id: 1, leader_user_id: null }),
      },
      {
        id: 401,
        type: 'birthday_greeting',
        entity_id: 2,
        payload: JSON.stringify({ member_id: 2, leader_user_id: 5 }),
      },
    ]);

    await scheduler.processPendingReminders();

    expect(createdNotifications).toHaveLength(1);
    expect(createdNotifications[0].userId).toBe(5);
    expect(markedSent).toEqual([400, 401]);
  });

  test('createNotification failure on one reminder does not stop the loop', async () => {
    jest.resetModules();
    createdNotifications = [];
    markedSent = [];
    warnLogs = [];
    console.warn = (msg) => warnLogs.push(String(msg));
    console.error = () => {};

    jest.doMock(path.resolve(__dirname, '../database'), () => ({
      queries: {
        getPendingReminders: jest.fn().mockResolvedValue([
          {
            id: 500,
            type: 'birthday_greeting',
            entity_id: 1,
            payload: JSON.stringify({ member_id: 1, leader_user_id: 5 }),
          },
          {
            id: 501,
            type: 'birthday_greeting',
            entity_id: 2,
            payload: JSON.stringify({ member_id: 2, leader_user_id: 6 }),
          },
        ]),
        createNotification: jest.fn().mockImplementation((userId) => {
          if (userId === 5) return Promise.reject(new Error('boom'));
          createdNotifications.push({ userId });
          return Promise.resolve();
        }),
        markReminderSent: jest.fn().mockImplementation((id) => {
          markedSent.push(id);
          return Promise.resolve();
        }),
      },
      all: jest.fn().mockResolvedValue([]),
      run: jest.fn().mockResolvedValue({}),
      db: {},
    }));
    jest.doMock(path.resolve(__dirname, '../utils/date'), () => ({
      addDays: (d) => d,
      formatMonthDay: () => '06-07',
      getWeekStartString: () => '2026-06-01',
      startOfLocalDay: (d) => d,
    }));
    jest.doMock(path.resolve(__dirname, '../utils/sqlDialect'), () => ({
      monthsAgo: () => 'now()',
    }));
    const sched = require('../scheduler');

    await sched.processPendingReminders();

    expect(createdNotifications).toHaveLength(1);
    expect(createdNotifications[0].userId).toBe(6);
    expect(markedSent).toEqual([500, 501]);
  });
});
