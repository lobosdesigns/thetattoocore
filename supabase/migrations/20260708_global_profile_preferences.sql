alter table public.profiles
  add column if not exists preferred_language text not null default 'en',
  add column if not exists country_code text not null default 'US',
  add column if not exists location_personalization_enabled boolean not null default true;

update public.profiles
set country_code = upper(left(coalesce(nullif(country, ''), country_code, 'US'), 2))
where country_code = 'US'
  and country is not null
  and country <> '';

alter table public.profiles
  drop constraint if exists profiles_preferred_language_check,
  drop constraint if exists profiles_country_code_check;

alter table public.profiles
  add constraint profiles_preferred_language_check
  check (preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  add constraint profiles_country_code_check
  check (country_code ~ '^[A-Z]{2}$');

create index if not exists profiles_country_code_idx
  on public.profiles (country_code);

create index if not exists profiles_preferred_language_idx
  on public.profiles (preferred_language);
