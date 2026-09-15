import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteContainer } from "@/components/layout/site-container";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import { products as allProducts } from "@/lib/data/products";
import { getCollectionProducts } from "@/lib/data/collections";
import "./shop.css";

export const metadata: Metadata = { title: "All Cases", description: "Find the Coolcase design that feels like you." };

type Props = { searchParams: Promise<{ collection?: string | string[] }> };

export default async function ShopPage({ searchParams }: Props) {
  const rawCollection = (await searchParams).collection;
  const collectionSlug = (Array.isArray(rawCollection) ? rawCollection[0] : rawCollection ?? "").trim().toLowerCase();
  const result = collectionSlug ? getCollectionProducts(collectionSlug) : null;
  const products = result ? result.products : allProducts;
  return (
    <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader />
      <main id="main-content" className="shop-page">
        <header className="shop-intro"><SiteContainer><p>The Coolcase Edit</p><h1>{result?.collection ? `${result.collection.name.toUpperCase()} CASES` : collectionSlug ? "COLLECTION NOT FOUND" : "ALL CASES"}</h1><span>{result?.collection?.description ?? (collectionSlug ? "Choose another collection to keep browsing." : "Find the one that feels like you.")}</span></SiteContainer></header>
        <SiteContainer><ShopCatalog products={products} collectionFilter={Boolean(collectionSlug)} /></SiteContainer>
      </main><SiteFooter />
    </div>
  );
}
