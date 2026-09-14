import type { Metadata } from "next";
import { CheckoutContent } from "@/components/checkout/checkout-content";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./checkout.css";

export const metadata: Metadata = { title: "Checkout", description: "Complete your Coolcase delivery and payment details." };

export default function CheckoutPage() {
  return <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="checkout-page"><SiteContainer><CheckoutContent /></SiteContainer></main><SiteFooter /></div>;
}
