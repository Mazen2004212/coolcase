"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, loginAction, resetPasswordAction, signupAction, type AuthActionState } from "@/lib/auth/actions";

const initialAuthState: AuthActionState = { status: "idle" };

function FieldError({ state, name }: { state: AuthActionState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <small className="auth-field-error" role="alert">{message}</small> : null;
}

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Please wait…" : label}<ArrowRight aria-hidden="true" /></button>;
}

export function LoginForm({ nextPath = "/account", callbackError = false }: { nextPath?: string; callbackError?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialAuthState);
  return <form className="auth-form" action={action} noValidate><input type="hidden" name="next" value={nextPath} />
    {callbackError ? <p className="auth-message auth-message-error" role="alert">That authentication link is invalid or has expired.</p> : null}
    {state.message ? <p className="auth-message auth-message-error" role="alert">{state.message}</p> : null}
    <label>Email Address<input name="email" type="email" inputMode="email" autoComplete="email" required /><FieldError state={state} name="email" /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /><FieldError state={state} name="password" /></label>
    <div className="auth-form-links"><Link href="/forgot-password">Forgot Password?</Link></div><SubmitButton label="Login" pending={pending} />
    <p className="auth-switch">New to Coolcase? <Link href="/signup">Create Account</Link></p>
  </form>;
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initialAuthState);
  if (state.status === "success") return <section className="auth-complete"><p>Email verification</p><h1>CHECK YOUR EMAIL</h1><span>We&apos;ve sent a verification link to:</span><strong>{state.email}</strong><p>Verify your email to activate your Coolcase account.</p><Link href="/login">Back to Login <ArrowRight aria-hidden="true" /></Link></section>;
  return <form className="auth-form auth-signup" action={action} noValidate>
    {state.message ? <p className="auth-message auth-message-error" role="alert">{state.message}</p> : null}
    <fieldset><legend><span>01</span><b>Account Details</b></legend><div className="auth-field-grid">
      <label className="auth-wide">Full Name<input name="fullName" autoComplete="name" required maxLength={120} /><FieldError state={state} name="fullName" /></label>
      <label>Phone Number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={32} /><FieldError state={state} name="phone" /></label>
      <label>Email Address<input name="email" type="email" inputMode="email" autoComplete="email" required /><FieldError state={state} name="email" /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" required /><FieldError state={state} name="password" /><em>At least 8 characters, including one letter and one number.</em></label>
      <label>Confirm Password<input name="confirmPassword" type="password" autoComplete="new-password" required /><FieldError state={state} name="confirmPassword" /></label>
    </div></fieldset>
    <fieldset><legend><span>02</span><b>Default Shipping Address</b></legend><div className="auth-field-grid">
      <label>Governorate<select name="governorate" defaultValue="" required><option value="">Choose governorate</option><option>Cairo</option><option>Giza</option></select><FieldError state={state} name="governorate" /></label>
      <label>City<input name="city" autoComplete="address-level2" required maxLength={100} /><FieldError state={state} name="city" /></label>
      <label>Area<input name="area" autoComplete="address-level3" required maxLength={100} /><FieldError state={state} name="area" /></label>
      <label className="auth-wide">Street Name<input name="street" autoComplete="street-address" required maxLength={200} /><FieldError state={state} name="street" /></label>
      <label>Building Number<input name="building" required maxLength={50} /><FieldError state={state} name="building" /></label>
      <label>Floor <span>Optional</span><input name="floor" maxLength={50} /></label><label>Apartment <span>Optional</span><input name="apartment" maxLength={50} /></label>
      <label className="auth-wide">Landmark <span>Optional</span><input name="landmark" maxLength={160} /></label>
    </div></fieldset><SubmitButton label="Create Account" pending={pending} /><p className="auth-switch">Already have an account? <Link href="/login">Login</Link></p>
  </form>;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialAuthState);
  if (state.status === "success") return <section className="auth-complete"><p>Password reset</p><h1>CHECK YOUR EMAIL</h1><span>If an account exists for that email, you&apos;ll receive instructions to reset your password.</span><Link href="/login">Back to Login <ArrowRight aria-hidden="true" /></Link></section>;
  return <form className="auth-form" action={action} noValidate>{state.message ? <p className="auth-message auth-message-error" role="alert">{state.message}</p> : null}<label>Email Address<input name="email" type="email" inputMode="email" autoComplete="email" required /><FieldError state={state} name="email" /></label><SubmitButton label="Send Reset Link" pending={pending} /><p className="auth-switch"><Link href="/login">Back to Login</Link></p></form>;
}

export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialAuthState);
  if (state.status === "success") return <section className="auth-complete"><p>Password updated</p><h1>YOU&apos;RE ALL SET</h1><span>Your password has been updated successfully.</span><Link href="/login">Continue to Login <ArrowRight aria-hidden="true" /></Link></section>;
  if (!hasSession) return <section className="auth-complete"><p>Reset link</p><h1>LINK EXPIRED</h1><span>This password reset link is invalid or has expired.</span><Link href="/forgot-password">Request a New Link <ArrowRight aria-hidden="true" /></Link></section>;
  return <form className="auth-form" action={action} noValidate>{state.message ? <p className="auth-message auth-message-error" role="alert">{state.message}</p> : null}<label>New Password<input name="password" type="password" autoComplete="new-password" required /><FieldError state={state} name="password" /><em>At least 8 characters, including one letter and one number.</em></label><label>Confirm New Password<input name="confirmPassword" type="password" autoComplete="new-password" required /><FieldError state={state} name="confirmPassword" /></label><SubmitButton label="Update Password" pending={pending} /></form>;
}
