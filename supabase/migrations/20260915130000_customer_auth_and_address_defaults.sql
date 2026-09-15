-- Customer signup provisioning and atomic default-address selection.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  customer_name text := btrim(coalesce(metadata ->> 'full_name', ''));
  customer_phone text := btrim(coalesce(metadata ->> 'phone', ''));
  address_governorate text := btrim(coalesce(metadata ->> 'governorate', ''));
  address_city text := btrim(coalesce(metadata ->> 'city', ''));
  address_area text := btrim(coalesce(metadata ->> 'area', ''));
  address_street text := btrim(coalesce(metadata ->> 'street', ''));
  address_building text := btrim(coalesce(metadata ->> 'building', ''));
  address_floor text := nullif(btrim(coalesce(metadata ->> 'floor', '')), '');
  address_apartment text := nullif(btrim(coalesce(metadata ->> 'apartment', '')), '');
  address_landmark text := nullif(btrim(coalesce(metadata ->> 'landmark', '')), '');
begin
  if length(customer_name) not between 2 and 120
    or length(customer_phone) not between 6 and 32
    or address_governorate not in ('Cairo', 'Giza')
    or length(address_city) not between 1 and 100
    or length(address_area) not between 1 and 100
    or length(address_street) not between 1 and 200
    or length(address_building) not between 1 and 50
    or coalesce(length(address_floor), 0) > 50
    or coalesce(length(address_apartment), 0) > 50
    or coalesce(length(address_landmark), 0) > 160 then
    raise exception using
      errcode = '23514',
      message = 'Valid customer profile and shipping address metadata are required';
  end if;

  insert into public.profiles (id, full_name, email, phone, role)
  values (new.id, customer_name, new.email, customer_phone, 'CUSTOMER'::public.user_role)
  on conflict (id) do nothing;

  insert into public.addresses (
    user_id, label, recipient_name, phone, governorate, city_area,
    street_name, building_number, floor, apartment, landmark, is_default
  ) values (
    new.id, 'Home', customer_name, customer_phone, address_governorate,
    address_city || ' — ' || address_area, address_street, address_building,
    address_floor, address_apartment, address_landmark, true
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;

create or replace function public.set_default_address(target_address_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not exists (
    select 1 from public.addresses
    where id = target_address_id and user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Address not available';
  end if;

  update public.addresses
  set is_default = false
  where user_id = current_user_id and is_default and id <> target_address_id;

  update public.addresses
  set is_default = true
  where id = target_address_id and user_id = current_user_id;
end;
$$;

revoke all on function public.set_default_address(uuid) from public, anon, authenticated, service_role;
grant execute on function public.set_default_address(uuid) to authenticated, service_role;
