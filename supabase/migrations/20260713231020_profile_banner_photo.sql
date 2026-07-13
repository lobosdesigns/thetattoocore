alter table public.profiles
  add column if not exists banner_url text;

grant select (banner_url) on public.profiles to anon, authenticated;
grant update (banner_url, updated_at) on public.profiles to authenticated;
