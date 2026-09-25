-- COD deposit payments use the same review lifecycle as InstaPay while
-- preserving NOT_REQUIRED exclusively for historical COD rows.
alter table public.payments
  drop constraint if exists payments_method_status_compatible;

alter table public.payments
  add constraint payments_method_status_compatible check (
    (method = 'INSTAPAY' and status in (
      'PENDING','PENDING_VERIFICATION','VERIFIED','REJECTED','REFUNDED'
    ))
    or
    (method = 'CASH_ON_DELIVERY' and status in (
      'NOT_REQUIRED','PENDING','PENDING_VERIFICATION','VERIFIED','REJECTED','REFUNDED'
    ))
  );
