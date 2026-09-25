-- Transactional runtime coverage for the atomic order/payment workflow.
-- All fixtures and mutations are rolled back.

begin;

create temp table qa_context (
  staff_id uuid,
  happy_order uuid,
  reject_order uuid,
  cod_order uuid,
  proof_a uuid,
  proof_b uuid,
  proof_c uuid,
  proof_d uuid
) on commit drop;

do $setup$
declare
  v_staff uuid;
  v_happy uuid := gen_random_uuid();
  v_reject uuid := gen_random_uuid();
  v_cod uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_d uuid := gen_random_uuid();
begin
  select user_id
  into v_staff
  from public.admin_staff
  where is_active = true
    and (role = 'OWNER' or 'orders.manage' = any(permissions))
  order by case when role = 'OWNER' then 0 else 1 end
  limit 1;

  if v_staff is null then
    raise exception 'No active order manager for QA';
  end if;

  insert into public.orders (
    id, order_number, customer_id, customer_name, customer_phone,
    customer_email, governorate, city_area, street_name, building_number,
    subtotal_amount, shipping_amount, total_amount, payment_method, status,
    is_test
  )
  values
    (v_happy, 'QA-HAPPY-' || left(v_happy::text, 8), v_staff, 'Runtime QA',
      '01000000001', 'qa@example.com', 'Cairo', 'Cairo', 'QA Street', '1',
      100, 50, 150, 'INSTAPAY', 'PENDING_ADMIN_APPROVAL', true),
    (v_reject, 'QA-REJECT-' || left(v_reject::text, 8), v_staff, 'Runtime QA',
      '01000000001', 'qa@example.com', 'Cairo', 'Cairo', 'QA Street', '1',
      100, 50, 150, 'INSTAPAY', 'PENDING_ADMIN_APPROVAL', true),
    (v_cod, 'QA-COD-' || left(v_cod::text, 8), v_staff, 'Runtime QA',
      '01000000001', 'qa@example.com', 'Cairo', 'Cairo', 'QA Street', '1',
      100, 50, 150, 'CASH_ON_DELIVERY', 'PENDING_ADMIN_APPROVAL', true);

  insert into public.payments (order_id, method, status, expected_amount)
  values
    (v_happy, 'INSTAPAY', 'PENDING', 150),
    (v_reject, 'INSTAPAY', 'PENDING', 150),
    (v_cod, 'CASH_ON_DELIVERY', 'NOT_REQUIRED', 150);

  insert into public.customer_uploads (
    id, user_id, storage_path, original_filename, mime_type,
    file_size_bytes, upload_type
  )
  values
    (v_a, v_staff, v_staff::text || '/' || v_a::text || '.png',
      'proof-a.png', 'image/png', 68, 'PAYMENT_PROOF'),
    (v_b, v_staff, v_staff::text || '/' || v_b::text || '.png',
      'proof-b.png', 'image/png', 68, 'PAYMENT_PROOF'),
    (v_c, v_staff, v_staff::text || '/' || v_c::text || '.png',
      'proof-c.png', 'image/png', 68, 'PAYMENT_PROOF'),
    (v_d, v_staff, v_staff::text || '/' || v_d::text || '.png',
      'proof-d.png', 'image/png', 68, 'PAYMENT_PROOF');

  insert into storage.objects (bucket_id, name, owner_id)
  values
    ('payment-proofs', v_staff::text || '/' || v_a::text || '.png', v_staff::text),
    ('payment-proofs', v_staff::text || '/' || v_b::text || '.png', v_staff::text),
    ('payment-proofs', v_staff::text || '/' || v_c::text || '.png', v_staff::text),
    ('payment-proofs', v_staff::text || '/' || v_d::text || '.png', v_staff::text);

  insert into qa_context
  values (v_staff, v_happy, v_reject, v_cod, v_a, v_b, v_c, v_d);
end;
$setup$;

grant select on qa_context to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select staff_id::text from qa_context),
  true
);

set local role authenticated;

do $test$
declare
  q qa_context%rowtype;
  v_json jsonb;
  v_status public.payment_status;
  v_order_status public.order_status;
begin
  select * into q from qa_context;

  begin
    perform public.transition_order_status(
      q.reject_order, 'CONFIRMED', null, null, false
    );
    raise exception 'Expected unverified InstaPay confirmation to fail';
  exception
    when check_violation then
      if sqlerrm not like 'InstaPay payment must be verified%' then
        raise;
      end if;
  end;

  v_json := public.attach_instapay_proof(q.happy_order, q.proof_a);
  if v_json ->> 'status' <> 'PENDING_VERIFICATION' then
    raise exception 'Happy proof did not attach';
  end if;

  begin
    perform public.attach_instapay_proof(q.happy_order, q.proof_b);
    raise exception 'Expected replacement during review to fail';
  exception
    when check_violation then
      if sqlerrm not like 'Payment proof is already awaiting%' then
        raise;
      end if;
  end;

  begin
    perform public.review_instapay_payment(
      q.happy_order, q.proof_b, 'VERIFIED', null
    );
    raise exception 'Expected stale proof review to fail';
  exception
    when check_violation then
      if sqlerrm not like 'Payment proof changed%' then
        raise;
      end if;
  end;

  v_json := public.review_instapay_payment(
    q.happy_order, q.proof_a, 'VERIFIED', null
  );

  select status
  into v_status
  from public.payments
  where order_id = q.happy_order;

  if v_status <> 'VERIFIED'
    or v_json ->> 'verification_source' <> 'PAYMENT_PROOF'
  then
    raise exception 'Happy verification provenance failed';
  end if;

  perform public.transition_order_status(q.happy_order, 'CONFIRMED', null, null, false);
  perform public.transition_order_status(q.happy_order, 'PREPARING', null, null, false);
  perform public.transition_order_status(q.happy_order, 'SHIPPED', null, null, false);
  perform public.transition_order_status(q.happy_order, 'OUT_FOR_DELIVERY', null, null, false);
  perform public.transition_order_status(q.happy_order, 'DELIVERED', null, null, false);

  select status into v_order_status
  from public.orders
  where id = q.happy_order;

  if v_order_status <> 'DELIVERED' then
    raise exception 'Happy lifecycle failed';
  end if;

  perform public.attach_instapay_proof(q.reject_order, q.proof_b);
  v_json := public.review_instapay_payment(
    q.reject_order, q.proof_b, 'REJECTED', 'Wrong amount'
  );

  select status
  into v_status
  from public.payments
  where order_id = q.reject_order;

  if v_status <> 'REJECTED' or v_json ->> 'verification_source' is not null then
    raise exception 'Rejection state failed';
  end if;

  v_json := public.attach_instapay_proof(q.reject_order, q.proof_c);
  if v_json ->> 'previous_upload_id' <> q.proof_b::text then
    raise exception 'Replacement metadata failed';
  end if;

  perform public.review_instapay_payment(
    q.reject_order, q.proof_c, 'VERIFIED', null
  );
  perform public.transition_order_status(
    q.reject_order, 'CONFIRMED', null, null, false
  );

  select status into v_status from public.payments where order_id=q.cod_order;
  if v_status <> 'PENDING' or (select expected_amount from public.payments where order_id=q.cod_order) <> 75 then
    raise exception 'New COD payment was not normalized to a 50%% deposit';
  end if;
  begin
    perform public.transition_order_status(q.cod_order, 'CONFIRMED', null, null, false);
    raise exception 'Expected unverified COD deposit confirmation to fail';
  exception when check_violation then
    if sqlerrm not like 'COD deposit must be verified%' then raise; end if;
  end;
  perform public.attach_payment_proof(q.cod_order, q.proof_d);
  perform public.review_payment_proof(q.cod_order, q.proof_d, 'VERIFIED', null);
  perform public.transition_order_status(q.cod_order, 'CONFIRMED', null, null, false);
  perform public.transition_order_status(q.cod_order, 'PREPARING', null, null, false);
  perform public.transition_order_status(q.cod_order, 'SHIPPED', null, null, false);
  perform public.transition_order_status(q.cod_order, 'OUT_FOR_DELIVERY', null, null, false);
  perform public.transition_order_status(q.cod_order, 'DELIVERED', null, null, false);
end;
$test$;

reset role;

select
  (select status = 'DELIVERED' from public.orders where id = happy_order)
    as instapay_happy_path,
  (select status = 'CONFIRMED' from public.orders where id = reject_order)
    as rejection_replacement_path,
  (select status = 'DELIVERED' from public.orders where id = cod_order)
    as cod_path,
  (select is_test from public.orders where id = happy_order)
    as test_order_preserved,
  (
    select count(*) = 0
    from public.coupon_redemptions
    where order_id in (happy_order, reject_order, cod_order)
  ) as no_test_coupon_consumption
from qa_context;

rollback;
