import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CustomerPageShell } from '@/components/layout/customer-page-shell';
import { SiteContainer } from '@/components/layout/site-container';
import { getCatalogCollections } from '@/lib/catalog/queries';

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Shop Coolcase curated phone case collections.',
};

export default async function CollectionsPage() {
  const collections = await getCatalogCollections();

  return (
    <CustomerPageShell>
      <section className="customer-page collections-page">
        <SiteContainer>
          <header className="customer-page-heading">
            <p>Curated by Coolcase</p>
            <h1>SHOP BY COLLECTION</h1>
            <span>Find a group of cases shaped around one mood, moment, or point of view.</span>
          </header>

          {collections.length ? (
            <div className="collection-grid">
              {collections.map((collection, index) => {
                const image = collection.bannerImage ?? collection.representative?.coverImage ?? null;
                return (
                  <article key={collection.id} className={`collection-card${collection.isFeatured ? ' is-featured' : ''}`}>
                    <Link href={`/collections/${collection.slug}`}>
                      <div className={`collection-card-image${image ? '' : ' collection-card-placeholder'}`}>
                        {image ? (
                          <Image src={image} alt={collection.name} fill priority={index < 2} sizes={collection.isFeatured ? '(min-width: 1024px) 66vw, 100vw' : '(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw'} />
                        ) : <span aria-hidden="true">CC</span>}
                      </div>
                      <div>
                        <p>{collection.productCount} {collection.productCount === 1 ? 'case' : 'cases'}</p>
                        <h2>{collection.name}</h2>
                        {collection.description ? <span>{collection.description}</span> : null}
                        <b>View Collection <ArrowRight aria-hidden="true" /></b>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="customer-empty" role="status">
              <h2>CURATED DROPS ARE ON THE WAY</h2>
              <p>Browse all current cases while the next Coolcase collections are being prepared.</p>
              <Link href="/shop" className="cc-button cc-button-primary">Shop all cases</Link>
            </div>
          )}
        </SiteContainer>
      </section>
    </CustomerPageShell>
  );
}