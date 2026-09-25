-- A CUSTOMER profile requires customer contact fields. A consumed one-time
-- staff token is trusted provisioning authority, so create the no-phone ADMIN
-- profile expected by the existing schema. No administrative access exists
-- until the server action inserts active admin_staff.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  metadata jsonb:=coalesce(new.raw_user_meta_data,'{}'::jsonb);
  app_metadata jsonb:=coalesce(new.raw_app_meta_data,'{}'::jsonb);
  customer_name text:=btrim(coalesce(metadata->>'full_name',''));
  customer_phone text:=btrim(coalesce(metadata->>'phone',''));
  address_governorate text:=btrim(coalesce(metadata->>'governorate',''));
  address_city text:=btrim(coalesce(metadata->>'city',''));
  address_area text:=btrim(coalesce(metadata->>'area',''));
  address_street text:=btrim(coalesce(metadata->>'street',''));
  address_building text:=btrim(coalesce(metadata->>'building',''));
  address_floor text:=nullif(btrim(coalesce(metadata->>'floor','')),'');
  address_apartment text:=nullif(btrim(coalesce(metadata->>'apartment','')),'');
  address_landmark text:=nullif(btrim(coalesce(metadata->>'landmark','')),'');
  is_trusted_staff boolean:=coalesce(app_metadata->>'coolcase_account_type','')='staff';
  v_token_text text:=coalesce(metadata->>'coolcase_staff_bootstrap_token','');
  v_token uuid; is_valid_bootstrap boolean:=false;
begin
  if v_token_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_token:=v_token_text::uuid;
    delete from public.staff_signup_tokens where token=v_token and expires_at>now()
    returning true into is_valid_bootstrap;
  end if;
  if is_trusted_staff or coalesce(is_valid_bootstrap,false) then
    if length(customer_name) not between 2 and 120 then raise exception using errcode='23514',message='A valid employee full name is required'; end if;
    insert into public.profiles(id,full_name,email,phone,role)
    values(new.id,customer_name,new.email,null,'ADMIN'::public.user_role)
    on conflict(id) do nothing;
    return new;
  end if;
  if length(customer_name) not between 2 and 120
    or length(customer_phone) not between 6 and 32
    or address_governorate not in ('Cairo','Giza')
    or length(address_city) not between 1 and 100 or length(address_area) not between 1 and 100
    or length(address_street) not between 1 and 200 or length(address_building) not between 1 and 50
    or coalesce(length(address_floor),0)>50 or coalesce(length(address_apartment),0)>50
    or coalesce(length(address_landmark),0)>160
  then raise exception using errcode='23514',message='Valid customer profile and shipping address metadata are required'; end if;
  insert into public.profiles(id,full_name,email,phone,role)
  values(new.id,customer_name,new.email,customer_phone,'CUSTOMER'::public.user_role)
  on conflict(id) do nothing;
  insert into public.addresses(user_id,label,recipient_name,phone,governorate,city_area,street_name,
    building_number,floor,apartment,landmark,is_default)
  values(new.id,'Home',customer_name,customer_phone,address_governorate,address_city||' — '||address_area,
    address_street,address_building,address_floor,address_apartment,address_landmark,true);
  return new;
end;
$$;

revoke all on function private.handle_new_user()
  from public,anon,authenticated,service_role;
