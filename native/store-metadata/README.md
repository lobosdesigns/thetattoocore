# Store Metadata

Draft Google Play and App Store Connect text for the first internal/beta listings.

Use this alongside:

- `docs/STORE_LISTING_DRAFT.md`
- `docs/SCREENSHOT_PREP.md`
- `docs/DATA_SAFETY_PREP.md`
- `docs/AGE_RATING_PREP.md`
- `docs/REAL_DEVICE_QA_CHECKLIST.md`

Before public review, verify every field against the current live app, final legal copy, current store questionnaires, and final payment/commerce launch decisions.

Before final screenshot upload validation or store-console submission, run the
app review preflight from the repo root with the current production version:

```powershell
$env:TTC_RELEASE_CANDIDATE="<current-production-version>"
npm.cmd run verify:app-review-preflight
```

This checks lint, production build, production environment boundaries, security copy and headers, content-policy/reporting guardrails, theme contrast, payment guardrails, store metadata, PWA install assets, native wrapper safety, app-link association endpoints, private handoff-template validation, readiness docs, public routes, Android-profile mobile routes, and iOS-profile mobile routes without storing private console screenshots, reviewer secrets, tester membership, real-device evidence, or account identifiers. It finishes by proving the evidence verifier with a sanitized fixture and checking the actual ignored private handoff against the candidate, so the command fails closed until all final evidence is complete.

For store metadata and screenshot-only validation, `npm.cmd run verify:store-release`
remains the narrower technical guard but now ends with the same actual private
evidence gate. Use individual smoke commands while evidence is still being collected.

## Console Field Handoff

Keep private reviewer credentials and phone details in Apple/Google console fields only. Do not place private phone numbers, reviewer passwords, owner personal contact data, or payment-account screenshots in this repo or member-facing copy.

- Support URL: `https://thetattoocore.com/support`
- Help URL: `https://thetattoocore.com/help`
- Child Safety Standards URL: `https://thetattoocore.com/child-safety-standards`
- Privacy URL: `https://thetattoocore.com/privacy`
- Terms URL: `https://thetattoocore.com/terms`
- App start URL: `https://thetattoocore.com/login`
- Support email: `support@thetattoocore.com`
- App Store category handoff: set Primary Category to `Social Networking`; use `Lifestyle` as the secondary category only if the console asks for one.
- App Store Content Rights handoff: confirm TTC has rights or permission for app metadata, icons, generated screenshots, and any sample content shown in review assets; do not use third-party tattoo art, music, logos, private user content, or payment/account screenshots.
- App Store pricing handoff: set the v1 app price to free unless final legal/payment review explicitly approves a different app-price or in-app purchase plan.
- Google Play category handoff: app category is `Social`.
- Reviewer account status: test account created and sign-in validated; keep the email and secret in private handoff or console-only fields.
- Final reviewer access status: confirm the selected Apple build and Google release track each have current reviewer sign-in details, access notes, and validation result before public submission.
- Screenshot upload status: use upload-ready no-alpha PNG derivatives from `native/store-metadata/generated/`, then confirm upload validation in each console.
- Contact phone: keep console-only/private; do not add it to public screenshots, store description text, or support/legal pages.

## Private Console Evidence Template

Keep completed evidence in the private release handoff, not in this repo. Store only pass/fail status, dates, build numbers, and non-sensitive notes here when a public-safe summary is needed.

| Console area | Evidence to capture privately | Repo-safe status note |
| --- | --- | --- |
| Build selection | Apple build number, Google release track, version code/name, and selected build screenshot. | `pending`, `passed`, or `needs retry`; no certificates, account IDs, or console identifiers. |
| Google Play API 36 signed upload bundle | Fresh bundle built from the checked-in API 36 wrapper, privately signed, and checked against real-device QA before public submission or post-deadline updates. | Record only release track, version code/name, build date, device QA date, and pass/fail summary; no keystore, signing certificate, local path, or console identifiers. |
| Google Play closed testing | Tester list or Google Group selection, opted-in tester count, 14-day continuous opt-in window if production access requires it, closed-test feedback summary, and production-access application answers. | Record only closed-test status, date range, and pass/fail summary; keep tester emails, group membership, console screenshots, and application answers private. |
| Reviewer account | Test account creation, email-confirmed sign-in, role/access scope, and validation screenshot. | `created`, `validated`, or `needs retry`; never commit secrets, access codes, or private phone details. |
| Final reviewer access | Selected Apple build and Google release track reviewer sign-in details, access notes, and store-review validation result. | `pending`, `validated for selected build/track`, or `needs retry`; no passwords, login codes, private phone details, or console identifiers. |
| Contact details | Support email, support URL, help URL, child-safety standards URL, privacy URL, terms URL, and console-only contact phone. | Confirm company support surfaces only; do not store private phone numbers or owner personal contact data. |
| Screenshot upload | App Store iPhone/iPad validation, Google Play phone screenshots, feature graphic, and rejection/error screenshots if any. | Note asset set and result only; do not commit store-console screenshots with private account data. |
| Category and pricing | App Store categories, Google Play category, v1 free pricing, and availability selections. | Record category/pricing choices only after final console save. |
| Content rights | Confirmation that icons, generated screenshots, metadata, and any sample content are owned, licensed, or permissioned. | Record approval status only; no third-party contracts or private user content. |
| Privacy and data safety | App Privacy, Google Data Safety, Privacy Policy URL, account deletion, DMs, verification docs, commerce, and ads answers. | Record reviewed-against-build date; keep questionnaire screenshots private. |
| Age/content rating | App Store age rating, Google Play/IARC summary, social/UGC, reporting, blocking, chat moderation, no visible nudity, and not-dating answers. | Record saved summary date; keep console certificates/screenshots private. |
| Accessibility Nutrition Labels | VoiceOver, Voice Control, Larger Text, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, and Audio Descriptions answers checked against common tasks on the submitted iPhone/iPad build. | Record support/not-supported summary date only; keep device screenshots and tester notes private. |
| Final validation | Console errors cleared, reviewer notes saved, export/compliance prompts complete, and submit button available or submitted. | Record final state and date; no private reviewer credentials or console identifiers. |
