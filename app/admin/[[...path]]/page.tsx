import { notFound } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { ProductsListLive, ProductEditorLive, type LiveProduct, type LiveCategory } from '@/components/admin/products-live';
import { fetchAdminProducts, fetchAdminProduct, fetchCategories } from '@/app/admin/actions/products';
import { OrdersListLive, OrderDetailLive } from '@/components/admin/orders-live';
import { fetchAdminOrders, fetchAdminOrder } from '@/app/admin/actions/orders';

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const [section, id] = path;

  const valid =
    !section ||
    (['orders', 'products', 'customers', 'coupons'].includes(section)
      ? path.length <= 2
      : ['analytics', 'shipping', 'settings'].includes(section) && path.length === 1);

  if (!valid) notFound();

  // ── Products: server-fetched from Supabase ────────────────────────────────
  if (section === 'products') {
    const categories = await fetchCategories();

    if (id === 'new') {
      return <ProductEditorLive id="new" product={null} categories={categories} />;
    }

    if (id) {
      const product = await fetchAdminProduct(id);
      if (!product) notFound();
      return <ProductEditorLive id={id} product={product as unknown as LiveProduct} categories={categories as LiveCategory[]} />;
    }

    const products = await fetchAdminProducts();
    return <ProductsListLive products={products as unknown as LiveProduct[]} />;
  }

  // ── Orders: server-fetched from Supabase ──────────────────────────────────
  if (section === 'orders') {
    if (id) {
      const order = await fetchAdminOrder(id);
      if (!order) notFound();
      return <OrderDetailLive order={order} />;
    }
    const orders = await fetchAdminOrders();
    return <OrdersListLive orders={orders} />;
  }

  // ── All other sections: existing demo-backed UI ───────────────────────────
  return <AdminPage path={path} />;
}
