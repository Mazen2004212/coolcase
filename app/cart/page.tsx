import type { Metadata } from "next";
import { CartPageContent } from "@/components/cart/cart-page-content";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./cart.css";

export const metadata: Metadata = { title: "Your Cart", description: "Review your Coolcase selections." };

export default function CartPage() {
  return <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="cart-page"><SiteContainer><CartPageContent /></SiteContainer></main><SiteFooter /></div>;
}
