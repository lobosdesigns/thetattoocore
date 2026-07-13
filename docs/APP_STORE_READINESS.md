# App Store Readiness

## Ready URLs

- App URL: https://thetattoocore.com
- Login / installed app start URL: https://thetattoocore.com/login
- Support URL: https://thetattoocore.com/support
- Privacy URL: https://thetattoocore.com/privacy
- Terms URL: https://thetattoocore.com/terms

## Current Launch Position

- Native submission details live in `docs/MOBILE_APP_SUBMISSION_RUNBOOK.md`.
- Native wrapper prep lives in `docs/NATIVE_WRAPPER_PREP.md`.
- Real-device QA gates live in `docs/REAL_DEVICE_QA_CHECKLIST.md`.
- Production payment gates live in `docs/PAYMENT_PRODUCTION_READINESS.md`.
- Draft store listing copy lives in `docs/STORE_LISTING_DRAFT.md` and should be policy-reviewed before submission.
- Screenshot prep lives in `docs/SCREENSHOT_PREP.md` and should be followed before public, PWA, Google Play, App Store, or press screenshots.
- Age-rating prep notes live in `docs/AGE_RATING_PREP.md` and should be checked against the current store questionnaires before submission.
- Data-safety/privacy questionnaire prep lives in `docs/DATA_SAFETY_PREP.md` and should be checked against the live build before submission.
- TheTattooCore is 18+ only.
- Visible nudity is not allowed for launch.
- Sensitive non-nude body-art media stays behind login and 18+ confirmation.
- Content-policy smoke guards verify new member uploads default to non-sensitive, member upload forms do not expose a sensitive/nudity bypass, legacy sensitive gates require login or 18+ confirmation, and public policy copy keeps the no-visible-nudity launch stance.
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
- The service worker is ready for web-push notification display and safe same-origin click routing. Browser subscription storage is started behind signed-in account controls, while production push keys, delivery jobs, and native APNs/FCM sending remain pre-launch gates.
- PNG PWA icons are generated from the approved TTC shield, including a maskable launcher icon.
- Branded splash and clean PWA screenshot assets are generated without user, sensitive, or copyrighted tattoo content.
- Default scaffold SVG assets have been removed from the public package so install/review assets stay TTC-branded.
- PWA smoke guards verify TTC icon, maskable icon, screenshot, and splash PNG dimensions, and public route smoke guards confirm removed scaffold asset URLs stay unavailable.
- Public robots policy explicitly allows public Merch detail paths alongside public profiles, posts, Gossip, Stuff, Gigs, support, and legal pages, while keeping private app areas disallowed.
- Share metadata guard coverage now checks that 4U, Gossip, Stuff, and Gigs index only non-sensitive public previews, use the real media image only for those safe previews, and fall back to the TTC brand shield for private/sensitive links. Merch and public profiles are also covered for safe Open Graph/Twitter cards.
- Profile guard coverage now checks the tabbed profile editor, avatar upload field, 500-character bio, safe website/social URL sanitizing, artist-to-studio/shop profile links, public linked-artist display, profile search previews, and `ugc nofollow noopener noreferrer` outbound-link policy.
- Admin guard coverage now checks dedicated admin-section navigation, login protection for every admin area, 50-item pagination on long queues, overview-only dashboard scope, owner-only role changes, and owner-only service-role tester account creation with audit logging.
- Stories have a first launch foundation: 24-hour photo/GIF/short-video posts, RLS-backed `story_posts`/`story_media`, members-first composer mode, no sensitive/nudity bypass, home story rail rendering, and a regression guard in `smoke:stories`.
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
- Live route QA on July 12, 2026 passed for invalid sponsored-click URLs at `/api/ad-click`: missing, bad, or invalid-placement clicks returned `303` to `https://thetattoocore.com/` with security headers intact instead of redirecting to an unsafe target.
- Deployed Cloudflare version `1773e353-44d4-495f-9a30-ab8e0cf94d9e` on July 12, 2026 after adding explicit public Merch robots allow rules; live public smoke passed and `/robots.txt` showed `Allow: /merch/`.
- Full verification on July 12, 2026 passed after the expanded PWA shortcuts and Admin Merch readiness copy updates: lint, production build, hydration guards, media guards, payment guards, PWA guards, security guards, theme guards, and live public route smoke.
- Full verification on July 12, 2026 passed again after public asset cleanup: lint, production build, hydration guards, media guards, payment guards, PWA guards, security guards, theme guards, and live public route smoke.
- Full verification on July 12, 2026 passed after adding the real-device QA checklist and docs readiness guard: lint, production build, hydration guards, media guards, payment guards, PWA guards, security guards, theme guards, docs readiness guard, and live public route smoke.
- Full verification on July 12, 2026 passed after expanding theme contrast regression guards: lint, production build, hydration guards, media guards, payment guards, PWA guards, security guards, theme guards, docs readiness guard, and live public route smoke.
- Full verification on July 12, 2026 passed after adding launch content-policy guards: lint, production build, hydration guards, media guards, content-policy guards, payment guards, PWA guards, security guards, theme guards, docs readiness guard, and live public route smoke.
- Full verification on July 12, 2026 passed after adding sponsored-click redirect guards and live public fallback smoke routes: lint, production build, hydration guards, media guards, content-policy guards, payment guards, PWA guards, security guards, theme guards, docs readiness guard, and live public route smoke.
- Full verification on July 13, 2026 passed after comment media, booking calendar export, DM delete guard cleanup, and public upload-copy cleanup: lint, production build, hydration guards, media guards, content-policy guards, share/profile/admin/story/booking/payment/PWA/security/theme/docs guards, and live public route smoke.
- Full verification on July 13, 2026 passed after artist-side booking cancellation and DM booking-return polish: lint, production build, hydration guards, media guards, content-policy guards, share/profile/admin/story/booking/payment/PWA/security/theme/docs guards, and live public route smoke.
- Full verification on July 13, 2026 passed after safe return-path handling across ad, booking, and Merch checkout routes: lint, production build, hydration guards, media guards, content-policy guards, share/profile/admin/story/booking/payment/PWA/security/theme/docs guards, and live public route smoke.
- Full verification on July 13, 2026 passed after public detail/home login-return polishing and native form-control theme hardening: lint, production build, hydration guards, media guards, content-policy guards, share/profile/admin/story/booking/payment/PWA/security/theme/docs guards, and live public route smoke. Live deploy version `c47b2ca6-ea59-427c-ba69-b9778de72d3e` is the latest runtime checkpoint.
- Full verification on July 13, 2026 passed after adding data-safety prep and expanded public Privacy copy: lint, production build, hydration guards, media guards, content-policy guards, share/profile/admin/story/booking/payment/PWA/security/theme/docs guards, and live public route smoke. Live deploy version `b4b614e1-033c-4ad7-b177-650d310aeafe` is the latest runtime checkpoint.
- Full verification on July 13, 2026 passed after expanding live smoke checks for Login, Support, Privacy, and Terms policy/readiness copy: lint, production build, hydration guards, media guards, content-policy guards, share/profile/admin/story/booking/payment/PWA/security/theme/docs guards, and live public route smoke.
- Live public smoke now blocks provider/infrastructure names on app-served public routes, with a narrow `/robots.txt` exception for managed content-signal text injected outside the app bundle.
- Full verification on July 13, 2026 passed after adding screenshot-prep readiness guards, tightening public Privacy roadmap wording, and hardening live public smoke retries/timeouts. Live deploy version `9b15200c-37c3-4014-a9b2-8dcc1e8efb58` passed public route smoke.
- Headless mobile browser QA on July 13, 2026 at 390px width passed for `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/support`, `/privacy`, `/terms`, `/search?q=ceocore`, `/u/ceocore`, `/u/ceocore/followers`, `/u/ceocore/following`, and `/merch/checkout/success`: no reload-loop text, no application-error text, no console/page errors, and no document-level horizontal overflow.
- Full verification on July 13, 2026 passed after adding native wrapper prep, provider-neutral mobile submission wording, and provider-neutral age-rating prep guards.
- Full verification on July 13, 2026 passed after cleaning signed-in Profile settings roadmap copy and expanding public-copy guards to cover the profile form. Live deploy version `07d79503-6642-4c9e-88eb-c9f36a76d795` passed public route smoke.
- Full verification on July 13, 2026 passed after adding profile banner upload, public profile cover rendering, banner-aware profile share metadata, and floating story view/reaction/reply/report overlays. Live deploy version `492ee321-1662-495e-9d64-21fd8ab7b463` passed public route smoke.
- Full verification on July 13, 2026 passed after carrying profile banners into Search, Saved, and follower/following discovery surfaces. Live deploy version `d5b85301-682e-47a1-96a2-7f2700eab895` passed public route smoke.
- Full verification on July 13, 2026 passed after adding account-side banner removal controls. Live deploy version `a07a9b81-ea7f-4477-9b9c-81f6b0738834` passed public route smoke.
- Full verification on July 13, 2026 passed after adding compact story rail view/reaction count chips. Live deploy version `6fd51800-aeab-432d-b138-432cfd0fd8d2` passed public route smoke after one transient deploy retry.
- Stripe checkout is still test-mode only, but webhook event dedupe, retry-safe Merch/ad payment status updates, ad checkout reservation before Stripe session creation, buyer/seller/advertiser in-app alerts, important payment emails, Admin > Payments ops visibility, filtered payment queues, and production payment-gate reminders are wired for the web app.
- Buyer Merch checkout success now shows a printable receipt action when a signed-in buyer opens a matching Stripe session receipt; print styling hides page actions and keeps receipt text readable.
- 4U and Gossip detail comments support photo/GIF attachments with lightbox viewing, while home feeds keep comment counts collapsed for speed.
- Booking requests can be accepted with optional scheduled appointment times and private participant-only `.ics` calendar downloads from Account and DM booking cards.
- App routes now send basic security headers for MIME sniffing protection, frame blocking, referrer limits, HSTS, and camera/microphone restrictions; public smoke tests verify those headers on app-served pages.
- Keep the security-header route hook on `src/middleware.ts` while using OpenNext Cloudflare. The Next `proxy.ts` migration builds locally but currently deploys as unsupported Node middleware on this adapter, so the deprecation warning is accepted until OpenNext Cloudflare supports the new proxy output.
- Core social flows are web-first; native wrappers are not ready for submission yet.

## Before Google Play / App Store Submission

- Map the generated splash/screenshot assets into the native wrapper once Android/iOS packaging starts.
- Follow `docs/NATIVE_WRAPPER_PREP.md` before creating native wrapper projects or requesting native permissions.
- Package native builds through the chosen wrapper path.
- Add final production support/legal contact details and final counsel-reviewed Terms/Privacy. Current support contact is visible; counsel-reviewed final legal copy is still required before submission.
- Have counsel review the final account deletion SLA, legal hold rules, and manual deletion checklist before store submission.
- Decide when to automate irreversible user-data deletion versus keeping early launch deletion manual.
- Test signup, login, posting, reporting, blocking/safety, DMs, verification review, and account deletion requests on real mobile devices using `docs/REAL_DEVICE_QA_CHECKLIST.md`. A reusable confirmed tester account exists, one-way DM send plus notification creation passed from `ttc_tester` to `checkouttest`, and Admin > Users can create confirmed tester accounts when signed in as owner. The full two-user DM read/reply pass still needs a second known test login.
- Before production marketplace purchases, finish the gates in `docs/PAYMENT_PRODUCTION_READINESS.md`, including seller payout policy, Stripe Connect or manual payout process, tax/shipping rules, refund/dispute procedures, and payment-provider review.
- Prepare final store screenshots after mobile QA, using no sensitive or copyrighted user content.
- Confirm screenshots do not expose private messages, license documents, admin queues, real payment data, personal owner contact data, or visible infrastructure/provider names.
- Confirm no AI-generated tattoo art claims appear in store metadata or screenshots.
- Prepare Google Play Data Safety and App Store privacy answers from `docs/DATA_SAFETY_PREP.md`, then verify them against the submitted build and final Privacy policy.
