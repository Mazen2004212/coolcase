import { expect, test } from '@playwright/test';

const baseURL = process.env.COOLCASE_TEST_BASE_URL ?? 'http://127.0.0.1:3001';

for (const path of ['/', '/shop', '/products/black-lily', '/login', '/custom-cases/named']) {
  test(`${path} renders without a framework error`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('nextjs-portal')).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`homepage has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    await page.screenshot({ path: testInfo.outputPath('homepage.png'), fullPage: false });
  });
}

test('health and source-controlled image paths are available', async ({ request }) => {
  const health = await request.get(`${baseURL}/api/health`);
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toEqual({ status: 'ok' });

  for (const path of [
    '/assets/hero/hero-cases.png',
    '/assets/custom-cases/named/named-case-example.png',
  ]) {
    expect((await request.get(`${baseURL}${path}`)).status()).toBe(200);
  }
});

test('custom artwork selection is preprocessed and updates the builder', async ({ page }) => {
  await page.goto(`${baseURL}/custom-cases/upload`, { waitUntil: 'networkidle' });
  await page.locator('input[type="file"]').setInputFiles('public/assets/products/inspiration.png');
  await expect(page.getByText(/Replace: inspiration\.(?:png|webp)/)).toBeVisible();
  await expect(page.getByAltText('Your uploaded design preview')).toBeVisible();
});
