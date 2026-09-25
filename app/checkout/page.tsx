import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutContent } from "@/components/checkout/checkout-content";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCustomer } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/server";
import { parseFiniteNumber, parseStoredBoolean } from "@/lib/settings/parsers";
import "./checkout.css";

export const metadata: Metadata = { title: "Checkout", description: "Complete your Coolcase delivery and payment details." };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const account = await getCustomer();
  const resolvedParams = await searchParams;
  const mode = resolvedParams.mode === 'buy-now' ? 'buy-now' : 'cart';
  
  // Phase 2 Checkout Rule: Redirect guests to login
  if (!account) {
    if (mode === 'buy-now') {
      redirect('/login?next=/checkout?mode=buy-now');
    } else {
      redirect('/login?next=/checkout');
    }
  }

  const { data } = await account.supabase
    .from("addresses")
    .select("id, label, recipient_name, phone, governorate, city_area, street_name, building_number, floor, apartment, landmark, is_default")
    .eq("user_id", account.user.id)
    .order("is_default", { ascending: false })
    .order("created_at");
    
  const customer = { 
    fullName: account.profile?.full_name || "", 
    phone: account.profile?.phone || "", 
    email: account.profile?.email || account.user.email || "", 
    addresses: data ?? [] 
  };

  const supabase = createAdminClient();
  const { data: storeSettings } = await supabase.from('store_settings').select('key, value');
  
  let shippingFee = 50;
  let instapayNumber = "";
  let whatsapp = "";
  let codEnabled = true;
  let instapayEnabled = true;

  if (storeSettings) {
    for (const row of storeSettings) {
      if (row.key === 'shipping_fee') shippingFee = parseFiniteNumber(row.value, 50);
      if (row.key === 'instapay_number') instapayNumber = String(row.value);
      if (row.key === 'whatsapp_number') whatsapp = String(row.value);
      if (row.key === 'cod_enabled') codEnabled = parseStoredBoolean(row.value, true);
      if (row.key === 'instapay_enabled') instapayEnabled = parseStoredBoolean(row.value, true);
    }
  }

  return (
    <div id="top">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <SiteHeader />
      <main id="main-content" className="checkout-page">
        <SiteContainer>
          <CheckoutContent 
            customer={customer} 
            shippingFee={shippingFee}
            mode={mode}
            storeSettings={{
              instapayNumber,
              whatsapp,
              codEnabled,
              instapayEnabled
            }}
          />
        </SiteContainer>
      </main>
      <SiteFooter />
    </div>
  );
}
