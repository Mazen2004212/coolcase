-- Provision staff Auth users without requiring customer shipping metadata.
--
-- Public signup behavior remains unchanged. Only users created through the
-- trusted Admin Auth API with raw_app_meta_data.coolcase_account_type = 'staff'
-- take the staff provisioning branch.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  app_metadata jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);

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

  is_staff_account boolean :=
    coalesce(app_metadata ->> 'coolcase_account_type', '') = 'staff';
begin
  if is_staff_account then
    if length(customer_name) not between 2 and 120 then
      raise exception using
        errcode = '23514',
        message = 'A valid employee full name is required';
    end if;

    insert into public.profiles (
      id,
      full_name,
      email,
      phone,
      role
    )
    values (
      new.id,
      customer_name,
      new.email,
      null,
      'ADMIN'::public.user_role
    )
    on conflict (id) do nothing;

    return new;
  end if;

  if length(customer_name) not between 2 and 120
    or length(customer_phone) not between 6 and 32
    or address_governorate not in ('Cairo', 'Giza')
    or length(address_city) not between 1 and 100
    or length(address_area) not between 1 and 100
    or length(address_street) not between 1 and 200
    or length(address_building) not between 1 and 50
    or coalesce(length(address_floor), 0) > 50
    or coalesce(length(address_apartment), 0) > 50
    or coalesce(length(address_landmark), 0) > 160
  then
    raise exception using
      errcode = '23514',
      message = 'Valid customer profile and shipping address metadata are required';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role
  )
  values (
    new.id,
    customer_name,
    new.email,
    customer_phone,
    'CUSTOMER'::public.user_role
  )
  on conflict (id) do nothing;

  insert into public.addresses (
    user_id,
    label,
    recipient_name,
    phone,
    governorate,
    city_area,
    street_name,
    building_number,
    floor,
    apartment,
    landmark,
    is_default
  )
  values (
    new.id,
    'Home',
    customer_name,
    customer_phone,
    address_governorate,
    address_city || ' — ' || address_area,
    address_street,
    address_building,
    address_floor,
    address_apartment,
    address_landmark,
    true
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user()
  from public, anon, authenticated, service_role;
