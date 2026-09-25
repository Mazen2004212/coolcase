-- Complete the private InstaPay proof workflow using the existing
-- customer_uploads -> payments.payment_proof_upload_id data model.

-- Record how an InstaPay verification was established. The nullable text
-- column keeps legacy compatibility without introducing another enum.
alter table public.payments
  add column if not exists verification_source text;

alter table public.payments
  drop constraint if exists payments_verification_source_valid;

alter table public.payments
  add constraint payments_verification_source_valid check (
    verification_source is null
    or verification_source in ('PAYMENT_PROOF', 'WHATSAPP_LEGACY')
  );

-- Preserve legitimate historical verification. Proof-backed records receive
-- PAYMENT_PROOF provenance; proofless manual records retain VERIFIED/REFUNDED
-- state and are explicitly marked as the retired WhatsApp workflow.
update public.payments
set verification_source = case
  when payment_proof_upload_id is null then 'WHATSAPP_LEGACY'
  else 'PAYMENT_PROOF'
end
where method = 'INSTAPAY'
  and status in ('VERIFIED', 'REFUNDED')
  and verified_by is not null
  and verified_at is not null
  and verification_source is null;

-- Abort before any DDL if existing payment rows cannot satisfy the strict
-- lifecycle. Data remediation must be explicit and separately approved.
do $preflight$
declare
  v_invalid_payment_count bigint;
  v_duplicate_proof_count bigint;
begin
  select count(*)
  into v_invalid_payment_count
  from public.payments as payment
  where not (
    case
      when payment.method = 'CASH_ON_DELIVERY' then
        payment.status in ('NOT_REQUIRED', 'REFUNDED')
        and payment.payment_proof_upload_id is null
        and payment.verified_by is null
        and payment.verified_at is null
        and payment.rejection_reason is null
        and payment.verification_source is null

      when payment.method = 'INSTAPAY'
        and payment.status = 'PENDING' then
        payment.payment_proof_upload_id is null
        and payment.verified_by is null
        and payment.verified_at is null
        and payment.rejection_reason is null
        and payment.verification_source is null

      when payment.method = 'INSTAPAY'
        and payment.status = 'PENDING_VERIFICATION' then
        payment.payment_proof_upload_id is not null
        and payment.verified_by is null
        and payment.verified_at is null
        and payment.rejection_reason is null
        and payment.verification_source is null

      when payment.method = 'INSTAPAY'
        and payment.status = 'VERIFIED' then
        payment.verified_by is not null
        and payment.verified_at is not null
        and payment.rejection_reason is null
        and (
          (
            payment.verification_source = 'PAYMENT_PROOF'
            and payment.payment_proof_upload_id is not null
          )
          or payment.verification_source = 'WHATSAPP_LEGACY'
        )

      when payment.method = 'INSTAPAY'
        and payment.status = 'REJECTED' then
        payment.payment_proof_upload_id is not null
        and payment.verified_by is null
        and payment.verified_at is null
        and payment.rejection_reason is not null
        and length(btrim(payment.rejection_reason)) > 0
        and payment.verification_source is null

      when payment.method = 'INSTAPAY'
        and payment.status = 'REFUNDED' then
        payment.verified_by is not null
        and payment.verified_at is not null
        and payment.rejection_reason is null
        and (
          (
            payment.verification_source = 'PAYMENT_PROOF'
            and payment.payment_proof_upload_id is not null
          )
          or payment.verification_source = 'WHATSAPP_LEGACY'
        )

      else false
    end
  );

  if v_invalid_payment_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'Cannot enable strict payment proof lifecycle: %s existing payment row(s) require remediation',
        v_invalid_payment_count
      );
  end if;

  select count(*)
  into v_duplicate_proof_count
  from (
    select payment.payment_proof_upload_id
    from public.payments as payment
    where payment.payment_proof_upload_id is not null
    group by payment.payment_proof_upload_id
    having count(*) > 1
  ) as duplicate_proofs;

  if v_duplicate_proof_count > 0 then
    raise exception using
      errcode = '23505',
      message = format(
        'Cannot make payment proofs unique: %s proof upload(s) are linked to multiple payments',
        v_duplicate_proof_count
      );
  end if;
end;
$preflight$;

-- Keep payment proofs private and constrain the upload envelope to 5 MiB and
-- the three approved raster formats.
update storage.buckets
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
where id = 'payment-proofs';

-- Payment-proof writes now go exclusively through the validated server action.
-- Payment-proof reads for staff also go through the permission-checked server
-- action that issues a short-lived signed URL. Preserve the existing direct
-- authenticated policies only for custom case designs.
drop policy if exists private_uploads_admin_read
  on storage.objects;

create policy private_custom_designs_admin_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'custom-designs'
    and private.is_admin()
  );

drop policy if exists private_uploads_owner_insert
  on storage.objects;

create policy private_custom_designs_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'custom-designs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists customer_uploads_owner_insert
  on public.customer_uploads;

create policy customer_uploads_owner_insert
  on public.customer_uploads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and upload_type = 'CUSTOM_CASE_DESIGN'
  );

-- A single receipt cannot be reused across multiple payment records.
drop index if exists public.payments_payment_proof_upload_id_idx;

create unique index payments_payment_proof_upload_unique_idx
  on public.payments (payment_proof_upload_id)
  where payment_proof_upload_id is not null;

-- Restore strict proof and state compatibility now that the in-app proof
-- workflow replaces proofless WhatsApp verification.
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
        and verification_source is null

      when method = 'INSTAPAY'
        and status = 'PENDING' then
        payment_proof_upload_id is null
        and verified_by is null
        and verified_at is null
        and rejection_reason is null
        and verification_source is null

      when method = 'INSTAPAY'
        and status = 'PENDING_VERIFICATION' then
        payment_proof_upload_id is not null
        and verified_by is null
        and verified_at is null
        and rejection_reason is null
        and verification_source is null

      when method = 'INSTAPAY'
        and status = 'VERIFIED' then
        verified_by is not null
        and verified_at is not null
        and rejection_reason is null
        and (
          (
            verification_source = 'PAYMENT_PROOF'
            and payment_proof_upload_id is not null
          )
          or verification_source = 'WHATSAPP_LEGACY'
        )

      when method = 'INSTAPAY'
        and status = 'REJECTED' then
        payment_proof_upload_id is not null
        and verified_by is null
        and verified_at is null
        and rejection_reason is not null
        and length(btrim(rejection_reason)) > 0
        and verification_source is null

      when method = 'INSTAPAY'
        and status = 'REFUNDED' then
        verified_by is not null
        and verified_at is not null
        and rejection_reason is null
        and (
          (
            verification_source = 'PAYMENT_PROOF'
            and payment_proof_upload_id is not null
          )
          or verification_source = 'WHATSAPP_LEGACY'
        )

      else false
    end
  );

-- Defense in depth for any trusted-server write that attributes a verifier.
create or replace function private.validate_payment_reviewer_staff()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.verified_by is null then
    return new;
  end if;

  -- Avoid reading OLD for INSERT events. For UPDATE, an unchanged reviewer was
  -- already validated when it was first attributed.
  if tg_op = 'UPDATE'
    and new.verified_by is not distinct from old.verified_by
  then
    return new;
  end if;

  if not exists (
      select 1
      from public.admin_staff as staff
      where staff.user_id = new.verified_by
        and staff.is_active = true
        and (
          staff.role = 'OWNER'
          or 'orders.manage' = any(
            coalesce(staff.permissions, array[]::text[])
          )
        )
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'Payment verifier must be active staff with orders.manage permission';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_payment_reviewer_staff()
  from public, anon, authenticated, service_role;

drop trigger if exists payments_validate_reviewer_staff
  on public.payments;

create trigger payments_validate_reviewer_staff
  before insert or update of verified_by
  on public.payments
  for each row
  execute function private.validate_payment_reviewer_staff();

-- Attach the initial proof, or replace a proof only after an explicit rejection.
create or replace function public.attach_instapay_proof(
  p_order_id uuid,
  p_upload_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid;

  v_customer_id uuid;
  v_order_status public.order_status;

  v_payment_id uuid;
  v_payment_method public.payment_method;
  v_payment_status public.payment_status;
  v_previous_upload_id uuid;

  v_new_storage_path text;
  v_new_mime_type text;
  v_new_file_size_bytes bigint;
  v_new_uploaded_at timestamptz;
  v_previous_storage_path text;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  -- Keep lock ordering consistent with transition_order_status:
  -- order first, then payment.
  select target.customer_id, target.status
  into v_customer_id, v_order_status
  from public.orders as target
  where target.id = p_order_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Order not found';
  end if;

  if v_customer_id is distinct from v_actor_id then
    raise exception using
      errcode = '42501',
      message = 'This order does not belong to the authenticated customer';
  end if;

  if v_order_status not in (
    'PENDING_ADMIN_APPROVAL',
    'PENDING_CONFIRMATION'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Payment proof cannot be changed after order processing begins';
  end if;

  select
    payment.id,
    payment.method,
    payment.status,
    payment.payment_proof_upload_id
  into
    v_payment_id,
    v_payment_method,
    v_payment_status,
    v_previous_upload_id
  from public.payments as payment
  where payment.order_id = p_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Payment record not found';
  end if;

  if v_payment_method <> 'INSTAPAY' then
    raise exception using
      errcode = '23514',
      message = 'Payment proof is only valid for InstaPay orders';
  end if;

  if v_payment_status not in ('PENDING', 'REJECTED') then
    raise exception using
      errcode = '23514',
      message = case
        when v_payment_status = 'PENDING_VERIFICATION' then
          'Payment proof is already awaiting admin review'
        when v_payment_status = 'VERIFIED' then
          'Verified payments do not accept replacement proofs'
        else
          'This payment does not accept proof uploads'
      end;
  end if;

  select
    upload.storage_path,
    upload.mime_type,
    upload.file_size_bytes,
    upload.created_at
  into
    v_new_storage_path,
    v_new_mime_type,
    v_new_file_size_bytes,
    v_new_uploaded_at
  from public.customer_uploads as upload
  where upload.id = p_upload_id
    and upload.user_id = v_actor_id
    and upload.upload_type = 'PAYMENT_PROOF'
  for share;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Valid owned payment-proof upload not found';
  end if;

  if v_new_storage_path not like v_actor_id::text || '/%' then
    raise exception using
      errcode = '23514',
      message = 'Payment proof path is not scoped to the customer';
  end if;

  if v_new_mime_type not in (
    'image/jpeg',
    'image/png',
    'image/webp'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Payment proof has an unsupported MIME type';
  end if;

  if v_new_file_size_bytes is null
    or v_new_file_size_bytes < 1
    or v_new_file_size_bytes > 5242880
  then
    raise exception using
      errcode = '23514',
      message = 'Payment proof must be between 1 byte and 5 MiB';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'payment-proofs'
      and object.name = v_new_storage_path
  ) then
    raise exception using
      errcode = '23514',
      message = 'Payment proof storage object not found';
  end if;

  if v_previous_upload_id = p_upload_id then
    raise exception using
      errcode = '23514',
      message = 'This proof is already attached to the payment';
  end if;

  if exists (
    select 1
    from public.payments as other_payment
    where other_payment.payment_proof_upload_id = p_upload_id
      and other_payment.id <> v_payment_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This payment proof is already attached to another payment';
  end if;

  if v_previous_upload_id is not null then
    select upload.storage_path
    into v_previous_storage_path
    from public.customer_uploads as upload
    where upload.id = v_previous_upload_id;
  end if;

  update public.payments
  set
    payment_proof_upload_id = p_upload_id,
    status = 'PENDING_VERIFICATION',
    verified_by = null,
    verified_at = null,
    rejection_reason = null,
    verification_source = null
  where id = v_payment_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'order_id', p_order_id,
    'status', 'PENDING_VERIFICATION',
    'upload_id', p_upload_id,
    'storage_path', v_new_storage_path,
    'uploaded_at', v_new_uploaded_at,
    'previous_upload_id', v_previous_upload_id,
    'previous_storage_path', v_previous_storage_path
  );
end;
$function$;

revoke all on function public.attach_instapay_proof(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.attach_instapay_proof(uuid, uuid)
  to authenticated;

-- Review exactly the proof upload rendered to the staff member. The expected
-- proof ID check remains mandatory even though replacement is blocked while
-- the payment is pending verification.
create or replace function public.review_instapay_payment(
  p_order_id uuid,
  p_expected_proof_upload_id uuid,
  p_decision public.payment_status,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid;
  v_staff_role text;
  v_staff_permissions text[];

  v_order_status public.order_status;

  v_payment_id uuid;
  v_payment_status public.payment_status;
  v_payment_method public.payment_method;
  v_proof_upload_id uuid;

  v_now timestamptz := now();
  v_reason text;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  select staff.role, staff.permissions
  into v_staff_role, v_staff_permissions
  from public.admin_staff as staff
  where staff.user_id = v_actor_id
    and staff.is_active = true
  for share;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Active staff access is required';
  end if;

  if v_staff_role <> 'OWNER'
    and not (
      'orders.manage' = any(
        coalesce(v_staff_permissions, array[]::text[])
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Missing orders.manage permission';
  end if;

  if p_decision is null
    or p_decision not in ('VERIFIED', 'REJECTED')
  then
    raise exception using
      errcode = '22023',
      message = 'Payment decision must be VERIFIED or REJECTED';
  end if;

  -- Maintain staff -> order -> payment lock ordering.
  select target.status
  into v_order_status
  from public.orders as target
  where target.id = p_order_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Order not found';
  end if;

  if v_order_status not in (
    'PENDING_ADMIN_APPROVAL',
    'PENDING_CONFIRMATION'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Payment can only be reviewed while the order awaits approval';
  end if;

  select
    payment.id,
    payment.status,
    payment.method,
    payment.payment_proof_upload_id
  into
    v_payment_id,
    v_payment_status,
    v_payment_method,
    v_proof_upload_id
  from public.payments as payment
  where payment.order_id = p_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Payment record not found';
  end if;

  if v_payment_method <> 'INSTAPAY' then
    raise exception using
      errcode = '23514',
      message = 'Only InstaPay payments require proof review';
  end if;

  if v_payment_status <> 'PENDING_VERIFICATION'
    or v_proof_upload_id is null
  then
    raise exception using
      errcode = '23514',
      message = 'A submitted payment proof is required before review';
  end if;

  if v_proof_upload_id is distinct from p_expected_proof_upload_id then
    raise exception using
      errcode = '23514',
      message =
        'Payment proof changed. Refresh the order and review the current proof.';
  end if;

  if p_decision = 'REJECTED' then
    v_reason := nullif(btrim(coalesce(p_rejection_reason, '')), '');

    if v_reason is null then
      raise exception using
        errcode = '22023',
        message = 'A rejection reason is required';
    end if;

    update public.payments
    set
      status = 'REJECTED',
      verified_by = null,
      verified_at = null,
      rejection_reason = v_reason,
      verification_source = null
    where id = v_payment_id;
  else
    update public.payments
    set
      status = 'VERIFIED',
      verified_by = v_actor_id,
      verified_at = v_now,
      rejection_reason = null,
      verification_source = 'PAYMENT_PROOF'
    where id = v_payment_id;
  end if;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    case
      when p_decision = 'VERIFIED' then 'PAYMENT_VERIFIED'
      else 'PAYMENT_REJECTED'
    end,
    'payments',
    v_payment_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'proof_upload_id', v_proof_upload_id,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'order_id', p_order_id,
    'status', p_decision,
    'proof_upload_id', v_proof_upload_id,
    'verified_by',
      case when p_decision = 'VERIFIED' then v_actor_id else null end,
    'verified_at',
      case when p_decision = 'VERIFIED' then v_now else null end,
    'rejection_reason',
      case when p_decision = 'REJECTED' then v_reason else null end,
    'verification_source',
      case when p_decision = 'VERIFIED' then 'PAYMENT_PROOF' else null end
  );
end;
$function$;

revoke all on function public.review_instapay_payment(
  uuid,
  uuid,
  public.payment_status,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.review_instapay_payment(
  uuid,
  uuid,
  public.payment_status,
  text
) to authenticated;
