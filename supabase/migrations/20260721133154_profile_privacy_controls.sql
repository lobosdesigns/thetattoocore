alter table public.profiles
  add column if not exists followers_visibility text not null default 'public',
  add column if not exists following_visibility text not null default 'public',
  add column if not exists comment_permission text not null default 'everyone';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_followers_visibility_check'
  ) then
    alter table public.profiles
      add constraint profiles_followers_visibility_check
      check (followers_visibility in ('public', 'followers', 'private'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_following_visibility_check'
  ) then
    alter table public.profiles
      add constraint profiles_following_visibility_check
      check (following_visibility in ('public', 'followers', 'private'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_comment_permission_check'
  ) then
    alter table public.profiles
      add constraint profiles_comment_permission_check
      check (comment_permission in ('everyone', 'followers', 'none'));
  end if;
end $$;
