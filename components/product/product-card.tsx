import Image from "next/image";
import Link from "next/link";

import type { PresentationProduct } from "@/lib/data/homepage";
import { cn } from "@/lib/utils/cn";

type ProductMediaProps = Pick<
  PresentationProduct,
  "imageAlt" | "imagePath" | "imageTransparent"
>;

function ProductMedia({
  imageAlt,
  imagePath,
  imageTransparent = false,
}: ProductMediaProps) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden border-b border-border bg-[var(--product-media-background)]">
      <Image
        src={imagePath}
        alt={imageAlt}
        fill
        sizes="(min-width: 1280px) 16vw, (min-width: 768px) 33vw, 50vw"
        className={cn(
          "object-contain p-4 transition-transform duration-500 group-hover:scale-[1.02] sm:p-5",
          !imageTransparent && "mix-blend-multiply",
        )}
      />
    </div>
  );
}

type ProductCardProps = {
  product: PresentationProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="h-full min-w-0 overflow-hidden rounded-[var(--card-radius)] border border-border bg-white">
      <Link
        href="/shop"
        prefetch={false}
        className="group flex h-full flex-col rounded-[var(--card-radius)] focus-visible:outline-offset-[-2px]"
        aria-label={`View ${product.name} case`}
      >
        <ProductMedia
          imageAlt={product.imageAlt}
          imagePath={product.imagePath}
          imageTransparent={product.imageTransparent}
        />
        <div className="grid min-h-[6.75rem] flex-1 grid-rows-[2.5rem_auto] px-3.5 py-3.5 sm:px-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 tracking-[-0.015em] sm:text-[0.9375rem]">
            {product.name}
          </h3>
          <p className="mt-2 self-start text-xs text-muted-foreground sm:text-[0.8125rem]">
            From 150 EGP
          </p>
        </div>
      </Link>
    </article>
  );
}
