-- Keep the owner profile outside every account-deletion path.

create or replace function public.protect_owner_profile_deletion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.role = 'owner' then
    raise exception 'Owner accounts cannot be deleted.';
  end if;

  return old;
end;
$$;

revoke all on function public.protect_owner_profile_deletion() from public;

drop trigger if exists protect_owner_profile_deletion on public.profiles;

create trigger protect_owner_profile_deletion
before delete on public.profiles
for each row
execute function public.protect_owner_profile_deletion();
