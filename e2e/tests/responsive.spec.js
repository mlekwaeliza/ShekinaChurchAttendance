import { test, expect } from '@playwright/test';

// Responsive smoke test: verifies no horizontal overflow at mobile, tablet,
// and desktop widths across every major route, plus drawer/modal behavior.
// Requires a running server (admin/admin123, leader1/leader123 seeds).

const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD || 'E2eTestAdmin#2026';
const LEADER_USER = process.env.E2E_LEADER_USER || 'ghance';
const LEADER_PASS = process.env.E2E_LEADER_PASSWORD || 'password123';

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

const ADMIN_ROUTES = [
  '/admin',
  '/admin/sections',
  '/admin/home-cells',
  '/admin/departments',
  '/admin/leadership',
  '/admin/titles',
  '/admin/members',
  '/admin/new-members',
  '/admin/leaders',
  '/admin/children-leaders',
  '/admin/birthdays',
  '/admin/rewards',
  '/admin/attendance-dashboard',
  '/admin/attendance-corrections',
  '/admin/history',
  '/admin/attendance-analytics',
  '/admin/evangelism',
  '/admin/follow-ups',
  '/admin/finance',
  '/admin/calendar',
  '/admin/announcements',
  '/admin/reporting',
  '/admin/analytics',
  '/admin/audit',
  '/admin/settings',
  '/admin/trash',
  '/admin/contributions',
  '/admin/children',
];

const LEADER_ROUTES = [
  '/leader',
  '/leader/members',
  '/leader/attendance',
  '/leader/home-cells',
  '/leader/outreach',
  '/leader/history',
  '/leader/contributions',
  '/leader/reports',
  '/leader/calendar',
  '/change-password',
];

async function login(page, username, password) {
  await page.goto('/login', { waitUntil: 'load' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 15_000 }),
    page.click('button[type="submit"]')
  ]);
}

// Returns a list of overflow problems found on the current page.
async function checkOverflow(page) {
  return page.evaluate(() => {
    const problems = [];
    const vw = window.innerWidth;
    const doc = document.documentElement;

    if (doc.scrollWidth > vw + 1) {
      problems.push(`page overflows: document ${doc.scrollWidth}px > viewport ${vw}px`);
    }

    const main = document.querySelector('main.app-shell-scroll');
    if (main && main.scrollWidth > main.clientWidth + 1) {
      problems.push(`main container overflows: ${main.scrollWidth}px > ${main.clientWidth}px`);
    }

    const clips = (el) => {
      const ox = getComputedStyle(el).overflowX;
      return ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip';
    };

    const visibleNodes = document.querySelectorAll('body *');
    const scrollContainers = new Set(
      [...document.querySelectorAll('*')].filter((el) => clips(el))
    );

    for (const el of visibleNodes) {
      if (el.closest('main.app-shell-scroll')) continue; // handled above
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        let parent = el.parentElement;
        let escaped = true;
        while (parent && parent !== document.body) {
          if (scrollContainers.has(parent)) { escaped = false; break; }
          parent = parent.parentElement;
        }
        if (!escaped) continue;
        const tag = `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')}`;
        problems.push(
          `element escapes viewport: <${tag}> left=${Math.round(r.left)} right=${Math.round(r.right)} (viewport ${vw}px)`
        );
      }
    }
    return problems.slice(0, 8); // cap per page
  });
}

async function visitRoutesAndCheck(page, routes, report, skipMainCheck = false) {
  for (const route of routes) {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      let pageOk = true;
      try {
        await page.goto(route, { waitUntil: 'load', timeout: 45_000 });
        if (!skipMainCheck) {
          await page.waitForSelector('main.app-shell-scroll', { timeout: 15_000 });
        }
        await page.waitForTimeout(1400); // let lazy chunks/charts settle
        const problems = await checkOverflow(page);
        if (problems.length > 0) {
          pageOk = false;
          report.push(`${route} @ ${vp.name}: ${problems.join(' | ')}`);
        }
      } catch (err) {
        pageOk = false;
        report.push(`${route} @ ${vp.name}: LOAD FAILED - ${String(err.message).split('\n')[0]}`);
      }
      if (!pageOk) {
        await page.screenshot({ path: `test-results/responsive-${vp.name}${route.replace(/\//g, '_')}.png` }).catch(() => {});
      }
    }
  }
}

test.describe('Responsive layout', () => {
  test('login page has no horizontal overflow at any viewport', async ({ page }) => {
    const report = [];
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login', { waitUntil: 'load' });
      await page.waitForTimeout(600);
      const problems = await checkOverflow(page);
      if (problems.length > 0) report.push(`/login @ ${vp.name}: ${problems.join(' | ')}`);
    }
    expect(report).toEqual([]);
  });

  test('admin module routes have no horizontal overflow', async ({ page }) => {
    test.setTimeout(900_000);
    await login(page, ADMIN_USER, ADMIN_PASS);
    const report = [];
    await visitRoutesAndCheck(page, ADMIN_ROUTES, report);
    expect(report).toEqual([]);
  });

  test('leader module routes have no horizontal overflow', async ({ page }) => {
    test.setTimeout(300_000);
    await login(page, LEADER_USER, LEADER_PASS);
    const report = [];
    await visitRoutesAndCheck(page, LEADER_ROUTES, report);
    expect(report).toEqual([]);
  });

  test('mobile drawer opens, fits the screen, and closes', async ({ page }) => {
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/admin/members', { waitUntil: 'load' });
    await page.waitForSelector('main.app-shell-scroll', { timeout: 15_000 });

    await page.click('button[aria-label="Open navigation"]');
    const drawer = page.locator('aside.sidebar.md\\:hidden');
    await expect(drawer).toBeVisible();
    // Wait for the slide-in transition to finish before measuring.
    await expect
      .poll(async () => {
        const b = await drawer.boundingBox();
        return b ? b.x : -Infinity;
      })
      .toBeGreaterThanOrEqual(0);
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeLessThanOrEqual(320 * 0.85 + 1);

    // Overlay should close the drawer. Click the overlay at the right
    // edge (the drawer covers the center on narrow viewports).
    await page.mouse.click(320 - 16, 150);
    // The drawer slides off-screen (-translate-x-full). toBeVisible()
    // still reports the translated element as "visible", so assert the
    // drawer's right edge has moved fully out of the viewport instead.
    await expect
      .poll(async () => {
        const box = await drawer.boundingBox();
        return box ? box.x + box.width : 0;
      })
      .toBeLessThanOrEqual(0);
    // Detach the dashboard's SSE connections before teardown.
    await page.goto('about:blank');
  });

  test('global search modal fits mobile viewport', async ({ page }) => {
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/admin', { waitUntil: 'load' });
    await page.waitForSelector('main.app-shell-scroll', { timeout: 15_000 });
    await page.keyboard.press('Control+K');
    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal.first()).toBeVisible();
    const rect = await modal.first().boundingBox();
    expect(rect.width).toBeLessThanOrEqual(321);
    const problems = await checkOverflow(page);
    expect(problems).toEqual([]);
    await page.keyboard.press('Escape');
    // Detach the dashboard's SSE connections so browser-context teardown
    // does not stall Playwright's 60s teardown timeout.
    await page.goto('about:blank');
  });
});
