import 'server-only';

import nodemailer from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/server';
import { getOrderStatusEmail } from '@/lib/admin/email-templates';
import type { OrderEmailInput } from '@/lib/admin/email-templates';

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

  // Build template
  const template = getOrderStatusEmail(emailInput);
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
