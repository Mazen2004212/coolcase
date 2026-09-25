import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getStaffProfile } from '@/lib/admin/user';
import { getCustomer } from '@/lib/auth/user';
import { AdminProvider } from '@/components/admin/admin-provider';
import { AdminShell } from '@/components/admin/admin-shell';
import './admin.css';

export const metadata = { title: 'Administration', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const customer = await getCustomer();
  if (!customer) {
    redirect('/login');
  }

  const staff = await getStaffProfile();
  
  if (!staff) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Admin access required</h1>
        <p>This account does not have active staff access.</p>
        <Link href="/">Return to store</Link>
      </main>
    );
  }

  return (
    <AdminProvider staff={staff}>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
