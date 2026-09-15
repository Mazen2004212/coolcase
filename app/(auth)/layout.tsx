import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./auth.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div id="top"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="auth-page">{children}</main><SiteFooter /></div>;
}
