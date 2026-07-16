# Payment Production Readiness

Stripe checkout is wired for test-mode Merch, ads, and accepted booking deposits. Keep production commerce gated until the items below are finished and reviewed.

## Current Position

- Stripe Checkout is the shared gateway path for Merch, prepaid ad campaigns, and accepted booking deposits.
- Webhook event dedupe, retry-safe status transitions, failed/expired checkout handling, buyer/seller/advertiser alerts, dispute audit logging, and Admin > Payments visibility are wired.
- A transparent 2% TTC platform fee is recorded in test-mode flows and booking deposit requests.
- Merch order receipts, seller fulfillment updates, buyer refund-review requests, and basic admin order controls are present.
- Production purchases, seller payout releases, and real ad spending should stay gated until policy, tax, payout, refund, dispute, and provider review is complete.

## Must Finish Before Real Money

- Stripe Connect Express onboarding is started for artists, studios, and vendors, with payout readiness stored in `stripe_connect_accounts` and webhook sync support for Stripe account status updates.
- Use Stripe-hosted onboarding for seller payout details; do not collect bank, routing, card, or debit payout credentials in TTC forms.
- Decide the final seller payout release policy, payout timing, holdback/reserve rules, refund windows, and dispute handling before enabling production seller payouts.
- Decide whether the TTC platform fee is buyer-paid, seller-deducted, or split by flow.
- Finish calendar availability, booking refund/cancellation handling, artist/studio payout policy, and appointment-confirmation rules before taking real booking deposits.
- Finalize tax handling, shipping-rate rules, fulfillment timelines, refund windows, dispute procedures, chargeback handling, and seller suspension rules.
- Review app-store rules before exposing checkout inside native wrappers.
- Review Stripe/provider policies for user-generated marketplaces, body-art products, ads, restricted goods, and adult-adjacent 18+ community positioning.
- Create admin procedures for refunds, partial refunds, failed payments, expired checkouts, fulfilled orders, seller non-delivery, and advertiser campaign credits.
- Confirm public support, terms, privacy, and checkout copy explain test-mode or production status accurately.

## Production Switch Checklist

- Replace test Stripe keys with live keys only after the full policy review is complete.
- Configure live webhook endpoint and verify `STRIPE_WEBHOOK_SECRET` in Cloudflare. The production destination is `https://thetattoocore.com/api/stripe/webhook` and should listen for checkout, refund, dispute, and seller account status events.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` remains server-only and is never exposed to client bundles.
- Run a small live-payment penny test only after legal/provider review.
- Confirm Admin > Payments shows live webhook events, order states, ad payment states, booking deposit states, and ops warnings.
- Confirm buyer receipts, seller sale alerts, advertiser alerts, and support emails send from company addresses.
- Confirm refunds are initiated and tracked through the approved process.
- Confirm payment disputes and chargebacks create admin audit entries before any production payout, fulfillment, booking, or advertiser-credit decisions are made.
- Confirm failed, expired, refunded, partially refunded, and disputed orders cannot accidentally activate fulfillment or ads.

## Draft Seller Payout Release Policy

Do not release production seller payouts until this policy is finalized, reviewed, and reflected in Terms, seller onboarding, and support articles.

- Seller must be an approved artist, studio, vendor, or official TTC seller with active license/business verification and no active marketplace suspension.
- Seller payout setup must be completed through hosted onboarding and marked ready in Admin Merch before the first live order can be paid out.
- Initial launch hold: keep seller payouts in manual review until at least fulfillment proof, buyer delivery window, refund window, and dispute exposure are understood.
- Suggested first production rule: release seller funds only after the order is paid, item is marked fulfilled with tracking or clear fulfillment note, buyer has had a short review window, and no refund/dispute flag is open.
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
