'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { dbStatusToLabel } from '@/lib/orders/transitions';
import type { DbOrderStatus } from '@/lib/orders/transitions';
import { sendOrderStatusEmail } from '@/lib/orders/email';
import type { AdminOrderShipping } from '@/lib/admin/types';
import type { Database } from '@/lib/supabase/database.types';

// ─── Admin authorization ─────────────────────────────────────────────────────

import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission } from '@/lib/admin/permissions';

async function requireAdmin(permission: string = 'orders.view'): Promise<{ adminId: string; canManageOrders: boolean }> {
  const staff = await getStaffProfile();
  if (!staff || !requirePermission(staff, permission)) {
    throw new Error(`Unauthorized: missing ${permission}`);
  }
  return {
    adminId: staff.userId,
    canManageOrders: requirePermission(staff, 'orders.manage'),
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type LiveOrderSummary = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: DbOrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  governorate: string;
  cityArea: string;
  itemCount: number;
  isTest: boolean;
};

export type LiveOrderDetail = LiveOrderSummary & {
  canManageOrders: boolean;
  streetName: string;
  buildingNumber: string;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  deliveryNotes: string | null;
  shippingCourier: string;
  shippingTrackingNumber: string;
  shippingCurrentLocation: string;
  shippingNotes: string; // ADMIN-ONLY
  couponCodeSnapshot: string | null;
  items: LiveOrderItem[];
  history: LiveOrderHistoryEvent[];
  payment: LivePayment | null;
};

export type LiveOrderItem = {
  id: string;
  productNameSnapshot: string;
  productImageSnapshot: string | null;
  material: string;
  phoneModel: string;
  networkType: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  hasCustomDesign: boolean;
  customDesignUrl: string | null;
  customizationType: string | null;
  customizationSnapshot: Record<string, unknown> | null;
};

export type LiveOrderHistoryEvent = {
  id: string;
  status: string;
  previousStatus: string | null;
  customerVisibleNote: string | null;
  internalNote: string | null; // Only returned to admin
  createdAt: string;
};

export type LivePayment = {
  id: string;
  method: string;
  status: string;
  expectedAmount: number;
  verifiedAt: string | null;
  rejectionReason: string | null;
  verificationSource: string | null;
  proof: {
    uploadId: string;
    signedUrl: string;
    originalFilename: string | null;
    mimeType: string;
    fileSize: number;
    uploadedAt: string;
  } | null;
};

const orderIdSchema = z.string().uuid();
const transitionStatusSchema = z.enum([
  'PENDING_ADMIN_APPROVAL', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING',
  'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED',
]);
const transitionResultSchema = z.object({
  order_id: z.string().uuid(),
  order_number: z.string().min(1),
  status: transitionStatusSchema,
  customer_name: z.string(),
  customer_email: z.string().nullable(),
  total_amount: z.number().nonnegative(),
  payment_method: z.enum(['INSTAPAY', 'CASH_ON_DELIVERY']),
  shipping_courier: z.string().nullable(),
  shipping_tracking_number: z.string().nullable(),
  shipping_current_location: z.string().nullable(),
});
const paymentReviewResultSchema = z.object({
  payment_id: z.string().uuid(),
  order_id: z.string().uuid(),
  status: z.enum(['VERIFIED', 'REJECTED']),
  proof_upload_id: z.string().uuid(),
  verification_source: z.string().nullable(),
});

// ─── Fetch orders list ────────────────────────────────────────────────────────

export async function fetchAdminOrders(filters?: {
  status?: string;
  search?: string;
}): Promise<LiveOrderSummary[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  let query = supabase
    .from('orders')
    .select(`
      id, order_number, created_at, is_test,
      customer_name, customer_email, customer_phone,
      status, payment_method, subtotal_amount, discount_amount, shipping_amount, total_amount,
      governorate, city_area,
      payments ( status ),
      order_items ( id )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters?.status) {
    query = query.eq('status', filters.status as Database['public']['Enums']['order_status']);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchAdminOrders: ${error.message}`);

  return (data ?? []).map(row => ({
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    status: row.status as DbOrderStatus,
    paymentMethod: row.payment_method,
    paymentStatus: ((row.payments as unknown as { status: string } | null)?.status ?? 'UNKNOWN'),
    totalAmount: row.total_amount,
    subtotalAmount: row.subtotal_amount,
    discountAmount: row.discount_amount ?? 0,
    shippingAmount: row.shipping_amount,
    governorate: row.governorate,
    cityArea: row.city_area,
    itemCount: (row.order_items as { id: string }[])?.length ?? 0,
    isTest: row.is_test,
  }));
}

// ─── Fetch single order detail ────────────────────────────────────────────────

export async function fetchAdminOrder(id: string): Promise<LiveOrderDetail | null> {
  const { canManageOrders } = await requireAdmin();
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, created_at, is_test,
      customer_name, customer_email, customer_phone,
      status, payment_method,
      subtotal_amount, discount_amount, coupon_code_snapshot, shipping_amount, total_amount,
      governorate, city_area, street_name, building_number,
      floor, apartment, landmark, delivery_notes,
      shipping_courier, shipping_tracking_number,
      shipping_current_location, shipping_notes,
      order_items (
        id, product_name_snapshot, product_image_snapshot,
        material, phone_model, network_type,
        quantity, unit_price, line_total,
        custom_design_upload_id, customization_type, customization_snapshot
      ),
      order_status_history (
        id, status, previous_status,
        customer_visible_note, internal_note, created_at
      ),
      payments (
        id, method, status, expected_amount,
        verified_at, rejection_reason, verification_source,
        payment_proof_upload_id
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !row) return null;

  const rawItems = (
    (row.order_items ?? []) as Record<string, unknown>[]
  );

  const customUploadIds = [
    ...new Set(
      rawItems
        .map(
          item =>
            item.custom_design_upload_id as string | null
        )
        .filter(
          (id): id is string => Boolean(id)
        )
    ),
  ];

  const customDesignUrlByUploadId =
    new Map<string, string>();

  if (customUploadIds.length > 0) {
    const { data: uploads } = await supabase
      .from('customer_uploads')
      .select('id, storage_path')
      .in('id', customUploadIds);

    await Promise.all(
      (uploads ?? []).map(async upload => {
        const {
          data: signedData,
          error: signedError,
        } = await supabase.storage
          .from('custom-designs')
          .createSignedUrl(
            upload.storage_path,
            600
          );

        if (
          !signedError &&
          signedData?.signedUrl
        ) {
          customDesignUrlByUploadId.set(
            upload.id,
            signedData.signedUrl
          );
        }
      })
    );
  }

  const items: LiveOrderItem[] =
    rawItems.map(item => {
      const customDesignUploadId =
        item.custom_design_upload_id as
        | string
        | null;

      return {
        id:
          item.id as string,

        productNameSnapshot:
          item.product_name_snapshot as string,

        productImageSnapshot:
          item.product_image_snapshot as
          | string
          | null,

        material:
          item.material as string,

        phoneModel:
          item.phone_model as string,

        networkType:
          item.network_type as string,

        quantity:
          item.quantity as number,

        unitPrice:
          item.unit_price as number,

        lineTotal:
          item.line_total as number,

        hasCustomDesign:
          Boolean(customDesignUploadId),

        customDesignUrl:
          customDesignUploadId
            ? customDesignUrlByUploadId.get(
              customDesignUploadId
            ) ?? null
            : null,
        customizationType: item.customization_type as string | null,
        customizationSnapshot: item.customization_snapshot && typeof item.customization_snapshot === 'object' && !Array.isArray(item.customization_snapshot) ? item.customization_snapshot as Record<string, unknown> : null,
      };
    });

  const history: LiveOrderHistoryEvent[] = (
    (row.order_status_history ?? []) as Record<string, unknown>[]
  )
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(h => ({
      id: h.id as string,
      status: h.status as string,
      previousStatus: h.previous_status as string | null,
      customerVisibleNote: h.customer_visible_note as string | null,
      internalNote: h.internal_note as string | null,
      createdAt: h.created_at as string,
    }));

  const paymentRow = ((row.payments ?? []) as Record<string, unknown>[])[0] ?? null;
  const payment: LivePayment | null = paymentRow ? {
    id: paymentRow.id as string,
    method: paymentRow.method as string,
    status: paymentRow.status as string,
    expectedAmount: paymentRow.expected_amount as number,
    verifiedAt: paymentRow.verified_at as string | null,
    rejectionReason: paymentRow.rejection_reason as string | null,
    verificationSource: paymentRow.verification_source as string | null,
    proof: null,
  } : null;

  const { data: paymentsData } = await supabase
    .from('payments')
    .select('id, method, status, expected_amount, verified_at, rejection_reason, verification_source, payment_proof_upload_id')
    .eq('order_id', id)
    .maybeSingle();

  let proof: LivePayment['proof'] = null;
  if (paymentsData?.payment_proof_upload_id) {
    const { data: upload } = await supabase
      .from('customer_uploads')
      .select('id, storage_path, original_filename, mime_type, file_size_bytes, created_at')
      .eq('id', paymentsData.payment_proof_upload_id)
      .eq('upload_type', 'PAYMENT_PROOF')
      .maybeSingle();

    if (upload?.mime_type && upload.file_size_bytes) {
      const { data: signed } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(upload.storage_path, 300);

      if (signed?.signedUrl) {
        proof = {
          uploadId: upload.id,
          signedUrl: signed.signedUrl,
          originalFilename: upload.original_filename,
          mimeType: upload.mime_type,
          fileSize: upload.file_size_bytes,
          uploadedAt: upload.created_at,
        };
      }
    }
  }

  return {
    id: row.id,
    canManageOrders,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    status: row.status as DbOrderStatus,
    paymentMethod: row.payment_method,
    paymentStatus: paymentsData?.status ?? payment?.status ?? 'UNKNOWN',
    totalAmount: row.total_amount,
    subtotalAmount: row.subtotal_amount,
    discountAmount: row.discount_amount ?? 0,
    couponCodeSnapshot: row.coupon_code_snapshot ?? null,
    shippingAmount: row.shipping_amount,
    governorate: row.governorate,
    cityArea: row.city_area,
    streetName: row.street_name,
    buildingNumber: row.building_number,
    floor: row.floor,
    apartment: row.apartment,
    landmark: row.landmark,
    deliveryNotes: row.delivery_notes,
    shippingCourier: row.shipping_courier ?? '',
    shippingTrackingNumber: row.shipping_tracking_number ?? '',
    shippingCurrentLocation: row.shipping_current_location ?? '',
    shippingNotes: row.shipping_notes ?? '', // admin-only
    itemCount: items.length,
    isTest: row.is_test,
    items,
    history,
    payment: paymentsData ? {
      id: paymentsData.id,
      method: paymentsData.method,
      status: paymentsData.status,
      expectedAmount: paymentsData.expected_amount,
      verifiedAt: paymentsData.verified_at,
      rejectionReason: paymentsData.rejection_reason,
      verificationSource: paymentsData.verification_source,
      proof,
    } : payment,
  };
}

// ─── Update order status ──────────────────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  newStatus: DbOrderStatus,
  options: {
    sendEmail: boolean;
    customerVisibleNote?: string;
    internalNote?: string;
  }
): Promise<{ ok: boolean; error?: string; emailResult?: string }> {
  try {
    await requireAdmin('orders.manage');
    const parsedOrderId = orderIdSchema.parse(orderId);
    const parsedStatus = transitionStatusSchema.parse(newStatus);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('transition_order_status', {
      p_order_id: parsedOrderId,
      p_new_status: parsedStatus,
      p_customer_visible_note: options.customerVisibleNote?.trim() || undefined,
      p_internal_note: options.internalNote?.trim() || undefined,
      p_send_email: options.sendEmail,
    });
    if (error) return { ok: false, error: error.message };

    const parsed = transitionResultSchema.safeParse(data);
    if (!parsed.success) return { ok: false, error: 'Order updated, but the result could not be read.' };
    const order = parsed.data;

    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${orderId}`);

    // Send email if requested
    let emailResult: string | undefined;
    if (options.sendEmail && order.customer_email) {
      const emailInput = {
        orderId,
        recipientEmail: order.customer_email,
        status: dbStatusToLabel(newStatus) as Parameters<typeof sendOrderStatusEmail>[0]['status'],
        customerName: order.customer_name,
        orderReference: order.order_number,
        total: order.total_amount,
        paymentMethod: order.payment_method === 'INSTAPAY' ? 'InstaPay' as const : 'COD' as const,
        customerVisibleNote: options.customerVisibleNote?.trim() || undefined,
        shippingInfo: ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(newStatus) ? {
          courier: order.shipping_courier ?? '',
          trackingNumber: order.shipping_tracking_number ?? '',
          currentLocation: order.shipping_current_location ?? '',
          shippingNotes: '', // never include in email
        } : undefined,
      };

      try {
        const result = await sendOrderStatusEmail(emailInput);
        emailResult = result.sent
          ? `Email sent to ${order.customer_email}.`
          : `Status updated. Email not sent: ${result.message}`;
      } catch (emailError) {
        console.error('[admin/orders] status email failed after transition:', emailError);
        emailResult = 'Status updated. Email could not be sent.';
      }
    }

    return { ok: true, emailResult };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected error.' };
  }
}

// ─── Save shipping info ────────────────────────────────────────────────────────

export async function saveShippingInfo(
  orderId: string,
  shipping: AdminOrderShipping
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { adminId } = await requireAdmin('orders.manage');
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('orders')
      .update({
        shipping_courier: shipping.courier.trim(),
        shipping_tracking_number: shipping.trackingNumber.trim(),
        shipping_current_location: shipping.currentLocation.trim(),
        shipping_notes: shipping.shippingNotes.trim(), // admin-only
      })
      .eq('id', orderId);

    if (error) return { ok: false, error: error.message };

    // Audit log
    await Promise.resolve(supabase.from('admin_audit_logs').insert({
      admin_id: adminId === '00000000-0000-0000-0000-000000000000' ? null : adminId,
      action: 'SHIPPING_INFO_UPDATED',
      entity_type: 'orders',
      entity_id: orderId,
      metadata: { courier: shipping.courier, tracking: shipping.trackingNumber },
    })).catch(() => {/* non-critical */ });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected error.' };
  }
}

// ─── Verify InstaPay payment ──────────────────────────────────────────────────

export async function verifyPayment(
  orderId: string,
  expectedProofUploadId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin('orders.manage');
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('review_payment_proof', {
      p_order_id: orderIdSchema.parse(orderId),
      p_expected_proof_upload_id: z.string().uuid().parse(expectedProofUploadId),
      p_decision: 'VERIFIED',
    });
    if (error) return { ok: false, error: error.message };
    if (!paymentReviewResultSchema.safeParse(data).success) {
      return { ok: false, error: 'Payment updated, but the result could not be read.' };
    }

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected error.' };
  }
}

// ─── Reject InstaPay payment ──────────────────────────────────────────────────

export async function rejectPayment(
  orderId: string,
  expectedProofUploadId: string,
  rejectionReason: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!rejectionReason?.trim()) {
      return { ok: false, error: 'Rejection reason is required.' };
    }

    await requireAdmin('orders.manage');
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('review_payment_proof', {
      p_order_id: orderIdSchema.parse(orderId),
      p_expected_proof_upload_id: z.string().uuid().parse(expectedProofUploadId),
      p_decision: 'REJECTED',
      p_rejection_reason: rejectionReason.trim(),
    });
    if (error) return { ok: false, error: error.message };
    if (!paymentReviewResultSchema.safeParse(data).success) {
      return { ok: false, error: 'Payment updated, but the result could not be read.' };
    }

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected error.' };
  }
}
