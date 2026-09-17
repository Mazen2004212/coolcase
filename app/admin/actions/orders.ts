'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getCustomer } from '@/lib/auth/user';
import { validateTransition, dbStatusToLabel, getStatusTimestampColumn } from '@/lib/orders/transitions';
import type { DbOrderStatus } from '@/lib/orders/transitions';
import { sendOrderStatusEmail } from '@/lib/orders/email';
import type { AdminOrderShipping } from '@/lib/admin/types';
import type { Database } from '@/lib/supabase/database.types';

// ─── Admin authorization ─────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ adminId: string }> {
  const demoMode = process.env.ADMIN_DEMO_MODE === 'true';
  if (demoMode) {
    return { adminId: '00000000-0000-0000-0000-000000000000' };
  }

  const customer = await getCustomer();
  if (!customer || customer.profile?.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return { adminId: customer.user.id };
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
  shippingAmount: number;
  governorate: string;
  cityArea: string;
  itemCount: number;
};

export type LiveOrderDetail = LiveOrderSummary & {
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
};

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
      id, order_number, created_at,
      customer_name, customer_email, customer_phone,
      status, payment_method, subtotal_amount, shipping_amount, total_amount,
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
    shippingAmount: row.shipping_amount,
    governorate: row.governorate,
    cityArea: row.city_area,
    itemCount: (row.order_items as { id: string }[])?.length ?? 0,
  }));
}

// ─── Fetch single order detail ────────────────────────────────────────────────

export async function fetchAdminOrder(id: string): Promise<LiveOrderDetail | null> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, created_at,
      customer_name, customer_email, customer_phone,
      status, payment_method,
      subtotal_amount, shipping_amount, total_amount,
      governorate, city_area, street_name, building_number,
      floor, apartment, landmark, delivery_notes,
      shipping_courier, shipping_tracking_number,
      shipping_current_location, shipping_notes,
      order_items (
        id, product_name_snapshot, product_image_snapshot,
        material, phone_model, network_type,
        quantity, unit_price, line_total,
        custom_design_upload_id
      ),
      order_status_history (
        id, status, previous_status,
        customer_visible_note, internal_note, created_at
      ),
      payments (
        id, method, status, expected_amount,
        verified_at, rejection_reason
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
  } : null;

  const { data: paymentsData } = await supabase
    .from('payments')
    .select('id, method, status, expected_amount, verified_at, rejection_reason')
    .eq('order_id', id)
    .maybeSingle();

  return {
    id: row.id,
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
    items,
    history,
    payment: paymentsData ? {
      id: paymentsData.id,
      method: paymentsData.method,
      status: paymentsData.status,
      expectedAmount: paymentsData.expected_amount,
      verifiedAt: paymentsData.verified_at,
      rejectionReason: paymentsData.rejection_reason,
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
    const { adminId } = await requireAdmin();
    const supabase = createAdminClient();

    // Load current order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, customer_name, customer_email, total_amount, payment_method, shipping_courier, shipping_tracking_number, shipping_current_location')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return { ok: false, error: 'Order not found.' };

    const currentStatus = order.status as DbOrderStatus;

    // Validate transition server-side
    validateTransition(currentStatus, newStatus);

    // Update order status — typed payload to satisfy strict Supabase types
    const timestampCol = getStatusTimestampColumn(newStatus);
    const now = new Date().toISOString();
    type OrderUpdate = Database['public']['Tables']['orders']['Update'];
    const updatePayload: OrderUpdate = { status: newStatus };
    if (timestampCol === 'confirmed_at') updatePayload.confirmed_at = now;
    else if (timestampCol === 'shipped_at') updatePayload.shipped_at = now;
    else if (timestampCol === 'delivered_at') updatePayload.delivered_at = now;
    else if (timestampCol === 'cancelled_at') updatePayload.cancelled_at = now;
    else if (timestampCol === 'rejected_at') updatePayload.rejected_at = now;

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateError) return { ok: false, error: updateError.message };

    // Insert status history
    const { error: historyError } = await supabase
      .from('order_status_history')
      .insert({
        order_id: orderId,
        status: newStatus,
        previous_status: currentStatus,
        changed_by: adminId === '00000000-0000-0000-0000-000000000000' ? null : adminId,
        customer_visible_note: options.customerVisibleNote?.trim() || null,
        internal_note: options.internalNote?.trim() || null,
      });

    if (historyError) {
      console.error('[admin/orders] history insert error:', historyError);
    }

    // Audit log
    await Promise.resolve(supabase.from('admin_audit_logs').insert({
      admin_id: adminId === '00000000-0000-0000-0000-000000000000' ? null : adminId,
      action: 'ORDER_STATUS_CHANGED',
      entity_type: 'orders',
      entity_id: orderId,
      metadata: { from: currentStatus, to: newStatus, with_email: options.sendEmail },
    })).catch(() => {/* non-critical */ });

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
        shippingInfo: ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(newStatus) ? {
          courier: order.shipping_courier ?? '',
          trackingNumber: order.shipping_tracking_number ?? '',
          currentLocation: order.shipping_current_location ?? '',
          shippingNotes: '', // never include in email
        } : undefined,
      };

      const result = await sendOrderStatusEmail(emailInput);
      emailResult = result.sent
        ? `Email sent to ${order.customer_email}.`
        : `Email not sent: ${result.message}`;
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
    const { adminId } = await requireAdmin();
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
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { adminId } = await requireAdmin();
    const supabase = createAdminClient();

    const now = new Date().toISOString();
    const adminDbId = adminId === '00000000-0000-0000-0000-000000000000' ? null : adminId;

    const { error } = await supabase
      .from('payments')
      .update({
        status: 'VERIFIED',
        verified_by: adminDbId,
        verified_at: now,
      })
      .eq('order_id', orderId);

    if (error) return { ok: false, error: error.message };

    await Promise.resolve(supabase.from('admin_audit_logs').insert({
      admin_id: adminDbId,
      action: 'PAYMENT_VERIFIED',
      entity_type: 'payments',
      metadata: { order_id: orderId },
    })).catch(() => {/* non-critical */ });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected error.' };
  }
}

// ─── Reject InstaPay payment ──────────────────────────────────────────────────

export async function rejectPayment(
  orderId: string,
  rejectionReason: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!rejectionReason?.trim()) {
      return { ok: false, error: 'Rejection reason is required.' };
    }

    const { adminId } = await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('payments')
      .update({
        status: 'REJECTED',
        rejection_reason: rejectionReason.trim(),
      })
      .eq('order_id', orderId);

    if (error) return { ok: false, error: error.message };

    await Promise.resolve(supabase.from('admin_audit_logs').insert({
      admin_id: adminId === '00000000-0000-0000-0000-000000000000' ? null : adminId,
      action: 'PAYMENT_REJECTED',
      entity_type: 'payments',
      metadata: { order_id: orderId, reason: rejectionReason },
    })).catch(() => {/* non-critical */ });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected error.' };
  }
}
