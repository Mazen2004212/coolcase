-- Custom Cases V2: named templates and immutable order customization snapshots.

create table public.custom_case_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_path text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  allowed_script text not null default 'BOTH',
  max_characters integer not null default 18,
  font_key text not null default 'TAHOMA',
  font_size integer not null default 38,
  font_weight integer not null default 600,
  text_color text not null default '#111111',
  text_x numeric(5,2) not null default 50,
  text_y numeric(5,2) not null default 50,
  text_rotation numeric(5,2) not null default 0,
  text_align text not null default 'center',
  text_transform text not null default 'NONE',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_case_templates_name_not_blank check (length(btrim(name)) between 1 and 120),
  constraint custom_case_templates_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  constraint custom_case_templates_image_path check (image_path ~ '^custom-case-templates/[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp|avif)$'),
  constraint custom_case_templates_sort_order check (sort_order between 0 and 10000),
  constraint custom_case_templates_script check (allowed_script in ('LATIN','ARABIC','BOTH')),
  constraint custom_case_templates_max_chars check (max_characters between 1 and 40),
  constraint custom_case_templates_font check (font_key in ('INTER','GEORGIA','ARIAL','TAHOMA')),
  constraint custom_case_templates_arabic_font check (allowed_script = 'LATIN' or font_key in ('ARIAL','TAHOMA')),
  constraint custom_case_templates_font_size check (font_size between 10 and 96),
  constraint custom_case_templates_font_weight check (font_weight between 300 and 900 and font_weight % 100 = 0),
  constraint custom_case_templates_color check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint custom_case_templates_position check (text_x between 0 and 100 and text_y between 0 and 100),
  constraint custom_case_templates_rotation check (text_rotation between -45 and 45),
  constraint custom_case_templates_align check (text_align in ('left','center','right')),
  constraint custom_case_templates_transform check (text_transform in ('NONE','UPPERCASE','LOWERCASE'))
);

create trigger set_custom_case_templates_updated_at before update on public.custom_case_templates
for each row execute function private.set_updated_at();

create index custom_case_templates_storefront_idx on public.custom_case_templates (sort_order, name) where is_active = true;

alter table public.custom_case_templates enable row level security;
revoke all on table public.custom_case_templates from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.custom_case_templates to service_role;
grant select on table public.custom_case_templates to anon, authenticated;

create policy custom_case_templates_public_active_read on public.custom_case_templates for select to anon, authenticated using (is_active);
create policy custom_case_templates_staff_read on public.custom_case_templates for select to authenticated using (
  exists (select 1 from public.admin_staff s where s.user_id = (select auth.uid()) and s.is_active and (s.role = 'OWNER' or 'products.view' = any(s.permissions)))
);

alter table public.order_items
  add column customization_type text,
  add column custom_template_id uuid references public.custom_case_templates(id) on delete restrict,
  add column customization_snapshot jsonb;

update public.order_items set customization_type = 'UPLOAD_DESIGN'
where custom_design_upload_id is not null;

-- Flush the existing deferred subtotal-validation trigger before further DDL.
set constraints all immediate;

alter table public.order_items
  add constraint order_items_customization_type check (customization_type is null or customization_type in ('UPLOAD_DESIGN','NAMED_TEMPLATE')),
  add constraint order_items_customization_snapshot_object check (customization_snapshot is null or jsonb_typeof(customization_snapshot) = 'object'),
  add constraint order_items_customization_shape check (
    (customization_type is null and custom_design_upload_id is null and custom_template_id is null and customization_snapshot is null)
    or (customization_type = 'UPLOAD_DESIGN' and custom_design_upload_id is not null and custom_template_id is null)
    or (customization_type = 'NAMED_TEMPLATE' and custom_design_upload_id is null and custom_template_id is not null and customization_snapshot is not null and customization_snapshot ->> 'type' = 'NAMED_TEMPLATE')
  );

create index order_items_custom_template_id_idx on public.order_items(custom_template_id) where custom_template_id is not null;

create or replace function private.protect_order_item_snapshot() returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.order_id,new.product_id,new.product_name_snapshot,new.product_image_snapshot,new.material,new.phone_model,new.custom_phone_model,new.network_type,new.custom_design_upload_id,new.customization_type,new.custom_template_id,new.customization_snapshot,new.unit_price,new.quantity,new.line_total,new.created_at)
    is distinct from
    row(old.order_id,old.product_id,old.product_name_snapshot,old.product_image_snapshot,old.material,old.phone_model,old.custom_phone_model,old.network_type,old.custom_design_upload_id,old.customization_type,old.custom_template_id,old.customization_snapshot,old.unit_price,old.quantity,old.line_total,old.created_at)
  then raise exception using errcode='23514', message='Historical order item snapshots cannot be changed'; end if;
  return new;
end; $$;

create or replace function public.create_order(
  p_customer_id uuid,p_customer_name text,p_customer_phone text,p_customer_email text,p_governorate text,p_city_area text,p_street_name text,p_building_number text,p_floor text,p_apartment text,p_landmark text,p_delivery_notes text,p_subtotal_amount integer,p_shipping_amount integer,p_payment_method public.payment_method,p_items jsonb,p_address_id uuid default null,p_coupon_code text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_order_id uuid; v_order_number text; v_item jsonb; v_payment_status public.payment_status;
  v_coupon_record record; v_coupon_id uuid:=null; v_coupon_snapshot text:=null; v_discount_amount integer:=0; v_total_amount integer; v_customer_usage integer:=0; v_total_usage integer:=0; v_is_test boolean:=false;
begin
  select exists(select 1 from public.admin_staff where user_id=p_customer_id and is_active=true) into v_is_test;
  if p_coupon_code is not null and btrim(p_coupon_code)<>'' then
    if p_customer_id is null then raise exception 'Sign in to use a coupon.'; end if;
    select * into v_coupon_record from public.coupons where upper(code)=upper(btrim(p_coupon_code)) for update;
    if not found then raise exception 'Coupon not found.'; end if;
    if not v_coupon_record.is_active then raise exception 'Coupon is not active.'; end if;
    if v_coupon_record.starts_at is not null and v_coupon_record.starts_at>now() then raise exception 'Coupon is not valid yet.'; end if;
    if v_coupon_record.expires_at is not null and v_coupon_record.expires_at<now() then raise exception 'Coupon has expired.'; end if;
    if v_coupon_record.customer_id is not null and v_coupon_record.customer_id<>p_customer_id then raise exception 'This coupon is not valid for your account.'; end if;
    if p_subtotal_amount<v_coupon_record.minimum_subtotal then raise exception 'Minimum subtotal of % EGP not met.',v_coupon_record.minimum_subtotal; end if;
    if v_coupon_record.usage_limit is not null then select count(*) into v_total_usage from public.coupon_redemptions where coupon_id=v_coupon_record.id; if v_total_usage>=v_coupon_record.usage_limit then raise exception 'Coupon usage limit reached.'; end if; end if;
    if v_coupon_record.per_customer_limit is not null then select count(*) into v_customer_usage from public.coupon_redemptions where coupon_id=v_coupon_record.id and customer_id=p_customer_id; if v_customer_usage>=v_coupon_record.per_customer_limit then raise exception 'You have reached the maximum usage limit for this coupon.'; end if; end if;
    if v_coupon_record.discount_type='PERCENTAGE' then v_discount_amount:=floor(p_subtotal_amount*(v_coupon_record.discount_value::numeric/100.0)); elsif v_coupon_record.discount_type='FIXED' then v_discount_amount:=floor(v_coupon_record.discount_value); end if;
    if v_discount_amount>p_subtotal_amount then v_discount_amount:=p_subtotal_amount; end if;
    v_coupon_id:=v_coupon_record.id; v_coupon_snapshot:=v_coupon_record.code;
  end if;
  v_total_amount:=p_subtotal_amount-v_discount_amount+p_shipping_amount; v_order_number:=public.generate_order_number();
  v_payment_status:=case p_payment_method when 'INSTAPAY' then 'PENDING'::public.payment_status else 'NOT_REQUIRED'::public.payment_status end;
  insert into public.orders(order_number,customer_id,address_id,customer_name,customer_phone,customer_email,governorate,city_area,street_name,building_number,floor,apartment,landmark,delivery_notes,subtotal_amount,shipping_amount,total_amount,payment_method,status,coupon_id,coupon_code_snapshot,discount_amount,is_test)
  values(v_order_number,p_customer_id,p_address_id,btrim(p_customer_name),btrim(p_customer_phone),lower(btrim(p_customer_email)),btrim(p_governorate),btrim(p_city_area),btrim(p_street_name),btrim(p_building_number),nullif(btrim(coalesce(p_floor,'')),''),nullif(btrim(coalesce(p_apartment,'')),''),nullif(btrim(coalesce(p_landmark,'')),''),nullif(btrim(coalesce(p_delivery_notes,'')),''),p_subtotal_amount,p_shipping_amount,v_total_amount,p_payment_method,'PENDING_ADMIN_APPROVAL',v_coupon_id,v_coupon_snapshot,v_discount_amount,v_is_test) returning id into v_order_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items(order_id,product_id,product_name_snapshot,product_image_snapshot,material,phone_model,custom_phone_model,network_type,custom_design_upload_id,customization_type,custom_template_id,customization_snapshot,unit_price,quantity,line_total)
    values(v_order_id,(v_item->>'product_id')::uuid,v_item->>'product_name_snapshot',v_item->>'product_image_snapshot',(v_item->>'material')::public.case_material,v_item->>'phone_model',nullif(btrim(coalesce(v_item->>'custom_phone_model','')),''),(v_item->>'network_type')::public.network_type,(v_item->>'custom_design_upload_id')::uuid,nullif(v_item->>'customization_type',''),(v_item->>'custom_template_id')::uuid,v_item->'customization_snapshot',(v_item->>'unit_price')::integer,(v_item->>'quantity')::integer,(v_item->>'line_total')::integer);
  end loop;
  if v_coupon_id is not null and not v_is_test then insert into public.coupon_redemptions(coupon_id,order_id,customer_id,subtotal_amount,discount_amount) values(v_coupon_id,v_order_id,p_customer_id,p_subtotal_amount,v_discount_amount); end if;
  insert into public.payments(order_id,method,status,expected_amount) values(v_order_id,p_payment_method,v_payment_status,v_total_amount);
  insert into public.order_status_history(order_id,status,previous_status,changed_by,customer_visible_note) values(v_order_id,'PENDING_ADMIN_APPROVAL',null,null,'Order placed successfully.');
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'subtotal_amount',p_subtotal_amount,'discount_amount',v_discount_amount,'shipping_amount',p_shipping_amount,'total_amount',v_total_amount,'is_test',v_is_test);
end; $$;

revoke all on function public.create_order(uuid,text,text,text,text,text,text,text,text,text,text,text,integer,integer,public.payment_method,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.create_order(uuid,text,text,text,text,text,text,text,text,text,text,text,integer,integer,public.payment_method,jsonb,uuid,text) to service_role;
