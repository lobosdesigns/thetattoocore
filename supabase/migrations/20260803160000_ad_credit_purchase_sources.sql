alter table public.ad_credit_ledger
  add column if not exists credit_origin text not null default 'promo',
  add column if not exists provider_transaction_id text,
  add column if not exists provider_product_id text,
  add column if not exists refundable_cents integer not null default 0,
  add column if not exists campaign_spent_cents integer,
  add column if not exists purchase_reconciliation_state text
    not null default 'available';

update public.ad_credit_ledger
set campaign_spent_cents = used_cents
where campaign_spent_cents is null;

alter table public.ad_credit_ledger
  alter column campaign_spent_cents set default 0,
  alter column campaign_spent_cents set not null,
  drop constraint if exists ad_credit_ledger_credit_origin_check,
  add constraint ad_credit_ledger_credit_origin_check
    check (credit_origin in ('promo', 'stripe_web', 'apple_iap', 'google_play')),
  drop constraint if exists ad_credit_ledger_campaign_spent_cents_check,
  add constraint ad_credit_ledger_campaign_spent_cents_check
    check (
      campaign_spent_cents >= 0
      and campaign_spent_cents <= used_cents
      and used_cents <= amount_cents
    ),
  drop constraint if exists ad_credit_ledger_refundable_cents_check,
  add constraint ad_credit_ledger_refundable_cents_check
    check (
      refundable_cents >= 0
      and refundable_cents <= amount_cents
      and (
        (credit_origin = 'promo' and refundable_cents = 0)
        or (
          credit_origin in ('stripe_web', 'apple_iap', 'google_play')
          and refundable_cents = amount_cents - used_cents
        )
      )
    ),
  drop constraint if exists ad_credit_ledger_reconciliation_state_check,
  add constraint ad_credit_ledger_reconciliation_state_check
    check (
      purchase_reconciliation_state in (
        'available',
        'held',
        'partially_voided',
        'terminal_void'
      )
      and (
        credit_origin <> 'promo'
        or (
          purchase_reconciliation_state = 'available'
          and campaign_spent_cents = used_cents
        )
      )
    ),
  drop constraint if exists ad_credit_ledger_purchase_source_check,
  add constraint ad_credit_ledger_purchase_source_check
    check (
      (
        credit_origin = 'promo'
        and provider_transaction_id is null
        and provider_product_id is null
        and campaign_spent_cents = used_cents
        and refundable_cents = 0
      )
      or
      (
        credit_origin in ('stripe_web', 'apple_iap', 'google_play')
        and provider_transaction_id is not null
        and char_length(provider_transaction_id) between 1 and 512
        and provider_transaction_id
          ~ '^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$'
        and position('://' in provider_transaction_id) = 0
        and provider_transaction_id !~* '^(not\.)?(is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\.'
        and provider_product_id in (
          'ttc.adcredit.2500',
          'ttc.adcredit.5000',
          'ttc.adcredit.10000'
        )
        and amount_cents = case provider_product_id
          when 'ttc.adcredit.2500' then 2500
          when 'ttc.adcredit.5000' then 5000
          when 'ttc.adcredit.10000' then 10000
        end
        and actor_id is null
        and credit_reason = 'other'
        and expires_at is null
        and status <> 'expired'
        and refundable_cents = amount_cents - used_cents
        and (
          (refundable_cents > 0 and status = 'active')
          or (
            refundable_cents = 0
            and purchase_reconciliation_state = 'available'
            and campaign_spent_cents = amount_cents
            and status = 'spent'
          )
          or (
            refundable_cents = 0
            and purchase_reconciliation_state <> 'available'
            and status = 'voided'
          )
        )
      )
    ),
  drop constraint if exists ad_credit_ledger_provider_transaction_id_key,
  drop constraint if exists ad_credit_ledger_provider_source_key,
  add constraint ad_credit_ledger_provider_source_key
    unique (credit_origin, provider_transaction_id);

alter table public.ad_campaigns
  add column if not exists ad_credit_purchase_hold boolean not null default false,
  add column if not exists ad_credit_purchase_hold_cents integer not null default 0,
  add column if not exists ad_credit_purchase_debt_cents integer not null default 0;

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_ad_credit_purchase_amounts_check,
  add constraint ad_campaigns_ad_credit_purchase_amounts_check check (
    ad_credit_purchase_hold_cents >= 0
    and ad_credit_purchase_debt_cents >= 0
    and ad_credit_purchase_hold = (
      ad_credit_purchase_hold_cents > 0
      or ad_credit_purchase_debt_cents > 0
    )
  );

create table public.ad_credit_purchase_sources (
  id uuid primary key default gen_random_uuid(),
  credit_origin text not null
    check (credit_origin in ('stripe_web', 'apple_iap', 'google_play')),
  provider_transaction_id text not null
    check (
      char_length(provider_transaction_id) between 1 and 512
      and provider_transaction_id
        ~ '^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$'
      and position('://' in provider_transaction_id) = 0
      and provider_transaction_id !~* '^(not\.)?(is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\.'
    ),
  profile_id uuid references public.profiles(id) on delete restrict,
  provider_product_id text,
  credit_amount_cents integer,
  provider_paid_amount_cents integer,
  provider_currency text,
  ledger_id uuid unique references public.ad_credit_ledger(id) on delete restrict,
  lifecycle_state text not null default 'pending'
    check (
      lifecycle_state in (
        'pending',
        'available',
        'held',
        'partially_voided',
        'terminal_void'
      )
    ),
  terminal_void_cents integer not null default 0,
  held_cents integer not null default 0,
  spent_terminal_loss_cents integer not null default 0,
  spent_hold_cents integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (credit_origin, provider_transaction_id),
  check (
    (
      provider_product_id is null
      and credit_amount_cents is null
    )
    or (
      provider_product_id in (
        'ttc.adcredit.2500',
        'ttc.adcredit.5000',
        'ttc.adcredit.10000'
      )
      and credit_amount_cents = case provider_product_id
        when 'ttc.adcredit.2500' then 2500
        when 'ttc.adcredit.5000' then 5000
        when 'ttc.adcredit.10000' then 10000
      end
    )
  ),
  check (
    (
      credit_origin = 'stripe_web'
      and provider_paid_amount_cents = credit_amount_cents
      and provider_paid_amount_cents > 0
      and provider_currency = 'usd'
    )
    or (
      credit_origin in ('apple_iap', 'google_play')
      and provider_paid_amount_cents is null
      and provider_currency is null
    )
  ),
  check (
    terminal_void_cents >= 0
    and held_cents >= 0
    and spent_terminal_loss_cents >= 0
    and spent_hold_cents >= 0
    and (
      credit_amount_cents is null
      or (
        terminal_void_cents <= credit_amount_cents
        and held_cents <= credit_amount_cents - terminal_void_cents
        and spent_terminal_loss_cents <= terminal_void_cents
        and spent_hold_cents <= held_cents
      )
    )
  )
);

create table public.ad_credit_purchase_lifecycles (
  id uuid primary key default gen_random_uuid(),
  purchase_source_id uuid not null
    references public.ad_credit_purchase_sources(id) on delete cascade,
  provider_lifecycle_id text not null
    check (
      char_length(provider_lifecycle_id) between 1 and 512
      and provider_lifecycle_id
        ~ '^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$'
      and position('://' in provider_lifecycle_id) = 0
      and provider_lifecycle_id !~* '^(not\.)?(is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\.'
    ),
  reason text not null
    check (reason in ('cancellation', 'dispute', 'refund', 'revocation')),
  lifecycle_state text not null
    check (
      lifecycle_state in (
        'held',
        'released',
        'terminal_void',
        'refund_reversed'
      )
    ),
  credit_amount_cents integer,
  full_purchase boolean not null default false,
  provider_amount_cents integer,
  provider_currency text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (purchase_source_id, provider_lifecycle_id),
  check (
    (full_purchase and (credit_amount_cents is null or credit_amount_cents > 0))
    or (not full_purchase and credit_amount_cents > 0)
  ),
  check (
    (provider_amount_cents is null and provider_currency is null)
    or (provider_amount_cents > 0 and provider_currency = 'usd')
  )
);

create table public.ad_credit_purchase_events (
  id uuid primary key default gen_random_uuid(),
  purchase_source_id uuid not null
    references public.ad_credit_purchase_sources(id) on delete cascade,
  credit_origin text not null
    check (credit_origin in ('stripe_web', 'apple_iap', 'google_play')),
  provider_event_id text not null
    check (
      char_length(provider_event_id) between 1 and 512
      and provider_event_id
        ~ '^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$'
      and position('://' in provider_event_id) = 0
      and provider_event_id !~* '^(not\.)?(is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\.'
    ),
  provider_lifecycle_id text not null,
  action text not null
    check (action in ('hold', 'release', 'terminal_void', 'refund_reverse')),
  reason text not null
    check (reason in ('cancellation', 'dispute', 'refund', 'revocation')),
  profile_id uuid,
  provider_product_id text,
  purchase_credit_cents integer,
  reconciliation_credit_cents integer,
  full_purchase boolean not null,
  provider_paid_amount_cents integer,
  provider_event_amount_cents integer,
  provider_currency text,
  outcome text not null
    check (
      outcome in (
        'held',
        'released',
        'partially_voided',
        'terminal_voided',
        'refund_reversed',
        'stale'
      )
    ),
  processed_at timestamptz not null default timezone('utc', now()),
  unique (credit_origin, provider_event_id)
);

create table public.ad_credit_campaign_allocations (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null
    references public.ad_credit_ledger(id) on delete restrict,
  campaign_id uuid not null
    references public.ad_campaigns(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  terminal_loss_cents integer not null default 0,
  hold_cents integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (ledger_id, campaign_id),
  check (
    terminal_loss_cents >= 0
    and hold_cents >= 0
    and terminal_loss_cents + hold_cents <= amount_cents
  )
);

alter table public.ad_credit_purchase_sources enable row level security;
alter table public.ad_credit_purchase_lifecycles enable row level security;
alter table public.ad_credit_purchase_events enable row level security;
alter table public.ad_credit_campaign_allocations enable row level security;

revoke all on public.ad_credit_purchase_sources
  from public, anon, authenticated;
revoke all on public.ad_credit_purchase_lifecycles
  from public, anon, authenticated;
revoke all on public.ad_credit_purchase_events
  from public, anon, authenticated;
revoke all on public.ad_credit_campaign_allocations
  from public, anon, authenticated;

grant select, insert, update on public.ad_credit_purchase_sources
  to service_role;
grant select, insert, update on public.ad_credit_purchase_lifecycles
  to service_role;
grant select, insert on public.ad_credit_purchase_events
  to service_role;
grant select, insert, update on public.ad_credit_campaign_allocations
  to service_role;
grant usage on schema extensions to service_role;

create index ad_credit_purchase_sources_profile_idx
  on public.ad_credit_purchase_sources (profile_id, created_at desc);
create index ad_credit_purchase_lifecycles_source_idx
  on public.ad_credit_purchase_lifecycles (
    purchase_source_id,
    updated_at desc
  );
create index ad_credit_purchase_events_source_idx
  on public.ad_credit_purchase_events (
    purchase_source_id,
    processed_at desc
  );
create index ad_credit_campaign_allocations_campaign_idx
  on public.ad_credit_campaign_allocations (campaign_id);

revoke select on public.ad_credit_ledger from authenticated;
grant select (
  id,
  profile_id,
  actor_id,
  amount_cents,
  used_cents,
  campaign_spent_cents,
  credit_reason,
  note,
  status,
  expires_at,
  created_at,
  updated_at,
  operation_id,
  credit_origin,
  provider_product_id,
  refundable_cents
) on public.ad_credit_ledger to authenticated;

drop policy if exists "Admins can update ad credits"
  on public.ad_credit_ledger;
revoke insert, update on public.ad_credit_ledger from authenticated;
grant select, insert, update on public.ad_credit_ledger to service_role;

create or replace function private.protect_ad_credit_purchase_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if
    old.credit_origin is distinct from new.credit_origin
    or old.provider_transaction_id is distinct from new.provider_transaction_id
    or old.provider_product_id is distinct from new.provider_product_id
  then
    raise insufficient_privilege
      using message = 'Ad credit purchase identity is immutable.';
  end if;

  if
    old.credit_origin = 'promo'
    and old.purchase_reconciliation_state
      is distinct from new.purchase_reconciliation_state
  then
    raise insufficient_privilege
      using message = 'Promo credit cannot enter purchase reconciliation.';
  end if;

  if
    old.credit_origin <> 'promo'
    and (
      old.profile_id is distinct from new.profile_id
      or old.actor_id is distinct from new.actor_id
      or old.amount_cents is distinct from new.amount_cents
      or old.credit_reason is distinct from new.credit_reason
      or old.expires_at is distinct from new.expires_at
      or old.operation_id is distinct from new.operation_id
    )
  then
    raise insufficient_privilege
      using message = 'Ad credit purchase identity is immutable.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_ad_credit_purchase_identity
  on public.ad_credit_ledger;
create trigger protect_ad_credit_purchase_identity
before update on public.ad_credit_ledger
for each row execute function private.protect_ad_credit_purchase_identity();

revoke all on function private.protect_ad_credit_purchase_identity()
  from public, anon, authenticated, service_role;

create or replace function private.protect_ad_credit_purchase_source_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if
    old.credit_origin is distinct from new.credit_origin
    or old.provider_transaction_id is distinct from new.provider_transaction_id
    or (
      old.profile_id is not null
      and old.profile_id is distinct from new.profile_id
    )
    or (
      old.provider_product_id is not null
      and old.provider_product_id is distinct from new.provider_product_id
    )
    or (
      old.credit_amount_cents is not null
      and old.credit_amount_cents is distinct from new.credit_amount_cents
    )
    or (
      old.provider_paid_amount_cents is not null
      and old.provider_paid_amount_cents
        is distinct from new.provider_paid_amount_cents
    )
    or (
      old.provider_currency is not null
      and old.provider_currency is distinct from new.provider_currency
    )
    or (
      old.ledger_id is not null
      and old.ledger_id is distinct from new.ledger_id
    )
  then
    raise insufficient_privilege
      using message = 'Ad credit purchase source identity is immutable.';
  end if;

  return new;
end;
$$;

create trigger protect_ad_credit_purchase_source_identity
before update on public.ad_credit_purchase_sources
for each row execute function private.protect_ad_credit_purchase_source_identity();

revoke all on function private.protect_ad_credit_purchase_source_identity()
  from public, anon, authenticated, service_role;

create or replace function private.protect_ad_credit_purchase_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_credit_origin text;
begin
  if
    old.purchase_source_id is distinct from new.purchase_source_id
    or old.provider_lifecycle_id is distinct from new.provider_lifecycle_id
    or old.reason is distinct from new.reason
    or old.full_purchase is distinct from new.full_purchase
  then
    raise insufficient_privilege
      using message = 'Ad credit purchase lifecycle identity is immutable.';
  end if;

  if
    old.lifecycle_state = 'terminal_void'
    and new.lifecycle_state <> 'terminal_void'
  then
    select source.credit_origin
    into v_credit_origin
    from public.ad_credit_purchase_sources as source
    where source.id = old.purchase_source_id;

    if not (
      v_credit_origin = 'apple_iap'
      and old.reason = 'refund'
      and new.lifecycle_state = 'refund_reversed'
    ) then
      raise insufficient_privilege
        using message = 'Terminal ad credit purchase lifecycle is monotonic.';
    end if;
  end if;

  if
    old.lifecycle_state = 'refund_reversed'
    and new.lifecycle_state <> 'refund_reversed'
  then
    raise insufficient_privilege
      using message = 'Reversed Apple refund lifecycle is monotonic.';
  end if;

  if
    old.lifecycle_state = 'released'
    and new.lifecycle_state = 'held'
  then
    raise insufficient_privilege
      using message = 'Released dispute lifecycle cannot be held again.';
  end if;

  return new;
end;
$$;

create trigger protect_ad_credit_purchase_lifecycle
before update on public.ad_credit_purchase_lifecycles
for each row execute function private.protect_ad_credit_purchase_lifecycle();

revoke all on function private.protect_ad_credit_purchase_lifecycle()
  from public, anon, authenticated, service_role;

create or replace function private.protect_ad_credit_campaign_loss_fields()
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

  raise insufficient_privilege
    using message = 'Ad credit purchase loss fields require a trusted service.';
end;
$$;

create trigger protect_ad_credit_campaign_loss_fields
before update of
  ad_credit_purchase_hold,
  ad_credit_purchase_hold_cents,
  ad_credit_purchase_debt_cents
on public.ad_campaigns
for each row execute function private.protect_ad_credit_campaign_loss_fields();

revoke all on function private.protect_ad_credit_campaign_loss_fields()
  from public, anon, authenticated;

create or replace function private.refresh_ad_credit_purchase_source(
  p_purchase_source_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allocation record;
  v_full_hold boolean := false;
  v_full_terminal boolean := false;
  v_held_cents integer := 0;
  v_hold_loss_cents integer := 0;
  v_hold_remaining integer := 0;
  v_hold_use integer := 0;
  v_ledger public.ad_credit_ledger%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_remaining_unspent integer := 0;
  v_reserved_unspent integer := 0;
  v_source public.ad_credit_purchase_sources%rowtype;
  v_state text;
  v_terminal_cents integer := 0;
  v_terminal_loss_cents integer := 0;
  v_terminal_remaining integer := 0;
  v_terminal_use integer := 0;
begin
  select source.*
  into v_source
  from public.ad_credit_purchase_sources as source
  where source.id = p_purchase_source_id
  for update;

  if not found then
    raise invalid_parameter_value
      using message = 'Ad credit purchase source not found.';
  end if;

  select
    coalesce(bool_or(
      lifecycle.lifecycle_state = 'terminal_void'
      and lifecycle.full_purchase
    ), false),
    coalesce(sum(
      case
        when lifecycle.lifecycle_state = 'terminal_void'
          and not lifecycle.full_purchase
        then lifecycle.credit_amount_cents
        else 0
      end
    ), 0)::integer,
    coalesce(bool_or(
      lifecycle.lifecycle_state = 'held'
      and lifecycle.full_purchase
    ), false),
    coalesce(sum(
      case
        when lifecycle.lifecycle_state = 'held'
          and not lifecycle.full_purchase
        then lifecycle.credit_amount_cents
        else 0
      end
    ), 0)::integer
  into v_full_terminal, v_terminal_cents, v_full_hold, v_held_cents
  from public.ad_credit_purchase_lifecycles as lifecycle
  where lifecycle.purchase_source_id = v_source.id;

  if v_source.credit_amount_cents is null then
    v_state := case
      when v_full_terminal or v_terminal_cents > 0 then 'terminal_void'
      when v_full_hold or v_held_cents > 0 then 'held'
      else 'pending'
    end;

    update public.ad_credit_purchase_sources
    set
      held_cents = 0,
      lifecycle_state = v_state,
      spent_hold_cents = 0,
      spent_terminal_loss_cents = 0,
      terminal_void_cents = 0,
      updated_at = v_now
    where id = v_source.id;

    return v_state;
  end if;

  v_terminal_cents := case
    when v_full_terminal then v_source.credit_amount_cents
    else least(v_terminal_cents, v_source.credit_amount_cents)
  end;
  v_held_cents := case
    when v_full_hold then v_source.credit_amount_cents - v_terminal_cents
    else least(
      v_held_cents,
      v_source.credit_amount_cents - v_terminal_cents
    )
  end;
  v_state := case
    when v_terminal_cents >= v_source.credit_amount_cents then 'terminal_void'
    when v_held_cents > 0 then 'held'
    when v_terminal_cents > 0 then 'partially_voided'
    else 'available'
  end;

  update public.ad_credit_purchase_sources
  set
    held_cents = v_held_cents,
    lifecycle_state = v_state,
    spent_hold_cents = 0,
    spent_terminal_loss_cents = 0,
    terminal_void_cents = v_terminal_cents,
    updated_at = v_now
  where id = v_source.id;

  if v_source.ledger_id is null then
    return v_state;
  end if;

  select ledger.*
  into v_ledger
  from public.ad_credit_ledger as ledger
  where ledger.id = v_source.ledger_id
  for update;

  if
    not found
    or v_ledger.credit_origin is distinct from v_source.credit_origin
    or v_ledger.provider_transaction_id
      is distinct from v_source.provider_transaction_id
    or v_ledger.amount_cents is distinct from v_source.credit_amount_cents
  then
    raise invalid_parameter_value
      using message = 'Ad credit purchase ledger identity conflict.';
  end if;

  v_remaining_unspent := v_ledger.amount_cents - v_ledger.campaign_spent_cents;
  v_terminal_loss_cents := greatest(
    v_terminal_cents - v_remaining_unspent,
    0
  );
  v_hold_loss_cents := greatest(
    v_terminal_cents + v_held_cents - v_remaining_unspent,
    0
  ) - v_terminal_loss_cents;
  v_reserved_unspent := least(
    v_remaining_unspent,
    v_terminal_cents + v_held_cents
  );

  update public.ad_credit_ledger
  set
    purchase_reconciliation_state = v_state,
    refundable_cents = amount_cents
      - (campaign_spent_cents + v_reserved_unspent),
    status = case
      when amount_cents - (campaign_spent_cents + v_reserved_unspent) > 0
        then 'active'
      when v_state = 'available' and campaign_spent_cents = amount_cents
        then 'spent'
      else 'voided'
    end,
    updated_at = v_now,
    used_cents = campaign_spent_cents + v_reserved_unspent
  where id = v_ledger.id;

  update public.ad_credit_campaign_allocations
  set
    hold_cents = 0,
    terminal_loss_cents = 0,
    updated_at = v_now
  where ledger_id = v_ledger.id;

  v_terminal_remaining := v_terminal_loss_cents;
  v_hold_remaining := v_hold_loss_cents;

  for v_allocation in
    select allocation.id, allocation.amount_cents
    from public.ad_credit_campaign_allocations as allocation
    where allocation.ledger_id = v_ledger.id
    order by allocation.created_at, allocation.id
    for update
  loop
    v_terminal_use := least(
      v_terminal_remaining,
      v_allocation.amount_cents
    );
    v_hold_use := least(
      v_hold_remaining,
      v_allocation.amount_cents - v_terminal_use
    );

    update public.ad_credit_campaign_allocations
    set
      hold_cents = v_hold_use,
      terminal_loss_cents = v_terminal_use,
      updated_at = v_now
    where id = v_allocation.id;

    v_terminal_remaining := v_terminal_remaining - v_terminal_use;
    v_hold_remaining := v_hold_remaining - v_hold_use;
  end loop;

  if v_terminal_remaining <> 0 or v_hold_remaining <> 0 then
    raise check_violation
      using message = 'Ad credit purchase allocation coverage mismatch.';
  end if;

  update public.ad_credit_purchase_sources
  set
    spent_hold_cents = v_hold_loss_cents,
    spent_terminal_loss_cents = v_terminal_loss_cents,
    updated_at = v_now
  where id = v_source.id;

  with affected_campaigns as (
    select distinct allocation.campaign_id
    from public.ad_credit_campaign_allocations as allocation
    where allocation.ledger_id = v_ledger.id
  ), campaign_totals as (
    select
      affected.campaign_id,
      coalesce(sum(allocation.hold_cents), 0)::integer as hold_cents,
      coalesce(sum(allocation.terminal_loss_cents), 0)::integer
        as debt_cents
    from affected_campaigns as affected
    left join public.ad_credit_campaign_allocations as allocation
      on allocation.campaign_id = affected.campaign_id
    group by affected.campaign_id
  )
  update public.ad_campaigns as campaign
  set
    ad_credit_purchase_debt_cents = totals.debt_cents,
    ad_credit_purchase_hold = (
      totals.hold_cents > 0 or totals.debt_cents > 0
    ),
    ad_credit_purchase_hold_cents = totals.hold_cents,
    updated_at = v_now
  from campaign_totals as totals
  where campaign.id = totals.campaign_id;

  return v_state;
end;
$$;

revoke all on function private.refresh_ad_credit_purchase_source(uuid)
  from public, anon, authenticated;
grant execute on function private.refresh_ad_credit_purchase_source(uuid)
  to service_role;

drop function if exists public.grant_verified_ad_credit_purchase(
  text,
  text,
  text,
  uuid,
  integer
);

create or replace function public.grant_verified_ad_credit_purchase(
  p_credit_origin text,
  p_product_id text,
  p_provider_transaction_id text,
  p_profile_id uuid,
  p_credit_cents integer,
  p_provider_paid_amount_cents integer default null,
  p_provider_currency text default null
)
returns table (outcome text, ledger_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected_credit_cents integer;
  v_existing_ledger public.ad_credit_ledger%rowtype;
  v_source public.ad_credit_purchase_sources%rowtype;
begin
  v_expected_credit_cents := case p_product_id
    when 'ttc.adcredit.2500' then 2500
    when 'ttc.adcredit.5000' then 5000
    when 'ttc.adcredit.10000' then 10000
    else null
  end;

  if
    p_credit_origin not in ('stripe_web', 'apple_iap', 'google_play')
    or p_profile_id is null
    or p_provider_transaction_id is null
    or char_length(p_provider_transaction_id) not between 1 and 512
    or p_provider_transaction_id
      !~ '^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$'
    or position('://' in p_provider_transaction_id) > 0
    or p_provider_transaction_id ~* '^(not\.)?(is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\.'
    or v_expected_credit_cents is null
    or p_credit_cents is distinct from v_expected_credit_cents
    or (
      p_credit_origin = 'stripe_web'
      and (
        p_provider_paid_amount_cents
          is distinct from v_expected_credit_cents
        or p_provider_currency is distinct from 'usd'
      )
    )
    or (
      p_credit_origin <> 'stripe_web'
      and (
        p_provider_paid_amount_cents is not null
        or p_provider_currency is not null
      )
    )
  then
    raise invalid_parameter_value using message = 'Invalid ad credit purchase.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ad-credit-source:' || p_credit_origin || ':'
        || p_provider_transaction_id,
      0
    )
  );

  insert into public.ad_credit_purchase_sources (
    credit_amount_cents,
    credit_origin,
    profile_id,
    provider_currency,
    provider_paid_amount_cents,
    provider_product_id,
    provider_transaction_id
  )
  values (
    v_expected_credit_cents,
    p_credit_origin,
    p_profile_id,
    p_provider_currency,
    p_provider_paid_amount_cents,
    p_product_id,
    p_provider_transaction_id
  )
  on conflict (credit_origin, provider_transaction_id) do nothing;

  select source.*
  into v_source
  from public.ad_credit_purchase_sources as source
  where source.credit_origin = p_credit_origin
    and source.provider_transaction_id = p_provider_transaction_id
  for update;

  if
    not found
    or (
      v_source.profile_id is not null
      and v_source.profile_id is distinct from p_profile_id
    )
    or (
      v_source.provider_product_id is not null
      and v_source.provider_product_id is distinct from p_product_id
    )
    or (
      v_source.credit_amount_cents is not null
      and v_source.credit_amount_cents
        is distinct from v_expected_credit_cents
    )
    or v_source.provider_paid_amount_cents
      is distinct from p_provider_paid_amount_cents
    or v_source.provider_currency is distinct from p_provider_currency
  then
    raise invalid_parameter_value
      using message = 'Ad credit purchase identity conflict.';
  end if;

  update public.ad_credit_purchase_sources
  set
    credit_amount_cents = v_expected_credit_cents,
    profile_id = p_profile_id,
    provider_currency = p_provider_currency,
    provider_paid_amount_cents = p_provider_paid_amount_cents,
    provider_product_id = p_product_id,
    updated_at = timezone('utc', now())
  where id = v_source.id;

  if v_source.ledger_id is not null then
    select ledger.*
    into v_existing_ledger
    from public.ad_credit_ledger as ledger
    where ledger.id = v_source.ledger_id
    for update;

    if
      not found
      or v_existing_ledger.profile_id is distinct from p_profile_id
      or v_existing_ledger.credit_origin is distinct from p_credit_origin
      or v_existing_ledger.provider_product_id is distinct from p_product_id
      or v_existing_ledger.provider_transaction_id
        is distinct from p_provider_transaction_id
      or v_existing_ledger.amount_cents
        is distinct from v_expected_credit_cents
    then
      raise invalid_parameter_value
        using message = 'Ad credit purchase ledger identity conflict.';
    end if;

    ledger_id := v_existing_ledger.id;
    outcome := 'duplicate';
    perform private.refresh_ad_credit_purchase_source(v_source.id);
    return next;
    return;
  end if;

  insert into public.ad_credit_ledger (
    profile_id,
    actor_id,
    amount_cents,
    used_cents,
    campaign_spent_cents,
    credit_reason,
    note,
    status,
    expires_at,
    credit_origin,
    provider_transaction_id,
    provider_product_id,
    refundable_cents,
    purchase_reconciliation_state
  )
  values (
    p_profile_id,
    null,
    v_expected_credit_cents,
    0,
    0,
    'other',
    null,
    'active',
    null,
    p_credit_origin,
    p_provider_transaction_id,
    p_product_id,
    v_expected_credit_cents,
    'available'
  )
  returning ad_credit_ledger.id into ledger_id;

  update public.ad_credit_purchase_sources
  set
    ledger_id = grant_verified_ad_credit_purchase.ledger_id,
    updated_at = timezone('utc', now())
  where id = v_source.id;

  outcome := 'granted';
  perform private.refresh_ad_credit_purchase_source(v_source.id);
  return next;
end;
$$;

create or replace function public.confirm_verified_ad_credit_purchase(
  p_grant_id uuid,
  p_credit_origin text,
  p_product_id text,
  p_provider_transaction_id text,
  p_profile_id uuid
)
returns table (grant_id uuid)
language sql
security invoker
set search_path = ''
stable
as $$
  select ledger.id as grant_id
  from public.ad_credit_ledger as ledger
  join public.ad_credit_purchase_sources as source
    on source.ledger_id = ledger.id
  where p_credit_origin = 'apple_iap'
    and ledger.id = p_grant_id
    and ledger.profile_id = p_profile_id
    and ledger.credit_origin = p_credit_origin
    and ledger.provider_product_id = p_product_id
    and ledger.provider_transaction_id = p_provider_transaction_id
    and source.profile_id = p_profile_id
    and source.credit_origin = p_credit_origin
    and source.provider_product_id = p_product_id
    and source.provider_transaction_id = p_provider_transaction_id
    and ledger.amount_cents = case p_product_id
      when 'ttc.adcredit.2500' then 2500
      when 'ttc.adcredit.5000' then 5000
      when 'ttc.adcredit.10000' then 10000
      else null
    end
$$;

create or replace function public.resolve_google_ad_purchase_profile(
  p_obfuscated_account_id text
)
returns uuid
language sql
security invoker
set search_path = ''
stable
as $$
  select case
    when count(*) = 1 then min(profile.id::text)::uuid
    else null
  end
  from public.profiles as profile
  where p_obfuscated_account_id ~ '^[0-9a-f]{64}$'
    and encode(
      extensions.digest(lower(profile.id::text), 'sha256'),
      'hex'
    ) = p_obfuscated_account_id
$$;

drop function if exists public.reconcile_verified_ad_credit_purchase(
  text,
  text,
  text,
  text
);

create or replace function public.reconcile_verified_ad_credit_purchase(
  p_credit_origin text,
  p_provider_transaction_id text,
  p_provider_lifecycle_id text,
  p_provider_event_id text,
  p_action text,
  p_reason text,
  p_product_id text default null,
  p_profile_id uuid default null,
  p_purchase_credit_cents integer default null,
  p_reconciliation_credit_cents integer default null,
  p_full_purchase boolean default false,
  p_provider_paid_amount_cents integer default null,
  p_provider_event_amount_cents integer default null,
  p_provider_currency text default null
)
returns table (
  outcome text,
  purchase_state text,
  source_id uuid,
  ledger_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.ad_credit_purchase_events%rowtype;
  v_expected_credit_cents integer;
  v_lifecycle public.ad_credit_purchase_lifecycles%rowtype;
  v_lifecycle_found boolean := false;
  v_lifecycle_state text;
  v_source public.ad_credit_purchase_sources%rowtype;
  v_stale boolean := false;
begin
  v_expected_credit_cents := case p_product_id
    when 'ttc.adcredit.2500' then 2500
    when 'ttc.adcredit.5000' then 5000
    when 'ttc.adcredit.10000' then 10000
    else null
  end;

  if
    p_credit_origin not in ('stripe_web', 'apple_iap', 'google_play')
    or p_provider_transaction_id is null
    or char_length(p_provider_transaction_id) not between 1 and 512
    or p_provider_transaction_id
      !~ '^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$'
    or position('://' in p_provider_transaction_id) > 0
    or p_provider_transaction_id ~* '^(not\.)?(is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\.'
    or p_provider_lifecycle_id is null
    or char_length(p_provider_lifecycle_id) not between 1 and 512
    or p_provider_lifecycle_id
      !~ '^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$'
    or position('://' in p_provider_lifecycle_id) > 0
    or p_provider_lifecycle_id ~* '^(not\.)?(is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\.'
    or p_provider_event_id is null
    or char_length(p_provider_event_id) not between 1 and 512
    or p_provider_event_id
      !~ '^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$'
    or position('://' in p_provider_event_id) > 0
    or p_provider_event_id ~* '^(not\.)?(is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\.'
    or p_action not in ('hold', 'release', 'terminal_void', 'refund_reverse')
    or p_reason not in ('cancellation', 'dispute', 'refund', 'revocation')
    or not (
      (
        p_action in ('hold', 'release')
        and p_credit_origin = 'stripe_web'
        and p_reason = 'dispute'
      )
      or (
        p_action = 'refund_reverse'
        and p_credit_origin = 'apple_iap'
        and p_reason = 'refund'
      )
      or (
        p_action = 'terminal_void'
        and (
          (
            p_credit_origin = 'stripe_web'
            and p_reason in ('dispute', 'refund')
          )
          or (
            p_credit_origin = 'apple_iap'
            and p_reason in ('refund', 'revocation')
          )
          or (
            p_credit_origin = 'google_play'
            and p_reason in ('cancellation', 'refund', 'revocation')
          )
        )
      )
    )
    or not (
      (
        p_credit_origin = 'stripe_web'
        and not p_full_purchase
        and p_profile_id is not null
        and v_expected_credit_cents is not null
        and p_purchase_credit_cents = v_expected_credit_cents
        and p_provider_paid_amount_cents = v_expected_credit_cents
        and p_provider_currency = 'usd'
        and p_provider_event_amount_cents between 1
          and p_provider_paid_amount_cents
        and p_reconciliation_credit_cents
          = p_provider_event_amount_cents
      )
      or (
        p_credit_origin = 'apple_iap'
        and p_full_purchase
        and p_profile_id is not null
        and v_expected_credit_cents is not null
        and p_purchase_credit_cents = v_expected_credit_cents
        and p_reconciliation_credit_cents = v_expected_credit_cents
        and p_provider_paid_amount_cents is null
        and p_provider_event_amount_cents is null
        and p_provider_currency is null
      )
      or (
        p_credit_origin = 'google_play'
        and p_full_purchase
        and p_provider_paid_amount_cents is null
        and p_provider_event_amount_cents is null
        and p_provider_currency is null
        and (
          (
            p_product_id is null
            and p_profile_id is null
            and p_purchase_credit_cents is null
            and p_reconciliation_credit_cents is null
          )
          or (
            v_expected_credit_cents is not null
            and p_purchase_credit_cents = v_expected_credit_cents
            and p_reconciliation_credit_cents = v_expected_credit_cents
          )
        )
      )
    )
  then
    raise invalid_parameter_value
      using message = 'Invalid ad credit purchase reconciliation.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ad-credit-source:' || p_credit_origin || ':'
        || p_provider_transaction_id,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ad-credit-event:' || p_credit_origin || ':' || p_provider_event_id,
      0
    )
  );

  insert into public.ad_credit_purchase_sources (
    credit_amount_cents,
    credit_origin,
    profile_id,
    provider_currency,
    provider_paid_amount_cents,
    provider_product_id,
    provider_transaction_id
  )
  values (
    p_purchase_credit_cents,
    p_credit_origin,
    p_profile_id,
    p_provider_currency,
    p_provider_paid_amount_cents,
    p_product_id,
    p_provider_transaction_id
  )
  on conflict (credit_origin, provider_transaction_id) do nothing;

  select source.*
  into v_source
  from public.ad_credit_purchase_sources as source
  where source.credit_origin = p_credit_origin
    and source.provider_transaction_id = p_provider_transaction_id
  for update;

  if
    not found
    or (
      p_profile_id is not null
      and v_source.profile_id is not null
      and v_source.profile_id is distinct from p_profile_id
    )
    or (
      p_product_id is not null
      and v_source.provider_product_id is not null
      and v_source.provider_product_id is distinct from p_product_id
    )
    or (
      p_purchase_credit_cents is not null
      and v_source.credit_amount_cents is not null
      and v_source.credit_amount_cents
        is distinct from p_purchase_credit_cents
    )
    or v_source.provider_paid_amount_cents
      is distinct from p_provider_paid_amount_cents
    or v_source.provider_currency is distinct from p_provider_currency
  then
    raise invalid_parameter_value
      using message = 'Ad credit purchase identity conflict.';
  end if;

  update public.ad_credit_purchase_sources
  set
    credit_amount_cents = coalesce(
      credit_amount_cents,
      p_purchase_credit_cents
    ),
    profile_id = coalesce(profile_id, p_profile_id),
    provider_product_id = coalesce(provider_product_id, p_product_id),
    updated_at = timezone('utc', now())
  where id = v_source.id;

  select event.*
  into v_event
  from public.ad_credit_purchase_events as event
  where event.credit_origin = p_credit_origin
    and event.provider_event_id = p_provider_event_id;

  if found then
    if
      v_event.purchase_source_id is distinct from v_source.id
      or v_event.provider_lifecycle_id
        is distinct from p_provider_lifecycle_id
      or v_event.action is distinct from p_action
      or v_event.reason is distinct from p_reason
      or v_event.profile_id is distinct from p_profile_id
      or v_event.provider_product_id is distinct from p_product_id
      or v_event.purchase_credit_cents
        is distinct from p_purchase_credit_cents
      or v_event.reconciliation_credit_cents
        is distinct from p_reconciliation_credit_cents
      or v_event.full_purchase is distinct from p_full_purchase
      or v_event.provider_paid_amount_cents
        is distinct from p_provider_paid_amount_cents
      or v_event.provider_event_amount_cents
        is distinct from p_provider_event_amount_cents
      or v_event.provider_currency is distinct from p_provider_currency
    then
      raise invalid_parameter_value
        using message = 'Ad credit purchase event identity conflict.';
    end if;

    outcome := 'duplicate';
    select source.lifecycle_state, source.ledger_id
    into purchase_state, ledger_id
    from public.ad_credit_purchase_sources as source
    where source.id = v_source.id;
    source_id := v_source.id;
    return next;
    return;
  end if;

  select lifecycle.*
  into v_lifecycle
  from public.ad_credit_purchase_lifecycles as lifecycle
  where lifecycle.purchase_source_id = v_source.id
    and lifecycle.provider_lifecycle_id = p_provider_lifecycle_id
  for update;
  v_lifecycle_found := found;

  if v_lifecycle_found then
    if
      v_lifecycle.reason is distinct from p_reason
      or v_lifecycle.full_purchase is distinct from p_full_purchase
      or v_lifecycle.provider_currency is distinct from p_provider_currency
      or (
        not (p_reason = 'refund' and not p_full_purchase)
        and (
          v_lifecycle.credit_amount_cents
            is distinct from p_reconciliation_credit_cents
          or v_lifecycle.provider_amount_cents
            is distinct from p_provider_event_amount_cents
        )
      )
    then
      raise invalid_parameter_value
        using message = 'Ad credit purchase lifecycle identity conflict.';
    end if;
  else
    v_lifecycle_state := case p_action
      when 'hold' then 'held'
      when 'release' then 'released'
      when 'refund_reverse' then 'refund_reversed'
      else 'terminal_void'
    end;

    insert into public.ad_credit_purchase_lifecycles (
      credit_amount_cents,
      full_purchase,
      lifecycle_state,
      provider_amount_cents,
      provider_currency,
      provider_lifecycle_id,
      purchase_source_id,
      reason
    )
    values (
      p_reconciliation_credit_cents,
      p_full_purchase,
      v_lifecycle_state,
      p_provider_event_amount_cents,
      p_provider_currency,
      p_provider_lifecycle_id,
      v_source.id,
      p_reason
    )
    returning * into v_lifecycle;
  end if;

  if v_lifecycle_found then
    if p_action = 'release' then
      if v_lifecycle.lifecycle_state = 'held' then
        update public.ad_credit_purchase_lifecycles
        set
          lifecycle_state = 'released',
          updated_at = timezone('utc', now())
        where id = v_lifecycle.id
        returning * into v_lifecycle;
      end if;
    elsif p_action = 'terminal_void' then
      if v_lifecycle.lifecycle_state = 'refund_reversed' then
        null;
      elsif p_reason = 'refund' and not p_full_purchase
        and v_lifecycle.lifecycle_state = 'terminal_void'
      then
        if p_reconciliation_credit_cents < v_lifecycle.credit_amount_cents then
          v_stale := true;
        elsif p_reconciliation_credit_cents > v_lifecycle.credit_amount_cents then
          update public.ad_credit_purchase_lifecycles
          set
            credit_amount_cents = p_reconciliation_credit_cents,
            provider_amount_cents = p_provider_event_amount_cents,
            updated_at = timezone('utc', now())
          where id = v_lifecycle.id
          returning * into v_lifecycle;
        end if;
      elsif v_lifecycle.lifecycle_state <> 'terminal_void' then
        update public.ad_credit_purchase_lifecycles
        set
          lifecycle_state = 'terminal_void',
          updated_at = timezone('utc', now())
        where id = v_lifecycle.id
        returning * into v_lifecycle;
      end if;
    elsif p_action = 'refund_reverse' then
      if v_lifecycle.lifecycle_state = 'terminal_void' then
        update public.ad_credit_purchase_lifecycles
        set
          lifecycle_state = 'refund_reversed',
          updated_at = timezone('utc', now())
        where id = v_lifecycle.id
        returning * into v_lifecycle;
      elsif v_lifecycle.lifecycle_state <> 'refund_reversed' then
        raise invalid_parameter_value
          using message = 'Ad credit refund reversal identity conflict.';
      end if;
    end if;
  end if;

  purchase_state := private.refresh_ad_credit_purchase_source(v_source.id);
  select source.ledger_id
  into ledger_id
  from public.ad_credit_purchase_sources as source
  where source.id = v_source.id;
  source_id := v_source.id;

  outcome := case
    when v_stale then 'stale'
    when p_action = 'refund_reverse' then 'refund_reversed'
    when p_action = 'terminal_void'
      and v_lifecycle.lifecycle_state = 'refund_reversed'
      then 'refund_reversed'
    when p_action = 'hold'
      and v_lifecycle.lifecycle_state = 'released'
      then 'released'
    when purchase_state = 'terminal_void' then 'terminal_voided'
    when purchase_state = 'partially_voided' then 'partially_voided'
    when purchase_state = 'held' then 'held'
    when p_action = 'release' then 'released'
    else 'released'
  end;

  insert into public.ad_credit_purchase_events (
    action,
    credit_origin,
    full_purchase,
    outcome,
    profile_id,
    provider_currency,
    provider_event_amount_cents,
    provider_event_id,
    provider_lifecycle_id,
    provider_paid_amount_cents,
    provider_product_id,
    purchase_credit_cents,
    purchase_source_id,
    reason,
    reconciliation_credit_cents
  )
  values (
    p_action,
    p_credit_origin,
    p_full_purchase,
    outcome,
    p_profile_id,
    p_provider_currency,
    p_provider_event_amount_cents,
    p_provider_event_id,
    p_provider_lifecycle_id,
    p_provider_paid_amount_cents,
    p_product_id,
    p_purchase_credit_cents,
    v_source.id,
    p_reason,
    p_reconciliation_credit_cents
  )
  returning * into v_event;

  insert into public.admin_audit_logs (
    actor_id,
    event_type,
    metadata,
    operation_key,
    summary,
    target_id,
    target_type
  )
  select
    null,
    'ad_credit_purchase_' || p_reason,
    jsonb_build_object(
      'action', p_action,
      'credit_origin', p_credit_origin,
      'outcome', outcome,
      'purchase_state', purchase_state
    ),
    'ad-credit-purchase-event:' || v_event.id::text,
    case p_reason
      when 'dispute' then 'Purchased ad credit dispute reconciled.'
      when 'refund' then 'Purchased ad credit refund reconciled.'
      when 'revocation' then 'Purchased ad credit revocation reconciled.'
      else 'Purchased ad credit cancellation reconciled.'
    end,
    v_source.id,
    'ad_credit_purchase'
  where not exists (
    select 1
    from public.admin_audit_logs as audit
    where audit.operation_key =
      'ad-credit-purchase-event:' || v_event.id::text
  );

  return next;
end;
$$;

create or replace function public.spend_ad_credit_for_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_available_cents integer := 0;
  v_campaign public.ad_campaigns%rowtype;
  v_credit record;
  v_needed_cents integer := 0;
  v_now timestamptz := timezone('utc', now());
  v_remaining_cents integer := 0;
  v_use_cents integer := 0;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return false;
  end if;

  select campaign.*
  into v_campaign
  from public.ad_campaigns as campaign
  where campaign.id = p_campaign_id
    and campaign.advertiser_id = v_user_id;

  if not found then
    return false;
  end if;

  perform 1
  from public.ad_credit_ledger as ledger
  where ledger.profile_id = v_user_id
    and ledger.status = 'active'
    and ledger.amount_cents > ledger.used_cents
    and (ledger.expires_at is null or ledger.expires_at >= v_now)
  order by ledger.id
  for update;

  select campaign.*
  into v_campaign
  from public.ad_campaigns as campaign
  where campaign.id = p_campaign_id
    and campaign.advertiser_id = v_user_id
  for update;

  if
    not found
    or v_campaign.status not in ('pending_review', 'approved', 'paused')
    or v_campaign.payment_status
      not in ('unpaid', 'payment_failed', 'refunded')
    or v_campaign.payment_dispute_hold
    or v_campaign.ad_credit_purchase_hold
    or v_campaign.daily_budget_cents <= 0
  then
    return false;
  end if;

  v_needed_cents := v_campaign.daily_budget_cents;

  select coalesce(sum(ledger.amount_cents - ledger.used_cents), 0)::integer
  into v_available_cents
  from public.ad_credit_ledger as ledger
  where ledger.profile_id = v_user_id
    and ledger.status = 'active'
    and ledger.amount_cents > ledger.used_cents
    and (ledger.expires_at is null or ledger.expires_at >= v_now);

  if v_available_cents < v_needed_cents then
    return false;
  end if;

  v_remaining_cents := v_needed_cents;

  for v_credit in
    select
      ledger.id,
      ledger.amount_cents,
      ledger.used_cents,
      ledger.credit_origin,
      ledger.purchase_reconciliation_state
    from public.ad_credit_ledger as ledger
    where ledger.profile_id = v_user_id
      and ledger.status = 'active'
      and ledger.amount_cents > ledger.used_cents
      and (ledger.expires_at is null or ledger.expires_at >= v_now)
    order by ledger.expires_at asc nulls last, ledger.created_at, ledger.id
    for update
  loop
    v_use_cents := least(
      v_remaining_cents,
      v_credit.amount_cents - v_credit.used_cents
    );

    update public.ad_credit_ledger
    set
      campaign_spent_cents = campaign_spent_cents + v_use_cents,
      refundable_cents = case
        when credit_origin = 'promo' then 0
        else amount_cents - (used_cents + v_use_cents)
      end,
      status = case
        when used_cents + v_use_cents < amount_cents then 'active'
        when purchase_reconciliation_state = 'available' then 'spent'
        else 'voided'
      end,
      updated_at = v_now,
      used_cents = used_cents + v_use_cents
    where id = v_credit.id;

    if v_credit.credit_origin <> 'promo' then
      insert into public.ad_credit_campaign_allocations (
        amount_cents,
        campaign_id,
        ledger_id
      )
      values (
        v_use_cents,
        p_campaign_id,
        v_credit.id
      )
      on conflict (ledger_id, campaign_id) do update
      set
        amount_cents = ad_credit_campaign_allocations.amount_cents
          + excluded.amount_cents,
        updated_at = v_now;
    end if;

    v_remaining_cents := v_remaining_cents - v_use_cents;
    exit when v_remaining_cents <= 0;
  end loop;

  update public.ad_campaigns
  set
    payment_status = 'waived',
    platform_fee_cents = 0,
    prepaid_amount_cents = v_needed_cents,
    stripe_checkout_session_id = null,
    reviewer_note = left(
      concat_ws(E'\n', nullif(reviewer_note, ''), 'Ad credit balance applied.'),
      500
    ),
    updated_at = v_now
  where id = v_campaign.id
    and advertiser_id = v_user_id
    and payment_status in ('unpaid', 'payment_failed', 'refunded')
    and not payment_dispute_hold
    and not ad_credit_purchase_hold;

  return found;
end;
$$;

drop policy if exists "Active ads are publicly readable"
  on public.ad_campaigns;
create policy "Active ads are publicly readable"
  on public.ad_campaigns for select
  using (
    status = 'active'
    and payment_status in ('paid', 'waived')
    and not payment_dispute_hold
    and not ad_credit_purchase_hold
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
        and not ad_campaigns.ad_credit_purchase_hold
        and (ad_campaigns.starts_at is null or ad_campaigns.starts_at <= now())
        and (ad_campaigns.ends_at is null or ad_campaigns.ends_at > now())
    )
  );

drop policy if exists "Ad events can be created"
  on public.ad_events;
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
        and not ad_campaigns.ad_credit_purchase_hold
        and (ad_campaigns.starts_at is null or ad_campaigns.starts_at <= now())
        and (ad_campaigns.ends_at is null or ad_campaigns.ends_at > now())
    )
  );

revoke all on function public.grant_verified_ad_credit_purchase(
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  text
) from public, anon, authenticated;
grant execute on function public.grant_verified_ad_credit_purchase(
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  text
) to service_role;

revoke all on function public.confirm_verified_ad_credit_purchase(
  uuid,
  text,
  text,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.confirm_verified_ad_credit_purchase(
  uuid,
  text,
  text,
  text,
  uuid
) to service_role;

revoke all on function public.resolve_google_ad_purchase_profile(text)
  from public, anon, authenticated;
grant execute on function public.resolve_google_ad_purchase_profile(text)
  to service_role;

revoke all on function public.reconcile_verified_ad_credit_purchase(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  boolean,
  integer,
  integer,
  text
) from public, anon, authenticated;
grant execute on function public.reconcile_verified_ad_credit_purchase(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  boolean,
  integer,
  integer,
  text
) to service_role;

revoke all on function public.spend_ad_credit_for_campaign(uuid)
  from public, anon;
grant execute on function public.spend_ad_credit_for_campaign(uuid)
  to authenticated, service_role;
