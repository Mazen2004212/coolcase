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
import { TotalsSummary, PriceDisplay } from "@/components/ui/price-display";
import { namedCaseColorLabel } from "@/lib/custom-cases/templates";
import { CheckoutProgress } from "@/components/checkout/checkout-progress";



function CartImage({ item }: { item: StoredCartItem }) {
  const [failed, setFailed] = useState(false);
  const href = item.kind === "custom" ? (item.customizationType === "NAMED_TEMPLATE" ? "/custom-cases/named" : "/custom-cases/upload") : `/products/${item.slug}`;
  const image = item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.templateImage : item.image;

  return (
    <Link href={href} prefetch={false} className="cart-item-image" aria-label={`View ${item.productName}`}>
      {failed ? (
        <span className="cart-image-fallback"><ImageIcon aria-hidden="true" /><small>Preview unavailable</small></span>
      ) : (
        <Image
          src={image}
          alt={item.kind === "custom" ? (item.customizationType === "NAMED_TEMPLATE" ? "Named Custom Case design example" : "Your uploaded custom case design") : `${item.productName} phone case`}
          fill
          sizes="(max-width: 639px) 112px, 180px"
          unoptimized={item.kind === "custom" && item.customizationType === "UPLOAD_DESIGN"}
          onError={() => setFailed(true)}
        />
      )}
    </Link>
  );
}

function CartLine({ item }: { item: StoredCartItem }) {
  const itemKey = getCartItemKey(item);
  const soldOut = false; // Availability is validated at checkout. Cart items are assumed available until order submission.
  const href = item.kind === "custom" ? (item.customizationType === "NAMED_TEMPLATE" ? "/custom-cases/named" : "/custom-cases/upload") : `/products/${item.slug}`;

  return (
    <article className="cart-line" data-kind={item.kind} data-sold-out={soldOut ? "true" : "false"}>
      <CartImage item={item} />
      <div className="cart-line-details">
        <div className="cart-line-heading">
          <div>
            {item.kind === "custom" ? <span className="cart-custom-badge">{item.customizationType === "NAMED_TEMPLATE" ? "Named custom case" : "Custom design"}</span> : null}
            <h2><Link href={href} prefetch={false}>{item.productName}</Link></h2>
          </div>
          <strong className="cart-line-total">{formatPrice(item.discountedUnitPrice * item.quantity)}</strong>
        </div>

        <dl className="cart-configuration">
          <dt>Material</dt><dd>{materialOptions[item.material].label}</dd>
          <dt>Phone</dt><dd>{item.phoneBrand} — {item.phoneModel}</dd>
          <dt>Network</dt><dd>{item.networkType}</dd>
          {item.kind === "custom" && item.customizationType === "UPLOAD_DESIGN" ? <><dt>Design</dt><dd>Your uploaded artwork</dd></> : null}
          {item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? <><dt>Design</dt><dd>{item.templateName}</dd><dt>English Name</dt><dd><span lang="en">{item.englishName}</span></dd><dt>Arabic Name</dt><dd><span lang="ar" dir="rtl">{item.arabicName}</span></dd><dt>English Color</dt><dd><i className="named-color-dot" style={{backgroundColor:item.englishColor}} />{namedCaseColorLabel(item.englishColor)}</dd><dt>Arabic Color</dt><dd><i className="named-color-dot" style={{backgroundColor:item.arabicColor}} />{namedCaseColorLabel(item.arabicColor)}</dd></> : null}
        </dl>

        <div className="cart-unit-price"><PriceDisplay current={item.discountedUnitPrice} original={item.originalUnitPrice}/><span>each</span></div>

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

export function CartPageContent({ shippingFee }: { shippingFee: number }) {
  const cart = useSyncExternalStore(subscribeToLocalCart, getLocalCartSnapshot, getLocalCartServerSnapshot);
  const subtotal = cart.items.reduce((sum, item) => sum + item.discountedUnitPrice * item.quantity, 0);
  const savings = cart.items.reduce((sum, item) => sum + Math.max(0, item.originalUnitPrice - item.discountedUnitPrice) * item.quantity, 0);
  const shipping = cart.items.length > 0 ? shippingFee : 0;
  const total = subtotal + shipping;
  const hasUnavailableItem = false; // Validated server-side at checkout.

  if (cart.items.length === 0) {
    return (
      <>
        <CheckoutProgress phase="CART" />
        <section className="cart-empty" aria-labelledby="empty-cart-heading">
          <p>Nothing in the bag — yet.</p>
          <h1 id="empty-cart-heading">YOUR CART IS EMPTY</h1>
          <span>Looks like you haven&apos;t picked your next case yet.</span>
          <div><Link href="/shop" prefetch={false} className="cart-primary-link">Shop Cases <ArrowRight aria-hidden="true" /></Link><Link href="/custom-cases" prefetch={false} className="cart-secondary-link">Create Your Own</Link></div>
        </section>
      </>
    );
  }

  return (
    <>
      <CheckoutProgress phase="CART" />
      <header className="cart-page-heading"><div><p>Your cases, your way.</p><h1>YOUR CART</h1></div><Link href="/shop" prefetch={false}>Continue Shopping <ArrowRight aria-hidden="true" /></Link></header>
      <div className="cart-layout">
        <section className="cart-lines" aria-label={`Cart items, ${cart.items.length} ${cart.items.length === 1 ? "line" : "lines"}`}>
          {cart.items.map((item) => <CartLine key={getCartItemKey(item)} item={item} />)}
        </section>
        <aside className="cart-summary" aria-labelledby="order-summary-heading">
          <p>Order / Summary</p>
          <h2 id="order-summary-heading">ORDER SUMMARY</h2>
          <TotalsSummary subtotal={subtotal} shipping={shipping} total={total} savings={savings}/>
          <p className="cc-helper">Have a coupon? Apply it at checkout.</p>
          <p className="cart-delivery-note">Estimated delivery: 7–10 days</p>
          {hasUnavailableItem ? <p className="cart-checkout-warning" role="status">Remove unavailable items to continue to checkout.</p> : null}
          {hasUnavailableItem ? <button type="button" className="cart-checkout" disabled>Proceed to Checkout <ArrowRight aria-hidden="true" /></button> : <Link href="/checkout" prefetch={false} className="cart-checkout">Proceed to Checkout <ArrowRight aria-hidden="true" /></Link>}
          <Link href="/shop" prefetch={false} className="cart-summary-continue">Continue Shopping</Link>
          <small>Your final total is confirmed when you place your order.</small>
        </aside>
      </div>
    </>
  );
}
