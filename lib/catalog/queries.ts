// Storefront catalog queries. Public reads use the SSR client and RLS.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { mapProduct, mapSettings } from './mapper';
import type { CatalogProduct, StoreSettings, CatalogCollection } from './types';
import { resolvePublicMediaUrl } from '@/lib/storage/public-media-core';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const PRODUCT_SELECT = `
  id, slug, name, short_description, description,
  is_available, is_active, is_featured, display_order,
  silicone_original_price_override, acrylic_original_price_override, double_layer_original_price_override,
  silicone_price_override, acrylic_price_override, double_layer_price_override,
  silicone_enabled, acrylic_enabled, double_layer_enabled,
  categories ( id, name, slug ),
  product_images ( id, storage_path, alt_text, display_order, is_primary )
`;

export function getStorageUrl(storagePath: string): string {
  return resolvePublicMediaUrl(storagePath, SUPABASE_URL);
}

/** One batched lookup per request: collection membership, never one query per product. */
const getActiveNewArrivalProductIds = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('id')
    .eq('collection_type', 'NEW_ARRIVALS')
    .eq('is_active', true)
    .maybeSingle();

  if (collectionError || !collection) return new Set<string>();

  const { data, error } = await supabase
    .from('collection_products')
    .select('product_id')
    .eq('collection_id', collection.id);

  if (error) {
    console.error('[catalog] New Arrivals membership error:', error.message);
    return new Set<string>();
  }
  return new Set((data ?? []).map(row => row.product_id));
});

async function mapCatalogRows(rows: Parameters<typeof mapProduct>[0][]): Promise<CatalogProduct[]> {
  const [settings, newArrivalIds] = await Promise.all([
    getStoreSettings(),
    getActiveNewArrivalProductIds(),
  ]);
  return rows.map(row => mapProduct(row, settings, SUPABASE_URL, newArrivalIds.has(row.id)));
}

export const getPublishedProducts = cache(async (): Promise<CatalogProduct[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[catalog] getPublishedProducts error:', error.message);
    return [];
  }
  return mapCatalogRows(data ?? []);
});

export const getProductBySlug = cache(async (slug: string): Promise<CatalogProduct | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[catalog] getProductBySlug error:', error.message);
    return null;
  }
  if (!data) return null;
  return (await mapCatalogRows([data]))[0] ?? null;
});

export const getFeaturedProducts = cache(async (): Promise<CatalogProduct[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('display_order', { ascending: true })
    .limit(6);

  if (error) {
    console.error('[catalog] getFeaturedProducts error:', error.message);
    return [];
  }
  return mapCatalogRows(data ?? []);
});

export async function getRelatedProducts(currentProduct: CatalogProduct): Promise<CatalogProduct[]> {
  const all = await getPublishedProducts();
  const others = all.filter(product => product.id !== currentProduct.id);
  return [
    ...others.filter(product => product.categorySlug === currentProduct.categorySlug),
    ...others.filter(product => product.categorySlug !== currentProduct.categorySlug),
  ].slice(0, 8);
}

/** Active, real collections ordered for storefront discovery. */
export const getCatalogCollections = cache(async (): Promise<CatalogCollection[]> => {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('collections')
    .select('id, name, slug, description, collection_type, banner_image_url, is_featured, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error || !rows?.length) {
    if (error) console.error('[catalog] getCatalogCollections error:', error.message);
    return [];
  }

  const collectionIds = rows.map(row => row.id);
  const [{ data: memberships }, products] = await Promise.all([
    supabase
      .from('collection_products')
      .select('collection_id, product_id, sort_order')
      .in('collection_id', collectionIds)
      .order('sort_order', { ascending: true }),
    getPublishedProducts(),
  ]);
  const productById = new Map(products.map(product => [product.id, product]));

  return rows.map(row => {
    const orderedProducts = (memberships ?? [])
      .filter(membership => membership.collection_id === row.id)
      .map(membership => productById.get(membership.product_id))
      .filter((product): product is CatalogProduct => Boolean(product));
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      collectionType: row.collection_type as CatalogCollection['collectionType'],
      bannerImage: row.banner_image_url ? getStorageUrl(row.banner_image_url) : null,
      isFeatured: row.is_featured,
      sortOrder: row.sort_order,
      productCount: orderedProducts.length,
      representative: orderedProducts[0] ?? null,
    };
  });
});

export const getCollectionProducts = cache(async (
  collectionSlug: string,
): Promise<{ collection: CatalogCollection | null; products: CatalogProduct[] }> => {
  const collections = await getCatalogCollections();
  const collection = collections.find(item => item.slug === collectionSlug.toLowerCase()) ?? null;
  if (!collection) return { collection: null, products: [] };

  const supabase = await createClient();
  const [{ data: memberships, error }, allProducts] = await Promise.all([
    supabase
      .from('collection_products')
      .select('product_id, sort_order')
      .eq('collection_id', collection.id)
      .order('sort_order', { ascending: true }),
    getPublishedProducts(),
  ]);
  if (error) return { collection, products: [] };

  const byId = new Map(allProducts.map(product => [product.id, product]));
  const products = (memberships ?? [])
    .map(membership => byId.get(membership.product_id))
    .filter((product): product is CatalogProduct => Boolean(product));
  return { collection, products };
});

export const getNewArrivalProducts = cache(async (): Promise<CatalogProduct[]> => {
  const collection = (await getCatalogCollections())
    .find(item => item.collectionType === 'NEW_ARRIVALS');
  if (!collection) return [];
  return (await getCollectionProducts(collection.slug)).products;
});

export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')
    .eq('is_public', true);
  return mapSettings(data ?? []);
});

export const getAllStoreSettings = cache(async (): Promise<Record<string, unknown>> => {
  const supabase = await createClient();
  const { data } = await supabase.from('store_settings').select('key, value, is_public, updated_at');
  return Object.fromEntries((data ?? []).map(row => [row.key, row.value]));
});