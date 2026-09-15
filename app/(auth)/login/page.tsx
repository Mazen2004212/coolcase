import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Login" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) { const params = await searchParams; return <section className="auth-card"><header><p>Welcome back</p><h1>LOGIN</h1><span>Access your Coolcase account.</span></header><LoginForm nextPath={safeNextPath(params.next)} callbackError={params.error === "auth_callback"} /></section>; }
