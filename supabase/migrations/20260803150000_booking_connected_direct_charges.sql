alter table public.booking_requests
  add column if not exists fee_payer text not null default 'client',
  add column if not exists payment_charge_model text not null default 'platform',
  add column if not exists stripe_connected_account_id text,
  add column if not exists stripe_application_fee_id text,
  add column if not exists refunded_amount_cents integer not null default 0,
  add column if not exists refunded_platform_fee_cents integer not null default 0;

update public.booking_requests
set refunded_amount_cents = total_cents
where payment_status = 'refunded'
  and refunded_amount_cents = 0;

alter table public.booking_requests
  drop constraint if exists booking_requests_money_check,
  drop constraint if exists booking_requests_fee_payer_check,
  drop constraint if exists booking_requests_payment_charge_model_check,
  drop constraint if exists booking_requests_connected_account_id_check,
  drop constraint if exists booking_requests_application_fee_id_check,
  drop constraint if exists booking_requests_charge_routing_check,
  drop constraint if exists booking_requests_payment_status_check,
  drop constraint if exists booking_requests_refund_amounts_check;

alter table public.booking_requests
  add constraint booking_requests_fee_payer_check
    check (fee_payer in ('client', 'provider')),
  add constraint booking_requests_payment_charge_model_check
    check (payment_charge_model in ('platform', 'connected_direct')),
  add constraint booking_requests_connected_account_id_check
    check (
      stripe_connected_account_id is null
      or stripe_connected_account_id ~ '^acct_[A-Za-z0-9]{8,200}$'
    ),
  add constraint booking_requests_application_fee_id_check
    check (
      stripe_application_fee_id is null
      or stripe_application_fee_id ~ '^fee_[A-Za-z0-9]{8,200}$'
    ),
  add constraint booking_requests_payment_status_check check (
    payment_status in (
      'not_ready',
      'checkout_started',
      'paid',
      'payment_failed',
      'partially_refunded',
      'refunded',
      'waived'
    )
  ),
  add constraint booking_requests_refund_amounts_check check (
    refunded_amount_cents between 0 and total_cents
    and refunded_platform_fee_cents between 0 and platform_fee_cents
    and (
      payment_status = 'refunded'
      or total_cents = 0
      or refunded_amount_cents < total_cents
    )
    and (
      payment_status <> 'refunded'
      or refunded_amount_cents = total_cents
    )
    and (
      payment_status <> 'partially_refunded'
      or refunded_amount_cents between 1 and total_cents - 1
    )
  ),
  add constraint booking_requests_money_check check (
    deposit_amount_cents between 0 and 500000
    and platform_fee_cents >= 0
    and (
      (
        payment_charge_model = 'platform'
        and fee_payer = 'client'
        and total_cents = deposit_amount_cents + platform_fee_cents
      )
      or (
        payment_charge_model = 'connected_direct'
        and fee_payer = 'provider'
        and total_cents = deposit_amount_cents
        and (deposit_amount_cents = 0 or deposit_amount_cents >= 50)
        and platform_fee_cents = case
          when deposit_amount_cents = 0 then 0
          else (deposit_amount_cents * 2 + 99) / 100
        end
        and platform_fee_cents < greatest(deposit_amount_cents, 1)
      )
    )
  ),
  add constraint booking_requests_charge_routing_check check (
    (
      payment_charge_model = 'platform'
      and stripe_connected_account_id is null
      and stripe_application_fee_id is null
    )
    or (
      payment_charge_model = 'connected_direct'
      and (
        payment_status not in (
          'checkout_started',
          'paid',
          'partially_refunded',
          'refunded'
        )
        or stripe_connected_account_id is not null
      )
    )
  );

create or replace function private.protect_booking_connected_routing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed_checkout_release boolean;
  trusted_service boolean;
  v_claims jsonb;
  v_request_role text;
begin
  v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_request_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    v_claims ->> 'role'
  );
  trusted_service := current_user in ('postgres', 'supabase_admin', 'service_role')
    or v_request_role = 'service_role';

  allowed_checkout_release :=
    trusted_service
    and old.payment_charge_model = 'connected_direct'
    and old.stripe_connected_account_id is not null
    and old.payment_status = 'checkout_started'
    and old.status = 'deposit_pending'
    and new.payment_status in ('not_ready', 'payment_failed')
    and new.status in ('accepted', 'rescheduled')
    and new.stripe_checkout_session_id is null
    and new.stripe_connected_account_id is null
    and new.artist_id = old.artist_id
    and new.client_id = old.client_id
    and new.currency = old.currency
    and new.fee_payer = old.fee_payer
    and new.payment_charge_model = old.payment_charge_model
    and new.deposit_amount_cents = old.deposit_amount_cents
    and new.platform_fee_cents = old.platform_fee_cents
    and new.total_cents = old.total_cents
    and new.stripe_application_fee_id is not distinct from old.stripe_application_fee_id
    and new.refunded_amount_cents = old.refunded_amount_cents
    and new.refunded_platform_fee_cents = old.refunded_platform_fee_cents
    and (
      old.stripe_checkout_session_id is null
      or new.payment_status = 'payment_failed'
    );

  if
    not trusted_service
    and new.stripe_connected_account_id is distinct from old.stripe_connected_account_id
  then
    raise exception 'connected account routing can only be updated by trusted services'
      using errcode = '42501';
  end if;

  if
    not trusted_service
    and new.stripe_application_fee_id is distinct from old.stripe_application_fee_id
  then
    raise exception 'connected application fee identity can only be updated by trusted services'
      using errcode = '42501';
  end if;

  if
    not trusted_service
    and (
      new.refunded_amount_cents is distinct from old.refunded_amount_cents
      or new.refunded_platform_fee_cents is distinct from old.refunded_platform_fee_cents
    )
  then
    raise exception 'booking refund totals can only be updated by trusted services'
      using errcode = '42501';
  end if;

  if
    new.refunded_amount_cents < old.refunded_amount_cents
    or new.refunded_platform_fee_cents < old.refunded_platform_fee_cents
  then
    raise exception 'booking refund totals cannot decrease'
      using errcode = '23514';
  end if;

  if
    old.stripe_connected_account_id is not null
    and not allowed_checkout_release
    and (
      new.artist_id is distinct from old.artist_id
      or new.client_id is distinct from old.client_id
      or new.currency is distinct from old.currency
      or new.fee_payer is distinct from old.fee_payer
      or new.payment_charge_model is distinct from old.payment_charge_model
      or new.deposit_amount_cents is distinct from old.deposit_amount_cents
      or new.platform_fee_cents is distinct from old.platform_fee_cents
      or new.total_cents is distinct from old.total_cents
      or new.stripe_connected_account_id is distinct from old.stripe_connected_account_id
    )
  then
    raise exception 'connected charge routing is immutable'
      using errcode = 'P0001';
  end if;

  if
    old.stripe_application_fee_id is not null
    and new.stripe_application_fee_id is distinct from old.stripe_application_fee_id
  then
    raise exception 'connected application fee identity is immutable'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists booking_requests_protect_connected_routing
  on public.booking_requests;
create trigger booking_requests_protect_connected_routing
before update on public.booking_requests
for each row execute function private.protect_booking_connected_routing();

drop function if exists public.reserve_booking_deposit_checkout(uuid, uuid);

create or replace function public.reserve_booking_deposit_checkout(
  p_booking_id uuid,
  p_client_id uuid,
  p_connected_account_id text
)
returns setof public.booking_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.booking_requests%rowtype;
  v_from_status text;
begin
  if p_connected_account_id !~ '^acct_[A-Za-z0-9]{8,200}$' then
    return;
  end if;

  select booking.*
  into v_booking
  from public.booking_requests as booking
  join public.profiles as recipient
    on recipient.id = booking.artist_id
  join public.stripe_connect_accounts as connected
    on connected.profile_id = booking.artist_id
    and connected.stripe_account_id = p_connected_account_id
  where booking.id = p_booking_id
    and booking.client_id = p_client_id
    and booking.status in ('accepted', 'rescheduled')
    and booking.payment_status in ('not_ready', 'payment_failed')
    and booking.stripe_checkout_session_id is null
    and booking.stripe_connected_account_id is null
    and not booking.payment_dispute_hold
    and booking.payment_charge_model = 'connected_direct'
    and booking.fee_payer = 'provider'
    and booking.deposit_amount_cents >= 50
    and booking.total_cents = booking.deposit_amount_cents
    and booking.platform_fee_cents = (booking.deposit_amount_cents * 2 + 99) / 100
    and connected.livemode is not null
    and connected.charges_enabled
    and connected.payouts_enabled
    and connected.details_submitted
    and connected.disabled_reason is null
    and connected.requirements_currently_due = '[]'::jsonb
    and recipient.account_type in ('artist', 'studio')
    and recipient.license_verified_at is not null
    and recipient.suspended_at is null
    and recipient.banned_at is null
    and (
      booking.shop_profile_id is null
      or (
        recipient.account_type = 'studio'
        and booking.shop_profile_id = recipient.id
      )
      or (
        recipient.account_type = 'artist'
        and recipient.shop_profile_id = booking.shop_profile_id
      )
    )
  for update of booking, recipient, connected;

  if not found then
    return;
  end if;

  v_from_status := v_booking.status;

  update public.booking_requests as booking
  set
    payment_status = 'checkout_started',
    status = 'deposit_pending',
    stripe_checkout_session_id = null,
    stripe_connected_account_id = p_connected_account_id,
    status_changed_at = now(),
    updated_at = now()
  where booking.id = v_booking.id
  returning booking.* into v_booking;

  insert into public.booking_status_events (
    actor_id,
    booking_id,
    from_status,
    note,
    to_status
  ) values (
    p_client_id,
    v_booking.id,
    v_from_status,
    'Deposit checkout reserved.',
    'deposit_pending'
  );

  return next v_booking;
end;
$$;

revoke all on function public.reserve_booking_deposit_checkout(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_booking_deposit_checkout(uuid, uuid, text)
  to service_role;

revoke all on table public.stripe_connect_accounts from anon, authenticated;
drop policy if exists "Owners can view own Stripe Connect account"
  on public.stripe_connect_accounts;
drop policy if exists "Moderators can view Stripe Connect accounts"
  on public.stripe_connect_accounts;
grant select, insert, update, delete on table public.stripe_connect_accounts
  to service_role;

revoke select on table public.booking_requests from authenticated;
do $$
declare
  safe_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into safe_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'booking_requests'
    and column_name not in (
      'stripe_application_fee_id',
      'stripe_connected_account_id'
    );

  execute format(
    'grant select (%s) on table public.booking_requests to authenticated',
    safe_columns
  );
end;
$$;

create index if not exists booking_requests_connected_account_payment_idx
  on public.booking_requests (
    stripe_connected_account_id,
    payment_status,
    updated_at desc
  )
  where stripe_connected_account_id is not null;

create index if not exists booking_requests_application_fee_idx
  on public.booking_requests (stripe_application_fee_id)
  where stripe_application_fee_id is not null;

alter table public.stripe_webhook_events
  add column if not exists account_scope text not null default 'platform';

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_account_scope_check,
  add constraint stripe_webhook_events_account_scope_check check (
    account_scope = 'platform'
    or account_scope ~ '^acct_[A-Za-z0-9]{8,200}$'
  );

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_pkey,
  add primary key (event_id, account_scope);

create index if not exists stripe_webhook_events_account_scope_received_idx
  on public.stripe_webhook_events (account_scope, received_at desc);

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_account_scope text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
  existing_status text;
  existing_claimed_at timestamptz;
begin
  if
    p_account_scope <> 'platform'
    and p_account_scope !~ '^acct_[A-Za-z0-9]{8,200}$'
  then
    raise exception 'invalid webhook account scope'
      using errcode = '22023';
  end if;

  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    account_scope,
    status,
    claimed_at,
    completed_at,
    attempt_count,
    last_error
  ) values (
    p_event_id,
    p_event_type,
    p_account_scope,
    'processing',
    now(),
    null,
    1,
    null
  )
  on conflict (event_id, account_scope) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    return 'claimed';
  end if;

  select status, claimed_at
  into existing_status, existing_claimed_at
  from public.stripe_webhook_events
  where event_id = p_event_id
    and account_scope = p_account_scope
  for update;

  if existing_status = 'processed' then
    return 'processed';
  end if;

  if
    existing_status = 'processing'
    and existing_claimed_at > now() - interval '10 minutes'
  then
    return 'processing';
  end if;

  update public.stripe_webhook_events
  set
    event_type = p_event_type,
    status = 'processing',
    claimed_at = now(),
    completed_at = null,
    attempt_count = least(attempt_count + 1, 1000),
    last_error = null
  where event_id = p_event_id
    and account_scope = p_account_scope;

  return 'claimed';
end;
$$;

create or replace function public.complete_stripe_webhook_event(
  p_event_id text,
  p_account_scope text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.stripe_webhook_events
  set
    status = 'processed',
    completed_at = now(),
    last_error = null
  where event_id = p_event_id
    and account_scope = p_account_scope
    and status = 'processing';

  return found;
end;
$$;

create or replace function public.fail_stripe_webhook_event(
  p_event_id text,
  p_error text,
  p_account_scope text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.stripe_webhook_events
  set
    status = 'failed',
    completed_at = null,
    last_error = left(coalesce(nullif(trim(p_error), ''), 'Processing failed.'), 500)
  where event_id = p_event_id
    and account_scope = p_account_scope
    and status = 'processing';

  return found;
end;
$$;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select public.claim_stripe_webhook_event(p_event_id, p_event_type, 'platform')
$$;

create or replace function public.complete_stripe_webhook_event(p_event_id text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select public.complete_stripe_webhook_event(p_event_id, 'platform')
$$;

create or replace function public.fail_stripe_webhook_event(
  p_event_id text,
  p_error text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select public.fail_stripe_webhook_event(p_event_id, p_error, 'platform')
$$;

revoke execute on function public.claim_stripe_webhook_event(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.complete_stripe_webhook_event(text, text)
  from public, anon, authenticated;
revoke execute on function public.fail_stripe_webhook_event(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.claim_stripe_webhook_event(text, text)
  from public, anon, authenticated;
revoke execute on function public.complete_stripe_webhook_event(text)
  from public, anon, authenticated;
revoke execute on function public.fail_stripe_webhook_event(text, text)
  from public, anon, authenticated;

grant execute on function public.claim_stripe_webhook_event(text, text, text)
  to service_role;
grant execute on function public.complete_stripe_webhook_event(text, text)
  to service_role;
grant execute on function public.fail_stripe_webhook_event(text, text, text)
  to service_role;
grant execute on function public.claim_stripe_webhook_event(text, text)
  to service_role;
grant execute on function public.complete_stripe_webhook_event(text)
  to service_role;
grant execute on function public.fail_stripe_webhook_event(text, text)
  to service_role;

-- Rollback requires disabling booking Checkout first. Restore the prior webhook
-- primary key/functions and booking reservation function before dropping the
-- connected-routing columns. Never rewrite historical payment rows in place.
