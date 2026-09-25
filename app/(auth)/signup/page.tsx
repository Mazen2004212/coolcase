import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/auth-forms";
export const metadata: Metadata = { title: "Create Account" };
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <section className="auth-card auth-card-wide"><header><p>Join Coolcase</p><h1>CREATE ACCOUNT</h1><span>Your details, addresses, and future orders—kept together.</span></header><SignupForm nextPath={params.next} /></section>; 
}
