import type { Metadata } from "next";
import { Search } from "lucide-react";
import { CustomerPageShell } from "@/components/layout/customer-page-shell";
import { SiteContainer } from "@/components/layout/site-container";
import { ProductCard } from "@/components/product/product-card";
import { getPublishedProducts } from "@/lib/catalog/queries";
import type { ShopProduct } from "@/components/shop/shop-catalog";

export const metadata: Metadata = { title: "Search", description: "Search the current Coolcase collection." };
type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: Props) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "").trim().slice(0, 80);
  const normalized = query.toLocaleLowerCase("en");

  const catalog = query ? await getPublishedProducts() : [];
  const results: ShopProduct[] = query
    ? catalog
        .filter((p) => `${p.name} ${p.description ?? ''} ${p.categoryName ?? ''}`.toLocaleLowerCase("en").includes(normalized))
        .map(p => ({
          id: p.id, slug: p.slug, name: p.name, available: p.isAvailable,
          isNewArrival: p.isNewArrival,
          coverImage: p.coverImage, category: p.categoryName ?? '',
          images: p.images.map(img => ({ src: img.src, alt: img.alt })),
          pricing: p.pricing,
        }))
    : [];

  return <CustomerPageShell><section className="customer-page search-page"><SiteContainer><header className="customer-page-heading"><p>Search Coolcase</p><h1>FIND YOUR CASE</h1><span>Search by design name or style.</span></header><form className="search-form" role="search" action="/search"><label htmlFor="case-search">Search cases</label><div><Search aria-hidden="true" /><input id="case-search" name="q" type="search" defaultValue={query} placeholder="Try Abstract, Floral, or Lily" autoFocus maxLength={80} /><button type="submit">Search</button></div></form>{query ? <div className="search-result-heading" aria-live="polite"><p>{results.length} {results.length === 1 ? "result" : "results"} for</p><h2>&quot;{query}&quot;</h2></div> : <div className="search-prompt"><p>Start with a case name or collection style.</p></div>}{query && results.length ? <div className="search-results">{results.map((product) => <ProductCard key={product.slug} product={product} eager />)}</div> : null}{query && !results.length ? <div className="customer-empty" role="status"><h2>NO CASES FOUND</h2><p>Try another search.</p></div> : null}</SiteContainer></section></CustomerPageShell>;
}
