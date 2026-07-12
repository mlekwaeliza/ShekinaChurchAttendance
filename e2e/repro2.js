const { chromium } = require('@playwright/test');
const fs = require('fs');
const out = [];
const log = (...a) => { out.push(a.join(' ')); fs.writeFileSync('C:\\Users\\mlekw\\AppData\\Local\\Temp\\opencode\\result.txt', out.join('\n')); };

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (e) { log('LAUNCH FAILED:', e.message); return; }

  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  try {
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.locator('input[type="password"]').first().waitFor({ timeout: 8000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('AdminReset!2026');
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first().click({ timeout: 5000 });
    await page.waitForTimeout(2500);
    log('LOGGED IN. body starts:', (await page.locator('body').innerText().catch(() => '')).slice(0, 120));

    // Navigate to Rewards / Hall of Fame
    for (const t of ['Rewards', 'Hall of Fame', 'Performance']) {
      const el = page.locator(`button:has-text("${t}")`).first();
      if (await el.count()) { await el.click({ timeout: 4000 }).catch(e => log('tab click err', e.message)); log('clicked tab', t); break; }
    }
    await page.waitForTimeout(2000);

    // Members sub-tab
    const membersTab = page.locator('button:has-text("Members")').first();
    if (await membersTab.count()) { await membersTab.click({ timeout: 5000 }); log('clicked Members sub-tab'); }
    await page.waitForTimeout(2000);

    // Click first member row
    const before = (await page.locator('body').innerText()).includes('Overall Score');
    // rows with cursor pointer
    const row = page.locator('div[style*="cursor: pointer"]').first();
    const rowCount = await page.locator('div[style*="cursor: pointer"]').count();
    log('clickable rows found:', rowCount);
    if (await row.count()) {
      await row.click({ timeout: 5000 });
      log('clicked first row');
    }
    await page.waitForTimeout(1500);

    const after = await page.locator('body').innerText();
    const modalShown = after.includes('Membership ID') || after.includes('Score Breakdown') || after.includes('Overall Score');
    log('MODAL SHOWN AFTER CLICK:', modalShown);
    log('ERRORS:', errs.length ? errs.slice(-10).join(' | ') : 'none');
  } catch (e) {
    log('TEST ERROR:', e.message);
    log('ERRORS:', errs.slice(-10).join(' | '));
  } finally {
    await browser.close();
    log('DONE');
  }
})();
