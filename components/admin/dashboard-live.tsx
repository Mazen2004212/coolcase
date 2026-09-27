'use client';

import Link from 'next/link';
import { canVisit } from '@/lib/admin/permissions';
import { useEffect, useState } from 'react';

import {
  fetchDashboardData,
  fetchAnalyticsData,
  type DashboardData,
} from '@/app/admin/actions/dashboard';
import { money, shortDate } from '@/lib/admin/analytics';
import { orderStatuses } from '@/lib/admin/types';
import {
  materialIds,
  materialOptions,
} from '@/lib/data/product-options';
import {
  OrderStatusBadge,
  StatusBadge,
  type Tone,
} from '@/components/ui/status-badge';

import {
  ActionLink,
  Field,
  PageHeading,
  Panel,
  Table,
  Thumb,
} from './admin-ui';
import { useAdmin } from './admin-provider';

function dashboardStatusTone(status: string): Tone {
  if (status === 'Delivered') return 'success';
  if (status === 'Cancelled' || status === 'Rejected') return 'danger';
  if (status === 'Pending Approval') return 'warning';
  return 'info';
}

export function ActivityLive({
  activity,
}: {
  activity: DashboardData['activity'];
}) {
  return (
    <Panel title="Recent activity">
      {activity.length > 0 ? (
        <ol className="ad-activity">
          {activity.map(event => (
            <li key={event.id}>
              <span>{event.text}</span>
              <small>{shortDate(event.date)}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p>No recent admin activity.</p>
      )}
    </Panel>
  );
}

export function DashboardLive({
  analytics = false,
}: {
  analytics?: boolean;
}) {
  const { staff } = useAdmin();
  const [loadError, setLoadError] = useState('');
  const [period, setPeriod] = useState('30 days');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [data, setData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshKey, setRefreshKey] =
    useState(0);
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const fetchData = analytics ? fetchAnalyticsData : fetchDashboardData;

    fetchData(period, from, to)
      .then(result => {
        if (!active) {
          return;
        }

        setLoadError("");
        setData(result);
        setLoading(false);
      })
      .catch(error => {
        console.error(
          '[admin dashboard] Failed to load dashboard:',
          error,
        );

        if (active) {
          setLoadError("Could not refresh data. The previous report is still displayed.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [analytics, period, from, to, refreshKey]);

  function changePeriod(nextPeriod: string) {
    setLoading(true);
    setPeriod(nextPeriod);
  }

  function changeFrom(value: string) {
    setLoading(true);
    setFrom(value);
  }

  function changeTo(value: string) {
    setLoading(true);
    setTo(value);
  }

  function retry() {
    setLoading(true);
    setRefreshKey(key => key + 1);
  }

  if (!data && loading) {
    return (
      <p style={{ padding: 40 }}>
        Loading dashboard data...
      </p>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40 }}>
        <p className="ad-error">
          Failed to load dashboard data.
        </p>

        <button
          type="button"
          className="ad-primary"
          onClick={retry}
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    start,
    end,
    metrics,
    ranking,
    buckets,
    orderCounts,
    activity,
    materials,
    recentOrders,
  } = data;

  function bucketLabel(index: number) {
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = Date.parse(`${end}T23:59:59Z`);
    const duration = Math.max(86_400_000, endMs - startMs);
    const from = new Date(startMs + duration * index / buckets.length);
    const to = new Date(Math.min(endMs, startMs + duration * (index + 1) / buckets.length));
    const format = (date: Date) => date.toLocaleString('en-GB', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'UTC' });
    return `${format(from)} – ${format(to)} UTC`;
  }

  const peak = Math.max(
    1,
    ...buckets,
  );

  const points = buckets
    .map((value, index) => {
      const x =
        35 +
        (index * 630) /
        Math.max(
          1,
          buckets.length - 1,
        );

      const y =
        185 -
        (value / peak) * 145;

      return `${x},${y}`;
    })
    .join(' ');

  /*
   * validOrders already includes pending,
   * confirmed, preparing, shipped, etc.
   *
   * Only cancelled/rejected are excluded,
   * so total orders = valid + cancelled/rejected.
   */
  const totalOrders =
    metrics.validOrders +
    data.pendingOrders +
    data.cancelledOrders;

  const kpis = [
    [
      'Total Revenue',
      money(metrics.revenue),
    ],
    [
      'Orders',
      String(totalOrders),
    ],
    [
      'Pending Orders',
      String(data.pendingOrders),
    ],
    [
      'Average Order Value',
      money(metrics.average),
    ],
    [
      'Active Products',
      String(data.activeProducts),
    ],
    [
      'Customers',
      String(data.totalCustomers),
    ],
  ];
  const kpiDestinations: Record<string, { href: string; section: string }> = {
    Orders: { href: '/admin/orders', section: 'Orders' },
    'Pending Orders': { href: '/admin/orders', section: 'Orders' },
    'Active Products': { href: '/admin/products', section: 'Products' },
    Customers: { href: '/admin/customers', section: 'Customers' },
  };

  return (
    <>
      <PageHeading
        title={
          analytics
            ? 'Analytics'
            : 'Dashboard'
        }
        description={
          analytics
            ? 'Sales, products, and customers at a glance.'
            : 'A clear view of your store.'
        }
        action={
          <ActionLink href="/admin/products/new">
            Add Product
          </ActionLink>
        }
      />

      <div className="ad-period">
        <div
          className="ad-tabs"
          aria-label="Sales period"
          role="group"
        >
          {[
            'Today',
            '7 days',
            '30 days',
            'Custom',
          ].map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={
                period === option
              }
              onClick={() =>
                changePeriod(option)
              }
            >
              {option}
            </button>
          ))}
        </div>

        <small>
          Reporting date:{' '}
          {shortDate(end)}
        </small>
      </div>

      {period === 'Custom' ? (
        <div className="ad-filters">
          <Field label="Period start">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={event =>
                changeFrom(
                  event.target.value,
                )
              }
            />
          </Field>

          <Field label="Period end">
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={event =>
                changeTo(
                  event.target.value,
                )
              }
            />
          </Field>
        </div>
      ) : null}

      {loading && data ? (
        <p
          style={{
            opacity: 0.5,
            marginTop: -10,
            marginBottom: 10,
          }}
        >
          Updating data...
        </p>
      ) : null}

      {loadError && <p className="cc-feedback" data-tone="danger" role="alert">{loadError} <button type="button" onClick={retry}>Retry</button></p>}
      <div className="ad-kpis">
        {kpis.map(
          ([label, value]) => (
            <div key={label} data-clickable={Boolean(kpiDestinations[label] && canVisit(staff, kpiDestinations[label].section))}>
              {kpiDestinations[label] && canVisit(staff, kpiDestinations[label].section) ? <Link className="ad-kpi-hit" href={kpiDestinations[label].href} aria-label={`View ${label}`} /> : null}
              <span>{label}</span>
              <strong>{value}</strong>

              <small>
                {label ===
                  'Active Products' ||
                  label === 'Customers'
                  ? 'Total'
                  : 'Selected period'}
              </small>
            </div>
          ),
        )}
      </div>

      <div className="ad-two ad-dashboard-grid">
        <Panel title="Sales overview">
          <strong className="ad-chart-total">
            {money(
              metrics.revenue,
            )}
          </strong>

          <div className="ad-chart-wrap">
          <svg
            className="ad-chart"
            viewBox="0 0 700 220"
            role="group"
            aria-label={`Sales overview for ${start} to ${end}: ${money(
              metrics.revenue,
            )}`}
          >
            <title>
              Sales overview
            </title>

            {[40, 90, 140, 185].map(
              y => (
                <line
                  key={y}
                  x1="35"
                  x2="665"
                  y1={y}
                  y2={y}
                  stroke="#e6e8eb"
                />
              ),
            )}

            <text x="35" y="28">{money(peak)}</text><text x="35" y="200">0</text>
            {buckets.length > 0 ? (
              <polyline
                points={points}
                fill="none"
                stroke="#171717"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            ) : null}

            {buckets.map(
              (value, index) => {
                const x =
                  35 +
                  (index * 630) /
                  Math.max(
                    1,
                    buckets.length -
                    1,
                  );

                const y =
                  185 -
                  (value /
                    peak) *
                  145;

                return (
                  <g key={index}>
                    <circle cx={x} cy={y} r="4" fill="#111111" />
                    <circle cx={x} cy={y} r="16" fill="transparent" tabIndex={0} role="button" aria-label={`${bucketLabel(index)}: ${money(value)}`} onPointerEnter={() => setHoveredBucket(index)} onPointerLeave={event => { if (event.pointerType === 'mouse') setHoveredBucket(null); }} onFocus={() => setHoveredBucket(index)} onBlur={() => setHoveredBucket(null)} onClick={() => setHoveredBucket(index)} />
                  </g>
                );
              },
            )}

            <text
              x="35"
              y="212"
            >
              {start}
            </text>

            <text
              x="665"
              y="212"
              textAnchor="end"
            >
              {end}
            </text>
          </svg>
          {hoveredBucket !== null && buckets[hoveredBucket] !== undefined ? <div className="ad-chart-tooltip" role="status" style={{ left: `${(35 + (hoveredBucket * 630) / Math.max(1, buckets.length - 1)) / 700 * 100}%`, top: `${(185 - (buckets[hoveredBucket] / peak) * 145) / 220 * 100}%` }}><span>{bucketLabel(hoveredBucket)}</span><strong>{money(buckets[hoveredBucket])}</strong></div> : null}
          </div>

          <p className="cc-helper">Scale: 0–{money(peak)} · Dates and times below are UTC.</p><details>
            <summary>
              View chart data
            </summary>

            <Table
              headings={[
                'Date / time range (UTC)',
                'Revenue',
              ]}
            >
              {buckets.map(
                (
                  value,
                  index,
                ) => (
                  <tr
                    key={index}
                  >
                    <td>
                      {bucketLabel(index)}
                    </td>

                    <td>
                      {money(
                        value,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </Table>
          </details>

          <small>
            Revenue includes shipping
            and excludes
            cancelled/rejected orders.
            AOV = revenue ÷ valid
            orders.
          </small>
        </Panel>

        <Panel title="Order status summary">
          <div className="ad-status-list">
            {orderStatuses.map(
              status => (
                <div key={status}>
                  <StatusBadge tone={dashboardStatusTone(status)}>
                    {status}
                  </StatusBadge>

                  <strong>
                    {orderCounts[
                      status
                    ] ?? 0}
                  </strong>
                </div>
              ),
            )}
          </div>
        </Panel>
      </div>

      {analytics ? (
        <>
          <div className="ad-two">
            <Panel title="Sales breakdown">
              <dl className="ad-totals">
                <div>
                  <dt>
                    Gross product
                    sales
                  </dt>

                  <dd>
                    {money(
                      metrics.gross,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Discounts
                  </dt>

                  <dd>
                    {money(
                      metrics.discounts,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Shipping
                    collected
                  </dt>

                  <dd>
                    {money(
                      metrics.shipping,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Net sales
                    (excluding
                    shipping)
                  </dt>

                  <dd>
                    {money(
                      metrics.gross -
                      metrics.discounts,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Revenue
                  </dt>

                  <dd>
                    {money(
                      metrics.revenue,
                    )}
                  </dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Orders and customers">
              <dl className="ad-totals">
                <div>
                  <dt>
                    Completed orders
                  </dt>

                  <dd>
                    {
                      data.completedOrders
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    Pending orders
                  </dt>

                  <dd>
                    {
                      data.pendingOrders
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    Cancelled /
                    rejected
                  </dt>

                  <dd>
                    {
                      data.cancelledOrders
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    New customers
                  </dt>

                  <dd>
                    {
                      data.newCustomers
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    Returning
                    purchasers
                  </dt>

                  <dd>
                    {
                      data.returningCustomers
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    Units sold
                  </dt>

                  <dd>
                    {
                      metrics.units
                    }
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>

          <Panel title="Material performance">
            {materials.length >
              0 ? (
              <Table
                headings={[
                  'Material',
                  'Units sold',
                  'Gross product revenue',
                  'Revenue share',
                ]}
              >
                {materialIds.map(
                  material => {
                    const stat =
                      materials.find(
                        item =>
                          item.material ===
                          material,
                      );

                    const revenue =
                      stat?.revenue ??
                      0;

                    const units =
                      stat?.units ??
                      0;

                    return (
                      <tr
                        key={
                          material
                        }
                      >
                        <td>
                          {materialOptions[
                            material
                          ]?.label ??
                            material}
                        </td>

                        <td>
                          {units}
                        </td>

                        <td>
                          {money(
                            revenue,
                          )}
                        </td>

                        <td>
                          <meter
                            min="0"
                            max={
                              metrics.gross ||
                              1
                            }
                            value={
                              revenue
                            }
                            aria-label={`${materialOptions[
                              material
                            ]
                              ?.label ??
                              material
                              } revenue share`}
                          />
                        </td>
                      </tr>
                    );
                  },
                )}
              </Table>
            ) : (
              <p>
                No material sales in
                this period.
              </p>
            )}
          </Panel>
        </>
      ) : (
        <Panel
          title="Recent Orders"
          action={
            <Link href="/admin/orders">
              View all
            </Link>
          }
        >
          {recentOrders.length >
            0 ? (
            <Table
              headings={[
                'Order',
                'Date',
                'Customer',
                'Items',
                'Total',
                'Status',
              ]}
            >
              {recentOrders.map(
                order => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                      >
                        <strong>
                          {
                            order.orderNumber
                          }
                        </strong>
                      </Link>
                    </td>

                    <td>
                      {shortDate(
                        order.date,
                      )}
                    </td>

                    <td>
                      {
                        order.customerName
                      }
                    </td>

                    <td>
                      {order.items.reduce(
                        (
                          sum,
                          item,
                        ) =>
                          sum +
                          item.quantity,
                        0,
                      )}{' '}
                      items
                    </td>

                    <td>
                      {money(
                        order.totalAmount,
                      )}
                    </td>

                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                ),
              )}
            </Table>
          ) : (
            <p>
              No orders in this
              period.
            </p>
          )}
        </Panel>
      )}

      <div className="ad-two">
        <Panel title="Top Selling Products">
          {ranking.length > 0 ? (
            <Table
              headings={[
                'Product',
                'Units sold',
                'Product revenue',
              ]}
            >
              {ranking
                .slice(0, 5)
                .map(product => (
                  <tr
                    key={
                      product.id
                    }
                  >
                    <td>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="ad-product-cell"
                      >
                        <Thumb
                          src={product.images[0]?.src ?? undefined}
                          alt={product.name}
                        />

                        {
                          product.name
                        }
                      </Link>
                    </td>

                    <td>
                      {
                        product.units
                      }
                    </td>

                    <td>
                      {money(
                        product.revenue,
                      )}
                    </td>
                  </tr>
                ))}
            </Table>
          ) : (
            <p>
              No product sales in
              this period.
            </p>
          )}
        </Panel>

        {analytics ? (
          <Panel title="Least selling products">
            {ranking.length >
              0 ? (
              <Table
                headings={[
                  'Product',
                  'Units sold',
                  'Product revenue',
                ]}
              >
                {[...ranking]
                  .reverse()
                  .slice(0, 3)
                  .map(
                    product => (
                      <tr
                        key={
                          product.id
                        }
                      >
                        <td>
                          {
                            product.name
                          }
                        </td>

                        <td>
                          {
                            product.units
                          }
                        </td>

                        <td>
                          {money(
                            product.revenue,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
              </Table>
            ) : (
              <p>
                No product sales in
                this period.
              </p>
            )}
          </Panel>
        ) : (
          <ActivityLive
            activity={activity}
          />
        )}
      </div>

      <Panel title="Quick Actions">
        <div className="ad-actions">
          <ActionLink href="/admin/products/new">
            Add Product
          </ActionLink>

          <Link href="/admin/orders?status=PENDING_ADMIN_APPROVAL">
            View Pending Orders
          </Link>

          <Link href="/admin/settings">
            Store Settings
          </Link>
        </div>
      </Panel>
    </>
  );
}
