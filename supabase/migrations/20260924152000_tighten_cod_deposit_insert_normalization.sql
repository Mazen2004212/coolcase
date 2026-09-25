-- Only normalize the exact legacy create_order COD insert shape. Malformed
-- trusted writes must still fail validation instead of being silently fixed.
create or replace function private.apply_new_cod_deposit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total numeric(12,2);
begin
  if new.method = 'CASH_ON_DELIVERY' then
    select total_amount::numeric(12,2) into strict v_total
    from public.orders where id = new.order_id;

    if new.status = 'NOT_REQUIRED'
      and new.expected_amount = v_total
    then
      new.status := 'PENDING';
      new.expected_amount := round(v_total * 0.50, 2);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.apply_new_cod_deposit()
  from public, anon, authenticated, service_role;
