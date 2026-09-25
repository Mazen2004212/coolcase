-- New COD orders require a proof-backed 50% electronic deposit. Historical
-- COD rows remain NOT_REQUIRED and continue through the legacy lifecycle.

alter table public.payments
  alter column expected_amount type numeric(12,2)
  using expected_amount::numeric(12,2);

-- Runs before the existing validation trigger (trigger names sort
-- alphabetically). Existing create_order callers therefore cannot create a
-- new proofless COD payment, even if they still request NOT_REQUIRED/full.
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
    new.status := 'PENDING';
    new.expected_amount := round(v_total * 0.50, 2);
  end if;
  return new;
end;
$$;

revoke all on function private.apply_new_cod_deposit()
  from public, anon, authenticated, service_role;

drop trigger if exists payments_00_apply_new_cod_deposit on public.payments;
create trigger payments_00_apply_new_cod_deposit
  before insert on public.payments
  for each row execute function private.apply_new_cod_deposit();

alter table public.payments
  drop constraint if exists payments_state_metadata_compatible;

alter table public.payments
  add constraint payments_state_metadata_compatible check (
    case
      -- Historical COD payments. No new row can enter this state because the
      -- insert trigger above converts every new COD payment to a deposit.
      when method = 'CASH_ON_DELIVERY' and status = 'NOT_REQUIRED' then
        payment_proof_upload_id is null and verified_by is null
        and verified_at is null and rejection_reason is null
        and verification_source is null
      when method in ('INSTAPAY', 'CASH_ON_DELIVERY') and status = 'PENDING' then
        payment_proof_upload_id is null and verified_by is null
        and verified_at is null and rejection_reason is null
        and verification_source is null
      when method in ('INSTAPAY', 'CASH_ON_DELIVERY') and status = 'PENDING_VERIFICATION' then
        payment_proof_upload_id is not null and verified_by is null
        and verified_at is null and rejection_reason is null
        and verification_source is null
      when method in ('INSTAPAY', 'CASH_ON_DELIVERY') and status = 'VERIFIED' then
        verified_by is not null and verified_at is not null
        and rejection_reason is null
        and (
          (verification_source = 'PAYMENT_PROOF' and payment_proof_upload_id is not null)
          or (method = 'INSTAPAY' and verification_source = 'WHATSAPP_LEGACY')
        )
      when method in ('INSTAPAY', 'CASH_ON_DELIVERY') and status = 'REJECTED' then
        payment_proof_upload_id is not null and verified_by is null
        and verified_at is null and length(btrim(rejection_reason)) > 0
        and verification_source is null
      when method = 'CASH_ON_DELIVERY' and status = 'REFUNDED'
        and verification_source is null then
        payment_proof_upload_id is null and verified_by is null
        and verified_at is null and rejection_reason is null
      when method in ('INSTAPAY', 'CASH_ON_DELIVERY') and status = 'REFUNDED' then
        verified_by is not null and verified_at is not null
        and rejection_reason is null
        and verification_source in ('PAYMENT_PROOF', 'WHATSAPP_LEGACY')
      else false
    end
  );

create or replace function private.protect_and_validate_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_total numeric(12,2);
  v_currency text;
  v_method public.payment_method;
  v_proof_owner uuid;
  v_upload_type public.upload_type;
  v_expected numeric(12,2);
begin
  if tg_op = 'UPDATE' and row(new.order_id,new.method,new.expected_amount,new.currency,new.created_at)
    is distinct from row(old.order_id,old.method,old.expected_amount,old.currency,old.created_at)
  then
    raise exception using errcode='23514', message='Historical payment terms cannot be changed';
  end if;

  select customer_id,total_amount::numeric(12,2),currency,payment_method
  into v_customer_id,v_total,v_currency,v_method
  from public.orders where id=new.order_id;
  if not found then raise exception using errcode='23503', message='Payment must reference an existing order'; end if;

  v_expected := case
    when new.method='CASH_ON_DELIVERY' and new.status <> 'NOT_REQUIRED'
      then round(v_total * 0.50, 2)
    else v_total
  end;
  if new.expected_amount is distinct from v_expected
    or new.currency is distinct from v_currency
    or new.method is distinct from v_method
  then
    raise exception using errcode='23514', message='Payment terms must match the order snapshot';
  end if;

  if new.payment_proof_upload_id is not null then
    select user_id,upload_type into v_proof_owner,v_upload_type
    from public.customer_uploads where id=new.payment_proof_upload_id;
    if not found or v_upload_type <> 'PAYMENT_PROOF' or v_proof_owner is distinct from v_customer_id then
      raise exception using errcode='23514', message='Payment proof must be an owned payment-proof upload';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_and_validate_payment()
  from public, anon, authenticated, service_role;

-- Generic proof attachment for both InstaPay full payments and COD deposits.
create or replace function public.attach_payment_proof(p_order_id uuid,p_upload_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_customer uuid; v_order_status public.order_status;
  v_payment_id uuid; v_status public.payment_status; v_method public.payment_method;
  v_previous_id uuid; v_path text; v_mime text; v_size bigint; v_uploaded timestamptz;
  v_previous_path text;
begin
  if v_actor is null then raise exception using errcode='28000',message='Authentication required'; end if;
  select customer_id,status into v_customer,v_order_status from public.orders
    where id=p_order_id for share;
  if not found then raise exception using errcode='P0002',message='Order not found'; end if;
  if v_customer is distinct from v_actor then raise exception using errcode='42501',message='This order does not belong to the authenticated customer'; end if;
  if v_order_status not in ('PENDING_ADMIN_APPROVAL','PENDING_CONFIRMATION') then
    raise exception using errcode='23514',message='Payment proof cannot be changed after order processing begins';
  end if;
  select id,status,method,payment_proof_upload_id into v_payment_id,v_status,v_method,v_previous_id
    from public.payments where order_id=p_order_id for update;
  if not found then raise exception using errcode='P0002',message='Payment record not found'; end if;
  if v_method not in ('INSTAPAY','CASH_ON_DELIVERY') or v_status not in ('PENDING','REJECTED') then
    raise exception using errcode='23514',message='This payment does not accept proof uploads';
  end if;
  select storage_path,mime_type,file_size_bytes,created_at into v_path,v_mime,v_size,v_uploaded
    from public.customer_uploads where id=p_upload_id and user_id=v_actor
      and upload_type='PAYMENT_PROOF' for share;
  if not found then raise exception using errcode='42501',message='Valid owned payment-proof upload not found'; end if;
  if v_path not like v_actor::text || '/%' or v_mime not in ('image/jpeg','image/png','image/webp')
    or v_size not between 1 and 5242880 then
    raise exception using errcode='23514',message='Payment proof metadata is invalid';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='payment-proofs' and name=v_path) then
    raise exception using errcode='23514',message='Payment proof storage object not found';
  end if;
  if exists(select 1 from public.payments where payment_proof_upload_id=p_upload_id and id<>v_payment_id) then
    raise exception using errcode='23505',message='This payment proof is already attached to another payment';
  end if;
  if v_previous_id is not null then select storage_path into v_previous_path from public.customer_uploads where id=v_previous_id; end if;
  update public.payments set payment_proof_upload_id=p_upload_id,status='PENDING_VERIFICATION',
    verified_by=null,verified_at=null,rejection_reason=null,verification_source=null where id=v_payment_id;
  return jsonb_build_object('payment_id',v_payment_id,'order_id',p_order_id,'status','PENDING_VERIFICATION',
    'upload_id',p_upload_id,'storage_path',v_path,'uploaded_at',v_uploaded,
    'previous_upload_id',v_previous_id,'previous_storage_path',v_previous_path);
end;
$$;

revoke all on function public.attach_payment_proof(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.attach_payment_proof(uuid,uuid) to authenticated;

create or replace function public.review_payment_proof(
  p_order_id uuid,p_expected_proof_upload_id uuid,p_decision public.payment_status,
  p_rejection_reason text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid()); v_role text; v_permissions text[];
  v_order_status public.order_status; v_payment_id uuid; v_status public.payment_status;
  v_method public.payment_method; v_proof uuid; v_reason text; v_now timestamptz:=now();
begin
  if v_actor is null then raise exception using errcode='28000',message='Authentication required'; end if;
  select role,permissions into v_role,v_permissions from public.admin_staff
    where user_id=v_actor and is_active=true for share;
  if not found or (v_role<>'OWNER' and not ('orders.manage'=any(coalesce(v_permissions,array[]::text[])))) then
    raise exception using errcode='42501',message='Active staff with orders.manage is required';
  end if;
  if p_decision not in ('VERIFIED','REJECTED') then raise exception using errcode='22023',message='Payment decision must be VERIFIED or REJECTED'; end if;
  select status into v_order_status from public.orders where id=p_order_id for share;
  if not found then raise exception using errcode='P0002',message='Order not found'; end if;
  if v_order_status not in ('PENDING_ADMIN_APPROVAL','PENDING_CONFIRMATION') then
    raise exception using errcode='23514',message='Payment can only be reviewed while the order awaits approval';
  end if;
  select id,status,method,payment_proof_upload_id into v_payment_id,v_status,v_method,v_proof
    from public.payments where order_id=p_order_id for update;
  if not found or v_method not in ('INSTAPAY','CASH_ON_DELIVERY') or v_status<>'PENDING_VERIFICATION' or v_proof is null then
    raise exception using errcode='23514',message='A submitted payment proof is required before review';
  end if;
  if v_proof is distinct from p_expected_proof_upload_id then
    raise exception using errcode='23514',message='Payment proof changed. Refresh the order and review the current proof.';
  end if;
  if p_decision='REJECTED' then
    v_reason:=nullif(btrim(coalesce(p_rejection_reason,'')),'');
    if v_reason is null then raise exception using errcode='22023',message='A rejection reason is required'; end if;
    update public.payments set status='REJECTED',verified_by=null,verified_at=null,rejection_reason=v_reason,verification_source=null where id=v_payment_id;
  else
    update public.payments set status='VERIFIED',verified_by=v_actor,verified_at=v_now,rejection_reason=null,verification_source='PAYMENT_PROOF' where id=v_payment_id;
  end if;
  insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata)
  values(v_actor,case when p_decision='VERIFIED' then 'PAYMENT_VERIFIED' else 'PAYMENT_REJECTED' end,
    'payments',v_payment_id,jsonb_build_object('order_id',p_order_id,'proof_upload_id',v_proof,'payment_method',v_method,'reason',v_reason));
  return jsonb_build_object('payment_id',v_payment_id,'order_id',p_order_id,'status',p_decision,
    'proof_upload_id',v_proof,'verification_source',case when p_decision='VERIFIED' then 'PAYMENT_PROOF' else null end);
end;
$$;

revoke all on function public.review_payment_proof(uuid,uuid,public.payment_status,text)
  from public,anon,authenticated,service_role;
grant execute on function public.review_payment_proof(uuid,uuid,public.payment_status,text) to authenticated;

-- Defense in depth: every path that changes an order to CONFIRMED is checked,
-- including direct RPC calls. Historical COD is identified authoritatively by
-- its immutable NOT_REQUIRED payment row.
create or replace function private.enforce_payment_before_confirmation()
returns trigger language plpgsql set search_path=''
as $$
declare v_status public.payment_status; v_method public.payment_method;
begin
  if new.status='CONFIRMED' and old.status is distinct from new.status then
    select status,method into v_status,v_method from public.payments where order_id=new.id for share;
    if not found then raise exception using errcode='23514',message='Payment record is required before order confirmation'; end if;
    if v_method='INSTAPAY' and v_status<>'VERIFIED' then
      raise exception using errcode='23514',message='InstaPay payment must be verified before this order can be confirmed';
    end if;
    if v_method='CASH_ON_DELIVERY' and v_status not in ('VERIFIED','NOT_REQUIRED') then
      raise exception using errcode='23514',message='COD deposit must be verified before this order can be confirmed';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_payment_before_confirmation()
  from public,anon,authenticated,service_role;
drop trigger if exists orders_enforce_payment_before_confirmation on public.orders;
create trigger orders_enforce_payment_before_confirmation
  before update of status on public.orders for each row
  execute function private.enforce_payment_before_confirmation();
