import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function StatementBanner() {
  return (
    <section
      id="statement"
      className="statement-banner"
      aria-label="Escape boring style campaign"
    >
      <Image
        src="/assets/banners/statement-banner.png"
        alt="Coolcase Escape Boring Style campaign with expressive cases and two models"
        fill
        sizes="100vw"
      />
      <Link href="/shop" prefetch={false} className="statement-banner-link">
        Explore Cases
        <ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} />
      </Link>
    </section>
  );
}
