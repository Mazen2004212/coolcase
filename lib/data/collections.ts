import { products } from "@/lib/data/products";

const descriptions: Record<string, string> = {
  Graphic: "Bold shapes and high-contrast artwork for a clean statement look.",
  Lace: "Soft detail with a darker, expressive edge.",
  Floral: "Flower-led designs ranging from soft to moody.",
  Typography: "Cases built around words, lettering, and personality.",
  Collage: "Layered graphics with an eclectic, scrapbook-inspired feel.",
};

export const collections = Array.from(new Set(products.map((product) => product.category))).map((name) => ({
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  description: descriptions[name] ?? `Explore Coolcase ${name.toLowerCase()} designs.`,
  representative: products.find((product) => product.category === name)!,
}));

export function getCollectionProducts(slug: string) {
  const collection = collections.find((item) => item.slug === slug.toLowerCase());
  return { collection, products: collection ? products.filter((product) => product.category === collection.name) : [] };
}
