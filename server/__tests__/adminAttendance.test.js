// Tests for admin attendance correction route (PUT /api/admin/attendance/:id).
// Validates:
//   - status whitelist (present/absent/excused)
//   - invalid id (non-integer, non-existent) returns 4xx
//   - no-op (status already matches, no reason) returns 400
//   - successful update writes an audit_log row with old_value + new_value
//   - reason is trimmed and capped at 500 chars
//   - rejects unauthenticated and non-admin requests (full middleware chain)
const path = require('path');
const http = require('http');
const express = require('express');

function loadAndStart(mocks) {
  jest.resetModules();
  jest.doMock(path.resolve(__dirname, '../database'), () => ({
    db: {},
    queries: { createAuditEntry: mocks.createAuditEntry || jest.fn() },
    run: mocks.run || jest.fn().mockResolvedValue({}),
    get: mocks.get || jest.fn().mockResolvedValue(null),
    all: mocks.all || jest.fn().mockResolvedValue([]),
    transaction: jest.fn().mockImplementation(async (cb) => cb({ run: jest.fn().mockResolvedValue({}) })),
  }));
  jest.doMock(path.resolve(__dirname, '../middleware/auth'), () => ({
    isAuthenticated: (req, res, next) => {
      if (mocks.session) { req.session = mocks.session; return next(); }
      return res.status(401).json({ error: 'Not authenticated' });
    },
    requireRole: (roles) => (req, res, next) => {
      if (req.session?.role && roles.includes(req.session.role)) return next();
      return res.status(403).json({ error: 'Forbidden' });
    },
    validateDate: () => (req, res, next) => next(),
  }));
  jest.doMock(path.resolve(__dirname, '../utils/date'), () => ({
    addDays: (d, n) => d,
    formatLocalDate: () => '2026-06-07',
    getISOWeekRange: () => ({ start: '2026-06-01', end: '2026-06-07' }),
    getISOWeekString: () => '2026-W23',
  }));
  jest.doMock(path.resolve(__dirname, '../utils/csv'), () => ({
    escapeCsvValue: (v) => String(v),
    toCsvRow: (row) => row.join(','),
  }));
  jest.doMock(path.resolve(__dirname, '../utils/sqlDialect'), () => ({
    yearEquals: () => '1=1',
    monthEquals: () => '1=1',
    weekEquals: () => '1=1',
    dateOnly: (col) => col,
    upsertAttendanceSql: () => 'INSERT OR REPLACE INTO attendance ...',
    likeClauseCaseInsensitive: () => `LIKE ? ESCAPE '\\'`,
  }));
  jest.doMock(path.resolve(__dirname, '../services/adminAttendanceService'), () => ({
    getAttendanceHistory: jest.fn().mockResolvedValue([]),
    getAttendanceTrends: jest.fn().mockResolvedValue({ trends: [] }),
    listAttendance: jest.fn().mockResolvedValue([]),
    searchAttendanceForCorrection: mocks.searchAttendanceForCorrection
      || jest.fn().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 50 }),
  }));
  const router = require('../routes/adminAttendance');
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1', port, path: urlPath, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: chunks ? JSON.parse(chunks) : null }); }
        catch (_) { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

describe('PUT /api/admin/attendance/:id (attendance correction)', () => {
  test('rejects invalid status', async () => {
    const { server, port } = await loadAndStart({
      session: { userId: 42, role: 'admin' },
      get: jest.fn().mockResolvedValue({ id: 1, member_id: 5, date: '2026-06-07', status: 'present', service_type_id: 1 }),
    });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/1', { status: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid status/);
    } finally { server.close(); }
  });

  test('rejects non-integer id', async () => {
    const { server, port } = await loadAndStart({ session: { userId: 42, role: 'admin' } });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/abc', { status: 'present' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid attendance id/);
    } finally { server.close(); }
  });

  test('returns 404 when attendance record missing', async () => {
    const { server, port } = await loadAndStart({
      session: { userId: 42, role: 'admin' },
      get: jest.fn().mockResolvedValue(null),
    });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/999', { status: 'present' });
      expect(res.status).toBe(404);
    } finally { server.close(); }
  });

  test('rejects no-op (status unchanged, no reason)', async () => {
    const { server, port } = await loadAndStart({
      session: { userId: 42, role: 'admin' },
      get: jest.fn().mockResolvedValue({ id: 1, member_id: 5, date: '2026-06-07', status: 'present', service_type_id: 1 }),
    });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/1', { status: 'present' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already set/);
    } finally { server.close(); }
  });

  test('successful update writes audit_log with old/new values and reason', async () => {
    const auditCalls = [];
    const runCalls = [];
    const { server, port } = await loadAndStart({
      session: { userId: 42, role: 'admin' },
      get: jest.fn().mockResolvedValue({ id: 1, member_id: 5, date: '2026-06-07', status: 'present', service_type_id: 1 }),
      run: jest.fn().mockImplementation((sql, params) => { runCalls.push({ sql, params }); return Promise.resolve({}); }),
      createAuditEntry: jest.fn().mockImplementation((...args) => { auditCalls.push(args); return Promise.resolve({}); }),
    });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/1', { status: 'excused', reason: 'Member was sick' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Attendance updated', id: 1, status: 'excused', reason: 'Member was sick' });
      expect(runCalls).toHaveLength(1);
      expect(runCalls[0].params).toEqual(['excused', 1]);
      await new Promise((r) => setImmediate(r));
      expect(auditCalls).toHaveLength(1);
      const [userId, action, entityType, entityId, oldValue, newValue] = auditCalls[0];
      expect(userId).toBe(42);
      expect(action).toBe('update');
      expect(entityType).toBe('attendance');
      expect(entityId).toBe(1);
      expect(oldValue).toEqual({ status: 'present' });
      expect(newValue).toEqual({ status: 'excused', reason: 'Member was sick' });
    } finally { server.close(); }
  });

  test('truncates reason to 500 characters', async () => {
    const auditCalls = [];
    const longReason = 'r'.repeat(800);
    const { server, port } = await loadAndStart({
      session: { userId: 42, role: 'admin' },
      get: jest.fn().mockResolvedValue({ id: 2, member_id: 7, date: '2026-06-07', status: 'absent', service_type_id: 1 }),
      createAuditEntry: jest.fn().mockImplementation((...args) => { auditCalls.push(args); return Promise.resolve({}); }),
    });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/2', { status: 'present', reason: longReason });
      expect(res.status).toBe(200);
      expect(res.body.reason).toHaveLength(500);
      await new Promise((r) => setImmediate(r));
      expect(auditCalls[0][5].reason).toHaveLength(500);
    } finally { server.close(); }
  });

  test('reason without status change is still allowed (audits the rationale)', async () => {
    const auditCalls = [];
    const { server, port } = await loadAndStart({
      session: { userId: 42, role: 'admin' },
      get: jest.fn().mockResolvedValue({ id: 3, member_id: 8, date: '2026-06-07', status: 'present', service_type_id: 1 }),
      createAuditEntry: jest.fn().mockImplementation((...args) => { auditCalls.push(args); return Promise.resolve({}); }),
    });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/3', { status: 'present', reason: 'Follow-up note' });
      expect(res.status).toBe(200);
      await new Promise((r) => setImmediate(r));
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][4]).toEqual({ status: 'present' });
      expect(auditCalls[0][5]).toEqual({ status: 'present', reason: 'Follow-up note' });
    } finally { server.close(); }
  });

  test('rejects unauthenticated requests', async () => {
    const { server, port } = await loadAndStart({ session: null });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/1', { status: 'present' });
      expect(res.status).toBe(401);
    } finally { server.close(); }
  });

  test('rejects non-admin role', async () => {
    const { server, port } = await loadAndStart({ session: { userId: 5, role: 'leader' } });
    try {
      const res = await request(port, 'PUT', '/api/admin/attendance/1', { status: 'present' });
      expect(res.status).toBe(403);
    } finally { server.close(); }
  });
});

describe('GET /api/admin/attendance/search (admin search)', () => {
  // Regression test: the service must import BOTH `all` and `get` from
  // ../database. A previous version only imported `all`, so the count
  // query threw a ReferenceError and every request returned 500.
  test('returns the service payload as JSON', async () => {
    const fakeRows = [
      { id: 1, date: '2026-06-07', status: 'present', member_name: 'Alice' },
      { id: 2, date: '2026-06-06', status: 'absent', member_name: 'Bob' },
    ];
    const searchAttendanceForCorrection = jest.fn().mockResolvedValue({
      rows: fakeRows, total: 2, page: 1, pageSize: 10,
    });
    const { server, port } = await loadAndStart({
      session: { userId: 1, role: 'admin' },
      searchAttendanceForCorrection,
    });
    try {
      const res = await request(port, 'GET', '/api/admin/attendance/search?page=1&page_size=10');
      expect(res.status).toBe(200);
      expect(res.body.rows).toEqual(fakeRows);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(10);
    } finally { server.close(); }
  });

  test('forwards start_date, end_date, status, and pagination to the service', async () => {
    const searchAttendanceForCorrection = jest.fn().mockResolvedValue({
      rows: [], total: 0, page: 1, pageSize: 10,
    });
    const { server, port } = await loadAndStart({
      session: { userId: 1, role: 'admin' },
      searchAttendanceForCorrection,
    });
    try {
      const res = await request(
        port, 'GET',
        '/api/admin/attendance/search?start_date=2026-01-01&end_date=2026-06-07&status=present&page=1&page_size=10'
      );
      expect(res.status).toBe(200);
      const callArgs = searchAttendanceForCorrection.mock.calls[0][0];
      expect(callArgs.start_date).toBe('2026-01-01');
      expect(callArgs.end_date).toBe('2026-06-07');
      expect(callArgs.status).toBe('present');
      expect(callArgs.page).toBe(1);
      expect(callArgs.pageSize).toBe(10);
    } finally { server.close(); }
  });

  test('rejects unauthenticated', async () => {
    const { server, port } = await loadAndStart({ session: null });
    try {
      const res = await request(port, 'GET', '/api/admin/attendance/search');
      expect(res.status).toBe(401);
    } finally { server.close(); }
  });

  test('returns 500 when the service throws', async () => {
    const { server, port } = await loadAndStart({
      session: { userId: 1, role: 'admin' },
      searchAttendanceForCorrection: jest.fn().mockRejectedValue(new Error('db down')),
    });
    try {
      const res = await request(port, 'GET', '/api/admin/attendance/search');
      expect(res.status).toBe(500);
    } finally { server.close(); }
  });
});
