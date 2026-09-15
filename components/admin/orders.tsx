'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { orderStatuses, paymentStatuses, type AdminOrder, type AdminOrderShipping, type OrderStatus, type PaymentStatus } from '@/lib/admin/types';
import { money, shortDate, subtotal, total } from '@/lib/admin/analytics';
import { getOrderStatusEmail } from '@/lib/admin/email-templates';
import { materialOptions } from '@/lib/data/product-options';
import { useAdmin } from './admin-provider';
import { Confirm, Empty, Field, Modal, PageHeading, Panel, Pill, Table, Thumb } from './admin-ui';

/** Allowed forward status transitions. Terminal statuses have no entry. */
const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  'Pending Approval': ['Confirmed', 'Rejected', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Shipped', 'Cancelled'],
  Shipped: ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Cancelled'],
};

const TRANSITION_LABELS: Partial<Record<OrderStatus, string>> = {
  Confirmed: 'Confirm Order', Rejected: 'Reject Order', Preparing: 'Mark Preparing',
  Shipped: 'Mark Shipped', 'Out for Delivery': 'Mark Out for Delivery',
  Delivered: 'Mark Delivered', Cancelled: 'Cancel Order',
};

const TERMINAL: OrderStatus[] = ['Delivered', 'Cancelled', 'Rejected'];

export function OrderTable({ orders, compact = false }: { orders: AdminOrder[]; compact?: boolean }) {
  const { data } = useAdmin();
  return <>{!orders.length ? <Empty /> : <Table headings={compact ? ['Order', 'Customer', 'Date', 'Total', 'Payment', 'Status', 'Actions'] : ['Order', 'Customer', 'Phone', 'Date', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total', 'Method', 'Payment', 'Status', 'Actions']}>{orders.map(o => { const customer = data.customers.find(c => c.id === o.customerId); return <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`}>{o.id}</Link></td><td>{customer?.name}</td>{!compact && <td>{customer?.phone}</td>}<td>{shortDate(o.date)}</td>{!compact && <><td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td><td>{money(subtotal(o))}</td><td>{money(o.discount)}</td><td>{money(o.shipping)}</td></>}<td><strong>{money(total(o))}</strong></td>{!compact && <td>{o.paymentMethod}</td>}<td><Pill>{o.paymentStatus}</Pill></td><td><Pill>{o.status}</Pill></td><td><Link href={`/admin/orders/${o.id}`}>Open order</Link></td></tr>; })}</Table>}</>;
}

export function OrdersList() {
  const { data } = useAdmin(); const params = useSearchParams(); const [status, setStatus] = useState(params.get('status') || ''); const [search, setSearch] = useState(''); const [payment, setPayment] = useState(''); const [method, setMethod] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const filtered = data.orders.filter(o => { const c = data.customers.find(c => c.id === o.customerId); return (!status || o.status === status) && (!payment || o.paymentStatus === payment) && (!method || o.paymentMethod === method) && (!from || o.date.slice(0, 10) >= from) && (!to || o.date.slice(0, 10) <= to) && `${o.id} ${c?.name} ${c?.phone}`.toLowerCase().includes(search.toLowerCase()); });
  return <><PageHeading title="Orders" description="Review payments and move orders through fulfillment." /><div className="ad-tabs" role="group" aria-label="Order status filters">{['All', ...orderStatuses].map(s => <button key={s} aria-pressed={status === (s === 'All' ? '' : s)} onClick={() => setStatus(s === 'All' ? '' : s)}>{s}</button>)}</div><Panel title={`${filtered.length} orders`}><div className="ad-filters"><Field label="Search orders"><input placeholder="Order ID, customer, or phone" value={search} onChange={e => setSearch(e.target.value)} /></Field><Field label="Payment status"><select value={payment} onChange={e => setPayment(e.target.value)}><option value="">All payment statuses</option>{paymentStatuses.map(p => <option key={p}>{p}</option>)}</select></Field><Field label="Payment method"><select value={method} onChange={e => setMethod(e.target.value)}><option value="">All methods</option><option>COD</option><option>InstaPay</option></select></Field><Field label="From date"><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="To date"><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></Field></div><OrderTable orders={filtered} /></Panel></>;
}

export function OrderDetail({ id }: { id: string }) {
  const { data, update } = useAdmin();
  const order = data.orders.find(o => o.id === id);
  const customer = data.customers.find(c => c.id === order?.customerId);
  const customerEmail = customer?.email ?? '';
  const hasEmail = Boolean(customerEmail);

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [shippingDraft, setShippingDraft] = useState<AdminOrderShipping>(
    () => order?.shippingInfo ?? { courier: '', trackingNumber: '', currentLocation: '', shippingNotes: '' }
  );
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<{ status: OrderStatus; withEmail: boolean } | null>(null);
  const [paymentConfirm, setPaymentConfirm] = useState<PaymentStatus | null>(null);

  /** Auto-recomputes whenever admin changes pendingStatus or edits any shipping field */
  const emailPreview = useMemo(() => {
    if (!pendingStatus || !order) return null;
    return getOrderStatusEmail({
      status: pendingStatus,
      customerName: customer?.name ?? '',
      orderReference: order.id,
      total: total(order),
      paymentMethod: order.paymentMethod,
      shippingInfo: shippingDraft,
    });
  }, [pendingStatus, customer, order, shippingDraft]);

  if (!order) return <Empty>Order not found. <Link href="/admin/orders">Back to orders</Link></Empty>;

  const isTerminal = TERMINAL.includes(order.status);
  const availableTransitions = TRANSITIONS[order.status] ?? [];
  const canSendEmail = hasEmail && emailPreview !== null;

  function setSd(key: keyof AdminOrderShipping, value: string) {
    setShippingDraft(d => ({ ...d, [key]: value }));
  }

  function saveShipping() {
    update(`Updated shipping info for ${id}.`, d => ({
      ...d,
      orders: d.orders.map(o => o.id === id ? { ...o, shippingInfo: { ...shippingDraft } } : o),
    }));
  }

  function applyUpdate() {
    if (!confirm) return;
    const { status: newStatus, withEmail } = confirm;
    const date = new Date().toISOString();
    const msg = withEmail
      ? `Updated ${id} to ${newStatus}. Email preview prepared — delivery connects during backend integration.`
      : `Updated ${id} to ${newStatus} without customer email.`;
    update(msg, d => ({
      ...d,
      orders: d.orders.map(o => o.id === id
        ? { ...o, status: newStatus, shippingInfo: { ...shippingDraft }, history: [...o.history, { status: newStatus, date }] }
        : o
      ),
    }));
    setPendingStatus(null);
    setConfirm(null);
  }

  return <>
    <PageHeading title={order.id} description={`${shortDate(order.date)} · ${customer?.name}`} action={<Link href="/admin/orders">Back to orders</Link>} />
    <div className="ad-actions ad-order-status"><Pill>{order.status}</Pill><Pill>{order.paymentStatus}</Pill></div>
    <div className="ad-editor">
      <div className="ad-stack">

        {/* ── Ordered items ─────────────────────────────────────────── */}
        <Panel title="Ordered items">
          <Table headings={['Product', 'Device', 'Material', 'Quantity', 'Unit price', 'Line total']}>
            {order.items.map((i, index) => <tr key={index}><td><div className="ad-product-cell"><Thumb src={i.image} alt={i.name} />{i.name}</div></td><td>{i.model}<small>{i.network}</small></td><td>{materialOptions[i.material].label}</td><td>{i.quantity}</td><td>{money(i.unitPrice)}</td><td>{money(i.unitPrice * i.quantity)}</td></tr>)}
          </Table>
          <dl className="ad-totals">
            <div><dt>Subtotal</dt><dd>{money(subtotal(order))}</dd></div>
            <div><dt>Coupon discount</dt><dd>−{money(order.discount)}</dd></div>
            <div><dt>Shipping</dt><dd>{money(order.shipping)}</dd></div>
            <div><dt>Grand Total</dt><dd>{money(total(order))}</dd></div>
          </dl>
        </Panel>

        {/* ── Order management ──────────────────────────────────────── */}
        <Panel title="Order management">
          {/* Current status + pending status indicator */}
          <div className="ad-lifecycle">
            <div><small>Current status</small><div style={{ marginTop: 5 }}><Pill>{order.status}</Pill></div></div>
            {pendingStatus && <><span className="ad-lifecycle-arrow">→</span><div><small>New status</small><div style={{ marginTop: 5 }}><Pill>{pendingStatus}</Pill></div></div></>}
          </div>

          {/* Transition buttons */}
          {isTerminal
            ? <p>This order has reached a final status. No further changes are available.</p>
            : <div className="ad-field"><span>Change status to</span><div className="ad-status-buttons">{availableTransitions.map(s => <button key={s} type="button" className={pendingStatus === s ? 'ad-primary' : ''} onClick={() => setPendingStatus(prev => prev === s ? null : s)}>{TRANSITION_LABELS[s] ?? s}</button>)}</div></div>
          }

          <hr className="ad-section-divider" />

          {/* Shipping details */}
          <div className="ad-shipping-header">
            <h3>Shipping details</h3>
            <button type="button" onClick={saveShipping}>Save shipping</button>
          </div>
          <div className="ad-form-grid">
            <Field label="Courier"><input value={shippingDraft.courier} onChange={e => setSd('courier', e.target.value)} placeholder="e.g. Bosta" /></Field>
            <Field label="Tracking Number"><input value={shippingDraft.trackingNumber} onChange={e => setSd('trackingNumber', e.target.value)} placeholder="e.g. BT12345678" /></Field>
          </div>
          <Field label="Current Location"><input value={shippingDraft.currentLocation} onChange={e => setSd('currentLocation', e.target.value)} placeholder="e.g. Cairo Sorting Center" /></Field>
          <Field label="Shipping Notes (internal — not shown to customer)"><textarea rows={2} value={shippingDraft.shippingNotes} onChange={e => setSd('shippingNotes', e.target.value)} placeholder="Internal notes only" /></Field>

          {/* Email preview — appears when a status is selected */}
          {pendingStatus && <>
            <hr className="ad-section-divider" />
            <div className="ad-email-preview-section">
              <h3>Customer email preview</h3>
              {!hasEmail && <p className="ad-no-email-notice">No customer email address on file. &ldquo;Update &amp; Send Email&rdquo; is disabled for this order.</p>}
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

            {/* Action buttons */}
            <div className="ad-order-actions">
              <button
                type="button"
                className="ad-primary"
                disabled={!canSendEmail}
                title={!hasEmail ? 'No customer email on file for this order' : !emailPreview ? 'No email template available for this status' : undefined}
                onClick={() => setConfirm({ status: pendingStatus, withEmail: true })}
              >
                Update Status &amp; Send Email
              </button>
              <button type="button" onClick={() => setConfirm({ status: pendingStatus, withEmail: false })}>
                Update Without Email
              </button>
              <button type="button" onClick={() => setPendingStatus(null)}>Cancel</button>
            </div>
          </>}

          <hr className="ad-section-divider" />

          {/* Timeline */}
          <h3 style={{ marginBottom: 12 }}>Order timeline</h3>
          <ol className="ad-timeline">
            {order.history.map((event, i) => <li key={i}><Pill>{event.status}</Pill><span>{shortDate(event.date)}</span></li>)}
          </ol>
        </Panel>

        {/* ── Internal notes ────────────────────────────────────────── */}
        <Panel title="Internal notes">
          <form onSubmit={e => { e.preventDefault(); if (!note.trim()) return; update(`Added note to ${id}.`, d => ({ ...d, orders: d.orders.map(o => o.id === id ? { ...o, notes: [...o.notes, { text: note.trim(), date: new Date().toISOString() }] } : o) })); setNote(''); }}>
            <Field label="New internal note"><textarea required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></Field>
            <button type="submit">Save note</button>
          </form>
          {order.notes.map((n, i) => <p className="ad-note" key={i}>{n.text}<small>{shortDate(n.date)}</small></p>)}
        </Panel>
      </div>

      <div className="ad-stack">
        <Panel title="Customer">
          <h3>{customer?.name}</h3>
          <p>{customer?.email || <em>No email on file</em>}</p>
          <p>{customer?.phone}</p>
          <Link href={`/admin/customers/${order.customerId}`}>View customer</Link>
        </Panel>
        <Panel title="Shipping address"><p>{order.address}</p></Panel>
        <Panel title="Payment">
          <h3>{order.paymentMethod}</h3>
          <p>Reference: {order.paymentReference || 'No reference supplied in demo'}</p>
          <Field label="Payment verification status">
            <select value={order.paymentStatus} onChange={e => setPaymentConfirm(e.target.value as PaymentStatus)}>
              {paymentStatuses.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <p>Demo verification only. Production verification requires a server record and audit event.</p>
        </Panel>
      </div>
    </div>

    {/* ── Status update confirmation dialog ─────────────────────────── */}
    {confirm && (
      <Modal
        title={confirm.withEmail ? `Update to "${confirm.status}" and send email?` : `Update to "${confirm.status}" without email?`}
        close={() => setConfirm(null)}
      >
        <p>
          {confirm.withEmail
            ? `The customer will receive a ${confirm.status} email. In demo mode, emails are previewed only — real delivery will connect during backend integration. No email is being sent now.`
            : `The order status will be updated to ${confirm.status}. No email will be sent to the customer.`}
        </p>
        <div className="ad-order-actions">
          <button type="button" className="ad-primary" onClick={applyUpdate}>
            {confirm.withEmail ? 'Update & Send' : 'Update Status'}
          </button>
          <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      </Modal>
    )}

    {/* ── Payment status confirmation dialog ────────────────────────── */}
    {paymentConfirm !== null && (
      <Confirm
        title={`Change payment to "${paymentConfirm}"?`}
        close={() => setPaymentConfirm(null)}
        onConfirm={() => {
          const ps = paymentConfirm;
          update(`Changed ${id} payment status to ${ps}.`, d => ({
            ...d,
            orders: d.orders.map(o => o.id === id ? { ...o, paymentStatus: ps } : o),
          }));
        }}
      />
    )}
  </>;
}
