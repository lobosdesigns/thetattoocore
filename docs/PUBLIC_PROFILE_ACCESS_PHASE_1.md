# Public Profile Access Certification Boundary

The Phase 1 certification repair keeps public profile reads on `public.public_profiles` and revokes anonymous direct access to `public.profiles`. Its base-table restriction migration is `supabase/migrations/20260726010000_restrict_anonymous_profile_base_table_access.sql`.

The release-candidate follow-up is `supabase/migrations/20260804052000_secure_public_profiles_projection.sql`. It resolves the Supabase `SECURITY DEFINER` view advisory without reopening the base table: a trigger synchronizes the same allowlisted columns into `profile_projection.public_profiles`, row-level security remains enabled on that derived table, and `public.public_profiles` becomes a `security_invoker = true` view over the projection. The dedicated `profile_projection` schema grants client roles `USAGE` but not `CREATE`, and the projection table grants read-only access; this does not depend on access to the shared `private` schema. The privileged `profile_projection.sync_public_profile_projection()` function uses an empty `search_path` and is not executable by `public`, `anon`, `authenticated`, or `service_role`.

This repository change does not apply that migration to production. After a separately approved application, rerun the Supabase security advisor and the verification queries below before treating the live warning as resolved.

Supabase CLI was not installed in this Windows environment, so both profile-boundary migrations were created manually instead of with `supabase migration new`.

Do not use supabase db push for this work. Apply only the reviewed forward-only migrations that have not already been applied.

## View contract

`public.public_profiles` exposes only public discovery fields: profile identity, display metadata, public location/social links, shop-profile linkage, verification timestamp, public list/comment visibility settings, and timestamps. It filters private, suspended, banned, and internal/test/reviewer profiles using the same usernames exported from `src/lib/profile-indexing.ts`.

Anonymous clients receive only the curated profile fields through `public.public_profiles`. Anonymous direct `select` on `public.profiles` stays revoked, including previous column grants for banner, verification, and theme fields. Phase 1 temporarily switched the view away from `security_invoker` after base-table access was denied; the release-candidate follow-up restores invoker security against the allowlisted projection rather than the sensitive base table.

The projection is derived data, not a second source of truth. Inserts, updates, visibility/moderation changes, and deletes on `public.profiles` synchronize in the same transaction. Direct owner operations that deliberately disable triggers can make the projection stale and require a reviewed reconciliation before public traffic is certified.

## Unresolved authenticated base-table exposure — release blocker

The pre-existing `20260726010000_restrict_anonymous_profile_base_table_access.sql` migration grants authenticated clients table-level `SELECT` on `public.profiles`. Its authenticated RLS policy permits every eligible public profile row in addition to the caller's own row and moderator access. Because RLS limits rows rather than columns, a signed-in client can still request sensitive base-table columns for those public rows instead of using the curated projection.

The release-candidate projection migration does not close that authenticated full-column path, and this recovery deliberately preserves authenticated/admin consumers rather than revoking access underneath them. Public release remains blocked until a separate reviewed change inventories every authenticated/admin base-profile consumer, replaces broad reads with curated views or narrowly authorized owner/moderator interfaces, removes the broad authenticated column privilege, and proves owner/admin behavior plus direct signed-in malicious-query denial. Do not revoke the grant ad hoc in this recovery; doing so would break existing owner and moderation paths without a completed replacement.

## Release-candidate verification

The deterministic database contract starts a disposable local PostgreSQL cluster and proves backfill, anonymous/authenticated projection reads without shared `private`-schema access, dedicated-schema `USAGE` without `CREATE`, exact column allowlisting, RLS, private/suspended/banned/internal exclusion, update/delete synchronization, denied anonymous base-table reads, denied trigger-function execution, and empty `search_path` on the service-only merch lifecycle functions. It passed on locally available PostgreSQL 18.4; exact PostgreSQL 17 runtime verification remains outstanding:

```powershell
node scripts/test-public-profile-projection-db-contracts.mjs
```

After an approved production migration, also verify live state without changing data:

```sql
select option_value
from pg_class
cross join lateral pg_options_to_table(coalesce(reloptions, array[]::text[]))
where oid = 'public.public_profiles'::regclass
  and option_name = 'security_invoker';

select has_table_privilege('anon', 'public.profiles', 'select');
select has_any_column_privilege('anon', 'public.profiles', 'select');
select has_table_privilege('anon', 'public.public_profiles', 'select');

select
  pg_get_userbyid((select nspowner from pg_namespace where nspname = 'profile_projection')) as schema_owner,
  pg_get_userbyid((select relowner from pg_class where oid = 'profile_projection.public_profiles'::regclass)) as projection_owner,
  pg_get_userbyid((select relowner from pg_class where oid = 'public.public_profiles'::regclass)) as view_owner,
  pg_get_userbyid((select proowner from pg_proc where oid = 'profile_projection.sync_public_profile_projection()'::regprocedure)) as function_owner;

select
  has_schema_privilege('anon', 'profile_projection', 'usage') as anon_usage,
  has_schema_privilege('anon', 'profile_projection', 'create') as anon_create,
  has_function_privilege('anon', 'profile_projection.sync_public_profile_projection()', 'execute') as anon_sync_execute;
```

Expected results are `true`, `false`, `false`, and `true`, respectively. A
single trusted migration/admin role must own the dedicated schema, projection
table, public view, and synchronization function; none may be owned by `anon`,
`authenticated`, or `service_role`. The final privilege row must be `true`,
`false`, and `false`. A fresh Supabase security-advisor result is still
required; repository SQL and a disposable database cannot certify live
ownership, grants, migration history, or advisor state.

## Forward repair procedure

If the projection migration is applied and any projection, trigger, grant, ownership, or view defect is found, repair forward in this order:

1. Stop the public rollout and hold further production migrations or deploys. Record the active Worker/version and the exact applied migration state before changing anything.
2. Preserve `public.profiles` as the source of truth. Take the approved backup/evidence snapshot and do not delete, truncate, rewrite, or move base profile data to repair the derived projection.
3. Measure the expected eligible-profile set from `public.profiles` with the reviewed public/private, suspension, ban, and internal-username predicates. Compare IDs and counts with `profile_projection.public_profiles`; retain the mismatch evidence.
4. Create a new timestamped, forward-only migration. Do not edit an already-applied migration or drop migration-history rows ad hoc. In one reviewed transaction, replace or correct the projection table policy/grants, synchronization function and trigger, and `public.public_profiles` view as needed, then reconcile derived rows from `public.profiles` with an allowlisted `insert ... select ... on conflict do update` plus removal of rows that are no longer eligible.
5. Re-run the deterministic database contract and live read-only checks for exact columns, eligible IDs/counts, schema `USAGE` without `CREATE`, table/view grants, RLS, admin ownership, denied client execution of the trigger function, and denied anonymous base-table reads. Confirm representative inserts, updates, privacy/moderation changes, and deletes synchronize correctly.
6. Re-run the live Supabase security advisor and targeted signed-out route smoke. Resume the rollout only after the new migration, grants, counts, ownership, synchronization, app behavior, and advisor result all pass and the evidence is recorded.

Never repair this boundary by granting anonymous access to `public.profiles`, granting `CREATE` on `profile_projection`, granting trigger-function execution to a client role, editing applied migration history, or dropping the source table. The projection is disposable derived data; `public.profiles` is not.

## Updated public reads

- `src/app/sitemap.ts`: profile URL discovery now reads from `public_profiles`; internal/test/reviewer filtering moved into the view. Gossip thread discovery no longer references nonexistent `thread_posts.is_published`. Merch discovery now selects `seller_id` and verifies seller eligibility through a separate `public_profiles` lookup.
- `src/app/search/page.tsx`: public profile search, batched shop-profile lookup, and search result-card hydration now read from `public_profiles`. Merch search no longer runs `ILIKE` against the enum `category` column.
- `src/app/page.tsx`: signed-out ad, feed, Gossip, Stuff, Gig, Merch, story-author, and tagged-profile display data now selects relationship IDs and reconstructs the existing nested profile shapes from `public_profiles`.
- `src/app/merch/page.tsx`: signed-out sponsored-ad and seller cards now hydrate advertisers and sellers from `public_profiles` while preserving the Merch filtering and pagination lifecycle.
- `src/app/help/[slug]/page.tsx`: public help comments now select `author_id` and hydrate display profiles from `public_profiles`.
- `src/app/u/[username]/page.tsx`: metadata and the primary public profile path read from `public_profiles`; the old base-table fallback was removed so internal/test/private profiles return real 404s to anonymous visitors. Public content tags and Merch seller cards now hydrate through `public_profiles`; the owner-authenticated pending-follow request embed remains protected by its explicit owner check.

## Direct public.profiles read inventory requiring redesign

These paths explain why the broad authenticated grant cannot be revoked safely in
this recovery. They are inventory, not certification that authenticated direct
reads are column-safe: the existing authenticated table grant and row policy
remain the release blocker described above. Owner, moderator, relationship, and
service consumers need narrower replacement interfaces before that grant is
removed.

- `src/app/account/actions.ts`: owner account/profile update and settings path.
- `src/app/account/page.tsx`: owner account/settings display path.
- `src/app/actions.ts`: authenticated content/action helpers and author/tag relationship reads.
- `src/app/admin/actions.ts`: admin moderation and management paths.
- `src/app/admin/ads/page.tsx`: admin ad management context.
- `src/app/admin/content/page.tsx`: admin content moderation context.
- `src/app/admin/data-requests/page.tsx`: admin data-request context.
- `src/app/admin/gigs/page.tsx`: admin gig moderation context.
- `src/app/admin/mail-settings/page.tsx`: admin mail settings context.
- `src/app/admin/media-ops/page.tsx`: admin media operations context.
- `src/app/admin/merch/page.tsx`: admin merchandise context.
- `src/app/admin/page.tsx`: admin dashboard context.
- `src/app/admin/payments/page.tsx`: admin payment operations context.
- `src/app/admin/reports/page.tsx`: admin report moderation context.
- `src/app/admin/stuff/page.tsx`: admin marketplace moderation context.
- `src/app/admin/users/page.tsx`: admin user management context.
- `src/app/admin/verification/page.tsx`: admin verification review context.
- `src/app/api/admin/mail/test/route.ts`: admin/service mail test route.
- `src/app/api/gigs/route.ts`: authenticated/API compatibility route.
- `src/app/api/push/devices/route.ts`: authenticated push device ownership path.
- `src/app/api/push/devices/test/route.ts`: test push device path.
- `src/app/api/push/subscriptions/route.ts`: authenticated push subscription path.
- `src/app/api/stripe/connect/onboarding/route.ts`: payment onboarding owner path.
- `src/app/api/stripe/webhook/route.ts`: payment webhook/service role path.
- `scripts/test-seller-checkout-links.mjs`: test-only seller checkout profile fixture and query contract.
- `src/app/gigs/[id]/page.tsx`: authenticated viewer context.
- `src/app/layout.tsx`: authenticated viewer shell/profile state.
- `src/app/merch/page.tsx`: marketplace compatibility and seller context.
- `src/app/messages/actions.ts`: authenticated DM identity and relationship path.
- `src/app/messages/page.tsx`: authenticated DM identity path.
- `src/app/notifications/actions.ts`: authenticated notification identity path.
- `src/app/notifications/page.tsx`: authenticated notification display path.
- `src/app/p/[id]/page.tsx`: public post page profile joins classified below.
- `src/app/page.tsx`: authenticated viewer profile and personalization context.
- `src/app/saved/page.tsx`: authenticated saved-items display path.
- `src/app/settings/page.tsx`: owner settings path.
- `src/app/stuff/[id]/page.tsx`: marketplace detail author/shop context.
- `src/app/t/[id]/page.tsx`: thread detail profile joins classified below.
- `src/app/u/[username]/actions.ts`: follow/block/profile action owner and relationship path.
- `src/lib/tag-audience.ts`: authenticated tag-audience helper.

## Repaired public profile reads

- `src/app/u/[username]/follow-list-page.tsx`: repaired in Phase 1A; route header and row display profiles now read from `public_profiles`, while `follows` supplies relationship IDs and counts.

## Remaining embedded profiles:profiles joins

These joins remain classified because each query must be reviewed with its parent table RLS, relationship visibility, ordering, and generated Supabase select shape before replacing it with view-backed alternatives:

- `scripts/test-messaging-notifications-contracts.mjs`
- `src/app/actions.ts`
- `src/app/admin/actions.ts`
- `src/app/admin/ads/page.tsx`
- `src/app/admin/content/page.tsx`
- `src/app/admin/data-requests/page.tsx`
- `src/app/admin/gigs/page.tsx`
- `src/app/admin/merch/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/payments/page.tsx`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/stuff/page.tsx`
- `src/app/admin/verification/page.tsx`
- `src/app/api/merch/checkout/route.ts`
- `src/app/notifications/page.tsx`
- `src/app/saved/page.tsx`
- `src/app/u/[username]/page.tsx`

## Enforcement notes

Before enforcing CSP, observe Report-Only violations from production pages that use Next.js runtime assets, Stripe checkout, Supabase REST/auth/storage, media delivery, analytics, and Cloudflare routing. Enforcement should only happen after violations are understood and the allowlist is narrowed without breaking login, signup, checkout status, public media, or static assets.
