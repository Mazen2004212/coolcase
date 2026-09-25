alter table public.orders
drop constraint if exists orders_total_matches_components;

alter table public.orders
add constraint orders_total_matches_components
check (
  total_amount =
    subtotal_amount
    - coalesce(discount_amount, 0)
    + shipping_amount
);