import { orderLabels } from '@/components/ui/status-badge';
const orderSteps = ['PENDING_ADMIN_APPROVAL', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export function OrderStatusTimeline({ status }: { status: string }) {
  if (status === 'CANCELLED' || status === 'REJECTED') return <div className="order-cancelled" role="status"><b>{orderLabels[status]}</b><span>{status === 'REJECTED' ? 'This order was not approved.' : 'This order has been cancelled.'} It will not progress through delivery.</span></div>;
  const currentIndex = orderSteps.indexOf(status === 'PENDING_CONFIRMATION' ? 'PENDING_ADMIN_APPROVAL' : status);
  return <ol className="order-status-timeline" aria-label={`Order status: ${orderLabels[status] ?? status}`}>{orderSteps.map((step, index) => <li key={step} data-complete={index < currentIndex} aria-current={index === currentIndex ? 'step' : undefined}><span aria-hidden="true">{index < currentIndex ? '✓' : index + 1}</span><b>{orderLabels[step]}</b><small>{index === currentIndex ? 'Current' : index < currentIndex ? 'Completed' : 'Upcoming'}</small></li>)}</ol>;
}
