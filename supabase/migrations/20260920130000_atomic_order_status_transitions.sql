-- Atomically validate and apply staff-managed order status transitions.
--
-- This function must be invoked with the authenticated customer's/staff
-- session, not the service-role client. The actor is always auth.uid().

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_customer_visible_note text default null,
  p_internal_note text default null,
  p_send_email boolean default false
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

  v_order public.orders%rowtype;
  v_previous_status public.order_status;
  v_payment_status public.payment_status;
  v_transition_allowed boolean := false;

  v_now timestamptz := now();
  v_history_id uuid;
  v_audit_id uuid;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  -- Hold the staff row against concurrent deactivation or permission changes
  -- for the duration of this short transaction.
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

  if p_new_status is null then
    raise exception using
      errcode = '22023',
      message = 'A target order status is required';
  end if;

  -- The locked database row is authoritative. The caller never supplies the
  -- previous status.
  select target.*
  into v_order
  from public.orders as target
  where target.id = p_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Order not found';
  end if;

  v_previous_status := v_order.status;

  -- Preserve the repository's existing transition map exactly, including
  -- support for legacy PENDING_CONFIRMATION rows.
  v_transition_allowed :=
    case v_previous_status
      when 'PENDING_ADMIN_APPROVAL' then
        p_new_status in ('CONFIRMED', 'REJECTED', 'CANCELLED')
      when 'PENDING_CONFIRMATION' then
        p_new_status in ('CONFIRMED', 'REJECTED', 'CANCELLED')
      when 'CONFIRMED' then
        p_new_status in ('PREPARING', 'CANCELLED')
      when 'PREPARING' then
        p_new_status in ('SHIPPED', 'CANCELLED')
      when 'SHIPPED' then
        p_new_status in ('OUT_FOR_DELIVERY', 'CANCELLED')
      when 'OUT_FOR_DELIVERY' then
        p_new_status in ('DELIVERED', 'CANCELLED')
      else false
    end;

  if not coalesce(v_transition_allowed, false) then
    raise exception using
      errcode = '22023',
      message = format(
        'Invalid order status transition: %s -> %s',
        v_previous_status,
        p_new_status
      );
  end if;

  -- Keep lock ordering consistent: staff -> order -> payment. COD preserves
  -- its existing behavior and needs no verification check.
  if p_new_status = 'CONFIRMED'
    and v_order.payment_method = 'INSTAPAY'
  then
    select payment.status
    into v_payment_status
    from public.payments as payment
    where payment.order_id = p_order_id
      and payment.method = 'INSTAPAY'
    for share;

    if not found or v_payment_status <> 'VERIFIED' then
      raise exception using
        errcode = '23514',
        message =
          'InstaPay payment must be verified before this order can be confirmed';
    end if;
  end if;

  update public.orders
  set
    status = p_new_status,
    confirmed_at = case
      when p_new_status = 'CONFIRMED' then v_now
      else confirmed_at
    end,
    shipped_at = case
      when p_new_status = 'SHIPPED' then v_now
      else shipped_at
    end,
    delivered_at = case
      when p_new_status = 'DELIVERED' then v_now
      else delivered_at
    end,
    cancelled_at = case
      when p_new_status = 'CANCELLED' then v_now
      else cancelled_at
    end,
    rejected_at = case
      when p_new_status = 'REJECTED' then v_now
      else rejected_at
    end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (
    order_id,
    status,
    previous_status,
    changed_by,
    customer_visible_note,
    internal_note
  )
  values (
    p_order_id,
    p_new_status,
    v_previous_status,
    v_actor_id,
    nullif(btrim(coalesce(p_customer_visible_note, '')), ''),
    nullif(btrim(coalesce(p_internal_note, '')), '')
  )
  returning id into v_history_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'ORDER_STATUS_CHANGED',
    'orders',
    p_order_id,
    jsonb_build_object(
      'from', v_previous_status,
      'to', p_new_status,
      'with_email', coalesce(p_send_email, false)
    )
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'previous_status', v_previous_status,
    'status', v_order.status,
    'updated_at', v_order.updated_at,
    'confirmed_at', v_order.confirmed_at,
    'shipped_at', v_order.shipped_at,
    'delivered_at', v_order.delivered_at,
    'cancelled_at', v_order.cancelled_at,
    'rejected_at', v_order.rejected_at,
    'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email,
    'total_amount', v_order.total_amount,
    'payment_method', v_order.payment_method,
    'shipping_courier', v_order.shipping_courier,
    'shipping_tracking_number', v_order.shipping_tracking_number,
    'shipping_current_location', v_order.shipping_current_location,
    'history_id', v_history_id,
    'audit_id', v_audit_id
  );
end;
$function$;

revoke all on function public.transition_order_status(
  uuid,
  public.order_status,
  text,
  text,
  boolean
) from public, anon, authenticated, service_role;

grant execute on function public.transition_order_status(
  uuid,
  public.order_status,
  text,
  text,
  boolean
) to authenticated;
