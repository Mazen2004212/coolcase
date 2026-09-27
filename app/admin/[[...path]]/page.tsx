import { getStoreSettings } from '@/lib/catalog/queries';
import { notFound } from 'next/navigation';
import { ProductsListLive, ProductEditorLive, type LiveProduct, type LiveCategory } from '@/components/admin/products-live';
import { fetchAdminProducts, fetchAdminProduct, fetchCategories } from '@/app/admin/actions/products';
import { OrdersListLive, OrderDetailLive } from '@/components/admin/orders-live';
import { fetchAdminOrders, fetchAdminOrder } from '@/app/admin/actions/orders';
import { CustomersListLive, CustomerDetailLive } from '@/components/admin/customers-live';
import { DashboardLive } from '@/components/admin/dashboard-live';
import { SettingsLive, ShippingLive } from '@/components/admin/settings-live';
import { CouponsListLive, CouponEditorLive } from '@/components/admin/coupons-live';
import {
  fetchCoupon,
  fetchCouponCustomers,
  fetchCoupons,
} from '@/app/admin/actions/coupons';
import { EmployeesLive } from '@/components/admin/employees-live';
import { CustomCaseTemplateEditorLive, CustomCaseTemplatesLive } from '@/components/admin/custom-cases-live';
import { fetchAdminCustomCaseTemplate, fetchAdminCustomCaseTemplates } from '@/app/admin/actions/custom-cases';
import type { NamedCaseTemplate } from '@/lib/custom-cases/templates';
import { CollectionEditorLive, CollectionsListLive, type AdminCollection, type CollectionProductOption } from '@/components/admin/collections-live';
import { fetchAdminCollection, fetchAdminCollections, fetchCollectionProductOptions } from '@/app/admin/actions/collections';

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const [section, id] = path;

  const valid =
    !section ||
    (['orders', 'products', 'collections', 'custom-cases', 'customers', 'coupons'].includes(section)
      ? path.length <= 2
      : ['analytics', 'shipping', 'settings', 'employees'].includes(section) && path.length === 1);

  if (!valid) notFound();

  // ── Products
  if (section === 'products') {
    const categories = await fetchCategories();
    const pricingSettings = id ? await getStoreSettings() : undefined;
    if (id === 'new') return <ProductEditorLive pricingSettings={pricingSettings!} id="new" product={null} categories={categories} />;
    if (id) {
      const product = await fetchAdminProduct(id);
      if (!product) notFound();
      return <ProductEditorLive pricingSettings={pricingSettings!} id={id} product={product as unknown as LiveProduct} categories={categories as LiveCategory[]} />;
    }
    const products = await fetchAdminProducts();
    return <ProductsListLive products={products as unknown as LiveProduct[]} />;
  }

  if (section === 'collections') {
    if (id === 'new') return <CollectionEditorLive collection={null} products={await fetchCollectionProductOptions() as CollectionProductOption[]} />;
    if (id) {
      const [collection, products] = await Promise.all([fetchAdminCollection(id), fetchCollectionProductOptions()]);
      if (!collection) notFound();
      return <CollectionEditorLive collection={collection as AdminCollection} products={products as CollectionProductOption[]} />;
    }
    return <CollectionsListLive collections={await fetchAdminCollections() as AdminCollection[]} />;
  }

  // ── Orders
  if (section === 'orders') {
    if (id) {
      const order = await fetchAdminOrder(id);
      if (!order) notFound();
      return <OrderDetailLive order={order} />;
    }
    const orders = await fetchAdminOrders();
    return <OrdersListLive orders={orders} />;
  }

  if (section === 'custom-cases') {
    if (id === 'new') return <CustomCaseTemplateEditorLive template={null} />;
    if (id) { const template = await fetchAdminCustomCaseTemplate(id); if (!template) notFound(); return <CustomCaseTemplateEditorLive template={template as NamedCaseTemplate} />; }
    return <CustomCaseTemplatesLive templates={await fetchAdminCustomCaseTemplates() as NamedCaseTemplate[]} />;
  }

  // ── Customers
  if (section === 'customers') {
    if (id) return <CustomerDetailLive id={id} />;
    return <CustomersListLive />;
  }

  // ── Dashboard & Analytics
  if (!section || section === 'dashboard') return <DashboardLive />;
  if (section === 'analytics') return <DashboardLive analytics={true} />;

  // ── Settings, Shipping & Employees
  if (section === 'settings') return <SettingsLive />;
  if (section === 'shipping') return <ShippingLive />;
  if (section === 'employees') return <EmployeesLive />;

  // ── Coupons
  if (section === 'coupons') {
    if (id) {
      const customers = await fetchCouponCustomers();

      if (id === 'new') {
        return (
          <CouponEditorLive
            id="new"
            coupon={null}
            customers={customers}
          />
        );
      }

      const coupon = await fetchCoupon(id);

      if (!coupon) {
        notFound();
      }

      return (
        <CouponEditorLive
          id={id}
          coupon={coupon}
          customers={customers}
        />
      );
    }

    const coupons = await fetchCoupons();

    return (
      <CouponsListLive coupons={coupons} />
    );
  }

  notFound();
}
