-- Real storefront collections with ordered product membership and staff-authorized writes.

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  collection_type text not null default 'CUSTOM',
  banner_image_url text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_name_not_blank check (length(btrim(name)) > 0),
  constraint collections_name_length check (char_length(name) <= 120),
  constraint collections_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint collections_description_length check (description is null or char_length(description) <= 1200),
  constraint collections_type_allowed check (collection_type in ('CUSTOM', 'NEW_ARRIVALS')),
  constraint collections_banner_not_blank check (banner_image_url is null or length(btrim(banner_image_url)) > 0),
  constraint collections_sort_order_nonnegative check (sort_order >= 0)
);

-- NEW_ARRIVALS is a single semantic system collection. Deactivate/edit the existing
-- row rather than creating competing sources of truth.
create unique index collections_single_new_arrivals_idx
  on public.collections (collection_type)
  where collection_type = 'NEW_ARRIVALS';

create index collections_storefront_order_idx
  on public.collections (is_active, is_featured desc, sort_order, name);

create table public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, product_id),
  constraint collection_products_sort_order_nonnegative check (sort_order >= 0)
);

create index collection_products_collection_order_idx
  on public.collection_products (collection_id, sort_order, created_at);

create index collection_products_product_idx
  on public.collection_products (product_id);

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function private.set_updated_at();

alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

revoke all on table public.collections from public, anon, authenticated, service_role;
revoke all on table public.collection_products from public, anon, authenticated, service_role;

grant select on table public.collections to anon, authenticated;
grant select on table public.collection_products to anon, authenticated;
grant select, insert, update, delete on table public.collections to service_role;
grant select, insert, update, delete on table public.collection_products to service_role;

create policy collections_public_read_active
  on public.collections
  for select
  to anon, authenticated
  using (is_active);

create policy collection_products_public_read_active_collection
  on public.collection_products
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.collections
      where collections.id = collection_products.collection_id
        and collections.is_active
    )
  );

create or replace function public.save_collection(
  p_collection_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_collection_type text,
  p_banner_image_url text,
  p_is_active boolean,
  p_is_featured boolean,
  p_sort_order integer,
  p_product_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_collection_id uuid;
  v_is_new boolean := false;
  v_previous_product_ids uuid[] := array[]::uuid[];
  v_product_ids uuid[] := coalesce(p_product_ids, array[]::uuid[]);
begin
  if not exists (
    select 1
    from public.admin_staff as staff
    where staff.user_id = v_actor_id
      and staff.is_active
      and (staff.role = 'OWNER' or 'products.manage' = any(staff.permissions))
  ) then
    raise exception using errcode = '42501', message = 'Active products.manage staff access is required';
  end if;

  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 120 then
    raise exception using errcode = '23514', message = 'Collection name is required and must not exceed 120 characters';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '23514', message = 'Collection slug must use lowercase letters, numbers, and hyphens';
  end if;
  if p_collection_type not in ('CUSTOM', 'NEW_ARRIVALS') then
    raise exception using errcode = '23514', message = 'Unsupported collection type';
  end if;
  if p_sort_order is null or p_sort_order < 0 then
    raise exception using errcode = '23514', message = 'Collection sort order must be zero or greater';
  end if;
  if p_description is not null and char_length(p_description) > 1200 then
    raise exception using errcode = '23514', message = 'Collection description must not exceed 1200 characters';
  end if;
  if cardinality(v_product_ids) <> (
    select count(distinct requested.product_id)
    from unnest(v_product_ids) as requested(product_id)
  ) then
    raise exception using errcode = '23514', message = 'A product may appear only once in a collection';
  end if;
  if exists (
    select 1 from unnest(v_product_ids) as requested(product_id)
    where not exists (select 1 from public.products where products.id = requested.product_id)
  ) then
    raise exception using errcode = '23503', message = 'One or more selected products do not exist';
  end if;

  if p_collection_id is null then
    v_collection_id := gen_random_uuid();
    v_is_new := true;
    insert into public.collections (
      id, name, slug, description, collection_type, banner_image_url,
      is_active, is_featured, sort_order
    ) values (
      v_collection_id, btrim(p_name), p_slug, nullif(btrim(p_description), ''),
      p_collection_type, nullif(btrim(p_banner_image_url), ''),
      p_is_active, p_is_featured, p_sort_order
    );
  else
    select id into v_collection_id
    from public.collections
    where id = p_collection_id
    for update;

    if v_collection_id is null then
      raise exception using errcode = 'P0002', message = 'Collection not found';
    end if;

    select coalesce(array_agg(product_id order by sort_order, created_at), array[]::uuid[])
      into v_previous_product_ids
    from public.collection_products
    where collection_id = v_collection_id;

    update public.collections
    set name = btrim(p_name),
        slug = p_slug,
        description = nullif(btrim(p_description), ''),
        collection_type = p_collection_type,
        banner_image_url = nullif(btrim(p_banner_image_url), ''),
        is_active = p_is_active,
        is_featured = p_is_featured,
        sort_order = p_sort_order
    where id = v_collection_id;
  end if;

  delete from public.collection_products where collection_id = v_collection_id;
  insert into public.collection_products (collection_id, product_id, sort_order)
  select v_collection_id, requested.product_id, (requested.ordinality - 1)::integer
  from unnest(v_product_ids) with ordinality as requested(product_id, ordinality);

  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_is_new then 'COLLECTION_CREATED' else 'COLLECTION_UPDATED' end,
    'collections',
    v_collection_id,
    jsonb_build_object(
      'name', btrim(p_name),
      'slug', p_slug,
      'collection_type', p_collection_type,
      'is_active', p_is_active,
      'is_featured', p_is_featured,
      'product_count', cardinality(v_product_ids)
    )
  );

  if v_is_new or v_previous_product_ids is distinct from v_product_ids then
    insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, metadata)
    values (
      v_actor_id,
      'COLLECTION_PRODUCTS_UPDATED',
      'collections',
      v_collection_id,
      jsonb_build_object('product_ids', to_jsonb(v_product_ids))
    );
  end if;

  return v_collection_id;
end;
$$;

revoke all on function public.save_collection(uuid, text, text, text, text, text, boolean, boolean, integer, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.save_collection(uuid, text, text, text, text, text, boolean, boolean, integer, uuid[]) to authenticated;

create or replace function public.delete_collection(p_collection_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_collection public.collections%rowtype;
begin
  if not exists (
    select 1
    from public.admin_staff as staff
    where staff.user_id = v_actor_id
      and staff.is_active
      and (staff.role = 'OWNER' or 'products.manage' = any(staff.permissions))
  ) then
    raise exception using errcode = '42501', message = 'Active products.manage staff access is required';
  end if;

  select * into v_collection
  from public.collections
  where id = p_collection_id
  for update;

  if v_collection.id is null then
    raise exception using errcode = 'P0002', message = 'Collection not found';
  end if;

  delete from public.collections where id = p_collection_id;

  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'COLLECTION_DELETED',
    'collections',
    p_collection_id,
    jsonb_build_object(
      'name', v_collection.name,
      'slug', v_collection.slug,
      'collection_type', v_collection.collection_type,
      'product_labels_removed', true
    )
  );

  return v_collection.banner_image_url;
end;
$$;

revoke all on function public.delete_collection(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_collection(uuid) to authenticated;
