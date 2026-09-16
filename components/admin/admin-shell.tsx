'use client';
import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Package, Users, Ticket, ChartNoAxesCombined, Truck, Settings, ExternalLink, LogOut, Menu } from 'lucide-react';
import { adminSections, canVisit } from '@/lib/admin/permissions';
import type { AdminRole } from '@/lib/admin/types';
import { useAdmin } from './admin-provider';
import { logoutAction } from '@/lib/auth/actions';
import { Modal } from './admin-ui';

const icons = [LayoutDashboard, ShoppingBag, Package, Users, Ticket, ChartNoAxesCombined, Truck, Settings];
export function AdminShell({ children, demo }: { children: ReactNode; demo: boolean }) {
  const { role, setRole, message, notify } = useAdmin(); const [drawer, setDrawer] = useState(false); const [choice, setChoice] = useState<AdminRole>('Owner');
  const pathname = usePathname(); const router = useRouter();
  const section = pathname.split('/')[2] || 'dashboard';
  const current = adminSections.find(s => s.toLowerCase() === section) || 'Dashboard';
  function nav() { return <><div className="ad-brand"><Image src="/assets/logo/coolcase-logo.png" alt="Coolcase" width={130} height={24} style={{ height: 24, width: 'auto', objectFit: 'contain', display: 'block' }} /><span>Administration</span></div><nav aria-label="Administration">{adminSections.filter(s => role && canVisit(role, s)).map(s => { const Icon = icons[adminSections.indexOf(s)]; const href = s === 'Dashboard' ? '/admin' : `/admin/${s.toLowerCase()}`; return <Link key={s} href={href} aria-current={current === s ? 'page' : undefined} onClick={() => setDrawer(false)}><Icon size={18} />{s}</Link>; })}</nav><div className="ad-sidebar-bottom"><Link href="/"><ExternalLink size={18} />View Store</Link>{demo ? <button onClick={() => { setDrawer(false); setRole(null); notify(''); }}><LogOut size={18} />Logout</button> : <form action={logoutAction}><button type="submit"><LogOut size={18} />Logout</button></form>}</div></>; }
  if (!role) return <div className="ad-root ad-gate"><div className="ad-panel"><div className="ad-brand"><Image src="/assets/logo/coolcase-logo.png" alt="Coolcase" width={130} height={24} style={{ height: 24, width: 'auto', objectFit: 'contain', display: 'block' }} /><span>Admin frontend preview</span></div><h1>{demo ? 'Explore the workspace' : 'Workspace locked'}</h1><p>Sample data only. Changes last until this page is reloaded. Preview roles demonstrate the interface and are not authorization.</p><label className="ad-field">Preview role<select value={choice} onChange={e => setChoice(e.target.value as AdminRole)}>{(['Owner', 'Manager', 'Order Staff'] as const).map(r => <option key={r}>{r}</option>)}</select></label><button className="ad-primary" onClick={() => { setRole(choice); if (!canVisit(choice, current)) router.push(choice === 'Order Staff' ? '/admin/orders' : '/admin'); }}>Enter demo workspace</button><Link href="/">Return to store</Link></div></div>;
  return <div className="ad-root"><a href="#admin-main" className="skip-link">Skip to admin content</a><aside className="ad-sidebar">{nav()}</aside>{drawer && <Modal title="Administration" close={() => setDrawer(false)}><div className="ad-drawer">{nav()}</div></Modal>}<div className="ad-workspace"><header className="ad-topbar"><div className="ad-actions"><button className="ad-menu" aria-label="Open admin navigation" onClick={() => setDrawer(true)}><Menu size={20} /></button><span>Store overview</span>{demo && <span className="ad-pill">Demo workspace</span>}</div><span>{role}</span></header><main id="admin-main" className="ad-main">{demo && <p className="ad-demo">Demo data · Changes stay in this preview and reset on reload.</p>}{message && <div className="ad-notice" role="status">{message}<button aria-label="Dismiss notification" onClick={() => notify('')}>×</button></div>}{canVisit(role, current) ? children : <section className="ad-panel"><h1>Not available for this preview role</h1><p>Switch roles by leaving the demo workspace.</p><Link href={role === 'Order Staff' ? '/admin/orders' : '/admin'}>Go to your workspace</Link></section>}</main></div></div>;
}
