'use client';

import { logoutAction } from "@/lib/auth/actions";
import { LOCAL_CART_KEY, LOCAL_CART_CHANGE_EVENT } from "@/lib/cart/local-cart";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const res = await logoutAction();
    if (res?.success) {
      window.localStorage.removeItem(LOCAL_CART_KEY);
      window.dispatchEvent(new Event(LOCAL_CART_CHANGE_EVENT));
      router.push("/");
    }
  }

  return (
    <form action={handleLogout}>
      <button type="submit">Log Out</button>
    </form>
  );
}
