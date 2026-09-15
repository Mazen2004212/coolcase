import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderStatusTimeline } from "@/components/storefront/order-status-timeline";
import { requireCustomer } from "@/lib/auth/user";
import { formatPrice } from "@/lib/data/product-options";

export const metadata: Metadata = { title: "Order Details" };
type Props = { params: Promise<{ id: string }> };

function readable(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default async function OrderDetailsPage({ params }: Props) {
  const id = (await params).id;
  const { user, supabase } = await requireCustomer(`/account/orders/${id}`);
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (!order) notFound();
  const [{ data: items }, { data: events }] = await Promise.all([
    supabase.from("order_items").select("id, product_name_snapshot, phone_model, material, network_type, quantity, unit_price, line_total").eq("order_id", order.id).order("created_at"),
    supabase.from("order_tracking_events").select("id, status, customer_visible_note, created_at").eq("order_id", order.id).order("created_at"),
  ]);
  return <section className="order-detail"><Link href="/account/orders" className="order-back"><ArrowLeft aria-hidden="true" />Back to My Orders</Link><p className="account-eyebrow">Order details</p><h2>{order.order_number}</h2><div className="order-detail-status"><div><span>Status</span><strong>{readable(order.status)}</strong></div><div><span>Placed</span><strong>{new Intl.DateTimeFormat("en-EG", { dateStyle: "medium" }).format(new Date(order.created_at))}</strong></div></div><OrderStatusTimeline status={order.status} /><section><h3>Items</h3><div className="order-detail-items">{(items ?? []).map((item) => <article key={item.id}><div><strong>{item.product_name_snapshot}</strong><span>{item.phone_model} / {readable(item.material)} / {readable(item.network_type)}</span></div><span>{item.quantity} × {formatPrice(item.unit_price)}</span><b>{formatPrice(item.line_total)}</b></article>)}</div></section><div className="order-detail-columns"><section><h3>Delivery Address</h3><p>{order.customer_name}</p><p>{order.street_name}, Building {order.building_number}</p><p>{order.city_area}, {order.governorate}</p>{order.floor ? <p>Floor {order.floor}{order.apartment ? `, Apartment ${order.apartment}` : ""}</p> : null}{order.landmark ? <p>Landmark: {order.landmark}</p> : null}</section><section><h3>Payment & Total</h3><dl><div><dt>Payment</dt><dd>{readable(order.payment_method)}</dd></div><div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal_amount)}</dd></div><div><dt>Shipping</dt><dd>{formatPrice(order.shipping_amount)}</dd></div><div><dt>Total</dt><dd>{formatPrice(order.total_amount)}</dd></div></dl></section></div>{events?.some((event) => event.customer_visible_note) ? <section><h3>Updates</h3><ul className="order-updates">{events.filter((event) => event.customer_visible_note).map((event) => <li key={event.id}><time>{event.created_at ? new Intl.DateTimeFormat("en-EG", { dateStyle: "medium" }).format(new Date(event.created_at)) : ""}</time><p>{event.customer_visible_note}</p></li>)}</ul></section> : null}</section>;
}
