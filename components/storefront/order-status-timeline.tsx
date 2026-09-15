const orderSteps = ["PENDING_CONFIRMATION", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] as const;
const labels: Record<string, string> = { PENDING_CONFIRMATION: "Pending Approval", CONFIRMED: "Confirmed", PREPARING: "Preparing", SHIPPED: "Shipped", OUT_FOR_DELIVERY: "Out for Delivery", DELIVERED: "Delivered", CANCELLED: "Cancelled" };

export function OrderStatusTimeline({ status }: { status: string }) {
  if (status === "CANCELLED") return <div className="order-cancelled" role="status"><b>Cancelled</b><span>This order is no longer progressing through delivery.</span></div>;
  const currentIndex = status === "OUT_FOR_DELIVERY" ? 3 : orderSteps.indexOf(status as (typeof orderSteps)[number]);
  return <ol className="order-status-timeline" aria-label={`Order status: ${labels[status] ?? status}`}>{orderSteps.map((step, index) => <li key={step} data-complete={index <= currentIndex}><span aria-hidden="true">{index + 1}</span><b>{labels[step]}</b></li>)}</ol>;
}
