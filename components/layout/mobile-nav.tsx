"use client";

import { Search, ShoppingBag, UserRound, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { SiteNavItem } from "@/lib/data/homepage";

type MobileNavProps = {
  items: readonly SiteNavItem[];
};

export function MobileNav({ items }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        className="flex size-11 items-center justify-center rounded-[var(--button-radius)] text-white hover:bg-white/10"
        aria-controls="mobile-navigation"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? (
          <X aria-hidden="true" className="size-5" strokeWidth={1.8} />
        ) : (
          <Menu aria-hidden="true" className="size-5" strokeWidth={1.8} />
        )}
      </button>

      {isOpen ? (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full border-t border-white/15 bg-surface-black px-5 pb-7 pt-4 shadow-2xl"
        >
          <nav aria-label="Mobile navigation">
            <ul className="divide-y divide-white/10">
              {items.map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <Link
                    href={item.href}
                    className="flex min-h-12 items-center text-base font-medium text-white/90 hover:text-white"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-5">
            <button
              type="button"
              disabled
              className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--button-radius)] border border-white/15 text-sm text-white/45"
              aria-label="Search is available in a later phase"
            >
              <Search aria-hidden="true" className="size-4" strokeWidth={1.8} />
              Search
            </button>
            <Link
              href="/login"
              prefetch={false}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--button-radius)] border border-white/15 text-sm text-white"
              onClick={closeMenu}
            >
              <UserRound aria-hidden="true" className="size-4" strokeWidth={1.8} />
              Account
            </Link>
            <Link
              href="/cart"
              prefetch={false}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--button-radius)] border border-white/15 text-sm text-white"
              onClick={closeMenu}
            >
              <ShoppingBag aria-hidden="true" className="size-4" strokeWidth={1.8} />
              Cart (0)
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
