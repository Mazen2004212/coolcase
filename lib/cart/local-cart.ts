import { z } from "zod";
import { materialIds, phoneModels, type PhoneBrand } from "@/lib/data/product-options";

export const LOCAL_CART_KEY = "coolcase.cart.v1";

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
  image: z.string().startsWith("data:image/").max(4_000_000), uploadFileName: z.string().min(1).max(180),
}).refine((item) => (phoneModels[item.phoneBrand as PhoneBrand] as readonly string[]).includes(item.phoneModel), "Choose a supported phone model.")
  .refine((item) => item.discountedUnitPrice === 239 && item.originalUnitPrice === 289, "Invalid custom-case price.")
  .refine((item) => item.subtotal === item.quantity * item.discountedUnitPrice, "Invalid subtotal.");

const itemSchema = z.union([productItemSchema, customItemSchema]);
const cartSchema = z.object({ version: z.literal(1), items: z.array(itemSchema).max(200) });
export type LocalCartItem = z.input<typeof itemSchema>;
type StoredCartItem = z.output<typeof itemSchema>;

function sameConfiguration(left: StoredCartItem, right: StoredCartItem) {
  if (left.kind !== right.kind || left.slug !== right.slug || left.phoneBrand !== right.phoneBrand || left.phoneModel !== right.phoneModel || left.networkType !== right.networkType) return false;
  if (left.kind === "product" && right.kind === "product") return left.material === right.material;
  return left.kind === "custom" && right.kind === "custom" && left.image === right.image;
}

// Browser-only draft cart. Checkout will calculate authoritative prices again.
export function addToLocalCart(input: LocalCartItem): void {
  const item = itemSchema.parse(input);
  const raw = localStorage.getItem(LOCAL_CART_KEY);
  const cart = raw ? cartSchema.parse(JSON.parse(raw)) : { version: 1 as const, items: [] as StoredCartItem[] };
  const existing = cart.items.find((other) => sameConfiguration(other, item));
  if (existing) {
    const quantity = existing.quantity + item.quantity;
    if (quantity > 99) throw new Error("A maximum of 99 of the same case can be saved in your bag.");
    Object.assign(existing, item, { quantity, subtotal: quantity * item.discountedUnitPrice });
  } else {
    cart.items.push(item);
  }
  localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(cartSchema.parse(cart)));
}
