export type SiteNavItem = Readonly<{ href: string; label: string }>;

export type HeroSlide = Readonly<{
  id: "women" | "men" | "cases";
  imageAlt: string;
  imagePath: string;
  desktopPosition: string;
  tabletPosition: string;
  mobilePosition: string;
  ctaPlacement: "center" | "top";
  ctaTone: "dark" | "light";
}>;

// Homepage presentation only. Product prices are not authoritative.
export type PresentationProduct = Readonly<{
  imageAlt: string;
  imagePath: string;
  name: string;
}>;

export const startingPriceLabel = "From 150 EGP";

export const siteNavigation = [
  { href: "/shop", label: "Shop" },
  { href: "/shop", label: "Collections" },
  { href: "/custom-cases", label: "Custom Cases" },
  { href: "/about", label: "About" },
] as const satisfies readonly SiteNavItem[];

export const heroSlides = [
  {
    id: "women",
    imagePath: "/assets/hero/hero-women.png",
    imageAlt:
      "Coolcase campaign with fashion phone cases and a woman holding a leopard case",
    desktopPosition: "50% 50%",
    tabletPosition: "54% 50%",
    mobilePosition: "61% center",
    ctaPlacement: "center",
    ctaTone: "light",
  },
  {
    id: "men",
    imagePath: "/assets/hero/hero-men.png",
    imageAlt:
      "Coolcase campaign with a man holding a star case beside statement case designs",
    desktopPosition: "50% 50%",
    tabletPosition: "50% 50%",
    mobilePosition: "57% center",
    ctaPlacement: "center",
    ctaTone: "light",
  },
  {
    id: "cases",
    imagePath: "/assets/hero/hero-cases.png",
    imageAlt: "Three Coolcase designs styled on stone with metallic accessories",
    desktopPosition: "50% 50%",
    tabletPosition: "50% 50%",
    mobilePosition: "50% center",
    ctaPlacement: "top",
    ctaTone: "dark",
  },
] as const satisfies readonly HeroSlide[];

export const featuredProducts = [
  {
    name: "Abstract Halftone",
    imagePath: "/assets/products/Abstract halftone.png",
    imageAlt: "Abstract monochrome halftone phone case design",
  },
  {
    name: "Pink Lace",
    imagePath: "/assets/products/Black and pink lace iPhone case.png",
    imageAlt: "Black phone case with a pink lace design",
  },
  {
    name: "Black Lily",
    imagePath: "/assets/products/Black Floral iPhone Case Mockup.png",
    imageAlt: "Black phone case with a dramatic floral lily design",
  },
  {
    name: "Amor",
    imagePath: "/assets/products/amor.png",
    imageAlt: "Amor phone case design",
  },
  {
    name: "Blue Collage",
    imagePath: "/assets/products/Blue-silver leopard.png",
    imageAlt: "Blue and silver leopard collage phone case design",
  },
] as const satisfies readonly PresentationProduct[];

export const footerGroups = [
  {
    label: "Shop",
    links: [
      { href: "/shop", label: "All Cases" },
      { href: "/shop", label: "Collections" },
      { href: "/custom-cases", label: "Custom Cases" },
    ],
  },
  {
    label: "Help",
    links: [
      { href: "/track-order", label: "Track Order" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    label: "About",
    links: [{ href: "/about", label: "About Coolcase" }],
  },
  {
    label: "Account",
    links: [
      { href: "/login", label: "Login" },
      { href: "/account/orders", label: "My Orders" },
    ],
  },
] as const;
