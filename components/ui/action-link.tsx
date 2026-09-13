import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

type ActionLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  tone?: "dark" | "light";
};

export function ActionLink({
  children,
  className,
  tone = "dark",
  ...props
}: ActionLinkProps) {
  return (
    <Link
      prefetch={false}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-3 rounded-[var(--button-radius)] px-6 text-sm font-semibold transition-colors",
        tone === "dark"
          ? "bg-surface-black text-white hover:bg-neutral-800"
          : "bg-white text-black hover:bg-neutral-200",
        className,
      )}
      {...props}
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.8} />
    </Link>
  );
}
