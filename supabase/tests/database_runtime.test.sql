-- Phase 2B linked-development runtime assertions.
-- Execute only against the dedicated Coolcase development project. The caller
-- creates the three short-lived Auth users before this transaction runs.

begin;

create or replace function pg_temp.assert_true(result boolean, test_name text)
returns text
language plpgsql
as $$
begin
  if result is not true then
    raise exception using
      errcode = 'P0001',
      message = 'Phase 2B assertion failed: ' || test_name;
  end if;

  return 'PASS: ' || test_name;
end;
$$;

create or replace function pg_temp.expect_sqlstate(
  statement text,
  expected_sqlstate text,
  test_name text
)
returns text
language plpgsql
as $$
begin
  execute statement;
exception
  when others then
    if sqlstate = expected_sqlstate then
      return 'PASS: ' || test_name;
    end if;

    raise exception using
      errcode = 'P0001',
      message = format(
        'Phase 2B assertion failed: %s (expected SQLSTATE %s, received %s: %s)',
        test_name,
        expected_sqlstate,
        sqlstate,
        sqlerrm
      );
end;
$$;

create temporary table phase2b_context (
  customer_a_id uuid not null,
  customer_b_id uuid not null,
  admin_id uuid not null,
  order_a_id uuid not null default gen_random_uuid(),
  order_b_id uuid not null default gen_random_uuid(),
  order_instapay_id uuid not null default gen_random_uuid(),
  order_valid_id uuid not null default gen_random_uuid(),
  order_bad_total_id uuid not null default gen_random_uuid(),
  order_zero_items_id uuid not null default gen_random_uuid(),
  proof_a_id uuid not null default gen_random_uuid(),
  proof_b_id uuid not null default gen_random_uuid()
) on commit drop;

insert into phase2b_context (customer_a_id, customer_b_id, admin_id)
select
  (select id from public.profiles where full_name = 'Phase 2B Customer A' order by created_at desc limit 1),
  (select id from public.profiles where full_name = 'Phase 2B Customer B' order by created_at desc limit 1),
  (select id from public.profiles where full_name = 'Phase 2B Admin Test' order by created_at desc limit 1);

select pg_temp.assert_true(
  (select count(*) = 1 from phase2b_context),
  'all temporary identity IDs were resolved'
);
select pg_temp.assert_true(
  (select role = 'CUSTOMER' from public.profiles where id = (select customer_a_id from phase2b_context)),
  'CUSTOMER_A retains CUSTOMER role'
);
select pg_temp.assert_true(
  (select role = 'CUSTOMER' from public.profiles where id = (select customer_b_id from phase2b_context)),
  'CUSTOMER_B retains CUSTOMER role'
);
select pg_temp.assert_true(
  (select role = 'ADMIN' from public.profiles where id = (select admin_id from phase2b_context)),
  'ADMIN_TEST has trusted ADMIN promotion'
);

select pg_temp.assert_true(
  (select reloptions @> array['security_invoker=true']
   from pg_class
   where oid = 'public.order_tracking_events'::regclass),
  'order_tracking_events has security_invoker enabled'
);
select pg_temp.assert_true(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_tracking_events'
      and column_name = 'internal_note'
  ),
  'order_tracking_events omits internal_note'
);

select pg_temp.assert_true(
  (select count(*) = 7
   from public.categories
   where slug in (
     'iphone-cases', 'samsung-cases', 'custom-cases', 'clear-cases',
     'tough-cases', 'magsafe', 'accessories'
   )),
  'all seven approved seed categories exist'
);
select pg_temp.assert_true(
  (select value = '150'::jsonb from public.store_settings where key = 'silicone_price')
  and (select value = '200'::jsonb from public.store_settings where key = 'acrylic_price')
  and (select value = '50'::jsonb from public.store_settings where key = 'shipping_fee')
  and (select value = '"EGP"'::jsonb from public.store_settings where key = 'currency'),
  'approved seed settings have exact values'
);

insert into public.customer_uploads (
  id, user_id, storage_path, original_filename, mime_type, file_size_bytes, upload_type
)
select
  proof_a_id,
  customer_a_id,
  customer_a_id::text || '/phase2b-proof-a.png',
  'phase2b-proof-a.png',
  'image/png',
  68,
  'PAYMENT_PROOF'::public.upload_type
from phase2b_context
union all
select
  proof_b_id,
  customer_b_id,
  customer_b_id::text || '/phase2b-proof-b.png',
  'phase2b-proof-b.png',
  'image/png',
  68,
  'PAYMENT_PROOF'::public.upload_type
from phase2b_context;

insert into public.orders (
  id, order_number, customer_id, customer_name, customer_phone,
  governorate, city_area, street_name, building_number,
  subtotal_amount, shipping_amount, total_amount, currency, payment_method
)
select
  order_valid_id,
  'CC-P2B-V-' || left(order_valid_id::text, 8),
  customer_a_id,
  'Valid Deferred Order', '01000000003',
  'Cairo', 'Maadi', 'Test Street', '3',
  300, 50, 350, 'EGP', 'CASH_ON_DELIVERY'
from phase2b_context;

insert into public.order_items (
  order_id, product_name_snapshot, material, phone_model, network_type,
  unit_price, quantity, line_total
)
select order_valid_id, 'Valid Deferred Item', 'SILICONE', 'iPhone 15', 'FIVE_G', 150, 2, 300
from phase2b_context;

set constraints all immediate;
select pg_temp.assert_true(true, 'matching subtotal succeeds at deferred commit boundary');
set constraints all deferred;

insert into public.orders (
  id, order_number, customer_id, customer_name, customer_phone,
  governorate, city_area, street_name, building_number,
  subtotal_amount, shipping_amount, total_amount, currency, payment_method
)
select
  order_a_id,
  'CC-P2B-A-' || left(order_a_id::text, 8),
  customer_a_id,
  'Phase 2B Customer A',
  '01000000001',
  'Cairo', 'Nasr City', 'Test Street', '1',
  150, 50, 200, 'EGP', 'CASH_ON_DELIVERY'::public.payment_method
from phase2b_context
union all
select
  order_b_id,
  'CC-P2B-B-' || left(order_b_id::text, 8),
  customer_b_id,
  'Phase 2B Customer B',
  '01000000002',
  'Giza', 'Dokki', 'Test Street', '2',
  200, 50, 250, 'EGP', 'CASH_ON_DELIVERY'::public.payment_method
from phase2b_context
union all
select
  order_instapay_id,
  'CC-P2B-I-' || left(order_instapay_id::text, 8),
  customer_a_id,
  'Phase 2B Customer A',
  '01000000001',
  'Cairo', 'Nasr City', 'Test Street', '1',
  150, 50, 200, 'EGP', 'INSTAPAY'::public.payment_method
from phase2b_context;

insert into public.order_items (
  order_id, product_name_snapshot, material, phone_model, network_type,
  unit_price, quantity, line_total
)
select order_a_id, 'Phase 2B Case A', 'SILICONE'::public.case_material, 'iPhone 15', 'FIVE_G'::public.network_type, 150, 1, 150
from phase2b_context
union all
select order_b_id, 'Phase 2B Case B', 'ACRYLIC'::public.case_material, 'iPhone 16', 'FIVE_G'::public.network_type, 200, 1, 200
from phase2b_context
union all
select order_instapay_id, 'Phase 2B InstaPay Case', 'SILICONE'::public.case_material, 'iPhone 15', 'FIVE_G'::public.network_type, 150, 1, 150
from phase2b_context;

insert into public.payments (order_id, method, status, expected_amount, currency)
select order_a_id, 'CASH_ON_DELIVERY'::public.payment_method, 'NOT_REQUIRED'::public.payment_status, 200, 'EGP'
from phase2b_context
union all
select order_b_id, 'CASH_ON_DELIVERY'::public.payment_method, 'NOT_REQUIRED'::public.payment_status, 250, 'EGP'
from phase2b_context;

insert into public.payments (
  order_id, method, status, expected_amount, currency, payment_proof_upload_id
)
select
  order_instapay_id,
  'INSTAPAY',
  'PENDING_VERIFICATION',
  200,
  'EGP',
  proof_a_id
from phase2b_context;

insert into public.order_status_history (
  order_id, status, customer_visible_note, internal_note
)
select order_a_id, 'PENDING_CONFIRMATION'::public.order_status, 'Order received', 'private-a'
from phase2b_context
union all
select order_b_id, 'PENDING_CONFIRMATION'::public.order_status, 'Order received', 'private-b'
from phase2b_context
union all
select order_instapay_id, 'PENDING_CONFIRMATION'::public.order_status, 'Proof received', 'private-payment-note'
from phase2b_context;

insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id)
select admin_id, 'PHASE_2B_TEST', 'order', order_a_id
from phase2b_context;

set constraints all immediate;
select pg_temp.assert_true(true, 'valid order totals pass deferred checks');
set constraints all deferred;

select pg_temp.expect_sqlstate(
  format(
    'insert into public.order_items (order_id, product_name_snapshot, material, phone_model, network_type, unit_price, quantity, line_total) values (%L::uuid, %L, %L, %L, %L, 150, 0, 0)',
    order_a_id, 'Invalid quantity', 'SILICONE', 'iPhone 15', 'FIVE_G'
  ),
  '23514',
  'quantity zero is rejected'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'insert into public.order_items (order_id, product_name_snapshot, material, phone_model, network_type, unit_price, quantity, line_total) values (%L::uuid, %L, %L, %L, %L, -1, 1, -1)',
    order_a_id, 'Negative price', 'SILICONE', 'iPhone 15', 'FIVE_G'
  ),
  '23514',
  'negative unit price is rejected'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'insert into public.order_items (order_id, product_name_snapshot, material, phone_model, network_type, unit_price, quantity, line_total) values (%L::uuid, %L, %L, %L, %L, 150, 2, 299)',
    order_a_id, 'Wrong line total', 'SILICONE', 'iPhone 15', 'FIVE_G'
  ),
  '23514',
  'incorrect line total is rejected'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'insert into public.order_items (order_id, product_name_snapshot, material, phone_model, custom_phone_model, network_type, unit_price, quantity, line_total) values (%L::uuid, %L, %L, %L, null, %L, 150, 1, 150)',
    order_a_id, 'Missing phone model', 'SILICONE', 'Other', 'FIVE_G'
  ),
  '23514',
  'Other phone requires a custom model'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'update public.order_items set product_name_snapshot = %L where order_id = %L::uuid',
    'Changed historical item', order_a_id
  ),
  '23514',
  'trusted writes cannot mutate historical item snapshots'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'update public.orders set customer_name = %L where id = %L::uuid',
    'Changed historical customer', order_a_id
  ),
  '23514',
  'trusted writes cannot mutate historical order snapshots'
)
from phase2b_context;

insert into public.orders (
  id, order_number, customer_id, customer_name, customer_phone,
  governorate, city_area, street_name, building_number,
  subtotal_amount, shipping_amount, total_amount, currency, payment_method
)
select
  order_bad_total_id,
  'CC-P2B-X-' || left(order_bad_total_id::text, 8),
  customer_a_id,
  'Invalid Deferred Order', '01000000004',
  'Cairo', 'Maadi', 'Test Street', '4',
  301, 50, 351, 'EGP', 'CASH_ON_DELIVERY'
from phase2b_context;

insert into public.order_items (
  order_id, product_name_snapshot, material, phone_model, network_type,
  unit_price, quantity, line_total
)
select order_bad_total_id, 'Invalid Deferred Item', 'SILICONE', 'iPhone 15', 'FIVE_G', 150, 2, 300
from phase2b_context;

select pg_temp.expect_sqlstate(
  'set constraints all immediate',
  '23514',
  'mismatched subtotal fails at deferred commit boundary'
);

delete from public.orders
where id = (select order_bad_total_id from phase2b_context);
set constraints all immediate;
set constraints all deferred;

insert into public.orders (
  id, order_number, customer_id, customer_name, customer_phone,
  governorate, city_area, street_name, building_number,
  subtotal_amount, shipping_amount, total_amount, currency, payment_method
)
select
  order_zero_items_id,
  'CC-P2B-Z-' || left(order_zero_items_id::text, 8),
  customer_a_id,
  'Zero Item Order', '01000000005',
  'Cairo', 'Maadi', 'Test Street', '5',
  0, 50, 50, 'EGP', 'CASH_ON_DELIVERY'
from phase2b_context;

select pg_temp.expect_sqlstate(
  'set constraints all immediate',
  '23514',
  'zero-item order fails at deferred commit boundary'
);

delete from public.orders
where id = (select order_zero_items_id from phase2b_context);
set constraints all immediate;
set constraints all deferred;

select pg_temp.expect_sqlstate(
  format(
    'insert into public.payments (order_id, method, status, expected_amount, currency) values (%L::uuid, %L, %L, 350, %L)',
    order_valid_id, 'INSTAPAY', 'PENDING_VERIFICATION', 'EGP'
  ),
  '23514',
  'InstaPay pending verification without proof is rejected'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'insert into public.payments (order_id, method, status, expected_amount, currency) values (%L::uuid, %L, %L, 1, %L)',
    order_valid_id, 'CASH_ON_DELIVERY', 'NOT_REQUIRED', 'EGP'
  ),
  '23514',
  'payment amount must match order total'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'insert into public.payments (order_id, method, status, expected_amount, currency) values (%L::uuid, %L, %L, 350, %L)',
    order_valid_id, 'CASH_ON_DELIVERY', 'NOT_REQUIRED', 'USD'
  ),
  '23514',
  'payment currency must match order currency'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'update public.payments set payment_proof_upload_id = %L::uuid where order_id = %L::uuid',
    proof_b_id, order_instapay_id
  ),
  '23514',
  'payment cannot attach another customer proof'
)
from phase2b_context;

select pg_temp.expect_sqlstate(
  format(
    'update public.payments set status = %L, verified_by = %L::uuid, verified_at = now() where order_id = %L::uuid',
    'VERIFIED', customer_b_id, order_instapay_id
  ),
  '23514',
  'non-admin payment verifier is rejected'
)
from phase2b_context;

update public.payments
set
  status = 'VERIFIED',
  verified_by = (select admin_id from phase2b_context),
  verified_at = now()
where order_id = (select order_instapay_id from phase2b_context);

select pg_temp.assert_true(
  exists (
    select 1
    from public.payments
    where order_id = (select order_instapay_id from phase2b_context)
      and status = 'VERIFIED'
      and verified_by = (select admin_id from phase2b_context)
      and verified_at is not null
  ),
  'trusted verification records ADMIN_TEST and timestamp'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select customer_a_id from phase2b_context),
    'role', 'authenticated'
  )::text,
  true
);
select set_config(
  'coolcase.order_a_id',
  (select order_a_id::text from phase2b_context),
  true
);
select set_config(
  'coolcase.order_b_id',
  (select order_b_id::text from phase2b_context),
  true
);
select set_config(
  'coolcase.order_instapay_id',
  (select order_instapay_id::text from phase2b_context),
  true
);

set local role authenticated;

select pg_temp.assert_true(
  (select count(*) = 1 from public.orders where id = current_setting('coolcase.order_a_id')::uuid),
  'CUSTOMER_A can read own order'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.orders where id = current_setting('coolcase.order_b_id')::uuid),
  'CUSTOMER_A cannot read CUSTOMER_B order'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.order_items where order_id = current_setting('coolcase.order_b_id')::uuid),
  'CUSTOMER_A cannot read CUSTOMER_B order items'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.payments where order_id = current_setting('coolcase.order_b_id')::uuid),
  'CUSTOMER_A cannot read CUSTOMER_B payment'
);

select pg_temp.expect_sqlstate(
  format('update public.orders set subtotal_amount = 1 where id = %L::uuid', current_setting('coolcase.order_a_id')),
  '42501', 'customer cannot alter order subtotal'
);
select pg_temp.expect_sqlstate(
  format('update public.orders set shipping_amount = 1 where id = %L::uuid', current_setting('coolcase.order_a_id')),
  '42501', 'customer cannot alter order shipping'
);
select pg_temp.expect_sqlstate(
  format('update public.orders set total_amount = 1 where id = %L::uuid', current_setting('coolcase.order_a_id')),
  '42501', 'customer cannot alter order total'
);
select pg_temp.expect_sqlstate(
  format('update public.orders set status = %L where id = %L::uuid', 'CONFIRMED', current_setting('coolcase.order_a_id')),
  '42501', 'customer cannot alter order status'
);
select pg_temp.expect_sqlstate(
  format('update public.orders set customer_id = gen_random_uuid() where id = %L::uuid', current_setting('coolcase.order_a_id')),
  '42501', 'customer cannot reassign order ownership'
);
select pg_temp.expect_sqlstate(
  format('update public.orders set order_number = %L where id = %L::uuid', 'CC-TAMPERED', current_setting('coolcase.order_a_id')),
  '42501', 'customer cannot alter order number'
);
select pg_temp.expect_sqlstate(
  format('update public.orders set shipped_at = now() where id = %L::uuid', current_setting('coolcase.order_a_id')),
  '42501', 'customer cannot alter lifecycle timestamps'
);
select pg_temp.expect_sqlstate(
  format('update public.order_items set quantity = 2 where order_id = %L::uuid', current_setting('coolcase.order_a_id')),
  '42501', 'customer cannot mutate historical order items'
);

select pg_temp.expect_sqlstate(
  format('update public.payments set status = %L where order_id = %L::uuid', 'VERIFIED', current_setting('coolcase.order_instapay_id')),
  '42501', 'customer cannot verify payment'
);
select pg_temp.expect_sqlstate(
  format('update public.payments set expected_amount = 1 where order_id = %L::uuid', current_setting('coolcase.order_instapay_id')),
  '42501', 'customer cannot alter expected payment amount'
);
select pg_temp.expect_sqlstate(
  format('update public.payments set method = %L where order_id = %L::uuid', 'CASH_ON_DELIVERY', current_setting('coolcase.order_instapay_id')),
  '42501', 'customer cannot alter payment method'
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.order_tracking_events
   where order_id = current_setting('coolcase.order_a_id')::uuid),
  'tracking view exposes CUSTOMER_A allowed event'
);
select pg_temp.assert_true(
  (select count(*) = 0
   from public.order_tracking_events
   where order_id = current_setting('coolcase.order_b_id')::uuid),
  'tracking view does not expose CUSTOMER_B event'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.admin_audit_logs),
  'customer cannot read audit logs'
);
select pg_temp.expect_sqlstate(
  'insert into public.admin_audit_logs (action) values (''CUSTOMER_WRITE'')',
  '42501', 'customer cannot insert audit logs'
);
select pg_temp.expect_sqlstate(
  'update public.admin_audit_logs set action = ''CUSTOMER_REWRITE''',
  '42501', 'customer cannot update audit logs'
);
select pg_temp.expect_sqlstate(
  'delete from public.admin_audit_logs',
  '42501', 'customer cannot delete audit logs'
);

reset role;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select admin_id from phase2b_context),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (select count(*) = 1 from public.admin_audit_logs where action = 'PHASE_2B_TEST'),
  'administrator can read audit logs'
);
select pg_temp.expect_sqlstate(
  'update public.admin_audit_logs set action = ''ADMIN_REWRITE''',
  '42501', 'authenticated administrator cannot rewrite audit history'
);
select pg_temp.expect_sqlstate(
  'delete from public.admin_audit_logs',
  '42501', 'authenticated administrator cannot delete audit history'
);

reset role;
rollback;
