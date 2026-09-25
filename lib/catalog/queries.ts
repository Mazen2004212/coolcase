// Catalog queries — server-side only.
// All queries use the SSR Supabase client which respects RLS automatically.
// Public reads use anon key (via server client without admin privileges).

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { mapProduct, mapSettings } from './mapper';
import type { CatalogProduct, StoreSettings, CatalogCollection } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function getStorageUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/product-assets/${storagePath}`;
}

// ─── Product queries ─────────────────────────────────────────────────────────

/** All published active products (is_active=true), ordered by display_order. */
export const getPublishedProducts = cache(async (): Promise<CatalogProduct[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name, short_description, description,
      is_available, is_active, is_featured, display_order,
      silicone_original_price_override, acrylic_original_price_override, double_layer_original_price_override,
      silicone_price_override, acrylic_price_override, double_layer_price_override,
      silicone_enabled, acrylic_enabled, double_layer_enabled,
      categories ( id, name, slug ),
      product_images (
        id, storage_path, alt_text, display_order, is_primary
      )
    `)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[catalog] getPublishedProducts error:', error.message);
    return [];
  }

  const settings = await getStoreSettings();
  return (data ?? []).map(row => mapProduct(row, settings, SUPABASE_URL));
});

/** Single published product by slug. Returns null if not found or inactive. */
export const getProductBySlug = cache(async (slug: string): Promise<CatalogProduct | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name, short_description, description,
      is_available, is_active, is_featured, display_order,
      silicone_original_price_override, acrylic_original_price_override, double_layer_original_price_override,
      silicone_price_override, acrylic_price_override, double_layer_price_override,
      silicone_enabled, acrylic_enabled, double_layer_enabled,
      categories ( id, name, slug ),
      product_images (
        id, storage_path, alt_text, display_order, is_primary
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[catalog] getProductBySlug error:', error.message);
    return null;
  }
  if (!data) return null;

  const settings = await getStoreSettings();
  return mapProduct(data, settings, SUPABASE_URL);
});

/** Featured published products (for homepage). */
export const getFeaturedProducts = cache(async (): Promise<CatalogProduct[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name, short_description, description,
      is_available, is_active, is_featured, display_order,
      silicone_original_price_override, acrylic_original_price_override, double_layer_original_price_override,
      silicone_price_override, acrylic_price_override, double_layer_price_override,
      silicone_enabled, acrylic_enabled, double_layer_enabled,
      categories ( id, name, slug ),
      product_images (
        id, storage_path, alt_text, display_order, is_primary
      )
    `)
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('display_order', { ascending: true })
    .limit(6);

  if (error) {
    console.error('[catalog] getFeaturedProducts error:', error.message);
    return [];
  }

  const settings = await getStoreSettings();
  return (data ?? []).map(row => mapProduct(row, settings, SUPABASE_URL));
});

/** Related products: same category first, then others. Excludes current product. */
export async function getRelatedProducts(currentProduct: CatalogProduct): Promise<CatalogProduct[]> {
  const all = await getPublishedProducts();
  const others = all.filter(p => p.id !== currentProduct.id);
  const sameCategory = others.filter(p => p.categorySlug === currentProduct.categorySlug);
  const different = others.filter(p => p.categorySlug !== currentProduct.categorySlug);
  return [...sameCategory, ...different].slice(0, 8);
}

/** Derive catalog collections from real published products. */
export async function getCatalogCollections(): Promise<CatalogCollection[]> {
  const products = await getPublishedProducts();

  const descriptions: Record<string, string> = {
    Graphic: 'Bold shapes and high-contrast artwork for a clean statement look.',
    Lace: 'Soft detail with a darker, expressive edge.',
    Floral: 'Flower-led designs ranging from soft to moody.',
    Typography: 'Cases built around words, lettering, and personality.',
    Collage: 'Layered graphics with an eclectic, scrapbook-inspired feel.',
  };

  const seen = new Set<string>();
  const collections: CatalogCollection[] = [];

  for (const product of products) {
    if (!product.categorySlug || !product.categoryName) continue;
    if (seen.has(product.categorySlug)) continue;
    seen.add(product.categorySlug);

    collections.push({
      name: product.categoryName,
      slug: product.categorySlug,
      description: descriptions[product.categoryName] ?? `Explore Coolcase ${product.categoryName.toLowerCase()} designs.`,
      representative: product,
    });
  }

  return collections;
}

/** Get products by collection (category) slug. */
export async function getCollectionProducts(collectionSlug: string): Promise<{ collection: CatalogCollection | null; products: CatalogProduct[] }> {
  const [allProducts, allCollections] = await Promise.all([
    getPublishedProducts(),
    getCatalogCollections(),
  ]);

  const collection = allCollections.find(c => c.slug === collectionSlug.toLowerCase()) ?? null;
  const products = collection
    ? allProducts.filter(p => p.categorySlug === collection.slug)
    : [];

  return { collection, products };
}

// ─── Store settings ──────────────────────────────────────────────────────────

/** Public store settings (is_public=true only). Cached per request. */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')
    .eq('is_public', true);

  return mapSettings(data ?? []);
});

/** All store settings including private (admin only — bypasses public-only filter). */
export const getAllStoreSettings = cache(async (): Promise<Record<string, unknown>> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('store_settings')
    .select('key, value, is_public, updated_at');

  const result: Record<string, unknown> = {};
  for (const row of data ?? []) {
    result[row.key] = row.value;
  }
  return result;
});
