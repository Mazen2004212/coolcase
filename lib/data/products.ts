import { defaultMaterialPricing, phoneBrands, type Material, type MaterialPrice, type PhoneBrand } from "@/lib/data/product-options";

export type ProductImage = { src: string; alt: string; label: string; view: "full" | "detail" };
export type StorefrontProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  images: ProductImage[];
  pricing: Record<Material, MaterialPrice>;
  supportedBrands: PhoneBrand[];
  relatedSlugs: string[];
};

const designs = [
  { slug: "abstract-halftone", name: "Abstract Halftone", file: "Abstract halftone.png", category: "Graphic", description: "A bold monochrome design with fluid graphic movement. Made for a clean statement look that still feels easy to style every day." },
  { slug: "pink-lace", name: "Pink Lace", file: "Black and pink lace iPhone case.png", category: "Lace", description: "Dark lace-inspired detailing with a soft pink contrast. A feminine statement case with a slightly dramatic edge." },
  { slug: "black-lily", name: "Black Lily", file: "Black Floral iPhone Case Mockup.png", category: "Floral", description: "A deep black case centered around a soft pink floral design. Clean, moody, and easy to pair with almost anything." },
  { slug: "amor", name: "Amor", file: "amor.png", category: "Typography", description: "A playful pink statement design with bold typography. Bright, expressive, and made for a more colorful everyday look." },
  { slug: "blue-collage", name: "Blue Collage", file: "Blue-silver leopard.png", category: "Collage", description: "A mixed graphic collage with blue accents and decorative details. A fun choice for an eclectic, scrapbook-inspired style." },
];

// Mock catalog using existing artwork. The detail view is a crop of the same
// photograph, not a fabricated second product angle or material rendering.
export const products: StorefrontProduct[] = designs.map((design) => ({
  id: `local-${design.slug}`,
  slug: design.slug,
  name: design.name,
  description: design.description,
  category: design.category,
  // This maps directly to the future products availability column in Supabase.
  // All current catalog designs are available; no stock quantities are invented.
  available: true,
  images: [
    { src: `/assets/products/${design.file}`, alt: `${design.name} phone case — full design`, label: "Full design", view: "full" },
    { src: `/assets/products/${design.file}`, alt: `${design.name} phone case — enlarged design detail`, label: "Design detail", view: "detail" },
  ],
  pricing: defaultMaterialPricing,
  supportedBrands: [...phoneBrands],
  relatedSlugs: designs.filter((other) => other.slug !== design.slug).map((other) => other.slug),
}));

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getRelatedProducts(product: StorefrontProduct) {
  return product.relatedSlugs.flatMap((slug) => {
    const related = getProductBySlug(slug);
    return related ? [related] : [];
  });
}
