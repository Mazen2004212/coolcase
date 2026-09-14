import type { Metadata } from "next";
import { CustomCaseBuilder } from "@/components/custom-cases/custom-case-builder";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "@/app/products/[slug]/product.css";
import "./custom-cases.css";

export const metadata: Metadata = { title: "Your Custom Case", description: "Upload your image and turn it into a Coolcase made for your phone." };

export default function CustomCasesPage() {
  return <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="custom-cases-page"><SiteContainer><CustomCaseBuilder /></SiteContainer></main><SiteFooter /></div>;
}
