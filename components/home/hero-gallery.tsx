"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";

import { heroSlides, type HeroSlide } from "@/lib/data/homepage";

const AUTOPLAY_DELAY = 6000;
const SLIDE_DURATION = 420;

type SlideStyle = CSSProperties & {
  "--hero-desktop-position": string;
  "--hero-tablet-position": string;
  "--hero-mobile-position": string;
};

type DragStart = { pointerId: number; x: number; width: number };

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
      data-slide={slide.id}
      style={style}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${heroSlides.length}`}
      aria-hidden={!isActive}
      data-active={isActive ? "true" : "false"}
      inert={!isActive}
    >
      <Image
        src={slide.imagePath}
        alt={slide.imageAlt}
        fill
        draggable={false}
        unoptimized={slide.id === "cases"}
        priority={index === 0}
        loading={index === 0 ? "eager" : "lazy"}
        fetchPriority={index === 0 ? "high" : "auto"}
        sizes="100vw"
      />
      <Link
        href="/shop"
        prefetch={false}
        className={`hero-shop-link hero-shop-link-${slide.ctaPlacement} hero-shop-link-${slide.ctaTone}`}
        tabIndex={isActive ? 0 : -1}
      >
        {slide.ctaLabel ?? "Shop Now"}
      </Link>
    </article>
  );
}

export function HeroGallery() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [autoplayEpoch, setAutoplayEpoch] = useState(0);
  const dragStart = useRef<DragStart | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const moved = useRef(false);
  const settleDirection = useRef<1 | -1 | 0>(0);
  const slideCount = heroSlides.length;
  const previousIndex = (activeIndex - 1 + slideCount) % slideCount;
  const nextIndex = (activeIndex + 1) % slideCount;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || slideCount < 2 || isDragging || isSettling) return;
    const timer = window.setTimeout(() => {
      settleDirection.current = 1;
      setOffset(-(stageRef.current?.clientWidth ?? window.innerWidth));
      setIsSettling(true);
    }, AUTOPLAY_DELAY);
    return () => window.clearTimeout(timer);
  }, [activeIndex, autoplayEpoch, isDragging, isSettling, prefersReducedMotion, slideCount]);

  useEffect(() => {
    if (!isSettling) return;
    // Fallback for an interrupted transition; normal completion uses transitionend.
    const fallback = window.setTimeout(() => {
      const direction = settleDirection.current;
      if (direction) setActiveIndex((current) => (current + direction + slideCount) % slideCount);
      settleDirection.current = 0;
      setOffset(0);
      setIsSettling(false);
      setAutoplayEpoch((current) => current + 1);
    }, SLIDE_DURATION + 80);
    return () => window.clearTimeout(fallback);
  }, [isSettling, slideCount]);

  function finishSettle() {
    if (!isSettling) return;
    const direction = settleDirection.current;
    if (direction) setActiveIndex((current) => (current + direction + slideCount) % slideCount);
    settleDirection.current = 0;
    setOffset(0);
    setIsSettling(false);
    setAutoplayEpoch((current) => current + 1);
  }

  function settle(direction: 1 | -1 | 0, width: number) {
    if (prefersReducedMotion) {
      if (direction) setActiveIndex((current) => (current + direction + slideCount) % slideCount);
      setOffset(0);
      setIsDragging(false);
      setAutoplayEpoch((current) => current + 1);
      return;
    }
    settleDirection.current = direction;
    setIsDragging(false);
    setIsSettling(true);
    setOffset(direction === 0 ? 0 : -direction * width);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (slideCount < 2 || isSettling || !event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as Element).closest(".hero-shop-link")) return;
    const width = event.currentTarget.clientWidth;
    dragStart.current = { pointerId: event.pointerId, x: event.clientX, width };
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const distance = event.clientX - start.x;
    if (Math.abs(distance) > 5) moved.current = true;
    if (!prefersReducedMotion) setOffset(Math.max(-start.width, Math.min(start.width, distance)));
  }

  function endPointer(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const distance = event.type === "pointercancel" ? 0 : event.clientX - start.x;
    const threshold = Math.min(80, Math.max(50, start.width * 0.08));
    settle(Math.abs(distance) >= threshold ? (distance < 0 ? 1 : -1) : 0, start.width);
    window.setTimeout(() => { moved.current = false; }, 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    if (isDragging || isSettling) return;
    settle(event.key === "ArrowRight" ? 1 : -1, event.currentTarget.clientWidth);
  }

  const trackStyle = {
    transform: `translate3d(calc(-33.333333% + ${offset}px), 0, 0)`,
  };

  return (
    <div
      className="hero-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Automatic Coolcase campaign slideshow"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClickCapture={(event) => {
        if (moved.current && event.detail !== 0) event.preventDefault();
        moved.current = false;
      }}
    >
      <div
        ref={stageRef}
        className="hero-stage"
        data-dragging={isDragging ? "true" : "false"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          className="hero-track"
          data-settling={isSettling ? "true" : "false"}
          style={trackStyle}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === "transform") finishSettle();
          }}
        >
          <CampaignSlide slide={heroSlides[previousIndex]} index={previousIndex} isActive={false} />
          <CampaignSlide slide={heroSlides[activeIndex]} index={activeIndex} isActive />
          <CampaignSlide slide={heroSlides[nextIndex]} index={nextIndex} isActive={false} />
        </div>
      </div>
    </div>
  );
}
