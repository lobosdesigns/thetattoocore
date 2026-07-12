# App Store Readiness

## Ready URLs

- App URL: https://thetattoocore.com
- Login / installed app start URL: https://thetattoocore.com/login
- Support URL: https://thetattoocore.com/support
- Privacy URL: https://thetattoocore.com/privacy
- Terms URL: https://thetattoocore.com/terms

## Current Launch Position

- Native submission details live in `docs/MOBILE_APP_SUBMISSION_RUNBOOK.md`.
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
- Automatic mobile browser install prompts are suppressed during regular browsing so the install sheet does not interfere with feed scrolling; Account > Notifications has a deliberate install action when the browser supports installation.
- The service worker is ready for future web-push notification display and safe same-origin click routing, but push subscriptions and delivery are not enabled yet.
- PNG PWA icons are generated from the approved TTC shield, including a maskable launcher icon.
- Branded splash and clean PWA screenshot assets are generated without user, sensitive, or copyrighted tattoo content.
- DM thread reload loops from read-state realtime updates have been fixed, stale/unavailable DM thread links now return to the inbox instead of stranding mobile users on an empty thread view, and the deployed browser Supabase client config is stable for realtime/browser auth helpers.
- Live Chrome QA on a 390px-wide mobile viewport passed for the tester account on Account > Advertising and `/messages`: no horizontal overflow, no DM reload-loop error page, and no captured console errors.
- Live Chrome QA on July 12, 2026 with the regular tester account passed for `/messages`, `/notifications`, and `/account` at mobile width: no reload-loop error page, no application-error text, and no horizontal overflow.
- Stripe checkout is still test-mode only, but webhook event dedupe, retry-safe Merch/ad payment status updates, ad checkout reservation before Stripe session creation, buyer/seller/advertiser in-app alerts, important payment emails, Admin > Payments ops visibility, filtered payment queues, and production payment-gate reminders are wired for the web app.
- App routes now send basic security headers for MIME sniffing protection, frame blocking, referrer limits, HSTS, and camera/microphone restrictions; public smoke tests verify those headers on app-served pages.
- Core social flows are web-first; native wrappers are not ready for submission yet.

## Before Google Play / App Store Submission

- Map the generated splash/screenshot assets into the native wrapper once Android/iOS packaging starts.
- Package native builds through the chosen wrapper path.
- Add final production support/legal contact details and final counsel-reviewed Terms/Privacy. Current support contact is visible; counsel-reviewed final legal copy is still required before submission.
- Have counsel review the final account deletion SLA, legal hold rules, and manual deletion checklist before store submission.
- Decide when to automate irreversible user-data deletion versus keeping early launch deletion manual.
- Test signup, login, posting, reporting, blocking/safety, DMs, verification review, and account deletion requests on real mobile devices. A reusable confirmed tester account exists, one-way DM send plus notification creation passed from `ttc_tester` to `checkouttest`, and Admin > Users can create confirmed tester accounts when signed in as owner. The full two-user DM read/reply pass still needs a second known test login.
- Before production marketplace purchases, finish seller payout policy, Stripe Connect or manual payout process, tax/shipping rules, refund/dispute procedures, and payment-provider review.
- Prepare final store screenshots after mobile QA, using no sensitive or copyrighted user content.
- Confirm no AI-generated tattoo art claims appear in store metadata or screenshots.
