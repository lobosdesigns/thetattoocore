-- Create a starter profile whenever a Supabase Auth user signs up.

create or replace function public.handle_new_user_profile()
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

revoke all on function public.handle_new_user_profile() from public;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

grant select, insert, update on public.profiles to authenticated;
