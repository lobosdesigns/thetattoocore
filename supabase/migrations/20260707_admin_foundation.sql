-- Admin, moderation, report, and mail-settings foundation.

create type public.user_role as enum ('user', 'moderator', 'admin', 'owner');
create type public.report_subject_type as enum ('profile', 'feed_post', 'thread_post', 'comment', 'marketplace_listing', 'message');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.moderation_action_type as enum (
  'warn_user',
  'hide_content',
  'restore_content',
  'remove_content',
  'suspend_user',
  'ban_user',
  'resolve_report',
  'dismiss_report'
);

alter table public.profiles
  add column role public.user_role not null default 'user',
  add column suspended_at timestamptz,
  add column banned_at timestamptz,
  add column moderation_note text;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  subject_type public.report_subject_type not null,
  subject_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 120),
  details text check (details is null or char_length(details) <= 2000),
  status public.report_status not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action_type public.moderation_action_type not null,
  subject_type public.report_subject_type,
  subject_id uuid,
  target_user_id uuid references public.profiles(id) on delete set null,
  report_id uuid references public.content_reports(id) on delete set null,
  note text check (note is null or char_length(note) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 120),
  target_type text check (target_type is null or char_length(target_type) <= 80),
  target_id uuid,
  summary text check (summary is null or char_length(summary) <= 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.mail_settings (
  id boolean primary key default true check (id),
  provider text not null default 'hostgator' check (char_length(provider) between 2 and 40),
  from_email text,
  from_name text not null default 'TheTattooCore',
  smtp_host text,
  smtp_port integer check (smtp_port is null or smtp_port between 1 and 65535),
  smtp_username text,
  smtp_secure boolean not null default true,
  smtp_password_secret_name text not null default 'HOSTGATOR_SMTP_PASSWORD',
  reply_to_email text,
  is_enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.mail_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.content_reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.mail_settings enable row level security;

create or replace function public.current_profile_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select role
      from public.profiles
      where id = (select auth.uid())
      limit 1
    ),
    'user'::public.user_role
  );
$$;

create or replace function public.current_user_can_moderate()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() in ('moderator', 'admin', 'owner');
$$;

create or replace function public.current_user_can_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() in ('admin', 'owner');
$$;

create or replace function public.current_user_is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'owner';
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.current_user_can_moderate() from public;
revoke all on function public.current_user_can_admin() from public;
revoke all on function public.current_user_is_owner() from public;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_user_can_moderate() to authenticated;
grant execute on function public.current_user_can_admin() to authenticated;
grant execute on function public.current_user_is_owner() to authenticated;

create or replace function public.protect_profile_role_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.current_user_is_owner() then
      new.role := 'user';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and not public.current_user_is_owner() then
    raise exception 'Only owners can change profile roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_role_changes on public.profiles;
create trigger protect_profile_role_changes
before insert or update on public.profiles
for each row execute function public.protect_profile_role_changes();

create policy "Moderators can update profiles"
  on public.profiles for update
  to authenticated
  using (public.current_user_can_moderate())
  with check (public.current_user_can_moderate());

create policy "Users can create reports"
  on public.content_reports for insert
  to authenticated
  with check ((select auth.uid()) = reporter_id);

create policy "Users can view own reports"
  on public.content_reports for select
  to authenticated
  using ((select auth.uid()) = reporter_id or public.current_user_can_moderate());

create policy "Moderators can update reports"
  on public.content_reports for update
  to authenticated
  using (public.current_user_can_moderate())
  with check (public.current_user_can_moderate());

create policy "Moderators can view moderation actions"
  on public.moderation_actions for select
  to authenticated
  using (public.current_user_can_moderate());

create policy "Moderators can create moderation actions"
  on public.moderation_actions for insert
  to authenticated
  with check (public.current_user_can_moderate() and actor_id = (select auth.uid()));

create policy "Admins can view audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using (public.current_user_can_admin());

create policy "Admins can create audit logs"
  on public.admin_audit_logs for insert
  to authenticated
  with check (public.current_user_can_admin() and (actor_id is null or actor_id = (select auth.uid())));

create policy "Admins can view mail settings"
  on public.mail_settings for select
  to authenticated
  using (public.current_user_can_admin());

create policy "Admins can update mail settings"
  on public.mail_settings for update
  to authenticated
  using (public.current_user_can_admin())
  with check (public.current_user_can_admin());

create policy "Moderators can review feed posts"
  on public.feed_posts for select
  to authenticated
  using (public.current_user_can_moderate());

create policy "Moderators can update feed posts"
  on public.feed_posts for update
  to authenticated
  using (public.current_user_can_moderate())
  with check (public.current_user_can_moderate());

create policy "Moderators can review comments"
  on public.post_comments for select
  to authenticated
  using (public.current_user_can_moderate());

create policy "Moderators can update comments"
  on public.post_comments for update
  to authenticated
  using (public.current_user_can_moderate())
  with check (public.current_user_can_moderate());

create policy "Moderators can review thread posts"
  on public.thread_posts for select
  to authenticated
  using (public.current_user_can_moderate());

create policy "Moderators can update thread posts"
  on public.thread_posts for update
  to authenticated
  using (public.current_user_can_moderate())
  with check (public.current_user_can_moderate());

create policy "Moderators can review marketplace listings"
  on public.marketplace_listings for select
  to authenticated
  using (public.current_user_can_moderate());

create policy "Moderators can update marketplace listings"
  on public.marketplace_listings for update
  to authenticated
  using (public.current_user_can_moderate())
  with check (public.current_user_can_moderate());

grant select, insert, update on public.content_reports to authenticated;
grant select, insert on public.moderation_actions to authenticated;
grant select, insert on public.admin_audit_logs to authenticated;
grant select, update on public.mail_settings to authenticated;
grant select (id, username, display_name, role, suspended_at, banned_at, created_at) on public.profiles to authenticated;
grant update (role, suspended_at, banned_at, moderation_note, updated_at) on public.profiles to authenticated;

create index profiles_role_idx on public.profiles (role);
create index content_reports_status_created_idx on public.content_reports (status, created_at desc);
create index content_reports_subject_idx on public.content_reports (subject_type, subject_id);
create index moderation_actions_actor_created_idx on public.moderation_actions (actor_id, created_at desc);
create index moderation_actions_target_idx on public.moderation_actions (target_user_id, created_at desc);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

insert into public.profiles (
  id,
  username,
  display_name,
  account_type,
  role,
  created_at,
  updated_at
)
select
  users.id,
  'lobosden',
  coalesce(users.raw_user_meta_data ->> 'full_name', 'Lobosden'),
  'enthusiast'::public.account_type,
  'owner'::public.user_role,
  now(),
  now()
from auth.users
where lower(users.email) = 'lobosden@hotmail.com'
on conflict (id) do update
set role = 'owner',
    updated_at = now();
