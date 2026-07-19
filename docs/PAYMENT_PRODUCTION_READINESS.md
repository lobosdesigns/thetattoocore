# Payment Production Readiness

Stripe checkout is wired for controlled launch testing across Merch, ads, and accepted booking deposits. Keep production commerce gated until the items below are finished and reviewed.

## Current Position

- Stripe Checkout is the shared gateway path for Merch, prepaid ad campaigns, and accepted booking deposits.
- Webhook event dedupe, retry-safe status transitions, failed/expired checkout handling, buyer/seller/advertiser alerts, dispute audit logging, and Admin > Payments visibility are wired.
- Checkout routes fail closed before reserving ads, booking deposits, Merch orders, or inventory if the configured live/test checkout mode does not match the server payment key.
- Admin > Payments now includes short operator runbooks for seller payout release checks, refund/dispute review, and booking deposit review, plus a reconciliation checklist for webhook receipts, payment audit rows, user-facing status, admin queue status, fulfillment, ad delivery, booking deposits, and payout release.
- A transparent 2% TTC platform fee is recorded in controlled launch checkout flows and booking deposit requests.
- Merch order receipts, seller fulfillment updates, buyer refund-review requests, and basic admin order controls are present.
- Production purchases, seller payout releases, and real ad spending should stay gated until policy, tax, payout, refund, dispute, and provider review is complete.

## Must Finish Before Real Money

- Stripe Connect Express onboarding is started for artists, studios, and vendors, with payout readiness stored in `stripe_connect_accounts` and webhook sync support for Stripe account status updates.
- Use Stripe-hosted onboarding for seller payout details; do not collect bank, routing, card, or debit payout credentials in TTC forms.
- Express seller readiness must be tested by completing the hosted onboarding flow as the seller. Direct API edits or browser-automation shortcuts are not a valid completion test for identity, terms acceptance, or payout details.
- New owner/admin official TTC sellers, studios, and vendors should start as company-style seller accounts; individual seller onboarding is for individual artist sellers.
- Decide the final seller payout release policy, payout timing, holdback/reserve rules, refund windows, and dispute handling before enabling production seller payouts.
- Decide whether the TTC platform fee is buyer-paid, seller-deducted, or split by flow.
- Finish calendar availability, booking refund/cancellation handling, artist/studio payout policy, and appointment-confirmation rules before taking real booking deposits.
- Finalize tax handling, shipping-rate rules, fulfillment timelines, refund windows, dispute procedures, chargeback handling, and seller suspension rules.
- Review app-store rules before exposing checkout inside native wrappers.
- Review Stripe/provider policies for user-generated marketplaces, body-art products, ads, restricted goods, and adult-adjacent 18+ community positioning.
- Create admin procedures for refunds, partial refunds, failed payments, expired checkouts, fulfilled orders, seller non-delivery, and advertiser campaign credits.
- Confirm public support, terms, privacy, and checkout copy explain launch-controlled or production status accurately.

## Production Switch Checklist

- Replace test payment keys with live keys only after the full policy review is complete.
- Set `STRIPE_EXPECTED_LIVEMODE=true` only when the production keys and live webhook endpoint are ready; keep it `false` for test checkout so test and live payment updates cannot mix. Checkout routes also compare this setting with the server payment key prefix before creating payment sessions. If the explicit mode setting is missing, webhooks fall back to the server payment key prefix and still reject mismatched payment updates.
- Configure live webhook endpoint and verify `STRIPE_WEBHOOK_SECRET` in Cloudflare. The production destination is `https://thetattoocore.com/api/stripe/webhook` and should listen for checkout, refund, dispute, and seller account status events.
- Enable the live webhook events needed by the app: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, and `account.updated`.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` remains server-only and is never exposed to client bundles.
- Run a small live-payment penny test only after legal/provider review.
- Confirm Admin > Payments shows live webhook events, order states, ad payment states, booking deposit states, and ops warnings.
- Confirm Admin > Payments reconciliation checks are followed before manual closeout, refund decisions, ad credits, fulfillment changes, booking deposit updates, or payout release.
- Confirm buyer receipts, seller sale alerts, advertiser alerts, and support emails send from company addresses.
- Confirm refunds are initiated and tracked through the approved process.
- Confirm payment disputes and chargebacks create admin audit entries before any production payout, fulfillment, booking, or advertiser-credit decisions are made.
- Confirm failed, expired, refunded, partially refunded, and disputed orders cannot accidentally activate fulfillment or ads.

## Production Evidence Pack

Keep this evidence private and attach it to the release handoff before any live-money launch. Do not include raw secret values, bank details, card details, private buyer addresses, full admin exports, or provider dashboard screenshots that expose sensitive account data.

- Live webhook event list captured and matched to the app-required event set above.
- Live/test mode setting, server payment key mode, and webhook mode reviewed together with no mismatch.
- Penny test receipt captured for one approved flow after policy review.
- Admin > Payments screenshot or note showing the matching webhook receipt, payment audit row, user-facing status, and queue status.
- Refund and dispute procedure approval recorded with who approved it and the approval date.
- Seller payout policy approval recorded with payout timing, holdback, refund-window, and dispute-freeze rules.
- Tax, shipping, fulfillment, and support-copy review recorded before Merch checkout is promoted.
- Native app policy review recorded before exposing checkout in native wrappers.
- Support, Terms, Privacy, and Help copy checked against the live build and current payment status.

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
