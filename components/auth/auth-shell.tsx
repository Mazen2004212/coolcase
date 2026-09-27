import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";

export function AuthShell({
  title,
  description,
  children,
  signup = false,
  nextPath = "/",
}: {
  title: string;
  description: string;
  children: ReactNode;
  signup?: boolean;
  nextPath?: string;
}) {
  const nextQuery = nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : "";

  return (
    <section className={`auth-split-shell${signup ? " auth-split-shell-signup" : ""}`}>
      <div className="auth-split-form-panel">
        <header className="auth-brand">
          <Link href="/" aria-label="Coolcase home">
            <BrandLogo width={185} height={44} priority />
          </Link>
          <p><span>Cases for</span><span>A cooler you</span></p>
        </header>

        <nav className="auth-tabs" aria-label="Authentication">
          <Link href={`/signup${nextQuery}`} aria-current={signup ? "page" : undefined}>Sign Up</Link>
          <Link href={`/login${nextQuery}`} aria-current={signup ? undefined : "page"}>Sign In</Link>
        </nav>

        <div className="auth-split-content">
          <header className="auth-split-intro">
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
        </div>
      </div>

      <div className="auth-visual" aria-hidden="true">
        <div className="auth-visual-image">
          <Image
            src="/assets/auth/coolcase-auth-side.png"
            alt=""
            fill
            priority
            sizes="(min-width: 901px) 55vw, 100vw"
          />
        </div>
      </div>
    </section>
  );
}
