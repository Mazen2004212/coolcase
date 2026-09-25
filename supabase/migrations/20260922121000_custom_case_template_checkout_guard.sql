-- Close the checkout/deactivation race: a named template must still be active
-- when its immutable order item is inserted. The row lock serializes a
-- concurrent admin deactivation with order creation.

create or replace function private.validate_named_custom_case_order_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_active boolean;
begin
  if new.customization_type is distinct from 'NAMED_TEMPLATE' then
    return new;
  end if;

  select template.is_active
  into v_active
  from public.custom_case_templates as template
  where template.id = new.custom_template_id
  for key share;

  if not found or not v_active then
    raise exception using
      errcode = '23514',
      message = 'Named custom case template is no longer active';
  end if;

  if new.customization_snapshot ->> 'templateId' is distinct from new.custom_template_id::text then
    raise exception using
      errcode = '23514',
      message = 'Named custom case snapshot template does not match its reference';
  end if;

  if length(btrim(coalesce(new.customization_snapshot ->> 'renderedText', ''))) = 0 then
    raise exception using
      errcode = '23514',
      message = 'Named custom case snapshot requires rendered text';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_named_custom_case_order_item()
  from public, anon, authenticated, service_role;

create trigger order_items_validate_named_custom_case
  before insert or update of customization_type, custom_template_id, customization_snapshot
  on public.order_items
  for each row execute function private.validate_named_custom_case_order_item();
