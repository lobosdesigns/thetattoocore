# Legal Review Prep

Use this private checklist before public App Store or Google Play review, production commerce promotion, wider beta expansion, or final Terms/Privacy updates. This is an evidence handoff for counsel or the approved business reviewer; it is not member-facing copy.

## Current Seller-Owned Merch Position - August 2, 2026

- The selected physical-goods model is a seller-owned Payment Link. The seller is the merchant for the external purchase and handles payment, taxes, shipping, returns, refunds, disputes, receipts, and purchase support. TTC reviews the listing and handles listing-safety reports.
- Counsel or the approved business reviewer must confirm the seller terms, required product/fulfillment/return disclosures, prohibited-goods rules, TTC liability boundaries, report/suspension process, and Apple/Google physical-goods classification for the exact native builds.
- `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false` is the rollback and public-exposure gate. The historical TTC Checkout, Connect onboarding, marketplace, and destination-charge switches remain false.
- No migration, production configuration/data change, live seller URL, deployment, native upload, Stripe console action, store-console action, or current store/device verification occurred as part of this implementation.
- Future enablement requires exact owner approval for migration, deployment, and the gate; one seller-supplied live link reviewed privately; web, Android phone, and TestFlight iPad external-browser return QA with no false success; updated Privacy/store answers; and rollback proof.

## Current Build Evidence Boundary - August 2, 2026

- Checked-in Android source candidate: `1.0.5 (6)`.
- Checked-in iOS source candidate: `1.0 (5)`.
- Repository source identity is not signed-artifact, upload, console-selection, served-track, or installed-device proof.
- Exact current App Review identity: **UNKNOWN**.
- Exact current TestFlight identity: **UNKNOWN**.
- Exact current Google Play Production identity: **UNKNOWN**.
- Exact current Google Play Closed testing - Alpha identity: **UNKNOWN**.
- Exact current installed Android identity: **UNKNOWN**.
- Exact current installed iOS identity: **UNKNOWN**.
- A separately authorized read-only signed-in console/device verification is required before QA or release claims. Do not upload, select, submit, promote, install, or change an artifact during that verification.

## Controlled Seller-Link Rollout Sequence - Current And Operative

1. Apply the protected seller-checkout migration only after exact owner approval; do not change production data by any other path.
2. Build and upload an inactive Worker version with `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`, then prove that version also has `STRIPE_EXPECTED_LIVEMODE=false`, `STRIPE_CHECKOUT_CREATION_ENABLED=false`, `STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED=false`, `STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED=false`, `STRIPE_BOOKING_CHECKOUT_ENABLED=false`, `STRIPE_CONNECT_ONBOARDING_ENABLED=false`, `STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false`, and `TTC_NATIVE_PUSH_DELIVERY_ENABLED=false`.
3. Deploy that verified Worker version while `TTC_SELLER_CHECKOUT_LINKS_ENABLED` remains false; confirm no seller purchase control is public.
4. Have one seller provide one live seller Payment Link through the protected workflow, and review the link and seller disclosures privately without placing the URL or seller account data in repo-safe output.
5. After explicit owner approval to enable seller links, prepare a second inactive Worker upload and prove only `TTC_SELLER_CHECKOUT_LINKS_ENABLED` changes to true while every old TTC payment switch and `TTC_NATIVE_PUSH_DELIVERY_ENABLED` remain false; deploy only that inspected version.
6. Run web, Android phone, and TestFlight iPad QA for disclosure, external-browser open and return, and no false TTC payment, receipt, order, webhook, inventory, or success state.
7. Rollback by restoring `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`, upload and inspect the rollback version, deploy it, and confirm the public purchase control is removed while protected and historical records remain.

## Review Scope

- Terms and Content Policy: 18+ eligibility, no visible nudity, no AI art/search claims, no scratcher promotion, moderation authority, UGC responsibility, Stuff/Merch/Gigs boundaries, and restricted professional-equipment handling.
- Privacy: account/profile data, public previews, DMs, verification documents, coarse location, ads, commerce/order records, account deletion requests, retention, legal holds, and support contact handling.
- Account deletion: member request path, target review window, manual review steps, retention exceptions for safety, fraud, disputes, payment/order records, moderation, legal holds, and verification history.
- Commerce: seller-owned Payment Link terms, Merch product rules, buyer disclosure, seller tax/shipping/return/refund/dispute/support obligations, listing-safety boundaries, historical TTC order retention, booking deposit terms, and ad purchase status.
- Native app review: whether the seller-owned external browser handoff and return are acceptable for the exact submitted builds, whether the physical-goods classification is documented, and whether screenshots/store text match the current web/app behavior without claiming TTC payment success.
- Store submissions: privacy/data-safety answers, age-rating answers, any
  voluntary Accessibility Nutrition Labels claims, Google Play required
  declarations, content rights answers, support URL, Child Safety Standards URL,
  Privacy URL, Terms URL, reviewer notes, and screenshot safety.
- Current platform and age-law review: record that Apple submissions require
  Xcode 26 and the iOS 26 SDK, Apple UGC apps require filtering, reporting,
  blocking, contact, and in-app account deletion, and Google Play updates require
  Android 16 / API 36 beginning August 31, 2026. For distribution in applicable
  U.S. states, have the approved business reviewer or counsel decide whether the
  Play Age Signals API, significant-change notices, parental approval handling,
  or purchase age ratings apply to this 18+ social app. Do not infer that legal
  decision from a console status alone.

## Current Engineering Policy Audit

The July 23, 2026 engineering review checked the current official Apple and
Google rules. It is implementation evidence, not owner or counsel approval.

- Apple's App Review Guidelines were last updated June 8, 2026. Physical goods
  and real-world services may use external payment, but digital purchases that
  are experienced in TTC, including same-app advertising or post boosts, must
  use In-App Purchase unless a reviewed exception applies.
- Google Play likewise requires Play Billing for digital app features,
  promotion, or visibility while excluding physical goods and real-world
  services. Native same-app ad checkout must remain blocked until a compliant
  store-billing path or approved exception is implemented.
- The current web release blocks ad purchases and ad-credit spending before
  account, reservation, or checkout work. Submitted native builds receive this
  gate; any platform-specific reopening requires a newly signed wrapper marker
  and a reviewed billing path.
- Apple and Google both require an in-app account deletion path. A manual
  request may take time, but TTC must not mark it complete until the account and
  associated data and UGC are actually handled, with legally required retention
  disclosed.
- Google Play Data Safety applies to apps on closed, open, and production
  tracks. Only apps exclusively active on the internal testing track are
  exempt.
- Received DMs expose a per-message report control. The server verifies that
  the reporter belongs to the conversation, rejects reports against the
  reporter's own messages, and routes valid reports into the moderator queue.
  Keep final selected-build two-user DM reporting QA in the private evidence
  handoff until the live control and queue result are verified.
- Generated store screenshot scenes can be safe upload drafts, but final
  evidence must show the actual submitted build with fictional or consented
  content and no private account, payment, or notification details.

Official source checks:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)

## Private Evidence To Keep

Do not store reviewer passwords, private phone numbers, owner personal contact details, payment-account screenshots, full admin exports, buyer addresses, license documents, or private DMs in this repo or public copy.

- Reviewer name or initials, role, review date, and build/web deploy version reviewed.
- Public URLs reviewed: `https://thetattoocore.com/terms`, `https://thetattoocore.com/privacy`, `https://thetattoocore.com/support`, `https://thetattoocore.com/help`, and `https://thetattoocore.com/child-safety-standards`.
- Store-console sections reviewed, including App Privacy/Data Safety, age
  rating/content rating, any voluntary Accessibility Nutrition Labels claims,
  Google Play Child safety, Health apps, Financial features, Ads, and account
  deletion declarations, content rights, app category, review notes, support
  contact, pricing, and screenshot upload validation.
- Dated source check retained for the current
  [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/),
  [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
  [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878),
  and [Google Play age-signal/state-law guidance](https://support.google.com/googleplay/android-developer/answer/16569691).
- Legal decisions recorded for account deletion SLA, retention exceptions, marketplace restrictions, prohibited goods, moderation escalation, seller-owned purchase responsibilities, historical TTC record handling, booking deposit handling, and ad purchase handling.
- Required public copy changes listed with file/page names, owner, date, and whether the live build was rechecked after deployment.
- Open legal risks listed with a launch decision: block release, allow internal testing only, allow public release, or revisit before production commerce.

## Release Signoff

- Final public Terms, Privacy, Support, Help, Child Safety Standards, store metadata, screenshots, and native wrapper behavior match the reviewed build.
- Seller-owned Merch remains gated unless payment, tax, shipping, return, refund, dispute, purchase-support, Privacy, and exact-build native external-checkout review items are explicitly approved.
- Native same-app advertising checkout remains gated until store billing or an
  approved platform-specific exception is implemented and reviewed.
- Any public release exception has a written owner, risk note, and follow-up date.
- The release handoff includes the legal review note alongside the real-device QA evidence pack, App Privacy/Data Safety evidence, screenshot upload evidence, and production payment evidence.

## Submission Signoff Matrix

Complete this matrix in the private release handoff for the exact build, release track, and web deploy being submitted. Repo-visible docs should keep only a short pass/fail/blocker summary.

| Area | Required private decision | Repo-safe status |
| --- | --- | --- |
| Public legal URLs | Terms, Privacy, Support, Help, Child Safety Standards, and account deletion request path match the submitted build and store metadata. | `pending`, `passed`, or `blocked` |
| Account deletion and retention | Deletion SLA, manual review owner, retention exceptions, legal holds, moderation records, verification history, and payment/order records are approved. | `pending`, `passed`, or `blocked` |
| UGC and safety policy | 18+ eligibility, no visible nudity, no scratcher promotion, no AI art/search claims, report/block tools, moderation escalation, and restricted-equipment handling are approved. | `pending`, `passed`, or `blocked` |
| Store questionnaires | App Privacy/Data Safety, age/content rating, optional Accessibility Nutrition Labels claims, Google Play required declarations, applicable age-signal/state-law decisions, content rights, pricing, category, reviewer notes, and screenshot validation match the exact build. | `pending`, `passed`, or `blocked` |
| Commerce and payments | Seller-owned checkout exposure, exact-build physical-goods classification, seller tax/shipping/return/refund/dispute/support duties, historical TTC records, booking deposits, and ad purchases are approved or explicitly gated. | `pending`, `passed`, or `blocked` |
| Evidence privacy | Reviewer credentials, phone details, console screenshots, payment identifiers, buyer addresses, private DMs, license documents, and owner personal details remain outside repo-visible docs. | `pending`, `passed`, or `blocked` |
