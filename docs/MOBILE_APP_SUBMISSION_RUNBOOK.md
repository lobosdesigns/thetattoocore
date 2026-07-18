# Mobile App Submission Runbook

## Current Position

- TheTattooCore is web/PWA-first at `https://thetattoocore.com/login`.
- Native Android and iOS beta-wrapper work is starting from `native/thetattoocore-mobile`.
- PWA manifest, icons, splash assets, service worker, support URL, privacy URL, and terms URL are ready for the beta wrapper path.
- Native wrapper prep lives in `docs/NATIVE_WRAPPER_PREP.md`; follow it before adding native permissions, deep links, checkout handling, push, or store-review changes.
- Draft store listing copy lives in `docs/STORE_LISTING_DRAFT.md`; review it against current store policies before submission.
- Screenshot prep lives in `docs/SCREENSHOT_PREP.md`; use it before capturing public, PWA, Google Play, App Store, or press assets.
- Age-rating prep notes live in `docs/AGE_RATING_PREP.md`; compare them to the live feature set and current store questionnaires before answering.
- Data-safety/privacy prep lives in `docs/DATA_SAFETY_PREP.md`; compare it to the live feature set and final Privacy policy before answering store data-safety questions.
- Real-device QA gates live in `docs/REAL_DEVICE_QA_CHECKLIST.md` and should pass before wrapper packaging.
- Production payment gates live in `docs/PAYMENT_PRODUCTION_READINESS.md` and should pass before real commerce appears in native builds.
- Visible nudity is not allowed to reduce review and moderation risk.
- Merch and ads use hosted checkout in test mode; production payments, seller payouts, taxes, refunds, disputes, and app-store policy review from `docs/PAYMENT_PRODUCTION_READINESS.md` must be finished before real commerce is promoted in native builds.

## Wrapper Decision

Start with a thin native wrapper now that core web smoke/390px mobile checks are stable:

- Use Capacitor or a similar maintained wrapper unless a fully native rebuild becomes necessary.
- Keep the canonical app experience served from the production web app.
- Do not store payment, mail, privileged server, checkout, admin, or database secrets in native code.
- Keep app links pointed at `thetattoocore.com` so shared content, login, support, privacy, and terms remain consistent.

## Required Before Store Submission

- Run the real-device checklist in `docs/REAL_DEVICE_QA_CHECKLIST.md` for signup, login, reset password, profile setup, 4U, Stories, Gossip, Stuff, Gigs, Merch browsing, DMs, booking/deposit paths, notifications, reports, blocking, verification upload, payment test paths, and account deletion request.
- Confirm `npm run smoke:mobile` covers support/help/legal routes plus the Search/Saved, Booking, Ads, Merch, Verification, and privacy/safety Help Center guides, including the Merch storefront and Merch Help guide, before store screenshots or wrapper QA.
- Confirm app-store-safe screenshots use brand assets and safe sample content only.
- Confirm screenshots do not expose private DMs, license documents, admin queues, real payment data, personal owner contact data, or visible infrastructure/provider names.
- Capture at least one Help/Support proof screen that shows the Merch guide shortcut plus public self-service topics for verification, booking deposits, privacy, safety, and support boundaries.
- Confirm Help/Support proof screens show public guide content only, with no private order details, seller payout setup details, support tickets, moderation queues, or admin-only investigation notes.
- Use the public `/help/beta-app-testing` guide for beta testers so app-wrapper login, signup, reset, Help, Support, media upload, notifications, DMs, booking, Merch, checkout-return, and safe bug-report expectations stay consistent.
- Confirm TestFlight login, signup, forgot-password, reset-password, and email-confirmation routes stay inside the app WebView and do not push members out to Safari.
- Confirm public shared links open in the wrapper after final app-link/universal-link association files are published for the signed builds.
- Confirm support email and public legal/contact surfaces use `support@thetattoocore.com` or final company/legal contact details, not personal owner information.
- Have counsel review Terms, Privacy, account deletion language, moderation policy, marketplace rules, and payment/refund language.
- Decide whether native builds expose Merch checkout or keep it web-only/test-mode until production payment policy is approved.
- Prepare store age rating answers around 18+, user-generated content, moderation/reporting, no visible nudity policy, social interaction, DMs, marketplace-like browsing, and hosted checkout.
- Prepare store data-safety/privacy answers around account/profile data, user-generated content, DMs, verification documents, moderation records, payment references, coarse location, notifications, deletion requests, and public-search visibility.

## Push Notifications

- Web push is prepared at the service-worker display/click level, with signed-in browser subscription storage started. Production push keys and delivery jobs still need to be enabled before relying on web push.
- Mobile app push comes later after separate iOS and Android delivery setup.
- Store device tokens separately from profile preferences.
- Respect quiet hours, category preferences, and per-device opt-out before sending native push.

## Store Assets

- Reuse approved TTC shield icons.
- Use generated clean screenshots from `public/screenshots`.
- Avoid screenshots with copyrighted tattoo art, sensitive content, private messages, personal email addresses, or real payment data.

## First Native Build Steps

1. Keep the wrapper project in `native/thetattoocore-mobile`.
2. Point the wrapper start URL to `https://thetattoocore.com/login`.
3. Add app icons and splash assets from the approved TTC shield assets.
4. Configure allowed domains for `thetattoocore.com`, auth redirects, hosted checkout, support, privacy, and terms.
5. Build Android first on this Windows machine if Android tooling is installed; build iOS on the Mac/remote Mac because Xcode is required.
6. Upload to Google Play internal testing and Apple TestFlight before any public review submission.
7. Test camera/photo-picker behavior only through normal browser file inputs unless a native upload bridge is added deliberately.

Use `docs/NATIVE_WRAPPER_PREP.md` as the detailed wrapper checklist for navigation, permissions, app links, hosted checkout handling, screenshots, and QA.
