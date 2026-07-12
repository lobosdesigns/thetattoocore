revoke all on function public.mark_own_merch_order_item_fulfilled(uuid)
  from public, anon, authenticated;

grant execute on function public.mark_own_merch_order_item_fulfilled(uuid)
  to authenticated;
