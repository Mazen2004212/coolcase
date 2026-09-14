import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CustomCaseCard } from "@/components/home/custom-case-card";
import { SiteContainer } from "@/components/layout/site-container";
import { ProductCard } from "@/components/product/product-card";
import { featuredProducts } from "@/lib/data/homepage";

export function FeaturedCollection() {
  return (
    <section
      id="featured"
      className="featured-section"
      aria-labelledby="featured-title"
    >
      <SiteContainer>
        <div className="section-title-row">
          <h2 id="featured-title" className="display-heading">
            The Coolcase Edit
          </h2>
          <Link href="/shop" prefetch={false} className="text-link">
            Explore all cases
            <ArrowRight aria-hidden="true" size={17} strokeWidth={1.7} />
          </Link>
        </div>
        <div className="product-grid" data-merchandising-grid>
          {featuredProducts.map((product) => (
           
            <ProductCard key={product.slug} product={product} />
          ))}
          <CustomCaseCard />
        </div>
      </SiteContainer>
    </section>
  );
}
