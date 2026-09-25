-- migration: checkout coupons rpc

-- 1. Drop old function signature to avoid ambiguous overload
DROP FUNCTION IF EXISTS public.create_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, 
  integer, integer, integer, public.payment_method, jsonb, uuid
);

-- 2. Create the new function
CREATE OR REPLACE FUNCTION public.create_order(
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id         uuid;
  v_order_number     text;
  v_item             jsonb;
  v_payment_status   public.payment_status;
  
  -- Coupon variables
v_coupon_record      record;
v_coupon_id          uuid := null;
v_coupon_snapshot    text := null;
v_discount_amount    integer := 0;
v_total_amount       integer;
v_customer_usage     integer := 0;
BEGIN
  -- 1. Validate and lock coupon if provided
  IF p_coupon_code IS NOT NULL AND btrim(p_coupon_code) <> '' THEN
    
    IF p_customer_id IS NULL THEN
      RAISE EXCEPTION 'Sign in to use a coupon.';
    END IF;

    -- Lock the coupon row for atomic validation
    SELECT * INTO v_coupon_record 
    FROM public.coupons 
    WHERE upper(code) = upper(btrim(p_coupon_code))
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Coupon not found.';
    END IF;
    
    IF NOT v_coupon_record.is_active THEN
      RAISE EXCEPTION 'Coupon is not active.';
    END IF;
    
    IF v_coupon_record.starts_at IS NOT NULL AND v_coupon_record.starts_at > now() THEN
      RAISE EXCEPTION 'Coupon is not valid yet.';
    END IF;
    
    IF v_coupon_record.expires_at IS NOT NULL AND v_coupon_record.expires_at < now() THEN
      RAISE EXCEPTION 'Coupon has expired.';
    END IF;
    
    IF v_coupon_record.customer_id IS NOT NULL AND v_coupon_record.customer_id <> p_customer_id THEN
      RAISE EXCEPTION 'This coupon is not valid for your account.';
    END IF;
    
    IF p_subtotal_amount < v_coupon_record.minimum_subtotal THEN
      RAISE EXCEPTION 'Minimum subtotal of % EGP not met.', v_coupon_record.minimum_subtotal;
    END IF;
    
    -- Check global usage limit
    IF v_coupon_record.usage_limit IS NOT NULL THEN
      DECLARE
        v_total_usage integer;
      BEGIN
        SELECT count(*) INTO v_total_usage FROM public.coupon_redemptions WHERE coupon_id = v_coupon_record.id;
        IF v_total_usage >= v_coupon_record.usage_limit THEN
          RAISE EXCEPTION 'Coupon usage limit reached.';
        END IF;
      END;
    END IF;
    
    -- Check per-customer usage limit
    IF v_coupon_record.per_customer_limit IS NOT NULL THEN
      SELECT count(*) INTO v_customer_usage FROM public.coupon_redemptions 
      WHERE coupon_id = v_coupon_record.id AND customer_id = p_customer_id;
      
      IF v_customer_usage >= v_coupon_record.per_customer_limit THEN
        RAISE EXCEPTION 'You have reached the maximum usage limit for this coupon.';
      END IF;
    END IF;
    
    -- Calculate discount based on subtotal ONLY
    IF v_coupon_record.discount_type = 'PERCENTAGE' THEN
  v_discount_amount := floor(
    p_subtotal_amount * (v_coupon_record.discount_value::numeric / 100.0)
  );
ELSIF v_coupon_record.discount_type = 'FIXED' THEN
  v_discount_amount := floor(v_coupon_record.discount_value);
END IF;
    
    -- Clamp discount so it never exceeds subtotal
IF v_discount_amount > p_subtotal_amount THEN
  v_discount_amount := p_subtotal_amount;
END IF;

v_coupon_id := v_coupon_record.id;
v_coupon_snapshot := v_coupon_record.code;

END IF;

  -- 2. Calculate authoritative total amount
  v_total_amount := p_subtotal_amount - v_discount_amount + p_shipping_amount;

  -- 3. Generate unique order number
  v_order_number := public.generate_order_number();

  -- 4. Determine initial payment status
  v_payment_status := CASE p_payment_method
    WHEN 'INSTAPAY'        THEN 'PENDING'::public.payment_status
    WHEN 'CASH_ON_DELIVERY' THEN 'NOT_REQUIRED'::public.payment_status
    ELSE 'NOT_REQUIRED'::public.payment_status
  END;

  -- 5. Insert order
  INSERT INTO public.orders (
    order_number, customer_id, address_id,
    customer_name, customer_phone, customer_email,
    governorate, city_area, street_name, building_number,
    floor, apartment, landmark, delivery_notes,
    subtotal_amount, shipping_amount, total_amount,
    payment_method, status,
    coupon_id, coupon_code_snapshot, discount_amount
  ) VALUES (
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
v_discount_amount
  )
  RETURNING id INTO v_order_id;

  -- 6. Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
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
    ) VALUES (
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
  END LOOP;

  -- 7. Record coupon redemption if coupon used
  IF v_coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (
      coupon_id, order_id, customer_id, subtotal_amount, discount_amount
    ) VALUES (
v_coupon_id, v_order_id, p_customer_id, p_subtotal_amount, v_discount_amount
    );
  END IF;

  -- 8. Insert payment record
  INSERT INTO public.payments (
    order_id,
    method,
    status,
    expected_amount
  ) VALUES (
    v_order_id,
    p_payment_method,
    v_payment_status,
    v_total_amount
  );

  -- 9. Insert initial order status history
  INSERT INTO public.order_status_history (
    order_id,
    status,
    previous_status,
    changed_by,
    customer_visible_note
  ) VALUES (
    v_order_id,
    'PENDING_ADMIN_APPROVAL'::public.order_status,
    null,
    null,
    'Order placed successfully.'
  );

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', v_order_number
  );

EXCEPTION
  WHEN others THEN
    RAISE;
END;
$$;

-- 3. Restore execute grants
REVOKE ALL ON FUNCTION public.create_order FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order TO service_role;
