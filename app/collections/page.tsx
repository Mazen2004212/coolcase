import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CustomerPageShell } from "@/components/layout/customer-page-shell";
import { SiteContainer } from "@/components/layout/site-container";
import { getCatalogCollections } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "Collections", description: "Browse Coolcase designs by style." };

export default async function CollectionsPage() {
  const collections = await getCatalogCollections();

  return (
    <CustomerPageShell>
      <section className="customer-page">
        <SiteContainer>
          <header className="customer-page-heading"><p>Find your style</p><h1>COLLECTIONS</h1><span>Five ways to make your phone feel more like you.</span></header>
          <div className="collection-grid">
            {collections.map((collection, index) => (
              <article key={collection.slug} className="collection-card">
                <Link href={`/shop?collection=${collection.slug}`}>
                  <div className="collection-card-image">
                    <Image
                      src={collection.representative.coverImage ?? collection.representative.images[0]?.src ?? ''}
                      alt={collection.representative.images[0]?.alt ?? collection.representative.name}
                      fill
                      loading={index < 3 ? "eager" : "lazy"}
                      sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </div>
                  <div>
                    <p>{collection.representative.name}</p>
                    <h2>{collection.name}</h2>
                    <span>{collection.description}</span>
                    <b>Shop Collection <ArrowRight aria-hidden="true" /></b>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </SiteContainer>
      </section>
    </CustomerPageShell>
  );
}
