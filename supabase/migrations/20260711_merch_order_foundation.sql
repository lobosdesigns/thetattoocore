create type public.merch_order_status as enum (
  'pending_checkout',
  'paid',
  'payment_failed',
  'cancelled',
  'fulfilled',
  'partially_refunded',
  'refunded'
);

create table public.merch_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  status public.merch_order_status not null default 'pending_checkout',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  customer_email text check (
    customer_email is null
    or char_length(customer_email) <= 320
  ),
  shipping_name text check (
    shipping_name is null
    or char_length(shipping_name) <= 160
  ),
  shipping_address jsonb not null default '{}'::jsonb,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merch_orders_total_matches_parts check (
    total_cents = greatest(
      0,
      subtotal_cents + shipping_cents + tax_cents - discount_cents
    )
  )
);

create table public.merch_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.merch_orders(id) on delete cascade,
  product_id uuid references public.merch_products(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  title_snapshot text not null check (char_length(title_snapshot) between 1 and 160),
  sku_snapshot text check (sku_snapshot is null or char_length(sku_snapshot) <= 80),
  quantity integer not null check (quantity > 0 and quantity <= 99),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  fulfillment_status text not null default 'unfulfilled' check (
    fulfillment_status in ('unfulfilled', 'fulfilled', 'cancelled', 'refunded')
  ),
  created_at timestamptz not null default now(),
  constraint merch_order_items_line_total_check
    check (line_total_cents = quantity * unit_price_cents)
);

alter table public.merch_orders enable row level security;
alter table public.merch_order_items enable row level security;

create policy "Buyers and moderators can view merch orders"
  on public.merch_orders for select
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or private.current_user_can_moderate()
  );

create policy "Buyers can create pending merch orders"
  on public.merch_orders for insert
  to authenticated
  with check (
    buyer_id = (select auth.uid())
    and status = 'pending_checkout'
  );

create policy "Moderators can update merch orders"
  on public.merch_orders for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

create policy "Merch order items follow order visibility"
  on public.merch_order_items for select
  to authenticated
  using (
    seller_id = (select auth.uid())
    or private.current_user_can_moderate()
    or
    exists (
      select 1
      from public.merch_orders
      where merch_orders.id = merch_order_items.order_id
        and merch_orders.buyer_id = (select auth.uid())
    )
  );

create policy "Buyers can create pending merch order items"
  on public.merch_order_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.merch_orders
      where merch_orders.id = merch_order_items.order_id
        and merch_orders.buyer_id = (select auth.uid())
        and merch_orders.status = 'pending_checkout'
    )
    and exists (
      select 1
      from public.merch_products
      where merch_products.id = merch_order_items.product_id
        and merch_products.seller_id = merch_order_items.seller_id
        and merch_products.status = 'active'
        and merch_products.currency = merch_order_items.currency
        and merch_products.price_cents = merch_order_items.unit_price_cents
        and merch_products.inventory_quantity - merch_products.inventory_reserved >= merch_order_items.quantity
    )
  );

create policy "Moderators can update merch order items"
  on public.merch_order_items for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

create index merch_orders_buyer_created_idx
  on public.merch_orders (buyer_id, created_at desc);

create index merch_orders_status_created_idx
  on public.merch_orders (status, created_at desc);

create index merch_orders_stripe_checkout_session_idx
  on public.merch_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index merch_order_items_order_idx
  on public.merch_order_items (order_id);

create index merch_order_items_seller_created_idx
  on public.merch_order_items (seller_id, created_at desc);

create index merch_order_items_product_idx
  on public.merch_order_items (product_id);

grant select, insert, update on public.merch_orders to authenticated;
grant select, insert, update on public.merch_order_items to authenticated;
