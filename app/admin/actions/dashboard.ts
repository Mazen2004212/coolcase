'use server';

import 'server-only';

import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission } from '@/lib/admin/permissions';
import {
  dbStatusToLabel,
  type DbOrderStatus,
} from '@/lib/orders/transitions';
import { createAdminClient } from '@/lib/supabase/server';

async function requireAdmin(permission: 'dashboard.view' | 'analytics.view') {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, permission)) {
    throw new Error(`Unauthorized: missing ${permission}`);
  }
  return staff;
}

function isDbOrderStatus(value: unknown): value is DbOrderStatus {
  return (
    typeof value === 'string' &&
    [
      'PENDING_ADMIN_APPROVAL',
      'PENDING_CONFIRMATION',
      'CONFIRMED',
      'PREPARING',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'REJECTED',
    ].includes(value)
  );
}

function isRevenueOrder(status: string): boolean {
  return [
    'CONFIRMED',
    'PREPARING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ].includes(status);
}

export type DashboardMetrics = {
  revenue: number;
  gross: number;
  discounts: number;
  shipping: number;
  validOrders: number;
  average: number;
  units: number;
};

export type ProductRanking = {
  id: string;
  name: string;
  images: Array<{
    src: string | null;
  }>;
  units: number;
  revenue: number;
};

export type DashboardOrderItem = {
  quantity: number;
};

export type DashboardRecentOrder = {
  id: string;
  orderNumber: string;
  date: string;
  customerName: string;
  status: DbOrderStatus;
  items: DashboardOrderItem[];
  totalAmount: number;
};

export type DashboardData = {
  start: string;
  end: string;
  period: string;
  metrics: DashboardMetrics;
  ranking: ProductRanking[];
  buckets: number[];
  orderCounts: Record<string, number>;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  activeProducts: number;
  activity: Array<{
    id: string;
    text: string;
    date: string;
  }>;
  materials: Array<{
    material: string;
    units: number;
    revenue: number;
  }>;
  recentOrders: DashboardRecentOrder[];
};

async function loadDashboardData(
  periodStr: string,
  customStart?: string,
  customEnd?: string,
): Promise<DashboardData> {
  const supabase = createAdminClient();

  const now = new Date();

  let start = '';
  const end =
    periodStr === 'Custom' && customEnd
      ? customEnd
      : now.toISOString().slice(0, 10);

  if (periodStr === 'Custom' && customStart && customEnd) {
    start = customStart;
  } else {
    const days =
      periodStr === 'Today'
        ? 1
        : periodStr === '7 days'
          ? 7
          : 30;

    const startDate = new Date(
      now.getTime() - (days - 1) * 86_400_000,
    );

    start = startDate.toISOString().slice(0, 10);
  }

  const startTimestamp = `${start}T00:00:00Z`;
  const endTimestamp = `${end}T23:59:59Z`;

  /*
   * Orders in selected reporting period.
   */
  const {
    data: periodOrders,
    error: ordersError,
  } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      status,
      subtotal_amount,
      discount_amount,
      shipping_amount,
      total_amount,
      customer_id,
      order_number,
      customer_name,
      order_items (
        id,
        product_id,
        product_name_snapshot,
        product_image_snapshot,
        quantity,
        unit_price,
        material
      )
    `)
    .gte('created_at', startTimestamp)
    .lte('created_at', endTimestamp)
    .eq('is_test', false)
    .order('created_at', {
      ascending: false,
    });

  if (ordersError) {
    console.error(
      '[admin dashboard] Failed to fetch orders:',
      ordersError,
    );

    throw new Error('Failed to load dashboard orders.');
  }

  const orders = periodOrders ?? [];

  /*
   * Store-wide counts.
   */
  const [
    customersResult,
    activeProductsResult,
    newCustomersResult,
    logsResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('role', 'CUSTOMER'),

    supabase
      .from('products')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('is_active', true),

    supabase
      .from('profiles')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('role', 'CUSTOMER')
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp),

    supabase
      .from('admin_audit_logs')
      .select(
        'id, action, created_at, metadata',
      )
      .order('created_at', {
        ascending: false,
      })
      .limit(12),
  ]);

  if (customersResult.error) {
    console.error(
      '[admin dashboard] Failed to count customers:',
      customersResult.error,
    );

    throw new Error('Failed to load customer count.');
  }

  if (activeProductsResult.error) {
    console.error(
      '[admin dashboard] Failed to count active products:',
      activeProductsResult.error,
    );

    throw new Error('Failed to load active product count.');
  }

  if (newCustomersResult.error) {
    console.error(
      '[admin dashboard] Failed to count new customers:',
      newCustomersResult.error,
    );

    throw new Error('Failed to load new customer count.');
  }

  if (logsResult.error) {
    console.error(
      '[admin dashboard] Failed to fetch audit logs:',
      logsResult.error,
    );

    throw new Error('Failed to load admin activity.');
  }

  const totalCustomers =
    customersResult.count ?? 0;

  const activeProducts =
    activeProductsResult.count ?? 0;

  const newCustomers =
    newCustomersResult.count ?? 0;

  /*
   * Admin activity.
   */
  const activity = (logsResult.data ?? []).map(log => {
    let text = log.action;

    if (log.action === 'ORDER_STATUS_CHANGED') {
      const metadata =
        log.metadata &&
          typeof log.metadata === 'object' &&
          !Array.isArray(log.metadata)
          ? (log.metadata as Record<
            string,
            unknown
          >)
          : null;

      const from = metadata?.from;
      const to = metadata?.to;

      if (
        isDbOrderStatus(from) &&
        isDbOrderStatus(to)
      ) {
        text =
          `Order status changed from ` +
          `${dbStatusToLabel(from)} to ` +
          `${dbStatusToLabel(to)}`;
      }
    }

    return {
      id: log.id,
      text,
      date: log.created_at,
    };
  });

  /*
   * Revenue calculations.
   *
   * CANCELLED and REJECTED orders never contribute
   * to sales/revenue metrics.
   */
  const validOrders = orders.filter(order =>
    isRevenueOrder(order.status),
  );

  const gross = validOrders.reduce(
    (sum, order) =>
      sum + (order.subtotal_amount ?? 0),
    0,
  );

  const discounts = validOrders.reduce(
    (sum, order) =>
      sum + (order.discount_amount ?? 0),
    0,
  );

  const shipping = validOrders.reduce(
    (sum, order) =>
      sum + (order.shipping_amount ?? 0),
    0,
  );

  const revenue =
    gross - discounts + shipping;

  const units = validOrders.reduce(
    (orderTotal, order) =>
      orderTotal +
      (order.order_items ?? []).reduce(
        (itemTotal, item) =>
          itemTotal + item.quantity,
        0,
      ),
    0,
  );

  const metrics: DashboardMetrics = {
    revenue,
    gross,
    discounts,
    shipping,
    validOrders: validOrders.length,
    average:
      validOrders.length > 0
        ? revenue / validOrders.length
        : 0,
    units,
  };

  /*
   * Status counts.
   */
  const orderCounts: Record<
    string,
    number
  > = {};

  for (const order of orders) {
    if (!isDbOrderStatus(order.status)) {
      continue;
    }

    const label =
      dbStatusToLabel(order.status);

    orderCounts[label] =
      (orderCounts[label] ?? 0) + 1;
  }

  /*
   * Product performance.
   */
  const productStats: Record<
    string,
    {
      id: string;
      name: string;
      image: string | null;
      units: number;
      revenue: number;
    }
  > = {};

  for (const order of validOrders) {
    for (const item of order.order_items ?? []) {
      if (!item.product_id) {
        continue;
      }

      if (!productStats[item.product_id]) {
        productStats[item.product_id] = {
          id: item.product_id,
          name:
            item.product_name_snapshot,
          image:
            item.product_image_snapshot,
          units: 0,
          revenue: 0,
        };
      }

      productStats[item.product_id].units +=
        item.quantity;

      productStats[
        item.product_id
      ].revenue +=
        item.quantity * item.unit_price;
    }
  }

  const ranking: ProductRanking[] =
    Object.values(productStats)
      .sort(
        (a, b) => b.units - a.units,
      )
      .map(product => ({
        id: product.id,
        name: product.name,
        images: [
          {
            src: product.image,
          },
        ],
        units: product.units,
        revenue: product.revenue,
      }));

  /*
   * Material performance.
   */
  const materialStats: Record<
    string,
    {
      units: number;
      revenue: number;
    }
  > = {};

  for (const order of validOrders) {
    for (const item of order.order_items ?? []) {
      const material =
        item.material ?? 'UNKNOWN';

      if (!materialStats[material]) {
        materialStats[material] = {
          units: 0,
          revenue: 0,
        };
      }

      materialStats[material].units +=
        item.quantity;

      materialStats[
        material
      ].revenue +=
        item.quantity * item.unit_price;
    }
  }

  const materials = Object.entries(
    materialStats,
  ).map(([material, stats]) => ({
    material,
    units: stats.units,
    revenue: stats.revenue,
  }));

  /*
   * Chart buckets.
   */
  const startMs = Date.parse(
    `${start}T00:00:00Z`,
  );

  const endMs = Date.parse(
    `${end}T23:59:59Z`,
  );

  const reportingDays = Math.max(
    1,
    Math.round(
      (endMs - startMs) /
      86_400_000,
    ) + 1,
  );

  const bucketCount =
    periodStr === 'Today'
      ? 8
      : Math.min(30, reportingDays);

  const duration = Math.max(
    86_400_000,
    endMs - startMs,
  );

  const buckets = Array.from(
    {
      length: bucketCount,
    },
    () => 0,
  );

  for (const order of validOrders) {
    const orderTime = Date.parse(
      order.created_at,
    );

    if (
      orderTime < startMs ||
      orderTime > endMs
    ) {
      continue;
    }

    let bucketIndex = Math.floor(
      (orderTime - startMs) /
      (duration / bucketCount),
    );

    if (bucketIndex >= bucketCount) {
      bucketIndex = bucketCount - 1;
    }

    if (bucketIndex < 0) {
      bucketIndex = 0;
    }

    buckets[bucketIndex] +=
      order.total_amount ?? 0;
  }

  /*
   * Returning purchasers:
   * registered customers who purchased in this
   * selected period and already had a valid order
   * before the period began.
   */
  const currentPurchaserIds = Array.from(
    new Set(
      validOrders
        .map(order => order.customer_id)
        .filter(
          (id): id is string =>
            typeof id === 'string',
        ),
    ),
  );

  let returningCustomers = 0;

  if (currentPurchaserIds.length > 0) {
    const {
      data: previousOrders,
      error: previousOrdersError,
    } = await supabase
      .from('orders')
      .select('customer_id, status')
      .in(
        'customer_id',
        currentPurchaserIds,
      )
      .lt('created_at', startTimestamp)
      .eq('is_test', false);

    if (previousOrdersError) {
      console.error(
        '[admin dashboard] Failed to fetch previous customer orders:',
        previousOrdersError,
      );

      throw new Error(
        'Failed to calculate returning customers.',
      );
    }

    const returningCustomerIds =
      new Set(
        (previousOrders ?? [])
          .filter(order =>
            isRevenueOrder(order.status),
          )
          .map(order => order.customer_id)
          .filter(
            (id): id is string =>
              typeof id === 'string',
          ),
      );

    returningCustomers =
      returningCustomerIds.size;
  }

  /*
   * Recent orders.
   */
  const recentOrders: DashboardRecentOrder[] =
    orders
      .slice(0, 6)
      .filter(order =>
        isDbOrderStatus(order.status),
      )
      .map(order => ({
        id: order.id,
        orderNumber:
          order.order_number,
        date: order.created_at,
        customerName:
          order.customer_name,
        status:
          order.status as DbOrderStatus,
        items: (
          order.order_items ?? []
        ).map(item => ({
          quantity: item.quantity,
        })),
        totalAmount:
          order.total_amount ?? 0,
      }));

  return {
    start,
    end,
    period: periodStr,

    metrics,

    ranking,
    buckets,
    orderCounts,

    totalCustomers,
    newCustomers,
    returningCustomers,

    completedOrders:
      orderCounts.Delivered ?? 0,

    pendingOrders:
      (orderCounts[
        'Pending Approval'
      ] ?? 0),

    cancelledOrders:
      (orderCounts.Cancelled ?? 0) +
      (orderCounts.Rejected ?? 0),

    activeProducts,

    activity,
    materials,
    recentOrders,
  };
}

export async function fetchDashboardData(
  periodStr: string,
  customStart?: string,
  customEnd?: string,
): Promise<DashboardData> {
  await requireAdmin('dashboard.view');
  return loadDashboardData(periodStr, customStart, customEnd);
}

export async function fetchAnalyticsData(
  periodStr: string,
  customStart?: string,
  customEnd?: string,
): Promise<DashboardData> {
  await requireAdmin('analytics.view');
  return loadDashboardData(periodStr, customStart, customEnd);
}
