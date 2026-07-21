# Mobile App Submission Runbook

## Current Position

- TheTattooCore is web/PWA-first at `https://thetattoocore.com/login`.
- Native Android and iOS beta-wrapper work is starting from `native/thetattoocore-mobile`.
- Android v1 internal-test upload bundle is signed and staged on the Desktop as `TheTattooCore-app-release-v1-signed.aab`; Google Play internal testing release `1 (1.0)` is active for the existing internal tester list.
- iOS build `1.0 (3)` was uploaded from Xcode Organizer on July 18, 2026, attached to TTC Internal Testers, and is available for internal TestFlight testing.
- PWA manifest, icons, splash assets, service worker, support URL, privacy URL, and terms URL are ready for the beta wrapper path.
- Native wrapper prep lives in `docs/NATIVE_WRAPPER_PREP.md`; follow it before adding native permissions, deep links, checkout handling, push, or store-review changes.
- Draft store listing copy lives in `docs/STORE_LISTING_DRAFT.md`; review it against current store policies before submission.
- Screenshot prep lives in `docs/SCREENSHOT_PREP.md`; use it before capturing public, PWA, Google Play, App Store, or press assets.
- Age-rating prep notes live in `docs/AGE_RATING_PREP.md`; compare them to the live feature set and current store questionnaires before answering.
- Data-safety/privacy prep lives in `docs/DATA_SAFETY_PREP.md`; compare it to the live feature set and final Privacy policy before answering store data-safety questions.
- Real-device QA gates live in `docs/REAL_DEVICE_QA_CHECKLIST.md` and should pass before wrapper packaging.
- Native build/install evidence should use the matrix in `docs/REAL_DEVICE_QA_CHECKLIST.md` so Android internal-testing and iOS TestFlight proof record release channel, version/build, install source, tester account pair, device/date, and pass/fail summary without storing private reviewer secrets or console screenshots in this repo.
- If Google Play shows a production-access testing requirement, move from internal testing to a controlled closed test with the existing tester community or Google Group, keep at least 12 testers opted in for 14 continuous days, and archive the production-access application answers privately before requesting production.
- Production payment gates live in `docs/PAYMENT_PRODUCTION_READINESS.md` and should pass before real commerce appears in native builds.
- Final legal review evidence lives in `docs/LEGAL_REVIEW_PREP.md`; keep reviewer notes private and recheck public Terms, Privacy, Support, Help, store metadata, screenshots, and native wrapper behavior against the submitted build.
- Google Play submissions or updates on or after August 31, 2026 must target Android 16 / API 36. The current internal-test Android build targets API 35 because this Windows machine only has Android 35 installed; API 35 is internal-test-only and not public-submission-ready, so install API 36 and rebuild before any submission/update after that deadline.
- Visible nudity is not allowed to reduce review and moderation risk.
- Merch and ads use controlled launch checkout; production payments, seller payouts, taxes, refunds, disputes, and app-store policy review from `docs/PAYMENT_PRODUCTION_READINESS.md` must be finished before real commerce is promoted in native builds.

## Current Store Rules Check

Last checked: July 21, 2026. Recheck the official store help pages before each
new build selection, metadata save, or production-access request because console
requirements can change between internal testing and public review.

- Apple App Privacy: privacy policy URL is required and must match the final
  public Privacy page for the submitted iOS build.
- Apple Content Rights: confirm TTC owns, licenses, or has permission for
  metadata, icons, generated screenshots, and sample content shown in review.
- Apple screenshots: confirm the required iPhone set and 13-inch iPad set upload
  successfully for the selected iOS build; current 13-inch iPad portrait proof
  should record whether 2064 x 2752 or 2048 x 2732 was accepted.
- Apple Accessibility Nutrition Labels: evaluate common tasks on the submitted
  iPhone/iPad build before claiming support for any accessibility feature.
- Google Play target API: new apps and updates submitted on or after August 31,
  2026 must target Android 16 / API 36 or higher.
- Google Play production access: if the account/app is subject to closed-test
  requirements, keep at least 12 testers opted in for 14 continuous days before
  applying for production access.
- Keep source URLs, console screenshots, tester membership, reviewer credentials,
  private contact details, and account identifiers in the private release handoff
  only.
- Official source set checked: Apple App Store Connect App Privacy, Content Rights, screenshot, and Accessibility Nutrition Labels help; Google Play target API, Data Safety, testing-track, production-access testing, and payments help.

## Wrapper Decision

Start with a thin native wrapper now that core web smoke/390px mobile checks are stable:

- Use Capacitor or a similar maintained wrapper unless a fully native rebuild becomes necessary.
- Keep the canonical app experience served from the production web app.
- Do not store payment, mail, privileged server, checkout, admin, or database secrets in native code.
- Keep app links pointed at `thetattoocore.com` so shared content, login, support, privacy, and terms remain consistent.

## Required Before Store Submission

- Run the real-device checklist in `docs/REAL_DEVICE_QA_CHECKLIST.md` for signup, login, reset password, profile setup, 4U, Stories, Gossip, Stuff, Gigs, Merch browsing, DMs, booking/deposit paths, notifications, reports, blocking, verification upload, payment test paths, and account deletion request.
- Confirm `npm.cmd run smoke:mobile` covers support/help/legal routes plus the Search/Saved, Booking, Ads, Merch, Verification, and privacy/safety Help Center guides, including the Merch storefront and Merch Help guide, before store screenshots or wrapper QA.
- Confirm app-store-safe screenshots use brand assets and safe sample content only.
- Confirm screenshots do not expose private DMs, license documents, admin queues, real payment data, personal owner contact data, or visible infrastructure/provider names.
- Capture at least one Help/Support proof screen that shows the Merch guide shortcut plus public self-service topics for verification, booking deposits, privacy, safety, and support boundaries.
- Confirm Help/Support proof screens show public guide content only, with no private order details, seller payout setup details, support tickets, moderation queues, or admin-only investigation notes.
- Use the public `/help/beta-app-testing` guide for beta testers so app-wrapper login, signup, reset, Help, Support, media upload, notifications, DMs, booking, Merch, checkout-return, and safe bug-report expectations stay consistent.
- Run `npm.cmd run verify:app-review-preflight` before final screenshot upload validation, store-console final validation, or reviewer handoff. It checks production environment boundaries, security copy/headers, theme contrast, payment guardrails, store metadata, PWA assets, native wrapper safety, readiness docs, public routes, Android-profile mobile routes, and iOS-profile mobile routes without counting as real-device or private console evidence.
- Confirm TestFlight login, signup, forgot-password, reset-password, and email-confirmation routes stay inside the app WebView and do not push members out to Safari.
- Confirm public shared links open in the wrapper after final app-link/universal-link association files are published for the signed builds.
- Verified app-link and universal-link proof should use the matrix in `docs/NATIVE_WRAPPER_PREP.md`, including private Android app-signing fingerprint evidence, Apple Associated Domains evidence, real-device route tests, and repo-safe pass/fail summaries only.
- Record a safe console/log review summary for mobile web, Android wrapper WebView, and iOS TestFlight where available; do not commit raw logs, device identifiers, private account data, or console screenshots.
- For Android, run the `Android Connected-Device Probe` in `docs/REAL_DEVICE_QA_CHECKLIST.md` before treating a plugged-in phone as release evidence. Empty or unauthorized `adb devices -l` output is a handoff blocker, not a pass.
- Run `npm.cmd run verify:native-predevice` before reviewer screenshots, console-copy validation, or store-console handoff when a release-candidate Android device is not authorized yet. It checks environment boundaries, private native config exclusions, readiness docs, store metadata, Android-profile mobile routes, and iOS-profile mobile routes without counting as real-device evidence.
- Run `npm.cmd run verify:native-release` before final native handoff. It checks environment boundaries, private native config exclusions, and readiness docs first, intentionally fails until the Android probe sees an authorized device with the TTC package installed, then continues through store, Android-profile mobile, and iOS-profile mobile smoke checks.
- Confirm support email and public legal/contact surfaces use `support@thetattoocore.com` or final company/legal contact details, not personal owner information.
- Complete `docs/LEGAL_REVIEW_PREP.md` for Terms, Privacy, account deletion language, moderation policy, marketplace rules, payment/refund language, seller payout policy, and native checkout/store submission notes.
- Decide whether native builds expose Merch checkout or keep it web-only and launch-controlled until production payment policy is approved.
- Prepare store age rating answers around 18+, user-generated content, moderation/reporting, no visible nudity policy, social interaction, DMs, marketplace-like browsing, and review-controlled checkout.
- Prepare store data-safety/privacy answers around account/profile data, user-generated content, DMs, verification documents, moderation records, payment references, coarse location, notifications, deletion requests, and public-search visibility.
- Prepare App Store Accessibility Nutrition Labels from real-device common-task QA only; do not claim support for VoiceOver, Voice Control, Larger Text, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, or Audio Descriptions until that feature has been tested on the submitted iPhone/iPad build.

## Final Store-Console Evidence

Keep completed console evidence in the private release handoff, not in this repo. Store only pass/fail status, dates, build numbers, and non-sensitive notes here when a public-safe summary is needed.

| Console area | Evidence to capture privately | Repo-safe status note |
| --- | --- | --- |
| Build selection | Apple build number, Google release track, version code/name, and selected build screenshot. | `pending`, `passed`, or `needs retry`; no certificates, account IDs, or console identifiers. |
| Reviewer account | Reviewer test account email, sign-in secret, email-confirmed account state, role/access scope, and validation screenshot. | `created`, `validated`, or `needs retry`; never commit passwords, access codes, private phone details, or one-time codes. |
| Final reviewer access | Selected Apple build and Google release track reviewer sign-in details, access notes, and final validation screenshot. | `pending`, `validated for selected build/track`, or `needs retry`; never commit passwords, access codes, private phone details, or one-time codes. |
| Contact details | Support email, support URL, privacy URL, terms URL, and console-only contact phone. | Confirm company support surfaces only; do not store private phone numbers or owner personal contact data. |
| Screenshot upload | App Store iPhone/iPad validation, Google Play phone screenshots, feature graphic, and rejection/error screenshots if any. | Note asset set and result only; do not commit store-console screenshots with private account data. |
| Category and pricing | App Store categories, Google Play category, v1 free pricing, and availability selections. | Record category/pricing choices only after final console save. |
| Content rights | Confirmation that icons, generated screenshots, metadata, and any sample content are owned, licensed, or permissioned. | Record approval status only; no third-party contracts or private user content. |
| Privacy and data safety | App Privacy, Google Data Safety, Privacy Policy URL, account deletion, DMs, verification docs, commerce, and ads answers. | Record reviewed-against-build date; keep questionnaire screenshots private. |
| Age/content rating | App Store age rating, Google Play/IARC summary, social/UGC, reporting, blocking, chat moderation, no visible nudity, and not-dating answers. | Record saved summary date; keep console certificates/screenshots private. |
| Accessibility Nutrition Labels | VoiceOver, Voice Control, Larger Text, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, and Audio Descriptions answers checked against common tasks on the submitted iPhone/iPad build. | Record support/not-supported summary date only; keep device screenshots and tester notes private. |
| Google Play closed testing | Tester list or Google Group selection, opted-in tester count, 14-day continuous opt-in window if production access requires it, closed-test feedback summary, and production-access application answers. | Record only closed-test status, date range, and pass/fail summary; keep tester emails, group membership, console screenshots, and application answers private. |
| Final validation | Console errors cleared, reviewer notes saved, export/compliance prompts complete, and submit button available or submitted. | Record final state and date; no private reviewer credentials or console identifiers. |

## Reviewer Notes Template

Use this as the private console reviewer note starting point, then replace bracketed
placeholders inside the store console only. Do not commit reviewer passwords,
one-time codes, private phone details, account identifiers, or console screenshots.

```text
TheTattooCore is an 18+ body-art community app for artists, studios, vendors, and fans. Visible nudity is not allowed.

Reviewer account:
- Email: [enter reviewer account email in console only]
- Password: [enter reviewer password in console only]
- Notes: Start at https://thetattoocore.com/login. The account should already be email-confirmed and able to view 4U, Gossip, Stuff, Gigs, Merch, DMs, Alerts, Account, Help, Support, Terms, and Privacy.

User-generated content:
- Members can post community content, message connected users, and view public profiles/content.
- Reporting, blocking, private-account controls, content moderation queues, and account deletion requests are available.
- The launch policy disallows visible nudity and unsafe/restricted professional-equipment promotion.

Commerce:
- Merch, ads, and booking/deposit flows are controlled during launch review.
- Checkout and seller payout release remain gated until production payment, refund, dispute, tax/shipping, and policy review are complete.

Support:
- Support URL: https://thetattoocore.com/support
- Privacy URL: https://thetattoocore.com/privacy
- Terms URL: https://thetattoocore.com/terms
- Support email: support@thetattoocore.com
```

## Push Notifications

- Web push is prepared at the service-worker display/click level, with signed-in browser subscription storage started. Production push keys and delivery jobs still need to be enabled before relying on web push.
- Mobile app push should use Firebase Cloud Messaging for Android and iOS delivery after the Firebase project, native app config files, signing/capability setup, and real-device token delivery are verified.
- Do not request native notification permission or claim native push support in store copy until Android and iOS device-token registration, alert delivery, notification tap routing, opt-out, quiet hours, and category preferences have evidence.
- Store device tokens separately from profile preferences.
- Respect quiet hours, category preferences, and per-device opt-out before sending native push.
- Use the Native Push Private Evidence Matrix in `docs/NATIVE_WRAPPER_PREP.md` while setting up Firebase/FCM. Keep project IDs, sender IDs, API keys, app config files, device tokens, notification payloads, signing details, and console screenshots in the private release handoff only.

## Store Assets

- Reuse approved TTC shield icons.
- Use generated clean screenshots from `public/screenshots`.
- Avoid screenshots with copyrighted tattoo art, sensitive content, private messages, personal email addresses, or real payment data.

## First Native Build Steps

1. Keep the wrapper project in `native/thetattoocore-mobile`.
2. Point the wrapper start URL to `https://thetattoocore.com/login`.
3. Add app icons and splash assets from the approved TTC shield assets.
4. Configure allowed domains for `thetattoocore.com`, auth redirects, current checkout returns, support, privacy, and terms.
5. Build Android first on this Windows machine if Android tooling is installed; build iOS on the Mac/remote Mac because Xcode is required.
6. Upload to Google Play internal testing and Apple TestFlight before any public review submission. Google Play internal testing is active; iOS build `1.0 (3)` is available for internal TestFlight testing.
7. Test camera/photo-picker behavior only through normal browser file inputs unless a native upload bridge is added deliberately.

Use `docs/NATIVE_WRAPPER_PREP.md` as the detailed wrapper checklist for navigation, permissions, app links, checkout-return handling, screenshots, and QA.
