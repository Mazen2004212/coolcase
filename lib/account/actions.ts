"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { joinCityArea } from "@/lib/account/address";
import { requireCustomer } from "@/lib/auth/user";

export type AccountActionState = { status: "idle" | "success" | "error"; message?: string; fieldErrors?: Record<string, string[]> };
const text = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const addressSchema = z.object({
  addressId: z.string().uuid().optional(), label: z.enum(["Home", "Work", "Other"]).default("Home"),
  governorate: z.enum(["Cairo", "Giza"], { error: "Governorate is required" }), city: text("City", 100), area: text("Area", 100),
  street: text("Street", 200), building: text("Building", 50), floor: z.string().trim().max(50).default(""),
  apartment: z.string().trim().max(50).default(""), landmark: z.string().trim().max(160).default(""),
  isDefault: z.string().optional(),
});

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }
function invalid(error: z.ZodError): AccountActionState { return { status: "error", message: "Check the highlighted fields.", fieldErrors: error.flatten().fieldErrors }; }

export async function updateProfileAction(_state: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const parsed = z.object({ fullName: text("Full name", 120), phone: text("Phone", 32) }).safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { user, supabase } = await requireCustomer("/account/profile");
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName, phone: parsed.data.phone }).eq("id", user.id);
  if (error) return { status: "error", message: "We couldn’t update your profile." };
  revalidatePath("/account"); revalidatePath("/account/profile"); revalidatePath("/checkout");
  return { status: "success", message: "Profile updated." };
}

async function saveAddress(formData: FormData, editing: boolean): Promise<AccountActionState> {
  const parsed = addressSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (editing && !parsed.data.addressId) return { status: "error", message: "Address not found." };
  const { user, profile, supabase } = await requireCustomer("/account/addresses");
  const payload = { user_id: user.id, label: parsed.data.label, recipient_name: profile?.full_name || user.email || "Customer", phone: profile?.phone || "Not provided", governorate: parsed.data.governorate, city_area: joinCityArea(parsed.data.city, parsed.data.area), street_name: parsed.data.street, building_number: parsed.data.building, floor: parsed.data.floor || null, apartment: parsed.data.apartment || null, landmark: parsed.data.landmark || null, delivery_notes: null, is_default: false };
  let addressId = parsed.data.addressId;
  if (editing) {
    const { data, error } = await supabase.from("addresses").update(payload).eq("id", addressId!).eq("user_id", user.id).select("id").single();
    if (error) return { status: "error", message: "We couldn’t update this address." };
    addressId = data.id;
  } else {
    const { data: duplicate } = await supabase.from("addresses").select("id").eq("user_id", user.id).eq("governorate", payload.governorate).eq("city_area", payload.city_area).eq("street_name", payload.street_name).eq("building_number", payload.building_number).maybeSingle();
    if (duplicate) return { status: "error", message: "This address is already saved." };
    const { data, error } = await supabase.from("addresses").insert(payload).select("id").single();
    if (error) return { status: "error", message: "We couldn’t save this address." };
    addressId = data.id;
  }
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (parsed.data.isDefault === "on" || count === 1) {
    const { error } = await supabase.rpc("set_default_address", { target_address_id: addressId! });
    if (error) return { status: "error", message: "Address saved, but it could not be made the default." };
  }
  revalidatePath("/account/addresses"); revalidatePath("/checkout");
  return { status: "success", message: editing ? "Address updated." : "Address saved." };
}

export async function addAddressAction(state: AccountActionState, formData: FormData) { return saveAddress(formData, false); }
export async function editAddressAction(state: AccountActionState, formData: FormData) { return saveAddress(formData, true); }

export async function setDefaultAddressAction(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("addressId"));
  if (!id.success) return;
  const { supabase } = await requireCustomer("/account/addresses");
  await supabase.rpc("set_default_address", { target_address_id: id.data });
  revalidatePath("/account/addresses"); revalidatePath("/checkout");
}

export async function deleteAddressAction(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("addressId"));
  if (!id.success) return;
  const { user, supabase } = await requireCustomer("/account/addresses");
  const { data: target } = await supabase.from("addresses").select("is_default").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (!target) return;
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (target.is_default && (count || 0) > 1) return;
  await supabase.from("addresses").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/account/addresses"); revalidatePath("/checkout");
}

type CheckoutAddressInput = {
  label: "Home" | "Work" | "Other";
  governorate: string;
  city: string;
  area: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
};

export async function saveCheckoutAddress(input: CheckoutAddressInput) {
  const parsed = addressSchema.omit({ addressId: true, isDefault: true }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Check the new address fields." };
  const data = new FormData(); Object.entries(parsed.data).forEach(([key, value]) => data.set(key, value));
  const result = await saveAddress(data, false);
  return { ok: result.status === "success", message: result.message };
}
