-- 1. Create admin_staff table

create table public.admin_staff (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('OWNER', 'MANAGER', 'ORDER_STAFF')),
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create trigger set_admin_staff_updated_at
  before update on public.admin_staff
  for each row execute function private.set_updated_at();

-- 2. Backfill existing admins
insert into public.admin_staff (user_id, role, permissions, is_active)
select id, 'OWNER', array[
  'dashboard.view', 'orders.view', 'orders.manage', 'products.view', 'products.manage',
  'customers.view', 'customers.manage', 'coupons.view', 'coupons.manage',
  'analytics.view', 'shipping.manage', 'settings.manage', 'employees.manage'
], true
from public.profiles
where role = 'ADMIN'::public.user_role
on conflict (user_id) do nothing;

-- 3. Replace private.is_admin() to use admin_staff and strictly require OWNER role
-- This prevents MANAGER/ORDER_STAFF from inheriting broad legacy RLS privileges.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_staff
    where user_id = (select auth.uid())
      and is_active = true
      and role = 'OWNER'
  );
$$;

-- RLS for admin_staff
alter table public.admin_staff enable row level security;

-- Only allow authenticated users to read their OWN staff record.
-- ALL mutations (insert/update/delete) are performed via createAdminClient() in server actions.
create policy "Staff can read own admin_staff record"
  on public.admin_staff for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 4. Add material flags to products
alter table public.products
  add column silicone_enabled boolean not null default true,
  add column acrylic_enabled boolean not null default true,
  add column double_layer_enabled boolean not null default true;

-- Ensure that at least one material is enabled for active/available products
alter table public.products
  add constraint product_must_have_material
  check (
    (not is_active) or 
    (not is_available) or 
    (silicone_enabled or acrylic_enabled or double_layer_enabled)
  );

-- Function to prevent deleting/demoting the last active owner
create or replace function private.check_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_owners int;
  canonical_permissions text[] := array[
    'dashboard.view', 'orders.view', 'orders.manage', 'products.view', 'products.manage',
    'customers.view', 'customers.manage', 'coupons.view', 'coupons.manage',
    'analytics.view', 'shipping.manage', 'settings.manage', 'employees.manage'
  ];
begin
  if (TG_OP = 'DELETE') then
    if (OLD.role = 'OWNER' and OLD.is_active = true) then
      select count(*) into active_owners from public.admin_staff where role = 'OWNER' and is_active = true;
      if active_owners <= 1 then
        raise exception 'Cannot delete the last active OWNER.';
      end if;
    end if;
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    if (OLD.role = 'OWNER' and OLD.is_active = true) then
      if (NEW.role != 'OWNER' or NEW.is_active = false) then
        select count(*) into active_owners from public.admin_staff where role = 'OWNER' and is_active = true;
        if active_owners <= 1 then
          raise exception 'Cannot demote or deactivate the last active OWNER.';
        end if;
      end if;
    end if;
    
    -- Ensure OWNER always has ALL permissions
    if (NEW.role = 'OWNER') then
      if not (canonical_permissions <@ NEW.permissions and NEW.permissions <@ canonical_permissions) then
        NEW.permissions := canonical_permissions;
      end if;
    end if;
    
    return NEW;
  elsif (TG_OP = 'INSERT') then
    if (NEW.role = 'OWNER') then
      NEW.permissions := canonical_permissions;
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

create trigger protect_last_owner
  before insert or update or delete on public.admin_staff
  for each row
  execute function private.check_last_owner();

-- 5. Fix history trigger to use admin_staff instead of profile role
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
    from public.admin_staff
    where user_id = new.changed_by
      and is_active = true
      and (role = 'OWNER' or 'orders.manage' = ANY(permissions))
  ) then
    raise exception using
      errcode = '23514',
      message = 'Order history actor must be authorized to manage orders';
  end if;

  return new;
end;
$$;
