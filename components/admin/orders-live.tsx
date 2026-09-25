'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { OrderStatusBadge, PaymentStatusBadge, TestOrderBadge } from '@/components/ui/status-badge';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { orderStatuses, type OrderStatus, type AdminOrderShipping } from '@/lib/admin/types';
import { getOrderStatusEmail } from '@/lib/admin/email-templates';
import { materialOptions } from '@/lib/data/product-options';
import { namedCaseColorLabel } from '@/lib/custom-cases/templates';
import { updateOrderStatus, saveShippingInfo, verifyPayment, rejectPayment } from '@/app/admin/actions/orders';
import type { LiveOrderSummary, LiveOrderDetail } from '@/app/admin/actions/orders';
import type { DbOrderStatus } from '@/lib/orders/transitions';
import { Empty, Field, Modal, PageHeading, Panel, Table } from './admin-ui';
import { formatNetworkType } from '@/lib/utils/network-label';

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
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const [statusFilter, setStatusFilter] = useState(requestedStatus ? toLabel(requestedStatus as DbOrderStatus) : '');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const filtered = useMemo(() => orders.filter(o => {
    const matchStatus = !statusFilter || toLabel(o.status as DbOrderStatus) === statusFilter;
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
        : <><div className="cc-order-cards">{filtered.map(o => <article key={o.id}><header><Link href={`/admin/orders/${o.id}`}><strong>{o.orderNumber}</strong></Link>{o.isTest && <TestOrderBadge/>}</header><p>{o.customerName} · {o.customerPhone}</p><OrderStatusBadge status={o.status}/><PaymentStatusBadge status={o.paymentStatus}/><strong>{money(o.totalAmount)}</strong><Link className="cc-button" href={`/admin/orders/${o.id}`}>Review order →</Link></article>)}</div><div className="cc-orders-desktop"><Table headings={['Order', 'Customer', 'Date', 'Items', 'Total', 'Method', 'Payment', 'Status', 'Actions']}>
          {filtered.map(o => (
            <tr key={o.id}>
              <td><Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>{o.isTest ? <TestOrderBadge/> : null}</td>
              <td>{o.customerName}<small>{o.customerPhone}</small></td>
              <td>{shortDate(o.createdAt)}</td>
              <td>{o.itemCount}</td>
              <td><strong>{money(o.totalAmount)}</strong></td>
              <td>{readable(o.paymentMethod)}</td>
              <td><PaymentStatusBadge status={o.paymentStatus}/></td>
              <td><OrderStatusBadge status={o.status}/></td>
              <td><Link href={`/admin/orders/${o.id}`}>Open</Link></td>
            </tr>
          ))}
        </Table></div></>
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
      subtotal: order.subtotalAmount,
      discount: order.discountAmount,
      shipping: order.shippingAmount,
      paymentMethod: order.paymentMethod === 'INSTAPAY' ? 'InstaPay' : 'COD',
      ...(order.paymentMethod === 'CASH_ON_DELIVERY' && order.payment?.status !== 'NOT_REQUIRED' ? {
        paymentExpectedAmount: order.payment?.expectedAmount,
        remainingCodAmount: Number((order.totalAmount - (order.payment?.expectedAmount ?? 0)).toFixed(2)),
        paymentStatus: order.payment?.status,
      } : {}),
      siteUrl: process.env.NEXT_PUBLIC_APP_URL,
      orderUrl: `/account/orders/${order.id}`,
      items: order.items.map(item => ({
        productName: item.productNameSnapshot,
        phoneModel: item.phoneModel,
        material: item.material,
        networkType: item.networkType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        customizationType: item.customizationType,
        customizationSnapshot: item.customizationSnapshot,
      })),
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
    if (!order.payment?.proof) return;
    startTransition(async () => {
      const result = await verifyPayment(order.id, order.payment!.proof!.uploadId);
      setActionMessage(result.ok ? 'Payment marked as verified.' : `Error: ${result.error}`);
      setPaymentAction(null);
      router.refresh();
    });
  }

  function handleRejectPayment() {
    if (!order.payment?.proof) { setActionMessage('Reload the current proof before rejecting it.'); return; }
    if (!rejectReason.trim()) { setActionMessage('Rejection reason is required.'); return; }
    startTransition(async () => {
      const result = await rejectPayment(order.id, order.payment!.proof!.uploadId, rejectReason.trim());
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
      <div className="cc-feedback" data-tone={/error|reason is required|reload/i.test(actionMessage) ? "danger" : "success"} role={/error|reason is required|reload/i.test(actionMessage) ? "alert" : "status"}>
        {actionMessage}
        <button aria-label="Dismiss" onClick={() => setActionMessage('')}>×</button>
      </div>
    )}

    <div className="ad-actions ad-order-status">
      {order.isTest && <TestOrderBadge/>}
      <OrderStatusBadge status={order.status}/>
      {order.payment && <PaymentStatusBadge status={order.payment.status}/>}
    </div>

    <div className="ad-editor">
      <div className="ad-stack">

        {/* ── Items ──────────────────────────────────────────────── */}
        <Panel title="Ordered items">
          <Table headings={['Product', 'Device', 'Material', 'Qty', 'Unit price', 'Line total']}>
            {order.items.map(item => {
              const named = item.customizationType === 'NAMED_TEMPLATE' ? item.customizationSnapshot : null;
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
                            CUSTOM DESIGN
                          </small>
                        )}
                        {named ? <div className="ad-named-fulfillment"><strong>NAMED CUSTOM CASE — FULFILLMENT</strong><dl><div><dt>English Name</dt><dd lang="en">{String(named.englishName ?? 'Not specified')}</dd></div><div><dt>Arabic Name</dt><dd lang="ar" dir="rtl">{String(named.arabicName ?? 'Not specified')}</dd></div><div><dt>English Name Color</dt><dd>{namedCaseColorLabel(named.englishColor)}{named.englishColor ? ` (${String(named.englishColor)})` : ''}</dd></div><div><dt>Arabic Name Color</dt><dd>{namedCaseColorLabel(named.arabicColor)}{named.arabicColor ? ` (${String(named.arabicColor)})` : ''}</dd></div><div><dt>Phone</dt><dd>{item.phoneModel}</dd></div><div><dt>Network</dt><dd>{formatNetworkType(item.networkType)}</dd></div><div><dt>Material</dt><dd>{materialOptions[item.material as keyof typeof materialOptions]?.label ?? readable(item.material)}</dd></div><div><dt>Quantity</dt><dd>{item.quantity}</dd></div></dl>{!named.englishName && named.renderedText ? <small>Legacy name: <span dir="auto">{String(named.renderedText)}</span></small> : null}</div> : null}

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
                      {formatNetworkType(item.networkType)}
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
            {order.couponCodeSnapshot ? (
              <div><dt>Coupon ({order.couponCodeSnapshot})</dt><dd>-{money(order.discountAmount)}</dd></div>
            ) : null}
            <div><dt>Shipping</dt><dd>{money(order.shippingAmount)}</dd></div>
            <div><dt>Grand Total</dt><dd>{money(order.totalAmount)}</dd></div>
          </dl>
        </Panel>

        {/* ── Order management ───────────────────────────────────── */}
        <Panel title="Order management">
          <div className="ad-lifecycle">
            <div><small>Current status</small><div style={{ marginTop: 5 }}><OrderStatusBadge status={order.status}/></div></div>
            {pendingStatus && <>
              <span className="ad-lifecycle-arrow">→</span>
              <div><small>New status</small><div style={{ marginTop: 5 }}><OrderStatusBadge status={pendingStatus}/></div></div>
            </>}
          </div>

          {isTerminal
            ? <p>This order has reached a final status. No further changes are available.</p>
            : <div className="ad-field">
              <span>Change status to</span>
              <div className="ad-status-buttons">
                {availableTransitions.map(s => (
                  <button key={s} type="button" className={s === 'CANCELLED' || s === 'REJECTED' ? 'ad-danger' : pendingStatus === s ? 'ad-primary' : ''} disabled={isPending}
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
                  <iframe className="ad-email-preview-frame" title={`${readable(pendingStatus)} customer email preview`} srcDoc={emailPreview.html} sandbox="" />
                  <details className="ad-email-text-preview"><summary>Plain-text fallback</summary><pre className="ad-email-body">{emailPreview.body}</pre></details>
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
                <OrderStatusBadge status={event.status}/>
                <span>{shortDate(event.createdAt)}</span>
                {event.customerVisibleNote && <small>{event.customerVisibleNote}</small>}
                {event.internalNote && <small className="cc-internal-note">Internal: {event.internalNote}</small>}
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
            {order.paymentMethod === 'CASH_ON_DELIVERY' && order.payment.status !== 'NOT_REQUIRED' ? <>
              <p>Order total: <strong>{money(order.totalAmount)}</strong></p>
              <p>Required deposit: <strong>{money(order.payment.expectedAmount)}</strong></p>
              <p>Deposit status: <strong>{readable(order.payment.status)}</strong></p>
              <p>Remaining due on delivery: <strong>{money(Number((order.totalAmount - order.payment.expectedAmount).toFixed(2)))}</strong></p>
              {order.payment.status === 'VERIFIED' ? <p><strong>Deposit verified</strong></p> : null}
            </> : <p>Expected amount: <strong>{money(order.payment.expectedAmount)}</strong></p>}
            {order.payment.verifiedAt && <p>Verified: {shortDate(order.payment.verifiedAt)}</p>}
            {order.payment.status === 'VERIFIED' && order.payment.verificationSource === 'PAYMENT_PROOF' ? (
              <p>Verified from uploaded proof</p>
            ) : null}
            {order.payment.status === 'VERIFIED' && order.payment.verificationSource === 'WHATSAPP_LEGACY' ? (
              <p>Verified — Legacy WhatsApp verification</p>
            ) : null}
            {order.payment.rejectionReason && <p>Rejection reason: {order.payment.rejectionReason}</p>}

            {order.payment.proof ? (
              <div className="ad-payment-proof">
                {/* The URL is a private, five-minute signed URL generated server-side. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={order.payment.proof.signedUrl} alt="Customer payment proof" />
                <dl>
                  <div><dt>File</dt><dd>{order.payment.proof.originalFilename || 'Payment proof'}</dd></div>
                  <div><dt>Type</dt><dd>{order.payment.proof.mimeType}</dd></div>
                  <div><dt>Size</dt><dd>{Math.ceil(order.payment.proof.fileSize / 1024).toLocaleString('en-EG')} KB</dd></div>
                  <div><dt>Uploaded</dt><dd>{shortDate(order.payment.proof.uploadedAt)}</dd></div>
                </dl>
                <a href={order.payment.proof.signedUrl} target="_blank" rel="noopener noreferrer">Open full proof</a>
              </div>
            ) : order.payment.status !== 'PENDING' ? (
              <p>No uploaded proof is attached.</p>
            ) : null}

            {order.payment.status === 'REJECTED' ? <p>The customer may upload a replacement proof.</p> : null}

            {/* Review is only valid for the exact proof currently displayed. */}
            {['INSTAPAY', 'CASH_ON_DELIVERY'].includes(order.paymentMethod) &&
              order.payment.status === 'PENDING_VERIFICATION' &&
              order.payment.proof &&
              order.canManageOrders && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="ad-primary" disabled={isPending}
                    onClick={() => { setActionMessage(''); setPaymentAction('verify'); }}>Verify Payment</button>
                  <button type="button" className="ad-danger" disabled={isPending}
                    onClick={() => { setActionMessage(''); setPaymentAction('reject'); }}>Reject Payment</button>
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
          <button type="button" className={confirm.status === "CANCELLED" || confirm.status === "REJECTED" ? "ad-danger" : "ad-primary"} disabled={isPending} onClick={handleApplyUpdate}>
            {isPending ? 'Updating…' : confirm.withEmail ? 'Update & Send' : 'Update Status'}
          </button>
          <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      </Modal>
    )}

    {/* ── Payment verification dialog ─────────────────────────────── */}
    {paymentAction === 'verify' && (
      <Modal title={order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Verify COD deposit?' : 'Verify InstaPay payment?'} close={() => setPaymentAction(null)}>
        <p>Mark this payment as verified. This confirms the customer sent the required {order.paymentMethod === 'CASH_ON_DELIVERY' ? 'deposit' : 'amount'}.</p>
        <div className="ad-order-actions">
          <button type="button" className="ad-primary" disabled={isPending} onClick={handleVerifyPayment}>{isPending ? "Verifying…" : "Confirm Verification"}</button>
          <button type="button" onClick={() => setPaymentAction(null)}>Cancel</button>
        </div>
      </Modal>
    )}

    {/* ── Payment rejection dialog ────────────────────────────────── */}
    {paymentAction === 'reject' && (
      <Modal title={order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Reject COD deposit?' : 'Reject InstaPay payment?'} close={() => { if (!isPending) setPaymentAction(null); }}>
        {actionMessage && <p className="cc-feedback" data-tone="danger" role="alert">{actionMessage}</p>}
        <Field label="Rejection reason (required)">
          <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Wrong amount transferred" />
        </Field>
        <div className="ad-order-actions">
          <button type="button" className="ad-danger" disabled={isPending} onClick={handleRejectPayment}>{isPending ? "Rejecting…" : "Reject Payment"}</button>
          <button type="button" onClick={() => setPaymentAction(null)}>Cancel</button>
        </div>
      </Modal>
    )}
  </>;
}
