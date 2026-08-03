# TheTattooCore App Completion Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicly release and stabilize TheTattooCore on iOS, Android, and web with proven native push, seller-owned Merch, connected booking deposits, compliant paid advertising, and zero incomplete release-evidence requirements.

**Architecture:** Execute sequential release phases from one coordinator goal. Each phase uses a dedicated branch, focused tests, an explicit approval boundary for shared/live actions, exact artifact evidence, and a narrow rollback. The core app releases before booking deposits and paid ads so payment or store-policy failures cannot block the stable community product.

**Tech Stack:** Next.js 16.2.11, React 19.2.4, OpenNext Cloudflare 1.20.2, Wrangler 4.114.0, Supabase/Postgres, Stripe/Connect, Capacitor 7, Firebase Messaging, StoreKit 2, Google Play Billing Library 9.1.0, Android target SDK 36, Xcode/App Store Connect, Google Play Console.

## Global Constraints

- Start from `codex/app-completion-program`; do not add completion work to draft PR 1.
- Read `docs/superpowers/specs/2026-08-03-app-completion-program-design.md`, `CODEX_HANDOFF.md`, and the newest private handoff evidence at the start of every phase.
- Read the relevant guide in `node_modules/next/dist/docs/` before changing Next.js code.
- Use the Supabase skill before any schema, policy, function, grant, or production database work.
- Use official current Apple, Google, and Stripe documentation for every dated payment or store-policy decision.
- Do not merge, migrate, deploy, change production configuration, move/refund real money, enable native push, or submit/release a store build without a separate explicit owner approval at that action.
- Keep `TTC_NATIVE_PUSH_DELIVERY_ENABLED=false` until exact Android and iOS device delivery evidence passes.
- Keep `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false` until the controlled seller pilot is ready.
- Keep `STRIPE_BOOKING_CHECKOUT_ENABLED=false` and the checkout master false until booking live-money evidence passes.
- Keep paid ad purchases source/config disabled until web, Apple, and Google purchase verification passes.
- Seller-owned Merch never routes merchandise proceeds through TTC and never charges a TTC transaction fee.
- New booking direct charges take a disclosed 2 percent TTC application fee from the provider side; the customer pays the displayed deposit amount.
- The advertising budget is TTC revenue. Paid ads do not add the shared 2 percent platform-fee line item.
- Purchased ad credits never expire; promotional credits may expire only under disclosed terms and must retain a distinct origin.
- Every changed user-controlled input requires deterministic malicious-input tests before deployment.
- Never commit secrets, private account IDs, payment IDs, reviewer credentials, raw evidence, screenshots, or customer/seller records.
- Do not call a build uploaded, submitted, in review, approved, tester-available, public, or live without current exact console or device proof.
- Preserve historical payment/order records and webhook processing even when new checkout creation is disabled.

---

## Worktree Bootstrap

The next Codex task should open an isolated worktree from
`codex/app-completion-program`. Prefer the Codex native worktree action. Use the
Git fallback only when no native action is available:

```powershell
git worktree add C:\Users\lobos\Documents\Codex\Worktrees\thetattoocore-app-completion -b codex/app-completion-execution codex/app-completion-program
```

Immediately verify that the workspace is a linked worktree and not a submodule:

```powershell
git rev-parse --git-dir
git rev-parse --git-common-dir
git rev-parse --show-superproject-working-tree
git branch --show-current
git status --short --branch
```

Install from the committed lockfile and establish the local baseline:

```powershell
npm.cmd install
npm.cmd run smoke:env
npm.cmd run smoke:docs
npm.cmd run lint
npm.cmd run build
```

Expected: all commands pass. Existing documented build warnings may remain, but
new errors or warnings require investigation before Phase 1.

### Goal Objective

Use this exact objective for the coordinator goal:

> Complete the TheTattooCore app program in `docs/superpowers/plans/2026-08-03-app-completion-program.md`: publicly release exact reviewed iOS and Android builds; prove foreground, background, and terminated native push with account isolation; roll out seller-owned Merch without TTC handling sale proceeds; release Stripe Connect direct-charge booking deposits with a disclosed 2 percent provider-paid TTC application fee; release paid TTC ads using Stripe on web, StoreKit on iOS, and Play Billing or a documented approved alternative on Android; clear all code, security, legal, store, device, payment, and private release-evidence gates; and finish seven consecutive days without an unresolved severity-1 or severity-2 incident. Preserve all fail-closed gates and require explicit owner approval before every merge, migration, production/configuration change, live-money action, push enablement, or store submission/release.

---

### Task 1: Establish The Coordinator Baseline

**Files:**
- Review: `CODEX_HANDOFF.md`
- Review: `docs/APP_STORE_READINESS.md`
- Review: `docs/PAYMENT_PRODUCTION_READINESS.md`
- Review: `docs/LEGAL_REVIEW_PREP.md`
- Review: `docs/DATA_SAFETY_PREP.md`
- Review: `docs/REAL_DEVICE_QA_CHECKLIST.md`
- Review: `docs/superpowers/specs/2026-08-03-app-completion-program-design.md`
- Review: `docs/superpowers/plans/2026-08-03-app-completion-program.md`
- Private output: ignored release handoff generated by `prepare:private-release-handoff`

**Interfaces:**
- Consumes: planning branch and exact candidate `5ead3fb05fcd62302e80a1d6c4e39932d39bf2ae`.
- Produces: one coordinator worktree, one active goal, one private evidence ledger, and a recorded baseline SHA.

- [ ] **Step 1: Confirm repository and isolation.**

```powershell
git remote -v
git status --short --branch
git rev-parse HEAD
git worktree list
```

Expected: repository `lobosdesigns/thetattoocore`, the intended completion
branch, and no tracked local change. Ignore the pre-existing untracked
`.superpowers/`; never stage it.

- [ ] **Step 2: Read the current recovery and readiness state.**

Read every file listed above. Record disagreements between the newest dated
entry and current source as blockers; do not rewrite historical entries.

- [ ] **Step 3: Initialize ignored private evidence if it is absent.**

```powershell
npm.cmd run prepare:private-release-handoff
npm.cmd run smoke:handoff
```

Expected: the template passes shape validation and remains ignored by Git.

- [ ] **Step 4: Capture the current native/store evidence deficit.**

```powershell
$candidate = git rev-parse HEAD
npm.cmd run verify:release-evidence -- --release-profile native-store-distribution --release-candidate $candidate
```

Expected at entry: fail closed with explicit categories. Save only sanitized
counts in the coordinator notes; private console/device details stay in the
ignored handoff.

- [ ] **Step 5: Create the coordinator goal with the exact objective above.**

Use the Codex goal tool without a token budget. Do not mark it complete until
Task 11 passes.

---

### Task 2: Integrate Seller-Owned Merch Foundation

**Files:**
- Review: every file in GitHub PR 1
- Review: `docs/superpowers/specs/2026-08-02-seller-owned-merch-checkout-design.md`
- Review: `docs/superpowers/plans/2026-08-02-seller-owned-merch-checkout.md`
- Modify after merge only: `CODEX_HANDOFF.md`

**Interfaces:**
- Consumes: draft PR 1 at reviewed head `5ead3fb05fcd62302e80a1d6c4e39932d39bf2ae`.
- Produces: reviewed seller-link source on `main`, with migration unapplied and every live gate false.

- [ ] **Step 1: Refresh PR evidence without changing it.**

```powershell
gh pr view 1 --json state,isDraft,mergeable,baseRefName,headRefName,headRefOid,title,url
git fetch origin
git diff --check origin/main...origin/codex/stripe-live-foundation
git diff --stat origin/main...origin/codex/stripe-live-foundation
```

Expected: draft/open PR, base `main`, head
`codex/stripe-live-foundation`, and no whitespace errors. If the head SHA is
different, review the new commits before continuing.

- [ ] **Step 2: Re-run the seller foundation gates.**

```powershell
npm.cmd run test:seller-checkout
npm.cmd run test:merch-checkout-route
npm.cmd run smoke:payments
npm.cmd run smoke:security
npm.cmd run smoke:env
npm.cmd run smoke:docs
npm.cmd run smoke:admin
npm.cmd run smoke:native
npm.cmd run lint
npm.cmd run build
```

Expected: all pass. Warnings are recorded separately.

- [ ] **Step 3: Obtain explicit owner approval to mark PR 1 ready and merge.**

Do not infer this approval from approval to write this plan. The approval must
name PR 1 or its exact head SHA.

- [ ] **Step 4: Merge only the reviewed PR and update the execution branch.**

Use the approved GitHub merge method. Then:

```powershell
git fetch origin
git switch codex/app-completion-execution
git rebase origin/main
git status --short --branch
```

Expected: the completion branch contains the merged seller foundation and only
the ignored `.superpowers/` remains untracked.

- [ ] **Step 5: Prove every release gate remains false.**

```powershell
npm.cmd run smoke:env
npm.cmd run verify:seller-link-rollout-evidence
```

The strict evidence command is allowed to fail only for missing private/live
rollout proof. It must not report an enabled source/config gate.

---

### Task 3: Deploy Seller Foundation With Exposure Disabled

**Files:**
- Apply after approval: `supabase/migrations/20260802130000_seller_owned_merch_checkout.sql`
- Modify after verified deploy: `docs/APP_STORE_READINESS.md`
- Modify after verified deploy: `CODEX_HANDOFF.md`
- Private evidence: schema proof, Worker version proof, seller pilot proof

**Interfaces:**
- Consumes: merged seller-link source and unapplied migration.
- Produces: production schema and exact reviewed Worker source with `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`.

- [ ] **Step 1: Rehearse and inspect the migration without changing production.**

Use the Supabase skill. Verify object-name collisions, table/column existence,
RLS, grants, trigger behavior, and rollback notes. Run:

```powershell
npm.cmd run test:seller-checkout-db
npm.cmd run test:seller-checkout-input-mutations
```

Expected: all disposable database and malicious-input contracts pass.

- [ ] **Step 2: Obtain explicit approval for the named production migration.**

The approval must name
`20260802130000_seller_owned_merch_checkout.sql`. Apply exactly that migration,
then run read-only schema, policy, grant, trigger, and advisor checks.

- [ ] **Step 3: Build and upload an inactive Worker with all gates false.**

Obtain explicit approval for the inactive upload. Then:

```powershell
npx.cmd opennextjs-cloudflare build
npx.cmd opennextjs-cloudflare upload -- --keep-vars --var TTC_SELLER_CHECKOUT_LINKS_ENABLED:false --var TTC_NATIVE_PUSH_DELIVERY_ENABLED:false --var STRIPE_EXPECTED_LIVEMODE:false --var STRIPE_CHECKOUT_CREATION_ENABLED:false --var STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED:false --var STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED:false --var STRIPE_BOOKING_CHECKOUT_ENABLED:false --var STRIPE_CONNECT_ONBOARDING_ENABLED:false --var STRIPE_MERCH_DESTINATION_CHARGES_ENABLED:false
```

Inspect the returned version with `npx.cmd wrangler versions view`. Prove exact
source SHA, routes, cron, bindings, preserved secrets by name only, and zero
traffic.

- [ ] **Step 4: Obtain approval and deploy the inspected gate-false version.**

After deployment, prove 100 percent traffic is on the inspected version and run:

```powershell
npm.cmd run smoke:public
npm.cmd run smoke:mobile
npm.cmd run smoke:mobile:ios
npm.cmd run verify:seller-link-rollout-evidence
```

Expected: public and mobile behavior pass; seller purchase controls remain
hidden; no payment or seller-link side effect is exposed.

- [ ] **Step 5: Record sanitized deployment evidence.**

Update readiness and handoff docs with exact commit/version, tests actually
run, migration status, all false gates, and remaining seller/device approvals.
Commit only sanitized text.

---

### Task 4: Complete Native Push In Testing Tracks

**Files:**
- Modify as defects require: `src/lib/native-push/sender.ts`
- Modify as defects require: `src/lib/native-push/sender-core.ts`
- Modify as defects require: `src/app/native-notification-provider.tsx`
- Modify as defects require: `src/app/api/push/devices/route.ts`
- Modify as defects require: `src/app/api/push/devices/test/route.ts`
- Modify as defects require: `native/thetattoocore-mobile/android/app/src/main/java/com/thetattoocore/app/notifications/*`
- Modify as defects require: `native/thetattoocore-mobile/ios/App/App/*`
- Test: `scripts/test-native-push-delivery.mjs`
- Test: `scripts/smoke-native-push-guards.mjs`
- Test: `scripts/test-native-session-contract.mjs`
- Evidence: `docs/REAL_DEVICE_QA_CHECKLIST.md`, private handoff

**Interfaces:**
- Consumes: registration enabled, delivery disabled, existing push outbox and native wrappers.
- Produces: exact Android and iOS testing builds that pass the complete push matrix before global delivery is enabled.

- [ ] **Step 1: Reproduce current push behavior on both testing builds.**

Record version/build, user alias, app state, OS notification settings, expected
result, actual result, and timestamp. Test foreground, background, terminated,
sound, device feedback, badge, and tap routing. Do not treat in-app alerts as
system delivery.

- [ ] **Step 2: Run the source and account-isolation contracts.**

```powershell
npm.cmd run smoke:native-push
npm.cmd run test:native-push-delivery
npm.cmd run test:native-session
npm.cmd run test:messaging-notifications
```

- [ ] **Step 3: Add a failing contract for each reproduced defect.**

The contracts must cover Android channel importance/sound/vibration, iOS
foreground presentation, background payload shape, terminated routing, token
refresh, logout removal, and account-switch isolation. Do not patch around a
device setting that the app cannot control; report that state clearly.

- [ ] **Step 4: Implement only proven defects and rerun focused tests.**

```powershell
npm.cmd run smoke:native-push
npm.cmd run test:native-push-delivery
npm.cmd run smoke:native
npm.cmd run smoke:dm
npm.cmd run lint
npm.cmd run build
```

- [ ] **Step 5: Discover the next unused native build numbers from both consoles.**

Do not assume source `Android 1.0.5 (6)` or `iOS 1.0 (5)` is available. Record
the highest uploaded build and select a strictly greater build number per
platform.

- [ ] **Step 6: Obtain approval, sign, and upload testing builds only.**

Android goes to the existing closed testing track. iOS goes to TestFlight.
Keep public production, App Store version selection, Stripe, database data, and
`TTC_NATIVE_PUSH_DELIVERY_ENABLED=false` unchanged.

- [ ] **Step 7: Run the exact-build physical-device matrix.**

Use one Play-installed Android phone and one TestFlight iPhone/iPad. Test two
accounts, all app states, sound/device feedback, notification preferences,
quiet hours, token refresh, logout, account switch, deleted target, and tap
routing. Each required row must pass with private evidence.

- [ ] **Step 8: Enable delivery through an inspected inactive Worker version.**

Only after Step 7 passes, obtain explicit configuration/upload/deploy approval.
Change only `TTC_NATIVE_PUSH_DELIVERY_ENABLED=true`; preserve all payment and
seller gates. Inspect the inactive version before traffic, deploy it, repeat a
real Android and iOS notification, then prove rollback by restoring exact
`false` in another inactive version without deleting device registrations.

---

### Task 5: Release The Stable Core App Publicly

**Files:**
- Modify if needed: `native/store-metadata/google-play/en-US/title.txt`
- Modify if needed: `native/store-metadata/google-play/en-US/*`
- Modify if needed: `native/store-metadata/apple-app-store/en-US/*`
- Modify if needed: `docs/STORE_LISTING_DRAFT.md`
- Modify if needed: `docs/DATA_SAFETY_PREP.md`
- Modify if needed: `docs/LEGAL_REVIEW_PREP.md`
- Modify if needed: `docs/MOBILE_APP_SUBMISSION_RUNBOOK.md`
- Modify after proof: `docs/APP_STORE_READINESS.md`

**Interfaces:**
- Consumes: push-proven testing builds and gate-false booking/ad commerce.
- Produces: public iOS and Android core builds with exact store and install evidence.

- [ ] **Step 1: Audit both signed-in consoles read-only.**

Record app/package identity, role, current version/build, testing track,
production access, review state, tester count/eligibility, countries,
agreements, tax/banking blockers, reviewer access, release mode, privacy/data
forms, screenshots, and listing text. Current console state supersedes old
screenshots and chat recollections.

- [ ] **Step 2: Remove `(Beta)` from the public Android title.**

Use the owner-approved title `The Tattoo Core` unless the console already has a
different final approved brand name. Verify the title in source metadata and
the production listing preview. Do not confuse a closed-track label with the
public app title.

- [ ] **Step 3: Recheck official Apple and Google policies.**

Classify seller-owned physical Merch, real-world booking requests, paid ads
disabled, notifications, UGC, 18+ content, account deletion, and tracking for
the exact candidate. Update review notes and public disclosures before
submission.

- [ ] **Step 4: Run the store release preflight.**

```powershell
npm.cmd run verify:app-review-preflight
npm.cmd run verify:store-release
npm.cmd run verify:native-release
```

Expected: code/build checks pass. Private evidence may remain blocked only for
the console and public-install actions that follow.

- [ ] **Step 5: Obtain explicit approval for each store submission/release.**

Select only the push-proven exact build. Configure the owner's chosen release
mode. For Apple automatic release, verify the visible release setting before
submitting. For Google, satisfy the current production-access and rollout
requirements shown in the console; do not infer a fixed tester-day rule from
old policy.

- [ ] **Step 6: Wait for external review without replacing a valid build.**

Respond to reviewer questions with exact test credentials and neutral payment
explanations. Replace or resubmit only for a proven defect or rejection.

- [ ] **Step 7: Prove public availability with clean installs.**

Install from the public store page on Android and iOS. Record version/build,
store URL, install time, cold launch, login, logout, recovery, DMs, media,
links, privacy, deletion, and notifications. A tester or TestFlight install is
not public proof.

---

### Task 6: Roll Out Seller-Owned Merch

**Files:**
- Existing implementation: `src/lib/merch/seller-checkout.ts`
- Existing implementation: `src/app/merch/seller-checkout-dialog.tsx`
- Existing implementation: `src/app/merch/seller-checkout-fields.tsx`
- Existing implementation: `src/app/merch/[id]/page.tsx`
- Existing admin: `src/app/admin/merch/page.tsx`
- Evidence: `docs/PAYMENT_PRODUCTION_READINESS.md`, `docs/APP_STORE_READINESS.md`, private handoff

**Interfaces:**
- Consumes: public core apps, applied seller schema, gate-false production source.
- Produces: one verified seller pilot with system-browser checkout and proven rollback.

- [ ] **Step 1: Have one verified seller supply the required data.**

The seller, not TTC, supplies a canonical live physical-product Stripe Payment
Link, ship-from information, shipping amount/method, handling time, return
window, fulfillment contact, and seller terms acceptance.

- [ ] **Step 2: Moderate the seller and product while the gate is false.**

Verify seller professional status, physical product safety, inventory,
fulfillment, returns, link canonicalization, and malicious-input rejection.
Confirm the public purchase control remains hidden.

- [ ] **Step 3: Run strict rollout evidence.**

```powershell
npm.cmd run verify:seller-link-rollout-evidence
npm.cmd run verify:payment-release
```

Expected: zero source/config/schema/private blockers before enablement.

- [ ] **Step 4: Obtain approval for a one-variable inactive upload.**

Build and upload with `--keep-vars`, changing only
`TTC_SELLER_CHECKOUT_LINKS_ENABLED=true`. Inspect exact source, all other false
gates, routes, cron, and secrets by name before requesting deployment approval.

- [ ] **Step 5: Deploy and test without completing a purchase.**

Web must open a protected new tab. Android and iOS must open the system browser,
show the seller's domain/terms, return cleanly, and never claim TTC payment
success or create a TTC order.

- [ ] **Step 6: Prove rollback.**

Set only `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`, inspect/deploy, and confirm
purchase controls disappear while listing data and historical records remain.
Re-enable only after the rollback proof is recorded and explicitly approved.

---

### Task 7: Implement Connected-Account Booking Deposits

**Files:**
- Create: `supabase/migrations/20260803150000_booking_connected_direct_charges.sql`
- Create: `src/lib/stripe/connected-checkout-session.ts`
- Modify: `src/lib/stripe/checkout-session.ts`
- Modify: `src/lib/stripe/connect.ts`
- Modify: `src/app/api/bookings/checkout/route.ts`
- Modify: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/app/account/actions.ts`
- Modify: `src/app/account/page.tsx`
- Modify: `src/app/admin/payments/page.tsx`
- Modify: `src/lib/payments/fees.ts`
- Modify: `package.json`
- Create: `scripts/test-booking-connected-checkout.mjs`
- Modify: `scripts/test-booking-input-security.mjs`
- Modify: `scripts/test-booking-checkout-redirect-contract.mjs`
- Modify: `scripts/smoke-booking-guards.mjs`
- Modify: `scripts/smoke-payment-guards.mjs`
- Modify: `docs/PAYMENT_PRODUCTION_READINESS.md`
- Modify: `docs/LEGAL_REVIEW_PREP.md`
- Modify: `docs/DATA_SAFETY_PREP.md`

**Interfaces:**
- Consumes: existing booking lifecycle, Connect account table, 2 percent fee helper, Stripe webhook idempotency.
- Produces: connected direct-charge Checkout, provider-paid application fee, account-aware reconciliation, and fail-closed rollout gates.

The new server interface is:

```ts
export type ConnectedCheckoutSessionRequest = {
  body: URLSearchParams;
  connectedAccountId: string;
  idempotencyKey: string;
  secretKey: string;
};

export function createConnectedCheckoutSession(
  request: ConnectedCheckoutSessionRequest,
): Promise<StripeCheckoutSession>;
```

- [ ] **Step 1: Write failing schema contracts.**

Require additive booking columns `fee_payer`,
`stripe_connected_account_id`, `stripe_application_fee_id`, and
`payment_charge_model`; private grants; historical `platform/client` rows; new
`connected_direct/provider` arithmetic; immutable paid routing fields; and
indexes for account-aware reconciliation.

```powershell
npm.cmd run test:booking-lifecycle-db
npm.cmd run test:booking-input-security
```

- [ ] **Step 2: Write failing direct-charge route contracts.**

Assert that the route:

- requires both the checkout master and booking gate;
- selects an active live connected account for the accepted provider;
- charges exactly `deposit_amount_cents` to the client;
- sets `payment_intent_data[application_fee_amount]` to the server-calculated 2 percent fee;
- sends the connected-account request header through the new helper;
- stores connected account context privately;
- rejects caller-supplied amount, fee, account, payment status, and return URL;
- preserves reservation/idempotency/rollback behavior.

```powershell
npm.cmd run test:booking-connected-checkout
```

Expected: fail against the current platform-charge route.

- [ ] **Step 3: Add the migration and direct-charge helper.**

Historical rows retain their existing values. New rows default to
`connected_direct/provider` only after the feature version is deployed.
`createConnectedCheckoutSession` must validate `acct_` shape, set the connected
account request context, retain Stripe API error redaction, and accept no raw
client amount.

- [ ] **Step 4: Change booking request and acceptance arithmetic.**

For the new model:

```ts
const depositAmountCents = serverSelectedDeposit;
const platformFeeCents = calculatePlatformFeeCents(depositAmountCents);
const totalCents = depositAmountCents;
const feePayer = "provider";
const paymentChargeModel = "connected_direct";
```

Member copy must say the client pays the deposit amount. Provider setup copy
must disclose the 2 percent TTC application fee plus separate card-processing
fees.

- [ ] **Step 5: Make webhooks, refunds, and disputes account-aware.**

Persist the event's connected account context. Deduplicate by event ID and
account. Retrieve/refund the PaymentIntent on the same account. A full refund
reverses the full application fee; a partial refund reverses the proportional
fee. Retried, delayed, or ambiguous requests must not double-refund deposit or
fee. Dispute holds block booking completion/refund conflicts.

- [ ] **Step 6: Update provider/admin surfaces.**

Show connected-account readiness without exposing account IDs. Show deposit,
TTC fee, provider net estimate, payment state, refund state, dispute hold, and
reconciliation warnings to authorized roles. Preserve provider-neutral member
errors.

- [ ] **Step 7: Run focused security and payment coverage.**

Add `test:booking-connected-checkout` to `package.json` and run it from both
`smoke:booking` and `smoke:payments` so either release surface fails when the
direct-charge contract regresses.

```powershell
npm.cmd run test:booking-connected-checkout
npm.cmd run test:booking-input-security
npm.cmd run smoke:booking
npm.cmd run smoke:payments
npm.cmd run smoke:security
npm.cmd run smoke:admin
npm.cmd run lint
npm.cmd run build
```

- [ ] **Step 8: Commit booking implementation without deployment.**

Stage only booking/Connect files, tests, migration, and truthful docs. Confirm
all booking/payment gates remain false.

---

### Task 8: Roll Out Booking Deposits

**Files:**
- Apply after approval: `supabase/migrations/20260803150000_booking_connected_direct_charges.sql`
- Modify after proof: `docs/PAYMENT_PRODUCTION_READINESS.md`
- Modify after proof: `docs/APP_STORE_READINESS.md`
- Private evidence: connected account, live charge/refund, device/store review

**Interfaces:**
- Consumes: reviewed booking implementation with all gates false.
- Produces: one reconciled live direct-charge deposit and public exact-build booking availability.

- [ ] **Step 1: Obtain approval and apply the booking migration.**

Run schema, constraint, RLS, grant, function, advisor, and historical-row
checks. Do not onboard a provider or enable checkout in this step.

- [ ] **Step 2: Deploy booking source with checkout gates false.**

Use inactive upload, `--keep-vars`, version inspection, explicit deploy
approval, public smoke, and rollback proof. Verify existing bookings remain
readable and cannot create checkout.

- [ ] **Step 3: Complete one controlled connected-provider onboarding.**

The provider completes identity, business, bank, terms, and capability steps.
Record only readiness booleans and timestamps in repo-safe evidence.

- [ ] **Step 4: Recheck native store classification.**

Document booking deposits as payment for a real-world tattoo appointment. Add
review notes and submit a higher native build if the exact public build does not
already disclose and present the flow reviewed by Apple and Google.

- [ ] **Step 5: Enable one controlled booking checkout.**

After explicit live-money approval, inspect/deploy configuration enabling only
the checkout master, Connect onboarding if still required, and booking flow.
Keep TTC Merch marketplace and ad purchases disabled.

- [ ] **Step 6: Run an authorized low-value real-money lifecycle.**

Create request, provider accept, customer pay, webhook settle, provider balance
show, TTC application fee show, notification deliver, calendar state update,
full refund, application-fee reversal, and final reconciliation. Repeat the
client checkout and status checks on Android and iOS public/test builds.

- [ ] **Step 7: Prove fail-closed rollback.**

Set `STRIPE_BOOKING_CHECKOUT_ENABLED=false` while leaving webhook processing,
refunds, disputes, and historical reconciliation active. Confirm new checkout
is blocked and the completed payment remains visible.

---

### Task 9: Implement Paid Advertising Commerce

**Files:**
- Create: `supabase/migrations/20260803160000_ad_credit_purchase_sources.sql`
- Create: `src/lib/ads/credit-packages.ts`
- Create: `src/lib/ads/purchase-grant.ts`
- Create: `src/app/api/ads/purchases/apple/route.ts`
- Create: `src/app/api/ads/purchases/google/route.ts`
- Create: `src/app/api/ads/purchases/apple/notifications/route.ts`
- Create: `src/app/api/ads/purchases/google/notifications/route.ts`
- Modify: `src/app/api/ads/checkout/route.ts`
- Modify: `src/app/account/page.tsx`
- Modify: `src/app/account/ad-campaign-form.tsx`
- Modify: `src/app/admin/payments/page.tsx`
- Modify: `src/lib/commerce-launch.ts`
- Modify: `src/lib/payments/fees.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `wrangler.jsonc`
- Modify: `native/thetattoocore-mobile/capacitor.config.ts`
- Create: `native/thetattoocore-mobile/ios/App/App/TtcAdPurchasesPlugin.swift`
- Create: `native/thetattoocore-mobile/android/app/src/main/java/com/thetattoocore/app/payments/TtcAdPurchasesPlugin.java`
- Modify: `native/thetattoocore-mobile/android/app/build.gradle`
- Modify: `native/thetattoocore-mobile/ios/App/App.xcodeproj/project.pbxproj`
- Create: `scripts/test-ad-credit-purchases.mjs`
- Create: `scripts/test-ad-purchase-input-security.mjs`
- Modify: `scripts/smoke-payment-guards.mjs`
- Modify: `scripts/smoke-store-metadata.mjs`
- Modify: `docs/PAYMENT_PRODUCTION_READINESS.md`
- Modify: `docs/LEGAL_REVIEW_PREP.md`
- Modify: `docs/DATA_SAFETY_PREP.md`

**Interfaces:**
- Consumes: existing ad campaign moderation, ad-credit ledger, event tracking, and payment webhook patterns.
- Produces: idempotent web/Apple/Google ad-credit purchases with no extra TTC fee.

Use these US pilot products on all three surfaces:

```ts
export const adCreditPackages = {
  "ttc.adcredit.2500": { creditCents: 2500, webPriceCents: 2500 },
  "ttc.adcredit.5000": { creditCents: 5000, webPriceCents: 5000 },
  "ttc.adcredit.10000": { creditCents: 10000, webPriceCents: 10000 },
} as const;
```

Use this server grant contract:

```ts
export type AdCreditOrigin =
  | "promo"
  | "stripe_web"
  | "apple_iap"
  | "google_play";

export type VerifiedAdCreditPurchase = {
  creditCents: number;
  origin: Exclude<AdCreditOrigin, "promo">;
  productId: keyof typeof adCreditPackages;
  providerTransactionId: string;
  profileId: string;
};
```

- [ ] **Step 1: Recheck current official billing requirements.**

Confirm Apple same-app advertising rules, Google Play Billing and US
alternative-program rules, StoreKit server verification, Play Billing 9.1.0,
purchase acknowledgment/consumption, real-time notifications, refunds,
reporting, and service fees. Record source URL and check date in legal prep.

- [ ] **Step 2: Write failing credit-ledger contracts.**

Require `credit_origin`, unique `provider_transaction_id`,
`provider_product_id`, `refundable_cents`, non-expiring purchased credit,
expirable promo credit, immutable purchase identity, server-only grants,
atomic spend, idempotent refund/void, and no direct authenticated insert/update.

- [ ] **Step 3: Add surface-specific fail-closed gates.**

Add exact-false server configuration for:

```text
TTC_WEB_AD_PURCHASES_ENABLED=false
TTC_IOS_AD_PURCHASES_ENABLED=false
TTC_ANDROID_AD_PURCHASES_ENABLED=false
```

Replace the compile-time `AD_PURCHASES_AVAILABLE=false` boundary with a
server-controlled surface eligibility result. Add a native wrapper marker and
ensure the web Stripe control never renders inside the native wrapper.

- [ ] **Step 4: Remove the 2 percent ad fee.**

Web checkout charges only the server-selected package price. Existing booking
fee behavior remains unchanged. Historical ad rows keep their recorded fee;
new purchased-credit campaigns record zero `platform_fee_cents`.

- [ ] **Step 5: Implement web Stripe credit purchase.**

Use fixed package IDs, server-selected price/credit amount, Checkout
idempotency, webhook verification, unique transaction grants, refunds, dispute
holds, and Admin reconciliation. Never grant credit from the browser success
return alone.

- [ ] **Step 6: Implement iOS StoreKit 2 purchases.**

Raise the ads-release iOS deployment target from 14.0 to 15.0 after confirming
the store/device impact. Use StoreKit 2 consumables, send signed transaction
data to the server, verify before granting credit, finish only after durable
grant, observe transaction updates, and restore unfinished transactions. Stop
for owner review if public iOS 14 users would be excluded.

- [ ] **Step 7: Implement Android Play Billing 9.1.0 purchases.**

Use one `BillingClient`, automatic reconnection, pending one-time products,
`queryPurchasesAsync` on reconnect/resume, server verification, grant-before-
consume ordering with idempotency, backend consume/acknowledgment, Real-time
Developer Notifications, and voided-purchase reconciliation.

- [ ] **Step 8: Update advertising and admin UI.**

Show store-supplied localized native prices, web prices only on web, credit
balance, non-expiration for purchased credits, promo expiration separately,
campaign review state, spend, refunds, and support path. Retain clear Sponsored
labels, contextual targeting explanations, and inappropriate-ad reporting.

- [ ] **Step 9: Run adversarial and payment coverage.**

Test forged product IDs, prices, credit amounts, users, providers,
transactions, signatures, purchase tokens, duplicate callbacks, replayed
webhooks, pending/canceled/refunded purchases, account switching, oversized
payloads, SQL/operator input, unsafe URLs, and secret leakage.

Add `test:ad-credit-purchases` and `test:ad-purchase-input-security` to
`package.json`; run both from `smoke:payments`, and run the input-security suite
from `smoke:security` as well.

```powershell
npm.cmd run test:ad-credit-purchases
npm.cmd run test:ad-purchase-input-security
npm.cmd run smoke:payments
npm.cmd run smoke:security
npm.cmd run smoke:admin
npm.cmd run smoke:store
npm.cmd run lint
npm.cmd run build
```

- [ ] **Step 10: Commit with every ad gate false.**

Do not create products in consoles, apply the migration, deploy, or move money
in the implementation commit.

---

### Task 10: Roll Out Paid Advertising

**Files:**
- Apply after approval: `supabase/migrations/20260803160000_ad_credit_purchase_sources.sql`
- Configure after approval: App Store Connect consumables
- Configure after approval: Google Play one-time products and RTDN
- Configure after approval: Stripe web Checkout/webhook
- Modify after proof: readiness, legal, data safety, store metadata, private handoff

**Interfaces:**
- Consumes: reviewed ads implementation with all three surface gates false.
- Produces: US pilot purchases and reviewed ad campaigns on web, iOS, and Android.

- [ ] **Step 1: Apply schema and deploy source with all ad gates false.**

Use separate migration and deployment approvals. Prove current campaign
creation/review still works and no purchase or credit-spend control is exposed.

- [ ] **Step 2: Create matching store and web products.**

Create exactly `ttc.adcredit.2500`, `ttc.adcredit.5000`, and
`ttc.adcredit.10000`. Use US pilot availability, reviewed names/descriptions,
and no subscription or expiration claim. Keep products unavailable outside the
pilot until policy, currency, tax, and support are approved.

- [ ] **Step 3: Configure server verification and notifications.**

Keep private credentials outside Git. Prove Apple signed transaction and
server-notification verification, Google Developer API and RTDN verification,
Stripe webhook events, duplicate-event handling, and refund/void
reconciliation in sandbox/test modes.

- [ ] **Step 4: Upload native sandbox candidates.**

Obtain approval, use the next unused build numbers, and upload to TestFlight
and Google closed testing. Do not select them for public release yet.

- [ ] **Step 5: Run one complete purchase per surface.**

For $25 equivalent: purchase, server verify, one credit grant, campaign submit,
admin approve, credit spend, sponsored impression, intentional click, refund or
void, balance/reconciliation update, and duplicate callback replay. Run web,
iOS sandbox, and Android license-tester cases independently.

- [ ] **Step 6: Obtain store review and public release approval.**

Submit the exact purchase-proven builds with review notes, test account,
product IDs, sponsor labels, targeting explanation, and refund/support path.
Do not enable a surface gate before its exact build and product are approved.

- [ ] **Step 7: Enable one surface at a time.**

Order: web Stripe, iOS StoreKit, Android Play Billing/approved alternative.
Each enablement uses an inspected inactive Worker version, one gate change,
explicit deployment approval, a low-value production purchase, reconciliation,
and rollback proof before the next surface.

---

### Task 11: Certify The Whole Product And Stabilize

**Files:**
- Modify: `docs/APP_STORE_READINESS.md`
- Modify: `docs/PAYMENT_PRODUCTION_READINESS.md`
- Modify: `docs/LEGAL_REVIEW_PREP.md`
- Modify: `docs/DATA_SAFETY_PREP.md`
- Modify: `docs/REAL_DEVICE_QA_CHECKLIST.md`
- Modify: `CODEX_HANDOFF.md`
- Private evidence: exact final release ledger

**Interfaces:**
- Consumes: public core apps and proven Merch, booking, ads, and push phases.
- Produces: zero incomplete release requirements and seven-day stable public operation.

- [ ] **Step 1: Run repository and live certification.**

```powershell
git diff --check
npm.cmd run lint
npm.cmd run build
npm.cmd run verify
npm.cmd run verify:app-review-preflight
npm.cmd run verify:payment-release
npm.cmd run verify:native-release
npm.cmd run verify:store-release
```

Expected: zero failures. Run mobile smoke serially if browser instability is
known. A transient rerun requires a recorded reason.

- [ ] **Step 2: Run database and production-configuration audits.**

Use the Supabase skill for migration ledger, RLS, grants, advisors, functions,
and payment/push table integrity. Use Wrangler for exact 100-percent version,
bindings, routes, cron, and live tail. Verify no unexpected secret/config drift.

- [ ] **Step 3: Complete the real-device matrix on public installs.**

Android and iOS each pass cold/warm launch, auth persistence, password autofill,
logout/account switching, DMs, posts, Stories, video previews, links, booking,
Merch, ads, notifications, privacy, report/block, deletion, rotation/back, and
keyboard/safe-area checks.

- [ ] **Step 4: Clear every private release-evidence row.**

```powershell
$candidate = git rev-parse HEAD
npm.cmd run verify:release-evidence -- --release-profile native-store-distribution --release-candidate $candidate
```

Expected: `0 private release evidence requirement(s) remain incomplete`.

- [ ] **Step 5: Obtain final owner/legal/operations signoff.**

The owner completes only truthful legal, identity, tax, banking, policy, and
release attestations. Confirm support ownership, refund/dispute procedures,
seller and provider responsibilities, ad moderation, escalation, and rollback
contacts.

- [ ] **Step 6: Monitor seven consecutive calendar days.**

Each day verify:

- public web and store availability;
- zero unresolved severity-1 or severity-2 incident;
- zero cross-account notification event;
- zero payment processing claim older than 10 minutes;
- zero unexplained duplicate credit, deposit, fee, refund, or webhook action;
- push delivery and tap routing sample on both platforms;
- no blocking Apple/Google/Stripe/Supabase/Cloudflare compliance alert;
- support queue reviewed and urgent reports assigned.

Restart the seven-day window after any unresolved severity-1/severity-2 event
or production rollback that changes user-visible scope.

- [ ] **Step 7: Commit the final sanitized release record.**

Record exact commits, Worker version, public native versions/builds, test
commands, dates, gate states, and seven-day result without private identifiers.
Keep the raw evidence ignored.

- [ ] **Step 8: Mark the coordinator goal complete.**

Use the goal tool only after every prior checkbox and the zero-incomplete
release verifier pass. Report final goal token usage returned by the tool.

## Phase Branches

Use one branch per independently reviewable phase:

```text
codex/complete-01-seller-foundation
codex/complete-02-native-push
codex/complete-03-public-core-stores
codex/complete-04-seller-merch-rollout
codex/complete-05-booking-deposits
codex/complete-06-booking-rollout
codex/complete-07-paid-ads
codex/complete-08-paid-ads-rollout
codex/complete-09-final-certification
```

Each branch starts from the latest approved integration baseline, contains one
coherent release unit, and returns through review. Do not keep implementation
commits on the coordinator branch.

## Completion Rule

The phrase `PROJECT COMPLETE` is reserved for Task 11 Step 8. Before that,
report the exact phase and state, such as `CODE READY`, `TEST TRACK AVAILABLE`,
`WAITING FOR REVIEW`, `PUBLIC`, `LIVE PILOT`, or `STABILIZING`.
