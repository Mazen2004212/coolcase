import type { OrderStatus, AdminOrderShipping } from './types';

export type OrderEmailInput = {
  status: OrderStatus;
  customerName: string;
  orderReference: string;
  total: number;
  paymentMethod: 'COD' | 'InstaPay';
  shippingInfo?: AdminOrderShipping;
};

export type OrderEmail = { subject: string; body: string };

/** Builds the shipping block included in Shipped / Out for Delivery emails.
 *  Only lines with non-empty values are included — no blank label: lines. */
function shippingBlock(info?: AdminOrderShipping): string {
  if (!info) return '';
  const lines: string[] = [];
  if (info.courier.trim()) lines.push(`Courier: ${info.courier.trim()}`);
  if (info.trackingNumber.trim()) lines.push(`Tracking Number: ${info.trackingNumber.trim()}`);
  if (info.currentLocation.trim()) lines.push(`Current Location: ${info.currentLocation.trim()}`);
  return lines.join('\n');
}

/**
 * Returns the subject and body for the customer email matching the given order status.
 * Returns null for statuses that do not trigger a customer email (e.g. Rejected).
 *
 * Future backend: call this server-side after authenticating the admin, validating the
 * transition, and saving the new status. Record the sent email (type, orderId, sentAt)
 * to prevent accidental duplicate sends.
 */
export function getOrderStatusEmail(input: OrderEmailInput): OrderEmail | null {
  const { status, customerName, orderReference, total, paymentMethod, shippingInfo } = input;
  const name = customerName.trim() || 'there';
  const block = shippingBlock(shippingInfo);

  switch (status) {
    case 'Pending Approval':
      return {
        subject: `We've received your Coolcase order`,
        body: [
          `Hi ${name},`,
          ``,
          `We've received your Coolcase order.`,
          ``,
          `Your order is currently pending approval.`,
          `We'll email you again once it has been confirmed.`,
          ``,
          `Order: ${orderReference}`,
          `Total: ${total} EGP`,
          ...(paymentMethod === 'InstaPay'
            ? [``, `If you selected InstaPay, please make sure you've sent your payment screenshot to us on WhatsApp for verification.`]
            : []),
          ``,
          `We're excited to get your Coolcase ready for you.`,
          ``,
          `Thanks for choosing Coolcase.`,
        ].join('\n'),
      };

    case 'Confirmed':
      return {
        subject: `Your Coolcase order is confirmed`,
        body: [
          `Hi ${name},`,
          ``,
          `Great news — your order has been confirmed.`,
          ``,
          `Order: ${orderReference}`,
          `Status: Confirmed`,
          ``,
          `We're getting everything ready for you.`,
          ``,
          `Estimated delivery:`,
          `7–10 days`,
          ``,
          `Your new case is one step closer.`,
          ``,
          `Thanks for choosing Coolcase.`,
        ].join('\n'),
      };

    case 'Preparing':
      return {
        subject: `We're preparing your Coolcase order`,
        body: [
          `Hi ${name},`,
          ``,
          `Your Coolcase order is now being prepared.`,
          ``,
          `Order: ${orderReference}`,
          `Status: Preparing`,
          ``,
          `We're getting your case ready and will let you know as soon as it ships.`,
          ``,
          `We're getting everything ready — your Coolcase is coming together.`,
          ``,
          `Thanks for choosing Coolcase.`,
        ].join('\n'),
      };

    case 'Shipped':
      return {
        subject: `Your Coolcase order has been shipped`,
        body: [
          `Hi ${name},`,
          ``,
          `Your order has been shipped and is now on its way.`,
          ``,
          `Order: ${orderReference}`,
          `Status: Shipped`,
          ...(block ? [``, block] : []),
          ``,
          `We'll let you know when your order is out for delivery.`,
          ``,
          `It's officially on the move. We hope you're excited.`,
          ``,
          `Thanks for choosing Coolcase.`,
        ].join('\n'),
      };

    case 'Out for Delivery':
      return {
        subject: `Your Coolcase order is out for delivery`,
        body: [
          `Hi ${name},`,
          ``,
          `Your order is out for delivery and is on the way to you.`,
          ``,
          `Order: ${orderReference}`,
          `Status: Out for Delivery`,
          ...(block ? [``, block] : []),
          ``,
          `Please keep your phone available in case the courier needs to contact you.`,
          ``,
          `Almost there — your Coolcase should be with you very soon.`,
          ``,
          `Thanks for choosing Coolcase.`,
        ].join('\n'),
      };

    case 'Delivered':
      return {
        subject: `Your Coolcase order has been delivered`,
        body: [
          `Hi ${name},`,
          ``,
          `Your Coolcase order has been delivered.`,
          ``,
          `Order: ${orderReference}`,
          `Status: Delivered`,
          ``,
          `We hope your new case feels just right. Enjoy it.`,
          ``,
          `Thanks for choosing Coolcase.`,
        ].join('\n'),
      };

    case 'Cancelled':
      return {
        subject: `Update about your Coolcase order`,
        body: [
          `Hi ${name},`,
          ``,
          `Your Coolcase order has been cancelled.`,
          ``,
          `Order: ${orderReference}`,
          `Status: Cancelled`,
          ``,
          `If you believe this was a mistake or need help, please contact us on WhatsApp.`,
          ``,
          `We're here if you need anything.`,
          ``,
          `Thanks,`,
          `Coolcase`,
        ].join('\n'),
      };

    // Rejected does not trigger a customer email in this phase.
    default:
      return null;
  }
}
