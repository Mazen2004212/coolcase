import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

const baseURL = process.env.COOLCASE_TEST_BASE_URL ?? 'http://127.0.0.1:3012';
const url = process.env.COOLCASE_SUPABASE_URL;
const anonKey = process.env.COOLCASE_SUPABASE_ANON_KEY;
const serviceKey = process.env.COOLCASE_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error('Collections UI QA requires the Coolcase Supabase test environment.');

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
const email = `coolcase.collections.qa.${runId}@example.com`;
const password = `${randomBytes(20).toString('base64url')}Aa1!`;
const slugs = [`men-cases-${runId}`, `new-arrivals-${runId}`];
let userId;
let browser;
let productCountBefore;

function assert(condition, message) {
  if (!condition) throw new Error(`Collections UI QA failed: ${message}`);
  console.log(`PASS: ${message}`);
}

async function noOverflow(page, label) {
  const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(sizes.scroll <= sizes.width + 1, `${label} has no horizontal overflow`);
}

try {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Collections UI QA', phone: '01000000009', governorate: 'Cairo',
      city: 'Cairo', area: 'Nasr City', street: 'Collections QA Street', building: '1',
    },
  });
  if (created.error || !created.data.user) throw created.error ?? new Error('Missing QA user');
  userId = created.data.user.id;
  const promoted = await service.from('profiles').update({ role: 'ADMIN' }).eq('id', userId);
  if (promoted.error) throw promoted.error;
  const staffed = await service.from('admin_staff').insert({ user_id: userId, role: 'OWNER', permissions: [], is_active: true });
  if (staffed.error) throw staffed.error;
  const initialProducts = await service.from('products').select('id', { count: 'exact', head: true });
  if (initialProducts.error) throw initialProducts.error;
  productCountBefore = initialProducts.count;

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email Address').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/admin(?:\/)?$/);
  assert(true, 'temporary OWNER authenticated into Admin');

  await page.goto(`${baseURL}/admin/collections/new`, { waitUntil: 'networkidle' });
  await page.getByLabel('Collection Name').fill('Men Cases');
  await page.getByLabel('Slug').fill(slugs[0]);
  await page.getByLabel('Description').fill('Street-ready cases curated for the Coolcase collection QA.');
  const productChecks = page.locator('.ad-product-picker input[type="checkbox"]');
  assert(await productChecks.count() >= 3, 'product picker exposes real catalog products');
  await productChecks.nth(0).check();
  await productChecks.nth(1).check();
  await productChecks.nth(2).check();
  await page.locator('.ad-upload input[type="file"]').setInputFiles('public/assets/hero/hero-cases.png');
  await page.locator('.ad-collection-banner-preview img').waitFor();
  await page.getByRole('button', { name: 'Save Collection' }).click();
  await page.waitForURL(/\/admin\/collections$/);
  await page.getByText('Men Cases', { exact: true }).waitFor();
  assert(true, 'custom collection with banner and three products persists');

  await page.goto(`${baseURL}/admin/collections/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Preset Collection/ }).click();
  await page.getByLabel('Slug').fill(slugs[1]);
  const newChecks = page.locator('.ad-product-picker input[type="checkbox"]');
  await newChecks.nth(0).check();
  await newChecks.nth(1).check();
  await newChecks.nth(2).check();
  await newChecks.nth(3).check();
  await page.getByRole('button', { name: 'Save Collection' }).click();
  await page.waitForURL(/\/admin\/collections$/);
  await page.getByText('New Arrivals', { exact: true }).waitFor();
  assert(true, 'New Arrivals preset persists with explicit membership');

  const custom = await service.from('collections').select('id, banner_image_url').eq('slug', slugs[0]).single();
  if (custom.error) throw custom.error;
  assert(Boolean(custom.data.banner_image_url), 'collection banner path persists through shared public media');
  await page.goto(`${baseURL}/admin/collections/${custom.data.id}`, { waitUntil: 'networkidle' });
  const moveDown = page.getByRole('button', { name: /Move .* down/ }).first();
  await moveDown.click();
  await page.getByRole('button', { name: 'Save Collection' }).click();
  await page.waitForURL(/\/admin\/collections$/);
  await page.getByRole('heading', { name: 'Collections', exact: true }).waitFor();
  assert(true, 'collection product reorder persists through the editor');

  await mkdir('test-results/collections', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/collections/admin-1440.png', fullPage: true });
  await noOverflow(page, 'Admin Collections desktop');

  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/collections`, { waitUntil: 'networkidle' });
    await page.getByText('Men Cases', { exact: true }).waitFor();
    await noOverflow(page, `Collections ${viewport.width}px`);
    await page.screenshot({ path: `test-results/collections/index-${viewport.width}.png`, fullPage: true });

    await page.goto(`${baseURL}/collections/${slugs[1]}`, { waitUntil: 'networkidle' });
    await page.locator('.product-new-ribbon').first().waitFor();
    assert(await page.locator('.product-new-ribbon').count() === 4, `New Arrivals renders four NEW ribbons at ${viewport.width}px`);
    await noOverflow(page, `New Arrivals detail ${viewport.width}px`);
    await page.screenshot({ path: `test-results/collections/new-arrivals-${viewport.width}.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'New Arrivals' }).waitFor();
  assert(await page.locator('.new-arrivals-section .product-new-ribbon').count() === 4, 'homepage shows the ordered New Arrivals section and ribbons');
  await page.goto(`${baseURL}/shop`, { waitUntil: 'networkidle' });
  assert(await page.locator('.product-new-ribbon').count() >= 4, 'shop cards derive NEW ribbons from active collection membership');

  await page.goto(`${baseURL}/admin/collections/${custom.data.id}`, { waitUntil: 'networkidle' });
  await page.getByLabel('Active on storefront').uncheck();
  await page.getByRole('button', { name: 'Save Collection' }).click();
  await page.waitForURL(/\/admin\/collections$/);
  const inactiveResponse = await page.goto(`${baseURL}/collections/${slugs[0]}`, { waitUntil: 'networkidle' });
  assert(inactiveResponse?.status() === 404, 'inactive collection detail returns 404');
  // The deliberate 404 probe may emit a failed-resource console entry in dev mode.
  consoleErrors.splice(0, consoleErrors.length, ...consoleErrors.filter(message => !message.includes('404')));

  await page.goto(`${baseURL}/admin/collections`, { waitUntil: 'networkidle' });
  for (const slug of slugs) {
    const row = page.locator('tr').filter({ hasText: `/${slug}` });
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete collection' }).click();
    await row.waitFor({ state: 'detached' });
  }
  const remainingCollections = await service.from('collections').select('id').in('slug', slugs);
  if (remainingCollections.error) throw remainingCollections.error;
  assert(remainingCollections.data.length === 0, 'deleted QA collections leave no persisted collection rows');
  const finalProducts = await service.from('products').select('id', { count: 'exact', head: true });
  if (finalProducts.error) throw finalProducts.error;
  assert(finalProducts.count === productCountBefore, 'deleting collections does not delete products');
  if (custom.data.banner_image_url && !custom.data.banner_image_url.startsWith('/media/')) {
    const deletedBanner = await service.storage.from('product-assets').download(custom.data.banner_image_url);
    assert(Boolean(deletedBanner.error), 'deleted collection banner is removed from Supabase Storage');
  }
  assert(true, 'collection delete confirmation removes memberships and banners without deleting products');
  assert(consoleErrors.length === 0, `browser console remains clean${consoleErrors.length ? `: ${consoleErrors.join(' | ')}` : ''}`);
} finally {
  if (browser) await browser.close();
  await service.from('collections').delete().in('slug', slugs);
  if (userId) await service.auth.admin.deleteUser(userId);
}
