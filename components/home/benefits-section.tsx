import { Layers3, LifeBuoy, Palette } from "lucide-react";

import { SiteContainer } from "@/components/layout/site-container";

const benefits = [
  { icon: Layers3, label: "Silicone / Acrylic / Double Layer" },
  { icon: Palette, label: "Your Choice of Design" },
  { icon: LifeBuoy, label: "Help Choosing Your Case" },
] as const;

export function BenefitsSection() {
  return (
    <section className="benefits-section" aria-label="Choosing your Coolcase">
      <SiteContainer className="benefits-grid">
        {benefits.map(({ icon: Icon, label }) => (
          <div key={label} className="benefit">
            <Icon aria-hidden="true" size={19} strokeWidth={1.5} />
            <span>{label}</span>
          </div>
        ))}
      </SiteContainer>
    </section>
  );
}
