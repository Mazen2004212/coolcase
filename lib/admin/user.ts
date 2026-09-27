import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/auth/user";
import type { StaffProfile } from "./types";

export const getStaffProfile = cache(async function getStaffProfile(): Promise<StaffProfile | null> {
  const customer = await getCustomer();
  if (!customer) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_staff")
    .select("role, permissions, is_active")
    .eq("user_id", customer.user.id)
    .maybeSingle();

  if (!data || !data.is_active) return null;

  return {
    userId: customer.user.id,
    role: data.role as 'OWNER' | 'MANAGER' | 'ORDER_STAFF',
    permissions: data.permissions as string[],
    isActive: data.is_active,
    displayName: customer.profile?.full_name?.trim() || customer.profile?.email || customer.user.email || 'Staff account',
  };
});
