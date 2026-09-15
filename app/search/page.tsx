import type { Metadata } from "next";
import { Search } from "lucide-react";
import { CustomerPageShell } from "@/components/layout/customer-page-shell";
import { SiteContainer } from "@/components/layout/site-container";
import { ProductCard } from "@/components/product/product-card";
import { products } from "@/lib/data/products";

export const metadata: Metadata = { title: "Search", description: "Search the current Coolcase collection." };
type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: Props) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "").trim().slice(0, 80);
  const normalized = query.toLocaleLowerCase("en");
  const results = query ? products.filter((product) => `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase("en").includes(normalized)) : [];
  return <CustomerPageShell><section className="customer-page search-page"><SiteContainer><header className="customer-page-heading"><p>Search Coolcase</p><h1>FIND YOUR CASE</h1><span>Search by design name or style.</span></header><form className="search-form" role="search" action="/search"><label htmlFor="case-search">Search cases</label><div><Search aria-hidden="true" /><input id="case-search" name="q" type="search" defaultValue={query} placeholder="Try Abstract, Floral, or Lily" autoFocus maxLength={80} /><button type="submit">Search</button></div></form>{query ? <div className="search-result-heading" aria-live="polite"><p>{results.length} {results.length === 1 ? "result" : "results"} for</p><h2>“{query}”</h2></div> : <div className="search-prompt"><p>Start with a case name or collection style.</p></div>}{query && results.length ? <div className="search-results">{results.map((product) => <ProductCard key={product.slug} product={product} eager />)}</div> : null}{query && !results.length ? <div className="customer-empty" role="status"><h2>NO CASES FOUND</h2><p>Try another search.</p></div> : null}</SiteContainer></section></CustomerPageShell>;
}
