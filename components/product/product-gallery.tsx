"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/data/products";

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const selected = images[active];
  return (
    <div className="pdp-gallery">
      <div className="pdp-thumbnails" aria-label={`${name} image views`}>
        {images.map((image, index) => (
          <button type="button" key={`${image.src}-${index}`} aria-label={`Show ${image.label.toLowerCase()}`} aria-pressed={active === index} onClick={() => setActive(index)}>
            <Image src={image.src} alt="" fill sizes="72px" className={image.view === "detail" ? "pdp-thumbnail-detail" : ""} />
            <span>{index + 1}</span>
          </button>
        ))}
      </div>
      <figure>
        <div className="pdp-main-image" data-view={selected.view}>
          <Image src={selected.src} alt={selected.alt} fill priority sizes="(min-width: 1024px) 49vw, (min-width: 640px) 85vw, 100vw" />
          <span className="pdp-image-label">{selected.label}</span>
        </div>
        <figcaption>Design shown on a sample phone. Camera cutouts vary by model.</figcaption>
      </figure>
    </div>
  );
}
