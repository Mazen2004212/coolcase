import type { Metadata } from "next";
import { NamedCaseBuilder } from "@/components/custom-cases/named-case-builder";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ErrorState } from "@/components/ui/feedback";
import {
  FIXED_NAMED_CASE_IMAGE,
  FIXED_NAMED_CASE_TEMPLATE_ID,
  type NamedCaseTemplate,
} from "@/lib/custom-cases/templates";
import { createClient } from "@/lib/supabase/server";

import "@/app/products/[slug]/product.css";
import "../custom-cases.css";

export const metadata: Metadata = {
  title: "Named Custom Case",
  description: "Choose a design and personalize your phone case with your name.",
};

export default async function NamedCustomCasePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_case_templates")
    .select("*")
    .eq("id", FIXED_NAMED_CASE_TEMPLATE_ID)
    .eq("is_active", true)
    .maybeSingle();

  const template = data
    ? { ...(data as NamedCaseTemplate), imageUrl: FIXED_NAMED_CASE_IMAGE }
    : null;

  return (
    <div id="top">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className="custom-cases-page named-case-page">
        <SiteContainer>
          {error || !template ? (
            <section className="named-template-section" aria-label="Named case designs">
              <ErrorState href="/custom-cases/named">
                We couldn’t load this named case. Please retry.
              </ErrorState>
            </section>
          ) : (
            <NamedCaseBuilder template={template} />
          )}
        </SiteContainer>
      </main>
      <SiteFooter />
    </div>
  );
}
