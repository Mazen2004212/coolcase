create or replace function private.validate_order_item_upload()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  order_customer_id uuid;
  upload_owner_id uuid;
  linked_upload_type public.upload_type;
begin
  if new.custom_design_upload_id is null then
    return new;
  end if;

  select customer_id
  into order_customer_id
  from public.orders
  where id = new.order_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Order item must reference an existing order';
  end if;

  select user_id, upload_type
  into upload_owner_id, linked_upload_type
  from public.customer_uploads
  where id = new.custom_design_upload_id;

  if not found
     or linked_upload_type <> 'CUSTOM_CASE_DESIGN' then
    raise exception using
      errcode = '23514',
      message = 'Order item upload must be a custom case design';
  end if;

  if upload_owner_id is distinct from order_customer_id then
    raise exception using
      errcode = '23514',
      message = 'Custom design owner must match the order customer';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_order_item_upload()
from public, anon, authenticated, service_role;