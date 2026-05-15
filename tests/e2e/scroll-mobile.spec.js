/**
 * Scroll stability checks (mobile viewport). iOS keyboard behavior needs manual QA on device.
 *
 *   BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/scroll-mobile.spec.js
 */
const { test, expect } = require('@playwright/test');

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');

test.describe('Mobile scroll stability', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sections render without content-visibility placeholders', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const heroCv = await page.locator('#s-hero').evaluate((el) => getComputedStyle(el).contentVisibility);
    expect(heroCv).toBe('visible');
    const htmlScroll = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(htmlScroll).toBe('auto');
  });

  test('hash link scrolls to #s-access without large scrollY regression', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.locator('.mobile-dock__cta[href="#s-access"]').click();
    await page.waitForTimeout(900);
    const accessTop = await page.locator('#s-access').evaluate((el) => el.getBoundingClientRect().top);
    expect(accessTop).toBeLessThan(140);
    const y1 = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(400);
    const y2 = await page.evaluate(() => window.scrollY);
    expect(Math.abs(y2 - y1)).toBeLessThan(48);
  });

  test('focusing name input does not oscillate scrollY', async ({ page }) => {
    await page.goto(`${BASE_URL}/#s-access`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('#f-name', { state: 'visible', timeout: 30_000 });
    const samples = [];
    await page.locator('#f-name').focus();
    for (let i = 0; i < 5; i++) {
      samples.push(await page.evaluate(() => window.scrollY));
      await page.waitForTimeout(120);
    }
    const spread = Math.max(...samples) - Math.min(...samples);
    expect(spread).toBeLessThan(80);
    await expect(page.locator('body')).toHaveClass(/access-keyboard-open/);
  });

  test('access uses stack layout on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const layout = await page.locator('#s-access').getAttribute('data-access-layout');
    expect(layout).toBe('stack');
  });
});

/**
 * Manual sign-off (iPhone Safari + Chrome): see plan "Fase D".
 * - Slow scroll intro → footer: no position jumps
 * - Type 10s in #f-name / #f-email: no vertical oscillation
 * - Open/close mobile dock: at most one small layout shift
 */
