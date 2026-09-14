"use client";

import { ArrowLeft, ArrowRight, Check, Copy, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";
import { getLocalCartServerSnapshot, getLocalCartSnapshot, subscribeToLocalCart, type StoredCartItem } from "@/lib/cart/local-cart";
import {
  CHECKOUT_SHIPPING_FEE,
  INSTAPAY_TRANSFER_NUMBER,
  WHATSAPP_DISPLAY_NUMBER,
  createCheckoutSubmissionDraft,
  getWhatsAppUrl,
  type CheckoutFormValues,
  type CheckoutPaymentMethod,
} from "@/lib/checkout/order-draft";
import { formatPrice, materialOptions } from "@/lib/data/product-options";
import { getProductBySlug } from "@/lib/data/products";

function CheckoutItemImage({ item }: { item: StoredCartItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="checkout-item-image">
      {failed ? <span><ImageIcon aria-hidden="true" /><small>Preview unavailable</small></span> : <Image src={item.image} alt={item.kind === "custom" ? "Your uploaded custom case design" : `${item.productName} phone case`} fill sizes="72px" unoptimized={item.kind === "custom"} onError={() => setFailed(true)} />}
      <b aria-label={`Quantity ${item.quantity}`}>{item.quantity}</b>
    </div>
  );
}

function CheckoutSummary({ items, subtotal, total }: { items: StoredCartItem[]; subtotal: number; total: number }) {
  return (
    <aside className="checkout-summary" aria-labelledby="checkout-summary-heading">
      <p>Order / Summary</p><h2 id="checkout-summary-heading">YOUR ORDER</h2>
      <div className="checkout-summary-items">
        {items.map((item, index) => <article key={`${item.productId}-${item.phoneModel}-${item.networkType}-${index}`}><CheckoutItemImage item={item} /><div><h3>{item.productName}</h3>{item.kind === "product" ? <p>{materialOptions[item.material].label}</p> : <span>Custom design</span>}<p>{item.phoneModel} / {item.networkType}</p></div><strong>{formatPrice(item.discountedUnitPrice * item.quantity)}</strong></article>)}
      </div>
      <dl><div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div><div><dt>Shipping</dt><dd>{formatPrice(CHECKOUT_SHIPPING_FEE)}</dd></div><div className="checkout-total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div></dl>
      <p className="checkout-delivery">Estimated delivery: 7–10 days</p>
      <small>Displayed totals come from this local cart. The future checkout server action must validate prices, availability, shipping, and the authoritative total.</small>
    </aside>
  );
}

function WhatsAppButton({ total }: { total: number }) {
  return <a className="checkout-whatsapp" href={getWhatsAppUrl(total)} target="_blank" rel="noopener noreferrer" aria-label="Send InstaPay transaction screenshot to Coolcase on WhatsApp (opens in a new tab)">Send Screenshot on WhatsApp <ArrowRight aria-hidden="true" /></a>;
}

function Completion({ email, paymentMethod, total }: { email: string; paymentMethod: CheckoutPaymentMethod; total: number }) {
  const instaPay = paymentMethod === "INSTAPAY";
  return (
    <section className="checkout-success" aria-labelledby="checkout-success-title">
      <span><Check aria-hidden="true" /></span><p>Pending admin approval</p><h1 id="checkout-success-title">ORDER RECEIVED</h1>
      <h2>{instaPay ? "Your order has been received and is pending payment verification and approval." : "Your order has been received and is pending approval."}</h2>
      {instaPay ? <div className="checkout-success-whatsapp"><h3>Transfer completed?</h3><p>Send your transaction screenshot to us on WhatsApp:</p><a href={getWhatsAppUrl(total)} target="_blank" rel="noopener noreferrer">{WHATSAPP_DISPLAY_NUMBER}</a><WhatsAppButton total={total} /></div> : null}
      <p>Once Coolcase {instaPay ? "verifies the transaction and approves your order" : "approves your order"}, we&apos;ll send a confirmation email to:</p><strong>{email}</strong>
      <div className="checkout-success-delivery"><span>Estimated delivery after confirmation</span><b>7–10 days</b></div>
      <p className="checkout-success-note">This is a frontend preview only. No database order or permanent order reference has been created yet.</p>
      <Link href="/shop" prefetch={false}>Continue Shopping <ArrowRight aria-hidden="true" /></Link>
    </section>
  );
}

export function CheckoutContent() {
  const cart = useSyncExternalStore(subscribeToLocalCart, getLocalCartSnapshot, getLocalCartServerSnapshot);
  const [completion, setCompletion] = useState<{ email: string; paymentMethod: CheckoutPaymentMethod } | null>(null);
  const [copied, setCopied] = useState(false);
  const { register, handleSubmit, control, formState: { errors } } = useForm<CheckoutFormValues>({ defaultValues: { fullName: "", phone: "", email: "", governorate: "", city: "", area: "", street: "", building: "", floor: "", apartment: "", landmark: "", deliveryNotes: "" } });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const subtotal = cart.items.reduce((sum, item) => sum + item.discountedUnitPrice * item.quantity, 0);
  const total = subtotal + (cart.items.length > 0 ? CHECKOUT_SHIPPING_FEE : 0);
  const hasUnavailableItem = cart.items.some((item) => item.kind === "product" && getProductBySlug(item.slug)?.available !== true);

  if (completion) return <Completion {...completion} total={total} />;
  if (cart.items.length === 0) return <section className="checkout-blocked"><p>Checkout</p><h1>YOUR CART IS EMPTY</h1><span>Add a case before continuing to checkout.</span><Link href="/cart" prefetch={false}><ArrowLeft aria-hidden="true" />Return to Cart</Link></section>;
  if (hasUnavailableItem) return <section className="checkout-blocked"><p>Checkout paused</p><h1>ITEM UNAVAILABLE</h1><span>One or more items in your cart are currently unavailable. Please remove them before continuing.</span><Link href="/cart" prefetch={false}><ArrowLeft aria-hidden="true" />Return to Cart</Link></section>;

  async function copyTransferNumber() {
    try { await navigator.clipboard.writeText(INSTAPAY_TRANSFER_NUMBER); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  }

  function submit(values: CheckoutFormValues) {
    const draft = createCheckoutSubmissionDraft(values, cart.items);
    setCompletion({ email: draft.customer.email, paymentMethod: draft.payment.method });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const required = (label: string) => ({ required: `${label} is required`, validate: (value: string) => value.trim().length > 0 || `${label} is required` });

  return (
    <><header className="checkout-heading"><div><p>Guest checkout</p><h1>CHECKOUT</h1></div><Link href="/cart" prefetch={false}><ArrowLeft aria-hidden="true" />Back to Cart</Link></header>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit(submit)} noValidate>
          <section aria-labelledby="customer-details-heading"><div className="checkout-section-heading"><span>01</span><div><h2 id="customer-details-heading">Customer Details</h2><p>Where we can reach you about your order.</p></div></div>
            <div className="checkout-fields"><label className="checkout-field checkout-field-wide">Full Name<input type="text" autoComplete="name" aria-invalid={Boolean(errors.fullName)} {...register("fullName", required("Full name"))} />{errors.fullName ? <small role="alert">{errors.fullName.message}</small> : null}</label>
              <label className="checkout-field">Phone Number<input type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} {...register("phone", required("Phone"))} />{errors.phone ? <small role="alert">{errors.phone.message}</small> : null}</label>
              <label className="checkout-field">Email Address<input type="email" inputMode="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email", { required: "Email is required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" } })} />{errors.email ? <small role="alert">{errors.email.message}</small> : <em>We&apos;ll send your order confirmation to this email after your order is approved.</em>}</label></div>
          </section>

          <section aria-labelledby="delivery-address-heading"><div className="checkout-section-heading"><span>02</span><div><h2 id="delivery-address-heading">Delivery Address</h2><p>Tell us exactly where your case should arrive.</p></div></div>
            <div className="checkout-fields">
              <label className="checkout-field">Governorate<input autoComplete="address-level1" aria-invalid={Boolean(errors.governorate)} {...register("governorate", required("Governorate"))} />{errors.governorate ? <small role="alert">{errors.governorate.message}</small> : null}</label>
              <label className="checkout-field">City<input autoComplete="address-level2" aria-invalid={Boolean(errors.city)} {...register("city", required("City"))} />{errors.city ? <small role="alert">{errors.city.message}</small> : null}</label>
              <label className="checkout-field">Area<input autoComplete="address-level3" aria-invalid={Boolean(errors.area)} {...register("area", required("Area"))} />{errors.area ? <small role="alert">{errors.area.message}</small> : null}</label>
              <label className="checkout-field checkout-field-wide">Street Name<input autoComplete="street-address" aria-invalid={Boolean(errors.street)} {...register("street", required("Street"))} />{errors.street ? <small role="alert">{errors.street.message}</small> : null}</label>
              <label className="checkout-field">Building Number<input aria-invalid={Boolean(errors.building)} {...register("building", required("Building"))} />{errors.building ? <small role="alert">{errors.building.message}</small> : null}</label>
              <label className="checkout-field">Floor <span>Optional</span><input {...register("floor")} /></label><label className="checkout-field">Apartment <span>Optional</span><input {...register("apartment")} /></label>
              <label className="checkout-field checkout-field-wide">Landmark <span>Optional</span><input {...register("landmark")} /></label>
              <label className="checkout-field checkout-field-wide">Delivery Notes <span>Optional</span><textarea rows={3} {...register("deliveryNotes")} /></label>
            </div>
          </section>

          <section aria-labelledby="payment-method-heading"><div className="checkout-section-heading"><span>03</span><div><h2 id="payment-method-heading">Payment Method</h2><p>Choose how you&apos;d like to pay.</p></div></div>
            <fieldset className="checkout-payment"><legend className="sr-only">Payment method</legend>
              <label><input type="radio" value="COD" {...register("paymentMethod", { required: "Choose a payment method" })} /><span><b>Cash on Delivery</b><small>Pay when your order is delivered.</small></span></label>
              <label><input type="radio" value="INSTAPAY" {...register("paymentMethod", { required: "Choose a payment method" })} /><span><b>InstaPay</b><small>Transfer now, then verify via WhatsApp.</small></span></label>
            </fieldset>{errors.paymentMethod ? <p className="checkout-payment-error" role="alert">{errors.paymentMethod.message}</p> : null}

            {paymentMethod === "COD" ? <div className="checkout-payment-panel"><p>Cash on Delivery</p><h3>Pay when your order is delivered.</h3><span>After placing your order, it remains pending until it is reviewed and approved by Coolcase. It is not marked paid or confirmed automatically.</span></div> : null}
            {paymentMethod === "INSTAPAY" ? <div className="checkout-payment-panel checkout-instapay"><p>InstaPay payment</p><h3>Transfer {formatPrice(total)} to:</h3><div className="checkout-transfer"><strong>{INSTAPAY_TRANSFER_NUMBER}</strong><button type="button" onClick={copyTransferNumber}><Copy aria-hidden="true" />{copied ? "Copied" : "Copy Number"}</button></div><ol><li>Transfer the full total to {INSTAPAY_TRANSFER_NUMBER}</li><li>Place your order</li><li>Send the transaction screenshot on WhatsApp</li><li>Coolcase admin reviews the payment</li><li>Once approved, your order becomes Confirmed</li><li>You receive a confirmation email</li></ol><p>After completing the transfer, send the screenshot to <a href={getWhatsAppUrl(total)} target="_blank" rel="noopener noreferrer">{WHATSAPP_DISPLAY_NUMBER}</a>. Verification is completed manually by our team.</p><WhatsAppButton total={total} /></div> : null}
          </section>
          <button type="submit" className="checkout-submit">Place Order <ArrowRight aria-hidden="true" /></button>
          <p className="checkout-submit-note">Submitting creates only a temporary frontend completion state in this phase. Your cart remains saved until a future server order is created successfully.</p>
        </form>
        <CheckoutSummary items={cart.items} subtotal={subtotal} total={total} />
      </div></>
  );
}
