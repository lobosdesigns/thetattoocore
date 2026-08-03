# TheTattooCore App Completion Program Design

## Decision

TheTattooCore (TTC) will be completed through a sequential, evidence-gated
release program. The program covers the public iOS and Android apps, native
push delivery, seller-owned Merch, connected booking deposits, paid
advertising, production operations, security, privacy, legal/store review, and
post-launch stabilization.

This design does not attempt to finish every open-ended idea in
`docs/PRODUCT_PLAN.md`. Contests, new social surfaces, subscriptions, unrelated
redesigns, and speculative backlog items are outside the completion boundary.

The scope was confirmed by the owner on August 3, 2026.

## Completion Outcome

The program is complete only when all of the following are true at the same
time:

1. The exact reviewed web commit is serving 100 percent of production traffic
   and the public, mobile, security, payment, and release-evidence suites pass
   against it.
2. The exact reviewed Android build is publicly installable from Google Play,
   and the exact reviewed iOS build is publicly installable from the App Store.
3. A clean public-store install on one Android phone and one iPhone or iPad
   passes the complete real-device checklist.
4. Native remote notifications work while the app is foregrounded,
   backgrounded, and terminated, with visible system UI, sound, device feedback
   when enabled by the user, and correct tap routing. Account switching and
   logout do not leak notification delivery between users.
5. Seller-owned Merch is available to at least one verified seller through the
   reviewed external checkout flow, with TTC never receiving the merchandise
   proceeds or claiming responsibility for seller fulfillment.
6. Booking deposits are live for a controlled connected artist or studio. The
   charge is created directly on that provider's connected payment account,
   the customer pays the stated deposit amount, and TTC receives a disclosed 2
   percent application fee deducted from the provider side.
7. Paid TTC advertising is live on web, iOS, and Android through the billing
   path permitted for each surface. Purchased ad credits are non-expiring,
   idempotently granted, refundable under the approved policy, and spendable
   only on reviewed campaigns.
8. App Privacy, Data Safety, age rating, terms, support, payment disclosures,
   reviewer access, screenshots, and store metadata match the exact public
   builds and live web behavior.
9. Production completes seven consecutive calendar days with no unresolved
   severity-1 or severity-2 incident, no unresolved payment reconciliation
   failure, no cross-account notification delivery, and no store takedown or
   blocking compliance notice.

External review time does not count as completion. A build that is uploaded,
processed, selected, submitted, in review, or approved is not public until a
fresh store install proves public availability.

## Current Verified Baseline

- Planning starts from seller-checkout candidate
  `5ead3fb05fcd62302e80a1d6c4e39932d39bf2ae` on
  `codex/stripe-live-foundation`.
- Draft GitHub PR 1 contains the seller-owned Merch implementation.
- The seller checkout migration exists in source but is not applied to the
  production database.
- Production seller checkout, booking checkout, connected-account onboarding,
  TTC-owned Merch checkout, marketplace Merch checkout, destination charges,
  native push delivery, and expected live payment mode remain fail closed.
- Paid advertising is source-disabled by
  `src/lib/commerce-launch.ts`.
- Current source versions are Android `1.0.5 (6)` and iOS `1.0 (5)`. Store
  console selection, review state, and public availability must be rediscovered
  before any build decision.
- The native/store evidence verifier currently reports 176 incomplete private
  requirements across release identity, console state, tester installation,
  reviewer access, real-device QA, two-user messaging, native push, and legal
  signoff. This count is a starting observation, not a permanent target; the
  verifier must pass with zero incomplete requirements at completion.
- No active Codex completion goal existed when this design was prepared.

## Approaches Considered

### Selected: Sequential Gated Releases

Each money path and native capability is implemented, reviewed, released, and
proven independently. A coordinator tracks the master goal, while each phase
uses its own branch, focused tests, deployment evidence, and rollback point.

This is the selected approach because Merch, booking deposits, ads, native
push, and store distribution have different legal, financial, and device
failure modes. It minimizes the amount of live behavior changed at one time.

### Rejected: One Big Launch

This would merge push, both store releases, Merch, booking deposits, and ads
before any public proof. It could appear faster but would make store rejection,
payment reconciliation, notification failure, and rollback difficult to
isolate.

### Rejected: Fully Parallel Monetization Tracks

Separate teams could build booking and ads while the store release proceeds.
However, both tracks touch payment webhooks, account settings, legal copy,
native wrappers, and store metadata. Parallel implementation would create
avoidable merge and policy conflicts before the shared public baseline is
stable.

## Program Architecture

The work is divided into eight release phases:

1. Integrate and deploy the seller-owned Merch foundation with every live gate
   false.
2. Complete native push and exact-build device evidence in testing tracks.
3. Release the core app publicly on iOS and Android with paid ads and booking
   deposits still disabled.
4. Enable seller-owned Merch through one controlled seller pilot and prove its
   rollback.
5. Implement and release connected-account booking deposits.
6. Implement and release paid advertising with surface-specific billing.
7. Run whole-product security, privacy, legal, store, and operations
   certification.
8. Complete public launch stabilization and close the goal.

Every phase consumes the exact evidence from the preceding phase. A phase can
prepare source code while an earlier store review is pending, but it cannot
merge into the public release branch or expose live behavior until its own
entry criteria and approvals pass.

## Merch Revenue And Responsibility

Merch remains seller-owned:

- The seller creates and controls a live Stripe Payment Link in the seller's
  own account.
- TTC stores only the reviewed listing link, disclosure acceptance, and
  moderation state needed to open seller checkout.
- TTC does not create a Merch charge, receive proceeds, take a transaction fee,
  calculate tax, pay sellers, issue purchase receipts, fulfill products, or
  decide seller refunds and disputes.
- TTC may later earn revenue from fixed seller listing plans or sponsored Merch
  placements, but neither is part of the Merch transaction rollout.

The existing seller-owned Merch specification and implementation plan remain
authoritative for this phase:

- `docs/superpowers/specs/2026-08-02-seller-owned-merch-checkout-design.md`
- `docs/superpowers/plans/2026-08-02-seller-owned-merch-checkout.md`

## Booking Deposit Architecture

Booking deposits will use connected-account direct charges rather than TTC
receiving the deposit and transferring it later.

### Money Flow

1. A verified artist or studio completes connected-account onboarding and is
   eligible to accept charges and receive payouts.
2. The provider accepts a booking request and confirms the deposit amount and
   cancellation policy.
3. TTC creates Checkout on the connected account using the connected account
   request context.
4. The customer pays exactly the displayed deposit amount.
5. TTC sets a 2 percent `application_fee_amount`, rounded up to the nearest
   cent, which is deducted from the provider side of the charge.
6. The connected provider pays the payment processor's card-processing fees.
   TTC's 2 percent application fee is separate revenue and must not be labeled
   as the processor's fee.

For a $100.00 deposit, the customer pays $100.00. TTC's application fee is
$2.00. The connected provider receives the remainder after the TTC fee and the
processor's fees.

### Data Contract

Existing booking rows need additive, migration-safe fields that distinguish
historical buyer-paid fee records from new provider-paid direct charges:

- `fee_payer`: `client` for historical records or `provider` for new direct
  charges.
- `stripe_connected_account_id`: private server/admin-only identifier used for
  retrieval, refund, dispute, and reconciliation.
- `stripe_application_fee_id`: private server/admin-only identifier used for
  application-fee refund reconciliation.
- `payment_charge_model`: `platform` for historical records or
  `connected_direct` for the new flow.

For `connected_direct`, `total_cents` equals `deposit_amount_cents` and
`platform_fee_cents` records the TTC application fee deducted from the
provider. Existing records retain their historical arithmetic and are never
silently rewritten.

### Refunds And Disputes

- The provider's cancellation policy is accepted before checkout.
- Refund requests remain idempotent and auditable.
- A full deposit refund also reverses TTC's related application fee unless the
  approved written policy explicitly permits retaining it.
- Partial refunds reverse the proportional TTC application fee.
- Direct-charge disputes and negative balances remain attached to the
  connected provider wherever the configured account model permits it.
- TTC provides operational support and audit visibility without presenting
  itself as the tattoo service provider.

## Advertising Architecture

TTC advertising is first-party sponsored inventory, not Google AdMob. The app
will continue to use contextual placements in 4U, Gossip, Stuff, and Merch,
with admin review, visible sponsor labels, impression/click accounting, and no
sensitive behavioral targeting.

### Revenue Model

The prepaid campaign budget is TTC advertising revenue. Ads will not add the
shared 2 percent platform-fee line item because TTC already owns the inventory
being sold. Any store service fee or card-processing fee is an operating cost
and must be accounted for when setting the advertised campaign price.

### Billing By Surface

- Web: Stripe Checkout sells fixed, server-defined ad-credit packages.
- iOS/iPadOS: StoreKit in-app purchases sell the same approved ad-credit
  packages because the resulting advertisements appear inside TTC.
- Android: Google Play Billing sells the same packages unless TTC has completed
  and documented an applicable alternative-billing program for the user's
  market. Enrollment, reporting, and service-fee obligations must be proven
  before selecting an alternative path.

The ads release raises the iOS deployment target from 14.0 to 15.0 so the
native purchase bridge can use StoreKit 2. Before that change, the operator
must inspect current App Store device/OS usage and stop for owner review if the
change would strand public iOS 14 users. Android uses Google Play Billing
Library 9.1.0, the current official release verified on August 3, 2026, and
must recheck the supported version immediately before implementation.

The current official rules must be rechecked immediately before implementation
and immediately before each store submission:

- Apple App Review Guidelines 3.1.3(g):
  `https://developer.apple.com/app-store/review/guidelines/`
- Google Play Payments policy:
  `https://support.google.com/googleplay/android-developer/answer/9858738`
- Google Play US payment-program updates:
  `https://support.google.com/googleplay/android-developer/answer/15582165`

### Credit Ledger

Purchased and promotional credits share one atomic spending ledger but retain
different origins:

- `credit_origin`: `promo`, `stripe_web`, `apple_iap`, or `google_play`.
- `provider_transaction_id`: private unique identifier used for idempotency.
- `provider_product_id`: server-allowed package identifier.
- `refundable_cents`: remaining amount eligible for refund review.
- `expires_at`: always `null` for purchased credits; promotional credits may
  expire under disclosed terms.

Only a server-side verified payment event can grant purchased credit. Client
input cannot choose price, amount, origin, payment status, expiration, or
transaction identity. Duplicate webhooks, App Store transactions, Play
transactions, retries, and restore operations must produce exactly one credit
grant.

## Native Push Architecture

Registration and delivery remain separate gates. Registration can remain on
while global delivery remains off.

The release must prove:

- Android notification channel importance, sound, and vibration configuration.
- iOS alert, sound, badge, APNs entitlement, and permission state.
- foreground presentation, background delivery, terminated delivery, token
  refresh, and tap routing.
- account-switch and logout token isolation.
- quiet hours and per-category preferences.
- invalid or deleted target cleanup without a stale authenticated link.

The server outbox, delivery worker, provider credentials, native wrappers, and
device tests are one release unit. Global delivery can turn on only after the
exact Android and iOS testing builds pass the device matrix. Rollback changes
only `TTC_NATIVE_PUSH_DELIVERY_ENABLED` to exact `false` and leaves registration
and token cleanup operational.

## Store Release Architecture

The first public store release is the stable core app. Booking checkout and
paid ad purchase remain disabled until their later dedicated releases.

Before selecting any build, the operator must inspect the current signed-in
consoles and record privately:

- app/package identity and account role;
- highest uploaded and currently selected version/build;
- testing track, tester availability, review state, and public availability;
- reviewer credentials and notes;
- screenshots, listing title, age rating, privacy/data declarations, legal
  URLs, territories, pricing, agreements, tax, and banking blockers;
- release mode, including manual, phased, or automatic release.

The next build number is discovered from the consoles and must be greater than
every uploaded build for that platform. Source version numbers are not evidence
of console availability. The Android public title must be `The Tattoo Core` or
the owner-approved final brand name without `(Beta)`.

## Security, Privacy, And Legal Boundaries

- Every new or changed user-controlled field receives deterministic malicious
  input tests for authorization bypass, SQL/operator input, XSS, unsafe URLs,
  CRLF, oversized payloads, duplicate/replay behavior, and sensitive-data
  leakage.
- Payment amounts, product identifiers, account identifiers, fee rates, and
  entitlements are selected by trusted server configuration, never client
  input.
- Secrets, store identifiers, customer/payment records, reviewer credentials,
  raw screenshots, and legal evidence remain outside Git.
- Member-facing copy uses provider-neutral language except where a seller must
  understand that the seller supplies a Stripe Payment Link.
- No adult/minor targeting, sensitive behavioral targeting, hidden ads, false
  sponsor labels, or undisclosed paid placement is allowed.
- App Privacy, Data Safety, tracking disclosures, privacy manifests, and
  account deletion behavior must describe the exact production build.
- Final legal and tax decisions require the owner or qualified counsel. Codex
  prepares evidence and copy but does not make legal attestations on the
  owner's behalf.

## Approval Boundaries

The plan can prepare and test source without repeated approval. The following
remain separate explicit owner approvals at the moment of action:

- merging a shared branch or pull request;
- applying or rolling back a shared/production database migration;
- changing production configuration or secrets;
- inactive production-host upload when it contains new configuration;
- production deployment or traffic change;
- enabling seller checkout, native push, booking checkout, connected-account
  onboarding, ad purchases, or live payment mode;
- creating real connected accounts or moving/refunding real money;
- uploading, submitting, replacing, releasing, halting, or rolling back a
  store build;
- completing legal, tax, banking, identity, or policy attestations.

Waiting for a store, identity review, seller information, legal decision, or
physical-device action is not an implementation failure. The coordinator must
record the exact blocker and continue any independent safe work.

## Verification Strategy

Each implementation phase follows this order:

1. Write or update focused failing contracts.
2. Implement the smallest coherent source and schema change.
3. Run the focused suite and deterministic input-security suite.
4. Run lint and production build.
5. Inspect the diff, configuration invariants, migration, and rollback.
6. Obtain the required approval for shared/live action.
7. Prove the inactive or test-track artifact before exposure.
8. Run web and physical-device evidence against the exact artifact.
9. Record sanitized evidence and commit it separately.

The full completion gate includes:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run verify:app-review-preflight
npm.cmd run verify:payment-release
npm.cmd run verify:native-release
npm.cmd run verify:store-release
npm.cmd run verify:distribution-evidence
```

These commands do not replace manual console, real-money, legal, or
physical-device proof.

## Rollback Design

- Seller Merch: set only `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`.
- Native push: set only `TTC_NATIVE_PUSH_DELIVERY_ENABLED=false`.
- Booking deposits: set `STRIPE_BOOKING_CHECKOUT_ENABLED=false`; keep webhook
  handling and reconciliation available for earlier payments.
- Web ad purchases: disable the ad purchase gate while continuing to honor and
  reconcile already purchased credits.
- Native ad purchases: remove products from sale or disable server entitlement
  grants while retaining restore, refund, and reconciliation behavior for
  earlier transactions.
- Web release: restore the last inspected Worker version without reverting
  irreversible data records.
- Native release: pause rollout or submit a corrected higher build; never
  attempt to replace an already uploaded build number.

Schema migrations favor additive forward repair. Destructive rollback is not
the default once production records exist.

## Worktree And Coordination Model

The master plan lives on `codex/app-completion-program`. A new Codex worktree
should start from that branch after the planning commit exists. The coordinator
keeps the completion goal and evidence ledger. Each implementation phase uses
its own `codex/complete-XX-<phase>` branch and returns through a reviewed pull
request or an explicitly approved fast-forward.

No phase branch may silently inherit a stale production or store assumption.
Every new worktree starts with repository identity, `git status`, this design,
the master plan, `CODEX_HANDOFF.md`, and current console/live evidence.
