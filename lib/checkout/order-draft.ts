import type { StoredCartItem } from "@/lib/cart/local-cart";

export const CHECKOUT_SHIPPING_FEE = 50;
export const INSTAPAY_TRANSFER_NUMBER = "01152966212";
export const WHATSAPP_DISPLAY_NUMBER = "01142966212";
export const WHATSAPP_INTERNATIONAL_NUMBER = "201142966212";

export const futureOrderStatuses = [
  "PENDING_ADMIN_APPROVAL",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type FutureOrderStatus = (typeof futureOrderStatuses)[number];
export const futurePaymentStatuses = [
  "PAYMENT_PENDING",
  "AWAITING_PAYMENT_VERIFICATION",
  "VERIFIED",
  "PAY_ON_DELIVERY",
] as const;
export type FuturePaymentStatus = (typeof futurePaymentStatuses)[number];
export type CheckoutPaymentMethod = "COD" | "INSTAPAY";

export type CheckoutFormValues = {
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  city: string;
  area: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  landmark: string;
  deliveryNotes: string;
  paymentMethod: CheckoutPaymentMethod;
};

// This draft deliberately excludes order/payment statuses and references. Those
// values must be assigned by the future trusted server action, never the browser.
export type CheckoutSubmissionDraft = {
  customer: { fullName: string; phone: string; email: string };
  address: {
    governorate: string; city: string; area: string; street: string; building: string;
    floor?: string; apartment?: string; landmark?: string; deliveryNotes?: string;
  };
  payment: { method: CheckoutPaymentMethod };
  cart: { items: StoredCartItem[]; subtotal: number; shipping: number; total: number };
};

export function createCheckoutSubmissionDraft(values: CheckoutFormValues, items: StoredCartItem[]): CheckoutSubmissionDraft {
  const subtotal = items.reduce((sum, item) => sum + item.discountedUnitPrice * item.quantity, 0);
  return {
    customer: { fullName: values.fullName.trim(), phone: values.phone.trim(), email: values.email.trim() },
    address: {
      governorate: values.governorate.trim(), city: values.city.trim(), area: values.area.trim(),
      street: values.street.trim(), building: values.building.trim(), floor: values.floor.trim() || undefined,
      apartment: values.apartment.trim() || undefined, landmark: values.landmark.trim() || undefined,
      deliveryNotes: values.deliveryNotes.trim() || undefined,
    },
    payment: { method: values.paymentMethod },
    cart: { items, subtotal, shipping: CHECKOUT_SHIPPING_FEE, total: subtotal + CHECKOUT_SHIPPING_FEE },
  };
}

export function getWhatsAppUrl(total: number) {
  const message = `Hello Coolcase, I have completed my InstaPay payment of ${total} EGP and I want to send the transaction screenshot for verification.`;
  return `https://wa.me/${WHATSAPP_INTERNATIONAL_NUMBER}?text=${encodeURIComponent(message)}`;
}
