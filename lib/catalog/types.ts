// Storefront-safe types for the public product catalog.
// These are the shapes the storefront uses — not raw DB rows.

import type { Material, MaterialPrice } from '@/lib/data/product-options';

export type CatalogImage = {
  id: string;
  src: string;       // Historical absolute Supabase URL or same-origin public media path
  alt: string;
  isPrimary: boolean;
  displayOrder: number;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  isAvailable: boolean;   // sold-out flag (true = in stock)
  isActive: boolean;      // published flag
  isFeatured: boolean;
  isNewArrival: boolean;
  displayOrder: number;
  images: CatalogImage[];
  pricing: Record<Material, MaterialPrice>;
  materialsEnabled: Record<Material, boolean>;
  // Convenience: primary image URL for product card thumbnail
  coverImage: string | null;
};

export type StoreSettings = {
  // Material pricing
  siliconOriginalPrice: number;
  siliconSellingPrice: number;
  acrylicOriginalPrice: number;
  acrylicSellingPrice: number;
  doubleLayerOriginalPrice: number;
  doubleLayerSellingPrice: number;
  customOriginalPrice: number;
  customSellingPrice: number;
  // Shipping & payments
  shippingFee: number;
  codEnabled: boolean;
  instapayEnabled: boolean;
  instapayNumber: string;
  whatsappNumber: string;
  // Store identity
  storeName: string;
  currency: string;
};

export type CatalogCollection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  collectionType: 'CUSTOM' | 'NEW_ARRIVALS';
  bannerImage: string | null;
  isFeatured: boolean;
  sortOrder: number;
  productCount: number;
  representative: CatalogProduct | null;
};
