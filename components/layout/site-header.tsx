import { Search, UserRound } from "lucide-react";
import Link from "next/link";
import { CartBadgeLink } from "@/components/cart/cart-badge-link";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteContainer } from "@/components/layout/site-container";
import { siteNavigation } from "@/lib/data/homepage";
import { getCustomer } from "@/lib/auth/user";

export async function SiteHeader() {
  const customer = await getCustomer();
  const accountHref = customer ? "/account" : "/login";
  return (
    <header className="sticky top-0 z-50 h-[var(--header-height)] bg-surface-black text-white">
      <SiteContainer className="relative flex h-full items-center justify-between gap-4">
        <Link href="/" className="brand-wordmark" aria-label="Coolcase home">Coolcase</Link>
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
            className="icon-button hidden hover:bg-white/10 lg:inline-flex"
            aria-label="Search"
          >
            <Search size={20} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <Link
            href={accountHref}
            prefetch={false}
            className="icon-button hidden hover:bg-white/10 lg:inline-flex"
            aria-label="Account"
          >
            <UserRound size={20} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <CartBadgeLink />
          <MobileNav items={siteNavigation} accountHref={accountHref} />
        </div>
      </SiteContainer>
    </header>
  );
}
