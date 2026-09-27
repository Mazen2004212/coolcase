import type { OrderStatus, AdminOrderShipping } from './types';

export type OrderEmailItem = {
  productName: string;
  phoneModel: string;
  material: string;
  networkType?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  customizationType?: string | null;
  customizationSnapshot?: Record<string, unknown> | null;
};

export type OrderEmailInput = {
  status: OrderStatus;
  customerName: string;
  orderReference: string;
  total: number;
  subtotal?: number;
  discount?: number;
  shipping?: number;
  paymentMethod: 'COD' | 'InstaPay';
  paymentExpectedAmount?: number;
  remainingCodAmount?: number;
  paymentStatus?: string;
  shippingInfo?: AdminOrderShipping;
  items?: OrderEmailItem[];
  customerVisibleNote?: string;
  siteUrl?: string;
  orderUrl?: string;
  supportLabel?: string;
  supportUrl?: string;
};

export type OrderEmail = { subject: string; body: string; html: string };

const palette = {
  heading: '#3d2b21', ink: '#3d2b21', muted: '#9b8373', border: '#dcc8b7', canvas: '#f8f5f2',
  panel: '#f3ede7', button: '#c8a487', buttonText: '#3d2b21', link: '#7f5f49',
  success: '#2e9b57', warning: '#d59b2d', danger: '#c95353', white: '#ffffff',
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function absoluteUrl(base: string | undefined, path: string) {
  if (!base) return undefined;
  try {
    const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function money(value: number) {
  return `${Number(value).toLocaleString('en-EG')} EGP`;
}

function friendly(value: string) {
  if (value === 'FOUR_G' || value === '4G') return '4G';
  if (value === 'FIVE_G' || value === '5G') return '5G';
  const normalized = value.replaceAll('_', ' ').replaceAll('-', ' ').toLowerCase();
  return normalized.replace(/\b\w/g, letter => letter.toUpperCase());
}

function paymentLabel(method: OrderEmailInput['paymentMethod']) {
  return method === 'InstaPay' ? 'InstaPay' : 'Cash on delivery';
}

function codPaymentLines(input: OrderEmailInput) {
  if (input.paymentMethod !== 'COD' || input.paymentExpectedAmount === undefined) return [];
  const verified = input.paymentStatus === 'VERIFIED';
  return [
    `${verified ? 'Deposit received' : 'Deposit required'}: ${money(input.paymentExpectedAmount)}`,
    `Remaining due on delivery: ${money(input.remainingCodAmount ?? input.total - input.paymentExpectedAmount)}`,
  ];
}

function itemLines(item: OrderEmailItem) {
  const details = [item.phoneModel, friendly(item.material), item.networkType ? friendly(item.networkType) : ''].filter(Boolean);
  const snapshot = item.customizationSnapshot;
  if (item.customizationType === 'UPLOAD_DESIGN') details.unshift('Your uploaded design');
  if (item.customizationType === 'NAMED_TEMPLATE' && snapshot) {
    if (snapshot.templateName) details.unshift(`Design: ${String(snapshot.templateName)}`);
    if (snapshot.englishName) details.push(`English name: ${String(snapshot.englishName)}`);
    if (snapshot.arabicName) details.push(`Arabic name: ${String(snapshot.arabicName)}`);
  }
  return details;
}

function itemsText(items: OrderEmailItem[]) {
  if (!items.length) return [];
  return [
    '',
    'Items',
    ...items.flatMap(item => [
      `${item.productName} × ${item.quantity} — ${money(item.lineTotal)}`,
      `  ${itemLines(item).join(' · ')}`,
    ]),
  ];
}

function summaryText(input: OrderEmailInput) {
  return [
    `Order: ${input.orderReference}`,
    ...itemsText(input.items ?? []),
    '',
    ...(input.subtotal !== undefined ? [`Subtotal: ${money(input.subtotal)}`] : []),
    ...(input.discount !== undefined && input.discount > 0 ? [`Discount: -${money(input.discount)}`] : []),
    ...(input.shipping !== undefined ? [`Shipping: ${money(input.shipping)}`] : []),
    `Total: ${money(input.total)}`,
    `Payment: ${paymentLabel(input.paymentMethod)}`,
    ...codPaymentLines(input),
    `Status: ${input.status}`,
  ].join('\n');
}

function itemRows(items: OrderEmailItem[]) {
  if (!items.length) return '';
  return `
    <tr><td style="padding:22px 24px 8px;font-size:11px;line-height:16px;letter-spacing:1.2px;text-transform:uppercase;color:${palette.muted};">Items</td></tr>
    <tr><td style="padding:0 24px 8px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${items.map(item => `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid ${palette.border};vertical-align:top;">
              <div style="font-size:14px;line-height:20px;font-weight:700;color:${palette.heading};">${escapeHtml(item.productName)}</div>
              <div style="padding-top:4px;font-size:12px;line-height:18px;color:${palette.muted};">${itemLines(item).map(escapeHtml).join(' &middot; ')}</div>
            </td>
            <td style="padding:12px 0 12px 12px;border-bottom:1px solid ${palette.border};vertical-align:top;text-align:right;white-space:nowrap;">
              <div style="font-size:12px;line-height:18px;color:${palette.muted};">Qty ${item.quantity}${item.quantity > 1 ? ` &middot; ${escapeHtml(money(item.unitPrice))} each` : ''}</div>
              <div style="font-size:13px;line-height:20px;font-weight:700;color:${palette.ink};">${escapeHtml(money(item.lineTotal))}</div>
            </td>
          </tr>`).join('')}
      </table>
    </td></tr>`;
}

function summaryRows(input: OrderEmailInput) {
  const rows = [
    input.subtotal !== undefined ? ['Subtotal', money(input.subtotal)] : null,
    input.discount !== undefined && input.discount > 0 ? ['Discount', `-${money(input.discount)}`] : null,
    input.shipping !== undefined ? ['Shipping', money(input.shipping)] : null,
    ['Total', money(input.total)],
    ['Payment', paymentLabel(input.paymentMethod)],
    ...codPaymentLines(input).map(line => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator), line.slice(separator + 1).trim()];
    }),
    ['Status', input.status],
  ].filter((row): row is string[] => Boolean(row));

  return `
    <tr><td style="padding:12px 24px 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${palette.panel};border:1px solid ${palette.border};">
        <tr><td colspan="2" style="padding:16px 18px 10px;font-size:11px;line-height:16px;letter-spacing:1.2px;text-transform:uppercase;color:${palette.muted};">Order ${escapeHtml(input.orderReference)}</td></tr>
        ${rows.map(([label, value]) => `
          <tr>
            <td style="padding:5px 18px;font-size:${label === 'Total' ? '15px' : '12px'};line-height:20px;color:${label === 'Total' ? palette.heading : palette.muted};font-weight:${label === 'Total' ? '700' : '400'};">${escapeHtml(label)}</td>
            <td style="padding:5px 18px;text-align:right;font-size:${label === 'Total' ? '15px' : '12px'};line-height:20px;color:${palette.heading};font-weight:${label === 'Total' ? '700' : '600'};">${escapeHtml(value)}</td>
          </tr>`).join('')}
        <tr><td colspan="2" style="height:10px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
      </table>
    </td></tr>`;
}

function shippingText(info?: AdminOrderShipping) {
  if (!info) return [];
  return [
    info.courier.trim() ? `Courier: ${info.courier.trim()}` : '',
    info.trackingNumber.trim() ? `Tracking number: ${info.trackingNumber.trim()}` : '',
    info.currentLocation.trim() ? `Current location: ${info.currentLocation.trim()}` : '',
  ].filter(Boolean);
}

function shippingHtml(info?: AdminOrderShipping) {
  const rows = shippingText(info).map(line => {
    const separator = line.indexOf(':');
    return [line.slice(0, separator), line.slice(separator + 1).trim()];
  });
  if (!rows.length) return '';
  return `<tr><td style="padding:0 24px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${palette.border};">${rows.map(([label, value]) => `<tr><td style="padding:8px 12px;color:${palette.muted};font-size:12px;">${escapeHtml(label)}</td><td style="padding:8px 12px;text-align:right;color:${palette.ink};font-size:12px;font-weight:600;">${escapeHtml(value)}</td></tr>`).join('')}</table></td></tr>`;
}

type EmailLayoutInput = {
  headline: string;
  intro: string;
  detail?: string;
  accent?: 'success' | 'warning' | 'danger';
  ctaLabel?: string;
  ctaUrl?: string;
};

function wrapper(input: OrderEmailInput, layout: EmailLayoutInput) {
  const configuredBase = input.siteUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  const headerImage = absoluteUrl(configuredBase, '/assets/email/coolcase-email-header.png');
  const ctaUrl = layout.ctaUrl && absoluteUrl(configuredBase, layout.ctaUrl);
  const supportUrl = input.supportUrl && (absoluteUrl(configuredBase, input.supportUrl) || (input.supportUrl.startsWith('mailto:') || input.supportUrl.startsWith('https://wa.me/') ? input.supportUrl : undefined));
  const accent = layout.accent === 'danger' ? palette.danger : layout.accent === 'warning' ? palette.warning : palette.success;
  const note = input.customerVisibleNote?.trim();

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(layout.headline)}</title></head>
<body style="margin:0;padding:0;background:${palette.canvas};font-family:Arial,Helvetica,sans-serif;color:${palette.ink};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${palette.canvas};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:${palette.white};border:1px solid ${palette.border};">
        <tr><td align="center" style="background:${palette.canvas};padding:0;">
          ${headerImage ? `<img src="${escapeHtml(headerImage)}" width="620" alt="Coolcase — premium cases for a more stylish everyday" style="display:block;width:100%;max-width:620px;height:auto;border:0;margin:0 auto;background:${palette.canvas};color:${palette.heading};font-size:18px;line-height:28px;">` : `<div style="padding:22px 24px;font-size:20px;line-height:28px;letter-spacing:4px;color:${palette.heading};font-weight:700;">COOLCASE</div>`}
        </td></tr>
        <tr><td style="height:4px;background:${accent};font-size:1px;line-height:1px;">&nbsp;</td></tr>
        <tr><td style="padding:34px 24px 12px;">
          <div style="font-size:12px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:${palette.muted};">Hi ${escapeHtml(input.customerName.trim() || 'there')},</div>
          <h1 style="margin:10px 0 14px;font-size:30px;line-height:36px;letter-spacing:-0.8px;color:${palette.heading};">${escapeHtml(layout.headline)}</h1>
          <p style="margin:0;font-size:15px;line-height:24px;color:${palette.ink};">${escapeHtml(layout.intro)}</p>
          ${layout.detail ? `<p style="margin:10px 0 0;font-size:14px;line-height:22px;color:${palette.muted};">${escapeHtml(layout.detail)}</p>` : ''}
        </td></tr>
        ${shippingHtml(input.shippingInfo)}
        ${note ? `<tr><td style="padding:8px 24px 18px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff8ed;border-left:4px solid ${accent};"><tr><td style="padding:12px 14px;font-size:13px;line-height:20px;color:${palette.ink};"><strong>Order note</strong><br>${escapeHtml(note)}</td></tr></table></td></tr>` : ''}
        ${itemRows(input.items ?? [])}
        ${summaryRows(input)}
        ${layout.ctaLabel && ctaUrl ? `<tr><td align="center" style="padding:0 24px 30px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="${palette.button}" style="border-radius:10px;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 22px;color:${palette.buttonText};text-decoration:none;font-size:13px;line-height:18px;font-weight:700;">${escapeHtml(layout.ctaLabel)}</a></td></tr></table></td></tr>` : ''}
        <tr><td style="border-top:1px solid ${palette.border};padding:22px 24px;text-align:center;">
          <div style="font-size:13px;line-height:20px;font-weight:700;color:${palette.heading};">Coolcase</div>
          <div style="padding-top:5px;font-size:11px;line-height:18px;color:${palette.muted};">Cases that look better. Feel better. Last longer. Made for you.</div>
          ${supportUrl && input.supportLabel ? `<div style="padding-top:8px;font-size:11px;line-height:18px;"><a href="${escapeHtml(supportUrl)}" style="color:${palette.link};text-decoration:underline;">${escapeHtml(input.supportLabel)}</a></div>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function createEmail(input: OrderEmailInput, subject: string, layout: EmailLayoutInput, closing: string[] = []) : OrderEmail {
  const shipping = shippingText(input.shippingInfo);
  return {
    subject,
    body: [
      `Hi ${input.customerName.trim() || 'there'},`,
      '',
      layout.headline,
      layout.intro,
      ...(layout.detail ? [layout.detail] : []),
      ...(shipping.length ? ['', ...shipping] : []),
      ...(input.customerVisibleNote?.trim() ? ['', `Order note: ${input.customerVisibleNote.trim()}`] : []),
      '',
      summaryText(input),
      '',
      ...closing,
      'Coolcase',
    ].join('\n'),
    html: wrapper(input, layout),
  };
}

export function getOrderStatusEmail(input: OrderEmailInput): OrderEmail | null {
  const orderUrl = input.orderUrl ?? `/account/orders/${encodeURIComponent(input.orderReference)}`;

  switch (input.status) {
    case 'Pending Approval':
      return createEmail(input, `We got your Coolcase order — ${input.orderReference}`, {
        headline: 'Your order is in ✨',
        intro: 'Thanks for choosing Coolcase. We’ve received your order and we’re reviewing it now.',
        detail: input.paymentMethod === 'InstaPay'
          ? 'Your InstaPay payment must be verified before the order can be confirmed.'
          : 'Transfer the 50% deposit and upload proof. We’ll confirm the order after the deposit is verified.',
        accent: 'warning', ctaLabel: 'View Order', ctaUrl: orderUrl,
      }, ['We’ll be in touch with the next update.', '']);

    case 'Confirmed':
      return createEmail(input, 'Good news — your Coolcase order is confirmed', {
        headline: 'It’s official.',
        intro: 'Your order has been confirmed and is moving into preparation.',
        detail: input.paymentMethod === 'COD'
          ? 'Your deposit was received. The remaining balance is payable when your order is delivered.'
          : 'We’re getting everything ready for you.',
        accent: 'success', ctaLabel: 'View Order', ctaUrl: orderUrl,
      }, ['Your new case is one step closer.', '']);

    case 'Preparing':
      return createEmail(input, 'Your Coolcase is being prepared', {
        headline: 'We’re getting it ready.',
        intro: 'Your order is now being prepared.',
        detail: 'We’re making sure everything is ready before it heads your way.',
        accent: 'warning', ctaLabel: 'View Order', ctaUrl: orderUrl,
      });

    case 'Shipped':
      return createEmail(input, 'Your Coolcase is on the way', {
        headline: 'It’s on the move.',
        intro: 'Your order has been shipped and is on its way to you.',
        accent: 'success', ctaLabel: 'Track Order', ctaUrl: orderUrl,
      });

    case 'Out for Delivery':
      return createEmail(input, 'Your Coolcase is out for delivery', {
        headline: 'Almost there.',
        intro: 'Your order is out for delivery and should be with you soon.',
        detail: 'Please keep your phone available in case the courier needs to reach you.',
        accent: 'success', ctaLabel: 'Track Order', ctaUrl: orderUrl,
      });

    case 'Delivered':
      return createEmail(input, 'Your Coolcase has arrived', {
        headline: 'It’s here.',
        intro: 'We hope you love your new case. Thanks for choosing Coolcase.',
        detail: 'See you again soon.',
        accent: 'success', ctaLabel: 'Shop Again', ctaUrl: '/shop',
      });

    case 'Cancelled':
      return createEmail(input, 'Your Coolcase order was cancelled', {
        headline: 'We’re sorry this order didn’t work out.',
        intro: 'Your order has been cancelled.',
        detail: 'If you need help or would like to place a new order, we’re here for you.',
        accent: 'danger', ctaLabel: 'View Order', ctaUrl: orderUrl,
      });

    case 'Rejected':
      return createEmail(input, 'Update about your Coolcase order', {
        headline: 'We couldn’t approve this order.',
        intro: 'We’re sorry, but we’re unable to proceed with this order.',
        detail: 'If you believe something is incorrect, please contact us and we’ll be happy to help.',
        accent: 'danger', ctaLabel: 'View Order', ctaUrl: orderUrl,
      });

    default:
      return null;
  }
}
