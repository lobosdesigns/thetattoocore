-- Resolve the public.public_profiles SECURITY DEFINER advisor finding without
-- restoring anonymous access to public.profiles.
--
-- The dedicated projection contains only the existing public view columns. A
-- privileged trigger keeps that derived surface synchronized while the public
-- view executes as SECURITY INVOKER. No source profile data is moved or
-- deleted, so the projection infrastructure can be removed without data loss
-- after first restoring an independently safe public read path.

begin;

-- Reassert the anonymous base-table boundary, including any legacy
-- column-level grants that a table-level REVOKE does not remove.
revoke all privileges on table public.profiles
from anon;

do $$
declare
  profile_column record;
begin
  for profile_column in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.profiles from anon',
      profile_column.column_name
    );
  end loop;
end;
$$;

create schema profile_projection;

revoke all on schema profile_projection
from public, anon, authenticated, service_role;

grant usage on schema profile_projection
to anon, authenticated, service_role;

create table profile_projection.public_profiles (
  id uuid primary key,
  username text not null unique,
  display_name text not null,
  account_type public.account_type not null,
  bio text,
  avatar_url text,
  banner_url text,
  city text,
  region text,
  country text,
  website_url text,
  instagram_url text,
  tiktok_url text,
  facebook_url text,
  youtube_url text,
  x_url text,
  shop_profile_id uuid,
  license_verified_at timestamptz,
  followers_visibility text not null,
  following_visibility text not null,
  comment_permission text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index public_profile_projection_shop_profile_idx
  on profile_projection.public_profiles (shop_profile_id)
  where shop_profile_id is not null;

alter table profile_projection.public_profiles enable row level security;

create policy "Public profile projection is readable"
  on profile_projection.public_profiles
  for select
  to anon, authenticated
  using (true);

revoke all privileges on table profile_projection.public_profiles
from public, anon, authenticated, service_role;

grant select on table profile_projection.public_profiles
to anon, authenticated, service_role;

create function profile_projection.sync_public_profile_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from profile_projection.public_profiles
    where id = old.id;

    return old;
  end if;

  if tg_op = 'UPDATE' and old.id is distinct from new.id then
    delete from profile_projection.public_profiles
    where id = old.id;
  end if;

  if new.is_private = false
    and new.suspended_at is null
    and new.banned_at is null
    and pg_catalog.lower(new.username) not in (
      'checkouttest',
      'qa_android_dm',
      'ttc_reviewer',
      'ttc_tester'
    )
  then
    insert into profile_projection.public_profiles (
      id,
      username,
      display_name,
      account_type,
      bio,
      avatar_url,
      banner_url,
      city,
      region,
      country,
      website_url,
      instagram_url,
      tiktok_url,
      facebook_url,
      youtube_url,
      x_url,
      shop_profile_id,
      license_verified_at,
      followers_visibility,
      following_visibility,
      comment_permission,
      created_at,
      updated_at
    ) values (
      new.id,
      new.username,
      new.display_name,
      new.account_type,
      new.bio,
      new.avatar_url,
      new.banner_url,
      new.city,
      new.region,
      new.country,
      new.website_url,
      new.instagram_url,
      new.tiktok_url,
      new.facebook_url,
      new.youtube_url,
      new.x_url,
      new.shop_profile_id,
      new.license_verified_at,
      new.followers_visibility,
      new.following_visibility,
      new.comment_permission,
      new.created_at,
      new.updated_at
    )
    on conflict (id) do update
    set
      username = excluded.username,
      display_name = excluded.display_name,
      account_type = excluded.account_type,
      bio = excluded.bio,
      avatar_url = excluded.avatar_url,
      banner_url = excluded.banner_url,
      city = excluded.city,
      region = excluded.region,
      country = excluded.country,
      website_url = excluded.website_url,
      instagram_url = excluded.instagram_url,
      tiktok_url = excluded.tiktok_url,
      facebook_url = excluded.facebook_url,
      youtube_url = excluded.youtube_url,
      x_url = excluded.x_url,
      shop_profile_id = excluded.shop_profile_id,
      license_verified_at = excluded.license_verified_at,
      followers_visibility = excluded.followers_visibility,
      following_visibility = excluded.following_visibility,
      comment_permission = excluded.comment_permission,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  else
    delete from profile_projection.public_profiles
    where id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function profile_projection.sync_public_profile_projection()
from public, anon, authenticated, service_role;

create trigger sync_public_profile_projection
after insert or update or delete on public.profiles
for each row
execute function profile_projection.sync_public_profile_projection();

insert into profile_projection.public_profiles (
  id,
  username,
  display_name,
  account_type,
  bio,
  avatar_url,
  banner_url,
  city,
  region,
  country,
  website_url,
  instagram_url,
  tiktok_url,
  facebook_url,
  youtube_url,
  x_url,
  shop_profile_id,
  license_verified_at,
  followers_visibility,
  following_visibility,
  comment_permission,
  created_at,
  updated_at
)
select
  id,
  username,
  display_name,
  account_type,
  bio,
  avatar_url,
  banner_url,
  city,
  region,
  country,
  website_url,
  instagram_url,
  tiktok_url,
  facebook_url,
  youtube_url,
  x_url,
  shop_profile_id,
  license_verified_at,
  followers_visibility,
  following_visibility,
  comment_permission,
  created_at,
  updated_at
from public.profiles
where is_private = false
  and suspended_at is null
  and banned_at is null
  and pg_catalog.lower(username) not in (
    'checkouttest',
    'qa_android_dm',
    'ttc_reviewer',
    'ttc_tester'
  )
on conflict (id) do update
set
  username = excluded.username,
  display_name = excluded.display_name,
  account_type = excluded.account_type,
  bio = excluded.bio,
  avatar_url = excluded.avatar_url,
  banner_url = excluded.banner_url,
  city = excluded.city,
  region = excluded.region,
  country = excluded.country,
  website_url = excluded.website_url,
  instagram_url = excluded.instagram_url,
  tiktok_url = excluded.tiktok_url,
  facebook_url = excluded.facebook_url,
  youtube_url = excluded.youtube_url,
  x_url = excluded.x_url,
  shop_profile_id = excluded.shop_profile_id,
  license_verified_at = excluded.license_verified_at,
  followers_visibility = excluded.followers_visibility,
  following_visibility = excluded.following_visibility,
  comment_permission = excluded.comment_permission,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

create or replace view public.public_profiles
with (security_invoker = true)
as
select
  id,
  username,
  display_name,
  account_type,
  bio,
  avatar_url,
  banner_url,
  city,
  region,
  country,
  website_url,
  instagram_url,
  tiktok_url,
  facebook_url,
  youtube_url,
  x_url,
  shop_profile_id,
  license_verified_at,
  followers_visibility,
  following_visibility,
  comment_permission,
  created_at,
  updated_at
from profile_projection.public_profiles;

comment on view public.public_profiles is
  'Curated public profile read surface backed by a synchronized allowlisted projection. The view executes with caller privileges; anonymous direct public.profiles access remains denied.';

revoke all privileges on table public.public_profiles
from public, anon, authenticated, service_role;

grant select on table public.public_profiles
to anon, authenticated, service_role;

-- These checkout lifecycle functions are service-only and already fully
-- qualify every referenced relation. Remove the writable public schema from
-- their name-resolution path without changing their bodies or grants.
alter function public.reserve_merch_inventory_for_order(uuid)
  set search_path = '';
alter function public.release_merch_inventory_for_order(uuid)
  set search_path = '';
alter function public.cancel_unpaid_merch_order(uuid, text)
  set search_path = '';
alter function public.mark_problem_merch_order_for_checkout(
  text,
  text,
  text,
  text,
  jsonb,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) set search_path = '';
alter function public.mark_paid_merch_order_for_checkout(
  text,
  text,
  text,
  jsonb,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) set search_path = '';

commit;
