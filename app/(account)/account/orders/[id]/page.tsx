import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TransferDetails } from "@/components/payment/transfer-details";
import { OrderStatusBadge, PaymentStatusBadge, TestOrderBadge } from "@/components/ui/status-badge";
import { TotalsSummary } from "@/components/ui/price-display";
import { ErrorState } from "@/components/ui/feedback";
import { createAdminClient } from "@/lib/supabase/server";
import { OrderStatusTimeline } from "@/components/storefront/order-status-timeline";
import { PaymentProofUpload } from "@/components/payment/payment-proof-upload";
import { requireCustomer } from "@/lib/auth/user";
import { formatPrice } from "@/lib/data/product-options";
import { formatNetworkType } from "@/lib/utils/network-label";
import { namedCaseColorLabel } from "@/lib/custom-cases/templates";
import { CheckoutProgress } from "@/components/checkout/checkout-progress";

export const metadata: Metadata = { title: "Order Details" };
type Props = { params: Promise<{ id: string }> };

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

export default async function OrderDetailsPage({ params }: Props) {
  const id = (await params).id;
  const { user, supabase } = await requireCustomer(`/account/orders/${id}`);
  const { data: order, error: orderError } = await supabase.from("orders").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (orderError) return <ErrorState href={`/account/orders/${id}`}>We couldn’t load this order. Please retry.</ErrorState>;
  if (!order) notFound();
  const { data: recipientSetting } = await createAdminClient().from("store_settings").select("value").eq("key", "instapay_number").maybeSingle();
  const recipient = typeof recipientSetting?.value === "string" ? recipientSetting.value : "";

  const [{ data: items, error: itemsError }, { data: events, error: eventsError }, { data: payment, error: paymentError }] = await Promise.all([
    supabase.from("order_items").select("id, product_name_snapshot, phone_model, material, network_type, quantity, unit_price, line_total, customization_type, customization_snapshot").eq("order_id", order.id).order("created_at"),
    supabase.from("order_tracking_events").select("id, status, customer_visible_note, created_at").eq("order_id", order.id).order("created_at"),
    supabase.from("payments").select("method, status, expected_amount, rejection_reason").eq("order_id", order.id).maybeSingle(),
  ]);

  return (
    <section className="order-detail">
      <Link href="/account/orders" className="order-back"><ArrowLeft aria-hidden="true" />Back to My Orders</Link>
      <CheckoutProgress phase="ORDER" orderStatus={order.status} paymentStatus={payment?.status} />
      <p className="account-eyebrow">Order details</p>
      <h2>{order.order_number}</h2>
      {order.is_test ? <TestOrderBadge/> : null}
      <div className="order-detail-status">
        <div><span>Status</span><OrderStatusBadge status={order.status}/></div>
        <div><span>Placed</span><strong>{new Intl.DateTimeFormat("en-EG", { dateStyle: "medium" }).format(new Date(order.created_at))}</strong></div>
      </div>
      <OrderStatusTimeline status={order.status} />
      {(itemsError || eventsError || paymentError) && <ErrorState href={`/account/orders/${id}`}>Some order details could not be loaded. Please retry before making a payment.</ErrorState>}
      <section>
        <h3>Items</h3>
        <div className="order-detail-items">{(items ?? []).map(item =>{const snapshot=item.customization_snapshot&&typeof item.customization_snapshot==='object'&&!Array.isArray(item.customization_snapshot)?item.customization_snapshot:null;return <article key={item.id}><div><strong>{item.product_name_snapshot}</strong>{item.customization_type==='UPLOAD_DESIGN'?<span>Your Design</span>:null}{item.customization_type==='NAMED_TEMPLATE'&&snapshot?<><span>Submitted customization</span><span>Design: {String(snapshot.templateName??'Named design')}</span>{snapshot.englishName?<span>English Name: <b lang="en">{String(snapshot.englishName)}</b></span>:null}{snapshot.arabicName?<span>Arabic Name: <b lang="ar" dir="rtl">{String(snapshot.arabicName)}</b></span>:null}{snapshot.englishColor?<span>English Color: <b>{namedCaseColorLabel(snapshot.englishColor)} ({String(snapshot.englishColor)})</b></span>:null}{snapshot.arabicColor?<span>Arabic Color: <b>{namedCaseColorLabel(snapshot.arabicColor)} ({String(snapshot.arabicColor)})</b></span>:null}{!snapshot.englishName&&snapshot.renderedText?<span>Name: <b dir="auto">{String(snapshot.renderedText)}</b></span>:null}</>:null}<span>{item.phone_model} / {readable(item.material)} / {formatNetworkType(item.network_type)}</span></div><span>{item.quantity} × {formatPrice(item.unit_price)}</span><b>{formatPrice(item.line_total)}</b></article>})}</div>
      </section>
      <div className="order-detail-columns">
        <section><h3>Delivery Address</h3><p>{order.customer_name}</p><p>{order.street_name}, Building {order.building_number}</p><p>{order.city_area}, {order.governorate}</p>{order.floor ? <p>Floor {order.floor}{order.apartment ? `, Apartment ${order.apartment}` : ""}</p> : null}{order.landmark ? <p>Landmark: {order.landmark}</p> : null}</section>
        <section><h3>Payment & Total</h3><p>{readable(order.payment_method)}</p>{payment && <PaymentStatusBadge status={payment.status}/>}<TotalsSummary subtotal={order.subtotal_amount} shipping={order.shipping_amount} total={order.total_amount} discount={order.discount_amount ?? 0} coupon={order.coupon_code_snapshot}/></section>
      </div>
      {payment && (payment.method === "INSTAPAY" || (payment.method === "CASH_ON_DELIVERY" && payment.status !== "NOT_REQUIRED")) ? (
        <section className="account-payment-proof">
          <p className="account-eyebrow">{payment.method === "INSTAPAY" ? "InstaPay" : "Cash on Delivery deposit"}</p>
          <h3>
            {payment.status === "PENDING" ? "Payment Pending" : null}
            {payment.status === "PENDING_VERIFICATION" ? "Payment proof submitted" : null}
            {payment.status === "VERIFIED" ? "Payment Verified" : null}
            {payment.status === "REJECTED" ? "Payment Proof Rejected" : null}
            {payment.status === "REFUNDED" ? "Payment Refunded" : null}
          </h3>
          <PaymentStatusBadge status={payment.status}/>
          {payment.method === "CASH_ON_DELIVERY" ? <div><p>Order total: <strong>{formatPrice(order.total_amount)}</strong></p><p>50% deposit: <strong>{formatPrice(payment.expected_amount)}</strong></p><p>Remaining due on delivery: <strong>{formatPrice(Number((order.total_amount-payment.expected_amount).toFixed(2)))}</strong></p></div> : null}
          {["PENDING", "REJECTED"].includes(payment.status) ? <TransferDetails amount={payment.expected_amount} recipient={recipient}/> : payment.method === "INSTAPAY" ? <p>Amount: <strong>{formatPrice(payment.expected_amount)}</strong></p> : null}
          {payment.status === "PENDING_VERIFICATION" ? <p>Awaiting review. Your order will not be confirmed until payment is verified.</p> : null}
          {payment.status === "VERIFIED" ? <p>{payment.method === "CASH_ON_DELIVERY" ? "Deposit verified. The remaining balance is payable on delivery." : "Your payment has been verified."}</p> : null}
          {payment.status === "REJECTED" ? <p className="account-payment-rejection">Reason: {payment.rejection_reason}</p> : null}
          <PaymentProofUpload orderId={order.id} initialStatus={payment.status} />
        </section>
      ) : null}
      {events?.some(event => event.customer_visible_note) ? <section><h3>Updates</h3><ul className="order-updates">{events.filter(event => event.customer_visible_note).map(event => <li key={event.id}><time>{event.created_at ? new Intl.DateTimeFormat("en-EG", { dateStyle: "medium" }).format(new Date(event.created_at)) : ""}</time><p>{event.customer_visible_note}</p></li>)}</ul></section> : null}
    </section>
  );
}
