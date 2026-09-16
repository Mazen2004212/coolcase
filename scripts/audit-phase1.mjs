/**
 * Security + integrity audit script for Coolcase Backend Phase 1.
 * Runs against real Supabase using the service-role key.
 *
 * Tests:
 * 1. Product integrity (count, names, no duplicates)
 * 2. Store settings values
 * 3. Anon client cannot write products/images/settings
 * 4. Anon client CAN read published products/images
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env.local');

// Parse .env.local manually
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  env[key] = val;
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const ANON_KEY     = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌ Missing required env vars');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

let passed = 0;
let failed = 0;

function pass(label) { console.log(`  ✅ ${label}`); passed++; }
function fail(label, reason) { console.log(`  ❌ ${label}: ${reason}`); failed++; }

// ─── 1. Product integrity ─────────────────────────────────────────────────────

console.log('\n── 1. Product integrity ────────────────────────────────');

const { data: products, error: prodErr } = await admin
  .from('products')
  .select('id, name, slug, is_active, is_available, is_featured, categories(name), product_images(id, is_primary, storage_path)')
  .order('display_order');

if (prodErr) { fail('Fetch products', prodErr.message); process.exit(1); }

const EXPECTED = ['Abstract Halftone', 'Amor', 'Black Lily', 'Blue Collage', 'Pink Lace'];

// Check count
if (products.length === 5) pass('Exactly 5 products');
else fail('Product count', `Expected 5, got ${products.length}: ${products.map(p => p.name).join(', ')}`);

// Check names
const names = products.map(p => p.name).sort();
const missing = EXPECTED.filter(n => !names.includes(n));
const extra   = names.filter(n => !EXPECTED.includes(n));
if (!missing.length && !extra.length) pass('All 5 expected products present');
else fail('Product names', `Missing: [${missing}], Extra: [${extra}]`);

// Check no duplicates by slug
const slugs = products.map(p => p.slug);
const uniqueSlugs = new Set(slugs);
if (uniqueSlugs.size === slugs.length) pass('No duplicate slugs');
else fail('Duplicate slugs', slugs.filter((s, i) => slugs.indexOf(s) !== i).join(', '));

// Each product has images
for (const p of products) {
  if (p.product_images.length > 0) pass(`${p.name} has ${p.product_images.length} image(s)`);
  else fail(`${p.name} images`, 'No images');
}

// Each product has a primary image
for (const p of products) {
  const hasPrimary = p.product_images.some(img => img.is_primary);
  if (hasPrimary) pass(`${p.name} has primary image set`);
  else fail(`${p.name} primary`, 'No primary image');
}

// ─── 2. Store settings ────────────────────────────────────────────────────────

console.log('\n── 2. Store settings ───────────────────────────────────');

const { data: settings } = await admin
  .from('store_settings')
  .select('key, value');

const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]));

function checkSetting(key, expected) {
  const actual = settingsMap[key];
  if (actual == null) fail(key, 'missing');
  else if (String(actual) === String(expected)) pass(`${key} = ${actual}`);
  else fail(key, `expected ${expected}, got ${actual}`);
}

checkSetting('silicone_original_price', 230);
checkSetting('silicone_selling_price',  180);
checkSetting('acrylic_original_price',  299);
checkSetting('acrylic_selling_price',   225);
checkSetting('double_layer_original_price', 460);
checkSetting('double_layer_selling_price',  399);
checkSetting('custom_original_price',   289);
checkSetting('custom_selling_price',    239);
checkSetting('shipping_fee',            50);
checkSetting('instapay_number',         '01152966212');
checkSetting('whatsapp_number',         '01142966212');

// ─── 3. Anonymous READ access (must work) ─────────────────────────────────────

console.log('\n── 3. Anonymous READ access ────────────────────────────');

const { data: anonProducts, error: anonProdErr } = await anon
  .from('products')
  .select('id, name')
  .eq('is_active', true)
  .limit(10);

if (anonProdErr) fail('Anon read products', anonProdErr.message);
else if (anonProducts.length > 0) pass(`Anon can read published products (${anonProducts.length} visible)`);
else fail('Anon read products', 'No products returned');

const { data: anonImages, error: anonImgErr } = await anon
  .from('product_images')
  .select('id, storage_path')
  .limit(5);

if (anonImgErr) fail('Anon read product_images', anonImgErr.message);
else pass(`Anon can read product_images (${anonImages.length} visible)`);

// ─── 4. Anonymous WRITE blocked (RLS must reject) ─────────────────────────────

console.log('\n── 4. Anonymous WRITE blocked by RLS ───────────────────');

const { error: anonInsertErr } = await anon
  .from('products')
  .insert({ name: 'ANON ATTACK', slug: 'anon-attack', is_active: true });

if (anonInsertErr) pass(`Anon product INSERT blocked: ${anonInsertErr.code}`);
else fail('Anon INSERT products', 'Insert succeeded — RLS HOLE!');

const { error: anonDeleteErr } = await anon
  .from('products')
  .delete()
  .eq('slug', 'abstract-halftone');

if (anonDeleteErr) pass(`Anon product DELETE blocked: ${anonDeleteErr.code}`);
else fail('Anon DELETE products', 'Delete succeeded — RLS HOLE!');

const { error: anonImgInsertErr } = await anon
  .from('product_images')
  .insert({ product_id: products[0].id, storage_path: 'hack/img.jpg', display_order: 99 });

if (anonImgInsertErr) pass(`Anon product_images INSERT blocked: ${anonImgInsertErr.code}`);
else fail('Anon INSERT product_images', 'Insert succeeded — RLS HOLE!');

const { error: anonSettingsErr } = await anon
  .from('store_settings')
  .upsert({ key: 'shipping_fee', value: 0 }, { onConflict: 'key' });

if (anonSettingsErr) pass(`Anon store_settings UPSERT blocked: ${anonSettingsErr.code}`);
else fail('Anon UPSERT store_settings', 'Upsert succeeded — RLS HOLE!');

// ─── 5. Check no residual QA data ─────────────────────────────────────────────

console.log('\n── 5. QA cleanup verification ──────────────────────────');

const { data: qaProducts } = await admin
  .from('products')
  .select('name')
  .ilike('name', '%test%');

if (!qaProducts || qaProducts.length === 0) pass('No test/QA products remain in DB');
else fail('QA cleanup', `Found: ${qaProducts.map(p => p.name).join(', ')}`);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('✅ All checks passed.');
