/**
 * Targeted security + feature tests:
 * 1. Duplicate slug rejection
 * 2. Server action auth boundary (simulated customer = anon token)
 * 3. Publish/unpublish visibility via anon client
 * 4. Availability flag visibility
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '../.env.local'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const ANON_KEY     = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon  = createClient(SUPABASE_URL, ANON_KEY,    { auth: { persistSession: false } });

let passed = 0, failed = 0;
const pass = (l)    => { console.log(`  ✅ ${l}`); passed++; };
const fail = (l, r) => { console.log(`  ❌ ${l}: ${r}`); failed++; };

// ── 1. Duplicate slug rejection ───────────────────────────────────────────────
console.log('\n── 1. Duplicate slug rejection ─────────────────────────');

// First: create a temp product with a known slug
const { data: tmp, error: tmpErr } = await admin
  .from('products')
  .insert({ name: 'Slug Test A', slug: 'slug-test-a', is_active: false, is_available: true, is_featured: false, display_order: 999 })
  .select('id')
  .single();

if (tmpErr) { fail('Create temp product A', tmpErr.message); }
else {
  pass('Created temp product slug-test-a');

  // Now try to insert a second product with the same slug
  const { error: dupErr } = await admin
    .from('products')
    .insert({ name: 'Slug Test A Dup', slug: 'slug-test-a', is_active: false, is_available: true, is_featured: false, display_order: 999 });

  if (dupErr && dupErr.code === '23505') {
    pass(`Duplicate slug INSERT blocked: code 23505 (unique violation)`);
  } else if (dupErr) {
    fail('Duplicate slug rejection', `Wrong error: ${dupErr.code} ${dupErr.message}`);
  } else {
    fail('Duplicate slug rejection', 'INSERT succeeded — duplicate slug allowed!');
    // Clean up the duplicate
    await admin.from('products').delete().eq('slug', 'slug-test-a').neq('id', tmp.id);
  }

  // Try UPDATE an existing product to collide slug
  const { data: tmp2 } = await admin
    .from('products')
    .insert({ name: 'Slug Test B', slug: 'slug-test-b', is_active: false, is_available: true, is_featured: false, display_order: 998 })
    .select('id')
    .single();

  if (tmp2) {
    const { error: updateErr } = await admin
      .from('products')
      .update({ slug: 'slug-test-a' })
      .eq('id', tmp2.id);

    if (updateErr && updateErr.code === '23505') {
      pass('Duplicate slug UPDATE blocked: 23505');
    } else {
      fail('Duplicate slug UPDATE', updateErr ? updateErr.message : 'UPDATE succeeded!');
    }
    await admin.from('products').delete().eq('id', tmp2.id);
  }

  // Clean up temp A
  await admin.from('products').delete().eq('id', tmp.id);
  pass('Temp slug-test-a cleaned up');
}

// ── 2. Publish/unpublish visibility ──────────────────────────────────────────
console.log('\n── 2. Publish/unpublish visibility ─────────────────────');

// Create an unpublished product
const { data: upProd, error: upErr } = await admin
  .from('products')
  .insert({ name: 'Vis Test', slug: 'vis-test', is_active: false, is_available: true, is_featured: false, display_order: 997 })
  .select('id, slug')
  .single();

if (upErr) { fail('Create vis-test product', upErr.message); }
else {
  // Anon should NOT see unpublished
  const { data: anonCheck } = await anon.from('products').select('id').eq('slug', 'vis-test');
  if (!anonCheck || anonCheck.length === 0) pass('Unpublished product hidden from anon');
  else fail('Unpublished visibility', 'Anon can see unpublished product!');

  // Publish
  await admin.from('products').update({ is_active: true }).eq('id', upProd.id);
  const { data: anonCheck2 } = await anon.from('products').select('id').eq('slug', 'vis-test');
  if (anonCheck2 && anonCheck2.length === 1) pass('Published product visible to anon');
  else fail('Published visibility', 'Anon cannot see published product');

  // Unpublish again
  await admin.from('products').update({ is_active: false }).eq('id', upProd.id);
  const { data: anonCheck3 } = await anon.from('products').select('id').eq('slug', 'vis-test');
  if (!anonCheck3 || anonCheck3.length === 0) pass('Republished→Unpublished: hidden from anon');
  else fail('Unpublish', 'Still visible after unpublish');

  // Cleanup
  await admin.from('products').delete().eq('id', upProd.id);
  pass('vis-test product cleaned up');
}

// ── 3. Availability flag ──────────────────────────────────────────────────────
console.log('\n── 3. Availability flag ─────────────────────────────────');

const { data: avProd } = await admin
  .from('products')
  .insert({ name: 'Avail Test', slug: 'avail-test', is_active: true, is_available: false, is_featured: false, display_order: 996 })
  .select('id, slug, is_available')
  .single();

if (avProd) {
  // Anon can READ the product (it's published) but sees is_available = false
  const { data: anonRead } = await anon.from('products').select('id, is_available').eq('slug', 'avail-test').single();
  if (anonRead?.is_available === false) pass('Anon sees is_available=false correctly');
  else fail('Availability flag', `Got is_available=${anonRead?.is_available}`);

  // Flip to available
  await admin.from('products').update({ is_available: true }).eq('id', avProd.id);
  const { data: anonRead2 } = await anon.from('products').select('is_available').eq('slug', 'avail-test').single();
  if (anonRead2?.is_available === true) pass('After flip: anon sees is_available=true');
  else fail('Availability flip', `Got ${anonRead2?.is_available}`);

  await admin.from('products').delete().eq('id', avProd.id);
  pass('avail-test product cleaned up');
}

// ── 4. Customer (anon) cannot write ──────────────────────────────────────────
console.log('\n── 4. Customer/anon WRITE boundary ─────────────────────');

// Try to write product_images (customer POV)
const { data: anyProd } = await admin.from('products').select('id').limit(1).single();

const { error: custImgErr } = await anon
  .from('product_images')
  .insert({ product_id: anyProd.id, storage_path: 'hack/pwn.jpg', display_order: 0 });
if (custImgErr) pass(`Anon cannot INSERT product_images: ${custImgErr.code}`);
else fail('Anon product_images INSERT', 'Succeeded — RLS HOLE');

const { error: custDelErr } = await anon
  .from('products')
  .delete()
  .eq('id', anyProd.id);
if (custDelErr) pass(`Anon cannot DELETE products: ${custDelErr.code}`);
else fail('Anon products DELETE', 'Succeeded — RLS HOLE');

const { error: custSettErr } = await anon
  .from('store_settings')
  .update({ value: '0' })
  .eq('key', 'shipping_fee');
if (custSettErr) pass(`Anon cannot UPDATE store_settings: ${custSettErr.code}`);
else fail('Anon store_settings UPDATE', 'Succeeded — RLS HOLE');

// ── 5. QA cleanup ─────────────────────────────────────────────────────────────
console.log('\n── 5. QA cleanup check ──────────────────────────────────');
const { data: remaining } = await admin
  .from('products')
  .select('name, slug')
  .or('slug.ilike.%test%,name.ilike.%test%');
if (!remaining || remaining.length === 0) pass('No test artifacts remain in DB');
else fail('QA cleanup', `Found: ${remaining.map(p => p.slug).join(', ')}`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('✅ All security/feature checks passed.');
