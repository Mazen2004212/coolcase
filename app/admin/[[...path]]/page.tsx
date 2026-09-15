import { notFound } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const [section] = path;
  const valid = !section || (['orders', 'products', 'customers', 'coupons'].includes(section) ? path.length <= 2 : ['analytics', 'shipping', 'settings'].includes(section) && path.length === 1);
  if (!valid) notFound();
  return <AdminPage path={path} />;
}
