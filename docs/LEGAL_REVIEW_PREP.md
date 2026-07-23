# Legal Review Prep

Use this private checklist before public App Store or Google Play review, production commerce promotion, wider beta expansion, or final Terms/Privacy updates. This is an evidence handoff for counsel or the approved business reviewer; it is not member-facing copy.

## Review Scope

- Terms and Content Policy: 18+ eligibility, no visible nudity, no AI art/search claims, no scratcher promotion, moderation authority, UGC responsibility, Stuff/Merch/Gigs boundaries, and restricted professional-equipment handling.
- Privacy: account/profile data, public previews, DMs, verification documents, coarse location, ads, commerce/order records, account deletion requests, retention, legal holds, and support contact handling.
- Account deletion: member request path, target review window, manual review steps, retention exceptions for safety, fraud, disputes, payment/order records, moderation, legal holds, and verification history.
- Commerce: review-controlled checkout status, Merch product rules, buyer support language, seller obligations, fulfillment timing, tax/shipping assumptions, refund-review flow, dispute/chargeback handling, booking deposit terms, ad purchase status, and seller payout timing.
- Native app review: whether checkout is exposed in native wrappers, whether any external payment or checkout messaging is acceptable for the submitted build, and whether screenshots/store text match the current web/app behavior.
- Store submissions: privacy/data-safety answers, age-rating answers, any
  voluntary Accessibility Nutrition Labels claims, Google Play required
  declarations, content rights answers, support URL, Child Safety Standards URL,
  Privacy URL, Terms URL, reviewer notes, and screenshot safety.

## Private Evidence To Keep

Do not store reviewer passwords, private phone numbers, owner personal contact details, payment-account screenshots, full admin exports, buyer addresses, license documents, or private DMs in this repo or public copy.

- Reviewer name or initials, role, review date, and build/web deploy version reviewed.
- Public URLs reviewed: `https://thetattoocore.com/terms`, `https://thetattoocore.com/privacy`, `https://thetattoocore.com/support`, `https://thetattoocore.com/help`, and `https://thetattoocore.com/child-safety-standards`.
- Store-console sections reviewed, including App Privacy/Data Safety, age
  rating/content rating, any voluntary Accessibility Nutrition Labels claims,
  Google Play Child safety, Health apps, Financial features, Ads, and account
  deletion declarations, content rights, app category, review notes, support
  contact, pricing, and screenshot upload validation.
- Legal decisions recorded for account deletion SLA, retention exceptions, marketplace restrictions, prohibited goods, moderation escalation, seller payout release, refund/dispute handling, booking deposit handling, and ad purchase handling.
- Required public copy changes listed with file/page names, owner, date, and whether the live build was rechecked after deployment.
- Open legal risks listed with a launch decision: block release, allow internal testing only, allow public release, or revisit before production commerce.

## Release Signoff

- Final public Terms, Privacy, Support, Help, Child Safety Standards, store metadata, screenshots, and native wrapper behavior match the reviewed build.
- Production commerce remains gated unless the payment, tax, shipping, refund, dispute, seller payout, and native checkout review items are explicitly approved.
- Any public release exception has a written owner, risk note, and follow-up date.
- The release handoff includes the legal review note alongside the real-device QA evidence pack, App Privacy/Data Safety evidence, screenshot upload evidence, and production payment evidence.

## Submission Signoff Matrix

Complete this matrix in the private release handoff for the exact build, release track, and web deploy being submitted. Repo-visible docs should keep only a short pass/fail/blocker summary.

| Area | Required private decision | Repo-safe status |
| --- | --- | --- |
| Public legal URLs | Terms, Privacy, Support, Help, Child Safety Standards, and account deletion request path match the submitted build and store metadata. | `pending`, `passed`, or `blocked` |
| Account deletion and retention | Deletion SLA, manual review owner, retention exceptions, legal holds, moderation records, verification history, and payment/order records are approved. | `pending`, `passed`, or `blocked` |
| UGC and safety policy | 18+ eligibility, no visible nudity, no scratcher promotion, no AI art/search claims, report/block tools, moderation escalation, and restricted-equipment handling are approved. | `pending`, `passed`, or `blocked` |
| Store questionnaires | App Privacy/Data Safety, age/content rating, optional Accessibility Nutrition Labels claims, Google Play required declarations, content rights, pricing, category, reviewer notes, and screenshot validation match the exact build. | `pending`, `passed`, or `blocked` |
| Commerce and payments | Checkout exposure, native payment-policy classification, tax/shipping assumptions, fulfillment timing, refunds, disputes, booking deposits, ad purchases, and seller payout timing are approved or explicitly gated. | `pending`, `passed`, or `blocked` |
| Evidence privacy | Reviewer credentials, phone details, console screenshots, payment identifiers, buyer addresses, private DMs, license documents, and owner personal details remain outside repo-visible docs. | `pending`, `passed`, or `blocked` |
