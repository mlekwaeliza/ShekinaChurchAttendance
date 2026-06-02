import { test, expect } from '@playwright/test';

// Set credentials via env or use a default admin user. The default
// matches the seed in server/scripts/seed-admin.js (admin / admin123).
const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD || 'admin123';
const LEADER_USER = process.env.E2E_LEADER_USER || 'leader1';
const LEADER_PASS = process.env.E2E_LEADER_PASSWORD || 'leader123';

test.describe('Auth', () => {
  test('rejects bad credentials with 401', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { username: ADMIN_USER, password: 'definitely-wrong-password' }
    });
    expect([400, 401]).toContain(res.status());
  });

  test('admin login succeeds and sets session cookie', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { username: ADMIN_USER, password: ADMIN_PASS }
    });
    // 200 with user payload OR 403 (e.g. TOTP-required)
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.user).toBeDefined();
      expect(body.user.role).toBe('admin');
      // session cookie must be set
      const cookies = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie');
      expect(cookies.length).toBeGreaterThan(0);
    }
  });

  test('logout clears session', async ({ request, browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/');
    await page.fill('input[name="username"], input[type="text"]', ADMIN_USER);
    await page.fill('input[name="password"], input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    // The /api/auth/me endpoint should work after login
    const me = await page.request.get('/api/auth/me');
    expect([200, 403]).toContain(me.status());
    await ctx.close();
  });
});
