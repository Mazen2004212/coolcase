"use client";

import { useMemo, useState } from "react";
import { CustomCaseCard } from "@/components/home/custom-case-card";
import { ProductCard } from "@/components/product/product-card";
import type { StorefrontProduct } from "@/lib/data/products";

type Availability = "all" | "available" | "sold-out";
type SortOrder = "a-z" | "z-a";
const DEFAULT_SORT: SortOrder = "a-z";

export function ShopCatalog({ products }: { products: StorefrontProduct[] }) {
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
          {visibleProducts.map((product) => <ProductCard key={product.slug} product={product} />)}
          {availability !== "sold-out" ? <CustomCaseCard /> : null}
        </div>
      ) : (
        <div className="shop-empty" role="status"><h2>No sold-out cases right now.</h2><p>Every current Coolcase design is available to configure.</p></div>
      )}
    </>
  );
}
