const path = require('path');
const http = require('http');
const express = require('express');

function request(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: urlPath,
      method: 'GET',
    }, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        let body = chunks;
        try {
          body = chunks ? JSON.parse(chunks) : null;
        } catch (_error) {
          // CSV exports are intentionally returned as plain text.
        }
        resolve({
          status: res.statusCode,
          body,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function startReportsApp() {
  jest.resetModules();

  const reportQueries = [];
  const all = jest.fn().mockImplementation(async (sql) => {
    reportQueries.push(sql);

    if (sql.includes('FROM members m JOIN attendance a')) {
      if (!sql.includes('GROUP BY m.id, m.full_name, s.name')) {
        throw new Error('PostgreSQL requires selected section fields in GROUP BY');
      }
      if (sql.includes('HAVING rate')) {
        throw new Error('PostgreSQL does not allow SELECT aliases in HAVING');
      }
    }

    if (sql.includes('FROM leaders l') && sql.includes('GROUP BY l.id')) {
      if (sql.includes('s.name as section_name')
        && !sql.includes('GROUP BY l.id, u.username, u.full_name, s.name')) {
        throw new Error('PostgreSQL requires selected leader and section fields in GROUP BY');
      }
      if (!sql.includes('s.name as section_name')
        && !sql.includes('GROUP BY l.id, u.username, u.full_name')) {
        throw new Error('PostgreSQL requires selected user fields in GROUP BY');
      }
    }

    if (sql.includes('LEFT JOIN service_types st ON a.service_type_id = st.id')) {
      if (sql.includes('a.reason')) {
        throw new Error('Attendance records do not contain a reason column');
      }
      return [{
        date: '2026-07-20',
        member_name: 'Example Member',
        section_name: 'Section A',
        service_name: 'Sunday Service',
        status: 'present',
        submitted_at: '2026-07-20T10:00:00Z',
      }];
    }

    return [];
  });

  jest.doMock(path.resolve(__dirname, '../database'), () => ({
    all,
    get: jest.fn().mockResolvedValue({
      total_attendees: 0,
      present_count: 0,
      absent_count: 0,
      excused_count: 0,
      service_days: 0,
      attendance_rate: 0,
    }),
  }));

  jest.doMock(path.resolve(__dirname, '../middleware/auth'), () => ({
    isAuthenticated: (req, _res, next) => {
      req.session = { userId: 1, role: 'admin' };
      next();
    },
    requireRole: () => (_req, _res, next) => next(),
    validateDateRange: () => (_req, _res, next) => next(),
  }));

  const router = require('../routes/reports');
  const app = express();
  app.use('/api/admin/reports', router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({
        server,
        port: server.address().port,
        reportQueries,
      });
    });
  });
}

describe('GET /api/admin/reports/attendance', () => {
  const originalClient = process.env.DB_CLIENT;

  beforeEach(() => {
    process.env.DB_CLIENT = 'postgres';
  });

  afterEach(() => {
    if (originalClient === undefined) {
      delete process.env.DB_CLIENT;
    } else {
      process.env.DB_CLIENT = originalClient;
    }
  });

  test('uses PostgreSQL-compatible grouping and care-list filtering', async () => {
    const { server, port, reportQueries } = await startReportsApp();

    try {
      const response = await request(
        port,
        '/api/admin/reports/attendance?start_date=2026-01-01&end_date=2026-07-25'
      );

      expect(response.status).toBe(200);
      expect(response.body.reportType).toBe('attendance');

      const memberQueries = reportQueries.filter((sql) => (
        sql.includes('FROM members m JOIN attendance a')
      ));
      expect(memberQueries).toHaveLength(2);
      expect(memberQueries.every((sql) => (
        sql.includes('GROUP BY m.id, m.full_name, s.name')
      ))).toBe(true);
      expect(memberQueries.some((sql) => sql.includes('HAVING rate'))).toBe(false);
    } finally {
      server.close();
    }
  });

  test('uses PostgreSQL-compatible grouping for leadership reports', async () => {
    const { server, port, reportQueries } = await startReportsApp();

    try {
      const response = await request(
        port,
        '/api/admin/reports/leadership?start_date=2026-01-01&end_date=2026-07-25'
      );

      expect(response.status).toBe(200);
      expect(response.body.reportType).toBe('leadership');

      const groupedLeaderQueries = reportQueries.filter((sql) => (
        sql.includes('FROM leaders l') && sql.includes('GROUP BY l.id')
      ));
      expect(groupedLeaderQueries).toHaveLength(2);
    } finally {
      server.close();
    }
  });

  test('exports attendance without querying a missing reason column', async () => {
    const { server, port, reportQueries } = await startReportsApp();

    try {
      const response = await request(
        port,
        '/api/admin/reports/export/attendance?start_date=2026-01-01&end_date=2026-07-25'
      );

      expect(response.status).toBe(200);
      expect(response.body).toContain('service_name');

      const exportQuery = reportQueries.find((sql) => (
        sql.includes('LEFT JOIN service_types st ON a.service_type_id = st.id')
      ));
      expect(exportQuery).toBeDefined();
      expect(exportQuery).not.toContain('a.reason');
    } finally {
      server.close();
    }
  });
});
