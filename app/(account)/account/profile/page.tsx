import type { Metadata } from "next";
import { ProfileForm } from "@/components/account/account-forms";
import { requireCustomer } from "@/lib/auth/user";
export const metadata: Metadata = { title: "Profile" };
export default async function ProfilePage() { const { user, profile } = await requireCustomer("/account/profile"); return <section><p className="account-eyebrow">Account details</p><h2>PROFILE</h2><p className="account-intro">Keep your contact details current for future orders.</p><ProfileForm fullName={profile?.full_name || ""} phone={profile?.phone || ""} email={profile?.email || user.email || ""} /></section>; }
