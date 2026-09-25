import { formatPrice } from '@/lib/data/product-options';

export function PriceDisplay({ current, original, from = false }: { current: number; original?: number; from?: boolean }) {
  const saving = original === undefined ? 0 : Math.max(0, original - current);
  return <span className="cc-price"><strong>{from ? 'From ' : ''}{formatPrice(current)}</strong>{saving > 0 && <><del><span className="sr-only">Original price </span>{formatPrice(original!)}</del><span className="cc-saving">Save {formatPrice(saving)}</span></>}</span>;
}
export function DiscountRow({ label, amount }: { label: string; amount: number }) {
  return amount > 0 ? <div className="cc-discount"><dt>{label}</dt><dd>−{formatPrice(amount)}</dd></div> : null;
}
export function TotalsSummary({ subtotal, shipping, total, savings = 0, discount = 0, coupon }: { subtotal: number; shipping: number; total: number; savings?: number; discount?: number; coupon?: string | null }) {
  return <dl className="cc-totals"><div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div><DiscountRow label={coupon ? `Coupon ${coupon}` : 'Discount'} amount={discount}/><div><dt>Shipping</dt><dd>{formatPrice(shipping)}</dd></div><DiscountRow label="Item savings (included above)" amount={savings}/><div className="cc-total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div></dl>;
}
