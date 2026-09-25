'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  fetchShippingOrders,
  type ShippingOrderGroup,
  type ShippingOrdersResult,
} from '@/app/admin/actions/shipping';
import { ShippingStatusBadge } from '@/components/ui/status-badge';
import type { DbOrderStatus } from '@/lib/orders/transitions';

import { Empty, Panel, Table } from './admin-ui';

const GROUPS: Array<{ key: ShippingOrderGroup; label: string }> = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'EXCEPTION', label: 'Cancelled / rejected' },
];

function groupForStatus(status: DbOrderStatus): ShippingOrderGroup {
  if (
    status === 'PENDING_ADMIN_APPROVAL' ||
    status === 'PENDING_CONFIRMATION' ||
    status === 'CONFIRMED'
  ) {
    return 'PENDING';
  }
  if (status === 'PREPARING') return 'PREPARING';
  if (status === 'SHIPPED') return 'SHIPPED';
  if (status === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
  if (status === 'DELIVERED') return 'DELIVERED';
  return 'EXCEPTION';
}

function money(amount: number) {
  return `${amount.toLocaleString('en-EG')} EGP`;
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function location(governorate: string, cityArea: string) {
  return [governorate, cityArea].filter(Boolean).join(' · ');
}

export function ShippingOrdersLive() {
  const [result, setResult] = useState<ShippingOrdersResult | null>(null);
  const [filter, setFilter] = useState<ShippingOrderGroup | 'ALL'>('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetchShippingOrders()
      .then(data => {
        if (active) setResult(data);
      })
      .catch(cause => {
        console.error('[admin shipping] Failed to load shipping orders:', cause);
        if (active) setError('Shipping orders could not be loaded. Refresh to try again.');
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!result || filter === 'ALL') return result?.orders ?? [];
    return result.orders.filter(order => groupForStatus(order.status) === filter);
  }, [filter, result]);

  return (
    <section className="ad-shipping-orders" aria-labelledby="shipping-orders-title">
      <div className="ad-shipping-orders-heading">
        <div>
          <h2 id="shipping-orders-title">Shipping Orders</h2>
          <p>Customer orders viewed through their current delivery stage.</p>
        </div>
        <label className="ad-shipping-filter">
          <span>Shipping status</span>
          <select
            value={filter}
            onChange={event =>
              setFilter(event.target.value as ShippingOrderGroup | 'ALL')
            }
            disabled={!result}
          >
            <option value="ALL">All statuses</option>
            {GROUPS.map(group => (
              <option key={group.key} value={group.key}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="ad-error" role="alert">{error}</p> : null}

      <div className="ad-shipping-summary" aria-label="Shipping status summary">
        {GROUPS.map(group => (
          <button
            type="button"
            key={group.key}
            aria-pressed={filter === group.key}
            onClick={() => setFilter(current => current === group.key ? 'ALL' : group.key)}
            disabled={!result}
          >
            <span>{group.label}</span>
            <strong>{result ? result.counts[group.key] : '—'}</strong>
          </button>
        ))}
      </div>

      <Panel title={result ? `${filtered.length} recent orders` : 'Loading shipping orders…'}>
        {result && filtered.length === 0 ? (
          <Empty>No customer orders match this shipping status.</Empty>
        ) : null}

        {result && filtered.length > 0 ? (
          <>
            <div className="ad-shipping-order-cards">
              {filtered.map(order => (
                <article key={order.id}>
                  <header>
                    <strong>{order.orderNumber}</strong>
                    <ShippingStatusBadge status={order.status} />
                  </header>
                  <dl>
                    <div><dt>Customer</dt><dd>{order.customerName}</dd></div>
                    <div><dt>City / area</dt><dd>{location(order.governorate, order.cityArea)}</dd></div>
                    <div><dt>Order date</dt><dd>{shortDate(order.createdAt)}</dd></div>
                    <div><dt>Total</dt><dd><strong>{money(order.totalAmount)}</strong></dd></div>
                  </dl>
                  {result.canViewOrders ? (
                    <Link className="ad-button" href={`/admin/orders/${order.id}`}>
                      View Order
                    </Link>
                  ) : (
                    <span className="ad-shipping-no-access">Order detail access required</span>
                  )}
                </article>
              ))}
            </div>

            <div className="ad-shipping-orders-table">
              <Table headings={['Order', 'Customer', 'City / area', 'Shipping status', 'Order date', 'Total amount', 'Action']}>
                {filtered.map(order => (
                  <tr key={order.id}>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td>{order.customerName}</td>
                    <td>{location(order.governorate, order.cityArea)}</td>
                    <td><ShippingStatusBadge status={order.status} /></td>
                    <td>{shortDate(order.createdAt)}</td>
                    <td><strong>{money(order.totalAmount)}</strong></td>
                    <td>
                      {result.canViewOrders ? (
                        <Link href={`/admin/orders/${order.id}`}>View Order</Link>
                      ) : (
                        <span className="ad-shipping-no-access">No access</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        ) : null}
      </Panel>
    </section>
  );
}
