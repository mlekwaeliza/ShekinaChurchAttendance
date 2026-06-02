import { test, expect } from '@playwright/test';

test.describe('Health & unauthenticated paths', () => {
  test('GET /api/health returns 200 with db status', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database.client).toMatch(/postgres|sqlite/);
    expect(body.database.status).toBe('connected');
  });

  test('GET /api/events without session returns 401', async ({ request }) => {
    const res = await request.get('/api/events');
    expect(res.status()).toBe(401);
  });

  test('GET /api/admin/sections without session returns 401', async ({ request }) => {
    const res = await request.get('/api/admin/sections');
    expect(res.status()).toBe(401);
  });
});
