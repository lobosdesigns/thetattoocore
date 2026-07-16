alter table public.merch_products
  add column if not exists fulfillment_notes text,
  add column if not exists return_policy text;

alter table public.merch_products
  drop constraint if exists merch_products_fulfillment_notes_length,
  drop constraint if exists merch_products_return_policy_length;

alter table public.merch_products
  add constraint merch_products_fulfillment_notes_length
    check (
      fulfillment_notes is null
      or char_length(fulfillment_notes) <= 1000
    ),
  add constraint merch_products_return_policy_length
    check (
      return_policy is null
      or char_length(return_policy) <= 1000
    );
