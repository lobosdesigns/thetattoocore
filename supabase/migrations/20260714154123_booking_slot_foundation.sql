create table if not exists public.booking_appointment_types (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 60,
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  deposit_policy text not null default 'inherit',
  deposit_amount_cents integer not null default 0,
  currency text not null default 'USD',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_appointment_types_name_check
    check (char_length(name) between 2 and 80),
  constraint booking_appointment_types_description_check
    check (description is null or char_length(description) <= 500),
  constraint booking_appointment_types_duration_check
    check (duration_minutes between 10 and 720),
  constraint booking_appointment_types_buffer_check
    check (
      buffer_before_minutes between 0 and 240
      and buffer_after_minutes between 0 and 240
    ),
  constraint booking_appointment_types_deposit_policy_check
    check (deposit_policy in ('inherit', 'none', 'optional', 'required')),
  constraint booking_appointment_types_deposit_amount_check
    check (deposit_amount_cents between 0 and 500000),
  constraint booking_appointment_types_currency_check
    check (currency in ('USD'))
);

create table if not exists public.booking_availability_slots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  appointment_type_id uuid references public.booking_appointment_types(id) on delete cascade,
  weekday integer not null,
  starts_at time not null,
  ends_at time not null,
  timezone text not null default 'America/Chicago',
  slot_interval_minutes integer not null default 30,
  max_bookings_per_slot integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_availability_slots_weekday_check
    check (weekday between 0 and 6),
  constraint booking_availability_slots_time_check
    check (starts_at < ends_at),
  constraint booking_availability_slots_timezone_check
    check (timezone ~ '^[A-Za-z0-9_+\-/.]{2,80}$'),
  constraint booking_availability_slots_interval_check
    check (slot_interval_minutes in (15, 20, 30, 45, 60, 90, 120)),
  constraint booking_availability_slots_capacity_check
    check (max_bookings_per_slot between 1 and 20)
);

create table if not exists public.booking_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  is_all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_blackout_dates_time_check
    check (starts_at < ends_at),
  constraint booking_blackout_dates_reason_check
    check (reason is null or char_length(reason) <= 160)
);

create table if not exists public.booking_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  status text not null default 'setup_needed',
  display_name text,
  external_calendar_id text,
  sync_direction text not null default 'read_only',
  last_synced_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_calendar_connections_provider_check
    check (provider in ('google', 'apple_ical', 'ical_feed')),
  constraint booking_calendar_connections_status_check
    check (status in ('setup_needed', 'connected', 'paused', 'sync_error', 'disconnected')),
  constraint booking_calendar_connections_sync_direction_check
    check (sync_direction in ('read_only', 'two_way')),
  constraint booking_calendar_connections_display_name_check
    check (display_name is null or char_length(display_name) <= 120),
  constraint booking_calendar_connections_external_id_check
    check (external_calendar_id is null or char_length(external_calendar_id) <= 500),
  constraint booking_calendar_connections_error_check
    check (error_message is null or char_length(error_message) <= 500)
);

alter table public.booking_appointment_types enable row level security;
alter table public.booking_availability_slots enable row level security;
alter table public.booking_blackout_dates enable row level security;
alter table public.booking_calendar_connections enable row level security;

drop policy if exists "Public can read active booking appointment types" on public.booking_appointment_types;
create policy "Public can read active booking appointment types"
  on public.booking_appointment_types for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.booking_settings
      join public.profiles on profiles.id = booking_settings.profile_id
      where booking_settings.profile_id = booking_appointment_types.profile_id
      and booking_settings.booking_enabled
      and profiles.account_type in ('artist', 'studio')
      and profiles.license_verified_at is not null
      and profiles.suspended_at is null
      and profiles.banned_at is null
      and profiles.is_private = false
    )
  );

drop policy if exists "Owners manage booking appointment types" on public.booking_appointment_types;
create policy "Owners manage booking appointment types"
  on public.booking_appointment_types for all
  to authenticated
  using (
    (select auth.uid()) = profile_id
    or private.current_user_can_moderate()
  )
  with check (
    (
      (select auth.uid()) = profile_id
      and exists (
        select 1
        from public.profiles
        where profiles.id = booking_appointment_types.profile_id
        and profiles.account_type in ('artist', 'studio')
        and profiles.license_verified_at is not null
        and profiles.suspended_at is null
        and profiles.banned_at is null
      )
    )
    or private.current_user_can_moderate()
  );

drop policy if exists "Public can read active booking slots" on public.booking_availability_slots;
create policy "Public can read active booking slots"
  on public.booking_availability_slots for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.booking_settings
      join public.profiles on profiles.id = booking_settings.profile_id
      where booking_settings.profile_id = booking_availability_slots.profile_id
      and booking_settings.booking_enabled
      and profiles.account_type in ('artist', 'studio')
      and profiles.license_verified_at is not null
      and profiles.suspended_at is null
      and profiles.banned_at is null
      and profiles.is_private = false
    )
    and (
      appointment_type_id is null
      or exists (
        select 1
        from public.booking_appointment_types
        where booking_appointment_types.id = booking_availability_slots.appointment_type_id
        and booking_appointment_types.profile_id = booking_availability_slots.profile_id
        and booking_appointment_types.is_active
      )
    )
  );

drop policy if exists "Owners manage booking slots" on public.booking_availability_slots;
create policy "Owners manage booking slots"
  on public.booking_availability_slots for all
  to authenticated
  using (
    (select auth.uid()) = profile_id
    or private.current_user_can_moderate()
  )
  with check (
    (
      (select auth.uid()) = profile_id
      and exists (
        select 1
        from public.profiles
        where profiles.id = booking_availability_slots.profile_id
        and profiles.account_type in ('artist', 'studio')
        and profiles.license_verified_at is not null
        and profiles.suspended_at is null
        and profiles.banned_at is null
      )
      and (
        appointment_type_id is null
        or exists (
          select 1
          from public.booking_appointment_types
          where booking_appointment_types.id = booking_availability_slots.appointment_type_id
          and booking_appointment_types.profile_id = booking_availability_slots.profile_id
        )
      )
    )
    or private.current_user_can_moderate()
  );

drop policy if exists "Owners manage booking blackout dates" on public.booking_blackout_dates;
create policy "Owners manage booking blackout dates"
  on public.booking_blackout_dates for all
  to authenticated
  using (
    (select auth.uid()) = profile_id
    or private.current_user_can_moderate()
  )
  with check (
    (
      (select auth.uid()) = profile_id
      and exists (
        select 1
        from public.profiles
        where profiles.id = booking_blackout_dates.profile_id
        and profiles.account_type in ('artist', 'studio')
        and profiles.license_verified_at is not null
        and profiles.suspended_at is null
        and profiles.banned_at is null
      )
    )
    or private.current_user_can_moderate()
  );

drop policy if exists "Owners manage booking calendar connections" on public.booking_calendar_connections;
create policy "Owners manage booking calendar connections"
  on public.booking_calendar_connections for all
  to authenticated
  using (
    (select auth.uid()) = profile_id
    or private.current_user_can_moderate()
  )
  with check (
    (
      (select auth.uid()) = profile_id
      and exists (
        select 1
        from public.profiles
        where profiles.id = booking_calendar_connections.profile_id
        and profiles.account_type in ('artist', 'studio')
        and profiles.license_verified_at is not null
        and profiles.suspended_at is null
        and profiles.banned_at is null
      )
    )
    or private.current_user_can_moderate()
  );

grant select on public.booking_appointment_types to anon;
grant select on public.booking_availability_slots to anon;
grant select, insert, update, delete on public.booking_appointment_types to authenticated;
grant select, insert, update, delete on public.booking_availability_slots to authenticated;
grant select, insert, update, delete on public.booking_blackout_dates to authenticated;
grant select, insert, update, delete on public.booking_calendar_connections to authenticated;

create index if not exists booking_appointment_types_profile_active_idx
  on public.booking_appointment_types (profile_id, is_active, sort_order, created_at desc);

create index if not exists booking_availability_slots_profile_weekday_idx
  on public.booking_availability_slots (profile_id, weekday, starts_at, is_active);

create index if not exists booking_availability_slots_type_idx
  on public.booking_availability_slots (appointment_type_id)
  where appointment_type_id is not null;

create index if not exists booking_blackout_dates_profile_window_idx
  on public.booking_blackout_dates (profile_id, starts_at, ends_at);

create index if not exists booking_calendar_connections_profile_provider_idx
  on public.booking_calendar_connections (profile_id, provider, status);
