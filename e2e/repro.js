const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (e) {
    console.log('LAUNCH FAILED:', e.message);
    fs.writeFileSync('e2e/launch-err.txt', e.stack || e.message);
    process.exit(1);
  }
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[PAGEERROR] ${e.message}`));

  const step = async (label, fn) => {
    try { const r = await fn(); console.log(`STEP OK: ${label}`); return r; }
    catch (e) { console.log(`STEP FAIL: ${label} -> ${e.message}`); return null; }
  };

  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' }).catch(e => console.log('goto err', e.message));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/shot-login.png' });

  // Login
  await step('fill username', () => page.locator('input[type="text"], input[type="email"], input[placeholder*="username" i], input[placeholder*="email" i], input[name="username"]').first().fill('admin'));
  await step('fill password', () => page.locator('input[type="password"]').first().fill('AdminReset!2026'));
  await step('click submit', () => page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")').first().click({ timeout: 5000 }));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'e2e/shot-after-login.png' });
  const afterLoginText = await page.locator('body').innerText().catch(() => '');
  console.log('AFTER LOGIN BODY (first 400):', afterLoginText.slice(0, 400));

  // Find Rewards / Hall of Fame / Performance tab
  const tabCandidates = ['Rewards', 'Hall of Fame', 'Performance', 'Recognition'];
  for (const t of tabCandidates) {
    const clicked = await step(`click tab "${t}"`, () => page.locator(`button:has-text("${t}"), a:has-text("${t}"), div:has-text("${t}")`).first().click({ timeout: 4000 }));
    if (clicked) break;
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/shot-rewards.png' });
  const rewardsText = await page.locator('body').innerText().catch(() => '');
  console.log('REWARDS BODY (first 400):', rewardsText.slice(0, 400));

  // Click Members tab within rewards
  await step('click Members tab', () => page.locator('button:has-text("Members")').first().click({ timeout: 5000 }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/shot-members.png' });

  // Count member rows (leaderboard rows). They contain a score number and a name.
  const rowCount = await page.locator('div:has-text("Score")').count();
  console.log('Approx rows containing "Score":', rowCount);

  // Try clicking the first leaderboard row. Identify by the outer div with cursor pointer.
  // Click on the first element that looks like a row: a div containing a rank medal + name.
  const firstRow = page.locator('div').filter({ hasText: /Overall|Score/ }).first();
  await step('click first member row', () => page.locator('div[style*="cursor: pointer"]').first().click({ timeout: 5000 }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/shot-after-click.png' });

  const modalText = await page.locator('body').innerText().catch(() => '');
  const hasModal = modalText.includes('Overall Score') || modalText.includes('Membership ID') || modalText.includes('Score Breakdown');
  console.log('MODAL APPEARED?', hasModal);
  console.log('MODAL-RELATED TEXT PRESENT:', {
    overallScore: modalText.includes('Overall Score'),
    membershipId: modalText.includes('Membership ID'),
    breakdown: modalText.includes('Score Breakdown'),
  });

  console.log('--- CONSOLE/PAGE LOGS ---');
  console.log(logs.slice(-40).join('\n'));

  await browser.close();
})();
