import type { AdminAnalytics, AdminCoupon, AdminOrder } from './types';

export const money = (value: number) => `${value.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP`;
export const shortDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const subtotal = (order: AdminOrder) => order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
export const total = (order: AdminOrder) => subtotal(order) - order.discount + order.shipping;
export const validOrder = (order: AdminOrder) => !['Cancelled', 'Rejected'].includes(order.status);
export function summarize(orders: AdminOrder[]): AdminAnalytics {
  const valid = orders.filter(validOrder);
  const gross = valid.reduce((s, o) => s + subtotal(o), 0);
  const discounts = valid.reduce((s, o) => s + o.discount, 0);
  const shipping = valid.reduce((s, o) => s + o.shipping, 0);
  const revenue = gross - discounts + shipping;
  return { revenue, gross, discounts, shipping, validOrders: valid.length, average: valid.length ? revenue / valid.length : 0, units: valid.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0) };
}
export function couponStatus(c: AdminCoupon, today: string) {
  if (!c.active || c.archived) return 'Disabled';
  if (c.start && c.start > today) return 'Scheduled';
  if (c.expiry && c.expiry < today) return 'Expired';
  return 'Active';
}
// Preview only. The backend must validate eligibility and compute the final discount.
export function couponDiscount(c: AdminCoupon, productsSubtotal: number) {
  if (productsSubtotal < c.minimum) return 0;
  const amount = c.type === 'Percentage' ? productsSubtotal * c.value / 100 : c.value;
  return Math.min(productsSubtotal, c.type === 'Percentage' && c.maximum > 0 ? Math.min(amount, c.maximum) : amount);
}
