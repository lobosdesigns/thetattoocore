alter table public.stripe_webhook_events
  add column if not exists status text not null default 'processed',
  add column if not exists claimed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists attempt_count integer not null default 1,
  add column if not exists last_error text;

update public.stripe_webhook_events
set
  claimed_at = coalesce(claimed_at, received_at),
  completed_at = coalesce(completed_at, received_at),
  status = 'processed'
where claimed_at is null or completed_at is null or status <> 'processed';

alter table public.stripe_webhook_events
  alter column claimed_at set default now(),
  alter column claimed_at set not null;

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_status_check,
  add constraint stripe_webhook_events_status_check
    check (status in ('processing', 'processed', 'failed')),
  drop constraint if exists stripe_webhook_events_attempt_count_check,
  add constraint stripe_webhook_events_attempt_count_check
    check (attempt_count between 1 and 1000),
  drop constraint if exists stripe_webhook_events_last_error_check,
  add constraint stripe_webhook_events_last_error_check
    check (last_error is null or char_length(last_error) <= 500);

create index if not exists stripe_webhook_events_status_claimed_idx
  on public.stripe_webhook_events (status, claimed_at);

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
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
  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    status,
    claimed_at,
    completed_at,
    attempt_count,
    last_error
  )
  values (
    p_event_id,
    p_event_type,
    'processing',
    now(),
    null,
    1,
    null
  )
  on conflict (event_id) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    return 'claimed';
  end if;

  select status, claimed_at
  into existing_status, existing_claimed_at
  from public.stripe_webhook_events
  where event_id = p_event_id
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
  where event_id = p_event_id;

  return 'claimed';
end;
$$;

create or replace function public.complete_stripe_webhook_event(p_event_id text)
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
    and status = 'processing';

  return found;
end;
$$;

create or replace function public.fail_stripe_webhook_event(
  p_event_id text,
  p_error text
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
    and status = 'processing';

  return found;
end;
$$;

revoke all on table public.stripe_webhook_events from anon, authenticated;
grant select, insert, update on table public.stripe_webhook_events to service_role;

revoke execute on function public.claim_stripe_webhook_event(text, text)
  from public, anon, authenticated;
revoke execute on function public.complete_stripe_webhook_event(text)
  from public, anon, authenticated;
revoke execute on function public.fail_stripe_webhook_event(text, text)
  from public, anon, authenticated;

grant execute on function public.claim_stripe_webhook_event(text, text)
  to service_role;
grant execute on function public.complete_stripe_webhook_event(text)
  to service_role;
grant execute on function public.fail_stripe_webhook_event(text, text)
  to service_role;
