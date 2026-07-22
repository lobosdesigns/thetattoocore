alter table public.merch_orders
  add column if not exists payment_dispute_hold boolean not null default false,
  add column if not exists payment_dispute_status text,
  add column if not exists payment_dispute_updated_at timestamptz;

alter table public.ad_campaigns
  add column if not exists payment_dispute_hold boolean not null default false,
  add column if not exists payment_dispute_status text,
  add column if not exists payment_dispute_updated_at timestamptz;

alter table public.booking_requests
  add column if not exists payment_dispute_hold boolean not null default false,
  add column if not exists payment_dispute_status text,
  add column if not exists payment_dispute_updated_at timestamptz;

alter table public.merch_orders
  drop constraint if exists merch_orders_payment_dispute_status_check,
  add constraint merch_orders_payment_dispute_status_check check (
    payment_dispute_status is null
    or (
      char_length(trim(payment_dispute_status)) between 1 and 80
      and payment_dispute_status = trim(payment_dispute_status)
    )
  );

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_payment_dispute_status_check,
  add constraint ad_campaigns_payment_dispute_status_check check (
    payment_dispute_status is null
    or (
      char_length(trim(payment_dispute_status)) between 1 and 80
      and payment_dispute_status = trim(payment_dispute_status)
    )
  );

alter table public.booking_requests
  drop constraint if exists booking_requests_payment_dispute_status_check,
  add constraint booking_requests_payment_dispute_status_check check (
    payment_dispute_status is null
    or (
      char_length(trim(payment_dispute_status)) between 1 and 80
      and payment_dispute_status = trim(payment_dispute_status)
    )
  );

create index if not exists merch_orders_payment_dispute_hold_idx
  on public.merch_orders (payment_dispute_updated_at desc)
  where payment_dispute_hold;

create index if not exists ad_campaigns_payment_dispute_hold_idx
  on public.ad_campaigns (payment_dispute_updated_at desc)
  where payment_dispute_hold;

create index if not exists booking_requests_payment_dispute_hold_idx
  on public.booking_requests (payment_dispute_updated_at desc)
  where payment_dispute_hold;

create or replace function private.prevent_untrusted_payment_dispute_field_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claims jsonb;
  v_request_role text;
begin
  v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_request_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    v_claims ->> 'role'
  );

  if current_user in ('postgres', 'supabase_admin', 'service_role')
    or v_request_role = 'service_role'
  then
    return new;
  end if;

  raise exception 'Payment review fields can only be updated by trusted services.'
    using errcode = '42501';
end;
$$;

revoke all on function private.prevent_untrusted_payment_dispute_field_changes()
  from public, anon, authenticated;

drop trigger if exists protect_merch_order_payment_dispute_fields
  on public.merch_orders;
create trigger protect_merch_order_payment_dispute_fields
before update of payment_dispute_hold, payment_dispute_status, payment_dispute_updated_at
on public.merch_orders
for each row execute function private.prevent_untrusted_payment_dispute_field_changes();

drop trigger if exists protect_ad_campaign_payment_dispute_fields
  on public.ad_campaigns;
create trigger protect_ad_campaign_payment_dispute_fields
before update of payment_dispute_hold, payment_dispute_status, payment_dispute_updated_at
on public.ad_campaigns
for each row execute function private.prevent_untrusted_payment_dispute_field_changes();

drop trigger if exists protect_booking_request_payment_dispute_fields
  on public.booking_requests;
create trigger protect_booking_request_payment_dispute_fields
before update of payment_dispute_hold, payment_dispute_status, payment_dispute_updated_at
on public.booking_requests
for each row execute function private.prevent_untrusted_payment_dispute_field_changes();

drop policy if exists "Active ads are publicly readable" on public.ad_campaigns;
create policy "Active ads are publicly readable"
  on public.ad_campaigns for select
  using (
    status = 'active'
    and payment_status in ('paid', 'waived')
    and not payment_dispute_hold
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "Active ad placements are publicly readable"
  on public.ad_campaign_placements;
create policy "Active ad placements are publicly readable"
  on public.ad_campaign_placements for select
  using (
    exists (
      select 1
      from public.ad_campaigns
      where ad_campaigns.id = ad_campaign_placements.campaign_id
        and ad_campaigns.status = 'active'
        and ad_campaigns.payment_status in ('paid', 'waived')
        and not ad_campaigns.payment_dispute_hold
        and (ad_campaigns.starts_at is null or ad_campaigns.starts_at <= now())
        and (ad_campaigns.ends_at is null or ad_campaigns.ends_at > now())
    )
  );

drop policy if exists "Ad events can be created" on public.ad_events;
create policy "Ad events can be created"
  on public.ad_events for insert
  with check (
    exists (
      select 1
      from public.ad_campaigns
      where ad_campaigns.id = ad_events.campaign_id
        and ad_campaigns.status = 'active'
        and ad_campaigns.payment_status in ('paid', 'waived')
        and not ad_campaigns.payment_dispute_hold
        and (ad_campaigns.starts_at is null or ad_campaigns.starts_at <= now())
        and (ad_campaigns.ends_at is null or ad_campaigns.ends_at > now())
    )
  );

create or replace function public.mark_own_merch_order_item_fulfilled(
  p_order_item_id uuid,
  p_tracking_carrier text,
  p_tracking_number text,
  p_tracking_url text
)
returns table(order_id uuid, all_items_fulfilled boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_status public.merch_order_status;
  v_payment_dispute_hold boolean;
  v_all_items_fulfilled boolean;
begin
  select item.order_id, merch_order.status, merch_order.payment_dispute_hold
  into v_order_id, v_order_status, v_payment_dispute_hold
  from public.merch_order_items as item
  join public.merch_orders as merch_order
    on merch_order.id = item.order_id
  where item.id = p_order_item_id
    and item.seller_id = (select auth.uid())
  for update of item, merch_order;

  if v_order_id is null then
    raise exception 'Merch sale was not found for the current seller.'
      using errcode = 'P0001';
  end if;

  if v_payment_dispute_hold then
    raise exception 'This order is under payment review and cannot be fulfilled yet.'
      using errcode = 'P0001';
  end if;

  if v_order_status <> 'paid' then
    raise exception 'Only paid merch orders can be marked fulfilled by sellers.'
      using errcode = 'P0001';
  end if;

  update public.merch_order_items as item
  set
    fulfillment_status = 'fulfilled',
    seller_fulfilled_at = coalesce(item.seller_fulfilled_at, now()),
    tracking_carrier = nullif(trim(coalesce(p_tracking_carrier, '')), ''),
    tracking_number = nullif(trim(coalesce(p_tracking_number, '')), ''),
    tracking_url = nullif(trim(coalesce(p_tracking_url, '')), '')
  where item.id = p_order_item_id
    and item.seller_id = (select auth.uid())
    and item.fulfillment_status = 'unfulfilled';

  select not exists (
    select 1
    from public.merch_order_items as item
    where item.order_id = v_order_id
      and item.fulfillment_status <> 'fulfilled'
  )
  into v_all_items_fulfilled;

  if v_all_items_fulfilled then
    update public.merch_orders as merch_order
    set
      fulfilled_at = coalesce(merch_order.fulfilled_at, now()),
      status = 'fulfilled',
      updated_at = now()
    where merch_order.id = v_order_id
      and merch_order.status = 'paid';
  else
    update public.merch_orders as merch_order
    set updated_at = now()
    where merch_order.id = v_order_id;
  end if;

  order_id := v_order_id;
  all_items_fulfilled := v_all_items_fulfilled;
  return next;
end;
$$;

revoke all on function public.mark_own_merch_order_item_fulfilled(
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.mark_own_merch_order_item_fulfilled(
  uuid,
  text,
  text,
  text
) to authenticated;
