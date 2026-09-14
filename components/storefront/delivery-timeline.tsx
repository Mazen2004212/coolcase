import { MapPin, PackageCheck, ShoppingBag } from "lucide-react";

export function DeliveryTimeline({ custom = false }: { custom?: boolean }) {
  return (
    <section className="delivery-timeline" aria-labelledby={custom ? "custom-delivery-title" : "delivery-title"}>
      <div className="delivery-heading">
        <h2 id={custom ? "custom-delivery-title" : "delivery-title"}>Your order journey</h2>
        <span>7–10 day delivery</span>
      </div>
      <ol>
        <li><span><ShoppingBag size={17} aria-hidden="true" /></span><strong>Purchased</strong></li>
        <li><span><PackageCheck size={17} aria-hidden="true" /></span><strong>Processing</strong></li>
        <li><span><MapPin size={17} aria-hidden="true" /></span><strong>Delivery</strong><small>7–10 days</small></li>
      </ol>
      {custom ? <p>Custom cases require processing before delivery.</p> : null}
    </section>
  );
}
