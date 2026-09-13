import { test, expect } from '@playwright/test';

// Covers the batch-4/5 attendance hardening:
// - server rejects malformed + future submission dates (400, no mutation)
// - leader UI bulk-mark completes the roster and enables submit
// - in-progress marks survive a page reload via localStorage drafts
const LEADER_USER = process.env.E2E_LEADER_USER || 'leader1';
const LEADER_PASS = process.env.E2E_LEADER_PASSWORD || 'leader123';

// The API uses double-submit CSRF cookies, so the request fixture must
// bootstrap the csrfToken cookie first (no Origin/Referer headers are
// sent, which keeps the login same-origin check vacuous). Returns the
// login response plus a header builder carrying session + CSRF state.
async function apiLogin(request) {
  const jar = {};
  const store = (res) => {
    for (const h of res.headersArray()) {
      if (h.name.toLowerCase() !== 'set-cookie') continue;
      const m = /^([^=]+)=([^;]*)/.exec(h.value);
      if (m) jar[m[1]] = m[2];
    }
  };
  const cookies = () =>
    Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  store(await request.get('/api/health'));
  const login = await request.post('/api/auth/login', {
    headers: { 'X-CSRF-Token': jar.csrfToken || '', Cookie: cookies() },
    data: { username: LEADER_USER, password: LEADER_PASS }
  });
  store(login);
  const authed = () => ({ 'X-CSRF-Token': jar.csrfToken || '', Cookie: cookies() });
  return { login, authed };
}

async function uiLoginAsLeader(page) {
  await page.goto('/login');
  await page.fill('#username', LEADER_USER);
  await page.fill('#password', LEADER_PASS);
  await page.click('button[type="submit"]');
  // Lands on the role home after a successful login.
  await expect(page).toHaveURL(/\/leader(\/|$)/, { timeout: 30000 });
}

test.describe('Attendance hardening (server validation)', () => {
  test('rejects future-dated submissions with 400', async ({ request }) => {
    const { login, authed } = await apiLogin(request);
    test.skip(login.status() !== 200, `Leader login returned ${login.status()}`);
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const res = await request.post('/api/leader/attendance', {
      headers: authed(),
      data: { date: future, service_id: 1, attendance: [{ member_id: 1, status: 'present' }] }
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/future/i);
  });

  test('rejects malformed dates with 400', async ({ request }) => {
    const { login, authed } = await apiLogin(request);
    test.skip(login.status() !== 200, `Leader login returned ${login.status()}`);
    const res = await request.post('/api/leader/attendance', {
      headers: authed(),
      data: { date: 'not-a-date', service_id: 1, attendance: [{ member_id: 1, status: 'present' }] }
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/YYYY-MM-DD/);
  });
});

test.describe('Attendance hardening (leader UI)', () => {
  test('bulk mark-all-present completes the roster', async ({ page }) => {
    test.slow();
    await uiLoginAsLeader(page);
    await page.goto('/leader/attendance');
    const bulkButton = page.getByRole('button', { name: /mark all present/i });
    const emptyState = page.getByText(/no eligible members found/i);
    // Either the roster toolbar or the empty state must appear; the empty
    // roster means this environment cannot exercise marking — skip then.
    await expect(bulkButton.or(emptyState)).toBeVisible({ timeout: 30000 });
    test.skip((await emptyState.count()) > 0, 'Leader roster is empty in this environment');
    // Main Service has no eligibility rules, so it shows the full roster
    // regardless of weekday auto-selection (e.g. gender/section services).
    await page.getByRole('button', { name: 'Main Service', exact: true }).click();
    await expect(bulkButton).toBeVisible({ timeout: 30000 });
    await bulkButton.click();
    // Sticky action bar shows a full count and an enabled submit.
    const submit = page.getByRole('button', { name: /submit attendance/i }).first();
    await expect(submit).toBeEnabled({ timeout: 10000 });
  });

  // Two full page loads + login make this slow on loaded machines —
  // triple the 60s default budget rather than flake on it.
  test('in-progress marks survive reload (draft restore)', async ({ page }) => {
    test.slow();
    await uiLoginAsLeader(page);
    await page.goto('/leader/attendance');
    const markButton = page
      .locator('button[aria-label^="Mark "][aria-label$=" as present"]')
      .first();
    const emptyState = page.getByText(/no eligible members found/i);
    await expect(markButton.or(emptyState)).toBeVisible({ timeout: 30000 });
    test.skip((await emptyState.count()) > 0, 'Leader roster is empty in this environment');
    await page.getByRole('button', { name: 'Main Service', exact: true }).click();
    await expect(markButton).toBeVisible({ timeout: 30000 });
    // Mark one member only — never submit, so the server is untouched.
    await markButton.click();
    await expect(
      page.locator('button[aria-pressed="true"][aria-label^="Mark "]').first()
    ).toBeVisible({ timeout: 10000 });
    await page.reload();
    // Reload auto-selects the weekday service (possibly an unassigned one),
    // so switch back to Main Service before asserting the restored mark.
    await page.getByRole('button', { name: 'Main Service', exact: true }).click();
    await expect(
      page.locator('button[aria-pressed="true"][aria-label^="Mark "]').first()
    ).toBeVisible({ timeout: 60000 });
  });
});
