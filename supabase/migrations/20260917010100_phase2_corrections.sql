-- Phase 2 Schema Corrections
-- Fixes and additions required after reviewing the base schema constraints.

-- ─── 1. Add DOUBLE_LAYER to case_material enum ───────────────────────────────
-- Required to store double-layer orders in order_items.material.

alter type public.case_material add value if not exists 'DOUBLE_LAYER';

-- ─── 2. Add previous_status to order_status_history ─────────────────────────

alter table public.order_status_history
  add column if not exists previous_status public.order_status;

-- ─── 3. Relax payment verification constraint ─────────────────────────────────
-- The original constraint requires payment_proof_upload_id when VERIFIED.
-- For Coolcase, admin can verify InstaPay payments manually (via WhatsApp screenshot)
-- without the customer uploading a proof directly into the system.
-- We relax the constraint to allow verified_by + verified_at without proof_upload_id.

alter table public.payments
  drop constraint if exists payments_state_metadata_compatible;

alter table public.payments
  add constraint payments_state_metadata_compatible check (
    case
      when method = 'CASH_ON_DELIVERY' then
        status in ('NOT_REQUIRED', 'REFUNDED')
        and payment_proof_upload_id is null
        and verified_by is null
        and verified_at is null
        and rejection_reason is null
      when status = 'PENDING' then
        verified_by is null
        and verified_at is null
        and rejection_reason is null
      when status = 'PENDING_VERIFICATION' then
        verified_by is null
        and verified_at is null
        and rejection_reason is null
      when status = 'VERIFIED' then
        -- Relaxed: admin manual verification via WhatsApp doesn't require proof upload
        verified_by is not null
        and verified_at is not null
        and rejection_reason is null
      when status = 'REJECTED' then
        verified_by is null
        and verified_at is null
        and rejection_reason is not null
        and length(btrim(rejection_reason)) > 0
      when status = 'REFUNDED' then
        rejection_reason is null
      else false
    end
  );

-- Also relax the simpler verified_metadata constraint to match
alter table public.payments
  drop constraint if exists payments_verified_metadata_required;

alter table public.payments
  add constraint payments_verified_metadata_required check (
    status <> 'VERIFIED'
    or (verified_by is not null and verified_at is not null)
  );

-- ─── 4. Add service_role grants for order_status_history ────────────────────

grant select, insert on table public.order_status_history to service_role;
grant select, insert, update on table public.payments to service_role;
grant select, insert on table public.admin_audit_logs to service_role;
grant select, insert, update on table public.orders to service_role;
grant select, insert on table public.order_items to service_role;

-- ─── 5. Relax validate_history_actor_and_status trigger ─────────────────────
-- The original trigger validates that history.status == orders.status at insert time.
-- Since our create_order RPC inserts the order THEN the history in the same transaction,
-- the check should still pass (status is already PENDING_ADMIN_APPROVAL when history is inserted).
-- BUT: we also need to allow null changed_by for system/customer events.
-- Re-create the function to allow null changed_by.

create or replace function private.validate_history_actor_and_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Verify the history entry matches the current order status
  if not exists (
    select 1
    from public.orders
    where id = new.order_id
      and status = new.status
  ) then
    raise exception using
      errcode = '23514',
      message = 'Order history status must match the current order status';
  end if;

  -- Null changed_by is allowed for system-generated entries (initial placement, etc.)
  -- Only enforce admin role check when changed_by is provided
  if new.changed_by is not null and not exists (
    select 1
    from public.profiles
    where id = new.changed_by
      and role = 'ADMIN'::public.user_role
  ) then
    raise exception using
      errcode = '23514',
      message = 'Order history actor must be an administrator';
  end if;

  return new;
end;
$$;

-- ─── 6. Grant execute on generate_order_number and create_order to service_role
-- (These may already be in the first phase 2 migration, but safe to re-run)

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'generate_order_number') then
    execute 'grant execute on function public.generate_order_number() to service_role';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'create_order') then
    execute 'grant execute on function public.create_order(uuid,text,text,text,text,text,text,text,text,text,text,text,integer,integer,integer,public.payment_method,jsonb,uuid) to service_role';
  end if;
end;
$$;
