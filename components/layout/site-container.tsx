import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

type SiteContainerProps = ComponentPropsWithoutRef<"div">;

export function SiteContainer({ className, ...props }: SiteContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[var(--content-max-width)] px-5 sm:px-8 lg:px-12",
        className,
      )}
      {...props}
    />
  );
}
