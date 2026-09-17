import type { Metadata } from "next";
import { CustomerPageShell } from "@/components/layout/customer-page-shell";
import { SiteContainer } from "@/components/layout/site-container";
import { TrackOrderForm } from "@/components/storefront/track-order-form";

export const metadata: Metadata = { title: "Track Order", description: "Prepare to track your Coolcase order." };

export default function TrackOrderPage() {
  return <CustomerPageShell><section className="customer-page track-page"><SiteContainer><div className="track-layout"><header className="customer-page-heading"><p>Order status</p><h1>TRACK YOUR ORDER</h1><span>Use the same contact details provided at checkout.</span></header><div><TrackOrderForm /></div></div></SiteContainer></section></CustomerPageShell>;
}
