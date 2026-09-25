'use client';

import { CouponPreview, CouponEffectiveBadge, couponPresentationStatus } from './coupon-preview';
import Link from 'next/link';
import {
  useMemo,
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';

import {
  saveCoupon,
  setCouponActive,
  type AdminCoupon,
  type CouponCustomerOption,
  type CouponDiscountType,
} from '@/app/admin/actions/coupons';

import {
  ActionLink,
  Empty,
  Field,
  PageHeading,
  Panel,
  Table,
  Toggle,
} from './admin-ui';
import { useAdmin } from './admin-provider';
import { requirePermission } from '@/lib/admin/permissions';

function formatMoney(
  value: number,
) {
  return `${value.toLocaleString(
    'en-EG',
    {
      maximumFractionDigits: 2,
    },
  )} EGP`;
}

function formatDiscount(
  coupon: AdminCoupon,
) {
  if (
    coupon.discountType ===
    'PERCENTAGE'
  ) {
    return `${coupon.discountValue}%`;
  }

  return formatMoney(
    coupon.discountValue,
  );
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return 'No expiry';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
  }

  return date.toLocaleDateString(
    'en-EG',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  );
}

function toDateTimeLocal(
  value: string | null,
) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  const offset =
    date.getTimezoneOffset();

  const local = new Date(
    date.getTime() -
    offset * 60_000,
  );

  return local
    .toISOString()
    .slice(0, 16);
}

export function CouponsListLive({
  coupons,
}: {
  coupons: AdminCoupon[];
}) {
  const { staff } = useAdmin();
  const [statusTime] = useState(() => Date.now());
  const canManage = requirePermission(staff, 'coupons.manage');
  const router = useRouter();

  const [search, setSearch] =
    useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    string
  >('ALL');

  const [
    pendingId,
    setPendingId,
  ] = useState<string | null>(
    null,
  );

  const [
    message,
    setMessage,
  ] = useState('');

  const filtered =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      return coupons.filter(
        coupon => {
          if (statusFilter !== 'ALL' && couponPresentationStatus(coupon,statusTime).label !== statusFilter) return false;

          if (!query) {
            return true;
          }

          return (
            coupon.code
              .toLowerCase()
              .includes(query) ||
            coupon.title
              .toLowerCase()
              .includes(query) ||
            (
              coupon.customerName ??
              ''
            )
              .toLowerCase()
              .includes(query) ||
            (
              coupon.customerEmail ??
              ''
            )
              .toLowerCase()
              .includes(query)
          );
        },
      );
    }, [
      coupons,
      statusTime,
      search,
      statusFilter,
    ]);

  async function handleStatus(
    coupon: AdminCoupon,
  ) {
    setPendingId(coupon.id);
    setMessage('');

    const result =
      await setCouponActive(
        coupon.id,
        !coupon.isActive,
      );

    if (!result.ok) {
      setMessage(
        result.error,
      );
    } else {
      router.refresh();
    }

    setPendingId(null);
  }

  return (
    <>
      <PageHeading
        title="Coupons"
        description="Manage discounts and special offers."
        action={canManage ? (
          <ActionLink href="/admin/coupons/new">
            Create Coupon
          </ActionLink>
        ) : undefined}
      />

      {message ? (
        <p
          role="alert"
          className="ad-error"
        >
          {message}
        </p>
      ) : null}

      <Panel title="Coupons">
        <div className="ad-filters">
          <Field label="Search">
            <input
              type="search"
              value={search}
              placeholder="Code, title or customer"
              onChange={event =>
                setSearch(
                  event.target.value,
                )
              }
            />
          </Field>

          <Field label="Status">
            <select
              value={
                statusFilter
              }
              onChange={event =>
                setStatusFilter(
                  event.target
                    .value as
                  | 'ALL'
                  | 'ACTIVE'
                  | 'INACTIVE',
                )
              }
            >
              <option value="ALL">
                All
              </option>

              {["Active", "Disabled", "Scheduled", "Expired", "Usage limit reached"].map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
        </div>

        {filtered.length >
          0 ? (
          <Table
            headings={[
              'Code',
              'Title',
              'Discount',
              'Customer',
              'Usage',
              'Expiry',
              'Status',
              'Actions',
            ]}
          >
            {filtered.map(
              coupon => (
                <tr
                  key={
                    coupon.id
                  }
                >
                  <td>
                    <strong>
                      {
                        coupon.code
                      }
                    </strong>
                  </td>

                  <td>
                    {
                      coupon.title
                    }
                  </td>

                  <td>
                    {formatDiscount(
                      coupon,
                    )}
                  </td>

                  <td>
                    {coupon.customerId
                      ? coupon.customerName ||
                      coupon.customerEmail ||
                      'Assigned customer'
                      : 'Public'}
                  </td>

                  <td>
                    {coupon.redemptionCount}

                    {coupon.usageLimit !==
                      null
                      ? ` / ${coupon.usageLimit}`
                      : ''}
                  </td>

                  <td>
                    {formatDate(
                      coupon.expiresAt,
                    )}
                  </td>

                  <td>
                    <CouponEffectiveBadge coupon={coupon} now={statusTime}/>
                  </td>

                  <td>
                    <div className="ad-actions">
                      <Link
                        href={`/admin/coupons/${coupon.id}`}
                      >
                        {canManage ? 'Edit' : 'View'}
                      </Link>

                      {canManage ? <button
                        type="button"
                        disabled={
                          pendingId ===
                          coupon.id
                        }
                        onClick={() =>
                          handleStatus(
                            coupon,
                          )
                        }
                      >
                        {pendingId ===
                          coupon.id
                          ? 'Saving...'
                          : coupon.isActive
                            ? 'Disable'
                            : 'Enable'}
                      </button> : null}
                    </div>
                  </td>
                </tr>
              ),
            )}
          </Table>
        ) : (
          <Empty>
            {coupons.length ===
              0
              ? 'No coupons have been created yet.'
              : 'No coupons match your filters.'}
          </Empty>
        )}
      </Panel>
    </>
  );
}

export function CouponEditorLive({
  id,
  coupon,
  customers,
}: {
  id: string;
  coupon: AdminCoupon | null;
  customers: CouponCustomerOption[];
}) {
  const router = useRouter();
  const { staff } = useAdmin();
  const canEdit = requirePermission(staff, "coupons.manage");

  const [code, setCode] =
    useState(
      coupon?.code ?? '',
    );

  const [title, setTitle] =
    useState(
      coupon?.title ?? '',
    );

  const [
    discountType,
    setDiscountType,
  ] =
    useState<CouponDiscountType>(
      coupon?.discountType ??
      'PERCENTAGE',
    );

  const [
    discountValue,
    setDiscountValue,
  ] = useState(
    coupon?.discountValue ??
    10,
  );

  const [
    minimumSubtotal,
    setMinimumSubtotal,
  ] = useState(
    coupon?.minimumSubtotal ??
    0,
  );

  const [
    isActive,
    setIsActive,
  ] = useState(
    coupon?.isActive ??
    true,
  );

  const [
    startsAt,
    setStartsAt,
  ] = useState(
    toDateTimeLocal(
      coupon?.startsAt ??
      null,
    ),
  );

  const [
    expiresAt,
    setExpiresAt,
  ] = useState(
    toDateTimeLocal(
      coupon?.expiresAt ??
      null,
    ),
  );

  const [
    usageLimit,
    setUsageLimit,
  ] = useState(
    coupon?.usageLimit
      ?.toString() ?? '',
  );

  const [
    perCustomerLimit,
    setPerCustomerLimit,
  ] = useState(
    coupon?.perCustomerLimit
      ?.toString() ?? '',
  );

  const [
    customerId,
    setCustomerId,
  ] = useState(
    coupon?.customerId ?? '',
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setSaving(true);
    setError('');

    try {
    const result =
      await saveCoupon({
        id:
          id === 'new'
            ? undefined
            : id,

        code,
        title,
        discountType,
        discountValue,
        minimumSubtotal,
        isActive,

        startsAt:
          startsAt || null,

        expiresAt:
          expiresAt || null,

        usageLimit:
          usageLimit
            ? Number(
              usageLimit,
            )
            : null,

        perCustomerLimit:
          perCustomerLimit
            ? Number(
              perCustomerLimit,
            )
            : null,

        customerId:
          customerId ||
          null,
      });

    if (!result.ok) {
      setError(
        result.error,
      );

      setSaving(false);
      return;
    }

    router.push(
      '/admin/coupons',
    );

    router.refresh();
    } catch { setError('Could not save this coupon. Please retry.'); setSaving(false); }
  }

  return (
    <>
      <PageHeading
        title={
          id === 'new'
            ? 'New Coupon'
            : 'Edit Coupon'
        }
        description={
          id === 'new'
            ? 'Create a new discount for your customers.'
            : `Editing ${coupon?.code ?? 'coupon'}`
        }
      />

      <form
        onSubmit={
          handleSubmit
        }
      >
        {!canEdit && <p className="cc-helper">Read-only access. Coupon changes require manage permission.</p>}<fieldset disabled={!canEdit || saving}><div className="cc-coupon-editor"><div className="ad-two">
          <Panel title="Coupon">
            <Field label="Coupon code">
              <input
                required
                autoComplete="off"
                value={code}
                placeholder="COOL20"
                onChange={event =>
                  setCode(
                    event.target.value
                      .toUpperCase()
                      .replace(
                        /\s+/g,
                        '',
                      ),
                  )
                }
              />
            </Field>

            <Field label="Title">
              <input
                required
                value={title}
                placeholder="Welcome offer"
                onChange={event =>
                  setTitle(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Toggle
              label="Coupon active"
              checked={
                isActive
              }
              onChange={
                setIsActive
              }
            />
          </Panel>

          <Panel title="Discount">
            <Field label="Discount type">
              <select
                value={
                  discountType
                }
                onChange={event =>
                  setDiscountType(
                    event.target
                      .value as CouponDiscountType,
                  )
                }
              >
                <option value="PERCENTAGE">
                  Percentage
                </option>

                <option value="FIXED">
                  Fixed amount
                </option>
              </select>
            </Field>

            <Field
              label={
                discountType ===
                  'PERCENTAGE'
                  ? 'Discount (%)'
                  : 'Discount (EGP)'
              }
            >
              <input
                required
                type="number"
                min="0.01"
                max={
                  discountType ===
                    'PERCENTAGE'
                    ? 100
                    : undefined
                }
                step="0.01"
                value={
                  discountValue
                }
                onChange={event =>
                  setDiscountValue(
                    Number(
                      event.target
                        .value,
                    ),
                  )
                }
              />
            </Field>

            <Field label="Minimum products subtotal (EGP)">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={
                  minimumSubtotal
                }
                onChange={event =>
                  setMinimumSubtotal(
                    Number(
                      event.target
                        .value,
                    ),
                  )
                }
              />
            </Field>

            <p>
              Discounts apply to
              products subtotal
              only. Shipping is
              never discounted.
            </p>
          </Panel>

          <Panel title="Availability">
            <Field label="Starts at">
              <input
                type="datetime-local"
                value={
                  startsAt
                }
                onChange={event =>
                  setStartsAt(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Expires at">
              <input
                type="datetime-local"
                value={
                  expiresAt
                }
                onChange={event =>
                  setExpiresAt(
                    event.target.value,
                  )
                }
              />
            </Field>
          </Panel>

          <Panel title="Usage limits">
            <Field label="Total usage limit">
              <input
                type="number"
                min="1"
                step="1"
                value={
                  usageLimit
                }
                placeholder="Unlimited"
                onChange={event =>
                  setUsageLimit(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Per-customer limit">
              <input
                type="number"
                min="1"
                step="1"
                value={
                  perCustomerLimit
                }
                placeholder="Unlimited"
                onChange={event =>
                  setPerCustomerLimit(
                    event.target.value,
                  )
                }
              />
            </Field>
          </Panel>

          <Panel title="Customer access">
            <Field label="Coupon availability">
              <select
                value={
                  customerId
                }
                onChange={event =>
                  setCustomerId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Public — all
                  customers
                </option>

                {customers.map(
                  customer => (
                    <option
                      key={
                        customer.id
                      }
                      value={
                        customer.id
                      }
                    >
                      {customer.name}
                      {customer.email
                        ? ` — ${customer.email}`
                        : ''}
                    </option>
                  ),
                )}
              </select>
            </Field>

            {coupon ? (
              <p>
                Redemptions:{' '}
                <strong>
                  {
                    coupon.redemptionCount
                  }
                </strong>
              </p>
            ) : null}
          </Panel>
        </div><CouponPreview code={code} discountType={discountType} discountValue={discountValue} minimumSubtotal={minimumSubtotal} isActive={isActive} startsAt={startsAt} expiresAt={expiresAt} usageLimit={usageLimit} perCustomerLimit={perCustomerLimit} customer={customerId ? (customers.find(c => c.id === customerId)?.name || "Selected customer") : "Public — all customers"}/></div>

        {error ? (
          <p
            role="alert"
            className="ad-error"
            style={{
              marginTop: 16,
            }}
          >
            {error}
          </p>
        ) : null}

        <div className="ad-savebar">
          <Link href="/admin/coupons">
            Cancel
          </Link>

          <button
            type="submit"
            className="ad-primary"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : id === 'new'
                ? 'Create Coupon'
                : 'Save Changes'}
          </button>
        </div>
      </fieldset></form>
    </>
  );
}
