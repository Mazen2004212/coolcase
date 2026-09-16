// Maps raw DB rows → catalog types.
// Keeps all pricing logic in one place.

import { defaultMaterialPricing } from '@/lib/data/product-options';
import type { CatalogProduct, StoreSettings } from './types';

// ─── DB row shape (what Supabase returns from our select) ─────────────────────

type RawProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  is_available: boolean;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  silicone_price_override: number | null;
  acrylic_price_override: number | null;
  double_layer_price_override: number | null;
  categories: { id: string; name: string; slug: string } | null;
  product_images: Array<{
    id: string;
    storage_path: string;
    alt_text: string | null;
    display_order: number;
    is_primary: boolean;
  }>;
};

type SettingsRow = { key: string; value: unknown };

// ─── Settings mapper ──────────────────────────────────────────────────────────

function numSetting(rows: SettingsRow[], key: string, fallback: number): number {
  const row = rows.find(r => r.key === key);
  if (!row) return fallback;
  const v = row.value;
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : fallback; }
  return fallback;
}

function boolSetting(rows: SettingsRow[], key: string, fallback: boolean): boolean {
  const row = rows.find(r => r.key === key);
  if (!row) return fallback;
  return Boolean(row.value);
}

function strSetting(rows: SettingsRow[], key: string, fallback: string): string {
  const row = rows.find(r => r.key === key);
  if (!row) return fallback;
  const v = row.value;
  if (typeof v === 'string') return v;
  return fallback;
}

export function mapSettings(rows: SettingsRow[]): StoreSettings {
  return {
    siliconOriginalPrice:    numSetting(rows, 'silicone_original_price',     defaultMaterialPricing.silicon.original),
    siliconSellingPrice:     numSetting(rows, 'silicone_selling_price',      defaultMaterialPricing.silicon.discounted),
    acrylicOriginalPrice:    numSetting(rows, 'acrylic_original_price',      defaultMaterialPricing.acrylic.original),
    acrylicSellingPrice:     numSetting(rows, 'acrylic_selling_price',       defaultMaterialPricing.acrylic.discounted),
    doubleLayerOriginalPrice:numSetting(rows, 'double_layer_original_price', defaultMaterialPricing['double-layer'].original),
    doubleLayerSellingPrice: numSetting(rows, 'double_layer_selling_price',  defaultMaterialPricing['double-layer'].discounted),
    customOriginalPrice:     numSetting(rows, 'custom_original_price',       289),
    customSellingPrice:      numSetting(rows, 'custom_selling_price',        239),
    shippingFee:             numSetting(rows, 'shipping_fee',                50),
    codEnabled:              boolSetting(rows,'cod_enabled',                 true),
    instapayEnabled:         boolSetting(rows,'instapay_enabled',            true),
    instapayNumber:          strSetting(rows, 'instapay_number',             '01152966212'),
    whatsappNumber:          strSetting(rows, 'whatsapp_number',             '01142966212'),
    storeName:               strSetting(rows, 'store_name',                  'Coolcase'),
    currency:                strSetting(rows, 'currency',                    'EGP'),
  };
}

// ─── Product mapper ───────────────────────────────────────────────────────────

export function mapProduct(row: RawProductRow, settings: StoreSettings, supabaseUrl: string): CatalogProduct {
  // Sort images: primary first, then by display_order
  const sortedImages = [...row.product_images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.display_order - b.display_order;
  });

  const images = sortedImages.map(img => ({
    id: img.id,
    src: `${supabaseUrl}/storage/v1/object/public/product-assets/${img.storage_path}`,
    alt: img.alt_text ?? `${row.name} phone case`,
    isPrimary: img.is_primary,
    displayOrder: img.display_order,
  }));

  const coverImage = images[0]?.src ?? null;

  // Build per-material pricing (product overrides take precedence)
  const pricing = {
    silicon: {
      original:   settings.siliconOriginalPrice,
      discounted: row.silicone_price_override ?? settings.siliconSellingPrice,
    },
    acrylic: {
      original:   settings.acrylicOriginalPrice,
      discounted: row.acrylic_price_override ?? settings.acrylicSellingPrice,
    },
    'double-layer': {
      original:   settings.doubleLayerOriginalPrice,
      discounted: row.double_layer_price_override ?? settings.doubleLayerSellingPrice,
    },
  } as const;

  return {
    id:              row.id,
    slug:            row.slug,
    name:            row.name,
    shortDescription:row.short_description,
    description:     row.description,
    categoryName:    row.categories?.name ?? null,
    categorySlug:    row.categories?.slug ?? null,
    isAvailable:     row.is_available,
    isActive:        row.is_active,
    isFeatured:      row.is_featured,
    displayOrder:    row.display_order,
    images,
    pricing,
    coverImage,
  };
}
