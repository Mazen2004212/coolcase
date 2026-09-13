-- Identity, catalog, settings, and upload metadata.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role public.user_role not null default 'CUSTOMER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  alternate_phone text,
  governorate text not null,
  city_area text not null,
  street_name text not null,
  building_number text not null,
  floor text,
  apartment text,
  landmark text,
  delivery_notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_recipient_name_not_blank check (
    length(btrim(recipient_name)) > 0
  ),
  constraint addresses_phone_not_blank check (length(btrim(phone)) > 0),
  constraint addresses_governorate_not_blank check (
    length(btrim(governorate)) > 0
  ),
  constraint addresses_city_area_not_blank check (length(btrim(city_area)) > 0),
  constraint addresses_street_name_not_blank check (
    length(btrim(street_name)) > 0
  ),
  constraint addresses_building_number_not_blank check (
    length(btrim(building_number)) > 0
  )
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_path text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(btrim(name)) > 0),
  constraint categories_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint categories_display_order_nonnegative check (display_order >= 0)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  silicone_price_override integer,
  acrylic_price_override integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (length(btrim(name)) > 0),
  constraint products_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint products_display_order_nonnegative check (display_order >= 0),
  constraint products_silicone_price_override_positive check (
    silicone_price_override is null or silicone_price_override > 0
  ),
  constraint products_acrylic_price_override_positive check (
    acrylic_price_override is null or acrylic_price_override > 0
  )
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  original_storage_path text,
  processed_storage_path text,
  alt_text text,
  display_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint product_images_storage_path_not_blank check (
    length(btrim(storage_path)) > 0
  ),
  constraint product_images_original_path_not_blank check (
    original_storage_path is null or length(btrim(original_storage_path)) > 0
  ),
  constraint product_images_processed_path_not_blank check (
    processed_storage_path is null or length(btrim(processed_storage_path)) > 0
  ),
  constraint product_images_display_order_nonnegative check (display_order >= 0)
);

create table public.store_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint store_settings_key_format check (
    key ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint store_settings_authoritative_value_shape check (
    case
      when key in ('silicone_price', 'acrylic_price') then
        case
          when jsonb_typeof(value) = 'number'
            then (value #>> '{}') ~ '^[0-9]+$'
              and (value #>> '{}')::numeric between 1 and 2147483647
          else false
        end
      when key = 'shipping_fee' then
        case
          when jsonb_typeof(value) = 'number'
            then (value #>> '{}') ~ '^[0-9]+$'
              and (value #>> '{}')::numeric between 0 and 2147483647
          else false
        end
      when key = 'currency' then
        case
          when jsonb_typeof(value) = 'string'
            then (value #>> '{}') ~ '^[A-Z]{3}$'
          else false
        end
      else true
    end
  )
);

create table public.customer_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  upload_type public.upload_type not null,
  created_at timestamptz not null default now(),
  constraint customer_uploads_storage_path_not_blank check (
    length(btrim(storage_path)) > 0
  ),
  constraint customer_uploads_file_size_positive check (
    file_size_bytes is null or file_size_bytes > 0
  ),
  constraint customer_uploads_private_path_is_user_scoped check (
    upload_type = 'PRODUCT_IMAGE'
    or storage_path like user_id::text || '/%'
  ),
  constraint customer_uploads_type_storage_path_unique unique (
    upload_type,
    storage_path
  )
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role
  )
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
    ),
    new.email,
    new.phone,
    'CUSTOMER'::public.user_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
