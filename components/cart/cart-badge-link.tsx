"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getLocalCartCount, getLocalCartServerSnapshot, getLocalCartSnapshot, subscribeToLocalCart } from "@/lib/cart/local-cart";

export function CartBadgeLink() {
  const cart = useSyncExternalStore(subscribeToLocalCart, getLocalCartSnapshot, getLocalCartServerSnapshot);
  const count = getLocalCartCount(cart);
  const label = count === 0 ? "Cart, empty" : `Cart, ${count} ${count === 1 ? "item" : "items"}`;

  return (
    <Link href="/cart" prefetch={false} className="icon-button cart-header-link hover:bg-white/10" aria-label={label}>
      <ShoppingBag size={21} strokeWidth={1.6} aria-hidden="true" />
      {count > 0 ? <span className="cart-header-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
