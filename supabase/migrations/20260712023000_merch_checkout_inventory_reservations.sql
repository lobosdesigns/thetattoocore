create or replace function public.reserve_merch_inventory_for_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_short_product_id uuid;
begin
  select ordered.product_id
  into v_short_product_id
  from (
    select
      product_id,
      sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
  ) as ordered
  join public.merch_products as product
    on product.id = ordered.product_id
  where product.inventory_quantity - product.inventory_reserved < ordered.quantity
  limit 1
  for update of product;

  if v_short_product_id is not null then
    raise exception 'Insufficient available inventory for merch product %', v_short_product_id
      using errcode = 'P0001';
  end if;

  update public.merch_products as product
  set
    inventory_reserved = product.inventory_reserved + ordered.quantity,
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

create or replace function public.release_merch_inventory_for_order(
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
    inventory_reserved = greatest(
      0,
      product.inventory_reserved - ordered.quantity
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

create or replace function public.mark_paid_merch_order_for_checkout(
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_customer_email text,
  p_shipping_address jsonb,
  p_shipping_name text,
  p_platform_fee_cents integer,
  p_subtotal_cents integer,
  p_shipping_cents integer,
  p_tax_cents integer,
  p_discount_cents integer,
  p_total_cents integer
)
returns table(id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.merch_orders%rowtype;
  v_now timestamptz := now();
  v_short_product_id uuid;
begin
  select *
  into v_order
  from public.merch_orders
  where stripe_checkout_session_id = p_checkout_session_id
  for update;

  if not found then
    return;
  end if;

  if v_order.status in ('paid', 'fulfilled') then
    id := v_order.id;
    return next;
    return;
  end if;

  if v_order.inventory_decremented_at is not null then
    id := v_order.id;
    return next;
    return;
  end if;

  select ordered.product_id
  into v_short_product_id
  from (
    select
      product_id,
      sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = v_order.id
      and product_id is not null
    group by product_id
  ) as ordered
  join public.merch_products as product
    on product.id = ordered.product_id
  where product.inventory_quantity < ordered.quantity
  limit 1
  for update of product;

  if v_short_product_id is not null then
    raise exception 'Insufficient inventory for merch product %', v_short_product_id
      using errcode = 'P0001';
  end if;

  update public.merch_products as product
  set
    inventory_quantity = product.inventory_quantity - ordered.quantity,
    inventory_reserved = greatest(
      0,
      product.inventory_reserved - ordered.quantity
    ),
    updated_at = v_now
  from (
    select
      product_id,
      sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = v_order.id
      and product_id is not null
    group by product_id
  ) as ordered
  where product.id = ordered.product_id;

  update public.merch_orders
  set
    customer_email = p_customer_email,
    shipping_address = coalesce(p_shipping_address, '{}'::jsonb),
    shipping_name = p_shipping_name,
    status = 'paid',
    stripe_payment_intent_id = p_payment_intent_id,
    platform_fee_cents = greatest(0, coalesce(p_platform_fee_cents, 0)),
    subtotal_cents = greatest(0, coalesce(p_subtotal_cents, 0)),
    shipping_cents = greatest(0, coalesce(p_shipping_cents, 0)),
    tax_cents = greatest(0, coalesce(p_tax_cents, 0)),
    discount_cents = greatest(0, coalesce(p_discount_cents, 0)),
    total_cents = greatest(0, coalesce(p_total_cents, 0)),
    inventory_decremented_at = v_now,
    updated_at = v_now
  where merch_orders.id = v_order.id;

  id := v_order.id;
  return next;
end;
$$;

revoke all on function public.reserve_merch_inventory_for_order(uuid) from public;
revoke all on function public.release_merch_inventory_for_order(uuid) from public;
revoke all on function public.mark_paid_merch_order_for_checkout(
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
) from public;

grant execute on function public.reserve_merch_inventory_for_order(uuid) to service_role;
grant execute on function public.release_merch_inventory_for_order(uuid) to service_role;
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
