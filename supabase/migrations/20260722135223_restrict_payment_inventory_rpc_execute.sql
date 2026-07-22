revoke execute on function public.reserve_merch_inventory_for_order(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_merch_inventory_for_order(uuid)
  to service_role;

revoke execute on function public.release_merch_inventory_for_order(uuid)
  from public, anon, authenticated;
grant execute on function public.release_merch_inventory_for_order(uuid)
  to service_role;

revoke execute on function public.mark_paid_merch_order_for_checkout(
  text,
  text,
  text,
  jsonb,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.mark_paid_merch_order_for_checkout(
  text,
  text,
  text,
  jsonb,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) to service_role;

revoke execute on function public.spend_ad_credit_for_campaign(uuid)
  from public, anon;
grant execute on function public.spend_ad_credit_for_campaign(uuid)
  to authenticated, service_role;
