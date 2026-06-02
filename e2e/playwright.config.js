import { defineConfig, devices } from '@playwright/test';

// E2E config. The tests assume a running server (start it with
// `npm start` or `cd server && npm start` then `cd client && npm run dev`,
// or run a production build from `client/dist`). Override the URL with
// E2E_BASE_URL if needed.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Forward credentials so session cookies work
    extraHTTPHeaders: { 'X-E2E-Client': 'playwright' }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
