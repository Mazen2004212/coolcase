import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type SectionHeadingProps = {
  children: ReactNode;
  className?: string;
  description?: string;
  id?: string;
};

export function SectionHeading({
  children,
  className,
  description,
  id,
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <h2 id={id} className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
        {children}
      </h2>
      {description ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}
