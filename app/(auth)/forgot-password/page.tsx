import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
export const metadata: Metadata = { title: "Forgot Password" };
export default function ForgotPasswordPage() { return <section className="auth-card"><header><p>Account recovery</p><h1>RESET PASSWORD</h1><span>Enter your email and we&apos;ll send reset instructions.</span></header><ForgotPasswordForm /></section>; }
