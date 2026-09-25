-- Mark orders placed by active staff as test orders inside the authoritative
-- order-creation transaction. Test orders retain their complete order/payment
-- lifecycle but do not consume coupon redemptions.

alter table public.orders
  add column is_test boolean not null default false;

create index orders_real_created_at_idx
  on public.orders (created_at desc)
  where is_test = false;

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
  p_payment_method    public.payment_method,
  p_items             jsonb,
  p_address_id        uuid default null,
  p_coupon_code       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_payment_status public.payment_status;

  v_coupon_record record;
  v_coupon_id uuid := null;
  v_coupon_snapshot text := null;
  v_discount_amount integer := 0;
  v_total_amount integer;
  v_customer_usage integer := 0;
  v_total_usage integer := 0;

  v_is_test boolean := false;
begin
  select exists (
    select 1
    from public.admin_staff
    where user_id = p_customer_id
      and is_active = true
  )
  into v_is_test;

  -- Validate and lock the coupon row so limit checks and redemption recording
  -- remain serialized with the order transaction.
  if p_coupon_code is not null
    and btrim(p_coupon_code) <> ''
  then
    if p_customer_id is null then
      raise exception 'Sign in to use a coupon.';
    end if;

    select *
    into v_coupon_record
    from public.coupons
    where upper(code) = upper(btrim(p_coupon_code))
    for update;

    if not found then
      raise exception 'Coupon not found.';
    end if;

    if not v_coupon_record.is_active then
      raise exception 'Coupon is not active.';
    end if;

    if v_coupon_record.starts_at is not null
      and v_coupon_record.starts_at > now()
    then
      raise exception 'Coupon is not valid yet.';
    end if;

    if v_coupon_record.expires_at is not null
      and v_coupon_record.expires_at < now()
    then
      raise exception 'Coupon has expired.';
    end if;

    if v_coupon_record.customer_id is not null
      and v_coupon_record.customer_id <> p_customer_id
    then
      raise exception 'This coupon is not valid for your account.';
    end if;

    if p_subtotal_amount < v_coupon_record.minimum_subtotal then
      raise exception
        'Minimum subtotal of % EGP not met.',
        v_coupon_record.minimum_subtotal;
    end if;

    if v_coupon_record.usage_limit is not null then
      select count(*)
      into v_total_usage
      from public.coupon_redemptions
      where coupon_id = v_coupon_record.id;

      if v_total_usage >= v_coupon_record.usage_limit then
        raise exception 'Coupon usage limit reached.';
      end if;
    end if;

    if v_coupon_record.per_customer_limit is not null then
      select count(*)
      into v_customer_usage
      from public.coupon_redemptions
      where coupon_id = v_coupon_record.id
        and customer_id = p_customer_id;

      if v_customer_usage >= v_coupon_record.per_customer_limit then
        raise exception
          'You have reached the maximum usage limit for this coupon.';
      end if;
    end if;

    if v_coupon_record.discount_type = 'PERCENTAGE' then
      v_discount_amount := floor(
        p_subtotal_amount
        * (v_coupon_record.discount_value::numeric / 100.0)
      );
    elsif v_coupon_record.discount_type = 'FIXED' then
      v_discount_amount := floor(v_coupon_record.discount_value);
    end if;

    if v_discount_amount > p_subtotal_amount then
      v_discount_amount := p_subtotal_amount;
    end if;

    v_coupon_id := v_coupon_record.id;
    v_coupon_snapshot := v_coupon_record.code;
  end if;

  v_total_amount :=
    p_subtotal_amount
    - v_discount_amount
    + p_shipping_amount;

  v_order_number := public.generate_order_number();

  v_payment_status := case p_payment_method
    when 'INSTAPAY'
      then 'PENDING'::public.payment_status
    when 'CASH_ON_DELIVERY'
      then 'NOT_REQUIRED'::public.payment_status
    else 'NOT_REQUIRED'::public.payment_status
  end;

  insert into public.orders (
    order_number,
    customer_id,
    address_id,
    customer_name,
    customer_phone,
    customer_email,
    governorate,
    city_area,
    street_name,
    building_number,
    floor,
    apartment,
    landmark,
    delivery_notes,
    subtotal_amount,
    shipping_amount,
    total_amount,
    payment_method,
    status,
    coupon_id,
    coupon_code_snapshot,
    discount_amount,
    is_test
  )
  values (
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
    v_total_amount,
    p_payment_method,
    'PENDING_ADMIN_APPROVAL'::public.order_status,
    v_coupon_id,
    v_coupon_snapshot,
    v_discount_amount,
    v_is_test
  )
  returning id into v_order_id;

  for v_item in
    select *
    from jsonb_array_elements(p_items)
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
    )
    values (
      v_order_id,
      (v_item ->> 'product_id')::uuid,
      v_item ->> 'product_name_snapshot',
      v_item ->> 'product_image_snapshot',
      (v_item ->> 'material')::public.case_material,
      v_item ->> 'phone_model',
      nullif(
        btrim(coalesce(v_item ->> 'custom_phone_model', '')),
        ''
      ),
      (v_item ->> 'network_type')::public.network_type,
      (v_item ->> 'custom_design_upload_id')::uuid,
      (v_item ->> 'unit_price')::integer,
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'line_total')::integer
    );
  end loop;

  -- Test orders keep the coupon and discount snapshots for realistic QA, but
  -- they must not consume commercial coupon redemption or usage limits.
  if v_coupon_id is not null and not v_is_test then
    insert into public.coupon_redemptions (
      coupon_id,
      order_id,
      customer_id,
      subtotal_amount,
      discount_amount
    )
    values (
      v_coupon_id,
      v_order_id,
      p_customer_id,
      p_subtotal_amount,
      v_discount_amount
    );
  end if;

  insert into public.payments (
    order_id,
    method,
    status,
    expected_amount
  )
  values (
    v_order_id,
    p_payment_method,
    v_payment_status,
    v_total_amount
  );

  insert into public.order_status_history (
    order_id,
    status,
    previous_status,
    changed_by,
    customer_visible_note
  )
  values (
    v_order_id,
    'PENDING_ADMIN_APPROVAL'::public.order_status,
    null,
    null,
    'Order placed successfully.'
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal_amount', p_subtotal_amount,
    'discount_amount', v_discount_amount,
    'shipping_amount', p_shipping_amount,
    'total_amount', v_total_amount,
    'is_test', v_is_test
  );
end;
$$;

revoke all on function public.create_order(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  public.payment_method,
  jsonb,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.create_order(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  public.payment_method,
  jsonb,
  uuid,
  text
) to service_role;
