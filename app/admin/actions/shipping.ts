'use server';

import 'server-only';

import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission } from '@/lib/admin/permissions';
import type { DbOrderStatus } from '@/lib/orders/transitions';
import { createAdminClient } from '@/lib/supabase/server';

export type ShippingOrderGroup =
  | 'PENDING'
  | 'PREPARING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'EXCEPTION';

export type ShippingOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  governorate: string;
  cityArea: string;
  status: DbOrderStatus;
  createdAt: string;
  totalAmount: number;
};

export type ShippingOrdersResult = {
  orders: ShippingOrderRow[];
  canViewOrders: boolean;
  counts: Record<ShippingOrderGroup, number>;
};

const STATUS_GROUPS: Record<ShippingOrderGroup, DbOrderStatus[]> = {
  PENDING: ['PENDING_ADMIN_APPROVAL', 'PENDING_CONFIRMATION', 'CONFIRMED'],
  PREPARING: ['PREPARING'],
  SHIPPED: ['SHIPPED'],
  OUT_FOR_DELIVERY: ['OUT_FOR_DELIVERY'],
  DELIVERED: ['DELIVERED'],
  EXCEPTION: ['CANCELLED', 'REJECTED'],
};

export async function fetchShippingOrders(): Promise<ShippingOrdersResult> {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, 'shipping.manage')) {
    throw new Error('Unauthorized: missing shipping.manage');
  }

  const supabase = createAdminClient();
  const listQuery = supabase
    .from('orders')
    .select(
      'id, order_number, customer_name, governorate, city_area, status, created_at, total_amount',
    )
    .eq('is_test', false)
    .order('created_at', { ascending: false })
    .limit(200);

  const countQueries = Object.entries(STATUS_GROUPS).map(
    async ([group, statuses]) => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('is_test', false)
        .in('status', statuses);

      if (error) {
        throw new Error(`Failed to count ${group.toLowerCase()} orders: ${error.message}`);
      }

      return [group, count ?? 0] as const;
    },
  );

  const [{ data, error }, countEntries] = await Promise.all([
    listQuery,
    Promise.all(countQueries),
  ]);

  if (error) {
    throw new Error(`Failed to load shipping orders: ${error.message}`);
  }

  return {
    orders: (data ?? []).map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      governorate: order.governorate,
      cityArea: order.city_area,
      status: order.status as DbOrderStatus,
      createdAt: order.created_at,
      totalAmount: order.total_amount,
    })),
    canViewOrders: requirePermission(staff, 'orders.view'),
    counts: Object.fromEntries(countEntries) as Record<ShippingOrderGroup, number>,
  };
}
