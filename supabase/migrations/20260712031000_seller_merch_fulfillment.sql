create or replace function public.mark_own_merch_order_item_fulfilled(
  p_order_item_id uuid
)
returns table(order_id uuid, all_items_fulfilled boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_status public.merch_order_status;
  v_all_items_fulfilled boolean;
begin
  select merch_order_items.order_id, merch_orders.status
  into v_order_id, v_order_status
  from public.merch_order_items
  join public.merch_orders
    on merch_orders.id = merch_order_items.order_id
  where merch_order_items.id = p_order_item_id
    and merch_order_items.seller_id = (select auth.uid())
  for update of merch_order_items, merch_orders;

  if v_order_id is null then
    raise exception 'Merch sale was not found for the current seller.'
      using errcode = 'P0001';
  end if;

  if v_order_status <> 'paid' then
    raise exception 'Only paid merch orders can be marked fulfilled by sellers.'
      using errcode = 'P0001';
  end if;

  update public.merch_order_items
  set fulfillment_status = 'fulfilled'
  where id = p_order_item_id
    and seller_id = (select auth.uid())
    and fulfillment_status = 'unfulfilled';

  select not exists (
    select 1
    from public.merch_order_items
    where merch_order_items.order_id = v_order_id
      and merch_order_items.fulfillment_status <> 'fulfilled'
  )
  into v_all_items_fulfilled;

  if v_all_items_fulfilled then
    update public.merch_orders
    set
      fulfilled_at = coalesce(fulfilled_at, now()),
      status = 'fulfilled',
      updated_at = now()
    where id = v_order_id
      and status = 'paid';
  else
    update public.merch_orders
    set updated_at = now()
    where id = v_order_id;
  end if;

  order_id := v_order_id;
  all_items_fulfilled := v_all_items_fulfilled;
  return next;
end;
$$;

revoke all on function public.mark_own_merch_order_item_fulfilled(uuid) from public, anon, authenticated;
grant execute on function public.mark_own_merch_order_item_fulfilled(uuid) to authenticated;
