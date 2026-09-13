import { Search, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";

import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteContainer } from "@/components/layout/site-container";
import { siteNavigation } from "@/lib/data/homepage";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 h-[var(--header-height)] bg-surface-black text-white">
      <SiteContainer className="relative flex h-full items-center justify-between gap-6">
        <Link
          href="#top"
          className="shrink-0 text-[1.375rem] font-semibold tracking-[-0.04em]"
          aria-label="Coolcase home"
        >
          Coolcase
        </Link>

        <nav aria-label="Primary navigation" className="hidden min-w-0 lg:block">
          <ul className="flex items-center gap-4 xl:gap-6">
            {siteNavigation.map((item, index) => (
              <li key={`${item.label}-${item.href}`}>
                <Link
                  href={item.href}
                  className="relative block py-3 text-xs font-medium text-white/75 transition-colors hover:text-white xl:text-[0.8125rem]"
                >
                  {item.label}
                  {index === 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-1 h-px bg-white"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          <button
            type="button"
            disabled
            className="flex size-11 items-center justify-center rounded-[var(--button-radius)] text-white/45"
            aria-label="Search is available in a later phase"
          >
            <Search aria-hidden="true" className="size-5" strokeWidth={1.7} />
          </button>
          <Link
            href="/login"
            prefetch={false}
            className="flex size-11 items-center justify-center rounded-[var(--button-radius)] hover:bg-white/10"
            aria-label="Account"
          >
            <UserRound aria-hidden="true" className="size-5" strokeWidth={1.7} />
          </Link>
          <Link
            href="/cart"
            prefetch={false}
            className="relative flex size-11 items-center justify-center rounded-[var(--button-radius)] hover:bg-white/10"
            aria-label="Cart, 0 items"
          >
            <ShoppingBag aria-hidden="true" className="size-5" strokeWidth={1.7} />
            <span
              aria-hidden="true"
              className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-white text-[0.625rem] font-bold text-black"
            >
              0
            </span>
          </Link>
        </div>

        <MobileNav items={siteNavigation} />
      </SiteContainer>
    </header>
  );
}
