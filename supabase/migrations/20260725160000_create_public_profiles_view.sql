-- Phase 1 profile-access hardening: additive compatibility layer only.
--
-- This migration intentionally does not revoke, drop, or alter any existing
-- public.profiles grants or RLS policies. Broad base-table access remains
-- temporarily active until every public application query has been migrated
-- and production compatibility has been verified.
--
-- The internal/test/reviewer username exclusion list must stay synchronized
-- with src/lib/profile-indexing.ts. The profile-access smoke guard fails when
-- these SQL values drift from the application indexing guard.

create view public.public_profiles
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
from public.profiles
where is_private = false
  and suspended_at is null
  and banned_at is null
  and lower(username) not in (
    'checkouttest',
    'qa_android_dm',
    'ttc_reviewer',
    'ttc_tester'
  );

comment on view public.public_profiles is
  'Curated public profile read surface. Phase 1 is additive only; public.profiles access remains temporarily unchanged until compatible application code is deployed and verified.';

grant select on public.public_profiles to anon, authenticated;
