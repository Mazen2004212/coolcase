'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { UserRound, Settings, ShoppingBag, LogOut, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { 
  LOCAL_CART_KEY, 
  LOCAL_CART_CHANGE_EVENT, 
  LOCAL_BUY_NOW_KEY, 
  LOCAL_BUY_NOW_CHANGE_EVENT 
} from '@/lib/cart/local-cart';
// We must dynamically import the logoutAction to use it client-side
import { logoutAction } from '@/lib/auth/actions';

export type UserDropdownCustomer = {
  email: string;
  fullName: string;
};

type DropdownProps = {
  customer: UserDropdownCustomer | null;
  isStaff: boolean;
};

export function UserDropdown({ customer, isStaff }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function keydown(event: KeyboardEvent) { if(event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } }
    document.addEventListener('keydown', keydown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', keydown); };
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    // 1. Clear cart
    localStorage.removeItem(LOCAL_CART_KEY);
    // 2. Clear Buy It Now draft
    localStorage.removeItem(LOCAL_BUY_NOW_KEY);
    // 3. Notify cart UI
    window.dispatchEvent(new Event(LOCAL_CART_CHANGE_EVENT));
    window.dispatchEvent(new Event(LOCAL_BUY_NOW_CHANGE_EVENT));
    
    // 4. Server logout
    await logoutAction();
    router.push('/');
    router.refresh();
  };

  const closeDropdown = () => setOpen(false);

  return (
    <div className="relative hidden lg:inline-block" ref={ref}>
      <button
        type="button"
        className={`icon-button hover:bg-white/10 ${open ? 'bg-white/10' : ''}`}
        ref={triggerRef} aria-expanded={open} aria-controls="account-dropdown"
        aria-label="Account menu"
        onClick={() => setOpen(!open)}
      >
        <UserRound size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>

      {open && (
        <div id="account-dropdown" className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/20 bg-surface-black p-2 shadow-2xl text-sm">
          {!customer ? (
            <div className="flex flex-col space-y-1">
              <div className="px-3 py-2 border-b border-white/20 mb-2">
                <p className="font-semibold text-white">Guest</p>
              </div>
              <Link href="/login" onClick={closeDropdown} className="flex items-center gap-3 rounded-lg px-3 py-2 text-white/90 hover:bg-white/10 hover:text-white">
                <UserRound size={16} />
                Log In
              </Link>
              <Link href="/signup" onClick={closeDropdown} className="flex items-center gap-3 rounded-lg px-3 py-2 text-surface-text hover:bg-white/10 hover:text-white">
                <LogOut size={16} className="rotate-180" />
                Create Account
              </Link>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-white/20 mb-2">
                <p className="font-semibold text-white truncate">{customer.fullName || 'My Account'}</p>
                <p className="text-xs text-white/70 truncate">{customer.email}</p>
              </div>
              
              <div className="flex flex-col space-y-1">
                {isStaff && (
                  <Link href="/admin" onClick={closeDropdown} className="flex items-center gap-3 rounded-lg px-3 py-2 text-white hover:bg-white/10">
                    <Shield size={16} className="text-white" />
                    Admin Workspace
                  </Link>
                )}
                <Link href="/account" onClick={closeDropdown} className="flex items-center gap-3 rounded-lg px-3 py-2 text-surface-text hover:bg-white/10 hover:text-white">
                  <Settings size={16} />
                  Account Settings
                </Link>
                <Link href="/account/addresses" onClick={closeDropdown} className="flex items-center gap-3 rounded-lg px-3 py-2 text-surface-text hover:bg-white/10 hover:text-white">
                  <UserRound size={16} />
                  Addresses
                </Link>
                <Link href="/account/orders" onClick={closeDropdown} className="flex items-center gap-3 rounded-lg px-3 py-2 text-surface-text hover:bg-white/10 hover:text-white">
                  <ShoppingBag size={16} />
                  My Orders
                </Link>
                
                <hr className="my-1 border-white/20" />
                
                <button 
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-surface-text hover:bg-white/10 hover:text-white text-left"
                >
                  <LogOut size={16} />
                  Log Out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
