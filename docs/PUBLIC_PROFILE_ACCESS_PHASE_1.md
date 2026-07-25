# Public Profile Access Phase 1

Phase 1 is additive only. It introduces `public.public_profiles` as a curated, security-invoker view for public profile reads while `public.profiles` access remains temporarily active for compatibility. No base-table revokes, policy changes, live Supabase writes, deployment, or migration-history repair are part of this phase.

For Phase 1 compatibility, public.profiles access remains temporarily active. No base-table revokes are included.

Do not use supabase db push for this work. The reviewed forward-only migration is `supabase/migrations/20260725160000_create_public_profiles_view.sql`; applying it to live Supabase is a later approved implementation task after this diff and validation pass.

## View contract

`public.public_profiles` exposes only public discovery fields: profile identity, display metadata, public location/social links, shop-profile linkage, verification timestamp, public list/comment visibility settings, and timestamps. It filters private, suspended, banned, and internal/test/reviewer profiles using the same usernames exported from `src/lib/profile-indexing.ts`.

The migration grants only `select` on the view to `anon` and `authenticated`. It intentionally does not revoke, drop, alter, update, insert, or delete anything on `public.profiles`.

## Updated public reads

- `src/app/sitemap.ts`: profile URL discovery now reads from `public_profiles`; internal/test/reviewer filtering moved into the view.
- `src/app/search/page.tsx`: public profile search and batched shop-profile lookup now read from `public_profiles`; the existing private-profile compatibility query remains isolated to viewer-visible private profile ids.
- `src/app/u/[username]/page.tsx`: metadata and the primary public profile path read from `public_profiles`; the base-table fallback remains for private profile compatibility; public shop/linked-artist lookups now read from `public_profiles`.

## Remaining direct public.profiles reads

These remain classified for later phases because they are owner, admin, authenticated relationship, service-route, or compatibility paths that should not be changed until the view is deployed and production behavior is verified:

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
- `src/app/gigs/[id]/page.tsx`: public page still has author/tag embedded profile joins classified below; direct owner-safe profile reads should be handled after the view is live.
- `src/app/layout.tsx`: authenticated viewer shell/profile state.
- `src/app/merch/page.tsx`: marketplace compatibility and seller context.
- `src/app/messages/actions.ts`: authenticated DM identity and relationship path.
- `src/app/messages/page.tsx`: authenticated DM identity path.
- `src/app/notifications/actions.ts`: authenticated notification identity path.
- `src/app/notifications/page.tsx`: authenticated notification display path.
- `src/app/p/[id]/page.tsx`: public post page profile joins classified below.
- `src/app/page.tsx`: homepage embedded author/profile joins classified below.
- `src/app/saved/page.tsx`: authenticated saved-items display path.
- `src/app/search/page.tsx`: isolated visible-private-profile compatibility query remains; public search query uses the view.
- `src/app/settings/page.tsx`: owner settings path.
- `src/app/stuff/[id]/page.tsx`: marketplace detail author/shop context.
- `src/app/t/[id]/page.tsx`: thread detail profile joins classified below.
- `src/app/u/[username]/actions.ts`: follow/block/profile action owner and relationship path.
- `src/app/u/[username]/follow-list-page.tsx`: follower/following relationship visibility path.
- `src/app/u/[username]/page.tsx`: private-profile compatibility fallback remains until view deployment is verified.
- `src/lib/tag-audience.ts`: authenticated tag-audience helper.

## Remaining embedded profiles:profiles joins

These joins remain classified for later phases because each query must be reviewed with its parent table RLS, relationship visibility, ordering, and generated Supabase select shape before replacing it with view-backed alternatives:

- `scripts/smoke-content-policy-guards.mjs`
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
- `src/app/gigs/[id]/page.tsx`
- `src/app/help/[slug]/page.tsx`
- `src/app/merch/[id]/page.tsx`
- `src/app/merch/page.tsx`
- `src/app/notifications/page.tsx`
- `src/app/p/[id]/page.tsx`
- `src/app/page.tsx`
- `src/app/saved/page.tsx`
- `src/app/search/page.tsx`
- `src/app/sitemap.ts`
- `src/app/stuff/[id]/page.tsx`
- `src/app/t/[id]/page.tsx`
- `src/app/u/[username]/follow-list-page.tsx`
- `src/app/u/[username]/page.tsx`

## Later phases

Phase 2 should happen only after this migration and compatible application code are deployed and verified in production. The next phase can then migrate additional public reads and prepare a separate, reviewed revocation plan for broad `public.profiles` exposure.