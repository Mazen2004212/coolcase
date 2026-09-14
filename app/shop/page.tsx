import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteContainer } from "@/components/layout/site-container";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import { products } from "@/lib/data/products";
import "./shop.css";

export const metadata: Metadata = { title: "All Cases", description: "Find the Coolcase design that feels like you." };

export default function ShopPage() {
  return (
    <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader />
      <main id="main-content" className="shop-page">
        <header className="shop-intro"><SiteContainer><p>The Coolcase Edit</p><h1>ALL CASES</h1><span>Find the one that feels like you.</span></SiteContainer></header>
        <SiteContainer><ShopCatalog products={products} /></SiteContainer>
      </main><SiteFooter />
    </div>
  );
}
