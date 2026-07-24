-- Enforce role hierarchy and keep owner assignment out of ordinary admin flows.

create or replace function public.protect_profile_role_changes()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_service boolean :=
    current_user = 'service_role'
    or coalesce(auth.role(), '') = 'service_role';
  actor_can_moderate boolean := false;
  actor_role public.user_role := 'user';
  moderation_changed boolean;
begin
  actor_can_moderate := actor_is_service;

  if not actor_can_moderate then
    actor_can_moderate := coalesce(private.current_user_can_moderate(), false);
  end if;

  if tg_op = 'INSERT' then
    if session_user not in ('postgres', 'supabase_admin') then
      if new.role = 'owner' then
        new.role := 'user';
      elsif not actor_is_service and not private.current_user_is_owner() then
        new.role := 'user';
      end if;
    end if;

    if new.role = 'owner' or not actor_can_moderate then
      new.suspended_at := null;
      new.banned_at := null;
      new.moderation_note := null;
    end if;

    if not actor_can_moderate then
      new.license_verified_at := null;
      new.license_verified_by := null;
      new.license_verification_request_id := null;
    end if;

    return new;
  end if;

  moderation_changed :=
    new.suspended_at is distinct from old.suspended_at
    or new.banned_at is distinct from old.banned_at
    or new.moderation_note is distinct from old.moderation_note;

  if (old.role = 'owner' or new.role = 'owner') and (
    new.suspended_at is not null
    or new.banned_at is not null
    or new.moderation_note is not null
  ) then
    raise exception 'Owner accounts cannot have moderation restrictions.';
  end if;

  if actor_id is not null and actor_id = old.id and (
    new.suspended_at is distinct from old.suspended_at
    or new.banned_at is distinct from old.banned_at
  ) then
    raise exception 'Accounts cannot change their own moderation restrictions.';
  end if;

  if moderation_changed and not actor_can_moderate then
    raise exception 'Only moderators can change profile moderation.';
  end if;

  if moderation_changed
    and not actor_is_service
    and session_user not in ('postgres', 'supabase_admin')
  then
    actor_role := private.current_profile_role();

    if not (
      (actor_role = 'moderator' and old.role = 'user')
      or (actor_role = 'admin' and old.role in ('user', 'moderator'))
      or (actor_role = 'owner' and old.role in ('user', 'moderator', 'admin'))
    ) then
      raise exception 'Moderators can only change lower-role account moderation.';
    end if;
  end if;

  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.role is distinct from old.role then
    if old.role = 'owner' then
      raise exception 'Owner accounts cannot be demoted.';
    end if;

    if new.role = 'owner' then
      raise exception 'Owner assignment requires a separate ownership transfer.';
    end if;

    if not private.current_user_is_owner() then
      raise exception 'Only owners can change profile roles.';
    end if;
  end if;

  if (
    new.license_verified_at is distinct from old.license_verified_at
    or new.license_verified_by is distinct from old.license_verified_by
    or new.license_verification_request_id is distinct from old.license_verification_request_id
  ) and not actor_can_moderate then
    raise exception 'Only moderators can change profile verification.';
  end if;

  return new;
end;
$$;
