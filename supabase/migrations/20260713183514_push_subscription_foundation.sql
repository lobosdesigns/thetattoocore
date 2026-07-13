create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_check
    check (char_length(endpoint) between 20 and 2000 and endpoint ~ '^https://'),
  constraint push_subscriptions_key_check
    check (
      char_length(p256dh_key) between 20 and 500
      and char_length(auth_key) between 10 and 500
    ),
  constraint push_subscriptions_user_agent_check
    check (user_agent is null or char_length(user_agent) <= 500),
  constraint push_subscriptions_profile_endpoint_unique
    unique (profile_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users read own push subscriptions" on public.push_subscriptions;
create policy "Users read own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "Users insert own push subscriptions" on public.push_subscriptions;
create policy "Users insert own push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

drop policy if exists "Users update own push subscriptions" on public.push_subscriptions;
create policy "Users update own push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

drop policy if exists "Users delete own push subscriptions" on public.push_subscriptions;
create policy "Users delete own push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create index if not exists push_subscriptions_profile_active_idx
  on public.push_subscriptions (profile_id, is_active, updated_at desc);

create index if not exists push_subscriptions_active_seen_idx
  on public.push_subscriptions (is_active, last_seen_at desc)
  where is_active;
