-- Move privileged helper functions out of the exposed public schema.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_profile_role()
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

create or replace function private.current_user_can_moderate()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select private.current_profile_role() in ('moderator', 'admin', 'owner');
$$;

create or replace function private.current_user_can_admin()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select private.current_profile_role() in ('admin', 'owner');
$$;

create or replace function private.current_user_is_owner()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select private.current_profile_role() = 'owner';
$$;

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    username,
    display_name,
    account_type,
    created_at,
    updated_at
  )
  values (
    new.id,
    'user_' || left(replace(new.id::text, '-', ''), 12),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'New member'
    ),
    'enthusiast'::public.account_type,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.current_profile_role() from public, anon;
revoke all on function private.current_user_can_moderate() from public, anon;
revoke all on function private.current_user_can_admin() from public, anon;
revoke all on function private.current_user_is_owner() from public, anon;
revoke all on function private.handle_new_user_profile() from public, anon, authenticated;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.current_user_can_moderate() to authenticated;
grant execute on function private.current_user_can_admin() to authenticated;
grant execute on function private.current_user_is_owner() to authenticated;

create or replace function public.protect_profile_role_changes()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not private.current_user_is_owner() then
      new.role := 'user';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and not private.current_user_is_owner() then
    raise exception 'Only owners can change profile roles.';
  end if;

  return new;
end;
$$;

drop policy if exists "Moderators can update profiles" on public.profiles;
create policy "Moderators can update profiles"
  on public.profiles for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

drop policy if exists "Users can view own reports" on public.content_reports;
create policy "Users can view own reports"
  on public.content_reports for select
  to authenticated
  using ((select auth.uid()) = reporter_id or private.current_user_can_moderate());

drop policy if exists "Moderators can update reports" on public.content_reports;
create policy "Moderators can update reports"
  on public.content_reports for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

drop policy if exists "Moderators can view moderation actions" on public.moderation_actions;
create policy "Moderators can view moderation actions"
  on public.moderation_actions for select
  to authenticated
  using (private.current_user_can_moderate());

drop policy if exists "Moderators can create moderation actions" on public.moderation_actions;
create policy "Moderators can create moderation actions"
  on public.moderation_actions for insert
  to authenticated
  with check (private.current_user_can_moderate() and actor_id = (select auth.uid()));

drop policy if exists "Admins can view audit logs" on public.admin_audit_logs;
create policy "Admins can view audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using (private.current_user_can_admin());

drop policy if exists "Admins can create audit logs" on public.admin_audit_logs;
create policy "Admins can create audit logs"
  on public.admin_audit_logs for insert
  to authenticated
  with check (private.current_user_can_admin() and (actor_id is null or actor_id = (select auth.uid())));

drop policy if exists "Admins can view mail settings" on public.mail_settings;
create policy "Admins can view mail settings"
  on public.mail_settings for select
  to authenticated
  using (private.current_user_can_admin());

drop policy if exists "Admins can update mail settings" on public.mail_settings;
create policy "Admins can update mail settings"
  on public.mail_settings for update
  to authenticated
  using (private.current_user_can_admin())
  with check (private.current_user_can_admin());

drop policy if exists "Moderators can review feed posts" on public.feed_posts;
create policy "Moderators can review feed posts"
  on public.feed_posts for select
  to authenticated
  using (private.current_user_can_moderate());

drop policy if exists "Moderators can update feed posts" on public.feed_posts;
create policy "Moderators can update feed posts"
  on public.feed_posts for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

drop policy if exists "Moderators can review comments" on public.post_comments;
create policy "Moderators can review comments"
  on public.post_comments for select
  to authenticated
  using (private.current_user_can_moderate());

drop policy if exists "Moderators can update comments" on public.post_comments;
create policy "Moderators can update comments"
  on public.post_comments for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

drop policy if exists "Moderators can review thread posts" on public.thread_posts;
create policy "Moderators can review thread posts"
  on public.thread_posts for select
  to authenticated
  using (private.current_user_can_moderate());

drop policy if exists "Moderators can update thread posts" on public.thread_posts;
create policy "Moderators can update thread posts"
  on public.thread_posts for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

drop policy if exists "Moderators can review marketplace listings" on public.marketplace_listings;
create policy "Moderators can review marketplace listings"
  on public.marketplace_listings for select
  to authenticated
  using (private.current_user_can_moderate());

drop policy if exists "Moderators can update marketplace listings" on public.marketplace_listings;
create policy "Moderators can update marketplace listings"
  on public.marketplace_listings for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function private.handle_new_user_profile();

drop function if exists public.current_user_is_owner();
drop function if exists public.current_user_can_admin();
drop function if exists public.current_user_can_moderate();
drop function if exists public.current_profile_role();
drop function if exists public.handle_new_user_profile();
