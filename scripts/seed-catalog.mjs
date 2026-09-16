/**
 * Coolcase — Backend Phase 1 Catalog Seed
 *
 * Uploads the 5 real product images to Supabase Storage (product-assets bucket)
 * and inserts the corresponding product records + product_images rows.
 *
 * Idempotent: re-running skips products/images that already exist.
 *
 * Required env vars (server-side only, NEVER expose to browser):
 *   COOLCASE_SUPABASE_URL
 *   COOLCASE_SUPABASE_SERVICE_ROLE_KEY
 *   COOLCASE_EXPECTED_PROJECT_REF
 *
 * Usage:
 *   node scripts/seed-catalog.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.COOLCASE_SUPABASE_URL;
const serviceKey = process.env.COOLCASE_SUPABASE_SERVICE_ROLE_KEY;
const expectedRef = process.env.COOLCASE_EXPECTED_PROJECT_REF;

if (!url || !serviceKey || !expectedRef) {
  throw new Error(
    'Missing COOLCASE_SUPABASE_URL, COOLCASE_SUPABASE_SERVICE_ROLE_KEY, or COOLCASE_EXPECTED_PROJECT_REF'
  );
}
const projectHost = new URL(url).hostname;
if (projectHost !== `${expectedRef}.supabase.co`) {
  throw new Error('URL does not match the expected project ref — aborting to protect the wrong project.');
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

// Resolve paths relative to this script's location (scripts/) → repo root
const repoRoot = join(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', '..');
const assetsDir = join(repoRoot, 'public', 'assets', 'products');

const BUCKET = 'product-assets';

// ─── Product definitions ────────────────────────────────────────────────────

const PRODUCTS = [
  {
    slug:             'abstract-halftone',
    name:             'Abstract Halftone',
    categorySlug:     'graphic',
    short_description:'A bold monochrome design with fluid graphic movement.',
    description:      'A bold monochrome design with fluid graphic movement. Made for a clean statement look that still feels easy to style every day.',
    is_featured:      true,
    is_active:        true,
    is_available:     true,
    display_order:    10,
    imageFile:        'Abstract halftone.png',
    imageAlt:         'Abstract Halftone phone case — graphic monochrome design',
  },
  {
    slug:             'pink-lace',
    name:             'Pink Lace',
    categorySlug:     'lace',
    short_description:'Dark lace-inspired detailing with a soft pink contrast.',
    description:      'Dark lace-inspired detailing with a soft pink contrast. A feminine statement case with a slightly dramatic edge.',
    is_featured:      true,
    is_active:        true,
    is_available:     true,
    display_order:    20,
    imageFile:        'Black and pink lace iPhone case.png',
    imageAlt:         'Pink Lace phone case — black and pink lace pattern',
  },
  {
    slug:             'black-lily',
    name:             'Black Lily',
    categorySlug:     'floral',
    short_description:'A deep black case centered around a soft pink floral design.',
    description:      'A deep black case centered around a soft pink floral design. Clean, moody, and easy to pair with almost anything.',
    is_featured:      true,
    is_active:        true,
    is_available:     true,
    display_order:    30,
    imageFile:        'Black Floral iPhone Case Mockup.png',
    imageAlt:         'Black Lily phone case — dark floral design',
  },
  {
    slug:             'amor',
    name:             'Amor',
    categorySlug:     'typography',
    short_description:'A playful pink statement design with bold typography.',
    description:      'A playful pink statement design with bold typography. Bright, expressive, and made for a more colorful everyday look.',
    is_featured:      false,
    is_active:        true,
    is_available:     true,
    display_order:    40,
    imageFile:        'amor.png',
    imageAlt:         'Amor phone case — bold pink typography design',
  },
  {
    slug:             'blue-collage',
    name:             'Blue Collage',
    categorySlug:     'collage',
    short_description:'A mixed graphic collage with blue accents and decorative details.',
    description:      'A mixed graphic collage with blue accents and decorative details. A fun choice for an eclectic, scrapbook-inspired style.',
    is_featured:      false,
    is_active:        true,
    is_available:     true,
    display_order:    50,
    imageFile:        'Blue-silver leopard.png',
    imageAlt:         'Blue Collage phone case — blue graphic collage design',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[seed-catalog] ${msg}`); }
function warn(msg) { console.warn(`[seed-catalog] WARN: ${msg}`); }

async function getCategoryId(slug) {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error) throw new Error(`Category not found for slug "${slug}": ${error.message}`);
  return data.id;
}

async function getOrCreateProduct(categoryId, productDef) {
  // Check if product already exists by slug
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('slug', productDef.slug)
    .maybeSingle();

  if (existing) {
    log(`  Product "${productDef.slug}" already exists — skipping insert.`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      category_id:       categoryId,
      name:              productDef.name,
      slug:              productDef.slug,
      short_description: productDef.short_description,
      description:       productDef.description,
      is_featured:       productDef.is_featured,
      is_active:         productDef.is_active,
      is_available:      productDef.is_available,
      display_order:     productDef.display_order,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to insert product "${productDef.slug}": ${error.message}`);
  log(`  Inserted product "${productDef.name}" (${data.id})`);
  return data.id;
}

async function uploadImage(productId, productSlug, imageFile, altText) {
  // Check if a primary image already exists for this product
  const { data: existing } = await supabase
    .from('product_images')
    .select('id, storage_path')
    .eq('product_id', productId)
    .eq('is_primary', true)
    .maybeSingle();

  if (existing) {
    log(`  Image already exists for "${productSlug}" — skipping upload.`);
    return existing.storage_path;
  }

  const filePath = join(assetsDir, imageFile);
  if (!existsSync(filePath)) {
    warn(`  Image file not found: ${filePath} — skipping.`);
    return null;
  }

  const ext = extname(imageFile).toLowerCase().replace('.', '');
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif' };
  const contentType = mimeMap[ext] ?? 'image/png';
  const storagePath = `products/${productId}/${productId}.${ext}`;

  const fileBuffer = readFileSync(filePath);

  // Check if already uploaded to Storage
  const { data: existing_obj } = await supabase.storage.from(BUCKET).list(`products/${productId}`);
  if (existing_obj && existing_obj.length > 0) {
    log(`  Storage object already exists for "${productSlug}" — skipping upload.`);
  } else {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, { contentType, upsert: false });

    if (uploadError) throw new Error(`Storage upload failed for "${productSlug}": ${uploadError.message}`);
    log(`  Uploaded ${storagePath}`);
  }

  // Insert product_images row
  const { error: imgError } = await supabase
    .from('product_images')
    .insert({
      product_id:    productId,
      storage_path:  storagePath,
      alt_text:      altText,
      display_order: 0,
      is_primary:    true,
    });

  if (imgError) {
    // Try to clean up the uploaded storage object
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`product_images insert failed for "${productSlug}": ${imgError.message}`);
  }

  log(`  Registered image for "${productSlug}" at ${storagePath}`);
  return storagePath;
}

// ─── Main ────────────────────────────────────────────────────────────────────

log('Starting catalog seed...');
log(`Target: ${url}`);

for (const product of PRODUCTS) {
  log(`\nProcessing: ${product.name}`);
  const categoryId = await getCategoryId(product.categorySlug);
  const productId = await getOrCreateProduct(categoryId, product);
  await uploadImage(productId, product.slug, product.imageFile, product.imageAlt);
}

log('\nCatalog seed complete.');
