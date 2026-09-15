import type { Metadata } from "next";
import { CheckoutContent } from "@/components/checkout/checkout-content";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCustomer } from "@/lib/auth/user";
import "./checkout.css";

export const metadata: Metadata = { title: "Checkout", description: "Complete your Coolcase delivery and payment details." };

export default async function CheckoutPage() {
  const account = await getCustomer();
  let customer;
  if (account) {
    const { data } = await account.supabase.from("addresses").select("id, label, recipient_name, phone, governorate, city_area, street_name, building_number, floor, apartment, landmark, is_default").eq("user_id", account.user.id).order("is_default", { ascending: false }).order("created_at");
    customer = { fullName: account.profile?.full_name || "", phone: account.profile?.phone || "", email: account.profile?.email || account.user.email || "", addresses: data ?? [] };
  }
  return <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="checkout-page"><SiteContainer><CheckoutContent customer={customer} /></SiteContainer></main><SiteFooter /></div>;
}
