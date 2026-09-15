import type { AdminRole } from './types';
export const adminSections = ['Dashboard', 'Orders', 'Products', 'Customers', 'Coupons', 'Analytics', 'Shipping', 'Settings'] as const;
export function canVisit(role: AdminRole, section: string) {
  if (role === 'Owner') return true;
  if (role === 'Manager') return ['Dashboard', 'Products', 'Orders', 'Customers', 'Coupons', 'Analytics'].includes(section);
  return section === 'Orders';
}
