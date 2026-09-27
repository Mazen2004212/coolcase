import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteContainer } from "@/components/layout/site-container";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductMaterialProvider } from "@/components/product/product-material-context";
import { ProductPurchase } from "@/components/product/product-purchase";
import { DeliveryTimeline } from "@/components/storefront/delivery-timeline";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog/queries";
import { formatPrice, phoneBrands } from "@/lib/data/product-options";
import "./product.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return { title: product ? `${product.name} Phone Case` : "Case not found", description: product?.description ?? undefined };
}

export default async function ProductPage({ params }: Props) {
  const slug = (await params).slug;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);

  // Build gallery images from CatalogProduct
  const galleryImages = product.images.map(img => ({
    src: img.src,
    alt: img.alt,
    label: img.isPrimary ? "Full design" : "Gallery image",
    view: (img.isPrimary ? "full" : "detail") as "full" | "detail" | "guide",
  }));

  // Build purchase-compatible product object
  const purchaseProduct = {
    id:             product.id,
    slug:           product.slug,
    name:           product.name,
    available:      product.isAvailable,
    images:         galleryImages,
    pricing:        product.pricing,
    supportedBrands:[...phoneBrands] as typeof phoneBrands,
    materialsEnabled: product.materialsEnabled,
  };

  return (
    <div id="top">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <SiteHeader />
      <main id="main-content" className="pdp">
        <SiteContainer>
          <nav className="pdp-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={12} aria-hidden="true" /><Link href="/shop">Cases</Link><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{product.name}</span></nav>
          <ProductMaterialProvider>
            <div className="pdp-layout">
              <ProductGallery key={product.slug} images={galleryImages} name={product.name} />
              <div className="pdp-information">
                <p className="pdp-eyebrow">The Coolcase Edit / {product.categoryName ?? 'Cases'}</p>
                <h1>{product.name}</h1>
                <p className="pdp-description">{product.description}</p>
                <p className={`pdp-availability ${product.isAvailable ? "is-available" : "is-sold-out"}`}><span aria-hidden="true" />{product.isAvailable ? "Available" : "Sold Out"}</p>
                <ProductPurchase product={purchaseProduct} />
                <DeliveryTimeline />
                <section className="pdp-more-designs" aria-labelledby="more-designs-title">
                  <div><h2 id="more-designs-title">More designs</h2><a href="#more-cases">Find your next favourite <ArrowRight size={14} aria-hidden="true" /></a></div>
                  <div className="pdp-design-row">
                    {related.map((item) => <Link key={item.slug} href={`/products/${item.slug}`} aria-label={`View ${item.name}`}><Image src={item.coverImage ?? item.images[0]?.src ?? ''} alt={item.name} fill sizes="85px" /></Link>)}
                  </div>
                </section>
              </div>
            </div>
          </ProductMaterialProvider>
          <section className="pdp-recommendations" id="more-cases" aria-labelledby="more-cases-title">
            <div className="pdp-recommendations-heading"><div><p className="pdp-eyebrow">A different day. A different mood.</p><h2 id="more-cases-title">More Cases</h2></div><span>Keep your options open.</span></div>
            <div className="pdp-related-grid">
              {related.map((item) => <article key={item.slug}><Link href={`/products/${item.slug}`}><div className="pdp-related-image">{item.isNewArrival ? <span className="product-new-ribbon">NEW</span> : null}<Image src={item.coverImage ?? item.images[0]?.src ?? ''} alt={item.images[0]?.alt ?? item.name} fill sizes="(min-width: 1024px) 23vw, 45vw" />{!item.isAvailable ? <span className="product-sold-out">Sold Out</span> : null}<ArrowRight size={18} aria-hidden="true" /></div><h3>{item.name}</h3><p><strong>From {formatPrice(item.pricing.silicon.discounted)}</strong></p></Link></article>)}
            </div>
          </section>
        </SiteContainer>
      </main>
      <SiteFooter />
    </div>
  );
}
