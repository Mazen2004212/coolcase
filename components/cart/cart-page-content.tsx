"use client";

import { ArrowRight, ImageIcon, Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  getCartItemKey,
  getLocalCartServerSnapshot,
  getLocalCartSnapshot,
  removeFromLocalCart,
  subscribeToLocalCart,
  updateLocalCartQuantity,
  type StoredCartItem,
} from "@/lib/cart/local-cart";
import { formatPrice, materialOptions } from "@/lib/data/product-options";
import { getProductBySlug } from "@/lib/data/products";

const SHIPPING_FEE = 50;

function CartImage({ item }: { item: StoredCartItem }) {
  const [failed, setFailed] = useState(false);
  const href = item.kind === "custom" ? "/custom-cases" : `/products/${item.slug}`;

  return (
    <Link href={href} prefetch={false} className="cart-item-image" aria-label={`View ${item.productName}`}>
      {failed ? (
        <span className="cart-image-fallback"><ImageIcon aria-hidden="true" /><small>Preview unavailable</small></span>
      ) : (
        <Image
          src={item.image}
          alt={item.kind === "custom" ? "Your uploaded custom case design" : `${item.productName} phone case`}
          fill
          sizes="(max-width: 639px) 112px, 180px"
          unoptimized={item.kind === "custom"}
          onError={() => setFailed(true)}
        />
      )}
    </Link>
  );
}

function CartLine({ item }: { item: StoredCartItem }) {
  const itemKey = getCartItemKey(item);
  const product = item.kind === "product" ? getProductBySlug(item.slug) : undefined;
  const soldOut = item.kind === "product" && product?.available !== true;
  const href = item.kind === "custom" ? "/custom-cases" : `/products/${item.slug}`;

  return (
    <article className="cart-line" data-kind={item.kind} data-sold-out={soldOut ? "true" : "false"}>
      <CartImage item={item} />
      <div className="cart-line-details">
        <div className="cart-line-heading">
          <div>
            {item.kind === "custom" ? <span className="cart-custom-badge">Custom</span> : null}
            <h2><Link href={href} prefetch={false}>{item.productName}</Link></h2>
          </div>
          <strong className="cart-line-total">{formatPrice(item.discountedUnitPrice * item.quantity)}</strong>
        </div>

        <dl className="cart-configuration">
          {item.kind === "product" ? <><dt>Material</dt><dd>{materialOptions[item.material].label}</dd></> : null}
          <dt>Phone</dt><dd>{item.phoneBrand} — {item.phoneModel}</dd>
          <dt>Network</dt><dd>{item.networkType}</dd>
        </dl>

        <div className="cart-unit-price">
          <del><span className="sr-only">Original unit price </span>{formatPrice(item.originalUnitPrice)}</del>
          <strong><span className="sr-only">Current unit price </span>{formatPrice(item.discountedUnitPrice)}</strong>
          <span>each</span>
        </div>

        {soldOut ? <div className="cart-unavailable"><span>Sold Out</span><p>This item is currently unavailable.</p></div> : null}

        <div className="cart-line-actions">
          <div className="cart-quantity" role="group" aria-label={`Quantity for ${item.productName}`}>
            <button type="button" aria-label={`Decrease ${item.productName} quantity`} disabled={item.quantity === 1} onClick={() => updateLocalCartQuantity(itemKey, item.quantity - 1)}><Minus aria-hidden="true" /></button>
            <output aria-label={`${item.productName} quantity`} aria-live="polite">{item.quantity}</output>
            <button type="button" aria-label={`Increase ${item.productName} quantity`} disabled={soldOut || item.quantity === 99} onClick={() => updateLocalCartQuantity(itemKey, item.quantity + 1)}><Plus aria-hidden="true" /></button>
          </div>
          <button type="button" className="cart-remove" onClick={() => removeFromLocalCart(itemKey)}><Trash2 aria-hidden="true" />Remove</button>
        </div>
      </div>
    </article>
  );
}

export function CartPageContent() {
  const cart = useSyncExternalStore(subscribeToLocalCart, getLocalCartSnapshot, getLocalCartServerSnapshot);
  const subtotal = cart.items.reduce((sum, item) => sum + item.discountedUnitPrice * item.quantity, 0);
  const shipping = cart.items.length > 0 ? SHIPPING_FEE : 0;
  const total = subtotal + shipping;
  const hasUnavailableItem = cart.items.some((item) => item.kind === "product" && getProductBySlug(item.slug)?.available !== true);

  if (cart.items.length === 0) {
    return (
      <section className="cart-empty" aria-labelledby="empty-cart-heading">
        <p>Nothing in the bag — yet.</p>
        <h1 id="empty-cart-heading">YOUR CART IS EMPTY</h1>
        <span>Looks like you haven&apos;t picked your next case yet.</span>
        <div><Link href="/shop" prefetch={false} className="cart-primary-link">Shop Cases <ArrowRight aria-hidden="true" /></Link><Link href="/custom-cases" prefetch={false} className="cart-secondary-link">Create Your Own</Link></div>
      </section>
    );
  }

  return (
    <>
      <header className="cart-page-heading"><div><p>Your cases, your way.</p><h1>YOUR CART</h1></div><Link href="/shop" prefetch={false}>Continue Shopping <ArrowRight aria-hidden="true" /></Link></header>
      <div className="cart-layout">
        <section className="cart-lines" aria-label={`Cart items, ${cart.items.length} ${cart.items.length === 1 ? "line" : "lines"}`}>
          {cart.items.map((item) => <CartLine key={getCartItemKey(item)} item={item} />)}
        </section>
        <aside className="cart-summary" aria-labelledby="order-summary-heading">
          <p>Order / Summary</p>
          <h2 id="order-summary-heading">ORDER SUMMARY</h2>
          <dl><div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div><div><dt>Shipping</dt><dd>{formatPrice(shipping)}</dd></div><div className="cart-summary-total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div></dl>
          <p className="cart-delivery-note">Estimated delivery: 7–10 days</p>
          {hasUnavailableItem ? <p className="cart-checkout-warning" role="status">Remove unavailable items to continue to checkout.</p> : null}
          {hasUnavailableItem ? <button type="button" className="cart-checkout" disabled>Proceed to Checkout <ArrowRight aria-hidden="true" /></button> : <Link href="/checkout" prefetch={false} className="cart-checkout">Proceed to Checkout <ArrowRight aria-hidden="true" /></Link>}
          <Link href="/shop" prefetch={false} className="cart-summary-continue">Continue Shopping</Link>
          <small>Prices in this cart are stored locally for review. Checkout will validate pricing in a later phase.</small>
        </aside>
      </div>
    </>
  );
}
