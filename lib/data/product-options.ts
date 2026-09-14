// Local storefront configuration. Checkout must later validate compatibility and
// calculate authoritative prices on the server, independently of this data.
export const phoneModels = {
  iPhone: ["iPhone X", "iPhone XS", "iPhone XS Max", "iPhone XR", "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max", "iPhone 12", "iPhone 12 Mini", "iPhone 12 Pro", "iPhone 12 Pro Max", "iPhone 13", "iPhone 13 Mini", "iPhone 13 Pro", "iPhone 13 Pro Max", "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max", "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max", "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max"],
  Samsung: ["Samsung Galaxy S21", "Samsung Galaxy S21 Plus", "Samsung Galaxy S21 Ultra", "Samsung Galaxy S22", "Samsung Galaxy S22 Plus", "Samsung Galaxy S22 Ultra", "Samsung Galaxy S23", "Samsung Galaxy S23 Plus", "Samsung Galaxy S23 Ultra", "Samsung Galaxy S24", "Samsung Galaxy S24 Plus", "Samsung Galaxy S24 Ultra", "Samsung Galaxy A34", "Samsung Galaxy A54", "Samsung Galaxy A55"],
  Xiaomi: ["Xiaomi 12", "Xiaomi 12 Pro", "Xiaomi 13", "Xiaomi 13 Pro", "Xiaomi 13T", "Xiaomi 13T Pro", "Xiaomi 14", "Xiaomi 14 Pro"],
  Redmi: ["Redmi Note 11", "Redmi Note 11 Pro", "Redmi Note 12", "Redmi Note 12 Pro", "Redmi Note 13", "Redmi Note 13 Pro", "Redmi Note 13 Pro Plus"],
  Oppo: ["Oppo Reno 8", "Oppo Reno 8 Pro", "Oppo Reno 10", "Oppo Reno 10 Pro", "Oppo Reno 11", "Oppo Reno 11 Pro", "Oppo A78", "Oppo A98"],
} as const;

export type PhoneBrand = keyof typeof phoneModels;
export const phoneBrands = Object.keys(phoneModels) as PhoneBrand[];
export const materialIds = ["silicon", "acrylic", "double-layer"] as const;
export type Material = (typeof materialIds)[number];
export type MaterialPrice = { original: number; discounted: number };
export const materialOptions: Record<Material, { label: string; note: string }> = {
  silicon: { label: "Silicon", note: "Flexible and lightweight. A practical everyday option with a comfortable grip and good protection." },
  acrylic: { label: "Acrylic", note: "More rigid with a premium finish and sharper print presentation. Best for customers who want a refined look and stronger protection." },
  "double-layer": { label: "Double Layer", note: "Extra protection with a dual-layer build. Best for stronger durability and heavier everyday use." },
};
export const defaultMaterialPricing: Record<Material, MaterialPrice> = {
  silicon: { original: 230, discounted: 180 },
  acrylic: { original: 299, discounted: 225 },
  "double-layer": { original: 460, discounted: 399 },
};
export const customCasePricing: MaterialPrice = { original: 289, discounted: 239 };
export const formatPrice = (amount: number) => `${amount.toLocaleString("en-EG")} EGP`;
