'use client';
import { cloneElement, useId, type ReactElement, type InputHTMLAttributes, type ReactNode } from 'react';

export function FormField({ label, helper, error, children }: { label: string; helper?: string; error?: string; children: ReactElement<InputHTMLAttributes<HTMLInputElement>> }) {
  const id = useId();
  const controlId = children.props.id ?? id;
  const describedBy = [children.props['aria-describedby'], helper && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className="ad-field"><label htmlFor={controlId}>{label}</label>{cloneElement(children, { id:controlId, 'aria-describedby':describedBy, 'aria-invalid':error ? true : children.props['aria-invalid'] })}{helper && <small id={`${id}-help`}>{helper}</small>}{error && <small id={`${id}-error`} role="alert">{error}</small>}</div>;
}
export function FieldGroup({ children }: { children: ReactNode }) { return <div className="ad-form-grid">{children}</div>; }
