alter table public.profiles
  add column if not exists shop_profile_id uuid
    references public.profiles(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_shop_profile_not_self;

alter table public.profiles
  add constraint profiles_shop_profile_not_self
  check (shop_profile_id is null or shop_profile_id <> id);

create index if not exists profiles_shop_profile_idx
  on public.profiles (shop_profile_id)
  where shop_profile_id is not null;
