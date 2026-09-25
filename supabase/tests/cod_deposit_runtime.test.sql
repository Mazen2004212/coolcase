-- Authoritative COD deposit arithmetic, coupon, shipping, and legacy coverage.
begin;

create temp table cod_qa(owner_id uuid, product_id uuid, coupon_id uuid, order_id uuid) on commit drop;

do $$
declare
  v_owner uuid; v_product uuid; v_coupon uuid; v_result jsonb;
begin
  select user_id into v_owner from public.admin_staff where role='OWNER' and is_active limit 1;
  select id into v_product from public.products where is_active and is_available limit 1;
  if v_owner is null or v_product is null then raise exception 'COD QA prerequisites unavailable'; end if;

  insert into public.coupons(code,title,discount_type,discount_value,minimum_subtotal,is_active,created_by)
  values('CODQA-'||left(gen_random_uuid()::text,8),'COD deposit QA','FIXED',33,0,true,v_owner)
  returning id into v_coupon;

  v_result := public.create_order(
    v_owner,'COD Coupon QA','01000000001','qa@example.com','Cairo','Nasr City',
    'QA Street','1',null,null,null,null,200,51,'CASH_ON_DELIVERY',
    jsonb_build_array(jsonb_build_object(
      'product_id',v_product,'product_name_snapshot','COD QA Product',
      'product_image_snapshot',null,'material','SILICONE','phone_model','iPhone 15',
      'custom_phone_model',null,'network_type','FIVE_G','custom_design_upload_id',null,
      'customization_type',null,'custom_template_id',null,'customization_snapshot',null,
      'unit_price',200,'quantity',1,'line_total',200
    )),null,(select code from public.coupons where id=v_coupon)
  );
  insert into cod_qa values(v_owner,v_product,v_coupon,(v_result->>'order_id')::uuid);
end $$;

do $$
declare q cod_qa%rowtype; v_order public.orders%rowtype; v_payment public.payments%rowtype;
begin
  select * into q from cod_qa;
  select * into v_order from public.orders where id=q.order_id;
  select * into v_payment from public.payments where order_id=q.order_id;
  if v_order.subtotal_amount<>200 or v_order.discount_amount<>33 or v_order.shipping_amount<>51 or v_order.total_amount<>218 then
    raise exception 'Coupon/shipping total mismatch';
  end if;
  if v_payment.status<>'PENDING' or v_payment.expected_amount<>109 then
    raise exception 'COD deposit is not exact 50 percent of final total';
  end if;
  if not v_order.is_test or exists(select 1 from public.coupon_redemptions where order_id=q.order_id) then
    raise exception 'Test-order coupon behavior regressed';
  end if;
  if not exists(select 1 from public.payments where method='CASH_ON_DELIVERY' and status='NOT_REQUIRED') then
    raise exception 'Historical COD compatibility marker is missing';
  end if;
end $$;

select true as cod_coupon_deposit_and_legacy_compatibility;
rollback;
