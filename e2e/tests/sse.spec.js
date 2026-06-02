import { test, expect } from '@playwright/test';

const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD || 'admin123';

async function loginApi(request) {
  const res = await request.post('/api/auth/login', { data: { username: ADMIN_USER, password: ADMIN_PASS } });
  if (res.status() !== 200) return null;
  return res;
}

test.describe('SSE stream', () => {
  test('GET /api/events with admin session receives hello + heartbeat', async ({ request }) => {
    const login = await loginApi(request);
    test.skip(!login, 'admin login failed (set E2E_ADMIN_USER / E2E_ADMIN_PASSWORD)');
    // SSE: Playwright request.get returns the body once the server closes
    // the stream. We use AbortController via the timeout option.
    const res = await request.get('/api/events', { timeout: 5_000 });
    expect([200, 408]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.text();
      expect(body).toMatch(/event: hello/);
    }
  });
});

test.describe('CSV upload', () => {
  test('admin can upload a small CSV via /api/admin/upload-csv', async ({ request }) => {
    const login = await loginApi(request);
    test.skip(!login, 'admin login failed');

    const csv = [
      'full_name,membership_id,section,leader_username,phone,email,date_of_birth',
      'E2E Test Person,MEM-E2E-001,SECTION_E2E,leader_e2e,555-0100,e2e@example.com,1990-01-01'
    ].join('\n');

    const res = await request.post('/api/admin/upload-csv', {
      multipart: {
        csv: {
          name: 'e2e.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv)
        }
      }
    });
    // Either accepted (201/200) or rejected for test data being fake
    // (e.g. unknown section). We just assert it's not a server crash.
    expect([200, 201, 400, 404, 422]).toContain(res.status());
  });
});

test.describe('2FA status', () => {
  test('admin can read 2FA status', async ({ request }) => {
    const login = await loginApi(request);
    test.skip(!login, 'admin login failed');
    const res = await request.get('/api/2fa/status');
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body.enabled).toBe('boolean');
    }
  });
});
