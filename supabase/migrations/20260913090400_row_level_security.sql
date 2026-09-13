-- Row-level authorization. The service role bypasses RLS and must remain server-only.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'::public.user_role
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.store_settings enable row level security;
alter table public.customer_uploads enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on table public.profiles from public, anon, authenticated, service_role;
revoke all on table public.addresses from public, anon, authenticated, service_role;
revoke all on table public.categories from public, anon, authenticated, service_role;
revoke all on table public.products from public, anon, authenticated, service_role;
revoke all on table public.product_images from public, anon, authenticated, service_role;
revoke all on table public.store_settings from public, anon, authenticated, service_role;
revoke all on table public.customer_uploads from public, anon, authenticated, service_role;
revoke all on table public.orders from public, anon, authenticated, service_role;
revoke all on table public.order_items from public, anon, authenticated, service_role;
revoke all on table public.payments from public, anon, authenticated, service_role;
revoke all on table public.order_status_history from public, anon, authenticated, service_role;
revoke all on table public.admin_audit_logs from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.addresses to service_role;
grant select, insert, update, delete on table public.categories to service_role;
grant select, insert, update, delete on table public.products to service_role;
grant select, insert, update, delete on table public.product_images to service_role;
grant select, insert, update, delete on table public.store_settings to service_role;
grant select, insert, update, delete on table public.customer_uploads to service_role;
grant select, insert on table public.orders to service_role;
grant update (
  status,
  confirmed_at,
  shipped_at,
  delivered_at,
  cancelled_at
) on table public.orders to service_role;
grant select, insert on table public.order_items to service_role;
grant select, insert on table public.payments to service_role;
grant update (
  status,
  payment_proof_upload_id,
  verified_by,
  verified_at,
  rejection_reason
) on table public.payments to service_role;
grant select, insert on table public.order_status_history to service_role;
grant select, insert on table public.admin_audit_logs to service_role;

grant select on table public.profiles to authenticated;
grant update (full_name, email, phone) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.addresses to authenticated;

grant select on table public.categories to anon;
grant select, insert, update, delete on table public.categories to authenticated;
grant select on table public.products to anon;
grant select, insert, update, delete on table public.products to authenticated;
grant select (
  id,
  product_id,
  storage_path,
  processed_storage_path,
  alt_text,
  display_order,
  is_primary,
  created_at
) on table public.product_images to anon, authenticated;
grant insert, update, delete on table public.product_images to authenticated;
grant select (id, key, value, is_public, updated_at)
  on table public.store_settings to anon, authenticated;
grant insert, update, delete on table public.store_settings to authenticated;

grant select, insert on table public.customer_uploads to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select (
  id,
  order_id,
  method,
  status,
  expected_amount,
  currency,
  payment_proof_upload_id,
  verified_at,
  rejection_reason,
  created_at,
  updated_at
) on table public.payments to authenticated;
grant select (
  id,
  order_id,
  status,
  customer_visible_note,
  created_at
) on table public.order_status_history to authenticated;
grant select on table public.admin_audit_logs to authenticated;

create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or private.is_admin());

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy addresses_owner_or_admin_all
  on public.addresses
  for all
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin())
  with check (user_id = (select auth.uid()) or private.is_admin());

create policy categories_public_read_active
  on public.categories
  for select
  to anon, authenticated
  using (is_active);

create policy categories_admin_all
  on public.categories
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy products_public_read_active
  on public.products
  for select
  to anon, authenticated
  using (is_active);

create policy products_admin_all
  on public.products
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy product_images_public_read_for_active_products
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_images.product_id
        and products.is_active
    )
  );

create policy product_images_admin_all
  on public.product_images
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy store_settings_public_read
  on public.store_settings
  for select
  to anon, authenticated
  using (is_public);

create policy store_settings_admin_all
  on public.store_settings
  for all
  to authenticated
  using (private.is_admin())
  with check (
    private.is_admin()
    and updated_by = (select auth.uid())
  );

create policy customer_uploads_owner_select
  on public.customer_uploads
  for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

create policy customer_uploads_owner_insert
  on public.customer_uploads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and upload_type in ('CUSTOM_CASE_DESIGN', 'PAYMENT_PROOF')
  );

create policy customer_uploads_admin_insert
  on public.customer_uploads
  for insert
  to authenticated
  with check (private.is_admin());

create policy orders_customer_select
  on public.orders
  for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy orders_admin_select
  on public.orders
  for select
  to authenticated
  using (private.is_admin());

create policy order_items_customer_select
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and orders.customer_id = (select auth.uid())
    )
  );

create policy order_items_admin_select
  on public.order_items
  for select
  to authenticated
  using (private.is_admin());

create policy payments_customer_select
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = payments.order_id
        and orders.customer_id = (select auth.uid())
    )
  );

create policy payments_admin_select
  on public.payments
  for select
  to authenticated
  using (private.is_admin());

create policy order_status_history_customer_or_admin_select
  on public.order_status_history
  for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.orders
      where orders.id = order_status_history.order_id
        and orders.customer_id = (select auth.uid())
    )
  );

create policy admin_audit_logs_admin_select
  on public.admin_audit_logs
  for select
  to authenticated
  using (private.is_admin());

create view public.order_tracking_events
with (security_invoker = true)
as
select
  id,
  order_id,
  status,
  customer_visible_note,
  created_at
from public.order_status_history;

revoke all on table public.order_tracking_events from public, anon, authenticated, service_role;
grant select on table public.order_tracking_events to authenticated;
grant select on table public.order_tracking_events to service_role;
