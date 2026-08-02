# Seller-Owned Merch Checkout Design

## Decision

TheTattooCore (TTC) will operate Merch as a product-listing service, not as the
merchant or payment-processing marketplace. Each seller will collect payment
through a Stripe Payment Link created and controlled in the seller's own Stripe
account.

TTC will not create the charge, receive or transfer the merchandise proceeds,
take a per-sale fee, calculate tax, create a buyer order, reserve inventory, or
manage fulfillment, refunds, disputes, or payouts for these purchases.

This design was approved on August 2, 2026. Advertising and any future fixed
seller listing plan remain separate monetization projects.

## Goals

- Let buyers purchase physical products found through approved TTC Merch
  listings.
- Make the seller responsible for the product, payment, taxes, shipping,
  handling, returns, refunds, disputes, and customer support.
- Require the seller to supply the checkout link and fulfillment terms instead
  of asking TTC for a ship-from address or return policy.
- Preserve a fail-closed boundary around TTC's existing Stripe Connect and
  destination-charge code.
- Keep the iOS and Android purchase flow limited to physical goods consumed
  outside the app.
- Give buyers a clear disclosure before they leave TTC for seller checkout.
- Treat every new seller-controlled field as hostile input and verify it with
  deterministic malicious-input tests.

## Non-Goals

- Stripe Connect onboarding, seller payouts, or TTC application fees.
- TTC-created Checkout Sessions, PaymentIntents, orders, receipts, inventory
  reservations, shipping records, tax records, refunds, or dispute handling.
- A TTC shopping cart or checkout containing products from one or more sellers.
- Arbitrary external stores, custom Stripe checkout domains, affiliate links,
  or non-Stripe payment providers in the first release.
- Advertising checkout, seller subscriptions, listing fees, booking deposits,
  digital goods, credits, boosts, or paid app features.
- Deleting historical test orders, Connect records, or webhook handlers that
  may still be needed to reconcile earlier test activity.
- Deploying a database migration, production configuration, web release, or
  native build without the existing explicit authorization gates.

## Why The Existing Checkout Is Not Used

The existing Merch checkout route creates a Stripe Checkout Session on TTC's
platform account. Marketplace products can use destination charges and a TTC
application fee, while TTC creates local orders, reserves inventory, and later
handles webhook-driven payment and fulfillment state. Seller onboarding uses
TTC-managed Stripe Connect Express accounts.

That flow makes TTC part of the sale and payment process. Texas describes a
marketplace provider as an entity that owns or operates a marketplace and
processes sales or payments for marketplace sellers. Marketplace providers
engaged in business in Texas have collection, reporting, certification, and
recordkeeping duties. The amount of TTC's transaction fee does not change that
definition.

The external-link model intentionally avoids TTC processing the sale or
payment. It is a technical and operational boundary, not a legal opinion or a
guarantee of tax classification. TTC's owner remains responsible for approving
the seller terms and obtaining professional advice when business operations
change.

References:

- [Texas marketplace providers and sellers](https://comptroller.texas.gov/taxes/sales/marketplace-providers-sellers.php)
- [Stripe Tax with Connect](https://docs.stripe.com/tax/connect)
- [Stripe Payment Links](https://docs.stripe.com/payment-links)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#goods-and-services)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)

## Seller Workflow

An eligible, signed-in seller creates or edits a Merch product using the
existing product workflow. The form continues to collect title, description,
price, media, physical-product category, inventory display, ship-from city and
region, shipping requirement, fulfillment notes, and return/refund policy.

Before a listing can be approved for external purchase, the seller must also:

- Create a payment link in the seller's own Stripe account.
- Supply the canonical `https://buy.stripe.com/...` URL without query
  parameters or a fragment.
- Confirm that the Stripe link is for the same physical product and displayed
  price as the TTC listing.
- Confirm that the Stripe checkout collects any address and shipping details
  the seller needs.
- Confirm that the seller is responsible for tax configuration, fulfillment,
  returns, refunds, disputes, customer support, and legal compliance.
- Accept the current version of TTC's seller-checkout terms.

TTC does not ask for or store the seller's Stripe account ID, API key, login,
banking information, tax registration, payment records, or customer data.

Creating or changing the checkout URL, price, fulfillment notes, ship-from
information, or return policy returns the product to the existing moderation
workflow. An unapproved, rejected, archived, or sold-out listing cannot display
the purchase action.

## Buyer Workflow

Product cards continue to open the TTC product-detail page. They do not link
directly to checkout. The detail page is the single purchase entry point so the
buyer sees the product, seller, price, shipping expectations, fulfillment
notes, and return/refund policy together.

For an approved and available listing, the detail page displays a **Buy from
seller** command. Selecting it opens a confirmation dialog that names the
seller and states that the buyer is leaving TTC, the seller will process the
payment, and the seller is responsible for shipping, taxes, returns, refunds,
and purchase support.

After confirmation:

- Web opens the validated Stripe URL in a new tab with the repository's
  user-generated-link protections.
- Native iOS and Android open the URL in the operating system's external
  browser, not an embedded TTC payment WebView.
- TTC does not append customer identifiers, TTC order identifiers, success
  URLs, tracking parameters, or prefilling parameters.
- TTC does not receive a checkout-completed callback or Stripe webhook for the
  seller's transaction.
- Returning to TTC does not display a payment-success claim or create an order.

If the seller has deactivated the link or sold out at Stripe, Stripe presents
that state. The buyer can report the TTC listing or contact the seller, but TTC
must not claim that it can issue the refund or resolve the payment.

## Data Model

Use an additive migration on `public.merch_products`:

- `external_checkout_url text null`
- `seller_checkout_terms_version text null`
- `seller_checkout_terms_accepted_at timestamptz null`

The URL stays nullable so existing records and drafts remain valid. Server-side
activation and moderation rules require all three fields for a product to show
the purchase action. The terms version is a fixed application constant such as
`seller-checkout-v1`; changing the material seller terms requires a new version
and fresh acceptance.

The seller submits only the URL and an explicit acceptance checkbox. Trusted
server logic writes the current terms version and database timestamp; it never
accepts a caller-supplied version or timestamp. A direct product update cannot
manufacture current acceptance for a different seller.

Database constraints enforce conservative size limits and field consistency.
Existing row-level security remains the ownership boundary: a seller can set
these fields only on the seller's own product. Moderators may approve, reject,
or disable a listing but do not replace a seller's checkout URL or accept terms
for the seller.

No foreign key to `stripe_connect_accounts` is added. No payment or customer
identifier is added to TTC tables.

## URL And Input Security

The broad `cleanExternalUrl` helper is not sufficient for checkout. A dedicated
server-only validator must parse the input with the platform URL API and accept
only a canonical Stripe Payment Link meeting all of these rules:

- Maximum raw length of 500 characters.
- Exact `https:` scheme.
- Exact ASCII hostname `buy.stripe.com` after URL parsing and normalization.
- No username, password, non-default port, fragment, or query string.
- Exactly one non-empty path segment matching `^[A-Za-z0-9_]+$`, with a maximum
  segment length of 255 characters.
- No control characters, whitespace smuggling, malformed percent encoding, or
  known Stripe test-link prefix when production activation is requested.

The server never fetches, previews, resolves, or follows the supplied URL.
Validation happens when the seller saves the product and again before rendering
the purchase action. The browser receives only the normalized stored value.

Required malicious-input fixtures include `javascript:`, `data:`, `file:`,
HTTP downgrade, embedded credentials, `buy.stripe.com.evil.example`, Unicode or
punycode lookalikes, encoded delimiters, CRLF, leading and trailing controls,
oversized input, fragments, query parameters, malformed escapes, an empty
Payment Link path, and a production attempt using a Stripe test link.

Authorization tests must prove that signed-out users, buyers, and one seller
acting on another seller's product cannot add or replace the checkout URL or
terms acceptance.

## Existing Payment-Code Boundary

The existing variables remain false:

```text
STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED=false
STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED=false
STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false
```

Add an independent, fail-closed release switch:

```text
TTC_SELLER_CHECKOUT_LINKS_ENABLED=false
```

The first implementation removes internal Merch checkout commands from public
UI and makes `/api/merch/checkout` reject new requests before any inventory,
order, or Stripe operation. Connect onboarding is removed from seller-facing
Merch readiness and remains unavailable for this flow. Historical order,
refund-review, and webhook data remain readable for reconciliation; no records
are deleted or rewritten.

The external-link switch controls only whether approved seller links are shown.
It must never enable TTC Stripe checkout, Connect onboarding, seller payout, or
any other payment flow.

## Moderation And Support

Admin Merch review shows whether the seller supplied the required link,
accepted the current terms, and completed fulfillment and return information.
Moderators can open the normalized link during review, approve the listing, or
disable it. TTC does not call Stripe APIs to inspect the seller's account or
verify sales.

Public support language must distinguish product-listing reports from purchase
support:

- TTC can review misleading, prohibited, unsafe, or impersonating listings.
- The seller handles payment receipts, shipping, cancellations, returns,
  refunds, and chargebacks.
- TTC must not display a TTC order number, payment status, or refund action for
  an external purchase.

Existing help, privacy, seller-readiness, and admin-payment copy that implies
TTC processes marketplace Merch orders must be updated for the new model while
preserving accurate historical-order language where required.

## Error Handling

- Invalid or incomplete seller input returns field-specific, sanitized errors
  and leaves the listing unavailable for purchase.
- A changed checkout link or seller term version requires renewed acceptance
  and moderation before the link is public.
- Failure to open the system browser leaves the buyer on the product page and
  shows a retryable generic message; it does not claim payment failure.
- A deactivated or unavailable Stripe link is treated as a seller listing
  problem and can be reported for moderation.
- Raw URL parser errors, database errors, and provider details remain out of
  member-visible messages.

## Verification

Focused automated coverage must prove:

- Exact acceptance and rejection behavior for every URL fixture.
- Seller-only product updates and current-version terms acceptance.
- Reapproval after material commerce-field changes.
- Purchase action visibility only for approved, available products with a valid
  canonical link and the release switch enabled.
- No purchase action on product cards, drafts, rejected listings, archived
  listings, sold-out listings, or invalid legacy data.
- `/api/merch/checkout` cannot create inventory reservations, orders, Checkout
  Sessions, PaymentIntents, destination transfers, or application fees.
- Existing Stripe Merch environment flags stay false.
- Historical test orders and admin reconciliation views still load.
- The disclosure names the seller and accurately assigns responsibility.
- Web links include `ugc nofollow noopener noreferrer` protections.
- iOS and Android open the system browser and can return to TTC without a false
  success state.

The implementation plan must select the repository's focused security, Merch,
payment-gate, lint, type/build, and mobile smoke commands after inspecting the
current scripts. Device verification must cover at least one Android phone and
the TestFlight iPad before any native store update is submitted.

## Rollout

1. Land the additive migration, validation, UI, copy, and tests with
   `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`.
2. Prove that old internal Merch checkout remains unreachable even when stale
   client UI or a direct API request attempts it.
3. Use a seller-controlled Stripe test Payment Link only in local or staging
   verification; never place it in production data.
4. Have one approved seller create a live physical-product Payment Link and
   provide ship-from, fulfillment, return/refund, and support information.
5. Moderate that listing and verify web, Android, and iOS behavior while the
   public switch remains false through a non-production surface.
6. Record owner approval of the seller terms, privacy/help copy, exact product,
   and live seller link without storing secrets or customer information.
7. Enable only `TTC_SELLER_CHECKOUT_LINKS_ENABLED=true` in production through
   the established inactive-upload and configuration-verification process.
8. Run targeted live web and native smoke checks, confirm all TTC Stripe Merch
   switches remain false, and preserve rollback by turning the seller-link
   switch off.

Every database migration, production deployment, production-data insertion,
environment change, shared-branch push, and native upload still requires its
normal explicit authorization.

## Acceptance Criteria

- A verified seller can submit an approved physical product with the seller's
  own clean Stripe Payment Link and required fulfillment terms.
- A buyer sees the seller's terms and a clear external-checkout disclosure
  before leaving TTC.
- TTC does not create, observe, reconcile, refund, or receive a fee from the
  seller's merchandise transaction.
- The seller receives payment and customer checkout information directly in
  the seller's Stripe account.
- TTC can moderate or disable the listing without controlling the seller's
  Stripe account.
- Internal Merch checkout and Connect payout paths remain fail closed.
- Automated security tests cover every new seller-controlled field and all
  authorization boundaries.
- Apple and Google builds continue to represent the purchase as a physical-good
  transaction completed outside TTC.

## Deferred Monetization

TTC can continue earning from advertising that complies with store policy.
Fixed seller listing or software-service plans may be designed separately, but
they must not be deducted from merchandise payments and must receive their own
Apple, Google, tax, and product review before native-app sale or activation.

A future per-transaction fee requires a separate marketplace-provider design,
tax registration and reporting decision, seller certification, Stripe Connect
architecture, refund/dispute allocation, and explicit owner approval. It is not
part of this release.
