'use client';
import { useState } from 'react';
import Link from 'next/link';
import { money, shortDate, summarize } from '@/lib/admin/analytics';
import { useAdmin } from './admin-provider';
import { Empty, Field, PageHeading, Panel, Table } from './admin-ui';
import { OrderTable } from './orders';
import { SendCoupon } from './send-coupon';

export function CustomersList() {
  const { data } = useAdmin(); const [search, setSearch] = useState(''); const [filter, setFilter] = useState('All');
  const customers = data.customers.filter(c => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || data.orders.filter(o => o.customerId === c.id).length > 1));
  return <><PageHeading title="Customers" description="Customer relationships, order history, and offers." /><Panel title={`${customers.length} customers`}><div className="ad-filters"><Field label="Search customers"><input placeholder="Name, email, or phone" value={search} onChange={e => setSearch(e.target.value)} /></Field><Field label="Customer filter"><select value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Returning</option></select></Field></div><Table headings={['Name', 'Email', 'Phone', 'Total orders', 'Total spent', 'Last order', 'Customer since', 'Actions']}>{customers.map(c => { const orders = data.orders.filter(o => o.customerId === c.id); return <tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.email}</td><td>{c.phone}</td><td>{orders.length}</td><td>{money(summarize(orders).revenue)}</td><td>{orders[0] ? shortDate(orders[0].date) : 'No orders'}</td><td>{shortDate(c.since)}</td><td><Link href={`/admin/customers/${c.id}`}>View customer</Link></td></tr>; })}</Table>{!customers.length && <Empty />}</Panel></>;
}
export function CustomerDetail({ id }: { id: string }) {
  const { data } = useAdmin(); const [send, setSend] = useState(false); const customer = data.customers.find(c => c.id === id);
  if (!customer) return <Empty>Customer not found. <Link href="/admin/customers">Back to customers</Link></Empty>;
  const orders = data.orders.filter(o => o.customerId === id); const metrics = summarize(orders);
  return <><PageHeading title={customer.name} description={`Customer since ${shortDate(customer.since)}`} action={<button className="ad-primary" onClick={() => setSend(true)}>Create / Send Coupon</button>} /><div className="ad-kpis"><div><span>Total orders</span><strong>{orders.length}</strong></div><div><span>Total spent</span><strong>{money(metrics.revenue)}</strong></div><div><span>Average order value</span><strong>{money(metrics.average)}</strong></div><div><span>Last order</span><strong>{orders[0] ? shortDate(orders[0].date) : 'No orders'}</strong></div></div><div className="ad-two"><Panel title="Contact details"><h3>{customer.name}</h3><p>{customer.email}</p><p>{customer.phone}</p><a href="#customer-orders">View Orders</a></Panel><Panel title="Saved addresses">{customer.addresses.map(a => <p key={a}>{a}</p>)}<small>Demo address data. Saved address integration is prepared for the backend phase.</small></Panel></div><section id="customer-orders"><Panel title="Order history"><OrderTable orders={orders} compact /></Panel></section><Panel title="Coupon email previews"><p>No emails are sent in this phase.</p>{data.emailPreviews.filter(p => p.customerId === id).map((p, i) => <p key={i}>{data.coupons.find(c => c.id === p.couponId)?.code} · Previewed {shortDate(p.date)}</p>)}<Link href={`/admin/coupons/new?customer=${id}`}>Create customer-specific coupon</Link></Panel>{send && <SendCoupon customerId={id} close={() => setSend(false)} />}</>;
}
