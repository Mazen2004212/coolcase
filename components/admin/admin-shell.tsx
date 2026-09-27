'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Ticket,
  ChartNoAxesCombined,
  Truck,
  Settings,
  ExternalLink,
  LogOut,
  Menu,
  Briefcase,
  Palette,
  Layers3,
} from 'lucide-react';

import { logoutAction } from '@/lib/auth/actions';
import {
  LOCAL_CART_KEY,
  LOCAL_CART_CHANGE_EVENT,
  LOCAL_BUY_NOW_KEY,
  LOCAL_BUY_NOW_CHANGE_EVENT,
} from '@/lib/cart/local-cart';
import { adminSections, canVisit } from '@/lib/admin/permissions';
import { useAdmin } from './admin-provider';
import { Modal } from './admin-ui';
import { BrandLogo } from '@/components/layout/brand-logo';

const icons = [
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers3,
  Palette,
  Users,
  Ticket,
  ChartNoAxesCombined,
  Truck,
  Settings,
  Briefcase,
];

export function AdminShell({
  children,
}: {
  children: ReactNode;
}) {
  const {
    staff, message,
  } = useAdmin();

  const [drawer, setDrawer] =
    useState(false);

  const pathname = usePathname();
  const router = useRouter();

  const section =
    pathname.split('/')[2] ||
    'dashboard';

  const current =
    adminSections.find(
      (item) =>
        item.toLowerCase().replaceAll(' ', '-') === section
    ) || 'Dashboard';

  async function handleLogout() {
    const result =
      await logoutAction();

    if (!result?.success) {
      return;
    }

    try {
      window.localStorage.removeItem(
        LOCAL_CART_KEY
      );

      window.localStorage.removeItem(
        LOCAL_BUY_NOW_KEY
      );

      window.dispatchEvent(
        new Event(
          LOCAL_CART_CHANGE_EVENT
        )
      );

      window.dispatchEvent(
        new Event(
          LOCAL_BUY_NOW_CHANGE_EVENT
        )
      );
    } catch {
      // Local cart cleanup failure should not block logout.
    }

    router.push('/');
    router.refresh();
  }

  function nav() {
    return (
      <>
        <div className="ad-brand">
          <BrandLogo width={132} height={26} className="brand-logo-on-dark" />

          <span>
            Administration
          </span>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Administration" tabIndex={0}>
          {adminSections
            .filter(
              (item) =>
                canVisit(
                  staff,
                  item
                )
            )
            .map((item) => {
              const Icon =
                icons[
                adminSections.indexOf(
                  item
                )
                ];

              const href =
                item === 'Dashboard'
                  ? '/admin'
                  : `/admin/${item.toLowerCase().replaceAll(' ', '-')}`;

              return (
                <Link
                  key={item}
                  href={href}
                  aria-current={
                    current === item
                      ? 'page'
                      : undefined
                  }
                  onClick={() =>
                    setDrawer(false)
                  }
                >
                  <Icon size={18} />
                  {item}
                </Link>
              );
            })}
        </nav>

        <div className="ad-sidebar-bottom">
          <Link href="/">
            <ExternalLink size={18} />
            View Store
          </Link>

          <button
            type="button"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </>
    );
  }

  if (!staff) {
    return null;
  }

  return (
    <div className="ad-root">
      <a
        href="#admin-main"
        className="skip-link"
      >
        Skip to admin content
      </a>

      <aside className="ad-sidebar">
        {nav()}
      </aside>

      {drawer ? (
        <Modal
          title="Administration"
          close={() =>
            setDrawer(false)
          }
        >
          <div className="ad-drawer">
            {nav()}
          </div>
        </Modal>
      ) : null}

      <div className="ad-workspace">
        <header className="ad-topbar">
          <div className="ad-actions">
            <button
              type="button"
              className="ad-menu"
              aria-label="Open admin navigation"
              onClick={() =>
                setDrawer(true)
              }
            >
              <Menu size={20} />
            </button>

            <span>
              Store overview
            </span>
          </div>

          <div className="ad-user">
            <span>{staff.role === 'OWNER' ? 'Owner' : staff.role === 'ORDER_STAFF' ? 'Order Staff' : 'Manager'}</span>
            <small title={staff.displayName}>{staff.displayName}</small>
          </div>
        </header>

        <main
          id="admin-main"
          className="ad-main"
        >

          {message && <p className="cc-feedback" data-tone="success" role="status">{message}</p>}
          {canVisit(
            staff,
            current
          ) ? (
            children
          ) : (
            <section className="ad-panel">
              <h1>
                Access Denied
              </h1>

              <p>
                You do not have permission
                to view this page.
              </p>

              <Link
                href={
                  staff.role ===
                    'ORDER_STAFF'
                    ? '/admin/orders'
                    : '/admin'
                }
              >
                Go to your
                workspace
              </Link>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
