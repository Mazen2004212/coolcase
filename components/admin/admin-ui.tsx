'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X } from 'lucide-react';

export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) { return <header className="ad-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>; }
export function ActionLink({ href, children }: { href: string; children: ReactNode }) { return <Link className="ad-button ad-primary" href={href}>{children}</Link>; }
export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <section className="ad-panel"><div className="ad-panel-head"><h2>{title}</h2>{action}</div>{children}</section>; }
export function Pill({ children, color }: { children: string; color?: string }) { return <span className={`ad-pill ad-status-${children.toLowerCase().replaceAll(' ', '-')}`} style={color === 'green' ? { background: '#d1fae5', color: '#065f46' } : color === 'amber' ? { background: '#fef3c7', color: '#92400e' } : color === 'grey' ? { background: '#f3f4f6', color: '#374151' } : undefined}>{children}</span>; }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="ad-field"><span>{label}</span>{children}</label>; }
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="ad-toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>; }
export function Thumb({ src, alt }: { src?: string; alt: string }) { return src ? <Image className="ad-thumb" src={src} alt={alt} width={44} height={55} unoptimized={src.startsWith('data:') || src.startsWith('blob:')} /> : <span className="ad-thumb ad-no-image">No image</span>; }
export function Empty({ children = 'No results match your filters.' }: { children?: ReactNode }) { return <div className="ad-empty">{children}</div>; }
export function Table({ headings, children }: { headings: string[]; children: ReactNode }) { return <div className="ad-table-scroll" role="region" aria-label={`${headings[0]} table`} tabIndex={0}><table><thead><tr>{headings.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog className="ad-modal" ref={ref} onCancel={close} aria-label={title}><div className="ad-panel-head"><h2>{title}</h2><button type="button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div>{children}</dialog>;
}
export function Confirm({ title, onConfirm, close }: { title: string; onConfirm: () => void; close: () => void }) { return <Modal title={title} close={close}><p>This updates the demo workspace. Historical order items are preserved.</p><div className="ad-actions"><button type="button" onClick={close}>Keep current state</button><button type="button" className="ad-primary" onClick={() => { onConfirm(); close(); }}>Confirm change</button></div></Modal>; }
export function ConfirmReal({ title, description, confirmLabel = 'Confirm', onConfirm, close }: { title: string; description?: string; confirmLabel?: string; onConfirm: () => void; close: () => void }) { return <Modal title={title} close={close}>{description && <p>{description}</p>}<div className="ad-actions"><button type="button" onClick={close}>Cancel</button><button type="button" className="ad-primary" onClick={() => { onConfirm(); close(); }}>{confirmLabel}</button></div></Modal>; }
