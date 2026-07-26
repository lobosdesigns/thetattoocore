-- Restrict the Phase 1 public profile compatibility view to read-only access
-- for client roles.
--
-- Existing default privileges granted broad relation privileges when the view
-- was created. This correction only touches public.public_profiles and does
-- not alter public.profiles grants, RLS policies, default privileges, data, or
-- service_role/postgres privileges.

begin;

revoke all privileges on table public.public_profiles
from anon, authenticated;

grant select on table public.public_profiles
to anon, authenticated;

commit;
