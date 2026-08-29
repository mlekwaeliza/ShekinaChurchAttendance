const express = require('express');
const http = require('http');
const path = require('path');

function request(port, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/auth/reset-password',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let response = '';
        res.on('data', (chunk) => {
          response += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(response) }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function startAuthRoute({ resetRequest, updateResult = { changes: 1 } }) {
  jest.resetModules();
  const get = jest.fn().mockResolvedValue(resetRequest);
  const run = jest.fn().mockResolvedValue(updateResult);
  const recordSecurityEvent = jest.fn();

  jest.doMock(path.resolve(__dirname, '../database'), () => ({
    queries: {},
    get: jest.fn(),
    transaction: jest.fn((callback) => callback({ get, run }))
  }));
  jest.doMock(path.resolve(__dirname, '../utils/securityAudit'), () => ({ recordSecurityEvent }));

  const router = require('../routes/auth');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, port: server.address().port, get, run, recordSecurityEvent });
    });
  });
}

describe('POST /api/auth/reset-password', () => {
  test('sets the password, clears the lockout, and consumes the one-time token', async () => {
    const { server, port, get, run, recordSecurityEvent } = await startAuthRoute({
      resetRequest: { id: 12, password_reset_expires: new Date(Date.now() + 60_000).toISOString() }
    });

    try {
      const response = await request(port, { token: 'reset-token', new_password: 'NewPassword123!' });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/Password reset successfully/);
      expect(get).toHaveBeenCalledWith(expect.stringContaining('password_reset_token'), [
        expect.any(String)
      ]);
      expect(run).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = 0'),
        expect.arrayContaining([12])
      );
      expect(recordSecurityEvent).toHaveBeenCalledWith('password_reset_completed', 12, null, expect.any(Object));
    } finally {
      server.close();
    }
  }, 30000);

  test('rejects an expired reset token', async () => {
    const { server, port, run } = await startAuthRoute({
      resetRequest: { id: 12, password_reset_expires: new Date(Date.now() - 60_000).toISOString() }
    });

    try {
      const response = await request(port, { token: 'expired-token', new_password: 'NewPassword123!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/expired/);
      expect(run).toHaveBeenCalledWith(expect.stringContaining('password_reset_used = 1'), [12]);
    } finally {
      server.close();
    }
  });
});
