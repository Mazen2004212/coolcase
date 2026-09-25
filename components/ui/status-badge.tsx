import type { ReactNode } from 'react';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export const orderLabels: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: 'Pending approval', PENDING_CONFIRMATION: 'Pending approval',
  CONFIRMED: 'Confirmed', PREPARING: 'Preparing', SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled', REJECTED: 'Rejected',
};
const orderTones: Record<string, Tone> = { PENDING_ADMIN_APPROVAL: 'warning', PENDING_CONFIRMATION: 'warning', CONFIRMED: 'info', PREPARING: 'info', SHIPPED: 'info', OUT_FOR_DELIVERY: 'info', DELIVERED: 'success', CANCELLED: 'danger', REJECTED: 'danger' };
const paymentLabels: Record<string, string> = { PENDING: 'Pending', PENDING_VERIFICATION: 'Awaiting review', VERIFIED: 'Verified', REJECTED: 'Rejected', NOT_REQUIRED: 'Not required', REFUNDED: 'Refunded' };
const paymentTones: Record<string, Tone> = { PENDING: 'warning', PENDING_VERIFICATION: 'warning', VERIFIED: 'success', REJECTED: 'danger', NOT_REQUIRED: 'neutral', REFUNDED: 'neutral' };
export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className="cc-badge" data-tone={tone}>{children}</span>;
}
export function OrderStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={orderTones[status]}>Order: {orderLabels[status] ?? status}</StatusBadge>;
}
const shippingLabels: Record<string, string> = {
  PENDING_ADMIN_APPROVAL: 'Pending approval',
  PENDING_CONFIRMATION: 'Pending approval',
  CONFIRMED: 'Pending shipment',
  PREPARING: 'Preparing',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};
export function ShippingStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={orderTones[status]}>{shippingLabels[status] ?? status}</StatusBadge>;
}
export function PaymentStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={paymentTones[status]}>Payment: {paymentLabels[status] ?? status}</StatusBadge>;
}
export function TestOrderBadge() { return <span className="cc-badge cc-badge-outline">TEST ORDER</span>; }
