"use client";

import Image from "next/image";
import { useState } from "react";
import { useProductMaterial } from "@/components/product/product-material-context";
import { materialOptions } from "@/lib/data/product-options";
// Gallery image shape — decoupled from old StorefrontProduct
export type GalleryImage = { src: string; alt: string; label: string; view: "full" | "detail" | "guide" };

export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const { material } = useProductMaterial();
  const [active, setActive] = useState(0);
  const guide = materialOptions[material].galleryGuide;
  const galleryImages: GalleryImage[] = guide ? [...images, guide] : images;

  // Guard: if no images yet, show a placeholder so the PDP doesn't crash
  if (galleryImages.length === 0) {
    return (
      <div className="pdp-gallery">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 12, aspectRatio: '3/4', color: '#9ca3af', fontSize: '0.875rem' }}>
          No images yet
        </div>
      </div>
    );
  }

  const activeIndex = Math.min(active, galleryImages.length - 1);
  const selected = galleryImages[activeIndex];

  return (
    <div className="pdp-gallery">
      <div className="pdp-thumbnails" aria-label={`${name} image views`}>
        {galleryImages.map((image, index) => (
          <button type="button" key={`${image.src}-${index}`} aria-label={`Show ${image.label.toLowerCase()}`} aria-pressed={activeIndex === index} onClick={() => setActive(index)}>
            <Image src={image.src} alt="" fill loading="eager" sizes="72px" className={image.view === "detail" ? "pdp-thumbnail-detail" : ""} />
            <span>{index + 1}</span>
          </button>
        ))}
      </div>
      <figure>
        <div className="pdp-main-image" data-view={selected.view}>
          <Image src={selected.src} alt={selected.alt} fill loading="eager" sizes="(min-width: 1024px) 49vw, (min-width: 640px) 85vw, 100vw" />
          <span className="pdp-image-label">{selected.label}</span>
        </div>
        <figcaption>Design shown on a sample phone. Camera cutouts vary by model.</figcaption>
      </figure>
    </div>
  );
}

