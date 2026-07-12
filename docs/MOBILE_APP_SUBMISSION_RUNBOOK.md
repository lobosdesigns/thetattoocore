# Mobile App Submission Runbook

## Current Position

- TheTattooCore is web/PWA-first at `https://thetattoocore.com/login`.
- Native Android and iOS projects are not created yet.
- PWA manifest, icons, splash assets, service worker, support URL, privacy URL, and terms URL are ready for a wrapper later.
- Draft store listing copy lives in `docs/STORE_LISTING_DRAFT.md`; review it against current store policies before submission.
- Visible nudity is not allowed for launch to reduce review and moderation risk.
- Merch and ads use Stripe in test mode; production payments, seller payouts, taxes, refunds, disputes, and app-store policy review must be finished before real commerce is promoted in native builds.

## Wrapper Decision

Start with a thin native wrapper only after core web QA is stable:

- Use Capacitor or a similar maintained wrapper unless a fully native rebuild becomes necessary.
- Keep the canonical app experience served from the production web app.
- Do not store payment, mail, Supabase service-role, Stripe secret, or admin secrets in native code.
- Keep app links pointed at `thetattoocore.com` so shared content, login, support, privacy, and terms remain consistent.

## Required Before Store Submission

- Run real-device QA for signup, login, reset password, profile setup, 4U, Gossip, Stuff, Gigs, Merch browsing, DMs, notifications, reports, blocking, verification upload, and account deletion request.
- Confirm app-store-safe screenshots use brand assets and safe sample content only.
- Confirm support email and public legal/contact surfaces use `support@thetattoocore.com` or final company/legal contact details, not personal owner information.
- Have counsel review Terms, Privacy, account deletion language, moderation policy, marketplace rules, and payment/refund language.
- Decide whether native builds expose Merch checkout at launch or keep it web-only/test-mode until production payment policy is approved.
- Prepare store age rating answers around 18+, user-generated content, moderation/reporting, no visible nudity policy, social interaction, DMs, marketplace-like browsing, and Stripe checkout.

## Push Notifications

- Web push is only prepared at the service-worker display/click level.
- Native push comes later through APNs for iOS and FCM for Android.
- Store device tokens separately from profile preferences.
- Respect quiet hours, category preferences, and per-device opt-out before sending native push.

## Store Assets

- Reuse approved TTC shield icons.
- Use generated clean screenshots from `public/screenshots`.
- Avoid screenshots with copyrighted tattoo art, sensitive content, private messages, personal email addresses, or real payment data.

## First Native Build Steps

1. Create the wrapper project in a separate app folder after web QA is stable.
2. Point the wrapper start URL to `https://thetattoocore.com/login`.
3. Add app icons and splash assets from the approved TTC shield assets.
4. Configure allowed domains for `thetattoocore.com`, Supabase auth redirects, Stripe Checkout, support, privacy, and terms.
5. Test camera/photo-picker behavior only through normal browser file inputs unless a native upload bridge is added deliberately.
6. Run Android internal testing and TestFlight before any public review submission.
