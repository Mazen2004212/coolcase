import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { PriceDisplay } from "@/components/ui/price-display";
import type { ShopProduct } from "@/components/shop/shop-catalog";

export function ProductCard({ product, eager = false }: { product: ShopProduct; eager?: boolean }) {
  const src = product.coverImage ?? product.images[0]?.src ?? '';
  const alt = product.images[0]?.alt ?? product.name;
  return (
    <article className="product-card" data-merchandising-tile="product">
      <Link href={`/products/${product.slug}`} prefetch={false} className="group block" aria-label={`View ${product.name} case`}>
        <div className="product-media">
          {product.isNewArrival ? <span className="product-new-ribbon">NEW</span> : null}
          <Image
            src={src}
            alt={alt}
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 50vw"
            className="object-contain transition-transform duration-500 group-hover:scale-[1.025]"
          />
          {!product.available ? <span className="product-sold-out">Sold Out</span> : null}
        </div>
        <div className="product-details">
          <div className="product-meta">
            <h3>{product.name}</h3>
            <PriceDisplay from current={product.pricing.silicon.discounted} original={product.pricing.silicon.original}/>
          </div>
          <span className="product-link-icon" aria-hidden="true">
            <ShoppingBag size={18} strokeWidth={1.8} />
          </span>
        </div>
      </Link>
    </article>
  );
}
