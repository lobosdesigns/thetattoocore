create type public.merch_inventory_reservation_status as enum (
  'unreserved',
  'reserved',
  'released',
  'consumed'
);

alter table public.merch_orders
  add column inventory_reservation_status public.merch_inventory_reservation_status
  not null default 'unreserved';

update public.merch_orders
set inventory_reservation_status = 'consumed'
where status in ('paid', 'fulfilled', 'partially_refunded', 'refunded');

update public.merch_orders
set inventory_reservation_status = 'released'
where status in ('payment_failed', 'cancelled');

alter table public.merch_orders
  add constraint merch_orders_inventory_reservation_status_check
  check (
    (
      status in ('paid', 'fulfilled', 'partially_refunded', 'refunded')
      and inventory_reservation_status = 'consumed'
    )
    or
    (
      status not in ('paid', 'fulfilled', 'partially_refunded', 'refunded')
      and inventory_reservation_status <> 'consumed'
    )
  );

create or replace function public.reserve_merch_inventory_for_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.merch_orders%rowtype;
  v_short_product_id uuid;
begin
  select *
  into v_order
  from public.merch_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Merch order was not found.' using errcode = 'P0002';
  end if;

  if v_order.status <> 'pending_checkout' then
    raise exception 'Merch order is not pending checkout.' using errcode = 'P0001';
  end if;

  if v_order.inventory_reservation_status = 'reserved' then
    return;
  end if;

  if v_order.inventory_reservation_status <> 'unreserved' then
    raise exception 'Merch order inventory cannot be reserved again.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
  ) or exists (
    select 1
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is null
  ) then
    raise exception 'Merch order has no reservable items.' using errcode = 'P0001';
  end if;

  perform product.id
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
  ) as ordered
  join public.merch_products as product
    on product.id = ordered.product_id
  order by product.id
  for update of product;

  select product.id
  into v_short_product_id
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
  ) as ordered
  join public.merch_products as product
    on product.id = ordered.product_id
  where product.status <> 'active'
    or product.inventory_quantity - product.inventory_reserved < ordered.quantity
  order by product.id
  limit 1;

  if v_short_product_id is not null then
    raise exception 'Insufficient available inventory for merch product %', v_short_product_id
      using errcode = 'P0001';
  end if;

  update public.merch_products as product
  set
    inventory_reserved = product.inventory_reserved + ordered.quantity,
    updated_at = now()
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
  ) as ordered
  where product.id = ordered.product_id;

  update public.merch_orders
  set
    inventory_reservation_status = 'reserved',
    updated_at = now()
  where id = p_order_id;
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
declare
  v_order public.merch_orders%rowtype;
  v_invalid_product_id uuid;
begin
  select *
  into v_order
  from public.merch_orders
  where id = p_order_id
  for update;

  if not found or v_order.inventory_reservation_status <> 'reserved' then
    return;
  end if;

  perform product.id
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
  ) as ordered
  join public.merch_products as product
    on product.id = ordered.product_id
  order by product.id
  for update of product;

  select product.id
  into v_invalid_product_id
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
  ) as ordered
  join public.merch_products as product
    on product.id = ordered.product_id
  where product.inventory_reserved < ordered.quantity
  order by product.id
  limit 1;

  if v_invalid_product_id is not null then
    raise exception 'Reserved inventory is inconsistent for merch product %', v_invalid_product_id
      using errcode = 'P0001';
  end if;

  update public.merch_products as product
  set
    inventory_reserved = product.inventory_reserved - ordered.quantity,
    updated_at = now()
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
  ) as ordered
  where product.id = ordered.product_id;

  update public.merch_orders
  set
    inventory_reservation_status = 'released',
    updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.cancel_unpaid_merch_order(
  p_order_id uuid,
  p_admin_note text default null
)
returns table(id uuid, buyer_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.merch_orders%rowtype;
  v_now timestamptz := now();
begin
  select *
  into v_order
  from public.merch_orders
  where merch_orders.id = p_order_id
  for update;

  if not found or v_order.status = 'cancelled' then
    return;
  end if;

  if v_order.status not in ('pending_checkout', 'payment_failed') then
    raise exception 'Only unpaid merch orders can be cancelled.' using errcode = 'P0001';
  end if;

  perform public.release_merch_inventory_for_order(v_order.id);

  update public.merch_orders
  set
    admin_note = left(nullif(trim(p_admin_note), ''), 1000),
    cancelled_at = v_now,
    status = 'cancelled',
    updated_at = v_now
  where merch_orders.id = v_order.id;

  update public.merch_order_items
  set fulfillment_status = 'cancelled'
  where order_id = v_order.id;

  id := v_order.id;
  buyer_id := v_order.buyer_id;
  return next;
end;
$$;

create or replace function public.mark_problem_merch_order_for_checkout(
  p_checkout_session_id text,
  p_status text,
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
returns table(id uuid, buyer_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.merch_orders%rowtype;
  v_now timestamptz := now();
  v_status public.merch_order_status;
begin
  if p_status not in ('cancelled', 'payment_failed') then
    raise exception 'Invalid merch checkout problem status.' using errcode = '22023';
  end if;

  v_status := p_status::public.merch_order_status;

  select *
  into v_order
  from public.merch_orders
  where stripe_checkout_session_id = p_checkout_session_id
  for update;

  if not found or v_order.status <> 'pending_checkout' then
    return;
  end if;

  perform public.release_merch_inventory_for_order(v_order.id);

  update public.merch_orders
  set
    customer_email = p_customer_email,
    shipping_address = coalesce(p_shipping_address, '{}'::jsonb),
    shipping_name = p_shipping_name,
    status = v_status,
    stripe_payment_intent_id = p_payment_intent_id,
    platform_fee_cents = greatest(0, coalesce(p_platform_fee_cents, 0)),
    subtotal_cents = greatest(0, coalesce(p_subtotal_cents, 0)),
    shipping_cents = greatest(0, coalesce(p_shipping_cents, 0)),
    tax_cents = greatest(0, coalesce(p_tax_cents, 0)),
    discount_cents = greatest(0, coalesce(p_discount_cents, 0)),
    total_cents = greatest(0, coalesce(p_total_cents, 0)),
    cancelled_at = case when v_status = 'cancelled' then v_now else cancelled_at end,
    updated_at = v_now
  where merch_orders.id = v_order.id;

  if v_status = 'cancelled' then
    update public.merch_order_items
    set fulfillment_status = 'cancelled'
    where order_id = v_order.id;
  end if;

  id := v_order.id;
  buyer_id := v_order.buyer_id;
  return next;
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

  if not found
    or v_order.status in ('paid', 'fulfilled')
    or v_order.inventory_decremented_at is not null
  then
    return;
  end if;

  if v_order.status <> 'pending_checkout'
    or v_order.inventory_reservation_status <> 'reserved'
  then
    raise exception 'Merch order is not in a payable reserved state.' using errcode = 'P0001';
  end if;

  perform product.id
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = v_order.id
      and product_id is not null
    group by product_id
  ) as ordered
  join public.merch_products as product
    on product.id = ordered.product_id
  order by product.id
  for update of product;

  select product.id
  into v_short_product_id
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.merch_order_items
    where order_id = v_order.id
      and product_id is not null
    group by product_id
  ) as ordered
  join public.merch_products as product
    on product.id = ordered.product_id
  where product.inventory_quantity < ordered.quantity
    or product.inventory_reserved < ordered.quantity
  order by product.id
  limit 1;

  if v_short_product_id is not null then
    raise exception 'Insufficient reserved inventory for merch product %', v_short_product_id
      using errcode = 'P0001';
  end if;

  update public.merch_products as product
  set
    inventory_quantity = product.inventory_quantity - ordered.quantity,
    inventory_reserved = product.inventory_reserved - ordered.quantity,
    updated_at = v_now
  from (
    select product_id, sum(quantity)::integer as quantity
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
    inventory_reservation_status = 'consumed',
    updated_at = v_now
  where merch_orders.id = v_order.id;

  id := v_order.id;
  return next;
end;
$$;

revoke execute on function public.reserve_merch_inventory_for_order(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_merch_inventory_for_order(uuid)
  to service_role;

revoke execute on function public.release_merch_inventory_for_order(uuid)
  from public, anon, authenticated;
grant execute on function public.release_merch_inventory_for_order(uuid)
  to service_role;

revoke execute on function public.cancel_unpaid_merch_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_unpaid_merch_order(uuid, text)
  to service_role;

revoke execute on function public.mark_problem_merch_order_for_checkout(
  text,
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
grant execute on function public.mark_problem_merch_order_for_checkout(
  text,
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
