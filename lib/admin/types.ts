import type { Material, MaterialPrice, PhoneBrand } from '@/lib/data/product-options';

export const productStatuses = ['Draft', 'Active', 'Out of Stock', 'Hidden', 'Archived'] as const;

/**
 * Customer-facing order lifecycle.
 * Backend note: the database enum must include OUT_FOR_DELIVERY when migrations are applied.
 * Do not add that migration during frontend-only work.
 */
export const orderStatuses = [
  'Pending Approval',
  'Confirmed',
  'Preparing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Rejected',
] as const;

export const paymentStatuses = ['Pending', 'Awaiting Verification', 'Paid', 'Failed', 'Refunded'] as const;
export type AdminRole = 'OWNER' | 'MANAGER' | 'ORDER_STAFF';

export type StaffProfile = {
  userId: string;
  role: AdminRole;
  permissions: string[];
  isActive: boolean;
};

export type ProductStatus = typeof productStatuses[number];
export type OrderStatus = typeof orderStatuses[number];
export type PaymentStatus = typeof paymentStatuses[number];
export type AdminProductImage = { id: string; src: string; alt: string; group: 'General Gallery' | Material };
export type AdminProduct = {
  id: string; name: string; slug: string; shortDescription: string; description: string;
  collection: string; category: string; regularPrice: number; salePrice: number; saleEnabled: boolean;
  saleStarts: string; saleEnds: string; status: ProductStatus; materials: Material[];
  materialPricing: Record<Material, MaterialPrice>; models: Partial<Record<PhoneBrand, string[]>>;
  featured: boolean; isNew: boolean; bestSeller: boolean; images: AdminProductImage[]; updatedAt: string;
};
export type AdminOrderItem = { productId: string; name: string; image: string; material: Material; model: string; network: '4G' | '5G'; quantity: number; unitPrice: number };

/**
 * Shipping details for an order.
 * shippingNotes is admin-internal ONLY — must NOT be exposed to customers.
 * courier, trackingNumber, currentLocation are customer-visible once backend is connected.
 */
export type AdminOrderShipping = {
  courier: string;
  trackingNumber: string;
  currentLocation: string;
  shippingNotes: string;
};

export type AdminOrder = {
  id: string; customerId: string; date: string; items: AdminOrderItem[]; discount: number; shipping: number;
  status: OrderStatus; paymentMethod: 'COD' | 'InstaPay'; paymentStatus: PaymentStatus;
  address: string; paymentReference: string; notes: { text: string; date: string }[];
  history: { status: OrderStatus; date: string }[];
  shippingInfo: AdminOrderShipping;
};
export type AdminCustomer = { id: string; name: string; email: string; phone: string; since: string; addresses: string[] };
export type AdminCoupon = {
  id: string; code: string; title: string; type: 'Percentage' | 'Fixed Amount'; value: number;
  active: boolean; archived: boolean; start: string; expiry: string; minimum: number; maximum: number;
  usageLimit: number; perUserLimit: number; usage: number; customerId: string;
};
export type AdminShippingSettings = { flatFee: number };
export type AdminStoreSettings = { name: string; email: string; phone: string; whatsapp: string; cod: boolean; instapay: boolean; instapayNumber: string; defaultStatus: OrderStatus; sender: string };
export type AdminActivityEvent = { id: string; text: string; date: string };
export type AdminAnalytics = { revenue: number; gross: number; discounts: number; shipping: number; validOrders: number; average: number; units: number };
export type AdminState = { products: AdminProduct[]; orders: AdminOrder[]; customers: AdminCustomer[]; coupons: AdminCoupon[]; shipping: AdminShippingSettings; settings: AdminStoreSettings; activity: AdminActivityEvent[]; emailPreviews: { customerId: string; couponId: string; date: string }[] };
