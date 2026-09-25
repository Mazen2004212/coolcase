'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { StaffProfile } from '@/lib/admin/types';

type AdminContext = { 
  staff: StaffProfile | null;
  message: string; 
  notify: (text: string) => void; 
};

const Context = createContext<AdminContext | null>(null);

export function AdminProvider({ children, staff }: { children: ReactNode; staff: StaffProfile | null }) {
  const [message, notify] = useState('');

  return (
    <Context.Provider value={{ staff, message, notify }}>
      {children}
    </Context.Provider>
  );
}

export function useAdmin() { 
  const value = useContext(Context); 
  if (!value) throw new Error('Admin provider is required'); 
  return value; 
}
