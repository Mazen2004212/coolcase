'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { orderStatuses, type OrderStatus, type AdminOrderShipping } from '@/lib/admin/types';
import { getOrderStatusEmail } from '@/lib/admin/email-templates';
import { materialOptions } from '@/lib/data/product-options';
import { updateOrderStatus, saveShippingInfo, verifyPayment, rejectPayment } from '@/app/admin/actions/orders';
import type { LiveOrderSummary, LiveOrderDetail } from '@/app/admin/actions/orders';
import type { DbOrderStatus } from '@/lib/orders/transitions';
import { Empty, Field, Modal, PageHeading, Panel, Pill, Table } from './admin-ui';

// ─── Utility ─────────────────────────────────────────────────────────────────

function money(n: number) { return `${n.toLocaleString('en-EG')} EGP`; }
function shortDate(iso: string) { return new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); }

/** Maps DB status SCREAMING_SNAKE → "Title Case" for display */
function readable(s: string) { return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); }

/** Maps DB status to the admin-types OrderStatus label for email template lookup */
function toLabel(db: DbOrderStatus): OrderStatus {
  const map: Record<string, OrderStatus> = {
    PENDING_ADMIN_APPROVAL: 'Pending Approval',
    PENDING_CONFIRMATION: 'Pending Approval',
    CONFIRMED: 'Confirmed',
    PREPARING: 'Preparing',
    SHIPPED: 'Shipped',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected',
  };
  return map[db] ?? 'Pending Approval';
}

// ─── Allowed transitions (mirrors server-side but for UI generation) ──────────

const UI_TRANSITIONS: Partial<Record<string, DbOrderStatus[]>> = {
  PENDING_ADMIN_APPROVAL: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  PENDING_CONFIRMATION: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
};

const TRANSITION_LABELS: Partial<Record<DbOrderStatus, string>> = {
  CONFIRMED: 'Confirm Order',
  REJECTED: 'Reject Order',
  PREPARING: 'Mark Preparing',
  SHIPPED: 'Mark Shipped',
  OUT_FOR_DELIVERY: 'Mark Out for Delivery',
  DELIVERED: 'Mark Delivered',
  CANCELLED: 'Cancel Order',
};

const TERMINAL: DbOrderStatus[] = ['DELIVERED', 'CANCELLED', 'REJECTED'];

// ─── Orders list ──────────────────────────────────────────────────────────────

export function OrdersListLive({ orders }: { orders: LiveOrderSummary[] }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const filtered = useMemo(() => orders.filter(o => {
    const matchStatus = !statusFilter || readable(o.status) === statusFilter;
    const matchPayment = !paymentFilter || readable(o.paymentStatus) === paymentFilter;
    const matchMethod = !methodFilter || o.paymentMethod === methodFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || [o.orderNumber, o.customerName, o.customerPhone].join(' ').toLowerCase().includes(q);
    return matchStatus && matchPayment && matchMethod && matchSearch;
  }), [orders, statusFilter, paymentFilter, methodFilter, search]);

  return <>
    <PageHeading title="Orders" description="Review payments and move orders through fulfillment." />
    <div className="ad-tabs" role="group" aria-label="Order status filters">
      {['All', ...orderStatuses].map(s => (
        <button key={s} aria-pressed={statusFilter === (s === 'All' ? '' : s)} onClick={() => setStatusFilter(s === 'All' ? '' : s)}>{s}</button>
      ))}
    </div>
    <Panel title={`${filtered.length} orders`}>
      <div className="ad-filters">
        <Field label="Search orders"><input placeholder="Order #, customer, or phone" value={search} onChange={e => setSearch(e.target.value)} /></Field>
        <Field label="Payment status"><select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}><option value="">All payment statuses</option>{['Pending', 'Pending Verification', 'Verified', 'Not Required', 'Rejected', 'Refunded'].map(p => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Payment method"><select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}><option value="">All methods</option><option value="INSTAPAY">InstaPay</option><option value="CASH_ON_DELIVERY">Cash on Delivery</option></select></Field>
      </div>
      {!filtered.length
        ? <Empty />
        : <Table headings={['Order', 'Customer', 'Date', 'Items', 'Total', 'Method', 'Payment', 'Status', 'Actions']}>
          {filtered.map(o => (
            <tr key={o.id}>
              <td><Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link></td>
              <td>{o.customerName}<small>{o.customerPhone}</small></td>
              <td>{shortDate(o.createdAt)}</td>
              <td>{o.itemCount}</td>
              <td><strong>{money(o.totalAmount)}</strong></td>
              <td>{readable(o.paymentMethod)}</td>
              <td><Pill>{readable(o.paymentStatus)}</Pill></td>
              <td><Pill>{readable(o.status)}</Pill></td>
              <td><Link href={`/admin/orders/${o.id}`}>Open</Link></td>
            </tr>
          ))}
        </Table>
      }
    </Panel>
  </>;
}

// ─── Order detail ─────────────────────────────────────────────────────────────

export function OrderDetailLive({ order }: { order: LiveOrderDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [pendingStatus, setPendingStatus] = useState<DbOrderStatus | null>(null);
  const [shippingDraft, setShippingDraft] = useState<AdminOrderShipping>({
    courier: order.shippingCourier,
    trackingNumber: order.shippingTrackingNumber,
    currentLocation: order.shippingCurrentLocation,
    shippingNotes: order.shippingNotes,
  });
  const [confirm, setConfirm] = useState<{ status: DbOrderStatus; withEmail: boolean } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentAction, setPaymentAction] = useState<'verify' | 'reject' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [shippingMsg, setShippingMsg] = useState('');

  const isTerminal = TERMINAL.includes(order.status);
  const availableTransitions = UI_TRANSITIONS[order.status] ?? [];
  const customerEmail = order.customerEmail;
  const hasEmail = Boolean(customerEmail);

  const emailPreview = useMemo(() => {
    if (!pendingStatus) return null;
    const label = toLabel(pendingStatus);
    return getOrderStatusEmail({
      status: label,
      customerName: order.customerName,
      orderReference: order.orderNumber,
      total: order.totalAmount,
      paymentMethod: order.paymentMethod === 'INSTAPAY' ? 'InstaPay' : 'COD',
      shippingInfo: ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(pendingStatus) ? shippingDraft : undefined,
    });
  }, [pendingStatus, order, shippingDraft]);

  const canSendEmail = hasEmail && emailPreview !== null;

  function setSd(key: keyof AdminOrderShipping, value: string) {
    setShippingDraft(d => ({ ...d, [key]: value }));
  }

  function handleSaveShipping() {
    setShippingMsg('');
    startTransition(async () => {
      const result = await saveShippingInfo(order.id, shippingDraft);
      setShippingMsg(result.ok ? 'Shipping info saved.' : `Error: ${result.error}`);
    });
  }

  function handleApplyUpdate() {
    if (!confirm) return;
    const { status: newStatus, withEmail } = confirm;
    setActionMessage('');
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, newStatus, { sendEmail: withEmail });
      if (result.ok) {
        setActionMessage(result.emailResult || `Status updated to ${readable(newStatus)}.`);
        setPendingStatus(null);
        setConfirm(null);
        router.refresh();
      } else {
        setActionMessage(`Error: ${result.error}`);
        setConfirm(null);
      }
    });
  }

  function handleVerifyPayment() {
    startTransition(async () => {
      const result = await verifyPayment(order.id);
      setActionMessage(result.ok ? 'Payment marked as verified.' : `Error: ${result.error}`);
      setPaymentAction(null);
      router.refresh();
    });
  }

  function handleRejectPayment() {
    if (!rejectReason.trim()) { setActionMessage('Rejection reason is required.'); return; }
    startTransition(async () => {
      const result = await rejectPayment(order.id, rejectReason.trim());
      setActionMessage(result.ok ? 'Payment marked as rejected.' : `Error: ${result.error}`);
      setPaymentAction(null);
      setRejectReason('');
      router.refresh();
    });
  }

  return <>
    <PageHeading
      title={order.orderNumber}
      description={`${shortDate(order.createdAt)} · ${order.customerName}`}
      action={<Link href="/admin/orders">Back to orders</Link>}
    />

    {actionMessage && (
      <div className="ad-notice" role="status">
        {actionMessage}
        <button aria-label="Dismiss" onClick={() => setActionMessage('')}>×</button>
      </div>
    )}

    <div className="ad-actions ad-order-status">
      <Pill>{readable(order.status)}</Pill>
      {order.payment && <Pill>{readable(order.payment.status)}</Pill>}
    </div>

    <div className="ad-editor">
      <div className="ad-stack">

        {/* ── Items ──────────────────────────────────────────────── */}
        <Panel title="Ordered items">
          <Table headings={['Product', 'Device', 'Material', 'Qty', 'Unit price', 'Line total']}>
            {order.items.map(item => {
              const displayImage =
                item.customDesignUrl ||
                item.productImageSnapshot;

              return (
                <tr key={item.id}>
                  <td>
                    <div className="ad-product-cell">
                      {displayImage ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={displayImage}
                            alt={
                              item.hasCustomDesign
                                ? `${item.productNameSnapshot} custom design`
                                : item.productNameSnapshot
                            }
                            width={64}
                            height={64}
                            style={{
                              width: 64,
                              height: 64,
                              objectFit: 'cover',
                              borderRadius: 6,
                            }}
                          />
                        </>
                      ) : (
                        <span
                          style={{
                            width: 64,
                            height: 64,
                            background:
                              'var(--ad-surface)',
                            display: 'inline-block',
                            borderRadius: 6,
                          }}
                        />
                      )}

                      <div>
                        <div>
                          {item.productNameSnapshot}
                        </div>

                        {item.hasCustomDesign && (
                          <small>
                            Custom design
                          </small>
                        )}

                        {item.customDesignUrl && (
                          <div>
                            <a
                              href={item.customDesignUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '0.8rem',
                                textDecoration: 'underline',
                              }}
                            >
                              View full design
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    {item.phoneModel}
                    <small>
                      {readable(item.networkType)}
                    </small>
                  </td>

                  <td>
                    {materialOptions[
                      item.material as keyof typeof materialOptions
                    ]?.label ?? readable(item.material)}
                  </td>

                  <td>{item.quantity}</td>

                  <td>
                    {money(item.unitPrice)}
                  </td>

                  <td>
                    {money(item.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </Table>
          <dl className="ad-totals">
            <div><dt>Subtotal</dt><dd>{money(order.subtotalAmount)}</dd></div>
            <div><dt>Shipping</dt><dd>{money(order.shippingAmount)}</dd></div>
            <div><dt>Grand Total</dt><dd>{money(order.totalAmount)}</dd></div>
          </dl>
        </Panel>

        {/* ── Order management ───────────────────────────────────── */}
        <Panel title="Order management">
          <div className="ad-lifecycle">
            <div><small>Current status</small><div style={{ marginTop: 5 }}><Pill>{readable(order.status)}</Pill></div></div>
            {pendingStatus && <>
              <span className="ad-lifecycle-arrow">→</span>
              <div><small>New status</small><div style={{ marginTop: 5 }}><Pill>{readable(pendingStatus)}</Pill></div></div>
            </>}
          </div>

          {isTerminal
            ? <p>This order has reached a final status. No further changes are available.</p>
            : <div className="ad-field">
              <span>Change status to</span>
              <div className="ad-status-buttons">
                {availableTransitions.map(s => (
                  <button key={s} type="button" className={pendingStatus === s ? 'ad-primary' : ''} disabled={isPending}
                    onClick={() => setPendingStatus(prev => prev === s ? null : s)}>
                    {TRANSITION_LABELS[s] ?? readable(s)}
                  </button>
                ))}
              </div>
            </div>
          }

          <hr className="ad-section-divider" />

          {/* Shipping */}
          <div className="ad-shipping-header">
            <h3>Shipping details</h3>
            <button type="button" onClick={handleSaveShipping} disabled={isPending}>Save shipping</button>
          </div>
          {shippingMsg && <p role="status" style={{ marginBottom: 8, fontSize: '0.85rem' }}>{shippingMsg}</p>}
          <div className="ad-form-grid">
            <Field label="Courier"><input value={shippingDraft.courier} onChange={e => setSd('courier', e.target.value)} placeholder="e.g. Bosta" /></Field>
            <Field label="Tracking Number"><input value={shippingDraft.trackingNumber} onChange={e => setSd('trackingNumber', e.target.value)} placeholder="e.g. BT12345678" /></Field>
          </div>
          <Field label="Current Location"><input value={shippingDraft.currentLocation} onChange={e => setSd('currentLocation', e.target.value)} placeholder="e.g. Cairo Sorting Center" /></Field>
          <Field label="Shipping Notes (internal — not shown to customer)">
            <textarea rows={2} value={shippingDraft.shippingNotes} onChange={e => setSd('shippingNotes', e.target.value)} placeholder="Internal notes only" />
          </Field>

          {/* Email preview + action buttons */}
          {pendingStatus && <>
            <hr className="ad-section-divider" />
            <div className="ad-email-preview-section">
              <h3>Customer email preview</h3>
              {!hasEmail && <p className="ad-no-email-notice">No customer email on file. &ldquo;Update &amp; Send Email&rdquo; is disabled.</p>}
              {emailPreview
                ? <div className="ad-email">
                  <p style={{ margin: '0 0 4px' }}><strong>To:</strong> {customerEmail || '(no email)'}</p>
                  <p style={{ margin: '0 0 12px' }}><strong>Subject:</strong> {emailPreview.subject}</p>
                  <hr style={{ borderColor: 'var(--ad-border)', margin: '0 0 12px' }} />
                  <pre className="ad-email-body">{emailPreview.body}</pre>
                </div>
                : <p>No customer email template for this status. Use &ldquo;Update Without Email&rdquo;.</p>
              }
            </div>
            <div className="ad-order-actions">
              <button type="button" className="ad-primary" disabled={!canSendEmail || isPending}
                title={!hasEmail ? 'No email on file' : !emailPreview ? 'No template for this status' : undefined}
                onClick={() => setConfirm({ status: pendingStatus, withEmail: true })}>
                Update Status &amp; Send Email
              </button>
              <button type="button" disabled={isPending} onClick={() => setConfirm({ status: pendingStatus, withEmail: false })}>
                Update Without Email
              </button>
              <button type="button" onClick={() => setPendingStatus(null)}>Cancel</button>
            </div>
          </>}

          <hr className="ad-section-divider" />

          {/* Timeline */}
          <h3 style={{ marginBottom: 12 }}>Order timeline</h3>
          <ol className="ad-timeline">
            {order.history.map(event => (
              <li key={event.id}>
                <Pill>{readable(event.status)}</Pill>
                <span>{shortDate(event.createdAt)}</span>
                {event.customerVisibleNote && <small>{event.customerVisibleNote}</small>}
                {event.internalNote && <small style={{ opacity: 0.6 }}>Internal: {event.internalNote}</small>}
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {/* ── Right column ─────────────────────────────────────────── */}
      <div className="ad-stack">
        <Panel title="Customer">
          <h3>{order.customerName}</h3>
          <p>{order.customerEmail || <em>No email on file</em>}</p>
          <p>{order.customerPhone}</p>
        </Panel>

        <Panel title="Shipping address">
          <p>{order.customerName}</p>
          <p>{order.streetName}, Building {order.buildingNumber}</p>
          {order.floor && <p>Floor {order.floor}{order.apartment ? `, Apt ${order.apartment}` : ''}</p>}
          <p>{order.cityArea}, {order.governorate}</p>
          {order.landmark && <p>Landmark: {order.landmark}</p>}
          {order.deliveryNotes && <p>Notes: {order.deliveryNotes}</p>}
        </Panel>

        <Panel title="Payment">
          <h3>{readable(order.paymentMethod)}</h3>
          {order.payment && <>
            <p>Status: <strong>{readable(order.payment.status)}</strong></p>
            {order.payment.verifiedAt && <p>Verified: {shortDate(order.payment.verifiedAt)}</p>}
            {order.payment.rejectionReason && <p>Rejection reason: {order.payment.rejectionReason}</p>}

            {/* Payment action buttons — only for InstaPay in non-terminal payment states */}
            {order.paymentMethod === 'INSTAPAY' &&
              !['VERIFIED', 'REFUNDED'].includes(order.payment.status) && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="ad-primary" disabled={isPending}
                    onClick={() => setPaymentAction('verify')}>Verify Payment</button>
                  <button type="button" disabled={isPending}
                    onClick={() => setPaymentAction('reject')}>Reject Payment</button>
                </div>
              )}
          </>}
        </Panel>
      </div>
    </div>

    {/* ── Status update confirmation dialog ──────────────────────── */}
    {confirm && (
      <Modal
        title={confirm.withEmail
          ? `Update to "${readable(confirm.status)}" and send email?`
          : `Update to "${readable(confirm.status)}" without email?`}
        close={() => setConfirm(null)}
      >
        <p>
          {confirm.withEmail
            ? `The customer will receive a ${readable(confirm.status)} email at ${customerEmail}.`
            : `The order status will be updated to ${readable(confirm.status)}. No email will be sent.`}
        </p>
        <div className="ad-order-actions">
          <button type="button" className="ad-primary" disabled={isPending} onClick={handleApplyUpdate}>
            {confirm.withEmail ? 'Update & Send' : 'Update Status'}
          </button>
          <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      </Modal>
    )}

    {/* ── Payment verification dialog ─────────────────────────────── */}
    {paymentAction === 'verify' && (
      <Modal title="Verify InstaPay payment?" close={() => setPaymentAction(null)}>
        <p>Mark this payment as verified. This confirms the customer has sent the correct amount via InstaPay.</p>
        <div className="ad-order-actions">
          <button type="button" className="ad-primary" disabled={isPending} onClick={handleVerifyPayment}>Confirm Verification</button>
          <button type="button" onClick={() => setPaymentAction(null)}>Cancel</button>
        </div>
      </Modal>
    )}

    {/* ── Payment rejection dialog ────────────────────────────────── */}
    {paymentAction === 'reject' && (
      <Modal title="Reject InstaPay payment?" close={() => setPaymentAction(null)}>
        <Field label="Rejection reason (required)">
          <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Wrong amount transferred" />
        </Field>
        <div className="ad-order-actions">
          <button type="button" className="ad-primary" disabled={isPending} onClick={handleRejectPayment}>Reject Payment</button>
          <button type="button" onClick={() => setPaymentAction(null)}>Cancel</button>
        </div>
      </Modal>
    )}
  </>;
}
