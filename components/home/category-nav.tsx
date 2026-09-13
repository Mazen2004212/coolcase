"use client";

import {
  Grid2X2,
  Headphones,
  Magnet,
  PencilLine,
  Shield,
  Smartphone,
  Square,
} from "lucide-react";
import { useState } from "react";

import { SiteContainer } from "@/components/layout/site-container";
import { categories, type CategoryItem } from "@/lib/data/homepage";
import { cn } from "@/lib/utils/cn";

const categoryIcons = {
  all: Grid2X2,
  iphone: Smartphone,
  samsung: Smartphone,
  custom: PencilLine,
  clear: Square,
  tough: Shield,
  magsafe: Magnet,
  accessories: Headphones,
} satisfies Record<CategoryItem["icon"], typeof Grid2X2>;

export function CategoryNav() {
  const [activeCategory, setActiveCategory] = useState("All Cases");

  return (
    <section className="border-b border-border bg-surface-white py-7 sm:py-9">
      <SiteContainer className="px-0 sm:px-8 lg:px-12">
        <h2 className="sr-only">Browse by category</h2>
        <div className="category-scroll flex gap-2 overflow-x-auto px-5 pb-2 sm:grid sm:grid-cols-4 sm:gap-x-4 sm:gap-y-7 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-8">
          {categories.map((category) => {
            const Icon = categoryIcons[category.icon];
            const isActive = activeCategory === category.label;

            return (
              <button
                key={category.label}
                type="button"
                className="group flex w-[5.25rem] shrink-0 snap-start flex-col items-center gap-2.5 sm:w-auto sm:min-w-0"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category.label)}
              >
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-full border text-foreground transition-colors sm:size-[4.5rem]",
                    isActive
                      ? "border-black bg-black text-white"
                      : "border-transparent bg-muted group-hover:border-black",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className="size-5 sm:size-6"
                    strokeWidth={1.6}
                  />
                </span>
                <span className="text-center text-[0.6875rem] font-medium leading-4 sm:text-xs">
                  {category.label}
                </span>
              </button>
            );
          })}
        </div>
      </SiteContainer>
    </section>
  );
}
