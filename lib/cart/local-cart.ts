import { z } from "zod";
import { customCasePricing, materialIds, phoneModels, type Material, type PhoneBrand } from "@/lib/data/product-options";

export const LOCAL_CART_KEY = "coolcase.cart.v1";
export const LOCAL_CART_CHANGE_EVENT = "coolcase:cart-change";

const commonFields = {
  productId: z.string().min(1), slug: z.string().min(1), productName: z.string().min(1),
  phoneBrand: z.enum(["iPhone", "Samsung", "Xiaomi", "Redmi", "Oppo"]),
  phoneModel: z.string().min(1), networkType: z.enum(["4G", "5G"]),
  quantity: z.number().int().min(1).max(99), discountedUnitPrice: z.number().int().positive(),
  originalUnitPrice: z.number().int().positive(), subtotal: z.number().int().positive(),
};

const productItemSchema = z.object({
  kind: z.literal("product").default("product"), ...commonFields,
  material: z.enum(materialIds), image: z.string().startsWith("/assets/"),
}).refine((item) => (phoneModels[item.phoneBrand as PhoneBrand] as readonly string[]).includes(item.phoneModel), "Choose a supported phone model.")
  .refine((item) => item.material !== "acrylic" || item.phoneBrand === "iPhone", "Acrylic requires an iPhone.")
  .refine((item) => item.subtotal === item.quantity * item.discountedUnitPrice, "Invalid subtotal.");

const customItemSchema = z.object({
  kind: z.literal("custom"), ...commonFields,
  material: z.enum(materialIds).default("silicon"),
  image: z.string().startsWith("data:image/").max(4_000_000), uploadFileName: z.string().min(1).max(180),
}).refine((item) => (phoneModels[item.phoneBrand as PhoneBrand] as readonly string[]).includes(item.phoneModel), "Choose a supported phone model.")
  .refine((item) => item.material !== "acrylic" || item.phoneBrand === "iPhone", "Acrylic requires an iPhone.")
  .refine((item) => {
    const price = customCasePricing[item.material];
    return item.discountedUnitPrice === price.discounted && item.originalUnitPrice === price.original;
  }, "Invalid custom-case price.")
  .refine((item) => item.subtotal === item.quantity * item.discountedUnitPrice, "Invalid subtotal.");

const itemSchema = z.union([productItemSchema, customItemSchema]);
const cartSchema = z.object({ version: z.literal(1), items: z.array(itemSchema).max(200) });
export type LocalCartItem = z.input<typeof itemSchema>;
export type StoredCartItem = z.output<typeof itemSchema>;
export type StoredLocalCart = { version: 1; items: StoredCartItem[] };

const EMPTY_CART: StoredLocalCart = { version: 1, items: [] };
let cachedRaw: string | null | undefined;
let cachedCart: StoredLocalCart = EMPTY_CART;

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
  if (item.kind === "custom") fields.push(imageFingerprint(item.image));
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
        return { ...item, discountedUnitPrice: price.discounted, originalUnitPrice: price.original, subtotal: quantity * price.discounted };
      });
    }
    const parsed = cartSchema.safeParse(stored);
    return parsed.success ? parsed.data : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

export function getLocalCartSnapshot(): StoredLocalCart {
  if (typeof window === "undefined") return EMPTY_CART;
  const raw = window.localStorage.getItem(LOCAL_CART_KEY);
  if (raw === cachedRaw) return cachedCart;
  cachedRaw = raw;
  cachedCart = readRawCart(raw);
  return cachedCart;
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

function saveLocalCart(cart: StoredLocalCart) {
  const validated = cartSchema.parse(cart);
  const raw = JSON.stringify(validated);
  window.localStorage.setItem(LOCAL_CART_KEY, raw);
  cachedRaw = raw;
  cachedCart = validated;
  window.dispatchEvent(new Event(LOCAL_CART_CHANGE_EVENT));
}

// Browser-only draft cart. Checkout will calculate authoritative prices again.
export function addToLocalCart(input: LocalCartItem): void {
  const item = itemSchema.parse(input);
  const items = getLocalCartSnapshot().items.map((existing) => ({ ...existing }));
  const existing = items.find((other) => getCartItemKey(other) === getCartItemKey(item));
  if (existing) {
    const quantity = existing.quantity + item.quantity;
    if (quantity > 99) throw new Error("A maximum of 99 of the same case can be saved in your bag.");
    Object.assign(existing, item, { quantity, subtotal: quantity * item.discountedUnitPrice });
  } else {
    items.push(item);
  }
  saveLocalCart({ version: 1, items });
}

export function updateLocalCartQuantity(itemKey: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
  const items = getLocalCartSnapshot().items.map((item) => getCartItemKey(item) === itemKey
    ? { ...item, quantity, subtotal: quantity * item.discountedUnitPrice }
    : item);
  saveLocalCart({ version: 1, items });
}

export function removeFromLocalCart(itemKey: string) {
  const items = getLocalCartSnapshot().items.filter((item) => getCartItemKey(item) !== itemKey);
  saveLocalCart({ version: 1, items });
}

export function getLocalCartCount(cart: StoredLocalCart) {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}
