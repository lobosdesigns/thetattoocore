# App Store Readiness

## Ready URLs

- App URL: https://thetattoocore.com
- Login / installed app start URL: https://thetattoocore.com/login
- Support URL: https://thetattoocore.com/support
- Privacy URL: https://thetattoocore.com/privacy
- Terms URL: https://thetattoocore.com/terms

## Current Launch Position

- Native submission details live in `docs/MOBILE_APP_SUBMISSION_RUNBOOK.md`.
- Real-device QA gates live in `docs/REAL_DEVICE_QA_CHECKLIST.md`.
- Production payment gates live in `docs/PAYMENT_PRODUCTION_READINESS.md`.
- Draft store listing copy lives in `docs/STORE_LISTING_DRAFT.md` and should be policy-reviewed before submission.
- Age-rating prep notes live in `docs/AGE_RATING_PREP.md` and should be checked against the current store questionnaires before submission.
- TheTattooCore is 18+ only.
- Visible nudity is not allowed for launch.
- Sensitive non-nude body-art media stays behind login and 18+ confirmation.
- Public support and account deletion request paths exist.
- Public support, privacy, and terms pages expose the current support contact email for account, privacy, policy, and safety questions.
- HostGator transactional mail is configured around `support@thetattoocore.com`; public support/reply-to mail should stay on company addresses instead of personal owner contact details.
- Admins and moderators can review account deletion requests from the admin data-request queue.
- Verification approval/rejection creates in-app alerts and can send important email through HostGator; the required server-only Supabase service-role secret is configured in Cloudflare.
- Public support and privacy pages explain that launch deletion requests are manually reviewed, with a target review window of 30 days unless safety, dispute, fraud, legal, or retention obligations require more time.
- Members can block and unblock profiles; blocked relationships prevent follow and DM attempts.
- PWA manifest is active and starts installed sessions at `/login`.
- Installed-app shortcuts cover the launch columns and key destinations: 4U, Gossip, Stuff, Gigs, Merch, DM, and Alerts.
- Automatic mobile browser install prompts are suppressed during regular browsing so the install sheet does not interfere with feed scrolling; Account > Notifications has a deliberate install action when the browser supports installation.
- The service worker is ready for future web-push notification display and safe same-origin click routing, but push subscriptions and delivery are not enabled yet.
- PNG PWA icons are generated from the approved TTC shield, including a maskable launcher icon.
- Branded splash and clean PWA screenshot assets are generated without user, sensitive, or copyrighted tattoo content.
- Default scaffold SVG assets have been removed from the public package so install/review assets stay TTC-branded.
- PWA smoke guards verify TTC icon, maskable icon, screenshot, and splash PNG dimensions, and public route smoke guards confirm removed scaffold asset URLs stay unavailable.
- Login and signup are split into separate pages for clarity: `/login` is sign-in only, `/signup` contains the 18+ account creation flow, and the public smoke test verifies `/signup` stays `noindex, nofollow`.
- DM thread reload loops from read-state realtime updates have been fixed, stale/unavailable DM thread links now return to the inbox instead of stranding mobile users on an empty thread view, and the deployed browser Supabase client config is stable for realtime/browser auth helpers.
- Live Chrome QA on a 390px-wide mobile viewport passed for the tester account on Account > Advertising and `/messages`: no horizontal overflow, no DM reload-loop error page, and no captured console errors.
- Live Chrome QA on July 12, 2026 with the regular tester account passed for `/messages`, `/notifications`, and `/account` at mobile width: no reload-loop error page, no application-error text, and no horizontal overflow.
- Live Chrome QA on July 12, 2026 at 390px mobile width passed for `/login`, `/notifications`, `/account`, `/admin`, `/search?q=ceocore`, `/u/ceocore`, and `/merch/checkout/success`: no reload-loop text, no application-error text, no console errors, and no document-level horizontal overflow. Account and Search keep intentional horizontally scrollable tab rails.
- Live Chrome QA on July 12, 2026 after the feed hydration fix passed for the logged-in home feed at 390px mobile width: no new console errors, no reload-loop text, no application-error text, and no document-level horizontal overflow.
- Live Chrome QA on July 12, 2026 at mobile width passed for `/support`, `/merch/checkout/success`, and `/login`: no reload-loop text, no application-error text, no console errors, and no document-level horizontal overflow. Support now has direct quick actions for deletion requests, email support, and sign-in.
- Live Chrome QA on July 12, 2026 after adding auth legal links passed at mobile width for `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/support`, `/privacy`, `/terms`, and `/merch/checkout/success`: no reload-loop text, no application-error text, no console errors, and no document-level horizontal overflow.
- Live Chrome QA on July 12, 2026 after adding Support legal links passed at mobile width for `/support`: support email plus Terms and Privacy links were present, with no reload-loop text, no application-error text, no console errors, and no document-level horizontal overflow.
- Live browser QA on July 12, 2026 at 390px mobile width passed for `/login`, `/signup`, `/support`, `/privacy`, `/terms`, `/u/ceocore`, and `/merch/checkout/success`: no reload-loop text, no application-error text, and no document-level horizontal overflow. Support, Privacy, and Terms showed `support@thetattoocore.com`.
- Full verification on July 12, 2026 passed after the expanded PWA shortcuts and Admin Merch readiness copy updates: lint, production build, hydration guards, media guards, payment guards, PWA guards, security guards, theme guards, and live public route smoke.
- Full verification on July 12, 2026 passed again after public asset cleanup: lint, production build, hydration guards, media guards, payment guards, PWA guards, security guards, theme guards, and live public route smoke.
- Full verification on July 12, 2026 passed after adding the real-device QA checklist and docs readiness guard: lint, production build, hydration guards, media guards, payment guards, PWA guards, security guards, theme guards, docs readiness guard, and live public route smoke.
- Stripe checkout is still test-mode only, but webhook event dedupe, retry-safe Merch/ad payment status updates, ad checkout reservation before Stripe session creation, buyer/seller/advertiser in-app alerts, important payment emails, Admin > Payments ops visibility, filtered payment queues, and production payment-gate reminders are wired for the web app.
- Buyer Merch checkout success now shows a printable receipt action when a signed-in buyer opens a matching Stripe session receipt; print styling hides page actions and keeps receipt text readable.
- App routes now send basic security headers for MIME sniffing protection, frame blocking, referrer limits, HSTS, and camera/microphone restrictions; public smoke tests verify those headers on app-served pages.
- Keep the security-header route hook on `src/middleware.ts` while using OpenNext Cloudflare. The Next `proxy.ts` migration builds locally but currently deploys as unsupported Node middleware on this adapter, so the deprecation warning is accepted until OpenNext Cloudflare supports the new proxy output.
- Core social flows are web-first; native wrappers are not ready for submission yet.

## Before Google Play / App Store Submission

- Map the generated splash/screenshot assets into the native wrapper once Android/iOS packaging starts.
- Package native builds through the chosen wrapper path.
- Add final production support/legal contact details and final counsel-reviewed Terms/Privacy. Current support contact is visible; counsel-reviewed final legal copy is still required before submission.
- Have counsel review the final account deletion SLA, legal hold rules, and manual deletion checklist before store submission.
- Decide when to automate irreversible user-data deletion versus keeping early launch deletion manual.
- Test signup, login, posting, reporting, blocking/safety, DMs, verification review, and account deletion requests on real mobile devices using `docs/REAL_DEVICE_QA_CHECKLIST.md`. A reusable confirmed tester account exists, one-way DM send plus notification creation passed from `ttc_tester` to `checkouttest`, and Admin > Users can create confirmed tester accounts when signed in as owner. The full two-user DM read/reply pass still needs a second known test login.
- Before production marketplace purchases, finish the gates in `docs/PAYMENT_PRODUCTION_READINESS.md`, including seller payout policy, Stripe Connect or manual payout process, tax/shipping rules, refund/dispute procedures, and payment-provider review.
- Prepare final store screenshots after mobile QA, using no sensitive or copyrighted user content.
- Confirm no AI-generated tattoo art claims appear in store metadata or screenshots.
