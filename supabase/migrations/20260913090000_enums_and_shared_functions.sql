-- Core enum types and shared trigger functions.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create type public.user_role as enum (
  'CUSTOMER',
  'ADMIN'
);

create type public.case_material as enum (
  'SILICONE',
  'ACRYLIC'
);

create type public.network_type as enum (
  'FOUR_G',
  'FIVE_G'
);

create type public.payment_method as enum (
  'INSTAPAY',
  'CASH_ON_DELIVERY'
);

create type public.payment_status as enum (
  'PENDING',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'NOT_REQUIRED',
  'REFUNDED'
);

create type public.order_status as enum (
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED'
);

create type public.upload_type as enum (
  'PRODUCT_IMAGE',
  'CUSTOM_CASE_DESIGN',
  'PAYMENT_PROOF'
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;
