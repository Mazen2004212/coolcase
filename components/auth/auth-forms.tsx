"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, loginAction, resetPasswordAction, signupAction, type AuthActionState } from "@/lib/auth/actions";

const initialAuthState: AuthActionState = { status: "idle" };

function FieldError({ state, name }: { state: AuthActionState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <small id={`auth-error-${name}`} className="auth-field-error" role="alert">{message}</small> : null;
}

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Please wait…" : label}<ArrowRight aria-hidden="true" /></button>;
}

export function LoginForm({ nextPath = "/", callbackError = false }: { nextPath?: string; callbackError?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialAuthState);
  return <form className="auth-form" action={action} noValidate><input type="hidden" name="next" value={nextPath} />
    {callbackError ? <p className="auth-message auth-message-error" role="alert">That authentication link is invalid or has expired.</p> : null}
    {state.message ? <p className="auth-message auth-message-error" role="alert">{state.message}</p> : null}
    <label>Email Address<input aria-invalid={Boolean(state.fieldErrors?.["email"])} aria-describedby={state.fieldErrors?.["email"] ? "auth-error-email" : undefined} name="email" type="email" inputMode="email" autoComplete="email" required /><FieldError state={state} name="email" /></label>
    <label>Password<PasswordInput aria-invalid={Boolean(state.fieldErrors?.["password"])} aria-describedby={state.fieldErrors?.["password"] ? "auth-error-password" : undefined} name="password"  autoComplete="current-password" required /><FieldError state={state} name="password" /></label>
    <div className="auth-form-links"><Link href="/forgot-password">Forgot Password?</Link></div><SubmitButton label="Sign In" pending={pending} />
    <p className="auth-switch">New to Coolcase? <Link href="/signup">Create an account</Link></p>
  </form>;
}

export function SignupForm({ nextPath = "/" }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(signupAction, initialAuthState);
  if (state.status === "success") return <section className="auth-complete"><p>Email verification</p><h1>CHECK YOUR EMAIL</h1><span>We&apos;ve sent a verification link to:</span><strong>{state.email}</strong><p>Verify your email to activate your Coolcase account.</p><Link href="/login">Back to Login <ArrowRight aria-hidden="true" /></Link></section>;
  return <form className="auth-form auth-signup" action={action} noValidate><input type="hidden" name="next" value={nextPath} />
    {state.message ? <p className="auth-message auth-message-error" role="alert">{state.message}</p> : null}
    <fieldset><legend><span>01</span><b>Account Details</b></legend><div className="auth-field-grid">
      <label className="auth-wide">Full Name<input aria-invalid={Boolean(state.fieldErrors?.["fullName"])} aria-describedby={state.fieldErrors?.["fullName"] ? "auth-error-fullName" : undefined} name="fullName" autoComplete="name" required maxLength={120} /><FieldError state={state} name="fullName" /></label>
      <label>Phone Number<input aria-invalid={Boolean(state.fieldErrors?.["phone"])} aria-describedby={state.fieldErrors?.["phone"] ? "auth-error-phone" : undefined} name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={32} /><FieldError state={state} name="phone" /></label>
      <label>Email Address<input aria-invalid={Boolean(state.fieldErrors?.["email"])} aria-describedby={state.fieldErrors?.["email"] ? "auth-error-email" : undefined} name="email" type="email" inputMode="email" autoComplete="email" required /><FieldError state={state} name="email" /></label>
      <label className="auth-wide">Password<PasswordInput aria-invalid={Boolean(state.fieldErrors?.["password"])} aria-describedby={state.fieldErrors?.["password"] ? "auth-error-password" : undefined} name="password"  autoComplete="new-password" required /><FieldError state={state} name="password" /><em>At least 8 characters, including one letter and one number.</em></label>
      <label className="auth-wide">Confirm Password<PasswordInput aria-invalid={Boolean(state.fieldErrors?.["confirmPassword"])} aria-describedby={state.fieldErrors?.["confirmPassword"] ? "auth-error-confirmPassword" : undefined} name="confirmPassword"  autoComplete="new-password" required /><FieldError state={state} name="confirmPassword" /></label>
    </div></fieldset>
    <fieldset><legend><span>02</span><b>Default Shipping Address</b></legend><p className="cc-helper">Your address is required to prepare deliveries. You can review it at checkout.</p><div className="auth-field-grid">
      <label>City / Governorate<select aria-invalid={Boolean(state.fieldErrors?.["governorate"])} aria-describedby={state.fieldErrors?.["governorate"] ? "auth-error-governorate" : undefined} name="governorate" defaultValue="" required><option value="">Choose Cairo or Giza</option><option>Cairo</option><option>Giza</option></select><FieldError state={state} name="governorate" /></label>
      <label>District / locality<input aria-invalid={Boolean(state.fieldErrors?.["city"])} aria-describedby={state.fieldErrors?.["city"] ? "auth-error-city" : undefined} name="city" autoComplete="address-level2" required maxLength={100} /><FieldError state={state} name="city" /></label>
      <label className="auth-wide">Area<input aria-invalid={Boolean(state.fieldErrors?.["area"])} aria-describedby={state.fieldErrors?.["area"] ? "auth-error-area" : undefined} name="area" autoComplete="address-level3" required maxLength={100} /><FieldError state={state} name="area" /></label>
      <label className="auth-wide">Street Name<input aria-invalid={Boolean(state.fieldErrors?.["street"])} aria-describedby={state.fieldErrors?.["street"] ? "auth-error-street" : undefined} name="street" autoComplete="street-address" required maxLength={200} /><FieldError state={state} name="street" /></label>
      <label className="auth-wide">Building Number<input aria-invalid={Boolean(state.fieldErrors?.["building"])} aria-describedby={state.fieldErrors?.["building"] ? "auth-error-building" : undefined} name="building" required maxLength={50} /><FieldError state={state} name="building" /></label>
      <label>Floor <span>Optional</span><input aria-invalid={Boolean(state.fieldErrors?.["floor"])} aria-describedby={state.fieldErrors?.["floor"] ? "auth-error-floor" : undefined} name="floor" maxLength={50} /></label><label>Apartment <span>Optional</span><input aria-invalid={Boolean(state.fieldErrors?.["apartment"])} aria-describedby={state.fieldErrors?.["apartment"] ? "auth-error-apartment" : undefined} name="apartment" maxLength={50} /></label>
      <label className="auth-wide">Landmark <span>Optional</span><input aria-invalid={Boolean(state.fieldErrors?.["landmark"])} aria-describedby={state.fieldErrors?.["landmark"] ? "auth-error-landmark" : undefined} name="landmark" maxLength={160} /></label>
    </div></fieldset><SubmitButton label="Create Account" pending={pending} /><p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
  </form>;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialAuthState);
  if (state.status === "success") return <section className="auth-complete"><p>Password reset</p><h1>CHECK YOUR EMAIL</h1><span>If an account exists for that email, you&apos;ll receive instructions to reset your password.</span><Link href="/login">Back to Login <ArrowRight aria-hidden="true" /></Link></section>;
  return <form className="auth-form" action={action} noValidate>{state.message ? <p className="auth-message auth-message-error" role="alert">{state.message}</p> : null}<label>Email Address<input aria-invalid={Boolean(state.fieldErrors?.["email"])} aria-describedby={state.fieldErrors?.["email"] ? "auth-error-email" : undefined} name="email" type="email" inputMode="email" autoComplete="email" required /><FieldError state={state} name="email" /></label><SubmitButton label="Send Reset Link" pending={pending} /><p className="auth-switch"><Link href="/login">Back to Login</Link></p></form>;
}

export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialAuthState);
  if (state.status === "success") return <section className="auth-complete"><p>Password updated</p><h1>YOU&apos;RE ALL SET</h1><span>Your password has been updated successfully.</span><Link href="/login">Continue to Login <ArrowRight aria-hidden="true" /></Link></section>;
  if (!hasSession) return <section className="auth-complete"><p>Reset link</p><h1>LINK EXPIRED</h1><span>This password reset link is invalid or has expired.</span><Link href="/forgot-password">Request a New Link <ArrowRight aria-hidden="true" /></Link></section>;
  return <form className="auth-form" action={action} noValidate>{state.message ? <p className="auth-message auth-message-error" role="alert">{state.message}</p> : null}<label>New Password<PasswordInput aria-invalid={Boolean(state.fieldErrors?.["password"])} aria-describedby={state.fieldErrors?.["password"] ? "auth-error-password" : undefined} name="password"  autoComplete="new-password" required /><FieldError state={state} name="password" /><em>At least 8 characters, including one letter and one number.</em></label><label>Confirm New Password<PasswordInput aria-invalid={Boolean(state.fieldErrors?.["confirmPassword"])} aria-describedby={state.fieldErrors?.["confirmPassword"] ? "auth-error-confirmPassword" : undefined} name="confirmPassword"  autoComplete="new-password" required /><FieldError state={state} name="confirmPassword" /></label><SubmitButton label="Update Password" pending={pending} /></form>;
}
