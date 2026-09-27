"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { heroSlides, type HeroSlide } from "@/lib/data/homepage";

const AUTOPLAY_DELAY = 6000;
const HERO_ASSET_VERSION = "20260927-hero-cases";

type SlideStyle = CSSProperties & {
  "--hero-desktop-position": string;
  "--hero-tablet-position": string;
  "--hero-mobile-position": string;
};

function CampaignSlide({
  slide,
  index,
  isActive,
}: {
  slide: HeroSlide;
  index: number;
  isActive: boolean;
}) {
  const style: SlideStyle = {
    "--hero-desktop-position": slide.desktopPosition,
    "--hero-tablet-position": slide.tabletPosition,
    "--hero-mobile-position": slide.mobilePosition,
  };

  return (
    <article
      className="hero-campaign-slide"
      style={style}
      aria-roledescription="slide"
      aria-label={String(index + 1) + " of " + String(heroSlides.length)}
      aria-hidden={!isActive}
      data-active={isActive ? "true" : "false"}
    >
      <Image
        src={slide.imagePath + "?v=" + HERO_ASSET_VERSION}
        alt={slide.imageAlt}
        fill
        priority={index === 0}
        loading={index === 0 ? "eager" : "lazy"}
        fetchPriority={index === 0 ? "high" : "auto"}
        sizes="100vw"
      />
      <Link
        href="/shop"
        prefetch={false}
        className={
          "hero-shop-link hero-shop-link-" +
          slide.ctaPlacement +
          " hero-shop-link-" +
          slide.ctaTone
        }
        tabIndex={isActive ? 0 : -1}
      >
        {slide.ctaLabel ?? "Shop Now"}
      </Link>
    </article>
  );
}

export function HeroGallery() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setPrefersReducedMotion(query.matches);
      if (query.matches) setActiveIndex(0);
    };

    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || heroSlides.length < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroSlides.length);
    }, AUTOPLAY_DELAY);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  return (
    <div
      className="hero-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Automatic Coolcase campaign slideshow"
    >
      <div className="hero-stage">
        {heroSlides.map((slide, index) => (
          <CampaignSlide
            key={slide.id}
            slide={slide}
            index={index}
            isActive={index === activeIndex}
          />
        ))}
      </div>
    </div>
  );
}
