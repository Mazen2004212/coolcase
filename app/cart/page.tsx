import type { Metadata } from "next";
import { CartPageContent } from "@/components/cart/cart-page-content";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./cart.css";

export const metadata: Metadata = { title: "Your Cart", description: "Review your Coolcase selections." };
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";

export default async function CartPage() {
  const supabase = createAdminClient();
  const { data: shippingSetting } = await supabase.from('store_settings').select('value').eq('key', 'shipping_fee').single();
  const shippingFee = Number(shippingSetting?.value) || 50;

  return <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="cart-page"><SiteContainer><CartPageContent shippingFee={shippingFee} /></SiteContainer></main><SiteFooter /></div>;
}
