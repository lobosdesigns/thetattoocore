create table if not exists public.native_push_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null,
  installation_id uuid not null,
  token text not null,
  token_hash text not null,
  app_version text,
  app_build text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint native_push_devices_platform_check
    check (platform in ('android', 'ios')),
  constraint native_push_devices_token_check
    check (char_length(token) between 20 and 4096 and token !~ '[[:space:]]'),
  constraint native_push_devices_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint native_push_devices_app_version_check
    check (app_version is null or char_length(app_version) between 1 and 40),
  constraint native_push_devices_app_build_check
    check (app_build is null or char_length(app_build) between 1 and 40),
  constraint native_push_devices_token_hash_unique unique (token_hash),
  constraint native_push_devices_installation_unique
    unique (platform, installation_id)
);

alter table public.native_push_devices enable row level security;

create policy "Users read own native push devices"
  on public.native_push_devices for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "Users insert own native push devices"
  on public.native_push_devices for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "Users update own native push devices"
  on public.native_push_devices for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create policy "Users delete own native push devices"
  on public.native_push_devices for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

revoke all on table public.native_push_devices from anon, authenticated;
grant select, insert, update, delete on table public.native_push_devices to service_role;

create index if not exists native_push_devices_profile_active_idx
  on public.native_push_devices (profile_id, is_active, updated_at desc);

create index if not exists native_push_devices_installation_idx
  on public.native_push_devices (profile_id, platform, installation_id);

comment on table public.native_push_devices is
  'Server-only native notification delivery registrations. Token values are never exposed to browser roles.';

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_profile_endpoint_unique;

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_unique unique (endpoint);

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
