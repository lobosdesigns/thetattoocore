drop policy if exists "Sellers can view merch orders with own items"
  on public.merch_orders;

create policy "Sellers can view merch orders with own items"
  on public.merch_orders for select
  to authenticated
  using (
    exists (
      select 1
      from public.merch_order_items
      where merch_order_items.order_id = merch_orders.id
        and merch_order_items.seller_id = (select auth.uid())
    )
  );
