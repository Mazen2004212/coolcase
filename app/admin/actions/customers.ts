'use server';

import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';

import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission } from '@/lib/admin/permissions';

const REVENUE_STATUSES = new Set([
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

async function requireAdmin(permission: string = 'customers.view') {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, permission)) {
    throw new Error(`Unauthorized: missing ${permission}`);
  }
  return staff;
}

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  since: string;
  totalOrders: number;
  totalSpent: number;
  averageOrder: number;
  lastOrder: string | null;
  addresses: string[];
};

export async function fetchAdminCustomers(): Promise<AdminCustomer[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, created_at, role')
    .eq('role', 'CUSTOMER')
    .order('created_at', { ascending: false });

  if (!profiles || profiles.length === 0) return [];

  const customerIds = profiles.map(p => p.id);

  // Fetch orders
  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_id, customer_email, customer_phone, customer_name, created_at, total_amount, status, is_test')
    .in('customer_id', customerIds);

  const customerMap = new Map<string, AdminCustomer>();

  for (const p of profiles) {
    customerMap.set(p.id, {
      id: p.id,
      name: p.full_name || 'Unknown',
      email: '', // filled from orders
      phone: '', // filled from orders
      since: p.created_at,
      totalOrders: 0,
      totalSpent: 0,
      averageOrder: 0,
      lastOrder: null,
      addresses: [],
    });
  }

  // Calculate metrics
  if (orders) {
    for (const o of orders) {
      if (!o.customer_id) continue;
      const c = customerMap.get(o.customer_id);
      if (!c) continue;

      if (!c.email && o.customer_email) c.email = o.customer_email;
      if (!c.phone && o.customer_phone) c.phone = o.customer_phone;
      if (c.name === 'Unknown' && o.customer_name) c.name = o.customer_name;
      
      if (!o.is_test && REVENUE_STATUSES.has(o.status)) {
        c.totalOrders++;
        c.totalSpent += o.total_amount || 0;
        if (!c.lastOrder || new Date(o.created_at) > new Date(c.lastOrder)) {
          c.lastOrder = o.created_at;
        }
      }
    }
  }

  // Fetch addresses
  const { data: addresses } = await supabase
    .from('addresses')
    .select('user_id, governorate, city_area, street_name, apartment, floor, building_number')
    .in('user_id', customerIds);
    
  if (addresses) {
    for (const a of addresses) {
      if (!a.user_id) continue;
      const c = customerMap.get(a.user_id);
      if (!c) continue;
      
      const parts = [
        a.apartment ? `Apt ${a.apartment}` : '',
        a.floor ? `Floor ${a.floor}` : '',
        a.building_number ? `Bldg ${a.building_number}` : '',
        a.street_name,
        a.city_area,
        a.governorate,
      ].filter(Boolean);
      
      c.addresses.push(parts.join(', '));
    }
  }

  return Array.from(customerMap.values()).map(c => ({
    ...c,
    averageOrder: c.totalOrders > 0 ? c.totalSpent / c.totalOrders : 0,
  }));
}

export async function fetchAdminCustomer(id: string): Promise<AdminCustomer | null> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, created_at, role')
    .eq('id', id)
    .single();

  if (!profile || profile.role !== 'CUSTOMER') return null;

  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_email, customer_phone, customer_name, created_at, total_amount, status, is_test')
    .eq('customer_id', id);

  let totalOrders = 0;
  let totalSpent = 0;
  let lastOrder: string | null = null;
  let email = '';
  let phone = '';
  let name = profile.full_name || 'Unknown';

  if (orders) {
    for (const o of orders) {
      if (!email && o.customer_email) email = o.customer_email;
      if (!phone && o.customer_phone) phone = o.customer_phone;
      if (name === 'Unknown' && o.customer_name) name = o.customer_name;
      if (!o.is_test && REVENUE_STATUSES.has(o.status)) {
        totalOrders++;
        totalSpent += o.total_amount || 0;
        if (!lastOrder || new Date(o.created_at) > new Date(lastOrder)) {
          lastOrder = o.created_at;
        }
      }
    }
  }

  const { data: addresses } = await supabase
    .from('addresses')
    .select('governorate, city_area, street_name, apartment, floor, building_number')
    .eq('user_id', id);
    
  const addressList = [];
  if (addresses) {
    for (const a of addresses) {
      const parts = [
        a.apartment ? `Apt ${a.apartment}` : '',
        a.floor ? `Floor ${a.floor}` : '',
        a.building_number ? `Bldg ${a.building_number}` : '',
        a.street_name,
        a.city_area,
        a.governorate,
      ].filter(Boolean);
      addressList.push(parts.join(', '));
    }
  }

  return {
    id: profile.id,
    name,
    email,
    phone,
    since: profile.created_at,
    totalOrders,
    totalSpent,
    averageOrder: totalOrders > 0 ? totalSpent / totalOrders : 0,
    lastOrder,
    addresses: addressList,
  };
}
