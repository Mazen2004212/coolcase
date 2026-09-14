import { BenefitsSection } from "@/components/home/benefits-section";
import { BrandMarquee } from "@/components/home/brand-marquee";
import { FeaturedCollection } from "@/components/home/featured-collection";
import { FindYourCase } from "@/components/home/find-your-case";
import { Hero } from "@/components/home/hero";
import { StatementBanner } from "@/components/home/statement-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <div id="top" className="min-h-svh bg-background text-foreground">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <BrandMarquee />
        <FindYourCase />
        <FeaturedCollection />
        <StatementBanner />
        <BenefitsSection />
      </main>
      <SiteFooter />
    </div>
  );
}
