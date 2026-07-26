# Public Profile Access Certification Repair

The certification repair keeps public profile reads on `public.public_profiles` and revokes anonymous direct access to `public.profiles`. The follow-up migration is `supabase/migrations/20260726010000_restrict_anonymous_profile_base_table_access.sql`.

Supabase CLI was not installed in this Windows environment, so the migration was created manually instead of with `supabase migration new`.

Do not use supabase db push for this work. Apply only the reviewed forward-only migrations that have not already been applied.

## View contract

`public.public_profiles` exposes only public discovery fields: profile identity, display metadata, public location/social links, shop-profile linkage, verification timestamp, public list/comment visibility settings, and timestamps. It filters private, suspended, banned, and internal/test/reviewer profiles using the same usernames exported from `src/lib/profile-indexing.ts`.

Anonymous clients receive only `select` on `public.public_profiles`. Anonymous direct `select` on `public.profiles` is revoked, including previous column grants for banner, verification, and theme fields. The view is switched away from `security_invoker` so it remains the minimal public interface after base-table access is denied.

## Updated public reads

- `src/app/sitemap.ts`: profile URL discovery now reads from `public_profiles`; internal/test/reviewer filtering moved into the view. Gossip thread discovery no longer references nonexistent `thread_posts.is_published`.
- `src/app/search/page.tsx`: public profile search, batched shop-profile lookup, and search result-card hydration now read from `public_profiles`. Merch search no longer runs `ILIKE` against the enum `category` column.
- `src/app/u/[username]/page.tsx`: metadata and the primary public profile path read from `public_profiles`; the old base-table fallback was removed so internal/test/private profiles return real 404s to anonymous visitors.

## Remaining direct public.profiles reads

These remain classified because they are owner, admin, authenticated relationship, service-route, or embedded parent-table paths protected by authenticated RLS or service role access:

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
- `src/app/gigs/[id]/page.tsx`: public page has author/tag embedded profile joins classified below.
- `src/app/layout.tsx`: authenticated viewer shell/profile state.
- `src/app/merch/page.tsx`: marketplace compatibility and seller context.
- `src/app/messages/actions.ts`: authenticated DM identity and relationship path.
- `src/app/messages/page.tsx`: authenticated DM identity path.
- `src/app/notifications/actions.ts`: authenticated notification identity path.
- `src/app/notifications/page.tsx`: authenticated notification display path.
- `src/app/p/[id]/page.tsx`: public post page profile joins classified below.
- `src/app/page.tsx`: homepage embedded author/profile joins classified below.
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
- `src/app/sitemap.ts`
- `src/app/stuff/[id]/page.tsx`
- `src/app/t/[id]/page.tsx`
- `src/app/u/[username]/page.tsx`

## Enforcement notes

Before enforcing CSP, observe Report-Only violations from production pages that use Next.js runtime assets, Stripe checkout, Supabase REST/auth/storage, media delivery, analytics, and Cloudflare routing. Enforcement should only happen after violations are understood and the allowlist is narrowed without breaking login, signup, checkout status, public media, or static assets.
