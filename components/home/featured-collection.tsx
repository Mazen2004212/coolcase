import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CustomCaseCard } from "@/components/home/custom-case-card";
import { SiteContainer } from "@/components/layout/site-container";
import { ProductCard } from "@/components/product/product-card";
import { getFeaturedProducts } from "@/lib/catalog/queries";
import type { ShopProduct } from "@/components/shop/shop-catalog";

export async function FeaturedCollection() {
  const catalog = await getFeaturedProducts();

  const products: ShopProduct[] = catalog.map(p => ({
    id:         p.id,
    slug:       p.slug,
    name:       p.name,
    available:  p.isAvailable,
    coverImage: p.coverImage,
    category:   p.categoryName ?? '',
    images:     p.images.map(img => ({ src: img.src, alt: img.alt })),
    pricing:    p.pricing,
  }));

  return (
    <section id="featured" className="featured-section" aria-labelledby="featured-title">
      <SiteContainer>
        <div className="section-title-row">
          <h2 id="featured-title" className="display-heading">The Coolcase Edit</h2>
          <Link href="/shop" prefetch={false} className="text-link">
            Explore all cases
            <ArrowRight aria-hidden="true" size={17} strokeWidth={1.7} />
          </Link>
        </div>
        <div className="product-grid" data-merchandising-grid>
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
          <CustomCaseCard />
        </div>
      </SiteContainer>
    </section>
  );
}
