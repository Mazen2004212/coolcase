import { Layers3, PackageCheck, ScanSearch, Sparkles } from "lucide-react";

import { SiteContainer } from "@/components/layout/site-container";

const benefits = [
  {
    description: "Thoughtful material choices",
    icon: Layers3,
    title: "Premium Materials",
  },
  {
    description: "Designed for daily routines",
    icon: Sparkles,
    title: "Made for Everyday Use",
  },
  {
    description: "A clear, careful workflow",
    icon: PackageCheck,
    title: "Fast Order Processing",
  },
  {
    description: "Follow every order stage",
    icon: ScanSearch,
    title: "Easy Order Tracking",
  },
] as const;

export function BenefitsSection() {
  return (
    <section
      className="border-y border-border bg-white py-10"
      aria-labelledby="benefits-title"
    >
      <SiteContainer>
        <h2 id="benefits-title" className="sr-only">
          The Coolcase experience
        </h2>
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <article key={benefit.title} className="flex items-center gap-4">
                <Icon
                  aria-hidden="true"
                  className="size-8 shrink-0"
                  strokeWidth={1.45}
                />
                <div>
                  <h3 className="text-sm font-semibold">{benefit.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </SiteContainer>
    </section>
  );
}
