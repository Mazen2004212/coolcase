"use client";

import { useMemo, useState } from "react";
import { CustomCaseCard } from "@/components/home/custom-case-card";
import { ProductCard } from "@/components/product/product-card";
import type { Material, MaterialPrice } from "@/lib/data/product-options";

// Lean catalog shape — matches what the server passes from CatalogProduct
export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  available: boolean;
  isNewArrival: boolean;
  coverImage: string | null;
  category: string;
  images: Array<{ src: string; alt: string }>;
  pricing: Record<Material, MaterialPrice>;
};

type Availability = "all" | "available" | "sold-out";
type SortOrder = "a-z" | "z-a";
const DEFAULT_SORT: SortOrder = "a-z";

export function ShopCatalog({ products, collectionFilter = false }: { products: ShopProduct[]; collectionFilter?: boolean }) {
  const [availability, setAvailability] = useState<Availability>("all");
  const [sort, setSort] = useState<SortOrder>(DEFAULT_SORT);
  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => availability === "all" || product.available === (availability === "available"));
    return [...filtered].sort((left, right) => left.name.localeCompare(right.name) * (sort === "a-z" ? 1 : -1));
  }, [availability, products, sort]);

  return (
    <>
      <div className="shop-control-bar">
        <p><span>{visibleProducts.length}</span> {visibleProducts.length === 1 ? "case" : "cases"}</p>
        <div>
          <label>Availability
            <select value={availability} onChange={(event) => setAvailability(event.target.value as Availability)}>
              <option value="all">All</option><option value="available">Available</option><option value="sold-out">Sold Out</option>
            </select>
          </label>
          <label>Sort
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
              <option value="a-z">A → Z</option><option value="z-a">Z → A</option>
            </select>
          </label>
        </div>
      </div>
      {visibleProducts.length ? (
        <div className="shop-grid" aria-live="polite">
          {visibleProducts.map((product, index) => <ProductCard key={product.slug} product={product} eager={index < 3} />)}
          {availability !== "sold-out" && !collectionFilter ? <CustomCaseCard /> : null}
        </div>
      ) : (
        <div className="shop-empty" role="status"><h2>{availability === "sold-out" ? "No sold-out cases right now." : "No cases found."}</h2><p>{availability === "sold-out" ? "Every current Coolcase design is available to configure." : collectionFilter ? "Try another collection." : "Try another filter."}</p></div>
      )}
    </>
  );
}
