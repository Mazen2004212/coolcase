import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { startingPriceLabel, type PresentationProduct } from "@/lib/data/homepage";

export function ProductCard({ product }: { product: PresentationProduct }) {
  return (
    <article className="product-card" data-merchandising-tile="product">
      <Link href="/shop" prefetch={false} className="group block" aria-label={`View ${product.name} case`}>
        <div className="product-media">
          <Image
            src={product.imagePath}
            alt={product.imageAlt}
            fill
            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 50vw"
            className="object-contain transition-transform duration-500 group-hover:scale-[1.025]"
          />
          <span className="product-link-icon"><ArrowUpRight size={18} aria-hidden="true" /></span>
        </div>
        <div className="product-details"><h3>{product.name}</h3><p>{startingPriceLabel}</p></div>
      </Link>
    </article>
  );
}
