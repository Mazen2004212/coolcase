import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";

export const getCustomer = cache(async function getCustomer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, full_name, email, phone, role").eq("id", user.id).maybeSingle();
  return { user, profile, supabase };
});

export async function requireCustomer(next = "/account") {
  const customer = await getCustomer();
  if (!customer) redirect(`/login?next=${encodeURIComponent(safeNextPath(next))}`);
  return customer;
}
