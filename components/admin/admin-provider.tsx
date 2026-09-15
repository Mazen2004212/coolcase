'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createAdminDemo } from '@/lib/admin/mock-data';
import type { AdminRole, AdminState } from '@/lib/admin/types';

type AdminContext = { data: AdminState; role: AdminRole | null; setRole: (role: AdminRole | null) => void; message: string; notify: (text: string) => void; update: (text: string, change: (data: AdminState) => AdminState) => void };
const Context = createContext<AdminContext | null>(null);
export function AdminProvider({ children, demo }: { children: ReactNode; demo: boolean }) {
  const [data, setData] = useState(createAdminDemo);
  const [role, setRole] = useState<AdminRole | null>(demo ? null : 'Owner');
  const [message, notify] = useState('');
  function update(text: string, change: (state: AdminState) => AdminState) {
    const event = { id: crypto.randomUUID(), text, date: new Date().toISOString() };
    setData(current => { const next = change(current); return { ...next, activity: [event, ...next.activity].slice(0, 100) }; });
    notify(`${text} Saved in this demo session.`);
  }
  // Replace these in-memory operations with authenticated server repositories later.
  return <Context.Provider value={{ data, role, setRole, message, notify, update }}>{children}</Context.Provider>;
}
export function useAdmin() { const value = useContext(Context); if (!value) throw new Error('Admin provider is required'); return value; }
