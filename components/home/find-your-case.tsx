import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { SiteContainer } from "@/components/layout/site-container";

const discoveryLinks = [
  { label: "All Cases", href: "/shop" },
  { label: "Custom Cases", href: "/custom-cases" },
  { label: "Collections", href: "/collections" },
] as const;

export function FindYourCase() {
  return (
    <section
      id="discovery"
      className="find-case"
      aria-labelledby="find-case-title"
    >
      <SiteContainer className="find-case-inner">
        <h2 id="find-case-title">Find Your Case</h2>
        <nav aria-label="Find your case">
          <ul>
            {discoveryLinks.map((item) => (
              <li key={item.label}>
                <Link href={item.href} prefetch={false}>
                  {item.label}
                  <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.7} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </SiteContainer>
    </section>
  );
}
