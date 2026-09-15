import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomer } from '@/lib/auth/user';
import { AdminProvider } from '@/components/admin/admin-provider';
import { AdminShell } from '@/components/admin/admin-shell';
import './admin.css';

export const metadata = { title: 'Administration', robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Explicit server-only local preview flag. Never enable on a public deployment.
  // Backend phase: keep this server role check and authorize every data mutation.
  const demo = process.env.ADMIN_DEMO_MODE === 'true';
  if (!demo) {
    const customer = await getCustomer();
    if (!customer) redirect('/login?next=/admin');
    if (customer.profile?.role !== 'ADMIN') return <main style={{ padding: 40 }}><h1>Admin access required</h1><p>This account does not have access to administration.</p><Link href="/">Return to store</Link></main>;
  }
  return <AdminProvider demo={demo}><AdminShell demo={demo}>{children}</AdminShell></AdminProvider>;
}
