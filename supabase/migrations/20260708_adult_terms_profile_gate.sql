alter table public.profiles
  add column if not exists is_adult_confirmed boolean not null default false,
  add column if not exists adult_terms_accepted_at timestamptz;

create index if not exists profiles_adult_terms_idx
  on public.profiles (is_adult_confirmed, adult_terms_accepted_at);
