import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/auth-forms";
export const metadata: Metadata = { title: "Create Account" };
export default function SignupPage() { return <section className="auth-card auth-card-wide"><header><p>Join Coolcase</p><h1>CREATE ACCOUNT</h1><span>Your details, addresses, and future orders—kept together.</span></header><SignupForm /></section>; }
