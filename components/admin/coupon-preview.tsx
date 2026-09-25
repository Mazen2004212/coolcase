import { StatusBadge, type Tone } from '@/components/ui/status-badge';
import { formatPrice } from '@/lib/data/product-options';

type CouponState = { isActive: boolean; startsAt?: string | null; expiresAt?: string | null; usageLimit?: number | null; redemptionCount: number };
export function couponPresentationStatus(coupon: CouponState, now: number): { label: string; tone: Tone } {
  if (!coupon.isActive) return { label: 'Disabled', tone: 'neutral' };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now) return { label: 'Expired', tone: 'danger' };
  if (coupon.usageLimit != null && coupon.redemptionCount >= coupon.usageLimit) return { label: 'Usage limit reached', tone: 'warning' };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return { label: 'Scheduled', tone: 'info' };
  return { label: 'Active', tone: 'success' };
}
export function CouponEffectiveBadge({ coupon, now }: { coupon: CouponState; now: number }) {
  const status = couponPresentationStatus(coupon, now);
  return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
}
export function CouponPreview({ code, discountType, discountValue, minimumSubtotal, isActive, startsAt, expiresAt, usageLimit, perCustomerLimit, customer }: { code: string; discountType: string; discountValue: number; minimumSubtotal: number; isActive: boolean; startsAt: string; expiresAt: string; usageLimit: string; perCustomerLimit: string; customer: string }) {
  function date(value: string, empty: string) { const parsed = new Date(value); return value && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString('en-EG', { dateStyle:'medium', timeStyle:'short' }) : empty; }
  return <aside className="cc-coupon-preview" aria-label="Live coupon preview"><p>Live preview</p><h2>{code || 'Enter a coupon code'}</h2><strong>{discountValue > 0 ? `${discountType === 'PERCENTAGE' ? `${discountValue}%` : formatPrice(discountValue)} OFF` : 'Enter a discount'}</strong><StatusBadge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Enabled' : 'Disabled'}</StatusBadge><dl><div><dt>Minimum products subtotal</dt><dd>{formatPrice(minimumSubtotal)}</dd></div><div><dt>Eligibility</dt><dd>{customer}</dd></div><div><dt>Starts</dt><dd>{date(startsAt,'No scheduled start')}</dd></div><div><dt>Ends</dt><dd>{date(expiresAt,'No expiry')}</dd></div><div><dt>Total usage limit</dt><dd>{usageLimit || 'Unlimited'}</dd></div><div><dt>Per-customer limit</dt><dd>{perCustomerLimit || 'Unlimited'}</dd></div></dl><p>Shipping is not discounted. Preview only; eligibility is checked when the coupon is applied.</p></aside>;
}
