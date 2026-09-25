"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, formValues, loginSchema, resetPasswordSchema, signupSchema } from "@/lib/auth/validation";
import { safeNextPath } from "@/lib/auth/redirect";

export type AuthActionState = { status: "idle" | "error" | "success"; message?: string; email?: string; fieldErrors?: Record<string, string[]> };

function signupErrorMessage(code?: string) {
  if (code === "over_email_send_rate_limit") {
    return "Confirmation emails are temporarily rate-limited. Please wait about an hour, then try again.";
  }
  if (code === "user_already_exists") return "An account with this email already exists.";
  if (code === "signup_disabled") return "Account creation is temporarily unavailable.";
  return "We couldn’t create your account. Check your details and try again.";
}

function validationState(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): AuthActionState {
  return { status: "error", message: "Check the highlighted fields.", fieldErrors: error.flatten().fieldErrors };
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return configured || requestHeaders.get("origin") || "http://localhost:3000";
}

export async function signupAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationState(parsed.error);
  const { fullName, phone, email, password, governorate, city, area, street, building, floor, apartment, landmark } = parsed.data;
  const next = safeNextPath(formData.get("next"));
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`, data: { full_name: fullName, phone, governorate, city, area, street, building, floor, apartment, landmark } } });
    if (error) return { status: "error", message: signupErrorMessage(error.code) };
    if (data.session) redirect(next);
    return { status: "success", email };
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    return { status: "error", message: "Authentication is temporarily unavailable. Please try again." };
  }
}

export async function loginAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationState(parsed.error);
  let next = safeNextPath(formData.get("next"));
  try {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { status: "error", message: error.code === "email_not_confirmed" ? "Confirm your email before logging in." : "Email or password is incorrect." };

    if (data?.user) {
      const { data: staff } = await supabase.from('admin_staff').select('is_active').eq('user_id', data.user.id).maybeSingle();
      if (staff?.is_active && next === '/') {
        next = '/admin';
      }
    }
  } catch (err) { 
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err; // rethrow nextjs redirect if we somehow use it inside try
    return { status: "error", message: "Login is temporarily unavailable. Please try again." }; 
  }
  redirect(next);
}

export async function forgotPasswordAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationState(parsed.error);
  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${await requestOrigin()}/auth/callback?next=/reset-password` });
  } catch { /* Preserve account-enumeration-safe wording. */ }
  return { status: "success", email: parsed.data.email };
}

export async function resetPasswordAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationState(parsed.error);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "This reset link is invalid or has expired. Request a new one." };
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { status: "error", message: "We couldn’t update your password. Request a new reset link." };
    return { status: "success", message: "Your password has been updated." };
  } catch { return { status: "error", message: "Password reset is temporarily unavailable." }; }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}
