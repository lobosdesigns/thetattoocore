-- Enforce moderation and owner-account invariants at the profile table boundary.

create or replace function public.protect_profile_role_changes()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  actor_id uuid := auth.uid();
  actor_can_moderate boolean :=
    current_user = 'service_role'
    or coalesce(private.current_user_can_moderate(), false);
  moderation_changed boolean;
begin
  if tg_op = 'INSERT' then
    if session_user not in ('postgres', 'supabase_admin')
      and not private.current_user_is_owner()
    then
      new.role := 'user';
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

  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.role is distinct from old.role and not private.current_user_is_owner() then
    raise exception 'Only owners can change profile roles.';
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

update public.profiles
set
  suspended_at = null,
  banned_at = null,
  moderation_note = null
where role = 'owner'
  and (
    suspended_at is not null
    or banned_at is not null
    or moderation_note is not null
  );
