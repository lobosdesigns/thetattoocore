-- Public-safe artist/studio verification badge fields.

alter table public.profiles
  add column if not exists license_verified_at timestamptz,
  add column if not exists license_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists license_verification_request_id uuid references public.license_verification_requests(id) on delete set null;

create index if not exists profiles_license_verified_idx
  on public.profiles (license_verified_at desc)
  where license_verified_at is not null;

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

    if not public.current_user_can_moderate() then
      new.license_verified_at := null;
      new.license_verified_by := null;
      new.license_verification_request_id := null;
    end if;

    return new;
  end if;

  if new.role is distinct from old.role and not public.current_user_is_owner() then
    raise exception 'Only owners can change profile roles.';
  end if;

  if (
    new.license_verified_at is distinct from old.license_verified_at
    or new.license_verified_by is distinct from old.license_verified_by
    or new.license_verification_request_id is distinct from old.license_verification_request_id
  ) and not public.current_user_can_moderate() then
    raise exception 'Only moderators can change profile verification.';
  end if;

  return new;
end;
$$;

grant select (
  license_verified_at,
  license_verified_by,
  license_verification_request_id
) on public.profiles to anon, authenticated;

grant update (
  license_verified_at,
  license_verified_by,
  license_verification_request_id,
  updated_at
) on public.profiles to authenticated;
