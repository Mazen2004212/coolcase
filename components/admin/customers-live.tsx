'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { money, shortDate } from '@/lib/admin/analytics';
import { Empty, Field, PageHeading, Panel, Table } from './admin-ui';
import { fetchAdminCustomers, fetchAdminCustomer, type AdminCustomer } from '@/app/admin/actions/customers';

export function CustomersListLive() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchAdminCustomers()
      .then(d => { if (active) setCustomers(d); })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = customers.filter(c => 
    `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()) && 
    (filter === 'All' || c.totalOrders > 1)
  );

  return (
    <>
      <PageHeading title="Customers" description="Customer relationships and order history." />
      <Panel title={`${filtered.length} customers`}>
        <div className="ad-filters">
          <Field label="Search customers">
            <input placeholder="Name, email, or phone" value={search} onChange={e => setSearch(e.target.value)} />
          </Field>
          <Field label="Customer filter">
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option>All</option>
              <option>Returning</option>
            </select>
          </Field>
        </div>
        
        {loading ? (
          <p style={{ padding: 40 }}>Loading customers...</p>
        ) : (
          <>
            <Table headings={['Name', 'Email', 'Phone', 'Total orders', 'Total spent', 'Last order', 'Customer since', 'Actions']}>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.email || '—'}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.totalOrders}</td>
                  <td>{money(c.totalSpent)}</td>
                  <td>{c.lastOrder ? shortDate(c.lastOrder) : 'No orders'}</td>
                  <td>{shortDate(c.since)}</td>
                  <td><Link href={`/admin/customers/${c.id}`}>View customer</Link></td>
                </tr>
              ))}
            </Table>
            {!filtered.length && <Empty />}
          </>
        )}
      </Panel>
    </>
  );
}

export function CustomerDetailLive({ id }: { id: string }) {
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchAdminCustomer(id)
      .then(d => { if (active) setCustomer(d); })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <p style={{ padding: 40 }}>Loading customer...</p>;
  if (!customer) return <Empty>Customer not found. <Link href="/admin/customers">Back to customers</Link></Empty>;

  return (
    <>
      <PageHeading 
        title={customer.name} 
        description={`Customer since ${shortDate(customer.since)}`} 
      />
      <div className="ad-kpis">
        <div><span>Total orders</span><strong>{customer.totalOrders}</strong></div>
        <div><span>Total spent</span><strong>{money(customer.totalSpent)}</strong></div>
        <div><span>Average order value</span><strong>{money(customer.averageOrder)}</strong></div>
        <div><span>Last order</span><strong>{customer.lastOrder ? shortDate(customer.lastOrder) : 'No orders'}</strong></div>
      </div>
      <div className="ad-two">
        <Panel title="Contact details">
          <h3>{customer.name}</h3>
          <p>{customer.email || 'No email'}</p>
          <p>{customer.phone || 'No phone'}</p>
          <Link href={`/admin/orders?customer=${id}`}>View Orders</Link>
        </Panel>
        <Panel title="Saved addresses">
          {customer.addresses.length > 0 ? (
            customer.addresses.map((a, i) => <p key={i}>{a}</p>)
          ) : (
            <p>No saved addresses.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
