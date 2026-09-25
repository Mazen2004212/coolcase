import 'server-only';

import nodemailer from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/server';
import { getOrderStatusEmail } from '@/lib/admin/email-templates';
import type { OrderEmailInput, OrderEmailItem } from '@/lib/admin/email-templates';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function loadEmailPresentation(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
): Promise<Partial<OrderEmailInput>> {
  try {
    const [{ data: order }, { data: rows }, { data: settings }, { data: payment }] = await Promise.all([
      supabase.from('orders').select('subtotal_amount, discount_amount, shipping_amount, total_amount, payment_method').eq('id', orderId).maybeSingle(),
      supabase.from('order_items').select('product_name_snapshot, phone_model, material, network_type, quantity, unit_price, line_total, customization_type, customization_snapshot').eq('order_id', orderId).order('created_at'),
      supabase.from('store_settings').select('key, value').in('key', ['support_email', 'whatsapp_number']),
      supabase.from('payments').select('expected_amount, status').eq('order_id', orderId).maybeSingle(),
    ]);

    const setting = new Map((settings ?? []).map(row => [row.key, typeof row.value === 'string' ? row.value.trim() : '']));
    const whatsapp = setting.get('whatsapp_number')?.replace(/\D/g, '') ?? '';
    const supportEmail = setting.get('support_email') ?? '';
    const items: OrderEmailItem[] = (rows ?? []).map(item => ({
      productName: item.product_name_snapshot,
      phoneModel: item.phone_model,
      material: item.material,
      networkType: item.network_type,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      customizationType: item.customization_type,
      customizationSnapshot: record(item.customization_snapshot),
    }));

    return {
      ...(order ? {
        subtotal: order.subtotal_amount,
        discount: order.discount_amount ?? 0,
        shipping: order.shipping_amount,
        total: order.total_amount,
        paymentMethod: order.payment_method === 'INSTAPAY' ? 'InstaPay' as const : 'COD' as const,
        ...(order.payment_method === 'CASH_ON_DELIVERY' && payment?.status !== 'NOT_REQUIRED' ? {
          paymentExpectedAmount: Number(payment?.expected_amount ?? 0),
          remainingCodAmount: Number((order.total_amount - Number(payment?.expected_amount ?? 0)).toFixed(2)),
          paymentStatus: payment?.status,
        } : {}),
      } : {}),
      items,
      siteUrl: process.env.NEXT_PUBLIC_APP_URL,
      orderUrl: `/account/orders/${orderId}`,
      supportLabel: whatsapp ? 'Contact Coolcase on WhatsApp' : supportEmail ? 'Contact Coolcase support' : undefined,
      supportUrl: whatsapp ? `https://wa.me/${whatsapp}` : supportEmail ? `mailto:${supportEmail}` : undefined,
    };
  } catch (error) {
    console.error('[email] could not load presentation details:', error);
    return { siteUrl: process.env.NEXT_PUBLIC_APP_URL, orderUrl: `/account/orders/${orderId}` };
  }
}

/** Email configuration from server-only environment variables. */
function getTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT ?? 465);
  const secure = process.env.EMAIL_SECURE !== 'false'; // default true
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;

  if (!host || !user || !pass) {
    return null; // Email not configured — callers handle this gracefully
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export type EmailDeliveryResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: 'not_configured' | 'no_template' | 'duplicate' | 'smtp_error'; message: string };

/**
 * Sends a customer-facing order status email if:
 * 1. Email credentials are configured
 * 2. A template exists for the given status
 * 3. This exact (order_id, event) combination has not already been sent successfully
 *
 * Idempotency is enforced via the email_delivery_log table's unique constraint.
 */
export async function sendOrderStatusEmail(
  input: OrderEmailInput & { orderId: string; recipientEmail: string }
): Promise<EmailDeliveryResult> {
  const { orderId, recipientEmail, ...emailInput } = input;
  const event = input.status;

  const supabase = createAdminClient();

  // Check idempotency — has this exact status email already been sent?
  const { data: existing } = await supabase
    .from('email_delivery_log')
    .select('id, success')
    .eq('order_id', orderId)
    .eq('event', event)
    .maybeSingle();

  if (existing?.success) {
    return {
      sent: false,
      reason: 'duplicate',
      message: `Email for status "${event}" already sent for order ${orderId}.`,
    };
  }

  // Enrich presentation from authoritative stored snapshots and amounts.
  // A read failure falls back to the caller-provided values and never changes delivery rules.
  const presentation = await loadEmailPresentation(supabase, orderId);
  const template = getOrderStatusEmail({ ...emailInput, ...presentation });
  if (!template) {
    return {
      sent: false,
      reason: 'no_template',
      message: `No email template defined for status "${event}".`,
    };
  }

  // Check email configuration
  const transporter = getTransporter();
  if (!transporter) {
    return {
      sent: false,
      reason: 'not_configured',
      message: 'Email credentials are not configured on the server. Set EMAIL_HOST, EMAIL_USER, and EMAIL_APP_PASSWORD.',
    };
  }

  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@coolcase.eg';

  // Attempt delivery
  try {
    const info = await transporter.sendMail({
      from: `"Coolcase" <${fromAddress}>`,
      to: recipientEmail,
      subject: template.subject,
      text: template.body,
      html: template.html,
    });

    // Record success
    await supabase.from('email_delivery_log').upsert(
      {
        order_id: orderId,
        event,
        recipient_email: recipientEmail,
        subject: template.subject,
        sent_at: new Date().toISOString(),
        success: true,
        provider_message_id: info.messageId ?? null,
        error_message: null,
      },
      { onConflict: 'order_id,event' }
    );

    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Record failure (do not use upsert — we want to allow retry after SMTP errors)
    await Promise.resolve(supabase.from('email_delivery_log').insert({
      order_id: orderId,
      event: `${event}:failed:${Date.now()}`, // unique key suffix to allow retries
      recipient_email: recipientEmail,
      subject: template.subject,
      sent_at: new Date().toISOString(),
      success: false,
      error_message: errorMessage,
    })).catch(() => {/* best effort */ });

    return {
      sent: false,
      reason: 'smtp_error',
      message: `SMTP delivery failed: ${errorMessage}`,
    };
  }
}
