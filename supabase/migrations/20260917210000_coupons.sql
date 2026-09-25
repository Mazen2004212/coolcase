-- ============================================================
-- Coolcase Coupons
-- ============================================================

create table public.coupons (
  id uuid primary key default gen_random_uuid(),

  code text not null,
  title text not null,

  discount_type text not null
    check (discount_type in ('PERCENTAGE', 'FIXED')),

  discount_value numeric(12,2) not null
    check (discount_value > 0),

  minimum_subtotal numeric(12,2) not null default 0
    check (minimum_subtotal >= 0),

  is_active boolean not null default true,

  starts_at timestamptz null,
  expires_at timestamptz null,

  usage_limit integer null
    check (usage_limit is null or usage_limit > 0),

  per_customer_limit integer null
    check (
      per_customer_limit is null
      or per_customer_limit > 0
    ),

  -- NULL = public coupon
  -- UUID = coupon is restricted to one customer
  customer_id uuid null
    references public.profiles(id)
    on delete cascade,

  created_by uuid null
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint coupons_date_window_check
    check (
      starts_at is null
      or expires_at is null
      or expires_at > starts_at
    ),

  constraint coupons_percentage_value_check
    check (
      discount_type <> 'PERCENTAGE'
      or discount_value <= 100
    )
);

create unique index coupons_code_unique_ci
  on public.coupons (lower(code));

create index coupons_active_idx
  on public.coupons (is_active);

create index coupons_customer_idx
  on public.coupons (customer_id);

create index coupons_expiry_idx
  on public.coupons (expires_at);


-- ============================================================
-- Coupon redemptions
-- ============================================================

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),

  coupon_id uuid not null
    references public.coupons(id)
    on delete restrict,

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  customer_id uuid not null
    references public.profiles(id)
    on delete restrict,

  subtotal_amount numeric(12,2) not null
    check (subtotal_amount >= 0),

  discount_amount numeric(12,2) not null
    check (discount_amount >= 0),

  created_at timestamptz not null default now(),

  constraint coupon_redemptions_order_unique
    unique (order_id)
);

create index coupon_redemptions_coupon_idx
  on public.coupon_redemptions (coupon_id);

create index coupon_redemptions_customer_idx
  on public.coupon_redemptions (customer_id);

create index coupon_redemptions_coupon_customer_idx
  on public.coupon_redemptions (
    coupon_id,
    customer_id
  );


-- ============================================================
-- Order coupon snapshot
-- ============================================================

alter table public.orders
  add column coupon_id uuid null
    references public.coupons(id)
    on delete set null;

alter table public.orders
  add column coupon_code_snapshot text null;

alter table public.orders
  add column discount_amount numeric(12,2)
    not null default 0
    check (discount_amount >= 0);


-- ============================================================
-- updated_at trigger
-- ============================================================

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row
  execute function private.set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table public.coupons
  enable row level security;

alter table public.coupon_redemptions
  enable row level security;


-- ============================================================
-- Privileges
-- ============================================================

revoke all on table public.coupons
  from public, anon, authenticated, service_role;

revoke all on table public.coupon_redemptions
  from public, anon, authenticated, service_role;


-- Server-side privileged access.
grant select, insert, update, delete
  on table public.coupons
  to service_role;

grant select, insert, update, delete
  on table public.coupon_redemptions
  to service_role;


-- Customers may see their own redemption history.
grant select
  on table public.coupon_redemptions
  to authenticated;

create policy coupon_redemptions_customer_read
  on public.coupon_redemptions
  for select
  to authenticated
  using (
    customer_id = (select auth.uid())
  );


-- Admin users may read coupons through an authenticated
-- Supabase session if needed, while mutations should remain
-- server-side through the service-role Admin actions.
grant select
  on table public.coupons
  to authenticated;

create policy coupons_admin_read
  on public.coupons
  for select
  to authenticated
  using (
    private.is_admin()
  );


-- ============================================================
-- Orders: service-role access to new coupon columns
-- ============================================================

grant update (
  coupon_id,
  coupon_code_snapshot,
  discount_amount
)
on table public.orders
to service_role;