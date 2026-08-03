# Codex Recovery Handoff

## 2026-08-02 Seller-Owned Merch Checkout Release Candidate

Status: **IMPLEMENTATION READY FOR CONTROLLED ROLLOUT**. This status is not
`LIVE`, deployed, migrated, enabled, store-submitted, or physical-device QA
complete.

### Candidate Identity

- Branch: `codex/stripe-live-foundation`.
- Task 1-7 implementation/evidence head:
  `0735b6803ef35ce5c318cfd39c6e365c3adb605b`.
- Public-contract smoke fix:
  `89fabfe215e597a09a2a660daca0000f26cb0f7b`.
- Mobile-contract smoke fix and pre-handoff candidate:
  `cd11b0fd7669a23f2280192e84a78dd999fc7de4`.
- `89fabfe2` changes only the public smoke contract and PWA screenshot
  manifest. `cd11b0fd` changes only the mobile smoke contract.

### Layered Verification

- On `89fabfe2`: `git diff --check`,
  `npm.cmd run test:seller-checkout`,
  `npm.cmd run test:merch-checkout-route`,
  `npm.cmd run smoke:payments`, `npm.cmd run smoke:security`,
  `npm.cmd run smoke:env`, `npm.cmd run smoke:docs`,
  `npm.cmd run smoke:admin`, `npm.cmd run smoke:native`,
  `npm.cmd run lint`, and the controlled production build all passed.
- Focused evidence included 12 seller link/action contracts, 5 disposable
  PostgreSQL seller-checkout contracts, 4 fixed Merch 410 contracts, 93 direct
  payment guards, 60 direct security guards, 55 environment checks, 168
  documentation checks, 38 direct admin guards plus the complete admin
  authorization/idempotency suites, and native loader/wrapper/URL/session
  contracts.
- The controlled build produced 66 static pages and passed without exposing
  the validated public URL or publishable configuration values. Warnings were
  recorded separately: the configured `serverActions` experiment notice, one
  middleware deprecation warning, and two experimental Edge runtime warnings.
  Lint had no warnings or errors.
- On `89fabfe2`, local `smoke:public` passed against
  `http://127.0.0.1:3018`; no changed public smoke ran against production.
- On committed `cd11b0fd`, source accounting retained all 64 mobile route
  entries; lint, `git diff --check`, and default `smoke:mobile` passed.
- On `cd11b0fd`, one fresh local server served both remaining profiles:
  `smoke:mobile:narrow` passed at 320x568 in 212.3 seconds and
  `smoke:mobile:ios` passed with the iPhone Safari profile in 210.1 seconds.
  Each ran once with a 900000 ms timeout. Cleanup left zero server/browser/test
  processes, zero listeners on port 3018, and no `SMOKE_BASE_URL`.
- The four Task 8 boundary audits passed again on `cd11b0fd`: no caller reads
  terms version/timestamp, no checkout URL exists on product cards, no internal
  Merch checkout command or Connect dependency exists in Merch activation, and
  the only fee/transfer matches are historical admin refund reconciliation.

### Security And Data Boundary

- Seller checkout accepts only a canonical live
  `https://buy.stripe.com/<identifier>` URL. URL/control/SQL-shaped fixtures,
  forged seller/product/status fields, cross-owner writes, and zero-row writes
  fail closed without leaking protected values or claiming success.
- Create/edit actions use authenticated owner identity, verified-professional
  checks, exact product ID plus seller ID filters, a fixed
  `seller-checkout-v1` version, and `null` caller timestamp input. The
  database trigger replaces attempted timestamps with statement time.
- Protected checkout columns are not available to anonymous/authenticated
  direct reads. Product cards neither select nor render the protected URL.
- Merch activation requires moderator authorization, seller verification,
  moderation, inventory, fulfillment/return details, current accepted terms,
  and a valid live URL. Official TTC Merch activation remains blocked.

### Migration And Gates

- Migration
  `supabase/migrations/20260802130000_seller_owned_merch_checkout.sql` exists
  in source but has **not been applied** to production or any shared database.
- All nine committed gates remain exact false:
  - `STRIPE_EXPECTED_LIVEMODE=false`
  - `STRIPE_CHECKOUT_CREATION_ENABLED=false`
  - `STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED=false`
  - `STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED=false`
  - `STRIPE_BOOKING_CHECKOUT_ENABLED=false`
  - `STRIPE_CONNECT_ONBOARDING_ENABLED=false`
  - `STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false`
  - `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`
  - `TTC_NATIVE_PUSH_DELIVERY_ENABLED=false`
- Production code/config/data/secrets are unchanged. No deploy, inactive
  upload, migration, payment activation, live-money test, or production smoke
  occurred.
- App Store Connect, Google Play, Stripe, and browser/store consoles were not
  accessed or changed. Current console, store-build, Android-device, and
  TestFlight iPad identities remain **UNKNOWN**.
- No seller live link, seller payment identifier, customer record, or
  production data was created, reviewed, or changed.

### Exact Future Approvals Still Required

1. Separately approve applying
   `20260802130000_seller_owned_merch_checkout.sql`, then run read-only
   schema, grant, trigger, and RLS proof.
2. Separately approve an inactive Worker upload with the seller-link gate false;
   inspect it and prove all nine gates above remain false.
3. Separately approve production deployment of the reviewed commit with the
   seller-link gate false, followed by public/internal no-side-effect smoke.
4. Have one verified seller supply their own live physical-product Payment Link,
   fulfillment terms, return policy, and ship-from details. TTC must not create
   or alter that seller data.
5. Moderate that listing and prove its purchase control remains hidden while
   `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`.
6. With explicit owner approval, prepare and inspect a second inactive upload
   that changes only `TTC_SELLER_CHECKOUT_LINKS_ENABLED=true`; deploy only the
   inspected version after approval.
7. Run authorized live web smoke, then physical-device QA on one Android phone
   and the TestFlight iPad. Both must open the system browser, return cleanly,
   and never show a false TTC payment-success state.
8. Prove rollback by restoring only
   `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false` and confirming the public purchase
   control disappears while protected and historical records remain.

Android phone and TestFlight iPad physical-device QA remain required. No TTC
live-key cutover, Connect onboarding, destination charge, marketplace fee,
official TTC Merch sale, native artifact build/upload, or store resubmission is
authorized by this handoff.

## Original Project Goal

Continue the final release audit for TheTattooCore from the protected
`backup-before-final-audit-2026-07-25` baseline. Repair verified defects in
small reviewed commits, preserve release evidence and private data, and deploy
only if every release gate passes with a clean tree and a `RELEASE READY`
verdict.

The user stopped that audit and requested this recovery checkpoint before MCP
installation. No deployment is authorized from this checkpoint.

## Work Completed

- Confirmed repository `lobosdesigns/thetattoocore` and preserved the backup
  branch at commit `5ddf42c82c2f5a0677509bf45ef2a0561715ef0d`.
- Created and worked on `codex/final-audit-security-2026-07-25`.
- Committed compatible dependency remediation:
  - `1d7eb0c78a2d7b581c299eefb50ce3a4f2464eeb`
  - `fix: update compatible brace-expansion paths`
- Committed immutable release-evidence binding:
  - `3590b1430c7a28d799c8306873c98de8e108fece`
  - `fix: bind release evidence to git commits`
- Committed current native build evidence requirements:
  - `df40a672afb1713f0e705c376b9149dd0a6285cf`
  - `fix: require current native release builds`
- Verified the signed Android candidate artifact as version `1.0.4 (5)`,
  package `com.thetattoocore.app`, target SDK 36, and byte-identical to the
  local release bundle. Standard signature verification passed.
- Verified the connected Android device was authorized but still had Play
  build `1.0.3 (4)`, so build-5 device QA correctly remains blocked.
- Verified the Cloudflare plugin and Wrangler authentication, production
  Worker, active version, custom domains, non-secret binding names, fail-closed
  delivery flags, and a live successful `* * * * *` scheduled invocation.
- Confirmed no production deployment, DNS change, database migration, store
  submission, payment activation, or production-data change occurred.
- The production dependency audit is clean with `npm audit --omit=dev`.

## Work Partially Completed

The current uncommitted work removes Node
`MODULE_TYPELESS_PACKAGE_JSON` warnings from direct TypeScript contract tests.

- Added `scripts/import-self-contained-typescript.mjs`.
- Added `scripts/test-import-self-contained-typescript.mjs`.
- Migrated self-contained TypeScript contract tests to the loader.
- Kept the mail redaction test on real Node module resolution with the
  process-scoped `--experimental-default-type=module` flag because its source
  intentionally uses a lazy `worker-mailer` import.
- Hardened the loader to reject compiler diagnostics, static imports,
  re-exports, import types, `require`, and dynamic imports.
- Added coverage for invalid syntax, dependencies, paths containing spaces,
  module cache reuse, and source-change invalidation.
- A reviewer found defects in the first loader version. Those findings were
  addressed, but the expanded final change set has not received a final
  independent re-review.

Checkpoint validation passed:

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit --incremental false`
- `npm.cmd run test:typescript-loader`
- `npm.cmd run build`
- Affected smoke suites run during implementation: native, native push
  delivery, admin, security, content, DM, and payments

## Remaining Work

1. Independently review the checkpointed TypeScript test-loader change.
2. Resume the final release audit at the robots/indexing task.
3. Verify Supabase connectivity and production schema/advisors with the
   Supabase plugin. Do not apply migrations without a separate reviewed need.
4. Verify the installed MacCloud SSH skill and connection without changing the
   remote host.
5. Restore Chrome control after the Codex Windows ACL failure is resolved.
6. Run the complete repository verification and release preflight.
7. Re-run the live private release-evidence gate against the exact final
   commit.
8. Do not deploy until every private/device/legal/payment gate passes and the
   verdict is explicitly `RELEASE READY`.

## Known Errors And Blockers

- The live evidence gate against
  `df40a672afb1713f0e705c376b9149dd0a6285cf` fails closed with 38 incomplete
  private requirements. Categories include exact deployed commit, Android and
  iOS installed builds, reviewer access, real-device QA, two-user DM proof,
  iOS native push proof, cross-platform preferences, and legal review/signoff.
- Android build `1.0.4 (5)` has not been installed from a controlled Play track
  on the authorized device. The device still reports `1.0.3 (4)`.
- Apple universal-link association remains intentionally unavailable until
  private identifiers are configured.
- Native global delivery remains off. Registration code is staged, but
  cross-platform delivery/tap/preferences evidence is incomplete.
- Payments remain fail closed because valid production cutover evidence is not
  complete.
- The full development dependency audit still reports 13 high findings in
  legacy `brace-expansion` paths with no compatible published backport.
  Production dependencies report zero findings.
- The production build passes with existing warnings for the deprecated
  Next.js middleware convention, experimental Edge runtime, and webpack cache
  serialization of large strings.
- Android Gradle Plugin 8.7.2 warns that compile SDK 36 is newer than its tested
  SDK range. Release unit tests require private signing input and were not
  bypassed.
- Chrome control fails before connection with a Windows sandbox
  `apply deny-read ACLs` error.
- The Cloudflare connector cron GET endpoint returned API error 10000, but
  Wrangler live tail independently confirmed the active scheduled event.
- `.gitignore` does not explicitly cover generic `*.key` files or Android
  `key.properties`. No such credential file is currently tracked.

## Failed Approaches Not To Repeat

- Do not retry Chrome browser control until the Codex Windows ACL issue is
  repaired; repeated attempts fail before browser discovery.
- Do not retry the Cloudflare connector cron GET as the primary proof. Use the
  already-confirmed Wrangler live-tail method or inspect the signed-in
  Cloudflare dashboard once Chrome control works.
- Do not add `"type": "module"` to the repository root merely to silence test
  warnings; that changes application-wide module semantics.
- Do not weaken the self-contained loader to allow runtime imports. Use real
  Node module resolution for dependency-bearing tests.
- Do not run Android release unit tests without the private signing input and
  do not bypass signing guards.
- Do not sideload or uninstall the Play-installed Android app to fake build-5
  evidence.
- Do not treat `jarsigner -strict` upload-certificate trust/timestamp warnings
  as a corrupt AAB; ordinary signature verification passed.
- Direct `apply_patch` updates to tracked files may fail with the current
  Windows ACL. The successful fallback was an ignored patch under
  `.superpowers/` followed by `git apply --check` and `git apply`.
- `adb` is not on this shell's PATH. Its installed executable is under the
  Android SDK platform-tools directory.

## Important Files Changed

Current checkpoint files:

- `package.json`
- `scripts/import-self-contained-typescript.mjs`
- `scripts/test-import-self-contained-typescript.mjs`
- `scripts/smoke-admin-guards.mjs`
- `scripts/smoke-security-guards.mjs`
- `scripts/test-feed-post-publish.mjs`
- `scripts/test-message-conversation-selection.mjs`
- `scripts/test-native-app-url.mjs`
- `scripts/test-native-push-delivery.mjs`
- `scripts/test-native-session-contract.mjs`
- `scripts/test-payment-webhook-config.mjs`
- `scripts/test-stripe-checkout-sessions.mjs`
- `CODEX_HANDOFF.md`

Earlier committed release-evidence work is primarily in:

- `scripts/verify-release-evidence.mjs`
- `scripts/test-release-evidence-gate.mjs`
- `scripts/fixtures/release-evidence.passed.md`
- `scripts/smoke-private-handoff-template.mjs`
- `scripts/smoke-docs-readiness.mjs`
- `docs/MOBILE_APP_SUBMISSION_RUNBOOK.md`
- `package-lock.json`

## Database Migrations

No database migration was created, edited, applied, rolled back, or rehearsed
during this audit continuation. No production data was altered.

## External Services Involved

- GitHub: existing `origin` is
  `https://github.com/lobosdesigns/thetattoocore.git`.
- Cloudflare: authenticated plugin and Wrangler access; production Worker and
  cron were inspected read-only. No deploy or configuration change was made.
- Supabase: repository configuration exists; live plugin audit is still
  pending. No database change was made.
- Firebase/native push: configuration shape was audited; global delivery
  remains disabled.
- Google Play/Android SDK: signed build and connected-device state were
  inspected. No store or device installation change was made.
- Apple App Store Connect/TestFlight: existing evidence was audited only.
- Stripe: payment gates and tests were audited; no live-money action occurred.
- Chrome: Cloudflare was open, but Codex could not attach because of the local
  ACL failure.
- MacCloud SSH: the personal skill is installed but was not used before this
  checkpoint.

## Git State

- Source branch: `codex/final-audit-security-2026-07-25`
- Checkpoint branch: `checkpoint/pre-mcp-install`
- Current commit before checkpoint:
  `df40a672afb1713f0e705c376b9149dd0a6285cf`
- Git repository: initialized
- Deleted files: none

## Secret And Ignore Review

No real password, token, service-role key, private key, or complete environment
file was found in the checkpoint changes.

Secret-shaped references are synthetic test fixtures or variable-name guards:

- `scripts/smoke-admin-guards.mjs`: `SUPABASE_SERVICE_ROLE_KEY`
- `scripts/test-native-push-delivery.mjs`:
  `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_PRIVATE_KEY`
- `scripts/test-payment-webhook-config.mjs`: Stripe webhook test fixture
- `scripts/test-stripe-checkout-sessions.mjs`: `secretKey`

Git ignore verification passed for `.env`, `.env.local`, `node_modules`,
`.next`, `.open-next`, build output, private release evidence, PEM files,
native provider configuration files, JKS files, and keystores. Only
`.env.example` is tracked among environment-shaped files.

## Exact Recommended Next Step

After MCP installation, check out `checkpoint/pre-mcp-install`, read this file,
and run `git status --short --branch`. First perform a read-only independent
review of the TypeScript loader checkpoint. If it is clean, resume at the
robots/indexing audit, then Supabase and MacCloud SSH verification. Keep
deployment disabled until the 38 private release-evidence requirements are
cleared against the exact final commit.

## Commands To Run And Test

```powershell
npm.cmd run dev
npm.cmd run lint
npx.cmd tsc --noEmit --incremental false
npm.cmd run test:typescript-loader
npm.cmd run smoke:native
npm.cmd run test:native-push-delivery
npm.cmd run smoke:admin
npm.cmd run smoke:security
npm.cmd run smoke:content
npm.cmd run smoke:dm
npm.cmd run smoke:payments
npm.cmd run build
npm.cmd run verify
```

The full `verify` command performs live public/mobile smoke checks and may use a
connected Android device. It does not deploy, but it should be run only when
those external checks are intended.
