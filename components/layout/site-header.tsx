import { Search } from "lucide-react";
import Link from "next/link";
import { CartBadgeLink } from "@/components/cart/cart-badge-link";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteContainer } from "@/components/layout/site-container";
import { siteNavigation } from "@/lib/data/homepage";
import { getCustomer } from "@/lib/auth/user";
import { getStaffProfile } from "@/lib/admin/user";
import { UserDropdown } from "@/components/layout/user-dropdown";
import { BrandLogo } from "@/components/layout/brand-logo";

export async function SiteHeader() {
  const customer = await getCustomer();
  const staff = await getStaffProfile();
  const dropdownCustomer = customer ? {
    email: customer.profile?.email || customer.user?.email || '',
    fullName: customer.profile?.full_name || '',
  } : null;

  const isStaff = Boolean(staff?.isActive);
  const accountHref = customer ? "/account" : "/login";

  return (
    <header className="site-header sticky top-0 z-50 h-[var(--header-height)] text-[var(--cc-text-on-dark)]">
      <SiteContainer className="relative flex h-full items-center justify-between gap-4">
        <Link href="/" className="brand-wordmark site-header-logo" aria-label="Coolcase home">
          <BrandLogo width={164} height={34} priority />
        </Link>
        <nav aria-label="Primary navigation" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {siteNavigation.map((item) => (
              <li key={item.label}>
                <Link href={item.href} prefetch={false} className="header-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <Link
            href="/search"
            prefetch={false}
            className="icon-button hidden hover:bg-[var(--cc-chrome-darker)] lg:inline-flex"
            aria-label="Search"
          >
            <Search size={20} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <UserDropdown 
            customer={dropdownCustomer} 
            isStaff={isStaff} 
          />
          <CartBadgeLink />
          <MobileNav items={siteNavigation} accountHref={accountHref} isStaff={isStaff} />
        </div>
      </SiteContainer>
    </header>
  );
}
