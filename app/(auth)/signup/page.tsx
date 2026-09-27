import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/auth-forms";
export const metadata: Metadata = { title: "Create Account" };
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return (
    <AuthShell signup title="Create your account" description="Keep your details, delivery addresses, and future orders together." nextPath={params.next}>
      <SignupForm nextPath={params.next} />
    </AuthShell>
  );
}
