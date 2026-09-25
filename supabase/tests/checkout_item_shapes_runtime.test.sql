-- Transactional checkout coverage for every supported order-item shape.
-- All orders, uploads, and storage metadata are rolled back.

begin;

create or replace function pg_temp.assert_true(result boolean, test_name text)
returns text language plpgsql as $$
begin
  if result is not true then
    raise exception 'Checkout item-shape assertion failed: %', test_name;
  end if;
  return 'PASS: ' || test_name;
end;
$$;

create temp table checkout_shape_context (
  staff_id uuid,
  product_id uuid,
  template_id uuid,
  upload_order_id uuid,
  mixed_upload_id uuid,
  standard_order_id uuid,
  upload_order_result_id uuid,
  named_order_id uuid,
  mixed_order_id uuid
) on commit drop;

do $setup$
declare
  v_staff uuid;
  v_product uuid;
  v_template uuid := '9f625d2c-8433-4fcc-8daf-4c09c594108a';
  v_upload uuid := gen_random_uuid();
  v_mixed_upload uuid := gen_random_uuid();
begin
  select user_id into v_staff
  from public.admin_staff
  where is_active and role = 'OWNER'
  limit 1;

  select id into v_product
  from public.products
  where is_active and is_available
  limit 1;

  if v_staff is null then raise exception 'No active owner available for checkout shape QA'; end if;
  if v_product is null then raise exception 'No active product available for checkout shape QA'; end if;
  if not exists(select 1 from public.custom_case_templates where id = v_template and is_active) then
    raise exception 'Fixed named custom-case template is unavailable for checkout shape QA';
  end if;

  insert into storage.objects(bucket_id, name, owner_id)
  values
    ('custom-designs', v_staff::text || '/' || v_upload::text || '.png', v_staff::text),
    ('custom-designs', v_staff::text || '/' || v_mixed_upload::text || '.png', v_staff::text);

  insert into public.customer_uploads(
    id, user_id, storage_path, original_filename, mime_type,
    file_size_bytes, upload_type
  ) values
    (v_upload, v_staff, v_staff::text || '/' || v_upload::text || '.png',
      'checkout-upload.png', 'image/png', 68, 'CUSTOM_CASE_DESIGN'),
    (v_mixed_upload, v_staff, v_staff::text || '/' || v_mixed_upload::text || '.png',
      'checkout-mixed-upload.png', 'image/png', 68, 'CUSTOM_CASE_DESIGN');

  insert into checkout_shape_context(
    staff_id, product_id, template_id, upload_order_id, mixed_upload_id
  ) values (
    v_staff, v_product, v_template, v_upload, v_mixed_upload
  );
end;
$setup$;

do $orders$
declare
  q checkout_shape_context%rowtype;
  v_result jsonb;
  v_named_snapshot jsonb;
begin
  select * into q from checkout_shape_context;

  v_named_snapshot := jsonb_build_object(
    'type', 'NAMED_TEMPLATE',
    'templateId', q.template_id,
    'templateName', 'Signature Named Case',
    'templateImagePath', 'custom-case-templates/named-case-fixed-base.png',
    'englishName', 'MALAK',
    'englishColor', '#9FC5F8',
    'englishRenderedText', 'MALAK',
    'englishLayout', 'STACKED',
    'englishStyle', jsonb_build_object('fontKey','ARIAL','textColor','#9FC5F8'),
    'arabicName', 'ملك',
    'arabicColor', '#221B78',
    'arabicRenderedText', 'ملك',
    'arabicStyle', jsonb_build_object('fontKey','TAHOMA','textColor','#221B78')
  );

  -- This reproduces the production failure exactly: an explicit JSON null.
  v_result := public.create_order(
    q.staff_id, 'Shape QA', '01000000001', 'qa@example.com',
    'Cairo', 'Nasr City', 'QA Street', '1', null, null, null, null,
    180, 0, 'CASH_ON_DELIVERY',
    jsonb_build_array(jsonb_build_object(
      'product_id', q.product_id,
      'product_name_snapshot', 'Standard Product',
      'product_image_snapshot', null,
      'material', 'SILICONE',
      'phone_model', 'iPhone 15',
      'custom_phone_model', null,
      'network_type', 'FIVE_G',
      'custom_design_upload_id', null,
      'customization_type', null,
      'custom_template_id', null,
      'customization_snapshot', null,
      'unit_price', 180,
      'quantity', 1,
      'line_total', 180
    )), null, null
  );
  update checkout_shape_context set standard_order_id = (v_result ->> 'order_id')::uuid;

  v_result := public.create_order(
    q.staff_id, 'Shape QA', '01000000001', 'qa@example.com',
    'Cairo', 'Nasr City', 'QA Street', '1', null, null, null, null,
    199, 0, 'CASH_ON_DELIVERY',
    jsonb_build_array(jsonb_build_object(
      'product_id', null,
      'product_name_snapshot', 'Custom Case — Your Design',
      'product_image_snapshot', null,
      'material', 'SILICONE',
      'phone_model', 'iPhone 15',
      'custom_phone_model', null,
      'network_type', 'FIVE_G',
      'custom_design_upload_id', q.upload_order_id,
      'customization_type', 'UPLOAD_DESIGN',
      'custom_template_id', null,
      'customization_snapshot', jsonb_build_object('type','UPLOAD_DESIGN','label','Your uploaded artwork'),
      'unit_price', 199,
      'quantity', 1,
      'line_total', 199
    )), null, null
  );
  update checkout_shape_context set upload_order_result_id = (v_result ->> 'order_id')::uuid;

  v_result := public.create_order(
    q.staff_id, 'Shape QA', '01000000001', 'qa@example.com',
    'Cairo', 'Nasr City', 'QA Street', '1', null, null, null, null,
    239, 0, 'CASH_ON_DELIVERY',
    jsonb_build_array(jsonb_build_object(
      'product_id', null,
      'product_name_snapshot', 'Named Custom Case',
      'product_image_snapshot', '/assets/custom-cases/named/named-custom-case-reference.png',
      'material', 'ACRYLIC',
      'phone_model', 'iPhone 15',
      'custom_phone_model', null,
      'network_type', 'FIVE_G',
      'custom_design_upload_id', null,
      'customization_type', 'NAMED_TEMPLATE',
      'custom_template_id', q.template_id,
      'customization_snapshot', v_named_snapshot,
      'unit_price', 239,
      'quantity', 1,
      'line_total', 239
    )), null, null
  );
  update checkout_shape_context set named_order_id = (v_result ->> 'order_id')::uuid;

  v_result := public.create_order(
    q.staff_id, 'Shape QA', '01000000001', 'qa@example.com',
    'Cairo', 'Nasr City', 'QA Street', '1', null, null, null, null,
    618, 0, 'CASH_ON_DELIVERY',
    jsonb_build_array(
      jsonb_build_object(
        'product_id', q.product_id, 'product_name_snapshot', 'Standard Product',
        'product_image_snapshot', null, 'material', 'SILICONE',
        'phone_model', 'iPhone 15', 'custom_phone_model', null,
        'network_type', 'FIVE_G', 'custom_design_upload_id', null,
        'customization_type', null, 'custom_template_id', null,
        'customization_snapshot', null, 'unit_price', 180,
        'quantity', 1, 'line_total', 180
      ),
      jsonb_build_object(
        'product_id', null, 'product_name_snapshot', 'Custom Case — Your Design',
        'product_image_snapshot', null, 'material', 'SILICONE',
        'phone_model', 'iPhone 15', 'custom_phone_model', null,
        'network_type', 'FIVE_G', 'custom_design_upload_id', q.mixed_upload_id,
        'customization_type', 'UPLOAD_DESIGN', 'custom_template_id', null,
        'customization_snapshot', jsonb_build_object('type','UPLOAD_DESIGN','label','Your uploaded artwork'),
        'unit_price', 199, 'quantity', 1, 'line_total', 199
      ),
      jsonb_build_object(
        'product_id', null, 'product_name_snapshot', 'Named Custom Case',
        'product_image_snapshot', '/assets/custom-cases/named/named-custom-case-reference.png',
        'material', 'ACRYLIC', 'phone_model', 'iPhone 15',
        'custom_phone_model', null, 'network_type', 'FIVE_G',
        'custom_design_upload_id', null, 'customization_type', 'NAMED_TEMPLATE',
        'custom_template_id', q.template_id, 'customization_snapshot', v_named_snapshot,
        'unit_price', 239, 'quantity', 1, 'line_total', 239
      )
    ), null, null
  );
  update checkout_shape_context set mixed_order_id = (v_result ->> 'order_id')::uuid;
end;
$orders$;

select pg_temp.assert_true(
  (select customization_type is null
    and custom_design_upload_id is null
    and custom_template_id is null
    and customization_snapshot is null
   from public.order_items
   where order_id = (select standard_order_id from checkout_shape_context)),
  'standard product normalizes JSON null snapshot to SQL NULL'
);

select pg_temp.assert_true(
  (select customization_type = 'UPLOAD_DESIGN'
    and custom_design_upload_id = (select upload_order_id from checkout_shape_context)
    and custom_template_id is null
    and customization_snapshot ->> 'type' = 'UPLOAD_DESIGN'
   from public.order_items
   where order_id = (select upload_order_result_id from checkout_shape_context)),
  'upload custom case stores the owned upload and immutable snapshot'
);

select pg_temp.assert_true(
  (select customization_type = 'NAMED_TEMPLATE'
    and custom_design_upload_id is null
    and custom_template_id = (select template_id from checkout_shape_context)
    and customization_snapshot ->> 'englishName' = 'MALAK'
    and customization_snapshot ->> 'arabicName' = 'ملك'
    and customization_snapshot ->> 'englishColor' = '#9FC5F8'
    and customization_snapshot ->> 'arabicColor' = '#221B78'
   from public.order_items
   where order_id = (select named_order_id from checkout_shape_context)),
  'fixed named case stores both names, colors, template, and snapshot'
);

select pg_temp.assert_true(
  (select count(*) = 3
   from public.order_items
   where order_id = (select mixed_order_id from checkout_shape_context))
  and
  (select count(distinct coalesce(customization_type, 'STANDARD')) = 3
   from public.order_items
   where order_id = (select mixed_order_id from checkout_shape_context)),
  'mixed cart stores one valid row of every supported shape atomically'
);

select pg_temp.assert_true(
  (select status='PENDING' and expected_amount=90
   from public.payments where order_id=(select standard_order_id from checkout_shape_context))
  and
  (select status='PENDING' and expected_amount=99.50
   from public.payments where order_id=(select upload_order_result_id from checkout_shape_context))
  and
  (select status='PENDING' and expected_amount=119.50
   from public.payments where order_id=(select named_order_id from checkout_shape_context))
  and
  (select status='PENDING' and expected_amount=309
   from public.payments where order_id=(select mixed_order_id from checkout_shape_context)),
  'standard, upload, named, and mixed COD orders receive exact 50 percent deposits'
);

rollback;
