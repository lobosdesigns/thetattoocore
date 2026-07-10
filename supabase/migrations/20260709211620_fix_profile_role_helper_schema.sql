-- Keep profile protection wired to the private admin helper functions.

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

    if not private.current_user_can_moderate() then
      new.license_verified_at := null;
      new.license_verified_by := null;
      new.license_verification_request_id := null;
    end if;

    return new;
  end if;

  if new.role is distinct from old.role and not private.current_user_is_owner() then
    raise exception 'Only owners can change profile roles.';
  end if;

  if (
    new.license_verified_at is distinct from old.license_verified_at
    or new.license_verified_by is distinct from old.license_verified_by
    or new.license_verification_request_id is distinct from old.license_verification_request_id
  ) and not private.current_user_can_moderate() then
    raise exception 'Only moderators can change profile verification.';
  end if;

  return new;
end;
$$;
