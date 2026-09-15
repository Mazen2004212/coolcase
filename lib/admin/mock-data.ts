import { products } from '@/lib/data/products';
import { defaultMaterialPricing, materialIds, phoneModels } from '@/lib/data/product-options';
import { orderStatuses, type AdminOrderShipping, type AdminState } from './types';

// Isolated demonstration fixtures. Never import this module into the storefront.
export const DEMO_TODAY = '2026-09-15';

const emptyShipping: AdminOrderShipping = { courier: '', trackingNumber: '', currentLocation: '', shippingNotes: '' };

export function createAdminDemo(): AdminState {
  const customers: AdminState['customers'] = ['Nour Hassan', 'Omar Ahmed', 'Salma Ali', 'Youssef Adel', 'Farida Khaled', 'Adam Mostafa'].map((name, i) => ({ id: `demo-customer-${i + 1}`, name, email: `customer${i + 1}@example.com`, phone: `0100000000${i}`, since: `2026-08-0${i + 1}`, addresses: [`${12 + i} Demo Street, ${i % 2 ? 'Dokki, Giza' : 'Nasr City, Cairo'}`] }));
  const catalog: AdminState['products'] = products.map((p, i) => ({ id: p.id, name: p.name, slug: p.slug, shortDescription: p.description, description: p.description, collection: p.category, category: 'Phone Cases', regularPrice: 230, salePrice: 180, saleEnabled: true, saleStarts: '', saleEnds: '', status: i === 4 ? 'Draft' : 'Active', materials: [...materialIds], materialPricing: structuredClone(defaultMaterialPricing), models: { iPhone: [...phoneModels.iPhone], Samsung: [...phoneModels.Samsung] }, featured: i < 2, isNew: i === 2, bestSeller: i === 0, images: p.images.slice(0, 1).map((image, j) => ({ id: `${p.id}-${j}`, src: image.src, alt: image.alt, group: 'General Gallery' as const })), updatedAt: `${DEMO_TODAY}T10:00:00Z` }));
  const orders: AdminState['orders'] = Array.from({ length: 32 }, (_, i) => {
    const p = catalog[i % catalog.length];
    const material = materialIds[i % 3];
    const date = new Date(Date.UTC(2026, 8, 15 - i % 30, 10 + i % 10)).toISOString();
    // Cycle through all 8 lifecycle statuses for demo orders 0-7; rest are Delivered
    const status = i < 8 ? orderStatuses[i] : 'Delivered';
    const isShipped = status === 'Shipped' || status === 'Out for Delivery' || status === 'Delivered';
    const shippingInfo: AdminOrderShipping = isShipped
      ? {
          courier: 'Bosta',
          trackingNumber: `BT${100000 + i}`,
          currentLocation: status === 'Out for Delivery' ? 'Out with courier' : status === 'Delivered' ? 'Delivered' : 'Cairo Sorting Center',
          shippingNotes: '',
        }
      : emptyShipping;
    return {
      id: `CC-DEMO-${1048 - i}`,
      customerId: customers[i % customers.length].id,
      date,
      items: [{ productId: p.id, name: p.name, image: p.images[0].src, material, model: 'iPhone 15', network: '5G', quantity: 1 + i % 3, unitPrice: defaultMaterialPricing[material].discounted }],
      discount: i % 4 === 0 ? 30 : 0,
      shipping: 50,
      status,
      paymentMethod: i % 2 ? 'COD' : 'InstaPay',
      paymentStatus: status === 'Delivered' ? 'Paid' : i === 0 ? 'Awaiting Verification' : 'Pending',
      address: customers[i % customers.length].addresses[0],
      paymentReference: '',
      notes: [],
      history: status === 'Pending Approval'
        ? [{ status, date }]
        : [{ status: 'Pending Approval' as const, date }, { status, date }],
      shippingInfo,
    };
  });
  return {
    products: catalog,
    customers,
    orders,
    coupons: [
      { id: 'demo-cool20', code: 'COOL20', title: 'Welcome offer', type: 'Percentage', value: 20, active: true, archived: false, start: '2026-09-01', expiry: '2026-12-31', minimum: 200, maximum: 100, usageLimit: 100, perUserLimit: 1, usage: 12, customerId: '' },
      { id: 'demo-welcome50', code: 'WELCOME50', title: 'Next purchase', type: 'Fixed Amount', value: 50, active: true, archived: false, start: '2026-10-01', expiry: '2026-12-31', minimum: 300, maximum: 0, usageLimit: 50, perUserLimit: 1, usage: 0, customerId: '' },
    ],
    shipping: { flatFee: 50 },
    settings: { name: 'Coolcase', email: 'support@example.com', phone: '01142966212', whatsapp: '01142966212', cod: true, instapay: true, instapayNumber: '01152966212', defaultStatus: 'Pending Approval', sender: 'Coolcase' },
    activity: [{ id: 'demo-start', text: 'Demo workspace prepared with sample orders and customers.', date: `${DEMO_TODAY}T09:00:00Z` }],
    emailPreviews: [],
  };
}
