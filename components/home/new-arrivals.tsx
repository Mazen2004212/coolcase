import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SiteContainer } from '@/components/layout/site-container';
import { ProductCard } from '@/components/product/product-card';
import { getCatalogCollections, getNewArrivalProducts } from '@/lib/catalog/queries';
import type { ShopProduct } from '@/components/shop/shop-catalog';

export async function NewArrivals() {
  const [collections, catalog] = await Promise.all([getCatalogCollections(), getNewArrivalProducts()]);
  const collection = collections.find(item => item.collectionType === 'NEW_ARRIVALS');
  if (!collection || catalog.length === 0) return null;

  const products: ShopProduct[] = catalog.slice(0, 4).map(product => ({
    id: product.id, slug: product.slug, name: product.name,
    available: product.isAvailable, isNewArrival: product.isNewArrival,
    coverImage: product.coverImage, category: product.categoryName ?? '',
    images: product.images.map(image => ({ src: image.src, alt: image.alt })), pricing: product.pricing,
  }));

  return (
    <section className="new-arrivals-section" aria-labelledby="new-arrivals-title">
      <SiteContainer>
        <div className="section-title-row">
          <h2 id="new-arrivals-title" className="display-heading">New Arrivals</h2>
          <Link href={`/collections/${collection.slug}`} className="text-link">View all <ArrowRight aria-hidden="true" size={17} /></Link>
        </div>
        <div className="new-arrivals-grid">{products.map(product => <ProductCard key={product.id} product={product} />)}</div>
      </SiteContainer>
    </section>
  );
}

