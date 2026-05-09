/**
 * E2E: abre la landing, completa el widget de acceso y espera POST /api/subscribe.
 *
 * Uso:
 *   npm install
 *   npx playwright install chromium
 *   set BASE_URL=https://www.waenn.com
 *   set WAENN_E2E_EMAIL=tu+cosa@gmail.com
 *   npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

const BASE_URL = (process.env.BASE_URL || 'https://www.waenn.com').replace(/\/$/, '');
const E2E_EMAIL =
  process.env.WAENN_E2E_EMAIL || `e2e.playwright.${Date.now()}@example.com`;

test.describe('Subscribe widget → /api/subscribe', () => {
  test('network: captura status y cuerpo del POST', async ({ page }) => {
    const consoleLines = [];
    page.on('console', (msg) => {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    });

    const subscribeRelated = [];
    page.on('response', (response) => {
      const u = response.url();
      if (u.includes('subscribe') || u.includes('api/subscribe')) {
        subscribeRelated.push({ url: u, status: response.status() });
      }
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const access = page.locator('#s-access');
    await access.scrollIntoViewIfNeeded();
    await page.waitForSelector('#f-name', { state: 'visible', timeout: 30_000 });

    await page.locator('#f-name').fill('Playwright E2E');
    await page.locator('#ws-btn-name-next').click();
    await page.waitForTimeout(900);

    await page.locator('#f-email').fill(E2E_EMAIL);
    await page.locator('#ws-btn-email-next').click();
    await page.waitForTimeout(900);

    await page.waitForSelector('.ws-tag[data-interest]', { state: 'visible', timeout: 15_000 });
    await page.locator('.ws-tag[data-interest="Identity and character"]').click();
    await page.waitForTimeout(400);

    await page.locator('#access-consent').check();

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/subscribe') && r.request().method() === 'POST',
      { timeout: 60_000 }
    );

    await page.locator('#ws-cart-btn').click();

    const subRes = await responsePromise;
    const status = subRes.status();
    let bodyText = '';
    try {
      bodyText = await subRes.text();
    } catch {
      bodyText = '';
    }
    let bodyJson = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = null;
    }

    // Salida explícita en la consola del runner (lo que pedías ver en Network)
    // eslint-disable-next-line no-console
    console.log('\n--- /api/subscribe ---');
    // eslint-disable-next-line no-console
    console.log('URL:', subRes.url());
    // eslint-disable-next-line no-console
    console.log('Status:', status);
    // eslint-disable-next-line no-console
    console.log('Body:', bodyText);
    // eslint-disable-next-line no-console
    console.log('Respuestas relacionadas (subscribe en URL):', JSON.stringify(subscribeRelated, null, 2));
    // eslint-disable-next-line no-console
    console.log(
      'Últimas líneas de consola del navegador:',
      consoleLines.slice(-25).join('\n') || '(ninguna)'
    );

    expect(status, `POST /api/subscribe debe responder (body=${bodyText})`).not.toBe(0);

    if (status === 503) {
      // eslint-disable-next-line no-console
      console.warn(
        '\n503 misconfigured: revisa Vercel env + redeploy. Si el servidor ya tiene el último código, el JSON incluye `missing`.\n',
        bodyJson && bodyJson.missing ? bodyJson.missing : bodyText
      );
    }

    if (process.env.WAENN_E2E_SOFT === '1') {
      return;
    }

    expect(status, 'Esperado 200 cuando Brevo/Vercel están bien configurados').toBe(200);
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      data = null;
    }
    expect(data && data.ok === true, `JSON debe ser { ok: true }, recibido: ${bodyText}`).toBe(true);
  });
});
