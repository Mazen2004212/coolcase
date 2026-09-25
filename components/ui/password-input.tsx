'use client';
import { useState, type InputHTMLAttributes } from 'react';
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return <span className="cc-password"><input {...props} type={visible ? 'text' : 'password'}/><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? 'Hide' : 'Show'}</button></span>;
}
