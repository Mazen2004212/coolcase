import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Login" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  return (
    <AuthShell title="Welcome back" description="Sign in to access your Coolcase account and continue where you left off." nextPath={nextPath}>
      <LoginForm nextPath={nextPath} callbackError={params.error === "auth_callback"} />
    </AuthShell>
  );
}
