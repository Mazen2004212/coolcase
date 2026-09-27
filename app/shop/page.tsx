import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteContainer } from "@/components/layout/site-container";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import { getPublishedProducts, getCollectionProducts } from "@/lib/catalog/queries";
import "./shop.css";

export const metadata: Metadata = { title: "All Cases", description: "Find the Coolcase design that feels like you." };

type Props = { searchParams: Promise<{ collection?: string | string[] }> };

export default async function ShopPage({ searchParams }: Props) {
  const rawCollection = (await searchParams).collection;
  const collectionSlug = (Array.isArray(rawCollection) ? rawCollection[0] : rawCollection ?? "").trim().toLowerCase();

  let products;
  let collectionName: string | null = null;
  let collectionDescription: string | null = null;

  if (collectionSlug) {
    const result = await getCollectionProducts(collectionSlug);
    products = result.products;
    collectionName = result.collection?.name ?? null;
    collectionDescription = result.collection?.description ?? null;
  } else {
    products = await getPublishedProducts();
  }

  // Map CatalogProduct → StorefrontProduct shape expected by ShopCatalog
  const shopProducts = products.map(p => ({
    id:        p.id,
    slug:      p.slug,
    name:      p.name,
    available: p.isAvailable,
    isNewArrival: p.isNewArrival,
    coverImage:p.coverImage,
    category:  p.categoryName ?? '',
    images:    p.images.map(img => ({ src: img.src, alt: img.alt })),
    pricing:   p.pricing,
  }));

  return (
    <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader />
      <main id="main-content" className="shop-page">
        <header className="shop-intro"><SiteContainer><p>The Coolcase Edit</p><h1>{collectionName ? `${collectionName.toUpperCase()} CASES` : collectionSlug ? "COLLECTION NOT FOUND" : "ALL CASES"}</h1><span>{collectionDescription ?? (collectionSlug && !collectionName ? "Choose another collection to keep browsing." : "Find the one that feels like you.")}</span></SiteContainer></header>
        <SiteContainer><ShopCatalog products={shopProducts} collectionFilter={Boolean(collectionSlug)} /></SiteContainer>
      </main><SiteFooter />
    </div>
  );
}
