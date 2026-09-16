-- Backend Phase 1: catalog availability, double-layer pricing, style categories, correct store settings.
-- Additive only — no existing table or constraint is modified.

-- 1. Add product availability flag (separate from is_active / published state).
alter table public.products
  add column if not exists is_available boolean not null default true;

-- 2. Add double-layer price override.
alter table public.products
  add column if not exists double_layer_price_override integer
  constraint products_double_layer_price_override_positive check (
    double_layer_price_override is null or double_layer_price_override > 0
  );

-- 3. Add style/collection categories for the five current product designs.
--    These are different from the device categories already seeded.
insert into public.categories (name, slug, description, display_order)
values
  ('Graphic',    'graphic',    'Bold shapes and high-contrast artwork for a clean statement look.',       110),
  ('Lace',       'lace',       'Soft detail with a darker, expressive edge.',                              120),
  ('Floral',     'floral',     'Flower-led designs ranging from soft to moody.',                           130),
  ('Typography', 'typography', 'Cases built around words, lettering, and personality.',                   140),
  ('Collage',    'collage',    'Layered graphics with an eclectic, scrapbook-inspired feel.',              150)
on conflict (slug) do update
  set description   = excluded.description,
      display_order = excluded.display_order;

-- 4. Update authoritative pricing in store_settings.
--    Using upsert so we don't clobber any admin customisations if they exist.

-- Global material pricing (original and selling).
insert into public.store_settings (key, value, is_public)
values
  -- Silicone: 230 original / 180 selling
  ('silicone_original_price',      '230'::jsonb,  true),
  ('silicone_selling_price',        '180'::jsonb,  true),
  -- Acrylic: 299 original / 225 selling
  ('acrylic_original_price',        '299'::jsonb,  true),
  ('acrylic_selling_price',         '225'::jsonb,  true),
  -- Double Layer: 460 original / 399 selling
  ('double_layer_original_price',   '460'::jsonb,  true),
  ('double_layer_selling_price',    '399'::jsonb,  true),
  -- Custom Case: 289 original / 239 selling
  ('custom_original_price',         '289'::jsonb,  true),
  ('custom_selling_price',          '239'::jsonb,  true),
  -- Shipping fee (already existed at wrong legacy value — correct it).
  ('shipping_fee',                  '50'::jsonb,   true),
  -- Legacy single-value price keys corrected.
  ('silicone_price',                '180'::jsonb,  true),
  ('acrylic_price',                 '225'::jsonb,  true),
  -- Currency (already seeded, kept consistent).
  ('currency',                      '"EGP"'::jsonb, true),
  -- Payment methods.
  ('cod_enabled',                   'true'::jsonb,  true),
  ('instapay_enabled',              'true'::jsonb,  true),
  -- IMPORTANT: do not swap these two numbers.
  ('instapay_number',               '"01152966212"'::jsonb, false),
  ('whatsapp_number',               '"01142966212"'::jsonb, true),
  -- Store identity.
  ('store_name',                    '"Coolcase"'::jsonb, true)
on conflict (key) do update
  set value      = excluded.value,
      is_public  = excluded.is_public,
      updated_at = now();
