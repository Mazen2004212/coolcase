import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImagePlus, Type } from "lucide-react";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./custom-cases.css";

export const metadata: Metadata = { title: "Custom Cases", description: "Create a Coolcase from your artwork or personalize a named design." };

export default function CustomCasesPage() {
  return <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="custom-cases-page"><SiteContainer><header className="custom-landing-heading"><p className="pdp-eyebrow">Made personal</p><h1>CREATE YOUR COOLCASE</h1><p>Start with your own artwork or personalize our signature named design.</p></header><div className="custom-choice-grid"><Link href="/custom-cases/upload"><div className="cc-template-figure"><Image src="/assets/custom-cases/custom-case-upload-preview.png" alt="Example of uploading your own artwork" fill sizes="(max-width:639px) 85vw, 40vw"/></div><ImagePlus aria-hidden="true"/><span><small>01 / Your artwork</small><strong>Upload Your Design</strong><p>Turn your photo, artwork, or design into your own phone case.</p></span><b>Create Your Case <ArrowRight aria-hidden="true"/></b></Link><Link href="/custom-cases/named"><div className="cc-template-figure"><Image src="/assets/custom-cases/named/named-case-example.png" alt="Example of a personalized Coolcase named phone case" fill sizes="(max-width:639px) 85vw, 40vw"/></div><Type aria-hidden="true"/><span><small>02 / Personalized</small><strong>Named Custom Case</strong><p>Personalize the fixed design with your English and Arabic names.</p></span><b>Personalize It <ArrowRight aria-hidden="true"/></b></Link></div></SiteContainer></main><SiteFooter /></div>;
}
