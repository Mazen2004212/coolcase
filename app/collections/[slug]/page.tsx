import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CustomerPageShell } from '@/components/layout/customer-page-shell';
import { SiteContainer } from '@/components/layout/site-container';
import { ProductCard } from '@/components/product/product-card';
import { getCollectionProducts } from '@/lib/catalog/queries';
import type { ShopProduct } from '@/components/shop/shop-catalog';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { collection } = await getCollectionProducts((await params).slug);
  return { title: collection?.name ?? 'Collection not found', description: collection?.description ?? undefined };
}

export default async function CollectionDetailPage({ params }: Props) {
  const { collection, products } = await getCollectionProducts((await params).slug);
  if (!collection) notFound();

  const cards: ShopProduct[] = products.map(product => ({
    id: product.id, slug: product.slug, name: product.name,
    available: product.isAvailable, isNewArrival: product.isNewArrival,
    coverImage: product.coverImage, category: product.categoryName ?? '',
    images: product.images.map(image => ({ src: image.src, alt: image.alt })), pricing: product.pricing,
  }));

  return (
    <CustomerPageShell>
      <section className="customer-page collection-detail-page">
        <SiteContainer>
          <header className="collection-detail-heading">
            <div>
              <p>{collection.collectionType === 'NEW_ARRIVALS' ? 'The latest Coolcase drop' : 'A Coolcase collection'}</p>
              <h1>{collection.name}</h1>
              {collection.description ? <span>{collection.description}</span> : null}
            </div>
            <strong>{cards.length} {cards.length === 1 ? 'case' : 'cases'}</strong>
          </header>
          {collection.bannerImage ? <div className="collection-detail-banner"><Image src={collection.bannerImage} alt={`${collection.name} collection`} fill priority sizes="100vw" /></div> : null}
          {cards.length ? (
            <div className="product-grid collection-product-grid">
              {cards.map((product, index) => <ProductCard key={product.id} product={product} eager={index < 4} />)}
            </div>
          ) : (
            <div className="customer-empty" role="status"><h2>THIS COLLECTION IS READY FOR ITS FIRST CASE</h2><p>Check back soon, or explore the full Coolcase edit.</p></div>
          )}
        </SiteContainer>
      </section>
    </CustomerPageShell>
  );
}

