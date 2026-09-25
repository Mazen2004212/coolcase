-- Transactional Custom Cases V2 database/security checks. All fixtures roll back.
begin;

create or replace function pg_temp.assert_true(result boolean, test_name text) returns text language plpgsql as $$
begin if result is not true then raise exception 'Custom Cases V2 assertion failed: %', test_name; end if; return 'PASS: '||test_name; end; $$;
create or replace function pg_temp.expect_sqlstate(statement text, expected text, test_name text) returns text language plpgsql as $$
begin execute statement; raise exception 'Custom Cases V2 assertion failed: % (statement succeeded)',test_name; exception when others then if sqlstate=expected then return 'PASS: '||test_name; end if; if sqlerrm like 'Custom Cases V2 assertion failed:%' then raise; end if; raise exception 'Custom Cases V2 assertion failed: % (expected %, got %: %)',test_name,expected,sqlstate,sqlerrm; end; $$;

create temp table cc_v2_ids(staff uuid, template uuid, order_id uuid, rpc_order uuid) on commit drop;
grant select on table cc_v2_ids to anon, authenticated;
do $$ declare s uuid; t uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); begin
  select user_id into s from public.admin_staff where is_active and role='OWNER' limit 1;
  if s is null then raise exception 'No active owner available for Custom Cases V2 QA'; end if;
  insert into public.custom_case_templates(id,name,slug,image_path,is_active,allowed_script,max_characters,font_key,font_size,font_weight,text_color,text_x,text_y,text_rotation,text_align,text_transform,created_by)
  values(t,'Rollback QA Design','rollback-qa-'||left(t::text,8),'custom-case-templates/rollback-qa.png',true,'BOTH',18,'TAHOMA',38,600,'#111111',50,50,0,'center','NONE',s);
  insert into public.orders(id,order_number,customer_id,customer_name,customer_phone,customer_email,governorate,city_area,street_name,building_number,subtotal_amount,shipping_amount,total_amount,payment_method,status,is_test)
  values(o,'QA-CCV2-'||left(o::text,8),s,'Rollback QA','01000000001','qa@example.com','Cairo','Cairo','QA Street','1',199,0,199,'CASH_ON_DELIVERY','PENDING_ADMIN_APPROVAL',true);
  insert into public.order_items(order_id,product_name_snapshot,material,phone_model,network_type,customization_type,custom_template_id,customization_snapshot,unit_price,quantity,line_total)
  values(o,'Named Custom Case','SILICONE','iPhone 15','FIVE_G','NAMED_TEMPLATE',t,jsonb_build_object('type','NAMED_TEMPLATE','templateId',t,'templateName','Rollback QA Design','renderedText','Mazen'),199,1,199);
  insert into cc_v2_ids values(s,t,o,null);
end $$;

do $$ declare result jsonb; begin
  result:=public.create_order(
    p_customer_id=>(select staff from cc_v2_ids),p_customer_name=>'RPC QA',p_customer_phone=>'01000000001',p_customer_email=>'qa@example.com',p_governorate=>'Cairo',p_city_area=>'Cairo',p_street_name=>'QA Street',p_building_number=>'1',p_floor=>null,p_apartment=>null,p_landmark=>null,p_delivery_notes=>null,p_subtotal_amount=>199,p_shipping_amount=>0,p_payment_method=>'CASH_ON_DELIVERY',
    p_items=>jsonb_build_array(jsonb_build_object('product_id',null,'product_name_snapshot','Named Custom Case','product_image_snapshot','https://example.invalid/snapshot.png','material','SILICONE','phone_model','iPhone 15','custom_phone_model',null,'network_type','FIVE_G','custom_design_upload_id',null,'customization_type','NAMED_TEMPLATE','custom_template_id',(select template from cc_v2_ids),'customization_snapshot',jsonb_build_object('type','NAMED_TEMPLATE','templateId',(select template from cc_v2_ids),'templateName','Rollback QA Design','renderedText','Mazen'),'unit_price',199,'quantity',1,'line_total',199))
  );
  update cc_v2_ids set rpc_order=(result->>'order_id')::uuid;
end $$;

select pg_temp.assert_true((select customization_snapshot->>'renderedText'='Mazen' from public.order_items where order_id=(select order_id from cc_v2_ids)),'named order snapshot persists');
select pg_temp.assert_true((select customization_type='NAMED_TEMPLATE' and custom_template_id=(select template from cc_v2_ids) from public.order_items where order_id=(select rpc_order from cc_v2_ids)),'latest create_order stores named customization atomically');
select pg_temp.expect_sqlstate(format('update public.order_items set customization_snapshot=jsonb_build_object(''type'',''NAMED_TEMPLATE'',''renderedText'',''Changed'') where order_id=%L',(select order_id from cc_v2_ids)),'23514','order customization snapshot is immutable');
select pg_temp.expect_sqlstate(format('insert into public.order_items(order_id,product_name_snapshot,material,phone_model,network_type,customization_type,custom_template_id,unit_price,quantity,line_total) values(%L,''Invalid named'',''SILICONE'',''iPhone 15'',''FIVE_G'',''NAMED_TEMPLATE'',%L,0,1,0)',(select order_id from cc_v2_ids),(select template from cc_v2_ids)),'23514','named customization requires snapshot');
select pg_temp.expect_sqlstate(format('delete from public.custom_case_templates where id=%L',(select template from cc_v2_ids)),'23503','referenced template cannot be deleted');

set local role anon;
select pg_temp.assert_true((select count(*)=1 from public.custom_case_templates where id=(select template from cc_v2_ids)),'anonymous customer can read active template');
reset role;
update public.custom_case_templates set is_active=false where id=(select template from cc_v2_ids);
select pg_temp.expect_sqlstate(format($sql$insert into public.order_items(order_id,product_name_snapshot,material,phone_model,network_type,customization_type,custom_template_id,customization_snapshot,unit_price,quantity,line_total) values(%L,'Inactive named','SILICONE','iPhone 15','FIVE_G','NAMED_TEMPLATE',%L,jsonb_build_object('type','NAMED_TEMPLATE','templateId',%L,'renderedText','Mazen'),0,1,0)$sql$,(select order_id from cc_v2_ids),(select template from cc_v2_ids),(select template from cc_v2_ids)),'23514','inactive template is rejected during order insertion');
set local role anon;
select pg_temp.assert_true((select count(*)=0 from public.custom_case_templates where id=(select template from cc_v2_ids)),'anonymous customer cannot read inactive template');
select pg_temp.expect_sqlstate($sql$insert into public.custom_case_templates(name,slug,image_path) values('Forbidden','forbidden','custom-case-templates/forbidden.png')$sql$,'42501','customer cannot create templates');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select staff::text from cc_v2_ids),true);
select pg_temp.assert_true((select count(*)=1 from public.custom_case_templates where id=(select template from cc_v2_ids)),'active owner can read inactive template');
reset role;

rollback;
