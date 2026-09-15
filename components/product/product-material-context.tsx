"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Material } from "@/lib/data/product-options";

type ProductMaterialContextValue = {
  material: Material;
  setMaterial: Dispatch<SetStateAction<Material>>;
};

const ProductMaterialContext = createContext<ProductMaterialContextValue | null>(null);

export function ProductMaterialProvider({ children }: { children: ReactNode }) {
  const [material, setMaterial] = useState<Material>("silicon");
  return <ProductMaterialContext value={{ material, setMaterial }}>{children}</ProductMaterialContext>;
}

export function useProductMaterial() {
  const context = useContext(ProductMaterialContext);
  if (!context) throw new Error("useProductMaterial must be used inside ProductMaterialProvider");
  return context;
}
