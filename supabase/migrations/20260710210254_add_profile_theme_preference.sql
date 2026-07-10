alter table public.profiles
  add column if not exists theme_preference text not null default 'system';

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('light', 'dark', 'system'));

grant select (theme_preference) on public.profiles to anon, authenticated;
grant update (theme_preference, updated_at) on public.profiles to authenticated;
