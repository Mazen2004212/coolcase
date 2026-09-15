import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteContainer } from "@/components/layout/site-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { logoutAction } from "@/lib/auth/actions";
import { requireCustomer } from "@/lib/auth/user";
import "./account.css";

export default async function AccountLayout({ children }: { children: ReactNode }) { const pathname = (await headers()).get("x-coolcase-pathname") || "/account"; await requireCustomer(pathname); return <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="account-page"><SiteContainer><header className="account-heading"><p>Customer space</p><h1>MY ACCOUNT</h1></header><div className="account-layout"><nav aria-label="Account navigation"><Link href="/account">Overview</Link><Link href="/account/profile">Profile</Link><Link href="/account/addresses">Addresses</Link><Link href="/account/orders">My Orders</Link><form action={logoutAction}><button type="submit">Log Out</button></form></nav><div className="account-content">{children}</div></div></SiteContainer></main><SiteFooter /></div>; }
