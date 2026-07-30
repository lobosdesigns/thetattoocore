\set ON_ERROR_STOP on

begin;

create extension if not exists pgcrypto;
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema private;

create type public.ad_campaign_status as enum (
  'draft',
  'pending_review',
  'approved',
  'active',
  'paused',
  'rejected',
  'archived'
);
create type public.merch_product_status as enum (
  'draft',
  'pending_review',
  'approved',
  'active',
  'paused',
  'rejected',
  'archived'
);
create type public.merch_order_status as enum (
  'pending_checkout',
  'paid',
  'payment_failed',
  'fulfilled',
  'cancelled',
  'refunded'
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  summary text,
  target_id uuid,
  target_type text,
  created_at timestamptz not null default now()
);

create table public.mail_settings (
  id uuid primary key default gen_random_uuid(),
  from_name text not null
);

create table public.ad_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  actor_id uuid,
  amount_cents integer not null,
  credit_reason text not null,
  note text,
  expires_at timestamptz
);

create table public.ad_campaigns (
  id uuid primary key,
  campaign_type text not null,
  goal text not null,
  status public.ad_campaign_status not null,
  payment_status text not null,
  payment_dispute_hold boolean not null default false,
  prepaid_amount_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  reviewed_at timestamptz,
  reviewed_by uuid,
  reviewer_note text,
  updated_at timestamptz not null default now()
);

create table public.merch_products (
  id uuid primary key,
  category text not null,
  currency text not null,
  price_cents integer not null,
  status public.merch_product_status not null,
  reviewed_at timestamptz,
  reviewed_by uuid,
  reviewer_note text,
  updated_at timestamptz not null default now()
);

create table public.merch_orders (
  id uuid primary key,
  buyer_id uuid not null,
  status public.merch_order_status not null,
  inventory_reservation_status text not null,
  currency text not null,
  total_cents integer not null,
  admin_note text,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.merch_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  fulfillment_status text not null
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function private.current_user_can_admin()
returns boolean
language sql
stable
as $$
  select current_setting('request.jwt.claim.role', true) in ('admin', 'owner')
$$;

create function private.current_user_can_moderate()
returns boolean
language sql
stable
as $$
  select current_setting('request.jwt.claim.role', true)
    in ('moderator', 'admin', 'owner')
$$;

create function private.current_user_is_owner()
returns boolean
language sql
stable
as $$
  select current_setting('request.jwt.claim.role', true) = 'owner'
$$;

create function public.cancel_unpaid_merch_order(
  p_order_id uuid,
  p_admin_note text default null
)
returns table(id uuid, buyer_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.merch_orders%rowtype;
begin
  select *
  into v_order
  from public.merch_orders
  where merch_orders.id = p_order_id
  for update;

  if not found or v_order.status = 'cancelled' then
    return;
  end if;

  update public.merch_orders
  set
    admin_note = left(nullif(trim(p_admin_note), ''), 1000),
    cancelled_at = now(),
    status = 'cancelled',
    updated_at = now()
  where merch_orders.id = v_order.id;

  update public.merch_order_items
  set fulfillment_status = 'cancelled'
  where order_id = v_order.id;

  id := v_order.id;
  buyer_id := v_order.buyer_id;
  return next;
end;
$$;

\ir ../supabase/migrations/20260730120000_harden_privileged_admin_policies.sql
\ir ../supabase/migrations/20260730123000_enforce_admin_operation_idempotency.sql

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  false
);
select set_config('request.jwt.claim.role', 'admin', false);

do $$
declare
  first_result boolean;
  second_result boolean;
begin
  select public.grant_admin_ad_credit(
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000020',
    2500,
    'promo',
    'Fixture credit',
    null
  ) into first_result;
  select public.grant_admin_ad_credit(
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000020',
    2500,
    'promo',
    'Fixture credit',
    null
  ) into second_result;

  if first_result is distinct from true or second_result is distinct from false then
    raise exception 'Ad credit duplicate result contract failed.';
  end if;

  if (select count(*) from public.ad_credit_ledger) <> 1 then
    raise exception 'Ad credit duplicate ledger write detected.';
  end if;

  if (
    select count(*)
    from public.admin_audit_logs
    where event_type = 'user_ad_credit_granted'
  ) <> 1 then
    raise exception 'Ad credit duplicate audit write detected.';
  end if;
end;
$$;

insert into public.ad_campaigns (
  id,
  campaign_type,
  goal,
  status,
  payment_status
)
values
  (
    '00000000-0000-4000-8000-000000000030',
    'artist_growth',
    'engagement',
    'pending_review',
    'waived'
  ),
  (
    '00000000-0000-4000-8000-000000000031',
    'artist_growth',
    'engagement',
    'approved',
    'unpaid'
  );

do $$
declare
  first_result boolean;
  second_result boolean;
begin
  select public.admin_update_ad_campaign_status(
    '00000000-0000-4000-8000-000000000030',
    'pending_review',
    'approved',
    'Fixture review'
  ) into first_result;
  select public.admin_update_ad_campaign_status(
    '00000000-0000-4000-8000-000000000030',
    'approved',
    'approved',
    'Fixture review'
  ) into second_result;

  if first_result is distinct from true or second_result is distinct from false then
    raise exception 'Campaign status duplicate result contract failed.';
  end if;

  select public.admin_grant_ad_campaign_credit(
    '00000000-0000-4000-8000-000000000031',
    'unpaid',
    0,
    5000,
    'sponsor',
    'Fixture waiver'
  ) into first_result;
  select public.admin_grant_ad_campaign_credit(
    '00000000-0000-4000-8000-000000000031',
    'waived',
    5000,
    5000,
    'sponsor',
    'Fixture waiver'
  ) into second_result;

  if first_result is distinct from true or second_result is distinct from false then
    raise exception 'Campaign credit duplicate result contract failed.';
  end if;

  if (
    select count(*)
    from public.admin_audit_logs
    where event_type in ('ad_campaign_approved', 'ad_campaign_credit_granted')
  ) <> 2 then
    raise exception 'Campaign duplicate audit write detected.';
  end if;
end;
$$;

insert into public.merch_products (
  id,
  category,
  currency,
  price_cents,
  status
)
values (
  '00000000-0000-4000-8000-000000000040',
  'other',
  'USD',
  4000,
  'pending_review'
);

do $$
declare
  first_result boolean;
  second_result boolean;
begin
  select public.admin_update_merch_product_status(
    '00000000-0000-4000-8000-000000000040',
    'pending_review',
    'approved',
    'Fixture product review'
  ) into first_result;
  select public.admin_update_merch_product_status(
    '00000000-0000-4000-8000-000000000040',
    'approved',
    'approved',
    'Fixture product review'
  ) into second_result;

  if first_result is distinct from true or second_result is distinct from false then
    raise exception 'Merch product duplicate result contract failed.';
  end if;

  if (
    select count(*)
    from public.admin_audit_logs
    where event_type = 'merch_product_approved'
  ) <> 1 then
    raise exception 'Merch product duplicate audit write detected.';
  end if;
end;
$$;

insert into public.merch_orders (
  id,
  buyer_id,
  status,
  inventory_reservation_status,
  currency,
  total_cents
)
values (
  '00000000-0000-4000-8000-000000000050',
  '00000000-0000-4000-8000-000000000020',
  'paid',
  'consumed',
  'USD',
  6000
);
insert into public.merch_order_items (order_id, fulfillment_status)
values
  ('00000000-0000-4000-8000-000000000050', 'pending'),
  ('00000000-0000-4000-8000-000000000050', 'pending');

do $$
declare
  first_result boolean;
  second_result boolean;
begin
  select public.admin_update_merch_order_status(
    '00000000-0000-4000-8000-000000000050',
    'fulfilled',
    'Fixture fulfillment'
  ) into first_result;
  select public.admin_update_merch_order_status(
    '00000000-0000-4000-8000-000000000050',
    'fulfilled',
    'Fixture fulfillment'
  ) into second_result;

  if first_result is distinct from true or second_result is distinct from false then
    raise exception 'Merch order duplicate result contract failed.';
  end if;

  if (
    select count(*)
    from public.merch_order_items
    where fulfillment_status = 'fulfilled'
  ) <> 2 then
    raise exception 'Merch order items were not updated atomically.';
  end if;

  if (
    select count(*)
    from public.admin_audit_logs
    where event_type = 'merch_order_fulfilled'
  ) <> 1 then
    raise exception 'Merch order duplicate audit write detected.';
  end if;
end;
$$;

select set_config('request.jwt.claim.role', 'user', false);

do $$
begin
  perform public.grant_admin_ad_credit(
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000020',
    100,
    'promo',
    null,
    null
  );
  raise exception 'Ordinary user unexpectedly granted ad credit.';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform public.admin_update_ad_campaign_status(
    '00000000-0000-4000-8000-000000000030',
    'approved',
    'approved',
    null
  );
  raise exception 'Ordinary user unexpectedly reviewed an ad campaign.';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform public.admin_grant_ad_campaign_credit(
    '00000000-0000-4000-8000-000000000031',
    'waived',
    5000,
    5000,
    'sponsor',
    null
  );
  raise exception 'Ordinary user unexpectedly granted campaign credit.';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform public.admin_update_merch_product_status(
    '00000000-0000-4000-8000-000000000040',
    'approved',
    'approved',
    null
  );
  raise exception 'Ordinary user unexpectedly reviewed a Merch product.';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform public.admin_update_merch_order_status(
    '00000000-0000-4000-8000-000000000050',
    'fulfilled',
    null
  );
  raise exception 'Ordinary user unexpectedly updated a Merch order.';
exception
  when insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.role', 'moderator', false);

do $$
declare
  campaign_result boolean;
  product_result boolean;
begin
  select public.admin_update_ad_campaign_status(
    '00000000-0000-4000-8000-000000000030',
    'approved',
    'approved',
    null
  ) into campaign_result;
  select public.admin_update_merch_product_status(
    '00000000-0000-4000-8000-000000000040',
    'approved',
    'approved',
    null
  ) into product_result;

  if campaign_result is distinct from false or product_result is distinct from false then
    raise exception 'Moderator review RPC no-op contract failed.';
  end if;
end;
$$;

do $$
begin
  perform public.grant_admin_ad_credit(
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000020',
    100,
    'promo',
    null,
    null
  );
  raise exception 'Moderator unexpectedly granted user ad credit.';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform public.admin_grant_ad_campaign_credit(
    '00000000-0000-4000-8000-000000000031',
    'waived',
    5000,
    5000,
    'sponsor',
    null
  );
  raise exception 'Moderator unexpectedly granted campaign credit.';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform public.admin_update_merch_order_status(
    '00000000-0000-4000-8000-000000000050',
    'fulfilled',
    null
  );
  raise exception 'Moderator unexpectedly updated a Merch order.';
exception
  when insufficient_privilege then
    null;
end;
$$;

rollback;

\echo 'PASS admin operation idempotency migration compiles and duplicate calls are atomic'
