import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import type { Tone } from './status-badge';

export function FeedbackRegion({ children, tone = 'info' }: { children?: ReactNode; tone?: Tone }) {
  return <div role={tone === 'danger' ? 'alert' : 'status'} aria-atomic="true" className={children ? 'cc-feedback' : undefined} data-tone={tone}>{children}</div>;
}
export function LoadingButton({ busy, busyLabel, children, disabled, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { busy: boolean; busyLabel: string }) {
  return <button {...props} className={`cc-button ${className}`} disabled={disabled || busy} aria-busy={busy}>{busy ? busyLabel : children}</button>;
}
export function EmptyState({ title, children, href, action }: { title: string; children?: ReactNode; href?: string; action?: string }) {
  return <section className="cc-empty"><h2>{title}</h2><p>{children}</p>{href && <Link className="cc-button" href={href}>{action ?? 'Continue shopping'}</Link>}</section>;
}
export function ErrorState({ children, href }: { children: ReactNode; href?: string }) {
  return <FeedbackRegion tone="danger"><p>{children}</p>{href && <a className="cc-button" href={href}>Retry</a>}</FeedbackRegion>;
}
