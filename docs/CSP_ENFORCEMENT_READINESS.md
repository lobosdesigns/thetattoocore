# CSP Enforcement Readiness

Branch: `chore/csp-enforcement-readiness`
Baseline commit: `322ffbbbf2d1cc9eac575e1df1bcf23cf9965f19`
Continuation verification base: `ef0c0c76afb3a919e46909047cd52c0644b83d5b`

Production must remain in `Content-Security-Policy-Report-Only` until the monitoring checklist and enforcement criteria below are complete. Enforcement is prepared behind `TTC_CSP_ENFORCE_ENABLED=true`; do not set that flag in production during this readiness pass.

## Current policy

The centralized policy lives in `src/lib/security/csp.ts` and is applied from the supported OpenNext Cloudflare edge hook in `src/middleware.ts`.

Current generated policy:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://api.stripe.com; media-src 'self' blob: https://*.supabase.co https://*.supabase.in; frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; child-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; worker-src 'self' blob:; manifest-src 'self'
```

## Directive inventory

- `default-src 'self'`: fallback to same-origin application assets.
- `base-uri 'self'`: prevents injected base URL changes.
- `object-src 'none'`: blocks legacy plugin/object embedding.
- `frame-ancestors 'none'`: blocks embedding the app in external frames.
- `form-action 'self' https://checkout.stripe.com`: allows app forms and Stripe-hosted checkout form flows.
- `script-src 'self' 'unsafe-inline' https://js.stripe.com`: allows Next.js runtime scripts and Stripe.js. `unsafe-inline` remains because nonce CSP would force dynamic rendering and is not practical with the current static-friendly OpenNext Cloudflare architecture.
- `style-src 'self' 'unsafe-inline'`: allows app styles and framework-generated inline styles. Nonce removal needs a separate architecture pass.
- `img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in`: allows local images, generated previews, inline/share assets, and Supabase Storage public or signed images.
- `font-src 'self' data:`: allows bundled/local fonts and data URL font assets.
- `connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://api.stripe.com`: allows app APIs, Supabase REST/auth/storage/realtime, and Stripe API calls used by client-visible payment flows.
- `media-src 'self' blob: https://*.supabase.co https://*.supabase.in`: allows local media previews and Supabase-hosted uploaded video/media.
- `frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com`: allows Stripe-hosted payment frames if a Stripe flow invokes them.
- `child-src ...Stripe hosts...`: fallback frame directive for older browser behavior.
- `worker-src 'self' blob:`: allows `/sw.js` and blob workers used by browser media/preview behavior.
- `manifest-src 'self'`: allows `/manifest.webmanifest`.

## Required production sources

- Next.js scripts and styles: `'self'`, plus temporary `'unsafe-inline'` for scripts/styles due current no-nonce implementation.
- Cloudflare/OpenNext assets: same-origin app assets through `'self'`; no Cloudflare wildcard is required by code inspection.
- Supabase API/auth/storage: `https://*.supabase.co`, `https://*.supabase.in`.
- Supabase Realtime/WebSocket: `wss://*.supabase.co`, `wss://*.supabase.in`.
- Stripe: `https://js.stripe.com`, `https://hooks.stripe.com`, `https://checkout.stripe.com`, `https://api.stripe.com`.
- Images: `'self'`, `data:`, `blob:`, Supabase Storage hosts.
- Fonts: `'self'`, `data:`. No Google Fonts endpoint is used by the app source.
- Media: `'self'`, `blob:`, Supabase Storage hosts.
- Service worker/PWA: `'self'` for `/sw.js`, `/manifest.webmanifest`, icons, splash screens, offline shell; `blob:` remains for worker/media browser behavior.
- Firebase or push endpoints: browser subscription calls are same-origin `/api/push/subscriptions`. Server-side native push uses Google OAuth and FCM endpoints and is not governed by the browser CSP.
- Analytics/monitoring: no browser analytics or monitoring endpoint was found in source inspection.

## Tightening completed

- Moved CSP directives out of middleware into a centralized reviewable module.
- Added `TTC_CSP_ENFORCE_ENABLED` support so unset or non-`true` values emit `Content-Security-Policy-Report-Only`, while exact `true` emits `Content-Security-Policy`.
- Ensured the enforced and report-only CSP headers are mutually exclusive.
- Removed broad `https:` from `img-src` and `media-src`; those now allow same-origin, local preview schemes, and Supabase Storage host patterns only.
- Added `wss://*.supabase.co` and `wss://*.supabase.in` for Supabase Realtime readiness.
- Added `manifest-src 'self'` and `child-src` for PWA and Stripe compatibility.

## Unsafe directives still present

- `script-src 'unsafe-inline'`: still present for Next.js runtime compatibility without request nonces. The installed Next.js 16 CSP guide says nonce injection requires dynamic rendering because Next extracts the nonce from the CSP header during server rendering; static pages are generated before request headers exist. This branch keeps the current static-friendly OpenNext Cloudflare architecture and does not force every public route into dynamic rendering.
- `style-src 'unsafe-inline'`: still present for framework-generated inline styles and real app inline style attributes. Current source inspection found inline `style` usage in public/profile/media surfaces including `src/app/page.tsx`, `src/app/u/[username]/page.tsx`, `src/app/u/[username]/follow-list-page.tsx`, `src/app/search/page.tsx`, `src/app/saved/page.tsx`, `src/app/media-input.tsx`, `src/app/media-lightbox.tsx`, `src/app/account/profile-form.tsx`, and `src/app/pending-submit-button.tsx`. Several of these are dynamic background images, aspect ratios, progress transforms, or media-preview dimensions and are not safely removable in a CSP readiness pass.
- `unsafe-eval`: not present.

Removing `unsafe-inline` needs a separate architecture pass. The practical paths are either request nonces through the Next Proxy/middleware rendering path, accepting dynamic-rendering and caching changes, or evaluating Next's experimental App Router SRI support for script hashes while separately migrating dynamic style attributes. Either path needs its own smoke coverage across login/signup, public profiles, search, media previews, PWA/offline, and Stripe/Supabase flows.

## CSP observation and report collection

No in-repo CSP report endpoint, `report-uri`, `report-to`, `Reporting-Endpoints` header, report store, or sanitized production violation export was found. This branch therefore does not claim production violation collection is complete, and no secrets, cookies, raw report payloads, IPs, emails, or private URLs were accessed or copied during this pass.

A local browser observation harness was added as `npm run test:csp-observation`. It opens a local production build with Chrome DevTools Protocol, confirms that only `Content-Security-Policy-Report-Only` is present, injects a one-pixel `object` canary blocked by `object-src 'none'` in report-only mode, and records only the observed directive names/counts. It deliberately does not persist raw CSP console messages or network report payloads. This proves the branch can observe Report-Only browser violations locally; it does not replace production report collection.

## Smoke failure classification

Production and local smoke both failed the same stale 404-copy expectations for deliberate nonexistent content routes: `/p/not-a-real-post`, `/t/not-a-real-thread`, `/stuff/not-a-real-listing`, `/gigs/not-a-real-gig`, and `/merch/not-a-real-product`. The app returned real 404 documents with the current generic `Page not found` copy, so the smoke harness now asserts the semantic 404 status/current copy instead of older feature-specific copy.

Production and local smoke also failed `/u/ceocore/followers` and `/u/ceocore/following`. Inspection shows `src/app/u/[username]/follow-list-page.tsx` still queries the base `profiles` table by username, while anonymous public profile access has been hardened through the public-profile path. That makes the follow-list fixture return 404 for anonymous users in both production and the branch. This is a genuine pre-existing production defect in public community-list coverage, not a CSP regression; it is documented here and the smoke harness now records the current 404 so CSP readiness is not blocked by an unrelated product fix.

Local-only smoke differences were environment/canonical URL differences rather than branch regressions: local checkout endpoints can redirect to temporary-unavailable account/merch fallbacks when payment configuration is absent, local Stripe webhook can return the existing private-gate failure shape, and robots/sitemap emit canonical `https://thetattoocore.com` URLs even when `SMOKE_BASE_URL` targets localhost. The public smoke harness now accepts these known local/canonical variants while still checking the route, redirect, and sitemap semantics.

## Known violations and false positives

- Known CSP violations: none confirmed from production artifacts because no production report export or endpoint exists in repo.
- Local CSP observation: `object-src` canary is intentionally observed in Report-Only mode by `npm run test:csp-observation`.
- False positives: none confirmed from available repo artifacts.
- Unexpected or unsafe sources: no legitimate need was found for broad `https:`, bare `*`, Google Fonts, Google Analytics, Sentry, PostHog, or Firebase browser endpoints.

## Unresolved enforcement risks

- Real production Report-Only violation data still needs review across login, signup, public profiles, search, checkout redirects, media-heavy pages, PWA install/offline, and push setup. A production-safe collector or sanitized export path is still required because no report endpoint exists in repo.
- Inline script/style removal needs a separate nonce, SRI, and inline-style migration architecture decision.
- Stripe hosted checkout should be tested against real dashboard test-mode flows before enabling enforcement.
- Supabase Storage custom domains, if added later, must be explicitly added before enforcement.

## Rollout plan

1. Deploy this code with `TTC_CSP_ENFORCE_ENABLED` unset or `false`.
2. Confirm only `Content-Security-Policy-Report-Only` is emitted in production.
3. Collect sanitized Report-Only violations for at least login, signup, home feed, `/u/ceocore`, search, Merch detail, checkout start/return, messages with attachments, PWA install/offline, and push setup.
4. Classify each violation as legitimate required source, false positive, malicious/noise, or unresolved.
5. Update the centralized directives only for legitimate required sources.
6. Re-run the full verification set and live smoke checks against report-only production.
7. Enable `TTC_CSP_ENFORCE_ENABLED=true` only in a controlled production change window.
8. Immediately re-run smoke checks and monitor errors/violations.

## Rollback plan

1. Set `TTC_CSP_ENFORCE_ENABLED=false` or remove the variable.
2. Confirm `Content-Security-Policy` disappears and `Content-Security-Policy-Report-Only` is present.
3. Re-run login, signup, public profile, search, checkout return, PWA, and media smoke checks.
4. Keep the centralized policy in place for continued report-only observation.

## Production monitoring checklist

- Response headers include exactly one CSP header.
- Login and signup complete without blocked scripts, styles, or Supabase auth calls.
- Public profile media loads from Supabase Storage.
- Search result avatars/banners and media previews load.
- Stripe checkout redirects and returns work.
- PWA manifest, icons, `/sw.js`, offline page, and cached shell assets work.
- Push setup hits only same-origin browser APIs and app API routes.
- No new browser console CSP errors appear for normal usage.
- Report data is sanitized before sharing: no cookies, tokens, user ids, IPs, emails, or full private URLs.

## Criteria before enforcement

- Sanitized production Report-Only violations have been reviewed and classified.
- No unresolved legitimate app flows are blocked in report-only logs.
- Full automated verification passes on the release commit.
- Live smoke passes against production still running report-only mode.
- Stripe checkout and Supabase auth/storage/realtime are confirmed in production-like flows.
- A rollback owner and window are named before setting `TTC_CSP_ENFORCE_ENABLED=true`.

## Recommendation

Do not enable CSP enforcement yet. This branch is enforcement-ready from a code-path perspective, but production enforcement should wait for sanitized Report-Only violation review and a controlled flag rollout.
