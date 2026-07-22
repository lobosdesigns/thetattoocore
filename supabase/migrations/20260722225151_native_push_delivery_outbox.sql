create table if not exists public.native_push_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null
    references public.notifications(id) on delete cascade,
  device_id uuid not null
    references public.native_push_devices(id) on delete cascade,
  status text not null default 'pending',
  attempt_count smallint not null default 0,
  available_at timestamptz not null default now(),
  leased_at timestamptz,
  lease_expires_at timestamptz,
  lease_token uuid,
  delivered_at timestamptz,
  suppressed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint native_push_delivery_jobs_notification_device_unique
    unique (notification_id, device_id),
  constraint native_push_delivery_jobs_status_check
    check (status in ('pending', 'leased', 'completed', 'suppressed', 'failed')),
  constraint native_push_delivery_jobs_attempt_count_check
    check (attempt_count between 0 and 8),
  constraint native_push_delivery_jobs_error_code_check
    check (
      last_error_code is null
      or last_error_code in (
        'account_mismatch',
        'account_restricted',
        'credentials',
        'device_inactive',
        'invalid_token',
        'payload',
        'preference',
        'quiet_hours',
        'rate_limited',
        'temporary',
        'unknown'
      )
    )
);

alter table public.native_push_delivery_jobs enable row level security;

revoke all privileges on table public.native_push_delivery_jobs
  from public, anon, authenticated;
grant select, insert, update, delete on table public.native_push_delivery_jobs
  to service_role;

create index if not exists native_push_delivery_jobs_ready_idx
  on public.native_push_delivery_jobs (available_at, created_at)
  where status in ('pending', 'leased') and attempt_count < 8;

create index if not exists native_push_delivery_jobs_device_status_idx
  on public.native_push_delivery_jobs (device_id, status, created_at);

comment on table public.native_push_delivery_jobs is
  'Service-only native alert outbox. Device tokens remain in native_push_devices and are never copied here.';

create or replace function public.insert_notifications_with_native_delivery(
  p_notifications jsonb,
  p_enqueue_native boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer := 0;
  queued_count integer := 0;
begin
  if jsonb_typeof(p_notifications) <> 'array'
    or jsonb_array_length(p_notifications) < 1
    or jsonb_array_length(p_notifications) > 100 then
    raise exception 'Notification batch must contain between 1 and 100 rows.';
  end if;

  with inserted as (
    insert into public.notifications (
      actor_id,
      body,
      href,
      message_id,
      recipient_id,
      subject_id,
      subject_type,
      title,
      type
    )
    select
      nullif(item ->> 'actor_id', '')::uuid,
      nullif(item ->> 'body', ''),
      nullif(item ->> 'href', ''),
      nullif(item ->> 'message_id', '')::uuid,
      (item ->> 'recipient_id')::uuid,
      nullif(item ->> 'subject_id', '')::uuid,
      item ->> 'subject_type',
      item ->> 'title',
      item ->> 'type'
    from jsonb_array_elements(p_notifications) as batch(item)
    returning id, message_id, recipient_id, type
  ),
  queued as (
    insert into public.native_push_delivery_jobs (
      device_id,
      notification_id
    )
    select devices.id, inserted.id
    from inserted
    join public.native_push_devices as devices
      on devices.profile_id = inserted.recipient_id
      and devices.is_active
    where p_enqueue_native
      and inserted.type = 'message'
      and inserted.message_id is not null
    on conflict (notification_id, device_id) do nothing
    returning 1
  ),
  counts as (
    select
      (select count(*) from inserted)::integer as inserted_count,
      (select count(*) from queued)::integer as queued_count
  )
  select counts.inserted_count, counts.queued_count
  into inserted_count, queued_count
  from counts;

  return jsonb_build_object(
    'inserted_count', inserted_count,
    'queued_count', queued_count
  );
end;
$$;

create or replace function public.claim_native_push_delivery_batch(
  p_limit integer default 25,
  p_lease_seconds integer default 60
)
returns table (
  job_id uuid,
  attempt_count smallint,
  lease_token uuid,
  notification_id uuid,
  notification_type text,
  notification_href text,
  recipient_id uuid,
  message_id uuid,
  device_id uuid,
  device_token text,
  device_token_hash text,
  device_platform text,
  device_active boolean,
  device_last_seen_at timestamptz,
  notify_push_enabled boolean,
  notify_message_activity boolean,
  notification_quiet_hours_enabled boolean,
  notification_quiet_hours_start time,
  notification_quiet_hours_end time,
  notification_timezone text,
  banned_at timestamptz,
  suspended_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Native delivery batch limit is out of range.';
  end if;

  if p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'Native delivery lease is out of range.';
  end if;

  update public.native_push_delivery_jobs as jobs
  set
    lease_expires_at = null,
    leased_at = null,
    lease_token = null,
    last_error_code = 'account_mismatch',
    status = 'suppressed',
    suppressed_at = clock_timestamp(),
    updated_at = clock_timestamp()
  from public.notifications as notifications,
    public.native_push_devices as devices
  where notifications.id = jobs.notification_id
    and devices.id = jobs.device_id
    and devices.profile_id <> notifications.recipient_id
    and jobs.status in ('pending', 'leased');

  return query
  with candidates as (
    select jobs.id
    from public.native_push_delivery_jobs as jobs
    join public.notifications as notifications
      on notifications.id = jobs.notification_id
    join public.native_push_devices as devices
      on devices.id = jobs.device_id
      and devices.profile_id = notifications.recipient_id
    where jobs.attempt_count < 8
      and jobs.available_at <= clock_timestamp()
      and (
        jobs.status = 'pending'
        or (
          jobs.status = 'leased'
          and jobs.lease_expires_at <= clock_timestamp()
        )
      )
    order by jobs.available_at, jobs.created_at
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update public.native_push_delivery_jobs as jobs
    set
      leased_at = clock_timestamp(),
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      lease_token = gen_random_uuid(),
      status = 'leased',
      updated_at = clock_timestamp()
    from candidates
    where jobs.id = candidates.id
    returning
      jobs.id,
      jobs.attempt_count,
      jobs.lease_token,
      jobs.notification_id,
      jobs.device_id
  )
  select
    claimed.id,
    claimed.attempt_count,
    claimed.lease_token,
    notifications.id,
    notifications.type,
    notifications.href,
    notifications.recipient_id,
    notifications.message_id,
    devices.id,
    devices.token,
    devices.token_hash,
    devices.platform,
    devices.is_active,
    devices.last_seen_at,
    profiles.notify_push_enabled,
    profiles.notify_message_activity,
    profiles.notification_quiet_hours_enabled,
    profiles.notification_quiet_hours_start,
    profiles.notification_quiet_hours_end,
    profiles.notification_timezone,
    profiles.banned_at,
    profiles.suspended_at
  from claimed
  join public.notifications
    on notifications.id = claimed.notification_id
  join public.native_push_devices as devices
    on devices.id = claimed.device_id
  join public.profiles
    on profiles.id = notifications.recipient_id;
end;
$$;

create or replace function public.complete_native_push_delivery(
  p_job_id uuid,
  p_lease_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with completed as (
    update public.native_push_delivery_jobs
    set
      delivered_at = clock_timestamp(),
      lease_expires_at = null,
      leased_at = null,
      lease_token = null,
      last_error_code = null,
      status = 'completed',
      updated_at = clock_timestamp()
    where id = p_job_id
      and status = 'leased'
      and lease_token = p_lease_token
    returning 1
  )
  select exists(select 1 from completed);
$$;

create or replace function public.retry_native_push_delivery(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_retry_after_seconds integer default 60,
  p_retryable boolean default true,
  p_count_attempt boolean default true
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated boolean := false;
begin
  if p_error_code not in (
    'credentials',
    'payload',
    'quiet_hours',
    'rate_limited',
    'temporary',
    'unknown'
  ) then
    raise exception 'Native delivery retry code is not allowed.';
  end if;

  if p_retry_after_seconds < 5 or p_retry_after_seconds > 86400 then
    raise exception 'Native delivery retry delay is out of range.';
  end if;

  with retried as (
    update public.native_push_delivery_jobs
    set
      attempt_count = least(
        8,
        attempt_count + case when p_count_attempt then 1 else 0 end
      ),
      available_at = clock_timestamp()
        + make_interval(secs => p_retry_after_seconds),
      lease_expires_at = null,
      leased_at = null,
      lease_token = null,
      last_error_code = p_error_code,
      status = case
        when not p_retryable then 'failed'
        when attempt_count + case when p_count_attempt then 1 else 0 end >= 8
          then 'failed'
        else 'pending'
      end,
      updated_at = clock_timestamp()
    where id = p_job_id
      and status = 'leased'
      and lease_token = p_lease_token
    returning 1
  )
  select exists(select 1 from retried) into updated;

  return updated;
end;
$$;

create or replace function public.suppress_native_push_delivery(
  p_job_id uuid,
  p_lease_token uuid,
  p_reason text,
  p_device_token_hash text default null,
  p_deactivate_device boolean default false
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_device_id uuid;
begin
  if p_reason not in (
    'account_restricted',
    'device_inactive',
    'invalid_token',
    'preference'
  ) then
    raise exception 'Native delivery suppression reason is not allowed.';
  end if;

  select device_id
  into target_device_id
  from public.native_push_delivery_jobs
  where id = p_job_id
    and status = 'leased'
    and lease_token = p_lease_token
  for update;

  if target_device_id is null then
    return false;
  end if;

  if p_deactivate_device then
    update public.native_push_devices
    set
      is_active = false,
      updated_at = clock_timestamp()
    where id = target_device_id
      and token_hash = p_device_token_hash;

    if not found then
      update public.native_push_delivery_jobs
      set
        available_at = clock_timestamp() + interval '5 seconds',
        lease_expires_at = null,
        leased_at = null,
        lease_token = null,
        last_error_code = 'temporary',
        status = 'pending',
        updated_at = clock_timestamp()
      where id = p_job_id
        and status = 'leased'
        and lease_token = p_lease_token;

      return false;
    end if;

    update public.native_push_delivery_jobs
    set
      lease_expires_at = null,
      leased_at = null,
      lease_token = null,
      last_error_code = p_reason,
      status = 'suppressed',
      suppressed_at = clock_timestamp(),
      updated_at = clock_timestamp()
    where device_id = target_device_id
      and status in ('pending', 'leased');
  else
    update public.native_push_delivery_jobs
    set
      lease_expires_at = null,
      leased_at = null,
      lease_token = null,
      last_error_code = p_reason,
      status = 'suppressed',
      suppressed_at = clock_timestamp(),
      updated_at = clock_timestamp()
    where id = p_job_id
      and status = 'leased'
      and lease_token = p_lease_token;
  end if;

  return true;
end;
$$;

revoke execute on function public.insert_notifications_with_native_delivery(jsonb, boolean)
  from public, anon, authenticated;
revoke execute on function public.claim_native_push_delivery_batch(integer, integer)
  from public, anon, authenticated;
revoke execute on function public.complete_native_push_delivery(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.retry_native_push_delivery(uuid, uuid, text, integer, boolean, boolean)
  from public, anon, authenticated;
revoke execute on function public.suppress_native_push_delivery(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.insert_notifications_with_native_delivery(jsonb, boolean)
  to service_role;
grant execute on function public.claim_native_push_delivery_batch(integer, integer)
  to service_role;
grant execute on function public.complete_native_push_delivery(uuid, uuid)
  to service_role;
grant execute on function public.retry_native_push_delivery(uuid, uuid, text, integer, boolean, boolean)
  to service_role;
grant execute on function public.suppress_native_push_delivery(uuid, uuid, text, text, boolean)
  to service_role;

comment on function public.insert_notifications_with_native_delivery(jsonb, boolean) is
  'Atomically inserts in-app alerts and optional DM-only native delivery jobs for the trusted server.';
comment on function public.claim_native_push_delivery_batch(integer, integer) is
  'Claims a bounded native delivery batch with row locks and expiring leases for the trusted worker.';
