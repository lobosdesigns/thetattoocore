# CSP Enforcement Readiness

Branch: `chore/csp-enforcement-readiness`
Baseline commit: `322ffbbbf2d1cc9eac575e1df1bcf23cf9965f19`

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

- `script-src 'unsafe-inline'`: still present for Next.js runtime compatibility without request nonces.
- `style-src 'unsafe-inline'`: still present for framework and app inline style compatibility.
- `unsafe-eval`: not present.

Nonce-based CSP is not recommended in this pass. The installed Next.js guide says nonces require dynamic rendering for nonce injection, which would change caching/rendering behavior and is too large for enforcement readiness.

## Production violations reviewed

No in-repo CSP report endpoint, report store, or sanitized production violation export was available to inspect. Existing docs already require production Report-Only observation before enforcement. No secrets, cookies, or report payloads were accessed or copied during this pass.

## Known violations and false positives

- Known violations: none confirmed from available repo artifacts.
- False positives: none confirmed from available repo artifacts.
- Unexpected or unsafe sources: no legitimate need was found for broad `https:`, bare `*`, Google Fonts, Google Analytics, Sentry, PostHog, or Firebase browser endpoints.

## Unresolved enforcement risks

- Real production Report-Only violation data still needs review across login, signup, public profiles, search, checkout redirects, media-heavy pages, PWA install/offline, and push setup.
- Inline script/style removal needs a separate nonce or SRI architecture decision.
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
