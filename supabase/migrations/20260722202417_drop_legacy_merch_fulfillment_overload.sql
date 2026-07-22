revoke all on function public.mark_own_merch_order_item_fulfilled(uuid)
  from public, anon, authenticated, service_role;

drop function if exists public.mark_own_merch_order_item_fulfilled(uuid);
