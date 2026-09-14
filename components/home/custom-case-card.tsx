import { ArrowUpRight, Smartphone } from "lucide-react";
import Link from "next/link";

export function CustomCaseCard() {
  return (
    <article
      className="custom-case-card"
      data-merchandising-tile="custom"
    >
      <Link href="/custom-cases" prefetch={false}>
        <Smartphone
          className="custom-case-mark"
          aria-hidden="true"
          strokeWidth={0.7}
        />
        <div>
          <h3>MAKE IT YOURS.</h3>
          <p>Upload your image. We’ll make the case.</p>
        </div>
        <span>
          Customize · From 239 EGP
          <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.7} />
        </span>
      </Link>
    </article>
  );
}
