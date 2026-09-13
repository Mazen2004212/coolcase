do $$
begin
  if exists (
    select 1 from auth.users
    where email like 'coolcase.phase2b.%@gmail.com'
  ) or exists (
    select 1 from public.profiles
    where full_name like 'Phase 2B%'
  ) or exists (
    select 1 from public.categories
    where slug like 'phase-2b-%'
  ) or exists (
    select 1 from public.products
    where slug like 'phase-2b-%'
  ) or exists (
    select 1 from public.orders
    where order_number like 'CC-P2B-%'
  ) or exists (
    select 1 from storage.objects
    where name like '%phase2b%'
      or name like '%leading-%'
      or name like '%traversal-%'
  ) then
    raise exception 'Phase 2B cleanup assertion failed';
  end if;

  if (
    select count(*)
    from public.categories
    where slug in (
      'iphone-cases', 'samsung-cases', 'custom-cases', 'clear-cases',
      'tough-cases', 'magsafe', 'accessories'
    )
  ) <> 7 then
    raise exception 'Approved category seed assertion failed';
  end if;

  if (
    select count(*)
    from public.store_settings
    where (key = 'silicone_price' and value = '150'::jsonb)
      or (key = 'acrylic_price' and value = '200'::jsonb)
      or (key = 'shipping_fee' and value = '50'::jsonb)
      or (key = 'currency' and value = to_jsonb('EGP'::text))
  ) <> 4 then
    raise exception 'Approved settings seed assertion failed';
  end if;
end;
$$;

select 'PASS: cleanup complete and approved seed remains exact' as result;
