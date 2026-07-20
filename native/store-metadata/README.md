# Store Metadata

Draft Google Play and App Store Connect text for the first internal/beta listings.

Use this alongside:

- `docs/STORE_LISTING_DRAFT.md`
- `docs/SCREENSHOT_PREP.md`
- `docs/DATA_SAFETY_PREP.md`
- `docs/AGE_RATING_PREP.md`
- `docs/REAL_DEVICE_QA_CHECKLIST.md`

Before public review, verify every field against the current live app, final legal copy, current store questionnaires, and final payment/commerce launch decisions.

## Console Field Handoff

Keep private reviewer credentials and phone details in Apple/Google console fields only. Do not place private phone numbers, reviewer passwords, owner personal contact data, or payment-account screenshots in this repo or member-facing copy.

- Support URL: `https://thetattoocore.com/support`
- Privacy URL: `https://thetattoocore.com/privacy`
- Terms URL: `https://thetattoocore.com/terms`
- App start URL: `https://thetattoocore.com/login`
- Support email: `support@thetattoocore.com`
- App Store category handoff: set Primary Category to `Social Networking`; use `Lifestyle` as the secondary category only if the console asks for one.
- App Store Content Rights handoff: confirm TTC has rights or permission for app metadata, icons, generated screenshots, and any sample content shown in review assets; do not use third-party tattoo art, music, logos, private user content, or payment/account screenshots.
- App Store pricing handoff: set the v1 app price to free unless final legal/payment review explicitly approves a different app-price or in-app purchase plan.
- Google Play category handoff: app category is `Social`.
- Reviewer credential status: created, validated, and stored only in the store-review console fields.
- Screenshot upload status: use upload-ready no-alpha PNG derivatives from `native/store-metadata/generated/`, then confirm upload validation in each console.
- Contact phone: keep console-only/private; do not add it to public screenshots, store description text, or support/legal pages.

## Private Console Evidence Template

Keep completed evidence in the private release handoff, not in this repo. Store only pass/fail status, dates, build numbers, and non-sensitive notes here when a public-safe summary is needed.

| Console area | Evidence to capture privately | Repo-safe status note |
| --- | --- | --- |
| Build selection | Apple build number, Google release track, version code/name, and selected build screenshot. | `pending`, `passed`, or `needs retry`; no certificates, account IDs, or console identifiers. |
| Reviewer access | Reviewer test account email, sign-in secret, access notes if any, and validation screenshot. | `validated in console`; never commit secrets, access codes, or private phone details. |
| Contact details | Support email, support URL, privacy URL, terms URL, and console-only contact phone. | Confirm company support surfaces only; do not store private phone numbers or owner personal contact data. |
| Screenshot upload | App Store iPhone/iPad validation, Google Play phone screenshots, feature graphic, and rejection/error screenshots if any. | Note asset set and result only; do not commit store-console screenshots with private account data. |
| Category and pricing | App Store categories, Google Play category, v1 free pricing, and availability selections. | Record category/pricing choices only after final console save. |
| Content rights | Confirmation that icons, generated screenshots, metadata, and any sample content are owned, licensed, or permissioned. | Record approval status only; no third-party contracts or private user content. |
| Privacy and data safety | App Privacy, Google Data Safety, Privacy Policy URL, account deletion, DMs, verification docs, commerce, and ads answers. | Record reviewed-against-build date; keep questionnaire screenshots private. |
| Age/content rating | App Store age rating, Google Play/IARC summary, social/UGC, reporting, blocking, chat moderation, no visible nudity, and not-dating answers. | Record saved summary date; keep console certificates/screenshots private. |
| Accessibility Nutrition Labels | VoiceOver, Voice Control, Larger Text, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, and Audio Descriptions answers checked against common tasks on the submitted iPhone/iPad build. | Record support/not-supported summary date only; keep device screenshots and tester notes private. |
| Final validation | Console errors cleared, reviewer notes saved, export/compliance prompts complete, and submit button available or submitted. | Record final state and date; no private reviewer credentials or console identifiers. |
