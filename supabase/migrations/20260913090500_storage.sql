-- Storage buckets and object policies. Private uploads are namespaced by auth UID.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-assets',
    'product-assets',
    true,
    null,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'custom-designs',
    'custom-designs',
    false,
    null,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'payment-proofs',
    'payment-proofs',
    false,
    null,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_assets_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-assets');

create policy product_assets_admin_manage
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'product-assets'
    and private.is_admin()
  )
  with check (
    bucket_id = 'product-assets'
    and private.is_admin()
  );

create policy private_uploads_admin_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('custom-designs', 'payment-proofs')
    and private.is_admin()
  );

create policy private_uploads_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('custom-designs', 'payment-proofs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy private_uploads_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('custom-designs', 'payment-proofs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
