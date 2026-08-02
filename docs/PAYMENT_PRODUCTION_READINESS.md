# Payment Production Readiness

## Current Position - August 2, 2026

- Seller-owned Stripe Payment Links are the selected physical-goods model. TTC does not create the new merchandise payment, order, tax, shipping, refund, dispute, payout, or receipt record.
- The seller processes payment and handles shipping, taxes, returns, refunds, disputes, and purchase support. TTC reviews listings and handles listing-safety reports.
- TTC Checkout, Connect, and destination-charge controls remain false and historical: `STRIPE_EXPECTED_LIVEMODE=false`, `STRIPE_CHECKOUT_CREATION_ENABLED=false`, `STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED=false`, `STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED=false`, `STRIPE_BOOKING_CHECKOUT_ENABLED=false`, `STRIPE_CONNECT_ONBOARDING_ENABLED=false`, and `STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false`.
- The new optional server gate starts fail closed at `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`. Setting it to exact `true` is a separate release action and does not occur in this implementation task.
- No migration, production change, live seller URL, deployment, or native upload has occurred. Historical `merch_orders`, Stripe events, refunds, disputes, Connect records, and reconciliation views remain available for support and audit.
- The controlled sequence below is mandatory for any later seller-link release. Each approval and private proof is a future release gate, not work completed by this documentation change.
- Rollback proof must show that restoring `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false` removes the public purchase control without deleting the protected listing link or historical records. Existing TTC Checkout, Connect, destination-charge, and native-delivery switches remain false.
- The App Store build currently in review remains unchanged. This implementation does not select, replace, submit, or upload any store build.

The dated position above supersedes the former TTC-owned Merch pilot as the
selected physical-goods model. The controlled sequence immediately below is
current and operative. Later sections explicitly marked historical preserve
prior readiness and dashboard evidence for audit only; they are not approval to
revive that pilot.

## Controlled Seller-Link Rollout Sequence - Current And Operative

1. Apply the protected seller-checkout migration only after exact owner approval; do not change production data by any other path.
2. Build and upload an inactive Worker version with `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`, then prove that version also has `STRIPE_EXPECTED_LIVEMODE=false`, `STRIPE_CHECKOUT_CREATION_ENABLED=false`, `STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED=false`, `STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED=false`, `STRIPE_BOOKING_CHECKOUT_ENABLED=false`, `STRIPE_CONNECT_ONBOARDING_ENABLED=false`, `STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false`, and `TTC_NATIVE_PUSH_DELIVERY_ENABLED=false`.
3. Deploy that verified Worker version while `TTC_SELLER_CHECKOUT_LINKS_ENABLED` remains false; confirm no seller purchase control is public.
4. Have one seller provide one live seller Payment Link through the protected workflow, and review the link and seller disclosures privately without placing the URL or seller account data in repo-safe output.
5. After explicit owner approval to enable seller links, prepare a second inactive Worker upload and prove only `TTC_SELLER_CHECKOUT_LINKS_ENABLED` changes to true while every old TTC payment switch and `TTC_NATIVE_PUSH_DELIVERY_ENABLED` remain false; deploy only that inspected version.
6. Run web, Android phone, and TestFlight iPad QA for disclosure, external-browser open and return, and no false TTC payment, receipt, order, webhook, inventory, or success state.
7. Rollback by restoring `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`, upload and inspect the rollback version, deploy it, and confirm the public purchase control is removed while protected and historical records remain.

## Historical TTC Checkout Position (Preserved)

- Stripe Checkout is the shared gateway path for Merch, prepaid ad campaigns, and accepted booking deposits.
- Webhook event dedupe, retry-safe status transitions, failed/expired checkout handling, buyer/seller/advertiser alerts, dispute audit logging, and Admin > Payments visibility are wired.
- Checkout routes fail closed before reserving ads, booking deposits, Merch orders, or inventory if the configured live/test checkout mode does not match the server payment key or the webhook signing secret is missing or malformed.
- Checkout Session creation uses a per-attempt idempotency key and one bounded network retry. If a created session cannot be attached to its local order, booking, or campaign, the app confirms that session is expired before releasing the local reservation; an unresolved creation or expiration keeps the reservation held for operator reconciliation instead of exposing a payable orphan.
- Admin > Payments now includes short operator runbooks for seller payout release checks, refund/dispute review, and booking deposit review, plus a reconciliation checklist for webhook receipts, payment audit rows, user-facing status, admin queue status, fulfillment, ad delivery, booking deposits, and payout release.
- Admin > Payments shows each webhook receipt as processed, retrying, or failed, includes attempt and lifecycle timestamps without raw error details, and raises payment-ops warnings for failed events or processing claims older than the retry lease.
- Admin > Payments now includes a payment mode preflight card showing only readiness statuses for expected mode, server key mode, webhook signing format, live/test mismatch review, and the Merch seller-routing release switch; it does not show private key, webhook, or connected-account values. A valid-looking signing-secret format is not live-event proof, which remains a separate private evidence requirement.
- A transparent 2% TTC platform fee is recorded in controlled launch checkout flows and booking deposit requests.
- Merch order receipts, seller fulfillment updates, buyer refund-review requests, and guarded owner/admin full-refund controls are present. Approved destination-charge refunds reverse the seller transfer and refund the application fee when one exists; the signed payment webhook remains the order-status authority.
- Production purchases, seller payout releases, and real ad spending should stay gated until policy, tax, payout, refund, dispute, and payment review is complete.
- Ad purchases and ad-credit spending are globally fail closed in the current web release while campaign preparation and review remain available. Keep this gate closed until replacement native builds add reviewed platform-specific commerce controls.
- July 22, 2026 dashboard inspection confirmed an active sandbox test connected account and an integration guide configured for marketplace destination charges, hosted onboarding, Express seller management, application fees, and platform loss liability. Account, email, business, identity, and production verification were still in progress at that inspection; the July 24 current state below supersedes those activation details. The production Admin payment preflight showed explicit mode `Needs review`, server payment key mode `Test`, webhook signing `Ready`, and checkout blocked until the expected mode was readable and matched. Live-money cutover remained blocked until those verification rows, webhook mode/event proof, Admin reconciliation, penny-test proof, refund/dispute procedure, payout gate, and native checkout policy review were recorded in the private handoff.
- July 23, 2026 dashboard inspection confirmed an active live webhook destination at the production webhook URL with the exact 12 required checkout, delayed-payment, expiry, refund, dispute, and seller-account events listed below. The destination was imported from the reviewed test configuration; no signing secret, payment identifier, account identifier, or dashboard image is committed. At that inspection, production checkout was still in test mode and fail closed pending owner identity verification, the live signing-secret and server-key cutover, policy/legal approvals, Admin reconciliation, and an approved penny test.
- July 24, 2026 current dashboard state: Production account activation and Connect configuration are complete, including the business profile, both identity workflows, marketplace integration choices, and the owner-accepted platform agreement. The live endpoint covers the exact 12 required events, its rotated signing secret remains private, and a signed synthetic non-money event returned `200` with the expected fail-closed mode response. The server payment key remains in test mode, expected live mode remains unset, checkout and seller onboarding remain blocked, and no money moved. Live-money cutover remains blocked pending live key/mode alignment, webhook mode/event proof, Admin reconciliation, controlled purchase/refund proof, refund/dispute procedure approval, payout gate approval, and native checkout policy review in the private handoff.
- Non-official Merch destination-charge wiring is staged behind `STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false` by default and still requires matching payment mode plus a ready connected seller account. Keep the release switch off until the payout timing, refund, dispute, reserve, and legal policy decisions below are approved and tested.

## Historical TTC-Owned Pilot Scope (Preserved)

- The operating sequence is web-first for US-only, TTC-owned physical Merch; this is not technical native isolation because the iOS and Android wrappers load the production web app.
- [Apple App Review Guidelines 3.1.3(e)](https://developer.apple.com/app-store/review/guidelines/) directs apps selling physical goods or services consumed outside the app to use payment methods other than In-App Purchase. [Google Play Payments policy section 3](https://support.google.com/googleplay/android-developer/answer/9858738) states that Play Billing must not be used when payment is primarily for physical goods. Both policies classify payments for physical goods outside store billing, but they do not prove approval for TheTattooCore's exact native builds.
- Exact-build Apple and Google Play review notes or physical-goods classification remain separate strict private preauthorization gates. Keep their console details, screenshots, account identifiers, and private links in the ignored private handoff.
- Booking deposits, marketplace Merch, connected-account onboarding/routing, and ads remain disabled pending their separate approvals. Advertising purchases also remain source-disabled.
- `STRIPE_CHECKOUT_CREATION_ENABLED` is the server-only checkout creation master. Official TTC Merch, booking deposits, and marketplace Merch also require their matching server-only flow switch to be exactly `true`; seller onboarding independently requires `STRIPE_CONNECT_ONBOARDING_ENABLED` to be exactly `true`. All switches default to `false` and fail closed.
- Official TTC physical Merch Checkout enables Stripe automatic tax with tax-exclusive prices and the General - Tangible Goods product tax code. Marketplace tax liability remains outside this pilot and blocked with marketplace checkout.
- Setting `STRIPE_EXPECTED_LIVEMODE=true` is not the checkout launch action; the creation master and selected flow gate are the exposure controls.
- Safe rollback disables `STRIPE_CHECKOUT_CREATION_ENABLED` while retaining the live expected mode, live key, and live webhook signing configuration so delayed events, refunds, disputes, expiration, and reconciliation continue.
- Never use real card details merely to test live mode. The first production proof must be a genuine authorized customer sale under normal terms, after the separate go-live approval.
- The separate go-live approval requires legal and payment-policy review.
- Do not claim the pilot is approved, deployed, or live.

## Historical TTC-Owned Pilot Gates (Preserved)

- Stripe Connect Express onboarding is started for artists, studios, and vendors, with payout readiness stored in `stripe_connect_accounts` and webhook sync support for Stripe account status updates.
- Use secure seller payout onboarding for seller payout details; do not collect bank, routing, card, or debit payout credentials in TTC forms.
- Express seller readiness must be tested by completing the hosted onboarding flow as the seller. Direct API edits or browser-automation shortcuts are not a valid completion test for identity, terms acceptance, or payout details.
- New owner/admin official TTC sellers, studios, and vendors should start as company-style seller accounts; individual seller onboarding is for individual artist sellers.
- Decide the final seller payout release policy, payout timing, holdback/reserve rules, refund windows, and dispute handling before enabling production seller payouts.
- Decide whether the selected destination-charge model's immediate transfer to the connected seller balance is acceptable or whether launch requires a delayed/manual transfer model before turning on the Merch destination-charge release switch.
- Decide whether the TTC platform fee is buyer-paid, seller-deducted, or split by flow.
- Finish calendar availability, booking refund/cancellation handling, artist/studio payout policy, and appointment-confirmation rules before taking real booking deposits.
- Finalize tax handling before arming Official TTC Merch: confirm the applicable sales-tax permit and Stripe Tax registration, head-office/ship-from location, default shipping treatment, and a current Checkout calculation. Finalize shipping-rate rules, fulfillment timelines, refund windows, dispute procedures, chargeback handling, and seller suspension rules.
- Review app-store rules before exposing checkout inside native wrappers.
- Review payment policies for user-generated marketplaces, body-art products, ads, restricted goods, and adult-adjacent 18+ community positioning.
- Create admin procedures for refunds, partial refunds, failed payments, expired checkouts, fulfilled orders, seller non-delivery, and advertiser campaign credits.
- Confirm public support, terms, privacy, and checkout copy explain launch-controlled or production status accurately.

## Historical TTC-Owned Pilot Operations - Non-Operative

Do not execute these historical TTC-owned pilot instructions. They preserve the former launch design, evidence requirements, and reconciliation policy for audit use only; the current seller-owned rollout sequence above supersedes them.

### Historical TTC-Owned Production Switch Checklist - Non-Operative

- Replace test payment keys with live keys only after the full policy review is complete.
- Run `npm.cmd run verify:payment-release` before any live-money cutover so lint, production build, environment mode checks, payment flow guards, private cutover-evidence rows, app install and alert fallback guards, security headers, private handoff-template validation, readiness docs, public checkout/status routes, and Android-profile plus iOS-profile mobile checkout/account route smoke are verified together on the release candidate. This is a code-and-template preflight, not approval to promote real-money checkout.
- Run `npm.cmd run smoke:payment-cutover` after editing the private payment evidence template or payment readiness docs. It checks distinct Official TTC Merch, marketplace Merch, ads, booking, and seller-payout rows without asking committed docs to store payment IDs, dashboard screenshots, buyer addresses, seller account details, bank/card details, webhook secrets, or raw exports.
- Run `npm.cmd run verify:payment-go-live` as the separate preauthorization evidence gate before arming the checkout creation master. Official TTC Merch checkout is the only selected pilot flow: its sanitized release state must be `armed`, while marketplace Merch, booking deposits, ads, and seller payout readiness must be `blocked`. The gate requires current mode, webhook, Admin readiness, policy, separate passed Apple and Google Play exact-build physical-goods review evidence, and private gate-state evidence, but preauthorization evidence does not require a production transaction.
- Run `npm.cmd run verify:payment-production-evidence` after the first genuine authorized customer sale. This post-transaction production evidence phase requires Official TTC Merch to be `enabled`, requires the production sale and Admin reconciliation proof to pass, and still requires every excluded flow to remain `blocked`.
- Both strict phases read `private-release-handoff/release-handoff-template.md` by default and exit with named blockers when required payment rows, dashboard review dates, results, or private proof locations are missing or invalid. Every required Payments, Apple, and Google Play blocker and Payment Dashboard row must name a non-placeholder private proof filename or location when that row is required to pass in the selected phase; `fixture-only` is accepted only with explicit `--test-fixture` mode. Dashboard dates must use `YYYY-MM-DD` or an ISO-8601 timestamp with an explicit timezone, cannot be future-dated, and must be no more than 45 days old. Each flow's Release candidate cell must match the current Git commit, with a 7-40 character hexadecimal commit prefix accepted. Mutable labels such as `latest` are never release evidence.
- When the reviewed release candidate is a deployed commit other than the current checkout, run `npm.cmd run verify:payment-go-live -- --release-candidate <commit-sha>`. A production override must resolve to a commit in the local repository. Use `--evidence <private-path>` only for an ignored private handoff copy. Do not point the production command at committed fixtures.
- `npm.cmd run test:payment-go-live-gate` proves the official-pilot preauthorization and post-transaction paths, excluded-flow state enforcement, and stale, future, and ambiguous-date rejection with sanitized, explicitly marked fixtures. Fixture mode is restricted to `scripts/fixtures`, announces that it is not release evidence, and cannot be used by either production command.
- Run `npm.cmd run smoke:env` and `npm.cmd run smoke:payments` against the release candidate before changing live/test mode so environment drift, event coverage drift, and secret-boundary regressions are caught first.
- Set `STRIPE_EXPECTED_LIVEMODE=true` only when the production keys and live webhook endpoint are ready; keep it `false` for test checkout so test and live payment updates cannot mix. Checkout routes require this explicit mode setting and compare it with the server payment key prefix before creating payment sessions. If the explicit mode setting is missing, checkout fails closed; webhooks fall back to the server payment key prefix and still reject mismatched payment updates. If neither source identifies the mode, webhooks fail closed before any payment state changes.
- Keep `STRIPE_CHECKOUT_CREATION_ENABLED=false` until the separate launch approval. It is the rollback control for new checkout creation; do not remove the live expected mode, live key, or live webhook signing configuration when using it so post-checkout settlement and reconciliation continue.
- Keep Official TTC Merch blocked until Stripe Tax is configured for the applicable registration and the private handoff records a current tax calculation. Source and route tests require automatic tax, tax-exclusive pricing, and `txcd_99999999` for the selected physical-goods pilot.
- Configure the live webhook endpoint and verify `STRIPE_WEBHOOK_SECRET` has the expected endpoint-signing format in the production runtime. The production destination is `https://thetattoocore.com/api/stripe/webhook` and should listen for checkout, refund, dispute, and seller account status events. Checkout remains blocked if the signing value is missing or malformed, and format validation never replaces a signed live-event test.
- Enable the live webhook events needed by the app: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, and `account.updated`.
- The payment smoke guard cross-checks the webhook source and this readiness doc against that required event list so endpoint or handoff drift is reported by event name before a live-money cutover.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` remains server-only and is never exposed to client bundles.
- Do not use real card details merely to test live mode. After the separate go-live approval, the first production proof is a genuine authorized customer sale under normal terms.
- Confirm Admin > Payments shows live webhook events, order states, ad payment states, booking deposit states, and ops warnings.
- Confirm Admin > Payments shows zero failed webhook events and zero processing claims older than 10 minutes before reconciling fulfillment, credits, refunds, booking closeout, or payout release.
- Confirm Admin > Payments reconciliation checks are followed before manual closeout, refund decisions, ad credits, fulfillment changes, booking deposit updates, or payout release.
- Confirm buyer receipts, seller sale alerts, advertiser alerts, and support emails send from company addresses.
- Confirm refunds are initiated and tracked through the approved process.
- Confirm payment disputes and chargebacks create admin audit entries before any production payout, fulfillment, booking, or advertiser-credit decisions are made.
- Confirm failed, expired, refunded, partially refunded, and disputed orders cannot accidentally activate fulfillment or ads.

### Historical TTC-Owned Production Evidence Pack - Non-Operative

Keep this evidence private and attach it to the release handoff before any live-money launch. Do not include raw secret values, bank details, card details, private buyer addresses, full admin exports, webhook event IDs, refund IDs, dispute IDs, seller account IDs, checkout session IDs, payment intent IDs, or provider dashboard screenshots that expose sensitive account data.

Official TTC Merch checkout is the only selected pilot flow. The preauthorization evidence does not require a production transaction; post-transaction production evidence is recorded separately after the first genuine authorized sale.

Every Payments, Apple, and Google Play blocker and Payment Dashboard row required to pass in the selected phase must name a non-placeholder private proof filename or location. `fixture-only` is valid only for the explicit sanitized test-fixture command and never counts as production release evidence.

Dashboard evidence must be dated no more than 45 days before the release check
and cannot be future-dated. Refresh the private proof and review result instead
of carrying an old dashboard inspection into a newer payment release.

Excluded rows may use `n/a` only when their Release switch state is `blocked`, a
non-placeholder private gate-state proof is named, and candidate source gates and fail-closed defaults remain intact. This applies to marketplace Merch, booking deposits, ads, and seller payout readiness. An `armed` or `enabled` excluded flow is a blocker even when its other cells say `n/a`.

- Live webhook event list captured and matched to the app-required event set above.
- Live/test mode setting, server payment key mode, and webhook mode reviewed together with no mismatch.
- After launch approval, receipt and reconciliation proof captured for the first genuine authorized Official TTC Merch customer sale; no real card is used merely to test live mode.
- Admin > Payments screenshot or note showing the matching webhook receipt, payment audit row, user-facing status, and queue status.
- Delayed or async payment success reconciliation captured before fulfillment, ad delivery, booking closeout, or seller payout release.
- Refund and dispute procedure approval recorded with who approved it and the approval date.
- Seller payout policy approval recorded with payout timing, holdback, refund-window, and dispute-freeze rules.
- Tax, shipping, fulfillment, and support-copy review recorded before Merch checkout is promoted.
- Separate Apple and Google Play exact-build physical-goods classification or reviewer-note evidence recorded privately before preauthorization; general policy review does not count as store approval.
- Support, Terms, Privacy, and Help copy checked against the live build and current payment status.

Repo-safe summary fields are limited to release candidate, test flow, live/test mode result, webhook event coverage result, Admin > Payments reconciliation result, refund/dispute review status, seller payout review status, native checkout policy status, reviewer initials or role, review date, and pass/fail/blocker status. Keep payment intent IDs, checkout session IDs, webhook event IDs, refund IDs, dispute IDs, seller account IDs, customer emails, buyer names, shipping addresses, seller onboarding account details, dashboard screenshots, bank/card details, webhook secrets, and raw console exports in the private release handoff only.

### Historical TTC-Owned Live-Money Cutover Preflight Matrix - Non-Operative

Complete the applicable phase privately against one release candidate. Before launch, Official TTC Merch must be `armed` and every excluded flow must be `blocked`; a production transaction is not preauthorization evidence. After launch, record the first genuine sale through `verify:payment-production-evidence` without reopening excluded flows.

| Flow | Mode and webhook preflight | Required live event proof | Admin reconciliation proof | Fulfillment or delivery gate | Payout/refund/dispute gate | Repo-safe result |
| --- | --- | --- | --- | --- | --- | --- |
| Official TTC Merch pilot checkout | Live/test mode setting, server payment key mode, webhook endpoint mode, US-only shipping, and checkout return path reviewed together. | Preauthorization proves event configuration without a real card. Post-transaction proof records the first genuine authorized sale and matching signed events. | Admin > Payments shows matching webhook receipt, order status, payment audit row, buyer receipt state, and order queue state after launch. | No fulfillment starts until payment is confirmed and order review passes. | TTC refund, dispute, tax, shipping, and support procedures are approved before arming. No seller payout is involved. | `armed` before master enablement, then `enabled`; no payment IDs, buyer names, addresses, or dashboard screenshots in repo docs. |
| Marketplace Merch checkout | Excluded from this pilot; the marketplace flow switch and seller-routing switch remain blocked. | `n/a` only with current private blocked-state proof and candidate source-gate proof. | `n/a` while blocked. | No marketplace fulfillment starts. | Seller onboarding, payout, refund, reserve, and dispute policy require separate approval. | `blocked`; all non-gate evidence remains `n/a`. |
| Prepaid ad campaign checkout | Excluded and source-disabled for this pilot. | `n/a` while source-disabled. | `n/a` while blocked. | No ad delivery starts from paid checkout. | Ad commerce policy requires separate approval. | `blocked`; all non-gate evidence remains `n/a`. |
| Booking deposit checkout | Excluded; booking checkout switch remains blocked. | `n/a` while blocked. | `n/a` while blocked. | No paid booking closeout starts. | Deposit cancellation, refund, dispute, and payout policy require separate approval. | `blocked`; all non-gate evidence remains `n/a`. |
| Seller payout readiness | Excluded; hosted onboarding and destination-charge routing remain blocked. | `n/a` while blocked. | `n/a` while blocked. | No marketplace fulfillment or payout release starts. | Onboarding, reserve, refund-window, dispute-freeze, and seller-suspension rules require separate approval. | `blocked`; all non-gate evidence remains `n/a`. |

### Historical TTC-Owned Draft Seller Payout Release Policy - Non-Operative

Do not release production seller payouts until this policy is finalized, reviewed, and reflected in Terms, seller onboarding, and support articles.

- Seller must be an approved artist, studio, vendor, or official TTC seller with active license/business verification and no active marketplace suspension.
- Seller payout setup must be completed through hosted onboarding and marked ready in Admin Merch before the first live order can be paid out.
- Initial launch hold: keep seller payouts in manual review until at least fulfillment proof, buyer delivery window, refund window, and dispute exposure are understood.
- Suggested first production rule: release seller funds only after the order is paid, item is marked fulfilled with tracking or clear fulfillment note, buyer has had a short review window, and no refund/dispute flag is open.
- Sellers must add tracking, a tracking link, or a clear pickup/handoff note before closing a paid Merch line item as fulfilled.
- Keep a reserve/holdback option for new sellers, high-risk categories, unusually large orders, repeated refund requests, or open moderation/payment investigations.
- Official TTC merch can use a separate internal fulfillment process, but it still needs order, refund, and dispute logging.

### Historical TTC-Owned Draft Shipping And Tax Procedure - Non-Operative

Before live Merch checkout, decide whether shipping and tax are platform-calculated, seller-provided, or limited to a narrow launch rule.

- Launch-safe option: start with seller-entered shipping notes and a limited shipping region, then move to calculated rates after real carrier/tax review.
- Require sellers to describe fulfillment timing, shipping method, and return/refund expectations before a product can be approved.
- Do not let products that require regulated, unsafe, adult sexual, counterfeit, or professional-equipment handling enter Merch.
- Keep buyer shipping addresses private to the seller/admin fulfillment surfaces only; do not expose them on public pages, feeds, screenshots, or notifications.
- Tax handling must be reviewed before production: decide nexus, marketplace facilitator responsibility, taxable categories, exemptions, and receipt language.
- Written Support and Help Center paths cover missing, damaged, wrong, delayed, or returned packages; keep them current before live checkout is promoted.

### Historical TTC-Owned Draft Refund And Dispute Procedure - Non-Operative

Refunds and disputes should stay admin-reviewed until the operational pattern is proven.

- Buyer refund requests create an audit/review item; they do not automatically send money back during launch.
- Admin must confirm order status, fulfillment proof, seller communication, buyer reason, and dispute risk before initiating a refund.
- The owner/admin Merch action supports full paid-order refunds only, blocks payments under dispute review, reconciles earlier refund activity, and uses a deterministic request key so a retry cannot send a duplicate refund.
- If a refund is approved, record whether it is full, partial, seller-funded, platform-funded, shipping-only, or goodwill credit before money moves.
- Failed refunds and chargebacks must create admin-visible payment audit records and should block seller payout release until reviewed.
- Disputed orders should freeze fulfillment changes, seller payouts, ad credits tied to the payment, and any manual closeout until the dispute is resolved.
- Repeat seller non-delivery, unsafe goods, counterfeit goods, or payment abuse should trigger seller suspension review.

## Separate Booking Deposit Procedure

Booking deposits need separate rules from Merch because they are tied to appointments and artist/studio calendars.

- Only verified artists and studios should request deposits through TTC booking flows.
- Booking checkout should open only after the artist/studio accepts the request, confirms the appointment/deposit terms, and the client can see the TTC fee.
- Deposit refund rules must cover cancellations, reschedules, no-shows, artist cancellation, shop emergencies, and failed calendar conflicts.
- Paid booking refund requests should remain admin-reviewed until the final cancellation policy is legally reviewed.
- Admin booking refund submission requires a readable, matching payment mode and verifies the retrieved payment intent's mode, booking-deposit kind, and booking ID before any refund lookup or request. It reuses a matching existing refund before sending a new request, uses one deterministic request key per booking payment, and must save its operator audit row before reporting success. Retrying after an ambiguous response or audit failure must not send a duplicate refund.
- Payout timing for booking deposits should account for appointment date, cancellation window, dispute window, and any shop-specific deposit policy.
- Calendar integrations must not expose private client notes, phone numbers, addresses, payment details, or admin-only review state.

## Native App Notes

- Keep web-first only as the operating sequence for commerce review; the wrappers load the production web app, so web exposure is also native-wrapper exposure.
- If checkout is exposed in native wrappers, confirm the current Google Play and Apple rules for physical goods, digital goods, ads, marketplace payments, and external payment links.
- Do not store Stripe secret keys, webhook secrets, Supabase service-role secrets, bank details, or raw card details in native code.
- Native checkout policy review must be dated and repeated for the exact build or release track before exposing checkout in iOS or Android wrappers. Current general policy permits external or non-store billing for physical goods under Apple App Review Guidelines 3.1.3(e) and Google Play Payments policy section 3, but exact-build reviewer notes or classification evidence remain pending by default and must pass separately for Apple and Google Play before preauthorization. Re-check both official sources before submission if the build, paid flows, or store rules change.
- Classify every paid native flow separately before promotion: Merch physical goods, accepted booking deposits or services, prepaid ad campaigns, any digital goods or digital services, marketplace seller payouts, and any external payment-link or web-return behavior.
- Record only repo-safe native policy results here or in the release summary: platform, build or track, flow name, source checked date, classification, pass/fail/blocker status, reviewer role, and review date. Keep policy screenshots, console account details, payment identifiers, customer/seller identifiers, private phone details, dashboard screenshots, and legal notes in the private release handoff.
- Do not claim native checkout availability, live payments, seller payouts, or production ad spend are ready until the native checkout policy classification, final legal review, and live-money payment evidence pack are complete for that platform.
