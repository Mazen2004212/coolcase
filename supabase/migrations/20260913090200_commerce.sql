-- Order, payment, and audit records. Monetary fields are integer EGP snapshots.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.profiles (id) on delete set null,
  address_id uuid references public.addresses (id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  alternate_phone text,
  governorate text not null,
  city_area text not null,
  street_name text not null,
  building_number text not null,
  floor text,
  apartment text,
  landmark text,
  delivery_notes text,
  subtotal_amount integer not null,
  shipping_amount integer not null,
  total_amount integer not null,
  currency text not null default 'EGP',
  payment_method public.payment_method not null,
  status public.order_status not null default 'PENDING_CONFIRMATION',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  constraint orders_order_number_not_blank check (
    length(btrim(order_number)) > 0
  ),
  constraint orders_customer_name_not_blank check (
    length(btrim(customer_name)) > 0
  ),
  constraint orders_customer_phone_not_blank check (
    length(btrim(customer_phone)) > 0
  ),
  constraint orders_governorate_not_blank check (length(btrim(governorate)) > 0),
  constraint orders_city_area_not_blank check (length(btrim(city_area)) > 0),
  constraint orders_street_name_not_blank check (length(btrim(street_name)) > 0),
  constraint orders_building_number_not_blank check (
    length(btrim(building_number)) > 0
  ),
  constraint orders_money_nonnegative check (
    subtotal_amount >= 0 and shipping_amount >= 0 and total_amount >= 0
  ),
  constraint orders_total_matches_components check (
    total_amount = subtotal_amount + shipping_amount
  ),
  constraint orders_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete restrict,
  product_name_snapshot text not null,
  product_image_snapshot text,
  material public.case_material not null,
  phone_model text not null,
  custom_phone_model text,
  network_type public.network_type not null,
  custom_design_upload_id uuid references public.customer_uploads (id) on delete restrict,
  unit_price integer not null,
  quantity integer not null,
  line_total integer not null,
  created_at timestamptz not null default now(),
  constraint order_items_product_name_not_blank check (
    length(btrim(product_name_snapshot)) > 0
  ),
  constraint order_items_phone_model_not_blank check (
    length(btrim(phone_model)) > 0
  ),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_nonnegative check (unit_price >= 0),
  constraint order_items_line_total_nonnegative check (line_total >= 0),
  constraint order_items_line_total_matches check (
    line_total = unit_price * quantity
  ),
  constraint order_items_other_phone_requires_model check (
    phone_model <> 'Other'
    or (
      custom_phone_model is not null
      and length(btrim(custom_phone_model)) > 0
    )
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  method public.payment_method not null,
  status public.payment_status not null,
  expected_amount integer not null,
  currency text not null default 'EGP',
  payment_proof_upload_id uuid references public.customer_uploads (id) on delete restrict,
  verified_by uuid references public.profiles (id) on delete restrict,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_expected_amount_nonnegative check (expected_amount >= 0),
  constraint payments_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint payments_method_status_compatible check (
    (
      method = 'INSTAPAY'
      and status in (
        'PENDING',
        'PENDING_VERIFICATION',
        'VERIFIED',
        'REJECTED',
        'REFUNDED'
      )
    )
    or (
      method = 'CASH_ON_DELIVERY'
      and status in ('NOT_REQUIRED', 'REFUNDED')
    )
  ),
  constraint payments_verified_metadata_required check (
    status <> 'VERIFIED'
    or (verified_by is not null and verified_at is not null)
  ),
  constraint payments_rejection_reason_required check (
    status <> 'REJECTED'
    or (
      rejection_reason is not null
      and length(btrim(rejection_reason)) > 0
    )
  ),
  constraint payments_state_metadata_compatible check (
    case
      when method = 'CASH_ON_DELIVERY' then
        status in ('NOT_REQUIRED', 'REFUNDED')
        and payment_proof_upload_id is null
        and verified_by is null
        and verified_at is null
        and rejection_reason is null
      when status = 'PENDING' then
        payment_proof_upload_id is null
        and verified_by is null
        and verified_at is null
        and rejection_reason is null
      when status = 'PENDING_VERIFICATION' then
        payment_proof_upload_id is not null
        and verified_by is null
        and verified_at is null
        and rejection_reason is null
      when status = 'VERIFIED' then
        payment_proof_upload_id is not null
        and verified_by is not null
        and verified_at is not null
        and rejection_reason is null
      when status = 'REJECTED' then
        payment_proof_upload_id is not null
        and verified_by is null
        and verified_at is null
        and rejection_reason is not null
        and length(btrim(rejection_reason)) > 0
      when status = 'REFUNDED' then
        payment_proof_upload_id is not null
        and verified_by is not null
        and verified_at is not null
        and rejection_reason is null
      else false
    end
  )
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  customer_visible_note text,
  internal_note text,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_action_not_blank check (length(btrim(action)) > 0)
);

create or replace function private.protect_order_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.order_number,
    new.customer_name,
    new.customer_phone,
    new.alternate_phone,
    new.governorate,
    new.city_area,
    new.street_name,
    new.building_number,
    new.floor,
    new.apartment,
    new.landmark,
    new.delivery_notes,
    new.subtotal_amount,
    new.shipping_amount,
    new.total_amount,
    new.currency,
    new.payment_method,
    new.created_at
  ) is distinct from row(
    old.order_number,
    old.customer_name,
    old.customer_phone,
    old.alternate_phone,
    old.governorate,
    old.city_area,
    old.street_name,
    old.building_number,
    old.floor,
    old.apartment,
    old.landmark,
    old.delivery_notes,
    old.subtotal_amount,
    old.shipping_amount,
    old.total_amount,
    old.currency,
    old.payment_method,
    old.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'Historical order snapshot fields cannot be changed';
  end if;

  if new.customer_id is distinct from old.customer_id and new.customer_id is not null then
    raise exception using
      errcode = '23514',
      message = 'Order ownership cannot be reassigned';
  end if;

  if new.address_id is distinct from old.address_id and new.address_id is not null then
    raise exception using
      errcode = '23514',
      message = 'Order address references cannot be reassigned';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_order_snapshot() from public, anon, authenticated, service_role;

create trigger orders_protect_snapshot
  before update on public.orders
  for each row execute function private.protect_order_snapshot();

create or replace function private.protect_order_item_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.order_id,
    new.product_id,
    new.product_name_snapshot,
    new.product_image_snapshot,
    new.material,
    new.phone_model,
    new.custom_phone_model,
    new.network_type,
    new.custom_design_upload_id,
    new.unit_price,
    new.quantity,
    new.line_total,
    new.created_at
  ) is distinct from row(
    old.order_id,
    old.product_id,
    old.product_name_snapshot,
    old.product_image_snapshot,
    old.material,
    old.phone_model,
    old.custom_phone_model,
    old.network_type,
    old.custom_design_upload_id,
    old.unit_price,
    old.quantity,
    old.line_total,
    old.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'Historical order item snapshots cannot be changed';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_order_item_snapshot() from public, anon, authenticated, service_role;

create trigger order_items_protect_snapshot
  before update on public.order_items
  for each row execute function private.protect_order_item_snapshot();

create or replace function private.validate_order_item_upload()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  order_customer_id uuid;
  upload_owner_id uuid;
  linked_upload_type public.upload_type;
begin
  if new.custom_design_upload_id is null then
    return new;
  end if;

  select customer_id
  into order_customer_id
  from public.orders
  where id = new.order_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Order item must reference an existing order';
  end if;

  select user_id, upload_type
  into upload_owner_id, linked_upload_type
  from public.customer_uploads
  where id = new.custom_design_upload_id;

  if not found or linked_upload_type <> 'CUSTOM_CASE_DESIGN' then
    raise exception using
      errcode = '23514',
      message = 'Order item upload must be a custom case design';
  end if;

  if order_customer_id is null or upload_owner_id is distinct from order_customer_id then
    raise exception using
      errcode = '23514',
      message = 'Custom design owner must match the order customer';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_order_item_upload() from public, anon, authenticated, service_role;

create trigger order_items_validate_upload
  before insert or update of order_id, custom_design_upload_id
  on public.order_items
  for each row execute function private.validate_order_item_upload();

create or replace function private.protect_and_validate_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  order_customer_id uuid;
  order_total integer;
  order_currency text;
  order_payment_method public.payment_method;
  proof_owner_id uuid;
  linked_upload_type public.upload_type;
begin
  if tg_op = 'UPDATE' then
    if row(
      new.order_id,
      new.method,
      new.expected_amount,
      new.currency,
      new.created_at
    ) is distinct from row(
      old.order_id,
      old.method,
      old.expected_amount,
      old.currency,
      old.created_at
    ) then
      raise exception using
        errcode = '23514',
        message = 'Historical payment terms cannot be changed';
    end if;
  end if;

  select customer_id, total_amount, currency, payment_method
  into order_customer_id, order_total, order_currency, order_payment_method
  from public.orders
  where id = new.order_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Payment must reference an existing order';
  end if;

  if new.expected_amount is distinct from order_total
    or new.currency is distinct from order_currency
    or new.method is distinct from order_payment_method then
    raise exception using
      errcode = '23514',
      message = 'Payment terms must match the order snapshot';
  end if;

  if new.payment_proof_upload_id is not null then
    select user_id, upload_type
    into proof_owner_id, linked_upload_type
    from public.customer_uploads
    where id = new.payment_proof_upload_id;

    if not found or linked_upload_type <> 'PAYMENT_PROOF' then
      raise exception using
        errcode = '23514',
        message = 'Payment proof must reference a payment-proof upload';
    end if;

    if proof_owner_id is distinct from order_customer_id then
      raise exception using
        errcode = '23514',
        message = 'Payment proof owner must match the order customer';
    end if;

    if order_customer_id is null and tg_op = 'INSERT' then
      raise exception using
        errcode = '23514',
        message = 'New payment proofs require an order customer';
    end if;

    if tg_op = 'UPDATE' then
      if order_customer_id is null
        and new.payment_proof_upload_id is distinct from old.payment_proof_upload_id then
        raise exception using
          errcode = '23514',
          message = 'Payment proof links cannot change after customer deletion';
      end if;
    end if;
  end if;

  if new.verified_by is not null then
    if tg_op = 'INSERT' and not exists (
      select 1
      from public.profiles
      where id = new.verified_by
        and role = 'ADMIN'::public.user_role
    ) then
      raise exception using
        errcode = '23514',
        message = 'Payment verifier must be an administrator';
    end if;

    if tg_op = 'UPDATE' then
      if new.verified_by is distinct from old.verified_by and not exists (
        select 1
        from public.profiles
        where id = new.verified_by
          and role = 'ADMIN'::public.user_role
      ) then
        raise exception using
          errcode = '23514',
          message = 'Payment verifier must be an administrator';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_and_validate_payment() from public, anon, authenticated, service_role;

create trigger payments_protect_and_validate
  before insert or update on public.payments
  for each row execute function private.protect_and_validate_payment();

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

revoke all on function private.validate_history_actor_and_status() from public, anon, authenticated, service_role;

create trigger order_status_history_validate
  before insert on public.order_status_history
  for each row execute function private.validate_history_actor_and_status();

create or replace function private.validate_audit_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.admin_id is not null and not exists (
    select 1
    from public.profiles
    where id = new.admin_id
      and role = 'ADMIN'::public.user_role
  ) then
    raise exception using
      errcode = '23514',
      message = 'Audit actor must be an administrator';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_audit_actor() from public, anon, authenticated, service_role;

create trigger admin_audit_logs_validate_actor
  before insert on public.admin_audit_logs
  for each row execute function private.validate_audit_actor();

create or replace function private.validate_order_subtotal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  affected_order_id uuid;
  stored_subtotal integer;
  item_count bigint;
  item_subtotal bigint;
begin
  if tg_table_name = 'orders' then
    affected_order_id := new.id;
  elsif tg_op = 'DELETE' then
    affected_order_id := old.order_id;
  else
    affected_order_id := new.order_id;
  end if;

  select subtotal_amount
  into stored_subtotal
  from public.orders
  where id = affected_order_id;

  if not found then
    return null;
  end if;

  select count(*), coalesce(sum(line_total), 0)
  into item_count, item_subtotal
  from public.order_items
  where order_id = affected_order_id;

  if item_count = 0 or stored_subtotal::bigint is distinct from item_subtotal then
    raise exception using
      errcode = '23514',
      message = 'Order subtotal must equal the sum of its item snapshots';
  end if;

  return null;
end;
$$;

revoke all on function private.validate_order_subtotal()
  from public, anon, authenticated, service_role;

create constraint trigger orders_validate_item_subtotal
  after insert or update on public.orders
  deferrable initially deferred
  for each row execute function private.validate_order_subtotal();

create constraint trigger order_items_validate_order_subtotal
  after insert or update or delete on public.order_items
  deferrable initially deferred
  for each row execute function private.validate_order_subtotal();
