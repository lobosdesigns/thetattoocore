-- Merch payment and inventory state changes must use trusted server paths.
revoke update on table public.merch_orders from public, anon, authenticated;
grant update on table public.merch_orders to service_role;
