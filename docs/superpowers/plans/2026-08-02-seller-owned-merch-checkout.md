# Seller-Owned Merch Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let approved TheTattooCore Merch listings open a seller-controlled live Stripe Payment Link while TTC remains outside the merchandise payment, order, tax, fulfillment, refund, dispute, and payout flow.

**Architecture:** Store a canonical seller checkout URL and server-stamped terms acceptance on `merch_products`, but deny those columns to normal PostgREST reads and writes. Server Components reveal a normalized link only after a dedicated exact-match release gate and readiness check. Web uses a protected new-tab link; Capacitor iOS/Android uses the already-wired native Browser plugin. The old TTC Merch Checkout route rejects before any Stripe, order, or inventory side effect, while historical test records remain readable.

**Tech Stack:** Next.js 16.2.11 App Router and Server Actions, React 19, TypeScript, Supabase/PostgreSQL RLS, Stripe Payment Links, Capacitor 7 Browser, Node contract tests, temporary PostgreSQL integration tests, existing Playwright/mobile smoke scripts.

## Global Constraints

- Read and follow `node_modules/next/dist/docs/01-app/02-guides/forms.md`, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, and `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` before editing the corresponding Next.js surfaces.
- Work only on `codex/stripe-live-foundation`. Do not push or merge to shared `main` without a new exact authorization.
- Do not apply the migration, change production data, deploy the Worker, change Cloudflare variables, upload a native build, or alter either store submission during implementation.
- Keep `STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED=false`, `STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED=false`, `STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false`, `STRIPE_CONNECT_ONBOARDING_ENABLED=false`, and `TTC_NATIVE_PUSH_DELIVERY_ENABLED=false`.
- Add `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`; only a later separately authorized rollout may set this one switch to exact lowercase `true`.
- Preserve historical `merch_orders`, order items, Stripe events, refund/dispute records, Connect records, and their admin reconciliation views. Do not backfill or delete them.
- Do not add TTC fees, Checkout Sessions, PaymentIntents, webhooks, callbacks, customer identifiers, tracking parameters, or success URLs to seller-owned purchases.
- Keep product cards as links to TTC product detail pages. The detail page is the only purchase entry point.
- Treat every seller field as hostile input. The required final report must include a `USER INPUT SECURITY REVIEW` section naming the malicious fixtures and authorization proofs run.
- Keep `.superpowers/`, private handoffs, screenshots, logs, payment identifiers, and secrets untracked.
- Use `npm.cmd` and `npx.cmd` on Windows. Use `apply_patch` for manual edits.
- Relevant policy references: [Stripe Payment Links](https://docs.stripe.com/payment-links), [Apple 3.1.3(e)](https://developer.apple.com/app-store/review/guidelines/#goods-and-services), [Google Play Payments physical-goods exception](https://support.google.com/googleplay/android-developer/answer/9858738), and [Texas marketplace providers and sellers](https://comptroller.texas.gov/taxes/sales/marketplace-providers-sellers.php).

---

### Task 1: Build the canonical Payment Link validator and release/readiness gates

**Files:**
- Create: `src/lib/merch/seller-checkout.ts`
- Create: `scripts/test-seller-checkout-links.mjs`
- Modify: `package.json`

**Interfaces:**

```ts
export const SELLER_CHECKOUT_TERMS_VERSION = "seller-checkout-v1";

export type SellerCheckoutUrlResult =
  | { ok: true; url: string }
  | { ok: false; code: "required" | "too_long" | "invalid" | "test_link" };

export type SellerCheckoutReadinessInput = {
  externalCheckoutUrl: unknown;
  fulfillmentNotes: string | null;
  inventoryQuantity: number;
  inventoryReserved: number;
  isOfficial: boolean;
  moderationStatus: string;
  returnPolicy: string | null;
  sellerCheckoutTermsAcceptedAt: string | null;
  sellerCheckoutTermsVersion: string | null;
  sellerVerified: boolean;
  shippingRequired: boolean;
  shipsFromCity: string | null;
  shipsFromRegion: string | null;
  status: string;
};

export type SellerCheckoutReadinessReason =
  | "disabled"
  | "official_product"
  | "seller_unverified"
  | "sold_out"
  | "missing_fulfillment"
  | "missing_terms"
  | "invalid_url"
  | "not_active"
  | "not_moderated";

export type SellerCheckoutReadiness =
  | { ready: true; reason: null; url: string }
  | { ready: false; reason: SellerCheckoutReadinessReason; url: null };

export function validateSellerCheckoutUrl(
  value: unknown,
  options?: { allowTest?: boolean },
): SellerCheckoutUrlResult;

export function sellerCheckoutLinksEnabled(
  environment?: Record<string, unknown>,
): boolean;

export function sellerCheckoutSubmissionReadiness(
  input: SellerCheckoutReadinessInput,
): SellerCheckoutReadiness;

export function sellerCheckoutPurchaseReadiness(
  input: SellerCheckoutReadinessInput,
  environment?: Record<string, unknown>,
): SellerCheckoutReadiness;
```

- [ ] **Step 1: Write the failing validator and readiness tests.**

Use `importTypeScriptWithStubs` from `scripts/admin-module-test-harness.mjs` and stub `{ "server-only": {} }`. Include this fixture table exactly, plus readiness cases for official products, unverified sellers, sold-out products, missing terms, incomplete fulfillment, inactive/hidden products, and an exact false/true gate:

```js
const validLiveUrl = "https://buy.stripe.com/a1B2_c3D4";
const invalidUrls = [
  "",
  "javascript:alert(1)",
  "data:text/html,boom",
  "file:///etc/passwd",
  "http://buy.stripe.com/a1B2",
  "https://buy.stripe.com.evil.example/a1B2",
  "https://buy.stripe.com@evil.example/a1B2",
  "https://user:pass@buy.stripe.com/a1B2",
  "https://buy.stripe.com:444/a1B2",
  "https://buy.stripe.com/a1B2?email=victim@example.com",
  "https://buy.stripe.com/a1B2#fragment",
  "https://buy.stripe.com/",
  "https://buy.stripe.com/a/b",
  "https://buy.stripe.com/a1B2/",
  "https://buy.stripe.com/%2f%2fevil.example",
  "https://buy.stripe.com/%ZZ",
  "https://buy.stripe.com/a1B2\r\nX-Test: injected",
  "\u0000https://buy.stripe.com/a1B2",
  "https://b\u0443y.stripe.com/a1B2",
  "https://xn--by-eka.stripe.com/a1B2",
  `https://buy.stripe.com/${"a".repeat(256)}`,
  "x".repeat(501),
];
```

Also assert that `https://buy.stripe.com/test_123` returns `test_link` by default and succeeds only with `{ allowTest: true }`.

- [ ] **Step 2: Run the test and verify the expected failure.**

Run:

```powershell
node --no-warnings --experimental-vm-modules scripts/test-seller-checkout-links.mjs
```

Expected: non-zero exit because `src/lib/merch/seller-checkout.ts` does not exist.

- [ ] **Step 3: Implement the smallest pure server module.**

Start the module with `import "server-only";` so the environment gate cannot be pulled into a Client Component.

The validator must reject raw control characters or whitespace before calling `new URL`, require exact `https:`, exact normalized hostname/host `buy.stripe.com`, no credentials/port/query/fragment, and exactly one path segment matching `/^\/([A-Za-z0-9_]{1,255})$/`. Return only `https://buy.stripe.com/${identifier}`.

The submission readiness function must require: non-official product, verified seller, available inventory above zero, fulfillment and return text of at least 10 trimmed characters, ship-from city and region when shipping is required, current terms version, a parseable acceptance timestamp, and a valid live URL. The purchase readiness function must additionally require the exact feature gate, `status === "active"`, and `moderationStatus === "active"`.

- [ ] **Step 4: Add the focused package script and run it green.**

Add:

```json
"test:seller-checkout-links": "node --no-warnings --experimental-vm-modules scripts/test-seller-checkout-links.mjs"
```

Run:

```powershell
npm.cmd run test:seller-checkout-links
```

Expected: PASS lines for canonical URL validation, malicious URL rejection, exact release gate behavior, submission readiness, and public purchase readiness.

- [ ] **Step 5: Commit the security primitive.**

```powershell
git add src/lib/merch/seller-checkout.ts scripts/test-seller-checkout-links.mjs package.json
git commit -m "feat: validate seller-owned merch checkout"
```

---

### Task 2: Add protected checkout columns, trusted acceptance stamping, and database proofs

**Files:**
- Create: `supabase/migrations/20260802130000_seller_owned_merch_checkout.sql`
- Create: `scripts/test-seller-checkout-db-contracts.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing temporary-PostgreSQL contract test.**

Reuse the `initdb`/`pg_ctl`/`psql` lifecycle helpers from `scripts/test-booking-lifecycle-db-contracts.mjs`. Its fixture must create `anon`, `authenticated`, and `service_role bypassrls`, `auth.uid()`, `private`, minimal `profiles`, the current `merch_products` columns touched by the migration, the existing seller RLS policies, and two verified sellers.

Assert all of these behaviors against the migration:

1. Existing rows stay null; there is no checkout backfill.
2. `anon` and `authenticated` can select `id` but receive `permission denied` for `external_checkout_url`.
3. `service_role` can read the protected columns.
4. An authenticated seller cannot directly add, replace, clear, version, or timestamp checkout fields.
5. A second seller cannot change another seller's row.
6. A trusted write of a canonical URL plus `seller-checkout-v1` receives a database-generated timestamp.
7. A direct owner update to price, product identity, fulfillment, ship-from, or return fields clears terms version/timestamp, leaving the link unavailable until renewed acceptance.
8. Arbitrary hosts, query strings, fragments, malformed paths, and more than 500 characters fail the database constraint.

- [ ] **Step 2: Run the DB test and verify the expected failure.**

```powershell
node scripts/test-seller-checkout-db-contracts.mjs
```

Expected: non-zero exit because the migration file does not exist.

- [ ] **Step 3: Add the forward-only migration.**

Implement these schema contracts inside one `begin`/`commit` transaction:

```sql
alter table public.merch_products
  add column if not exists external_checkout_url text,
  add column if not exists seller_checkout_terms_version text,
  add column if not exists seller_checkout_terms_accepted_at timestamptz;

alter table public.merch_products
  add constraint merch_products_external_checkout_url_shape
    check (
      external_checkout_url is null
      or (
        char_length(external_checkout_url) <= 500
        and external_checkout_url ~ '^https://buy[.]stripe[.]com/[A-Za-z0-9_]{1,255}$'
      )
    ),
  add constraint merch_products_seller_checkout_terms_consistency
    check (
      (seller_checkout_terms_version is null and seller_checkout_terms_accepted_at is null)
      or (
        external_checkout_url is not null
        and seller_checkout_terms_version = 'seller-checkout-v1'
        and seller_checkout_terms_accepted_at is not null
      )
    );
```

Add a `security invoker` `private.protect_merch_seller_checkout_fields()` `BEFORE INSERT OR UPDATE` trigger with fixed empty `search_path`. It must:

- reject protected-column changes unless `current_user` is `postgres`, `supabase_admin`, or `service_role`;
- stamp `statement_timestamp()` when a trusted write supplies the fixed current version and a URL;
- clear version/timestamp when a trusted writer clears the URL or current version;
- invalidate version/timestamp when title, description, category, SKU, price, currency, shipping, ship-from, fulfillment, or return terms change without a trusted renewed acceptance;
- never change status, moderation, inventory, historical orders, or payment records.

Revoke execute on the trigger function from `public`, `anon`, and `authenticated`.

Finally, prevent the release gate from being bypassed through PostgREST:

```sql
revoke select on table public.merch_products from anon, authenticated;

do $$
declare
  safe_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into safe_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'merch_products'
    and column_name not in (
      'external_checkout_url',
      'seller_checkout_terms_version',
      'seller_checkout_terms_accepted_at'
    );

  execute format(
    'grant select (%s) on table public.merch_products to anon, authenticated',
    safe_columns
  );
end;
$$;

grant select on table public.merch_products to service_role;
```

- [ ] **Step 4: Add the DB package script.**

Add:

```json
"test:seller-checkout-db": "node scripts/test-seller-checkout-db-contracts.mjs"
```

- [ ] **Step 5: Run the DB contract test green and add the aggregate script.**

```powershell
npm.cmd run test:seller-checkout-db
```

Expected: PASS for grants, trusted timestamp ownership, malicious SQL values, owner isolation, terms invalidation, and zero-row backfill.

Then add:

```json
"test:seller-checkout": "npm run test:seller-checkout-links && npm run test:seller-checkout-db"
```

Run `npm.cmd run test:seller-checkout` and expect both suites to pass.

- [ ] **Step 6: Commit the schema contract without applying it.**

```powershell
git add supabase/migrations/20260802130000_seller_owned_merch_checkout.sql scripts/test-seller-checkout-db-contracts.mjs package.json
git commit -m "feat: protect seller checkout acceptance"
```

---

### Task 3: Collect the seller link and acceptance in create/edit workflows

**Files:**
- Create: `src/app/merch/seller-checkout-fields.tsx`
- Modify: `src/app/actions.ts`
- Modify: `src/app/floating-composer.tsx`
- Modify: `src/app/merch/[id]/page.tsx`
- Modify: `scripts/test-seller-checkout-links.mjs`

- [ ] **Step 1: Add failing source-contract tests for the Server Actions and forms.**

Slice `createMerchProduct` and `editMerchProduct` from `src/app/actions.ts` and assert:

- both read only `external_checkout_url` and `seller_checkout_terms_accepted` from `FormData`;
- neither reads `seller_checkout_terms_version` nor `seller_checkout_terms_accepted_at` from `FormData`;
- both call `validateSellerCheckoutUrl` with live-link behavior and require exact checkbox value `"on"`;
- create still calls `requireProfile`, verifies a professional seller, inserts `seller_id: userId`, and limits the trusted follow-up write by both product ID and seller ID;
- edit re-reads the product, rejects `product.seller_id !== userId`, rejects official TTC products, and filters the trusted update by product ID and seller ID;
- both write the fixed `SELLER_CHECKOUT_TERMS_VERSION` and `seller_checkout_terms_accepted_at: null`, allowing the database trigger to generate the timestamp;
- create and edit forms use `maxLength={500}`, `type="url"`, a required link, and a required acceptance checkbox.

- [ ] **Step 2: Run the focused test and confirm the expected failure.**

```powershell
npm.cmd run test:seller-checkout-links
```

Expected: non-zero exit naming missing seller checkout form/action contracts.

- [ ] **Step 3: Create a shared seller checkout fieldset.**

Use this public interface:

```ts
export function SellerCheckoutFields({
  defaultUrl = "",
}: {
  defaultUrl?: string | null;
})
```

Render a required `external_checkout_url` URL input and a required `seller_checkout_terms_accepted` checkbox. The acceptance text must confirm that the link matches the listed physical product and price and that the seller handles payment, taxes, shipping, fulfillment, returns, refunds, disputes, support, and legal compliance. Do not pre-check acceptance on edit; every submitted commerce edit must be reconfirmed.

- [ ] **Step 4: Validate before media or database work in both actions.**

Use sanitized field messages only:

```ts
const checkoutResult = validateSellerCheckoutUrl(
  formData.get("external_checkout_url"),
);
const sellerAcceptedCheckoutTerms =
  formData.get("seller_checkout_terms_accepted") === "on";
```

Map `required`, `too_long`, `invalid`, and `test_link` to fixed messages. Never include the submitted URL or parser exception in a member-visible response or log.

Require fulfillment and return text of at least 10 trimmed characters for every product; require city and region only when shipping is enabled.

- [ ] **Step 5: Make acceptance trusted and fail closed.**

For create, insert the pending-review product through the existing authenticated client without protected fields. Then use `createAdminClient()` for a narrowly filtered update:

```ts
.update({
  external_checkout_url: checkoutResult.url,
  seller_checkout_terms_accepted_at: null,
  seller_checkout_terms_version: SELLER_CHECKOUT_TERMS_VERSION,
})
.eq("id", product.id)
.eq("seller_id", userId)
.select("id")
.maybeSingle<{ id: string }>()
```

If the trusted client or update is unavailable, delete the just-created pending row through the seller client and stop before media upload.

For edit, include the same three trusted values in the existing single admin update after the ownership and professional-verification checks. Keep the existing transition from active/approved back to `pending_review` and `is_indexable: false`.

- [ ] **Step 6: Add the shared fields to both forms.**

Place the fieldset after fulfillment/return inputs in `floating-composer.tsx` and in the owner edit form on `merch/[id]/page.tsx`. Load the owner's stored URL with a server-only, exact-ID `createAdminClient()` query because ordinary users cannot read the protected columns directly. If the service client or query fails, show no URL and block save with the normal required field rather than exposing an infrastructure error.

- [ ] **Step 7: Run focused and existing Merch/payment guards.**

```powershell
npm.cmd run test:seller-checkout
npm.cmd run smoke:payments
```

Expected: seller checkout tests pass. Existing payment smoke may still fail only on old internal-checkout assertions scheduled for Task 5; record the exact labels and do not weaken unrelated booking, ad, webhook, or refund checks.

- [ ] **Step 8: Commit seller submission.**

```powershell
git add src/app/merch/seller-checkout-fields.tsx src/app/actions.ts src/app/floating-composer.tsx 'src/app/merch/[id]/page.tsx' scripts/test-seller-checkout-links.mjs
git commit -m "feat: collect seller-owned checkout links"
```

---

### Task 4: Add the buyer disclosure and native system-browser handoff

**Files:**
- Create: `src/app/merch/seller-checkout-dialog.tsx`
- Modify: `src/app/merch/[id]/page.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/test-seller-checkout-links.mjs`
- Modify: `scripts/smoke-native-wrapper.mjs`
- Modify: `scripts/smoke-payment-guards.mjs`

- [ ] **Step 1: Add failing buyer/native contracts.**

Assert that:

- the product-detail page uses `sellerCheckoutPurchaseReadiness` and never sends a buyer to `/api/merch/checkout`;
- product cards in `src/app/page.tsx`, `src/app/merch/page.tsx`, `src/app/search/page.tsx`, `src/app/saved/page.tsx`, and `src/app/u/[username]/page.tsx` neither select nor render `external_checkout_url`;
- the purchase control does not require a TTC login;
- disclosure copy names the seller and assigns payment, tax, shipping, returns, refunds, disputes, and purchase support to that seller;
- the web anchor has `target="_blank"` and `rel="ugc nofollow noopener noreferrer"`;
- native code checks `Capacitor.isNativePlatform()` and calls `Browser.open({ url })` after preventing the WebView navigation;
- no buyer identifier, order ID, callback URL, or query parameter is appended.

- [ ] **Step 2: Run the tests and confirm they fail for the missing dialog.**

```powershell
npm.cmd run test:seller-checkout-links
```

- [ ] **Step 3: Install the root Capacitor Browser package at the native-resolved version.**

```powershell
npm.cmd install --save-exact @capacitor/browser@7.0.5
```

Expected: root `package.json` and `package-lock.json` add exact `7.0.5`. Do not change `native/thetattoocore-mobile/package.json`, its lockfile, Podfile, or Gradle files; they already resolve/wire Browser 7.0.5.

- [ ] **Step 4: Implement the accessible confirmation dialog.**

Use this interface:

```ts
export function SellerCheckoutDialog({
  checkoutUrl,
  sellerName,
}: {
  checkoutUrl: string;
  sellerName: string;
})
```

Follow the focus, Escape, focus-trap, and focus-return pattern in `src/app/floating-composer-shell.tsx`. Use Lucide `ExternalLink` and `X`; keep cards at 8px radius or less. Statically import `Capacitor` from `@capacitor/core` in this Client Component so the click can decide synchronously. The confirmed action is still an anchor with the protected `href`, target, and rel. Its click handler must allow normal web navigation, but synchronously prevent default on native and dynamically import `@capacitor/browser` before `Browser.open({ url: checkoutUrl })`. On failure, remain on the page and display only `Could not open seller checkout. Try again.`

- [ ] **Step 5: Replace the product-detail purchase card.**

Remove the fee calculation/imports, quantity form, TTC checkout button, sign-in-to-buy link, order-confirmation claim, and TTC shipping-address claim.

Fetch protected checkout fields through `createAdminClient()` only when the viewer is the owner or `sellerCheckoutLinksEnabled(process.env)` is true. Feed the database values plus product state into `sellerCheckoutPurchaseReadiness`. Render `Buy from seller` only when readiness succeeds, inventory is available, the seller is verified, the listing is active/moderated, and the viewer is not the owner. Anonymous buyers may use it.

Keep sold-out and owner states. Rename any nonzero `inventory_reserved` owner note to `reserved in legacy TTC checkout records`.

- [ ] **Step 6: Extend native smoke without re-syncing native projects.**

Add assertions to `scripts/smoke-native-wrapper.mjs` for:

- exact root `"@capacitor/browser": "7.0.5"`;
- existing native dependency and lock resolution;
- existing iOS `CapacitorBrowser` pod;
- existing Android Browser settings/build entries;
- the dialog's native platform guard and `Browser.open` call.

- [ ] **Step 7: Replace only the now-obsolete product-detail assertions in payment smoke.**

Update `scripts/smoke-payment-guards.mjs` to require the new disclosure, protected external anchor, no sign-in requirement, no fee calculation/copy, and no internal checkout form on the product page. Leave all route-side-effect assertions in place until Task 5 replaces the route.

- [ ] **Step 8: Run focused, native, and payment checks.**

```powershell
npm.cmd run test:seller-checkout-links
npm.cmd run smoke:native
npm.cmd run smoke:payments
```

Expected: all pass without running `cap sync`, Gradle, Xcode, or a native upload.

- [ ] **Step 9: Commit buyer and native handoff behavior.**

```powershell
git add src/app/merch/seller-checkout-dialog.tsx 'src/app/merch/[id]/page.tsx' package.json package-lock.json scripts/test-seller-checkout-links.mjs scripts/smoke-native-wrapper.mjs scripts/smoke-payment-guards.mjs
git commit -m "feat: open seller checkout outside TTC"
```

---

### Task 5: Retire new TTC Merch checkout side effects and false success states

**Files:**
- Modify: `src/app/api/merch/checkout/route.ts`
- Modify: `src/app/merch/checkout/success/page.tsx`
- Modify: `scripts/test-merch-checkout-route.mjs`
- Modify: `scripts/smoke-payment-guards.mjs`
- Modify: `scripts/smoke-public-routes.mjs`

- [ ] **Step 1: Rewrite the route test first.**

Replace the current Stripe/Supabase doubles with a direct import and these assertions:

```js
const response = await POST(
  new Request("https://thetattoocore.com/api/merch/checkout", {
    body: new FormData(),
    method: "POST",
  }),
);

assert.equal(response.status, 410);
assert.equal(response.headers.get("location"), null);
assert.deepEqual(await response.json(), {
  error: "Merch checkout is unavailable.",
});
```

Source assertions must reject imports/references to Stripe, Supabase, fees, inventory reservations, `merch_orders`, Checkout Sessions, PaymentIntents, application fees, transfers, or redirects.

- [ ] **Step 2: Run the route test and confirm it fails against the old implementation.**

```powershell
npm.cmd run test:merch-checkout-route
```

- [ ] **Step 3: Replace the route with a side-effect-free tombstone.**

```ts
export async function POST() {
  return Response.json(
    { error: "Merch checkout is unavailable." },
    { status: 410 },
  );
}
```

Do not authenticate first and do not import any payment, database, cache, URL, or navigation helper.

- [ ] **Step 4: Remove the no-order false-positive success copy.**

Keep real historical receipts when a signed-in buyer owns a matching stored order. When no matching order exists, show `No TTC order was found` and explain that seller-owned checkout is confirmed and supported by the seller's receipt. Do not show `Checkout received`, `Payment is processing`, or a TTC order-success claim without a row.

- [ ] **Step 5: Update public and payment guards without weakening unrelated flows.**

In `smoke-public-routes.mjs`, change the logged-out Merch POST probe to status `410`, JSON body `{"error":"Merch checkout is unavailable."}`, and no redirect.

In `smoke-payment-guards.mjs`:

- remove old Merch route assertions for auth, Stripe preflight, tax, shipping countries, order creation, reservation, destination charges, application fees, payout lookup, return paths, and rollback;
- keep all booking, ads, webhook, historical order/refund/dispute, Connect fail-closed, and secret-redaction assertions;
- change the independent creation-gate test to cover booking and ads only;
- assert the Merch route is the exact side-effect-free 410 boundary;
- assert the detail page has no TTC fee or internal checkout form;
- assert historical receipt/admin views remain;
- assert all old TTC Merch and Connect release switches remain false by default.

- [ ] **Step 6: Run payment and route suites.**

```powershell
npm.cmd run test:merch-checkout-route
npm.cmd run smoke:payments
```

Expected: all pass; no existing booking, ad, webhook, refund, dispute, or historical reconciliation assertion is removed merely to obtain green output.

- [ ] **Step 7: Commit the fail-closed boundary.**

```powershell
git add src/app/api/merch/checkout/route.ts src/app/merch/checkout/success/page.tsx scripts/test-merch-checkout-route.mjs scripts/smoke-payment-guards.mjs scripts/smoke-public-routes.mjs
git commit -m "fix: retire TTC merch checkout creation"
```

---

### Task 6: Change Merch moderation from Connect readiness to seller-link readiness

**Files:**
- Modify: `src/app/admin/actions.ts`
- Modify: `src/app/admin/merch/page.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `scripts/test-seller-checkout-links.mjs`
- Modify: `scripts/smoke-payment-guards.mjs`

- [ ] **Step 1: Add failing admin source contracts.**

Assert that activation:

- uses `sellerCheckoutSubmissionReadiness`;
- reads protected fields only through `createAdminClient()` after `requireModerator()`;
- rejects active official TTC products in this release;
- requires verified seller, live canonical link, current terms, inventory, fulfillment, returns, and shipping location where needed;
- does not call `stripeCheckoutPreflight`, query `stripe_connect_accounts`, or require charges/payouts/details-submitted in the Merch product action;
- never places the raw URL or database/provider error in a redirect message.

Assert that the admin Merch page has no `seller_payout` filter or Connect-account query and retains the historical order/refund section.

- [ ] **Step 2: Run focused tests and verify the old payout contracts fail.**

```powershell
npm.cmd run test:seller-checkout-links
```

- [ ] **Step 3: Make the moderation action fail closed on seller-link readiness.**

Keep `requireModerator()` first. Use a server-only admin client for the exact product read because normal authenticated roles cannot read protected columns. On `status === "active"`, reject official TTC products and pass the row into `sellerCheckoutSubmissionReadiness`. Map each reason to a fixed review message. Keep the existing verified-account check and concurrency-safe `admin_update_merch_product_status` RPC.

- [ ] **Step 4: Replace admin payout UI/querying with external checkout review.**

Remove `SellerPayoutFilter`, `sellerPayoutFilters`, `sellerPayoutFilter`, the URL parameter, `stripeCheckoutPreflight`, both `stripe_connect_accounts` queries, payout badges, payout notes, and payout-based activation logic.

After the normal RLS-backed paged product query, use one exact-ID-list service-role query for:

```text
id, external_checkout_url, seller_checkout_terms_version, seller_checkout_terms_accepted_at
```

Merge those fields into `MerchProduct`, derive `sellerCheckoutSubmissionReadiness`, show `Seller checkout ready` or a safe missing-requirement label, and expose a moderator-only normalized `Review Stripe Payment Link` anchor with `target="_blank"` and `rel="ugc nofollow noopener noreferrer"`. Disable Activate for official products or any not-ready seller product. Preserve all historical order, search, fulfillment, refund, and dispute controls below.

- [ ] **Step 5: Update the admin overview wording.**

Describe Merch as seller-owned external physical-goods checkout. Label existing payment/order tools as historical TTC checkout reconciliation. Do not claim TTC handles new seller payments, refunds, or payouts.

- [ ] **Step 6: Update payment guards and run admin/payment coverage.**

Replace old assertions for payout-dependent Merch activation with seller-link readiness assertions. Keep Admin Payments Connect and historical event coverage labeled as legacy/fail-closed.

```powershell
npm.cmd run test:seller-checkout
npm.cmd run smoke:admin
npm.cmd run smoke:payments
```

- [ ] **Step 7: Commit moderation changes.**

```powershell
git add src/app/admin/actions.ts src/app/admin/merch/page.tsx src/app/admin/page.tsx scripts/test-seller-checkout-links.mjs scripts/smoke-payment-guards.mjs
git commit -m "feat: review seller checkout readiness"
```

---

### Task 7: Align member surfaces, privacy/support, environment inventory, and release docs

**Files:**
- Modify: `.env.example`
- Modify: `wrangler.jsonc`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/app/account/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/support/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/admin/payments/page.tsx`
- Modify: `src/lib/help-center.ts`
- Modify: `docs/PAYMENT_PRODUCTION_READINESS.md`
- Modify: `docs/APP_STORE_READINESS.md`
- Modify: `docs/STORE_LISTING_DRAFT.md`
- Modify: `docs/DATA_SAFETY_PREP.md`
- Modify: `docs/LEGAL_REVIEW_PREP.md`
- Modify: `docs/MOBILE_APP_SUBMISSION_RUNBOOK.md`
- Modify: `docs/REAL_DEVICE_QA_CHECKLIST.md`
- Modify: `docs/release/v1.1.0-environment-inventory.md`
- Modify: `scripts/smoke-env-guards.mjs`
- Modify: `scripts/smoke-docs-readiness.mjs`
- Modify: `scripts/smoke-payment-guards.mjs`

- [ ] **Step 1: Add failing copy/config contracts before changing prose.**

Extend the focused test/smoke checks to require:

- `.env.example` and `wrangler.jsonc` set `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`;
- environment inventory calls it an optional server release gate with false default;
- `package.json` runs `test:seller-checkout` from both `smoke:payments` and `smoke:security`;
- member-facing help/support/privacy/account copy says the seller processes payment and handles shipping, taxes, returns, refunds, disputes, and purchase support;
- member-facing surfaces do not advertise TTC seller payouts, TTC Merch transaction fees, or TTC refunds for new external purchases;
- docs preserve old order records as historical and keep every TTC Stripe Merch/Connect switch false;
- native QA names web, Android phone, and TestFlight iPad external-browser return checks with no false success state.

- [ ] **Step 2: Run the affected guards and record expected labels.**

```powershell
npm.cmd run smoke:env
npm.cmd run smoke:docs
npm.cmd run smoke:payments
```

Expected: non-zero only for the newly added seller-owned checkout requirements.

- [ ] **Step 3: Add the fail-closed source configuration.**

Add exactly:

```text
TTC_SELLER_CHECKOUT_LINKS_ENABLED=false
```

to `.env.example` and the `vars` object in `wrangler.jsonc`. Add the key to the ordered expected-key list and exact-false checks in `smoke-env-guards.mjs`. Document it in the environment inventory and README. Do not add a true value, secret, seller URL, or account identifier anywhere.

- [ ] **Step 4: Remove seller-facing Connect/payout setup while preserving historical orders.**

In Account:

- remove the Connect gate import, Stripe preflight, `stripe_connect_accounts` query, payout URL parameters/notices, payout setup forms, and readiness card;
- relabel the seller area `Merch and orders`;
- explain that sellers add their own Stripe Payment Link when creating/editing a product;
- label existing TTC order rows as historical test/order support records and retain their read/refund-review behavior.

In Settings, use `Merch, seller checkout, historical orders, fulfillment, and support` rather than `Orders and payouts`.

In Admin Payments, keep existing Connect, webhook, and order evidence visible, but label Merch seller routing and related order rows as legacy TTC checkout controls that remain disabled for the seller-link release.

- [ ] **Step 5: Rewrite help, support, and privacy claims.**

Keep the existing Help slugs to avoid broken links, but retitle `seller-payouts-payment-safety` to `Seller checkout and payment safety`. Update Merch articles so sellers create their own live Stripe Payment Link, buyers contact the seller for receipts/shipping/refunds, and TTC handles listing-safety reports only. Remove or stop referencing tutorial assets that depict the retired payout setup as a current workflow; update docs smoke expectations with the same change.

Privacy must state that TTC stores the seller's listing link and acceptance record but does not receive new external purchase card, shipping, receipt, or transaction data. Preserve accurate retention language for historical TTC test orders and payment audits.

- [ ] **Step 6: Rewrite current readiness, store, and QA documentation without rewriting history.**

Add a dated current-position section that supersedes the former TTC-owned Merch pilot:

- seller-owned Payment Links are the selected physical-goods model;
- TTC Checkout/Connect/destination-charge code remains fail closed and historical;
- the new public gate starts false;
- no migration, production change, live seller URL, deploy, or native upload has occurred;
- enabling the one new gate still requires owner approval, migration/deploy authorization, one seller-supplied live link, web/Android/iPad QA, and rollback proof;
- App Store Connect's build currently in review is not changed by this implementation plan.

Update `DATA_SAFETY_PREP`, `LEGAL_REVIEW_PREP`, the submission runbook, store draft, and real-device checklist only where current claims conflict. Keep prior dated deployment evidence intact.

- [ ] **Step 7: Wire the regression suites.**

Update scripts to include:

```json
"smoke:payments": "npm run test:stripe-release-gates && npm run test:payment-webhook-config && npm run test:stripe-checkout-sessions && npm run test:merch-checkout-route && npm run test:seller-checkout && node scripts/smoke-payment-guards.mjs",
"smoke:security": "npm run test:seller-checkout && npm run test:csp-headers && node --no-warnings --experimental-loader ./scripts/server-only-test-loader.mjs --experimental-default-type=module scripts/test-mail-redaction.mjs && node scripts/smoke-security-guards.mjs"
```

The duplicated focused suite is intentional: payments and user-input security must each fail if this boundary regresses.

- [ ] **Step 8: Run all copy/config/security checks.**

```powershell
npm.cmd run smoke:env
npm.cmd run smoke:docs
npm.cmd run smoke:payments
npm.cmd run smoke:security
```

Expected: all pass with old Stripe Merch and Connect switches still false and no provider/customer secrets in output.

- [ ] **Step 9: Commit current operational truth.**

```powershell
git add .env.example wrangler.jsonc package.json README.md src/app/account/page.tsx src/app/settings/page.tsx src/app/support/page.tsx src/app/privacy/page.tsx src/app/admin/payments/page.tsx src/lib/help-center.ts docs/PAYMENT_PRODUCTION_READINESS.md docs/APP_STORE_READINESS.md docs/STORE_LISTING_DRAFT.md docs/DATA_SAFETY_PREP.md docs/LEGAL_REVIEW_PREP.md docs/MOBILE_APP_SUBMISSION_RUNBOOK.md docs/REAL_DEVICE_QA_CHECKLIST.md docs/release/v1.1.0-environment-inventory.md scripts/smoke-env-guards.mjs scripts/smoke-docs-readiness.mjs scripts/smoke-payment-guards.mjs
git commit -m "docs: align merch with seller-owned checkout"
```

---

### Task 8: Run the release-candidate verification and leave a no-deploy handoff

**Files:**
- Modify: `CODEX_HANDOFF.md`
- Review: every file changed in Tasks 1-7

- [ ] **Step 1: Run formatting and focused contracts first.**

```powershell
git diff --check
npm.cmd run test:seller-checkout
npm.cmd run test:merch-checkout-route
npm.cmd run smoke:payments
npm.cmd run smoke:security
npm.cmd run smoke:env
npm.cmd run smoke:docs
npm.cmd run smoke:admin
npm.cmd run smoke:native
```

- [ ] **Step 2: Run lint and production build.**

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: zero errors. Record existing warnings separately; do not call warnings fixed unless changed and rechecked.

- [ ] **Step 3: Run local public/mobile route smoke against the changed code, not the undeployed production site.**

Start the already-built app on an unused port in a hidden process, wait for HTTP readiness, set `SMOKE_BASE_URL` only for that shell, run the probes, and always stop the process:

```powershell
$server = Start-Process -FilePath npm.cmd -ArgumentList @("run", "start", "--", "-p", "3018") -PassThru -WindowStyle Hidden
try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3018/login | Out-Null
      $ready = $true
      break
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  if (-not $ready) { throw "Local Next.js server did not become ready on port 3018." }
  $env:SMOKE_BASE_URL = "http://127.0.0.1:3018"
  npm.cmd run smoke:public
  npm.cmd run smoke:mobile
  npm.cmd run smoke:mobile:narrow
  npm.cmd run smoke:mobile:ios
} finally {
  Remove-Item Env:SMOKE_BASE_URL -ErrorAction SilentlyContinue
  Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
}
```

Do not run the changed `smoke:public` against production before a separately authorized deployment; production is expected to retain the old route behavior until then.

- [ ] **Step 4: Perform a security and boundary audit.**

Run targeted searches and inspect every match:

```powershell
rg -n "external_checkout_url|seller_checkout_terms|TTC_SELLER_CHECKOUT_LINKS_ENABLED" src scripts supabase docs .env.example wrangler.jsonc README.md
rg -n "api/merch/checkout|application_fee_amount|transfer_data|stripe_connect_accounts" src/app/merch src/app/admin/merch src/app/admin/actions.ts
rg -n "formData\.get\(\"seller_checkout_terms_(version|accepted_at)\"" src
rg -n "external_checkout_url" src/app/page.tsx src/app/merch/page.tsx src/app/search/page.tsx src/app/saved/page.tsx 'src/app/u/[username]/page.tsx'
```

Expected: no caller-supplied version/timestamp, no external URL on product cards, no internal checkout command, no Connect dependency in Merch activation, and only intended historical/admin payment references.

- [ ] **Step 5: Update the recovery handoff with exact status.**

At the top of `CODEX_HANDOFF.md`, add a dated section with:

- branch and exact commit;
- tests actually run and their result;
- migration file created but **not applied**;
- feature gate committed as false and production unchanged;
- App Store Connect/Google Play unchanged;
- no seller live link or production data added;
- the exact later rollout approvals still required;
- device QA still required on one Android phone and the TestFlight iPad after an authorized non-production/production rollout surface exists.

- [ ] **Step 6: Commit the handoff.**

```powershell
git add CODEX_HANDOFF.md
git commit -m "docs: hand off seller checkout rollout"
```

- [ ] **Step 7: Verify the final tree and commits.**

```powershell
git status --short --branch
git log --oneline --decorate -10
git diff HEAD~8..HEAD --stat
```

Expected: only the pre-existing untracked `.superpowers/` remains; no private evidence, logs, screenshots, generated build output, or secrets are staged.

- [ ] **Step 8: Stop without production or store actions.**

Report `IMPLEMENTATION READY FOR CONTROLLED ROLLOUT`, not `LIVE`, only if every code/build/test check passed. The next phase needs explicit authorization for the migration, inactive Worker upload/config proof, production deployment, one seller-owned live Payment Link record, setting only `TTC_SELLER_CHECKOUT_LINKS_ENABLED=true`, live web smoke, Android phone QA, and TestFlight iPad QA. App Store Connect remains open but untouched.

## Controlled Rollout After Separate Authorization

1. Apply `20260802130000_seller_owned_merch_checkout.sql` and run read-only schema/grant/RLS proofs.
2. Upload an inactive Worker version with the new gate false and prove every old TTC Stripe Merch/Connect flag plus native delivery remains false.
3. Deploy the reviewed commit with the gate false and run public/internal no-side-effect smoke.
4. Have one verified seller submit their own live physical-product Stripe Payment Link, fulfillment terms, return policy, and ship-from details; TTC does not create this data for the seller.
5. Moderate the listing and verify the link is still hidden while the gate is false.
6. With explicit owner approval, set only `TTC_SELLER_CHECKOUT_LINKS_ENABLED=true` using the established inactive-upload/`--keep-vars` proof process.
7. Verify web opens a protected new tab; Android and TestFlight iPad open the system browser surface, return to TTC cleanly, and never display a false TTC payment success state.
8. Roll back by setting only the seller-link gate to false if any disclosure, link, device, or seller-support check fails.

No TTC Stripe live-key cutover, Connect onboarding, destination charge, marketplace fee, official TTC Merch sale, booking deposit, ad purchase, native upload, or store resubmission is part of that rollout.
