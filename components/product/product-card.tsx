import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatPrice } from "@/lib/data/product-options";
import type { StorefrontProduct } from "@/lib/data/products";

export function ProductCard({ product, eager = false }: { product: StorefrontProduct; eager?: boolean }) {
  return (
    <article className="product-card" data-merchandising-tile="product">
      <Link href={`/products/${product.slug}`} prefetch={false} className="group block" aria-label={`View ${product.name} case`}>
        <div className="product-media">
          <Image
            src={product.images[0].src}
            alt={product.images[0].alt}
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 50vw"
            className="object-contain transition-transform duration-500 group-hover:scale-[1.025]"
          />
          {!product.available ? <span className="product-sold-out">Sold Out</span> : null}
          <span className="product-link-icon"><ArrowUpRight size={18} aria-hidden="true" /></span>
        </div>
        <div className="product-details"><h3>{product.name}</h3><p>From {formatPrice(product.pricing.silicon.discounted)}</p></div>
      </Link>
    </article>
  );
}
