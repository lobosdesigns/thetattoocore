# Data Safety Prep

Use this as an internal checklist before answering Google Play Data Safety, App Store privacy nutrition labels, payment-policy reviews, or privacy-policy updates. Final answers should be checked against the exact live build and current store questionnaires.

## Current Data Types

- Account data: email address, username, display name, 18+ confirmation, password handled by the auth provider, account status, role, and notification preferences.
- Profile data: avatar, bio, account type, public profile settings, website/social links, coarse city/region/country settings, language preference, appearance preference, and optional artist-to-studio/shop link.
- User-generated content: 4U posts, Gossip posts, Stories, Stuff listings, Gigs, Merch products, comments, replies, Help Center questions/comments, reports, saves, follows, blocks, and direct messages.
- Media: profile photos, post/listing/gig/story/comment/DM image or GIF uploads, short videos where supported, and private verification/license documents.
- Commerce and payment records: controlled launch checkout/session identifiers, order states, ad payment states, booking-deposit states, platform fee amounts, fulfillment/refund status, and payment event references. Raw card, bank, routing, and payout credentials must not be collected in TTC forms.
- Verification data: license or certification name, optional license number, issuing location, expiration date, verification status, reviewer notes, and private uploaded proof documents.
- Safety and moderation data: reports, moderation status, warnings/escalations, blocks, admin audit records, account deletion requests, and related support context.
- Usage and preference data: notifications, unread counts, story views/reactions, ad click/impression events, saved items, likes, follows, and coarse discovery preferences.

## Use And Purpose

- Run the social app: accounts, profiles, posts, comments, DMs, follows, saves, notifications, stories, search, Help Center questions, and public previews.
- Keep the community safe: age gate, reporting, blocking, moderation queues, verification review, restricted professional marketplace access, account deletion handling, and admin audits.
- Support commerce while gated: Merch checkout testing, prepaid ads, booking-deposit testing, order/receipt history, seller fulfillment state, advertiser status, and payment troubleshooting.
- Personalize responsibly: coarse location/language/profile preferences, followed accounts, interactions, and category/style signals may guide ranking and discovery. Do not describe this as AI-driven personalization.
- Communicate important events: account, verification, marketplace, gig, booking, payment, and safety notifications by in-app alerts first, important email where configured, and future push only after production delivery is ready.

## Sharing And Visibility

- Public-safe profile fields, public-preview posts, approved listings, Gigs, and Merch may be visible to other members and search engines where allowed.
- DMs, private account settings, admin tools, draft/unpublished content, private verification documents, and sensitive/admin-restricted media must not be publicly indexed or exposed.
- Payment processing should happen through approved review-controlled checkout flows; TTC should not store raw payment cards, bank details, routing numbers, or debit-card payout credentials.
- Private license documents are for submitting users and authorized admin/moderation review only.
- Support and legal contact surfaces should use company contact addresses such as `support@thetattoocore.com`, not personal owner contact data.

## Retention And Deletion

- Account deletion requests are manually reviewed, with a target review window documented in public support/privacy copy.
- Preserve records where needed for safety, fraud, chargebacks, dispute handling, legal hold, moderation audits, payment/order history, or professional verification review.
- Future irreversible deletion automation needs a reviewed retention map before it is enabled.
- Store screenshots and public marketing materials must avoid private DMs, license documents, personal emails, real payment data, sensitive content, and copyrighted tattoo art.

## Before Submission

- Google Play Data Safety must be current before closed testing, open testing, or production release. Apps active only on Google Play internal testing are currently exempt from public Data Safety section inclusion, but still keep this prep current before widening beyond internal testers.
- Recheck the live build against the current Google Play Data Safety and App Store privacy questions.
- Record whether the Data Safety answers were reviewed for each active release stage: internal-only exemption note, closed/open testing if used, and production.
- Confirm the public Privacy page describes profile data, messages, location settings, marketplace/payment records, deletion requests, and future ads accurately.
- Confirm no app-store or public copy exposes private infrastructure, service secrets, personal owner contact information, or internal admin procedures.
- Confirm production payment, payout, tax, refund, and dispute policies are complete before answering real-money commerce questions as live.
- Confirm real-device QA passes for signup, login, profile editing, posting, DMs, reports, blocking, verification upload, account deletion request, notifications, public sharing, and payment test flows.

## App Store Privacy Evidence

Keep this evidence private with the release handoff. Do not place reviewer passwords, private contact phone numbers, account owner details, payment-account screenshots, raw admin exports, or private member content in repo docs or public copy.

- App Store App Privacy answers reviewed against the submitted iOS build, Privacy URL `https://thetattoocore.com/privacy`, and the live web/app data flows above.
- Data linked to account checked for account/profile fields, user-generated content, DMs, media uploads, verification documents, commerce/order records, reports, blocks, follows, saves, notifications, and support/account deletion requests.
- Tracking answer checked separately from ad delivery, saved searches, follows, coarse discovery preferences, and basic event counts; do not infer tracking from the iOS native privacy manifest alone.
- Payment and payout answers checked against the current production-payment decision, refund/dispute process, seller payout process, and the rule that TTC forms do not collect raw card, bank, routing, or payout credentials.
- Screenshot or note captured for the final App Privacy console summary, review date, reviewed build/version, reviewer initials, and any questionnaire areas that must be revisited before public release.
