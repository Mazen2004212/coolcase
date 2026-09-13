import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { SiteContainer } from "@/components/layout/site-container";
import { ProductCard } from "@/components/product/product-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { featuredProducts } from "@/lib/data/homepage";

export function FeaturedCollection() {
  return (
    <section
      id="featured"
      className="bg-surface-white py-[var(--section-spacing)]"
      aria-labelledby="featured-title"
    >
      <SiteContainer>
        <div className="flex items-end justify-between gap-6">
          <SectionHeading id="featured-title">
            Featured Collection
          </SectionHeading>
          <Link
            href="/shop"
            prefetch={false}
            className="hidden min-h-11 shrink-0 items-center gap-2 border-b border-black text-sm font-medium sm:flex"
          >
            View All Cases
            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.7} />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.name} product={product} />
          ))}
        </div>

        <Link
          href="/shop"
          prefetch={false}
          className="mt-10 inline-flex min-h-11 items-center gap-2 border-b border-black text-sm font-medium sm:hidden"
        >
          View All Cases
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.7} />
        </Link>
      </SiteContainer>
    </section>
  );
}
