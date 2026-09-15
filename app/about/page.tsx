import type { Metadata } from "next";
import Image from "next/image";
import { CustomerPageShell } from "@/components/layout/customer-page-shell";
import { SiteContainer } from "@/components/layout/site-container";

export const metadata: Metadata = { title: "About", description: "Phone cases with a point of view." };

export default function AboutPage() {
  return <CustomerPageShell><article className="customer-page about-page"><SiteContainer><header className="customer-page-heading"><p>About Coolcase</p><h1>PHONE CASES WITH A POINT OF VIEW.</h1><span>Coolcase is built around expressive designs, everyday protection, and cases that feel personal.</span></header><div className="about-image"><Image src="/assets/banners/statement-banner.png" alt="Coolcase campaign featuring expressive phone case style" fill priority sizes="100vw" /></div><div className="about-values"><section><span>01</span><h2>STYLE THAT FEELS LIKE YOU</h2><p>Graphic, floral, collage, and statement-led designs made to match different moods.</p></section><section><span>02</span><h2>EVERYDAY PROTECTION</h2><p>Choose the material and phone fit that works for your daily routine.</p></section><section><span>03</span><h2>YOUR IMAGE. YOUR CASE.</h2><p>Upload your own image when you want a case that is completely personal.</p></section></div></SiteContainer></article></CustomerPageShell>;
}
