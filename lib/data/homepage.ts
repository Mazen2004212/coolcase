export type SiteNavItem = Readonly<{
  href: string;
  label: string;
}>;

export type CategoryItem = Readonly<{
  icon:
    | "all"
    | "iphone"
    | "samsung"
    | "custom"
    | "clear"
    | "tough"
    | "magsafe"
    | "accessories";
  label: string;
}>;

export type PresentationProduct = Readonly<{
  imageAlt: string;
  imagePath: string;
  imageTransparent?: boolean;
  name: string;
}>;

export const siteNavigation = [
  { href: "#top", label: "Home" },
  { href: "#featured", label: "Shop" },
  { href: "#featured", label: "iPhone Cases" },
  { href: "#custom-cases", label: "Custom Cases" },
  { href: "#footer", label: "About" },
  { href: "#footer", label: "Contact" },
] as const satisfies readonly SiteNavItem[];

export const categories = [
  { icon: "all", label: "All Cases" },
  { icon: "iphone", label: "iPhone Cases" },
  { icon: "samsung", label: "Samsung Cases" },
  { icon: "custom", label: "Custom Cases" },
  { icon: "clear", label: "Clear Cases" },
  { icon: "tough", label: "Tough Cases" },
  { icon: "magsafe", label: "MagSafe" },
  { icon: "accessories", label: "Accessories" },
] as const satisfies readonly CategoryItem[];

export const featuredProducts = [
  {
    imageAlt: "Beige phone case with a pink flower and leopard pattern",
    imagePath: "/assets/products/beige flowers.png",
    imageTransparent: false,
    name: "beige flowers",
  },
  {
    imageAlt: "Pink Billie Eilish portrait phone case",
    imagePath: "/assets/products/Billie eilish.png",
    imageTransparent: false,
    name: "Billie eilish",
  },
  {
    imageAlt: "Black and pink lace iPhone case",
    imagePath: "/assets/products/Black and pink lace iPhone case.png",
    imageTransparent: false,
    name: "Black and pink lace iPhone case",
  },
  {
    imageAlt: "Black phone case with pink floral design",
    imagePath: "/assets/products/Black Floral iPhone Case Mockup.png",
    imageTransparent: false,
    name: "Black Floral iPhone Case Mockup",
  },
  {
    imageAlt: "Clear phone case with black flower illustrations",
    imagePath: "/assets/products/black flowers.png",
    imageTransparent: false,
    name: "black flowers",
  },
  {
    imageAlt: "Clear phone case with blue stars and silver leopard motifs",
    imagePath: "/assets/products/Blue-silver leopard.png",
    imageTransparent: false,
    name: "Blue-silver leopard",
  },
] as const satisfies readonly PresentationProduct[];

export const footerGroups = [
  {
    label: "Shop",
    links: [
      { href: "#featured", label: "All Cases" },
      { href: "#featured", label: "iPhone Cases" },
      { href: "#custom-cases", label: "Custom Cases" },
    ],
  },
  {
    label: "Help",
    links: [
      { href: "/track-order", label: "Track Order" },
      { href: "#footer", label: "Contact" },
      { href: "#footer", label: "About" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "#footer", label: "About" },
      { href: "#footer", label: "Contact" },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/login", label: "Login" },
      { href: "/account/orders", label: "My Orders" },
    ],
  },
] as const;
