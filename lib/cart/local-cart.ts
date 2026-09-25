import { z } from "zod";
import { customCasePricing, materialIds, phoneModels, type Material, type PhoneBrand } from "@/lib/data/product-options";
import { FIXED_NAMED_CASE_IMAGE, namedCaseColorValues } from "@/lib/custom-cases/templates";

export const LOCAL_CART_KEY = "coolcase.cart.v1";
export const LOCAL_CART_CHANGE_EVENT = "coolcase:cart-change";

export const LOCAL_BUY_NOW_KEY = "coolcase.buynow.v1";
export const LOCAL_BUY_NOW_CHANGE_EVENT = "coolcase:buynow-change";

const commonFields = {
  productId: z.string().min(1), slug: z.string().min(1), productName: z.string().min(1),
  phoneBrand: z.enum(["iPhone", "Samsung", "Xiaomi", "Redmi", "Oppo"]),
  phoneModel: z.string().min(1), networkType: z.enum(["4G", "5G"]),
  quantity: z.number().int().min(1).max(99), discountedUnitPrice: z.number().int().positive(),
  originalUnitPrice: z.number().int().positive(), subtotal: z.number().int().positive(),
};

const productItemSchema = z.object({
  kind: z.literal("product").default("product"), ...commonFields,
  material: z.enum(materialIds), image: z.string().refine(
    (value) => value.startsWith("/assets/") || /^https?:\/\//.test(value),
    "Invalid product image."
  ),
}).refine((item) => (phoneModels[item.phoneBrand as PhoneBrand] as readonly string[]).includes(item.phoneModel), "Choose a supported phone model.")
  .refine((item) => item.material !== "acrylic" || item.phoneBrand === "iPhone", "Acrylic requires an iPhone.")
  .refine((item) => item.subtotal === item.quantity * item.discountedUnitPrice, "Invalid subtotal.");

const customBase = {
  kind: z.literal("custom"), ...commonFields,
  material: z.enum(materialIds).default("silicon"),
};

const uploadCustomItemSchema = z.object({
  ...customBase,
  customizationType: z.literal("UPLOAD_DESIGN").default("UPLOAD_DESIGN"),
  image: z.string().startsWith("data:image/").max(4_000_000), uploadFileName: z.string().min(1).max(180),
}).refine((item) => (phoneModels[item.phoneBrand as PhoneBrand] as readonly string[]).includes(item.phoneModel), "Choose a supported phone model.")
  .refine((item) => item.material !== "acrylic" || item.phoneBrand === "iPhone", "Acrylic requires an iPhone.")
  .refine((item) => {
    const price = customCasePricing[item.material];
    return item.discountedUnitPrice === price.discounted && item.originalUnitPrice === price.original;
  }, "Invalid custom-case price.")
  .refine((item) => item.subtotal === item.quantity * item.discountedUnitPrice, "Invalid subtotal.");

const namedCustomItemSchema = z.object({
  ...customBase,
  customizationType: z.literal("NAMED_TEMPLATE"),
  templateId: z.string().uuid(),
  templateName: z.string().min(1).max(120),
  templateImage: z.string().refine(
    value => value.startsWith("/assets/") || /^https?:\/\//.test(value),
    "Invalid named-case image.",
  ),
  englishName: z.string().min(1).max(7), arabicName: z.string().min(1).max(7),
  englishColor: z.enum(namedCaseColorValues), arabicColor: z.enum(namedCaseColorValues),
  englishRenderedText: z.string().min(1).max(40), arabicRenderedText: z.string().min(1).max(40),
  englishLayout: z.literal("STACKED"),
  englishStyle: z.object({
    fontKey: z.enum(["INTER", "GEORGIA", "ARIAL", "TAHOMA"]),
    fontSize: z.number().min(10).max(96),
    fontWeight: z.number().int().min(300).max(900),
    textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    textX: z.number().min(0).max(100), textY: z.number().min(0).max(100),
    textRotation: z.number().min(-45).max(45),
    textAlign: z.enum(["left", "center", "right"]),
  }),
  arabicStyle: z.object({
    fontKey: z.enum(["ARIAL", "TAHOMA"]), fontSize: z.number().min(10).max(96),
    fontWeight: z.number().int().min(300).max(900), textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    textX: z.number().min(0).max(100), textY: z.number().min(0).max(100), textRotation: z.number().min(-45).max(45),
    textAlign: z.enum(["left", "center", "right"]),
  }),
}).refine((item) => (phoneModels[item.phoneBrand as PhoneBrand] as readonly string[]).includes(item.phoneModel), "Choose a supported phone model.")
  .refine((item) => item.material !== "acrylic" || item.phoneBrand === "iPhone", "Acrylic requires an iPhone.")
  .refine((item) => {
    const price = customCasePricing[item.material];
    return item.discountedUnitPrice === price.discounted && item.originalUnitPrice === price.original;
  }, "Invalid custom-case price.")
  .refine((item) => item.subtotal === item.quantity * item.discountedUnitPrice, "Invalid subtotal.");

const itemSchema = z.union([productItemSchema, uploadCustomItemSchema, namedCustomItemSchema]);
const cartSchema = z.object({ version: z.literal(1), items: z.array(itemSchema).max(200) });
export type LocalCartItem = z.input<typeof itemSchema>;
export type StoredCartItem = z.output<typeof itemSchema>;
export type StoredLocalCart = { version: 1; items: StoredCartItem[] };

export type CartMode = "cart" | "buy-now";

const EMPTY_CART: StoredLocalCart = { version: 1, items: [] };

const cache = {
  cart: { raw: undefined as string | null | undefined, cart: EMPTY_CART },
  "buy-now": { raw: undefined as string | null | undefined, cart: EMPTY_CART },
};

function imageFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getCartItemKey(item: StoredCartItem) {
  const fields = [item.kind, item.productId, item.phoneBrand, item.phoneModel, item.networkType];
  fields.push(item.material);
  if (item.kind === "custom" && item.customizationType === "UPLOAD_DESIGN") fields.push(imageFingerprint(item.image));
  if (item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE") fields.push(item.templateId, item.englishName, item.arabicName, item.englishColor, item.arabicColor);
  return fields.join("::");
}

function readRawCart(raw: string | null): StoredLocalCart {
  if (!raw) return EMPTY_CART;
  try {
    const stored = JSON.parse(raw) as { items?: unknown[] };
    if (Array.isArray(stored.items)) {
      stored.items = stored.items.map((value) => {
        if (!value || typeof value !== "object") return value;
        const item = value as Record<string, unknown>;
        if (item.kind !== "custom" || !materialIds.includes(item.material as Material)) return item;
        const price = customCasePricing[item.material as Material];
        const quantity = typeof item.quantity === "number" ? item.quantity : 1;
        return { ...item, customizationType: item.customizationType ?? "UPLOAD_DESIGN", ...(item.customizationType === "NAMED_TEMPLATE" ? { templateImage: FIXED_NAMED_CASE_IMAGE, englishColor: item.englishColor ?? "#9FC5F8", arabicColor: item.arabicColor ?? "#221B78", englishLayout: "STACKED" } : {}), discountedUnitPrice: price.discounted, originalUnitPrice: price.original, subtotal: quantity * price.discounted };
      });
    }
    const parsed = cartSchema.safeParse(stored);
    return parsed.success ? parsed.data : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

export function getLocalCartSnapshot(mode: CartMode = "cart"): StoredLocalCart {
  if (typeof window === "undefined") return EMPTY_CART;
  const key = mode === "cart" ? LOCAL_CART_KEY : LOCAL_BUY_NOW_KEY;
  const raw = window.localStorage.getItem(key);
  
  if (raw === cache[mode].raw) return cache[mode].cart;
  
  cache[mode].raw = raw;
  cache[mode].cart = readRawCart(raw);
  return cache[mode].cart;
}

export function getCartSnapshotDefault(): StoredLocalCart {
  return getLocalCartSnapshot("cart");
}

export function getBuyNowSnapshot(): StoredLocalCart {
  return getLocalCartSnapshot("buy-now");
}

export function getLocalCartServerSnapshot(): StoredLocalCart {
  return EMPTY_CART;
}

export function subscribeToLocalCart(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === LOCAL_CART_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(LOCAL_CART_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LOCAL_CART_CHANGE_EVENT, onStoreChange);
  };
}

export function subscribeToBuyNow(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === LOCAL_BUY_NOW_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(LOCAL_BUY_NOW_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LOCAL_BUY_NOW_CHANGE_EVENT, onStoreChange);
  };
}

function saveLocalCart(cart: StoredLocalCart, mode: CartMode = "cart") {
  const validated = cartSchema.parse(cart);
  const raw = JSON.stringify(validated);
  const key = mode === "cart" ? LOCAL_CART_KEY : LOCAL_BUY_NOW_KEY;
  const event = mode === "cart" ? LOCAL_CART_CHANGE_EVENT : LOCAL_BUY_NOW_CHANGE_EVENT;
  
  window.localStorage.setItem(key, raw);
  cache[mode].raw = raw;
  cache[mode].cart = validated;
  window.dispatchEvent(new Event(event));
}

export function setBuyNowItem(input: LocalCartItem): void {
  const item = itemSchema.parse(input);
  saveLocalCart({ version: 1, items: [item] }, "buy-now");
}

// Browser-only draft cart. Checkout will calculate authoritative prices again.
export function addToLocalCart(input: LocalCartItem, mode: CartMode = "cart"): void {
  const item = itemSchema.parse(input);
  
  const items = getLocalCartSnapshot(mode).items.map((existing) => ({ ...existing }));
  const existing = items.find((other) => getCartItemKey(other) === getCartItemKey(item));
  if (existing) {
    const quantity = existing.quantity + item.quantity;
    if (quantity > 99) throw new Error("A maximum of 99 of the same case can be saved in your bag.");
    Object.assign(existing, item, { quantity, subtotal: quantity * item.discountedUnitPrice });
  } else {
    items.push(item);
  }
  saveLocalCart({ version: 1, items }, mode);
}

export function updateLocalCartQuantity(itemKey: string, quantity: number, mode: CartMode = "cart") {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
  const items = getLocalCartSnapshot(mode).items.map((item) => getCartItemKey(item) === itemKey
    ? { ...item, quantity, subtotal: quantity * item.discountedUnitPrice }
    : item);
  saveLocalCart({ version: 1, items }, mode);
}

export function removeFromLocalCart(itemKey: string, mode: CartMode = "cart") {
  const items = getLocalCartSnapshot(mode).items.filter((item) => getCartItemKey(item) !== itemKey);
  saveLocalCart({ version: 1, items }, mode);
}

export function getLocalCartCount(cart: StoredLocalCart) {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}
