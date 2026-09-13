-- Timestamp maintenance and query-path indexes.

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function private.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function private.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

create index addresses_user_id_idx on public.addresses (user_id);

create unique index addresses_one_default_per_user_idx
  on public.addresses (user_id)
  where is_default;

create index categories_active_display_idx
  on public.categories (display_order, name)
  where is_active;

create index products_category_id_idx on public.products (category_id);

create index products_active_display_idx
  on public.products (display_order, name)
  where is_active;

create index products_featured_display_idx
  on public.products (display_order, name)
  where is_active and is_featured;

create index product_images_product_display_idx
  on public.product_images (product_id, display_order);

create unique index product_images_one_primary_per_product_idx
  on public.product_images (product_id)
  where is_primary;

create index customer_uploads_user_created_idx
  on public.customer_uploads (user_id, created_at desc);

create index store_settings_updated_by_idx
  on public.store_settings (updated_by);

create index orders_customer_created_idx
  on public.orders (customer_id, created_at desc);


create index orders_address_id_idx on public.orders (address_id);

create index orders_status_created_idx
  on public.orders (status, created_at desc);

create index orders_created_at_idx on public.orders (created_at desc);

create index orders_payment_method_created_idx
  on public.orders (payment_method, created_at desc);

create index order_items_order_id_idx on public.order_items (order_id);

create index order_items_product_id_idx on public.order_items (product_id);

create index order_items_custom_design_upload_id_idx
  on public.order_items (custom_design_upload_id);

create index payments_status_idx on public.payments (status);
create index payments_method_idx on public.payments (method);

create index payments_payment_proof_upload_id_idx
  on public.payments (payment_proof_upload_id);

create index payments_verified_by_idx on public.payments (verified_by);

create index order_status_history_order_created_idx
  on public.order_status_history (order_id, created_at);

create index order_status_history_created_at_idx
  on public.order_status_history (created_at desc);

create index order_status_history_changed_by_idx
  on public.order_status_history (changed_by);

create index admin_audit_logs_admin_created_idx
  on public.admin_audit_logs (admin_id, created_at desc);

create index admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);
