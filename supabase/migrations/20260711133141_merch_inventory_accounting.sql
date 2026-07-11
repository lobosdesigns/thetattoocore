create or replace function public.decrement_merch_inventory_for_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.merch_products as product
  set
    inventory_quantity = greatest(
      0,
      product.inventory_quantity - ordered.quantity
    ),
    updated_at = now()
  from (
    select
      product_id,
      sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
  ) as ordered
  where product.id = ordered.product_id;
end;
$$;

revoke all on function public.decrement_merch_inventory_for_order(uuid)
  from public;
grant execute on function public.decrement_merch_inventory_for_order(uuid)
  to service_role;
