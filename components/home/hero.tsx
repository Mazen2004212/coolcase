import Image from "next/image";
import { Layers3, PackageCheck, ShieldCheck } from "lucide-react";

import { SiteContainer } from "@/components/layout/site-container";
import { ActionLink } from "@/components/ui/action-link";

const HERO_POSTER = "/assets/hero/hero-poster.png";

const heroBenefits = [
  { icon: ShieldCheck, label: "Protective Design" },
  { icon: Layers3, label: "Premium Materials" },
  { icon: PackageCheck, label: "Fast Order Processing" },
] as const;

export function Hero() {
  return (
    <section className="bg-surface-black text-white" aria-labelledby="hero-title">
      <SiteContainer className="grid gap-8 py-10 md:py-12 lg:grid-cols-[0.68fr_1fr] lg:items-center lg:gap-8 lg:py-8 xl:grid-cols-[0.7fr_1fr]">
        <div className="lg:py-3">
          <p className="mb-5 text-[0.625rem] font-semibold uppercase tracking-[0.42em] text-white/55 sm:text-[0.6875rem]">
            More than a case
          </p>
          <h1
            id="hero-title"
            className="text-[clamp(3.15rem,5vw,4.75rem)] font-semibold leading-[0.9] tracking-[-0.06em]"
          >
            Style.
            <br />
            Protection.
            <br />
            You.
          </h1>
          <p className="mt-6 max-w-md text-[0.9375rem] leading-6 text-white/68 sm:text-base">
            Premium phone cases designed for real life.
            <br className="hidden sm:block" /> Express your style. Keep your
            phone safe.
          </p>
          <ActionLink href="#featured" tone="light" className="mt-7">
            Shop Now
          </ActionLink>

          <ul className="mt-8 hidden grid-cols-3 gap-4 border-t border-white/15 pt-5 lg:grid">
            {heroBenefits.map((benefit) => {
              const Icon = benefit.icon;

              return (
                <li key={benefit.label} className="flex min-w-0 items-center gap-2.5">
                  <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.5} />
                  <span className="text-[0.6875rem] font-medium leading-4 text-white/78">
                    {benefit.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-[var(--card-radius)] border border-white/10 bg-[#111111]">
          <Image
            src={HERO_POSTER}
            alt="A black phone case held in front of a mountain lake"
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover object-[52%_50%]"
          />
        </div>
      </SiteContainer>
    </section>
  );
}
