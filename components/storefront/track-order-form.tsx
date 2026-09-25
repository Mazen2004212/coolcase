"use client";

import { formatNetworkType } from '@/lib/utils/network-label';
import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Package, MapPin, Truck } from "lucide-react";

type TrackingResult = {
  order_number: string;
  status: string;
  created_at: string;
  customer_name: string;
  governorate: string;
  city_area: string;
  subtotal_amount: number;
  shipping_amount: number;
  total_amount: number;
  payment_method: string;
  shipping: {
    courier: string;
    tracking_number: string;
    current_location: string;
  };
  items: {
    product_name_snapshot: string;
    material: string;
    phone_model: string;
    network_type: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  history: {
    status: string;
    customer_visible_note: string | null;
    created_at: string;
  }[];
};

function readable(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function money(n: number) {
  return `${n.toLocaleString("en-EG")} EGP`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-EG", { dateStyle: "medium" }).format(new Date(iso));
}

function TrackingResult({ order }: { order: TrackingResult }) {
  const hasShipping = order.shipping.courier || order.shipping.tracking_number || order.shipping.current_location;

  return (
    <div className="track-result">
      <div className="track-result-header">
        <div>
          <p className="track-result-label">Order Reference</p>
          <strong className="track-result-number">{order.order_number}</strong>
        </div>
        <span className="track-result-status">{readable(order.status)}</span>
      </div>

      <div className="track-result-meta">
        <div>
          <span>Placed</span>
          <strong>{formatDate(order.created_at)}</strong>
        </div>
        <div>
          <span>Payment</span>
          <strong>{readable(order.payment_method)}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{money(order.total_amount)}</strong>
        </div>
      </div>

      {/* Items */}
      <div className="track-result-section">
        <h3><Package size={16} aria-hidden="true" /> Items</h3>
        <div className="track-items">
          {order.items.map((item, i) => (
            <div key={i} className="track-item">
              <div>
                <strong>{item.product_name_snapshot}</strong>
                <span>{item.phone_model} &middot; {readable(item.material)} &middot; {formatNetworkType(item.network_type)}</span>
              </div>
              <span>{item.quantity} &times; {money(item.unit_price)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery address */}
      <div className="track-result-section">
        <h3><MapPin size={16} aria-hidden="true" /> Delivery</h3>
        <p>{order.city_area}, {order.governorate}</p>
      </div>

      {/* Shipping details — only shown when populated */}
      {hasShipping && (
        <div className="track-result-section">
          <h3><Truck size={16} aria-hidden="true" /> Shipping</h3>
          {order.shipping.courier && <p>Courier: <strong>{order.shipping.courier}</strong></p>}
          {order.shipping.tracking_number && <p>Tracking number: <strong>{order.shipping.tracking_number}</strong></p>}
          {order.shipping.current_location && <p>Current location: <strong>{order.shipping.current_location}</strong></p>}
        </div>
      )}

      {/* Status timeline */}
      {order.history.length > 0 && (
        <div className="track-result-section">
          <h3>Status history</h3>
          <ol className="track-timeline">
            {order.history.map((event, i) => (
              <li key={i}>
                <span className="track-timeline-status">{readable(event.status)}</span>
                <span className="track-timeline-date">{formatDate(event.created_at)}</span>
                {event.customer_visible_note && <p className="track-timeline-note">{event.customer_visible_note}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function TrackOrderForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reference = String(data.get("reference") ?? "").trim();
    const contact   = String(data.get("contact") ?? "").trim();

    if (!reference || !contact) {
      setMessage("Enter your order reference and the email or phone used for the order.");
      return;
    }

    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: reference, contact }),
      });

      const json = await response.json() as { order?: TrackingResult; error?: string };

      if (!response.ok || json.error) {
        setMessage(json.error ?? "Order not found. Check your reference and contact details.");
      } else if (json.order) {
        setResult(json.order);
      }
    } catch {
      setMessage("Could not reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="track-form" onSubmit={submit} noValidate>
        <label>
          Order Reference
          <input name="reference" required autoComplete="off" placeholder="Example: CC-001000" />
        </label>
        <label>
          Email or Phone
          <input name="contact" required autoComplete="email" placeholder="Used when placing the order" />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Track Order"} <ArrowRight aria-hidden="true" />
        </button>
        {message && <p className="track-message" role="status">{message}</p>}
      </form>
      {result && <TrackingResult order={result} />}
    </>
  );
}
