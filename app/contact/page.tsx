import type { Metadata } from "next";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { CustomerPageShell } from "@/components/layout/customer-page-shell";
import { SiteContainer } from "@/components/layout/site-container";

export const metadata: Metadata = { title: "Contact", description: "Contact Coolcase customer support on WhatsApp." };

export default function ContactPage() {
  return <CustomerPageShell><section className="customer-page contact-page"><SiteContainer><div className="contact-panel"><div><p>Customer support</p><h1>NEED HELP?</h1><span>Questions about choosing a case, an existing order, custom cases, or InstaPay verification? Contact us on WhatsApp.</span></div><div className="contact-action"><MessageCircle aria-hidden="true" /><p>WhatsApp</p><strong>01142966212</strong><a href="https://wa.me/201142966212" target="_blank" rel="noopener noreferrer">Chat With Us on WhatsApp <ArrowUpRight aria-hidden="true" /></a></div></div></SiteContainer></section></CustomerPageShell>;
}
