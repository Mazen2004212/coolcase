import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Choose New Password" };
export default async function ResetPasswordPage() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return <section className="auth-card"><header><p>Account recovery</p><h1>NEW PASSWORD</h1><span>Choose a secure new password for your account.</span></header><ResetPasswordForm hasSession={Boolean(user)} /></section>; }
