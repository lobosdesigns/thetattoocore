# Payment Production Readiness

Stripe checkout is wired for controlled launch testing across Merch, ads, and accepted booking deposits. Keep production commerce gated until the items below are finished and reviewed.

## Current Position

- Stripe Checkout is the shared gateway path for Merch, prepaid ad campaigns, and accepted booking deposits.
- Webhook event dedupe, retry-safe status transitions, failed/expired checkout handling, buyer/seller/advertiser alerts, dispute audit logging, and Admin > Payments visibility are wired.
- Checkout routes fail closed before reserving ads, booking deposits, Merch orders, or inventory if the configured live/test checkout mode does not match the server payment key.
- Admin > Payments now includes short operator runbooks for seller payout release checks, refund/dispute review, and booking deposit review, plus a reconciliation checklist for webhook receipts, payment audit rows, user-facing status, admin queue status, fulfillment, ad delivery, booking deposits, and payout release.
- Admin > Payments now includes a payment mode preflight card showing only readiness statuses for expected mode, server key mode, webhook signing configuration, and live/test mismatch review; it does not show private key or webhook values.
- A transparent 2% TTC platform fee is recorded in controlled launch checkout flows and booking deposit requests.
- Merch order receipts, seller fulfillment updates, buyer refund-review requests, and basic admin order controls are present.
- Production purchases, seller payout releases, and real ad spending should stay gated until policy, tax, payout, refund, dispute, and payment review is complete.

## Must Finish Before Real Money

- Stripe Connect Express onboarding is started for artists, studios, and vendors, with payout readiness stored in `stripe_connect_accounts` and webhook sync support for Stripe account status updates.
- Use secure seller payout onboarding for seller payout details; do not collect bank, routing, card, or debit payout credentials in TTC forms.
- Express seller readiness must be tested by completing the hosted onboarding flow as the seller. Direct API edits or browser-automation shortcuts are not a valid completion test for identity, terms acceptance, or payout details.
- New owner/admin official TTC sellers, studios, and vendors should start as company-style seller accounts; individual seller onboarding is for individual artist sellers.
- Decide the final seller payout release policy, payout timing, holdback/reserve rules, refund windows, and dispute handling before enabling production seller payouts.
- Decide whether the TTC platform fee is buyer-paid, seller-deducted, or split by flow.
- Finish calendar availability, booking refund/cancellation handling, artist/studio payout policy, and appointment-confirmation rules before taking real booking deposits.
- Finalize tax handling, shipping-rate rules, fulfillment timelines, refund windows, dispute procedures, chargeback handling, and seller suspension rules.
- Review app-store rules before exposing checkout inside native wrappers.
- Review payment policies for user-generated marketplaces, body-art products, ads, restricted goods, and adult-adjacent 18+ community positioning.
- Create admin procedures for refunds, partial refunds, failed payments, expired checkouts, fulfilled orders, seller non-delivery, and advertiser campaign credits.
- Confirm public support, terms, privacy, and checkout copy explain launch-controlled or production status accurately.

## Production Switch Checklist

- Replace test payment keys with live keys only after the full policy review is complete.
- Run `npm.cmd run verify:payment-release` before any live-money cutover so lint, production build, environment mode checks, payment flow guards, security headers, private handoff-template validation, readiness docs, public checkout/status routes, and Android-profile plus iOS-profile mobile checkout/account route smoke are verified together on the release candidate.
- Run `npm.cmd run smoke:env` and `npm.cmd run smoke:payments` against the release candidate before changing live/test mode so environment drift, event coverage drift, and secret-boundary regressions are caught first.
- Set `STRIPE_EXPECTED_LIVEMODE=true` only when the production keys and live webhook endpoint are ready; keep it `false` for test checkout so test and live payment updates cannot mix. Checkout routes also compare this setting with the server payment key prefix before creating payment sessions. If the explicit mode setting is missing, webhooks fall back to the server payment key prefix and still reject mismatched payment updates.
- Configure live webhook endpoint and verify `STRIPE_WEBHOOK_SECRET` in Cloudflare. The production destination is `https://thetattoocore.com/api/stripe/webhook` and should listen for checkout, refund, dispute, and seller account status events.
- Enable the live webhook events needed by the app: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, and `account.updated`.
- The payment smoke guard cross-checks the webhook source and this readiness doc against that required event list so endpoint or handoff drift is reported by event name before a live-money cutover.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` remains server-only and is never exposed to client bundles.
- Run a small live-payment penny test only after legal and payment-policy review.
- Confirm Admin > Payments shows live webhook events, order states, ad payment states, booking deposit states, and ops warnings.
- Confirm Admin > Payments reconciliation checks are followed before manual closeout, refund decisions, ad credits, fulfillment changes, booking deposit updates, or payout release.
- Confirm buyer receipts, seller sale alerts, advertiser alerts, and support emails send from company addresses.
- Confirm refunds are initiated and tracked through the approved process.
- Confirm payment disputes and chargebacks create admin audit entries before any production payout, fulfillment, booking, or advertiser-credit decisions are made.
- Confirm failed, expired, refunded, partially refunded, and disputed orders cannot accidentally activate fulfillment or ads.

## Production Evidence Pack

Keep this evidence private and attach it to the release handoff before any live-money launch. Do not include raw secret values, bank details, card details, private buyer addresses, full admin exports, webhook event IDs, refund IDs, dispute IDs, seller account IDs, checkout session IDs, payment intent IDs, or provider dashboard screenshots that expose sensitive account data.

- Live webhook event list captured and matched to the app-required event set above.
- Live/test mode setting, server payment key mode, and webhook mode reviewed together with no mismatch.
- Penny test receipt captured for one approved flow after policy review.
- Admin > Payments screenshot or note showing the matching webhook receipt, payment audit row, user-facing status, and queue status.
- Delayed or async payment success reconciliation captured before fulfillment, ad delivery, booking closeout, or seller payout release.
- Refund and dispute procedure approval recorded with who approved it and the approval date.
- Seller payout policy approval recorded with payout timing, holdback, refund-window, and dispute-freeze rules.
- Tax, shipping, fulfillment, and support-copy review recorded before Merch checkout is promoted.
- Native app policy review recorded before exposing checkout in native wrappers.
- Support, Terms, Privacy, and Help copy checked against the live build and current payment status.

Repo-safe summary fields are limited to release candidate, test flow, live/test mode result, webhook event coverage result, Admin > Payments reconciliation result, refund/dispute review status, seller payout review status, native checkout policy status, reviewer initials or role, review date, and pass/fail/blocker status. Keep payment intent IDs, checkout session IDs, webhook event IDs, refund IDs, dispute IDs, seller account IDs, customer emails, buyer names, shipping addresses, seller onboarding account details, dashboard screenshots, bank/card details, webhook secrets, and raw console exports in the private release handoff only.

## Live-Money Cutover Preflight Matrix

Complete this matrix privately before changing the live/test mode setting or promoting real checkout. Each flow must be verified against the same release candidate and current legal/payment-policy approval; a single passed flow does not clear the others.

| Flow | Mode and webhook preflight | Required live event proof | Admin reconciliation proof | Fulfillment or delivery gate | Payout/refund/dispute gate | Repo-safe result |
| --- | --- | --- | --- | --- | --- | --- |
| Merch order checkout | Live/test mode setting, server payment key mode, webhook endpoint mode, and checkout return path reviewed together. | `checkout.session.completed`, `checkout.session.async_payment_succeeded` or documented card-settlement proof, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.failed`, and dispute events where available. | Admin > Payments shows matching webhook receipt, order status, payment audit row, buyer receipt state, seller order state, and order queue state. | No fulfillment starts until payment is confirmed and order review passes. | Seller payout release remains frozen until payout policy, refund window, and dispute freeze rules pass. | `pending`, `passed`, or `blocked`; no payment IDs, buyer names, addresses, dashboard screenshots, or seller account details. |
| Prepaid ad campaign checkout | Live/test mode setting, server payment key mode, webhook endpoint mode, ad reservation rollback, and checkout return path reviewed together. | `checkout.session.completed`, delayed success/failure events when enabled, `checkout.session.expired`, `charge.refunded`, `refund.failed`, and dispute events where available. | Admin > Payments shows matching webhook receipt, ad payment status, audit row, campaign queue status, and delivery eligibility. | No ad delivery starts until payment is confirmed or an owner-approved credit is recorded. | Refunds, disputes, chargebacks, and manual ad credits remain admin-reviewed before campaign closeout. | `pending`, `passed`, or `blocked`; no payment IDs, advertiser emails, dashboard screenshots, or private campaign notes. |
| Booking deposit checkout | Live/test mode setting, server payment key mode, webhook endpoint mode, accepted-booking status, and checkout return path reviewed together. | `checkout.session.completed`, delayed success/failure events when enabled, `checkout.session.expired`, `charge.refunded`, `refund.failed`, and dispute events where available. | Admin > Payments shows matching webhook receipt, booking payment status, audit row, participant-facing status, and booking queue state. | No appointment closeout or artist/studio payout decision happens until deposit status and cancellation/refund policy are reconciled. | Deposit refunds, disputes, no-shows, reschedules, and cancellation windows remain admin-reviewed until final policy signoff. | `pending`, `passed`, or `blocked`; no payment IDs, client names, private calendar notes, dashboard screenshots, or seller account details. |
| Seller payout readiness | Seller completes secure onboarding as the real seller account type; no direct API edit or browser automation shortcut counts. | `account.updated` shows readiness changes for the reviewed seller, with private evidence kept outside repo. | Admin Merch and Admin > Payments show seller payout readiness, order eligibility, refund/dispute status, and payout hold status. | Fulfillment proof and buyer review window are checked before any payout release decision. | Payout release policy, reserve/holdback rule, refund window, dispute freeze rule, and seller suspension rule are approved. | `pending`, `passed`, or `blocked`; no account IDs, seller legal data, bank details, dashboard screenshots, or personal contact details. |

## Draft Seller Payout Release Policy

Do not release production seller payouts until this policy is finalized, reviewed, and reflected in Terms, seller onboarding, and support articles.

- Seller must be an approved artist, studio, vendor, or official TTC seller with active license/business verification and no active marketplace suspension.
- Seller payout setup must be completed through hosted onboarding and marked ready in Admin Merch before the first live order can be paid out.
- Initial launch hold: keep seller payouts in manual review until at least fulfillment proof, buyer delivery window, refund window, and dispute exposure are understood.
- Suggested first production rule: release seller funds only after the order is paid, item is marked fulfilled with tracking or clear fulfillment note, buyer has had a short review window, and no refund/dispute flag is open.
- Sellers must add tracking, a tracking link, or a clear pickup/handoff note before closing a paid Merch line item as fulfilled.
- Keep a reserve/holdback option for new sellers, high-risk categories, unusually large orders, repeated refund requests, or open moderation/payment investigations.
- Official TTC merch can use a separate internal fulfillment process, but it still needs order, refund, and dispute logging.

## Draft Shipping And Tax Procedure

Before live Merch checkout, decide whether shipping and tax are platform-calculated, seller-provided, or limited to a narrow launch rule.

- Launch-safe option: start with seller-entered shipping notes and a limited shipping region, then move to calculated rates after real carrier/tax review.
- Require sellers to describe fulfillment timing, shipping method, and return/refund expectations before a product can be approved.
- Do not let products that require regulated, unsafe, adult sexual, counterfeit, or professional-equipment handling enter Merch.
- Keep buyer shipping addresses private to the seller/admin fulfillment surfaces only; do not expose them on public pages, feeds, screenshots, or notifications.
- Tax handling must be reviewed before production: decide nexus, marketplace facilitator responsibility, taxable categories, exemptions, and receipt language.
- Written Support and Help Center paths cover missing, damaged, wrong, delayed, or returned packages; keep them current before live checkout is promoted.

## Draft Refund And Dispute Procedure

Refunds and disputes should stay admin-reviewed until the operational pattern is proven.

- Buyer refund requests create an audit/review item; they do not automatically send money back during launch.
- Admin must confirm order status, fulfillment proof, seller communication, buyer reason, and dispute risk before initiating a refund.
- If a refund is approved, record whether it is full, partial, seller-funded, platform-funded, shipping-only, or goodwill credit before money moves.
- Failed refunds and chargebacks must create admin-visible payment audit records and should block seller payout release until reviewed.
- Disputed orders should freeze fulfillment changes, seller payouts, ad credits tied to the payment, and any manual closeout until the dispute is resolved.
- Repeat seller non-delivery, unsafe goods, counterfeit goods, or payment abuse should trigger seller suspension review.

## Draft Booking Deposit Procedure

Booking deposits need separate rules from Merch because they are tied to appointments and artist/studio calendars.

- Only verified artists and studios should request deposits through TTC booking flows.
- Booking checkout should open only after the artist/studio accepts the request, confirms the appointment/deposit terms, and the client can see the TTC fee.
- Deposit refund rules must cover cancellations, reschedules, no-shows, artist cancellation, shop emergencies, and failed calendar conflicts.
- Paid booking refund requests should remain admin-reviewed until the final cancellation policy is legally reviewed.
- Payout timing for booking deposits should account for appointment date, cancellation window, dispute window, and any shop-specific deposit policy.
- Calendar integrations must not expose private client notes, phone numbers, addresses, payment details, or admin-only review state.

## Native App Notes

- Keep real commerce web-first until app-store policy is reviewed.
- If checkout is exposed in native wrappers, confirm the current Google Play and Apple rules for physical goods, digital goods, ads, marketplace payments, and external payment links.
- Do not store Stripe secret keys, webhook secrets, Supabase service-role secrets, bank details, or raw card details in native code.
- Native checkout policy review must be dated and repeated for the exact build or release track before exposing checkout in iOS or Android wrappers. The July 21, 2026 review source set is Apple App Review Guidelines and Google Play Payments policy for physical goods, services, digital goods, ads, and external-payment behavior; re-check both before submission if the build, paid flows, or store rules change.
- Classify every paid native flow separately before promotion: Merch physical goods, accepted booking deposits or services, prepaid ad campaigns, any digital goods or digital services, marketplace seller payouts, and any external payment-link or web-return behavior.
- Record only repo-safe native policy results here or in the release summary: platform, build or track, flow name, source checked date, classification, pass/fail/blocker status, reviewer role, and review date. Keep policy screenshots, console account details, payment identifiers, customer/seller identifiers, private phone details, dashboard screenshots, and legal notes in the private release handoff.
- Do not claim native checkout availability, live payments, seller payouts, or production ad spend are ready until the native checkout policy classification, final legal review, and live-money payment evidence pack are complete for that platform.
