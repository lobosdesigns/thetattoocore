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

## Native App Notes

- Keep real commerce web-first until app-store policy is reviewed.
- If checkout is exposed in native wrappers, confirm the current Google Play and Apple rules for physical goods, digital goods, ads, marketplace payments, and external payment links.
- Do not store Stripe secret keys, webhook secrets, Supabase service-role secrets, bank details, or raw card details in native code.
