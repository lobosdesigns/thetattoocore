create table if not exists public.booking_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  booking_enabled boolean not null default false,
  timezone text not null default 'America/Chicago',
  weekly_availability jsonb not null default '{}'::jsonb,
  booking_note text,
  deposit_policy text not null default 'optional',
  default_deposit_amount_cents integer not null default 0,
  calendar_connection_status text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_settings_timezone_check
    check (timezone ~ '^[A-Za-z0-9_+\-/.]{2,80}$'),
  constraint booking_settings_note_check
    check (booking_note is null or char_length(booking_note) <= 500),
  constraint booking_settings_deposit_policy_check
    check (deposit_policy in ('none', 'optional', 'required')),
  constraint booking_settings_default_deposit_check
    check (default_deposit_amount_cents between 0 and 500000),
  constraint booking_settings_calendar_status_check
    check (calendar_connection_status in ('manual', 'google_planned', 'apple_ical_planned', 'connected')),
  constraint booking_settings_weekly_availability_check
    check (jsonb_typeof(weekly_availability) = 'object')
);

alter table public.booking_settings enable row level security;

drop policy if exists "Public can read enabled verified booking settings" on public.booking_settings;
create policy "Public can read enabled verified booking settings"
  on public.booking_settings for select
  to anon, authenticated
  using (
    booking_enabled
    and exists (
      select 1
      from public.profiles
      where profiles.id = booking_settings.profile_id
      and profiles.account_type in ('artist', 'studio')
      and profiles.license_verified_at is not null
      and profiles.suspended_at is null
      and profiles.banned_at is null
      and profiles.is_private = false
    )
  );

drop policy if exists "Users read own booking settings" on public.booking_settings;
create policy "Users read own booking settings"
  on public.booking_settings for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "Verified artists manage own booking settings" on public.booking_settings;
create policy "Verified artists manage own booking settings"
  on public.booking_settings for insert
  to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = booking_settings.profile_id
      and profiles.account_type in ('artist', 'studio')
      and profiles.license_verified_at is not null
      and profiles.suspended_at is null
      and profiles.banned_at is null
    )
  );

drop policy if exists "Verified artists update own booking settings" on public.booking_settings;
create policy "Verified artists update own booking settings"
  on public.booking_settings for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check (
    (select auth.uid()) = profile_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = booking_settings.profile_id
      and profiles.account_type in ('artist', 'studio')
      and profiles.license_verified_at is not null
      and profiles.suspended_at is null
      and profiles.banned_at is null
    )
  );

grant select on public.booking_settings to anon;
grant select, insert, update on public.booking_settings to authenticated;

create index if not exists booking_settings_enabled_idx
  on public.booking_settings (booking_enabled, updated_at desc)
  where booking_enabled;
