'use client';
import { Dashboard } from './dashboard';
import { ProductsList, ProductEditor } from './products';
import { OrdersList, OrderDetail } from './orders';
import { CustomersList, CustomerDetail } from './customers';
import { CouponsList, CouponEditor } from './coupons';
import { Shipping, Settings } from './settings';

export function AdminPage({ path }: { path: string[] }) {
  const [section, id] = path;
  if (section === 'products') return id ? <ProductEditor key={id} id={id} /> : <ProductsList />;
  if (section === 'orders') return id ? <OrderDetail key={id} id={id} /> : <OrdersList />;
  if (section === 'customers') return id ? <CustomerDetail key={id} id={id} /> : <CustomersList />;
  if (section === 'coupons') return id ? <CouponEditor key={id} id={id} /> : <CouponsList />;
  if (section === 'shipping') return <Shipping />;
  if (section === 'settings') return <Settings />;
  return <Dashboard analytics={section === 'analytics'} />;
}
