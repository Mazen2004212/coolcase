import type { StaffProfile } from './types';
export const adminSections = ['Dashboard', 'Orders', 'Products', 'Collections', 'Custom Cases', 'Customers', 'Coupons', 'Analytics', 'Shipping', 'Settings', 'Employees'] as const;

export function requirePermission(staff: StaffProfile | null, permission: string): boolean {
  if (!staff || !staff.isActive) return false;
  if (staff.role === 'OWNER') return true;
  return staff.permissions.includes(permission);
}

export const ALL_PERMISSIONS = [
  'dashboard.view', 'orders.view', 'orders.manage', 'products.view', 'products.manage',
  'customers.view', 'customers.manage', 'coupons.view', 'coupons.manage',
  'analytics.view', 'shipping.manage', 'settings.manage', 'employees.manage'
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export function canVisit(staff: StaffProfile | null, section: string) {
  if (!staff || !staff.isActive) return false;
  if (staff.role === 'OWNER') return true;
  
  const sectionKey = section.toLowerCase().replaceAll('-', ' ');
  if (sectionKey === 'dashboard') return requirePermission(staff, 'dashboard.view');
  if (sectionKey === 'orders') return requirePermission(staff, 'orders.view');
  if (sectionKey === 'products') return requirePermission(staff, 'products.view');
  if (sectionKey === 'collections') return requirePermission(staff, 'products.view');
  if (sectionKey === 'custom cases') return requirePermission(staff, 'products.view');
  if (sectionKey === 'customers') return requirePermission(staff, 'customers.view');
  if (sectionKey === 'coupons') return requirePermission(staff, 'coupons.view');
  if (sectionKey === 'analytics') return requirePermission(staff, 'analytics.view');
  if (sectionKey === 'shipping') return requirePermission(staff, 'shipping.manage');
  if (sectionKey === 'settings') return requirePermission(staff, 'settings.manage');
  if (sectionKey === 'employees') return requirePermission(staff, 'employees.manage');
  
  return false;
}
