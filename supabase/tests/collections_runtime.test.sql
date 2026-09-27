-- Transactional runtime coverage for real collections and collection RBAC.
begin;

create or replace function pg_temp.assert_true(result boolean, test_name text)
returns text language plpgsql as $$
begin
  if result is not true then
    raise exception using errcode = 'P0001', message = 'Collections assertion failed: ' || test_name;
  end if;
  return 'PASS: ' || test_name;
end;
$$;

create or replace function pg_temp.expect_sqlstate(statement text, expected_sqlstate text, test_name text)
returns text language plpgsql as $$
begin
  execute statement;
  raise exception using errcode = 'P0001', message = 'Collections assertion unexpectedly succeeded: ' || test_name;
exception
  when others then
    if sqlstate = expected_sqlstate then return 'PASS: ' || test_name; end if;
    raise exception using errcode = 'P0001', message = format(
      'Collections assertion failed: %s (expected %s, received %s: %s)',
      test_name, expected_sqlstate, sqlstate, sqlerrm
    );
end;
$$;

create temporary table collections_test_context (
  owner_id uuid not null,
  manager_id uuid not null,
  unauthorized_id uuid not null,
  product_a_id uuid not null,
  product_b_id uuid not null,
  custom_id uuid,
  second_custom_id uuid,
  new_arrivals_id uuid
) on commit drop;

insert into collections_test_context (owner_id, manager_id, unauthorized_id, product_a_id, product_b_id)
select
  (select id from public.profiles where full_name = 'Phase 2B Admin Test' order by created_at desc limit 1),
  (select id from public.profiles where full_name = 'Phase 2B Customer B' order by created_at desc limit 1),
  (select id from public.profiles where full_name = 'Phase 2B Customer A' order by created_at desc limit 1),
  (select id from public.products where name like 'Phase 2B Active %' order by created_at desc limit 1),
  (select id from public.products where name like 'Phase 2B Inactive %' order by created_at desc limit 1);

grant select, update on table collections_test_context to authenticated;
grant select on table collections_test_context to anon;

select set_config('request.jwt.claims', json_build_object(
  'sub', (select owner_id from collections_test_context), 'role', 'authenticated'
)::text, true);
set local role authenticated;

update collections_test_context
set custom_id = public.save_collection(
  null, 'Men Cases', 'men-cases-runtime', 'Arbitrary custom collection', 'CUSTOM', null,
  true, true, 3, array[product_a_id, product_b_id]
);

select pg_temp.assert_true(
  exists (select 1 from public.collections where id = (select custom_id from collections_test_context) and name = 'Men Cases'),
  'active OWNER can create an arbitrary custom collection'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.collection_products where collection_id = (select custom_id from collections_test_context)),
  'multiple products are added without duplicating product records'
);
select pg_temp.assert_true(
  (select array_agg(product_id order by sort_order) = array[product_a_id, product_b_id] from public.collection_products, collections_test_context where collection_id = custom_id group by product_a_id, product_b_id),
  'collection product order is persisted'
);

select pg_temp.expect_sqlstate(
  format(
    'select public.save_collection(null,%L,%L,%L,%L,null,true,false,0,array[]::uuid[])',
    'Duplicate URL', 'men-cases-runtime', '', 'CUSTOM'
  ), '23505', 'collection slugs remain unique'
);

update collections_test_context
set second_custom_id = public.save_collection(
  null, 'Summer Collection', 'summer-runtime', null, 'CUSTOM', null,
  true, false, 4, array[product_a_id]
);

select pg_temp.assert_true(
  (select count(*) = 2 from public.collection_products where product_id = (select product_a_id from collections_test_context)),
  'one product can belong to multiple collections'
);

update collections_test_context
set new_arrivals_id = public.save_collection(
  null, 'New Arrivals', 'new-arrivals-runtime', 'Explicitly curated new cases', 'NEW_ARRIVALS', null,
  true, true, 0, array[product_a_id]
);

select pg_temp.expect_sqlstate(
  format(
    'select public.save_collection(null,%L,%L,null,%L,null,true,false,0,array[]::uuid[])',
    'Another New Arrivals', 'another-new-arrivals-runtime', 'NEW_ARRIVALS'
  ), '23505', 'only one semantic NEW_ARRIVALS collection can exist'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.collection_products cp
    join public.collections c on c.id = cp.collection_id
    where cp.product_id = (select product_a_id from collections_test_context)
      and c.collection_type = 'NEW_ARRIVALS' and c.is_active
  ), 'active New Arrivals membership marks its product authoritatively'
);

select public.save_collection(
  new_arrivals_id, 'New Arrivals', 'new-arrivals-runtime', 'Explicitly curated new cases', 'NEW_ARRIVALS', null,
  false, true, 0, array[product_a_id]
) from collections_test_context;

select pg_temp.assert_true(
  not exists (
    select 1 from public.collection_products cp
    join public.collections c on c.id = cp.collection_id
    where cp.product_id = (select product_a_id from collections_test_context)
      and c.collection_type = 'NEW_ARRIVALS' and c.is_active
  ), 'inactive New Arrivals does not mark products'
);

select public.save_collection(
  new_arrivals_id, 'New Arrivals', 'new-arrivals-runtime', 'Explicitly curated new cases', 'NEW_ARRIVALS', null,
  true, true, 0, array[]::uuid[]
) from collections_test_context;

select pg_temp.assert_true(
  not exists (
    select 1 from public.collection_products cp
    join public.collections c on c.id = cp.collection_id
    where cp.product_id = (select product_a_id from collections_test_context)
      and c.collection_type = 'NEW_ARRIVALS' and c.is_active
  ), 'removing a product from New Arrivals removes its marker'
);

select public.save_collection(
  new_arrivals_id, 'New Arrivals', 'new-arrivals-runtime', 'Explicitly curated new cases', 'NEW_ARRIVALS', null,
  false, true, 0, array[]::uuid[]
) from collections_test_context;

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub', (select unauthorized_id from collections_test_context), 'role', 'authenticated'
)::text, true);
set local role authenticated;
select pg_temp.expect_sqlstate(
  'select public.save_collection(null,''Forbidden'',''forbidden-collection'',null,''CUSTOM'',null,true,false,0,array[]::uuid[])',
  '42501', 'unauthorized staff cannot create collections'
);
reset role;

update public.profiles set role = 'ADMIN' where id = (select manager_id from collections_test_context);
insert into public.admin_staff (user_id, role, permissions, is_active)
select manager_id, 'MANAGER', array['products.view','products.manage'], true
from collections_test_context;

select set_config('request.jwt.claims', json_build_object(
  'sub', (select manager_id from collections_test_context), 'role', 'authenticated'
)::text, true);
set local role authenticated;
select public.save_collection(
  custom_id, 'Men Cases Updated', 'men-cases-runtime', 'Updated by manager', 'CUSTOM', null,
  true, false, 3, array[product_a_id]
) from collections_test_context;
select pg_temp.assert_true(
  (select count(*) = 1 from public.collection_products where collection_id = (select custom_id from collections_test_context)),
  'products.manage staff can update membership and remove products'
);
reset role;

update public.admin_staff set is_active = false where user_id = (select manager_id from collections_test_context);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select manager_id from collections_test_context), 'role', 'authenticated'
)::text, true);
set local role authenticated;
select pg_temp.expect_sqlstate(
  'select public.save_collection(null,''Inactive Staff'',''inactive-staff-collection'',null,''CUSTOM'',null,true,false,0,array[]::uuid[])',
  '42501', 'inactive staff cannot create collections'
);
reset role;

-- Public RLS sees active rows only and cannot write tables directly.
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
select pg_temp.assert_true(
  (select count(*) = 0 from public.collections where slug = 'new-arrivals-runtime'),
  'inactive collections are hidden from public reads'
);
select pg_temp.expect_sqlstate(
  'insert into public.collections(name,slug) values (''Direct Write'',''direct-write'')',
  '42501', 'public direct collection writes are denied'
);
reset role;

-- Deleting a collection cascades memberships but leaves products intact.
select set_config('request.jwt.claims', json_build_object(
  'sub', (select owner_id from collections_test_context), 'role', 'authenticated'
)::text, true);
set local role authenticated;
select public.delete_collection(second_custom_id) from collections_test_context;
select pg_temp.assert_true(
  exists (select 1 from public.products where id = (select product_a_id from collections_test_context)),
  'deleting a collection never deletes products'
);
select pg_temp.assert_true(
  not exists (select 1 from public.collection_products where collection_id = (select second_custom_id from collections_test_context)),
  'deleting a collection cascades only its memberships'
);

rollback;
