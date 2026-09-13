import { BenefitsSection } from "@/components/home/benefits-section";
import { CategoryNav } from "@/components/home/category-nav";
import { CustomCasesBanner } from "@/components/home/custom-cases-banner";
import { FeaturedCollection } from "@/components/home/featured-collection";
import { Hero } from "@/components/home/hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <div id="top" className="min-h-svh bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <CategoryNav />
        <FeaturedCollection />
        <CustomCasesBanner />
        <BenefitsSection />
      </main>
      <SiteFooter />
    </div>
  );
}
