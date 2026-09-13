-- Deterministic reference data only. No users, products, orders, or statistics.

insert into public.categories (name, slug, display_order)
values
  ('iPhone Cases', 'iphone-cases', 10),
  ('Samsung Cases', 'samsung-cases', 20),
  ('Custom Cases', 'custom-cases', 30),
  ('Clear Cases', 'clear-cases', 40),
  ('Tough Cases', 'tough-cases', 50),
  ('MagSafe', 'magsafe', 60),
  ('Accessories', 'accessories', 70)
on conflict (slug) do nothing;

insert into public.store_settings (key, value, is_public)
values
  ('silicone_price', '150'::jsonb, true),
  ('acrylic_price', '200'::jsonb, true),
  ('shipping_fee', '50'::jsonb, true),
  ('currency', '"EGP"'::jsonb, true)
on conflict (key) do nothing;
