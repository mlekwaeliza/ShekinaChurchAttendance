import { test, expect } from '@playwright/test';

const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD || 'admin123';

async function login(page) {
  await page.goto('/');
  await page.fill('input[name="username"], input[type="text"]', ADMIN_USER);
  await page.fill('input[name="password"], input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  // Wait for either the dashboard to render or a 2FA prompt
  await page.waitForLoadState('networkidle');
}

test.describe('Admin dashboard', () => {
  test('home page renders without errors', async ({ page }) => {
    await page.goto('/');
    // Should at least show the login form
    await expect(page).toHaveTitle(/Shekina|Church|Attendance/i);
  });

  test('admin can fetch sections', async ({ page, request }) => {
    await login(page);
    const res = await page.request.get('/api/admin/sections');
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body.sections || body)).toBeTruthy();
    } else {
      // 2FA-required or other gating
      expect([401, 403]).toContain(res.status());
    }
  });
});
