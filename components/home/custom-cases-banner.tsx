import Image from "next/image";

import { ActionLink } from "@/components/ui/action-link";

const CUSTOM_CASES_BANNER = "/assets/banners/custom-cases-banner.png";

export function CustomCasesBanner() {
  return (
    <section id="custom-cases" className="bg-surface-black text-white">
      <div className="relative w-full overflow-hidden bg-black">
        <Image
          src={CUSTOM_CASES_BANNER}
          alt="A collection of custom phone cases beside the words Where Style Meets Protection"
          width={2062}
          height={763}
          sizes="100vw"
          className="h-auto w-full lg:h-[clamp(24rem,37vw,32rem)] lg:object-cover lg:object-center"
        />

        <div className="hidden lg:absolute lg:bottom-[7%] lg:right-[7%] lg:block">
          <ActionLink href="/custom-case" tone="light">
            Create Your Case
          </ActionLink>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-8 lg:hidden">
        <ActionLink href="/custom-case" tone="light">
          Create Your Case
        </ActionLink>
      </div>
    </section>
  );
}
