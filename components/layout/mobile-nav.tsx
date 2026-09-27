"use client";

import { Menu, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type { SiteNavItem } from "@/lib/data/homepage";

type MobileNavProps = {
  items: readonly SiteNavItem[];
  accountHref?: string;
};

export function MobileNav({ items, accountHref = "/login" }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !isOpen) return;

      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) firstLinkRef.current?.focus();
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !menuRef.current) return;

    const items = Array.from(
      menuRef.current.querySelectorAll<HTMLElement>("a, button"),
    );
    const first = items[0];
    const last = items.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        className="flex size-11 items-center justify-center rounded-[var(--button-radius)] text-[var(--cc-text-on-dark)] hover:bg-[var(--cc-chrome-darker)]"
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
          ref={menuRef}
          id="mobile-navigation"
          onKeyDown={trapFocus}
          className="absolute inset-x-0 top-full border-t border-white/20 bg-[var(--cc-chrome)] px-5 pb-7 pt-4 shadow-xl"
        >
          <nav aria-label="Mobile navigation">
            <ul className="divide-y divide-white/20">
              {items.map((item, index) => (
                <li key={`${item.label}-${item.href}`}>
                  <Link
                    ref={index === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    prefetch={false}
                    className="flex min-h-12 items-center text-base font-medium text-[var(--cc-text-on-dark)] hover:text-white"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/20 pt-5">
            <Link
              href="/search"
              prefetch={false}
              onClick={closeMenu}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--button-radius)] border border-white/35 text-sm text-[var(--cc-text-on-dark)] hover:bg-[var(--cc-chrome-darker)]"
            >
              <Search aria-hidden="true" className="size-4" strokeWidth={1.8} />
              Search
            </Link>
            <Link
              href={accountHref}
              prefetch={false}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--button-radius)] border border-white/35 text-sm text-[var(--cc-text-on-dark)] hover:bg-[var(--cc-chrome-darker)]"
              onClick={closeMenu}
            >
              <UserRound aria-hidden="true" className="size-4" strokeWidth={1.8} />
              Account
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
