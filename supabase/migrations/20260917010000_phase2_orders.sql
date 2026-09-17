-- Phase 2: Orders, Checkout, Payments, Email Delivery
-- Extends the existing schema minimally.

-- ─── 1. Enum additions ──────────────────────────────────────────────────────

-- Add PENDING_ADMIN_APPROVAL (synonym for what frontend expects) and REJECTED
-- The existing enum has PENDING_CONFIRMATION — we add PENDING_ADMIN_APPROVAL and
-- REJECTED without removing the old value to avoid breaking existing data.

alter type public.order_status add value if not exists 'PENDING_ADMIN_APPROVAL';
alter type public.order_status add value if not exists 'REJECTED';

-- Ensure OUT_FOR_DELIVERY exists (it was in original migration, but guard it)
-- (already present, but safe to repeat with IF NOT EXISTS)

-- ─── 2. Order sequence for human-readable CC-XXXXXX numbers ─────────────────

create sequence if not exists public.order_number_seq
  start 1000
  increment 1
  no maxvalue
  no cycle;

grant usage on sequence public.order_number_seq to service_role;

-- ─── 3. Orders table additions ───────────────────────────────────────────────

-- customer_email — required for guest orders to receive status emails
alter table public.orders
  add column if not exists customer_email text not null default '';

-- Remove the default after adding (only needed for migration compatibility)
alter table public.orders
  alter column customer_email drop default;

alter table public.orders
  add constraint orders_customer_email_not_blank check (
    length(btrim(customer_email)) > 0
  );

-- rejected_at for REJECTED terminal status
alter table public.orders
  add column if not exists rejected_at timestamptz;

-- Shipping details (flat columns — no separate shipping table needed)
alter table public.orders
  add column if not exists shipping_courier text not null default '',
  add column if not exists shipping_tracking_number text not null default '',
  add column if not exists shipping_current_location text not null default '',
  add column if not exists shipping_notes text not null default '';  -- ADMIN-ONLY, never exposed publicly

-- Grant service_role update on new mutable columns
grant update (
  status,
  customer_email,
  confirmed_at,
  shipped_at,
  delivered_at,
  cancelled_at,
  rejected_at,
  shipping_courier,
  shipping_tracking_number,
  shipping_current_location,
  shipping_notes
) on table public.orders to service_role;

-- ─── 4. order_status_history additions ──────────────────────────────────────

alter table public.order_status_history
  add column if not exists previous_status public.order_status;

-- ─── 5. customer_uploads: allow guest uploads (user_id is null) ─────────────

-- The existing constraint requires storage_path to start with user_id for private uploads.
-- For guest custom designs, user_id is null and path is like 'guests/{uuid}/...'.
-- We need to relax this constraint.

alter table public.customer_uploads
  drop constraint if exists customer_uploads_private_path_is_user_scoped;

alter table public.customer_uploads
  add constraint customer_uploads_private_path_is_user_scoped check (
    -- Product images don't need user scoping
    upload_type = 'PRODUCT_IMAGE'
    -- Authenticated user uploads scoped to their UID
    or (user_id is not null and storage_path like user_id::text || '/%')
    -- Guest uploads scoped to 'guests/' prefix (service-role only)
    or (user_id is null and storage_path like 'guests/%')
  );

-- Also allow service_role to insert customer_uploads for guest designs
grant select, insert on table public.customer_uploads to service_role;

-- ─── 6. Email delivery log (idempotency) ────────────────────────────────────

create table if not exists public.email_delivery_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- event mirrors the order_status that triggered the email (string to avoid tight enum coupling)
  event text not null,
  recipient_email text not null,
  subject text,
  sent_at timestamptz not null default now(),
  success boolean not null default false,
  provider_message_id text,
  error_message text,
  constraint email_delivery_log_event_not_blank check (length(btrim(event)) > 0),
  constraint email_delivery_log_recipient_not_blank check (length(btrim(recipient_email)) > 0),
  -- Prevent duplicate sends for the same order+event combination
  constraint email_delivery_log_order_event_unique unique (order_id, event)
);

alter table public.email_delivery_log enable row level security;

revoke all on table public.email_delivery_log from public, anon, authenticated, service_role;
grant select, insert, update on table public.email_delivery_log to service_role;

create policy email_delivery_log_admin_select
  on public.email_delivery_log
  for select
  to authenticated
  using (private.is_admin());

-- ─── 7. Generate order number function ──────────────────────────────────────

create or replace function public.generate_order_number()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'CC-' || lpad(nextval('public.order_number_seq')::text, 6, '0')
$$;

revoke all on function public.generate_order_number() from public, anon, authenticated;
grant execute on function public.generate_order_number() to service_role;

-- ─── 8. Atomic order creation RPC ───────────────────────────────────────────

create or replace function public.create_order(
  p_customer_id       uuid,
  p_customer_name     text,
  p_customer_phone    text,
  p_customer_email    text,
  p_governorate       text,
  p_city_area         text,
  p_street_name       text,
  p_building_number   text,
  p_floor             text,
  p_apartment         text,
  p_landmark          text,
  p_delivery_notes    text,
  p_subtotal_amount   integer,
  p_shipping_amount   integer,
  p_total_amount      integer,
  p_payment_method    public.payment_method,
  p_items             jsonb,   -- array of item objects
  p_address_id        uuid     default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id     uuid;
  v_order_number text;
  v_item         jsonb;
  v_payment_status public.payment_status;
begin
  -- Generate unique order number
  v_order_number := public.generate_order_number();

  -- Determine initial payment status
  v_payment_status := case p_payment_method
    when 'INSTAPAY'        then 'PENDING'::public.payment_status
    when 'CASH_ON_DELIVERY' then 'NOT_REQUIRED'::public.payment_status
    else 'NOT_REQUIRED'::public.payment_status
  end;

  -- Insert order
  insert into public.orders (
    order_number, customer_id, address_id,
    customer_name, customer_phone, customer_email,
    governorate, city_area, street_name, building_number,
    floor, apartment, landmark, delivery_notes,
    subtotal_amount, shipping_amount, total_amount,
    payment_method, status
  ) values (
    v_order_number,
    p_customer_id,
    p_address_id,
    btrim(p_customer_name),
    btrim(p_customer_phone),
    lower(btrim(p_customer_email)),
    btrim(p_governorate),
    btrim(p_city_area),
    btrim(p_street_name),
    btrim(p_building_number),
    nullif(btrim(coalesce(p_floor, '')), ''),
    nullif(btrim(coalesce(p_apartment, '')), ''),
    nullif(btrim(coalesce(p_landmark, '')), ''),
    nullif(btrim(coalesce(p_delivery_notes, '')), ''),
    p_subtotal_amount,
    p_shipping_amount,
    p_total_amount,
    p_payment_method,
    'PENDING_ADMIN_APPROVAL'::public.order_status
  )
  returning id into v_order_id;

  -- Insert order items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      product_image_snapshot,
      material,
      phone_model,
      custom_phone_model,
      network_type,
      custom_design_upload_id,
      unit_price,
      quantity,
      line_total
    ) values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name_snapshot',
      v_item->>'product_image_snapshot',
      (v_item->>'material')::public.case_material,
      v_item->>'phone_model',
      nullif(btrim(coalesce(v_item->>'custom_phone_model', '')), ''),
      (v_item->>'network_type')::public.network_type,
      (v_item->>'custom_design_upload_id')::uuid,
      (v_item->>'unit_price')::integer,
      (v_item->>'quantity')::integer,
      (v_item->>'line_total')::integer
    );
  end loop;

  -- Insert payment record
  insert into public.payments (
    order_id,
    method,
    status,
    expected_amount
  ) values (
    v_order_id,
    p_payment_method,
    v_payment_status,
    p_total_amount
  );

  -- Insert initial order status history
  insert into public.order_status_history (
    order_id,
    status,
    previous_status,
    changed_by,
    customer_visible_note
  ) values (
    v_order_id,
    'PENDING_ADMIN_APPROVAL'::public.order_status,
    null,
    null,
    'Order placed successfully.'
  );

  return jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', v_order_number
  );

exception
  when others then
    raise;
end;
$$;

revoke all on function public.create_order from public, anon, authenticated;
grant execute on function public.create_order to service_role;

-- ─── 9. Update order status history trigger ──────────────────────────────────
-- Allow history actor to be null (for system/customer-initiated events)
-- The existing trigger rejects null changed_by when the actor is not admin.
-- We keep that constraint but allow explicit null (system events).

-- Drop and recreate the validate_history_actor_and_status function to allow
-- null changed_by (system-generated entries like initial order placement).

create or replace function private.validate_history_actor_and_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.orders
    where id = new.order_id
      and status = new.status
  ) then
    raise exception using
      errcode = '23514',
      message = 'Order history status must match the current order status';
  end if;

  -- Allow null changed_by for system/customer-initiated events
  -- Only enforce admin check when changed_by is explicitly provided
  if new.changed_by is not null and not exists (
    select 1
    from public.profiles
    where id = new.changed_by
      and role = 'ADMIN'::public.user_role
  ) then
    raise exception using
      errcode = '23514',
      message = 'Order history actor must be an administrator';
  end if;

  return new;
end;
$$;

-- ─── 10. Public order tracking via RPC (anon-safe) ───────────────────────────

create or replace function public.track_order(
  p_order_number text,
  p_contact      text   -- email or phone, trimmed and lowercased for email
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    record;
  v_items    jsonb;
  v_history  jsonb;
begin
  -- Lookup by order number + email or phone verification
  select
    o.id, o.order_number, o.status, o.created_at,
    o.customer_name, o.customer_email, o.customer_phone,
    o.governorate, o.city_area, o.street_name, o.building_number,
    o.floor, o.apartment, o.landmark,
    o.subtotal_amount, o.shipping_amount, o.total_amount,
    o.payment_method,
    o.shipping_courier, o.shipping_tracking_number, o.shipping_current_location
    -- NOTE: shipping_notes is intentionally excluded
  into v_order
  from public.orders o
  where upper(btrim(o.order_number)) = upper(btrim(p_order_number))
    and (
      lower(o.customer_email) = lower(btrim(p_contact))
      or o.customer_phone = btrim(p_contact)
    );

  if not found then
    return null;
  end if;

  -- Fetch items (customer-visible snapshot only)
  select jsonb_agg(jsonb_build_object(
    'product_name_snapshot', oi.product_name_snapshot,
    'material',              oi.material,
    'phone_model',           oi.phone_model,
    'network_type',          oi.network_type,
    'quantity',              oi.quantity,
    'unit_price',            oi.unit_price,
    'line_total',            oi.line_total
  ) order by oi.created_at)
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  -- Fetch customer-visible status history (exclude internal_note)
  select jsonb_agg(jsonb_build_object(
    'status',               h.status,
    'customer_visible_note', h.customer_visible_note,
    'created_at',           h.created_at
  ) order by h.created_at)
  into v_history
  from public.order_status_history h
  where h.order_id = v_order.id;

  return jsonb_build_object(
    'order_number',     v_order.order_number,
    'status',           v_order.status,
    'created_at',       v_order.created_at,
    'customer_name',    v_order.customer_name,
    'governorate',      v_order.governorate,
    'city_area',        v_order.city_area,
    'subtotal_amount',  v_order.subtotal_amount,
    'shipping_amount',  v_order.shipping_amount,
    'total_amount',     v_order.total_amount,
    'payment_method',   v_order.payment_method,
    'shipping',         jsonb_build_object(
      'courier',          v_order.shipping_courier,
      'tracking_number',  v_order.shipping_tracking_number,
      'current_location', v_order.shipping_current_location
    ),
    'items',    coalesce(v_items,   '[]'::jsonb),
    'history',  coalesce(v_history, '[]'::jsonb)
  );
end;
$$;

-- Allow anon to call track_order (no PII beyond what's verified by contact)
revoke all on function public.track_order from public, anon, authenticated, service_role;
grant execute on function public.track_order to anon, authenticated, service_role;

-- ─── 11. Indexes ─────────────────────────────────────────────────────────────

create index if not exists orders_order_number_idx on public.orders (order_number);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_customer_email_idx on public.orders (lower(customer_email));
create index if not exists email_delivery_log_order_event_idx on public.email_delivery_log (order_id, event);
create index if not exists order_status_history_order_id_idx on public.order_status_history (order_id, created_at);
