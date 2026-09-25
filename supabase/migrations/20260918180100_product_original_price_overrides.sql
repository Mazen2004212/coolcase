-- 1. Add original price override columns to products
alter table public.products
  add column silicone_original_price_override integer,
  add column acrylic_original_price_override integer,
  add column double_layer_original_price_override integer;

-- 2. Add constraints to ensure they are strictly positive when provided
alter table public.products
  add constraint products_silicone_original_price_override_positive
  check (
    silicone_original_price_override is null
    or silicone_original_price_override > 0
  ),
  add constraint products_acrylic_original_price_override_positive
  check (
    acrylic_original_price_override is null
    or acrylic_original_price_override > 0
  ),
  add constraint products_double_layer_original_price_override_positive
  check (
    double_layer_original_price_override is null
    or double_layer_original_price_override > 0
  );
