import Link from "next/link";

import { SiteContainer } from "@/components/layout/site-container";
import { footerGroups } from "@/lib/data/homepage";

export function SiteFooter() {
  return (
    <footer id="footer" className="bg-surface-black py-11 text-white sm:py-12">
      <SiteContainer>
        <div className="grid gap-9 border-b border-white/15 pb-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_repeat(4,0.72fr)] lg:gap-8">
          <div>
            <Link
              href="#top"
              className="text-2xl font-semibold tracking-[-0.05em]"
              aria-label="Coolcase home"
            >
              Coolcase
            </Link>
          </div>

          {footerGroups.map((group) => (
            <nav key={group.label} aria-label={`${group.label} links`}>
              <h2 className="text-sm font-semibold">{group.label}</h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="pt-6 text-xs text-white/45">© Coolcase</p>
      </SiteContainer>
    </footer>
  );
}
