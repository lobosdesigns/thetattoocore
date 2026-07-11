alter table public.merch_orders
  add column if not exists platform_fee_cents integer not null default 0
    check (platform_fee_cents >= 0);

alter table public.merch_orders
  drop constraint if exists merch_orders_total_matches_parts;

alter table public.merch_orders
  add constraint merch_orders_total_matches_parts check (
    total_cents = greatest(
      0,
      subtotal_cents + platform_fee_cents + shipping_cents + tax_cents - discount_cents
    )
  );
