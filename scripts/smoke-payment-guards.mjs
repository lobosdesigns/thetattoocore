import { readFileSync } from "node:fs";

const adCheckout = readFileSync("src/app/api/ads/checkout/route.ts", "utf8");
const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");
const merchCheckout = readFileSync("src/app/api/merch/checkout/route.ts", "utf8");
const stripeWebhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const merchDetailPage = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const merchIndexPage = readFileSync("src/app/merch/page.tsx", "utf8");
const merchNotesMigration = readFileSync(
  "supabase/migrations/20260715235500_merch_fulfillment_return_notes.sql",
  "utf8",
);
const merchCheckoutSuccessPage = readFileSync("src/app/merch/checkout/success/page.tsx", "utf8");
const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const appActions = readFileSync("src/app/actions.ts", "utf8");
const floatingComposer = readFileSync("src/app/floating-composer.tsx", "utf8");
const adminAdsPage = readFileSync("src/app/admin/ads/page.tsx", "utf8");
const merchPrintReceiptButton = readFileSync(
  "src/app/merch/checkout/success/print-receipt-button.tsx",
  "utf8",
);
const adminMerchPage = readFileSync("src/app/admin/merch/page.tsx", "utf8");
const adminPaymentsPage = readFileSync("src/app/admin/payments/page.tsx", "utf8");
const adminActions = readFileSync("src/app/admin/actions.ts", "utf8");
const stripeConnectReturn = readFileSync("src/app/api/stripe/connect/return/route.ts", "utf8");
const adCreditSpendMigration = readFileSync(
  "supabase/migrations/20260715041500_spend_ad_credit_for_campaign.sql",
  "utf8",
);
const globalsCss = readFileSync("src/app/globals.css", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const fees = readFileSync("src/lib/payments/fees.ts", "utf8");
const statusLabels = readFileSync("src/lib/status-labels.ts", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");
const paymentReadiness = readFileSync("docs/PAYMENT_PRODUCTION_READINESS.md", "utf8");
const paymentSafetySource = [
  adminMerchPage,
  adminPaymentsPage,
  privacyPage,
  supportPage,
].join("\n");

function indexOfOrFail(body, snippet) {
  const index = body.indexOf(snippet);

  if (index === -1) {
    throw new Error(`Missing snippet: ${snippet}`);
  }

  return index;
}

const checks = [];

try {
  const reserveIndex = indexOfOrFail(adCheckout, "const { data: reservedCampaign");
  const sessionIndex = indexOfOrFail(adCheckout, "session = await createAdCheckoutSession");
  const attachIndex = indexOfOrFail(adCheckout, "stripe_checkout_session_id: session.id");

  checks.push({
    label: "ad checkout reserves campaign before Stripe session",
    ok: reserveIndex < sessionIndex,
  });
  checks.push({
    label: "ad checkout attaches Stripe session after creation",
    ok: sessionIndex < attachIndex,
  });
  checks.push({
    label: "ad checkout rolls back reservation on session creation failure",
    ok:
      adCheckout.includes("const rollBackReservation = async () =>") &&
      adCheckout.includes("await rollBackReservation();"),
  });
  checks.push({
    label: "ad checkout only attaches session to reserved campaign",
    ok:
      adCheckout.includes('.eq("payment_status", "checkout_started")') &&
      adCheckout.includes('.is("stripe_checkout_session_id", null)'),
  });
} catch (error) {
  checks.push({
    label: "ad checkout flow structure",
    ok: false,
    message: error.message,
  });
}

checks.push({
  label: "ad checkout can consume account-level ad credits before Stripe",
  ok:
    adCreditSpendMigration.includes(
      "create or replace function public.spend_ad_credit_for_campaign",
    ) &&
    adCreditSpendMigration.includes("for update") &&
    adCreditSpendMigration.includes("v_available_cents < v_needed_cents") &&
    adCreditSpendMigration.includes("payment_status = 'waived'") &&
    adCreditSpendMigration.includes("used_cents = used_cents + v_use_cents") &&
    adCheckout.includes('"spend_ad_credit_for_campaign"') &&
    adCheckout.includes("Ad credit applied. Campaign payment is covered.") &&
    adCheckout.indexOf('"spend_ad_credit_for_campaign"') <
      adCheckout.indexOf("const { data: reservedCampaign") &&
    accountPage.includes(".from(\"ad_credit_ledger\")") &&
    accountPage.includes("Available ad credit") &&
    accountPage.includes("Use ${dollars(campaign.daily_budget_cents)} ad credit") &&
    productPlan.includes("member-visible Account > Advertising balance summaries") &&
    productPlan.includes("atomic spend path that lets campaign checkout consume enough active account credit"),
});
checks.push({
  label: "verified sellers can submit Merch products for review",
  ok:
    floatingComposer.includes("action={createMerchProduct}") &&
    floatingComposer.includes("canCreateStuff ?") &&
    floatingComposer.includes("Submit Merch") &&
    floatingComposer.includes("New Merch goes to admin review first") &&
    floatingComposer.includes('href={isSignedIn ? "/account#verification-settings" : "/login"}') &&
    appActions.includes("export async function createMerchProduct") &&
    appActions.includes("Verified artist, studio, or vendor status is required to submit Merch.") &&
    appActions.includes('status: "pending_review"') &&
    appActions.includes('is_indexable: false') &&
    appActions.includes('from("merch_products")') &&
    appActions.includes('from("merch_product_media")') &&
    appActions.includes("Merch needs a product photo, GIF, or short video.") &&
    appActions.includes("await supabase.from(\"merch_products\").delete()"),
});
checks.push({
  label: "seller account keeps submitted Merch products visible",
  ok:
    accountPage.includes('const { data: merchProducts }') &&
    accountPage.includes('.from("merch_products")') &&
    accountPage.includes("visibleMerchProducts") &&
    accountPage.includes("hasMoreMerchProducts") &&
    accountPage.includes("Your Merch products") &&
    accountPage.includes("Submitted products stay here while admin reviews them") &&
    accountPage.includes('href={`/merch/${product.id}`}') &&
    accountPage.includes('href="/merch"') &&
    accountPage.includes("Load {orderPageSize} more products"),
});
checks.push({
  label: "public Merch browse keeps category and sort controls",
  ok:
    homePage.includes("const merchCategoryFilters = [") &&
    homePage.includes("const merchSortOptions = [") &&
    homePage.includes("merchCategory?: string") &&
    homePage.includes("merchSort?: string") &&
    homePage.includes("const merchFilterHref = ({") &&
    homePage.includes('nextParams.set("merchCategory", category)') &&
    homePage.includes('nextParams.set("merchSort", sort)') &&
    homePage.includes("Browse Merch") &&
    homePage.includes('aria-label="Merch categories"') &&
    homePage.includes('aria-label="Merch sorting"') &&
    homePage.includes("browsableMerchProducts.slice(0, merchLimit)"),
});
checks.push({
  label: "public Merch storefront supports save share and report actions",
  ok:
    merchIndexPage.includes("SavedItemButton") &&
    merchIndexPage.includes("CompactShareButton") &&
    merchIndexPage.includes("ContentReportForm") &&
    merchIndexPage.includes('href="/account#order-settings"') &&
    !merchIndexPage.includes("#seller-settings") &&
    merchIndexPage.includes('subjectType="merch_product"') &&
    merchIndexPage.includes("const currentMerchPath = productHref({") &&
    merchIndexPage.includes("returnPath={currentMerchPath}") &&
    merchIndexPage.includes('url={`${siteUrl}/merch/${product.id}`}'),
});
checks.push({
  label: "public Merch storefront includes reviewed Merch ad slot",
  ok:
    merchIndexPage.includes("async function fetchMerchSponsoredCampaign") &&
    merchIndexPage.includes('.eq("campaign_type", "merch_listing")') &&
    merchIndexPage.includes('.eq("ad_campaign_placements.placement", "merch")') &&
    merchIndexPage.includes("function MerchSponsoredCard") &&
    merchIndexPage.includes('<AdImpressionBeacon campaignId={campaign.id} placement="merch" />') &&
    merchIndexPage.includes("Reviewed sponsored placement") &&
    merchIndexPage.includes("No AI ad expansion") &&
    merchIndexPage.includes("<MerchSponsoredCard campaign={merchAd} />"),
});
checks.push({
  label: "Merch detail allows owner-only non-public product review",
  ok:
    merchDetailPage.includes("async function getProductForViewer") &&
    merchDetailPage.includes("const isOwner = Boolean(viewerId && viewerId === data.profiles?.id)") &&
    merchDetailPage.includes("if (!isPublic && !isOwner)") &&
    merchDetailPage.includes("Seller-only product view") &&
    merchDetailPage.includes("Checkout and public discovery open only after admin approval") &&
    merchDetailPage.includes('href="/merch"'),
});
checks.push({
  label: "checkout routes require private payment gates before payments",
  ok:
    adCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    adCheckout.includes("Ad checkout is temporarily unavailable. Please try again later.") &&
    bookingCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    bookingCheckout.includes("Booking checkout is temporarily unavailable. Please try again later.") &&
    merchCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    merchCheckout.includes("Checkout is temporarily unavailable. Please try again later."),
});
checks.push({
  label: "checkout creation failures log privately and show generic member copy",
  ok:
    adCheckout.includes('console.error("Ad checkout session creation failed.", error)') &&
    adCheckout.includes('"Checkout could not open for this ad. Please try again."') &&
    !adCheckout.includes('error instanceof Error ? error.message : "Checkout could not open for this ad."') &&
    bookingCheckout.includes('console.error("Booking checkout session creation failed.", error)') &&
    bookingCheckout.includes('"Booking checkout could not open. Please try again."') &&
    !bookingCheckout.includes('error instanceof Error ? error.message : "Booking checkout could not open."') &&
    merchCheckout.includes('console.error("Merch checkout session creation failed.", error)') &&
    merchCheckout.includes('"Checkout could not open. Please try again."') &&
    !merchCheckout.includes('error instanceof Error ? error.message : "Checkout could not open."'),
});
checks.push({
  label: "checkout persistence failures do not redirect raw database errors",
  ok:
    !adCheckout.includes(".message ||") &&
    adCheckout.includes('console.error("Ad credit check failed before checkout.", creditError)') &&
    adCheckout.includes('"Ad credit could not be checked for this campaign. Please try again."') &&
    adCheckout.includes('console.error("Ad checkout reservation failed.", reserveError)') &&
    adCheckout.includes('"The ad payment could not be reserved before checkout. Please try again."') &&
    adCheckout.includes('console.error("Ad checkout session save failed.", updateError)') &&
    adCheckout.includes('"Checkout started, but the checkout could not be saved. Please contact support if this repeats."') &&
    !bookingCheckout.includes(".message ||") &&
    bookingCheckout.includes('console.error("Booking deposit reservation failed.", reserveError)') &&
    bookingCheckout.includes('"The booking deposit could not be reserved before checkout. Please try again."') &&
    bookingCheckout.includes('console.error("Booking checkout session save failed.", updateError)') &&
    bookingCheckout.includes('"Checkout started, but the checkout could not be saved. Please contact support if this repeats."') &&
    !merchCheckout.includes(".message ||") &&
    merchCheckout.includes('console.error("Merch order save failed before checkout.", orderError)') &&
    merchCheckout.includes('"The order could not be saved before checkout. Please try again."') &&
    merchCheckout.includes('console.error("Merch order item save failed before checkout.", itemError)') &&
    merchCheckout.includes('"The order item could not be saved before checkout. Please try again."') &&
    merchCheckout.includes('console.error("Merch inventory reservation failed before checkout.", reserveError)') &&
    merchCheckout.includes('"Inventory could not be reserved for checkout. Please try again."') &&
    merchCheckout.includes('console.error("Merch checkout session save failed.", sessionError)') &&
    merchCheckout.includes('"Checkout started, but the order session could not be saved. Please contact support if this repeats."'),
});
checks.push({
  label: "payment webhook rejects unsigned events before processing",
  ok:
    stripeWebhook.includes("const signature = request.headers.get(\"stripe-signature\")") &&
    stripeWebhook.includes("Missing payment verification.") &&
    stripeWebhook.includes("constructEventAsync") &&
    stripeWebhook.includes('event.type === "refund.failed"') &&
    stripeWebhook.includes("recordRefundProblem") &&
    stripeWebhook.includes('event_type: "booking_refund_problem"') &&
    stripeWebhook.includes("const disputeWebhookEvents") &&
    stripeWebhook.includes('"charge.dispute.created"') &&
    stripeWebhook.includes('"charge.dispute.closed"') &&
    stripeWebhook.includes('"charge.dispute.funds_withdrawn"') &&
    stripeWebhook.includes('"charge.dispute.funds_reinstated"') &&
    stripeWebhook.includes("recordPaymentDispute") &&
    stripeWebhook.includes("merch_payment_dispute") &&
    stripeWebhook.includes("ad_payment_dispute") &&
    stripeWebhook.includes("booking_payment_dispute") &&
    stripeWebhook.includes("function disputeChargeId") &&
    stripeWebhook.includes("stripe.charges.retrieve(chargeId)") &&
    stripeWebhook.includes("stripe_charge_id: disputeChargeId(dispute)") &&
    stripeWebhook.includes("recordPaymentDispute({ dispute, eventType: event.type, stripe })") &&
    stripeWebhook.includes("stripe_event_type: eventType") &&
    stripeWebhook.includes("payment_intent_id: paymentIntentId") &&
    stripeWebhook.includes('event.type === "account.updated"') &&
    stripeWebhook.includes("syncStripeConnectAccountFromWebhook") &&
    stripeWebhook.includes('from("stripe_connect_accounts")') &&
    stripeWebhook.includes("stripeConnectStatus(account)") &&
    stripeWebhook.indexOf("Missing payment verification.") <
      stripeWebhook.indexOf("constructEventAsync"),
});
checks.push({
  label: "admin refund requests keep processor names out of redirect copy",
  ok:
    adminActions.includes(
      "Booking deposit refund requested. The payment processor will update the final status shortly.",
    ) &&
    !adminActions.includes("Stripe will update the final status shortly."),
});
checks.push({
  label: "booking checkout preserves only safe internal return paths",
  ok:
    bookingCheckout.includes("function safeInternalReturnPath") &&
    bookingCheckout.includes("text.startsWith(\"/\")") &&
    bookingCheckout.includes("text.startsWith(\"//\")") &&
    bookingCheckout.includes("function pathWithMessage") &&
    bookingCheckout.includes('formData.get("return_to")') &&
    bookingCheckout.includes("createBookingCheckoutSession(booking, returnTo)") &&
    bookingCheckout.includes('"success_url": successUrl') &&
      bookingCheckout.includes('"cancel_url": cancelUrl'),
});
checks.push({
  label: "ad checkout preserves only safe internal return paths",
  ok:
    adCheckout.includes("function safeInternalReturnPath") &&
    adCheckout.includes("text.startsWith(\"/\")") &&
    adCheckout.includes("text.startsWith(\"//\")") &&
    adCheckout.includes("function pathWithMessage") &&
    adCheckout.includes('formData.get("return_to")') &&
    adCheckout.includes("returnTo: string | null") &&
    adCheckout.includes('"success_url": successUrl') &&
      adCheckout.includes('"cancel_url": cancelUrl'),
});
checks.push({
  label: "merch checkout preserves only safe internal return paths",
  ok:
    merchCheckout.includes("function safeInternalReturnPath") &&
    merchCheckout.includes("text.startsWith(\"/\")") &&
    merchCheckout.includes("text.startsWith(\"//\")") &&
    merchCheckout.includes("function pathWithMessage") &&
    merchCheckout.includes("function loginRedirect") &&
    merchCheckout.includes('formData.get("return_to")') &&
    merchCheckout.includes('return_to: returnTo') &&
    merchCheckout.includes('formReturnTo ?? `/merch/${productId}`') &&
    merchCheckout.includes('formReturnTo ?? "/merch"') &&
    merchCheckout.includes("formReturnTo ?? `/merch/${product.id}`") &&
    merchCheckout.includes('"cancel_url": cancelUrl') &&
    merchDetailPage.includes('name="return_to"') &&
    merchDetailPage.includes('value={`/merch/${product.id}`}') &&
    merchDetailPage.includes('href={`/login?return_to=${encodeURIComponent(`/merch/${product.id}`)}`}'),
});
checks.push({
  label: "merch checkout creates local order before Stripe session",
  ok:
    merchCheckout.indexOf('from("merch_orders").insert') <
    merchCheckout.indexOf("await createCheckoutSession"),
});
checks.push({
  label: "merch checkout identifies its payment kind for shared webhook routing",
  ok:
    merchCheckout.includes('metadata[payment_kind]": "merch_order"') &&
    merchCheckout.includes('payment_intent_data[metadata][payment_kind]": "merch_order"') &&
    stripeWebhook.includes("function isMerchCheckoutSession") &&
    stripeWebhook.includes('payment_kind === "merch_order"') &&
    stripeWebhook.includes("Unknown checkout session payment type."),
});
checks.push({
  label: "merch checkout only attaches Stripe session to pending unassigned order",
  ok:
    merchCheckout.includes('stripe_checkout_session_id: session.id') &&
    merchCheckout.includes('.eq("status", "pending_checkout")') &&
    merchCheckout.includes('.is("stripe_checkout_session_id", null)') &&
    merchCheckout.includes('.select("id")') &&
    merchCheckout.includes("if (!sessionOrder)"),
});
checks.push({
  label: "buyer checkout success keeps printable receipt action",
  ok:
    merchCheckoutSuccessPage.includes("<PrintReceiptButton />") &&
    merchCheckoutSuccessPage.includes('href="/merch"') &&
    merchCheckoutSuccessPage.includes("ttc-print-receipt") &&
    merchCheckoutSuccessPage.includes("ttc-print-hidden") &&
    merchPrintReceiptButton.includes('"use client"') &&
    merchPrintReceiptButton.includes("window.print()") &&
    merchPrintReceiptButton.includes("Print receipt") &&
    globalsCss.includes("@media print") &&
    globalsCss.includes(".ttc-print-hidden") &&
    globalsCss.includes(".ttc-print-receipt"),
});
checks.push({
  label: "member commerce surfaces show friendly order and fulfillment labels",
  ok:
    accountPage.includes("commerceStatusLabel") &&
    accountPage.includes("fulfillmentStatusLabel") &&
    !accountPage.includes("order.status.replace(\"_\", \" \")") &&
    !accountPage.includes("item.fulfillment_status.replace(\"_\", \" \")") &&
    !accountPage.includes("payment provider review during launch") &&
    merchCheckoutSuccessPage.includes("commerceStatusLabel") &&
    !merchCheckoutSuccessPage.includes("order.status.replace(\"_\", \" \")") &&
    statusLabels.includes("export function commerceStatusLabel") &&
    statusLabels.includes("export function fulfillmentStatusLabel") &&
    statusLabels.includes('if (status === "pending_checkout") return "Checkout pending"') &&
    statusLabels.includes('if (status === "payment_failed") return "Payment failed"') &&
    statusLabels.includes('if (status === "unfulfilled") return "Not fulfilled"'),
});
checks.push({
  label: "seller Merch sales show shipping address details for fulfillment",
  ok:
    accountPage.includes("function shippingAddressLines") &&
    accountPage.includes("shipping_address") &&
    accountPage.includes("const addressLines = shippingAddressLines") &&
    accountPage.includes("Shipping address") &&
    accountPage.includes("<address") &&
    accountActions.includes('console.error("Merch seller fulfillment failed.", error)') &&
    accountActions.includes('"Could not mark this Merch sale fulfilled. Please try again."') &&
    !accountActions.includes('error.message || "Could not mark this Merch sale fulfilled."'),
});
checks.push({
  label: "admin Merch orders show shipping address details for review",
  ok:
    adminMerchPage.includes("function shippingAddressLines") &&
    adminMerchPage.includes("shipping_address") &&
    adminMerchPage.includes("shippingAddress: order.shipping_address") &&
    adminMerchPage.includes("const addressLines = shippingAddressLines(order.shippingAddress)") &&
    adminMerchPage.includes("Shipping address") &&
    adminMerchPage.includes("<address"),
});
checks.push({
  label: "merch refund reviews are audit-only before production refund rules",
  ok:
    accountActions.includes("export async function requestMerchRefundReview") &&
    accountActions.includes('event_type: "merch_refund_review_requested"') &&
    accountActions.includes("Only paid Merch orders can request refund review.") &&
    accountActions.includes("Merch refund review is already waiting for admin review.") &&
    accountPage.includes("requestMerchRefundReview") &&
    accountPage.includes("Request refund review") &&
    accountPage.includes("This does not send money automatically") &&
    adminPaymentsPage.includes("\"merch_refund_review_requested\"") &&
    adminPaymentsPage.includes("Merch refund reviews need admin review") &&
    paymentReadiness.includes("buyer refund-review requests"),
});
checks.push({
  label: "merch products collect and display fulfillment and return notes",
  ok:
    merchNotesMigration.includes("add column if not exists fulfillment_notes") &&
    merchNotesMigration.includes("add column if not exists return_policy") &&
    appActions.includes("fulfillment_notes: fulfillmentNotes || null") &&
    appActions.includes("return_policy: returnPolicy || null") &&
    appActions.includes("Add the city and state/region this Merch ships from.") &&
    appActions.includes("Add fulfillment notes for shipped Merch, including timing or pickup details.") &&
    appActions.includes("Add a short return or refund note for Merch buyers.") &&
    floatingComposer.includes('name="fulfillment_notes"') &&
    floatingComposer.includes('name="return_policy"') &&
    floatingComposer.includes("Return/refund note buyers can understand before checkout") &&
    merchDetailPage.includes("product.fulfillment_notes") &&
    merchDetailPage.includes("product.return_policy") &&
    merchIndexPage.includes("Seller notes") &&
    homePage.includes("Seller notes") &&
    adminMerchPage.includes("Fulfillment notes") &&
    adminMerchPage.includes("Return note"),
});
checks.push({
  label: "legacy merch cannot activate or checkout without review details",
  ok:
    adminActions.includes("Merch needs ship-from, fulfillment, and return/refund details before checkout can be activated.") &&
    adminActions.includes("const missingMerchReviewDetails") &&
    adminActions.includes("product.shipping_required") &&
    adminActions.includes("product.return_policy") &&
    adminMerchPage.includes("const hasReviewDetails") &&
    adminMerchPage.includes("Activation waits for ship-from, fulfillment, and return/refund") &&
    adminMerchPage.includes("Ship-from, fulfillment, and return/refund details are required before checkout can be activated.") &&
    merchCheckout.includes("Merch checkout blocked by missing fulfillment details.") &&
    merchCheckout.includes("const missingReviewDetails") &&
    merchCheckout.includes("product.return_policy") &&
    merchCheckout.includes("product.shipping_required") &&
    productPlan.includes("legacy active Merch detail guard"),
});
checks.push({
  label: "merch detail shows buyer fee estimate and shipping cue before checkout",
  ok:
    merchDetailPage.includes("calculatePlatformFeeCents(product.price_cents)") &&
    merchDetailPage.includes("estimatedSingleItemTotalCents") &&
    merchDetailPage.includes("Estimated fee on one item") &&
    merchDetailPage.includes("before any shipping, tax, or discount") &&
    merchDetailPage.includes("Shipping address is collected during checkout") &&
    merchDetailPage.includes('href="/help/merch-products-orders"'),
});
checks.push({
  label: "shared platform fee helper stays at launch rate",
  ok:
    fees.includes("export const platformFeeRate = 0.02") &&
    fees.includes('export const platformFeePercentLabel = "2%"') &&
    fees.includes("current launch") &&
    !fees.includes("test-mode") &&
    !fees.includes("test mode"),
});
checks.push({
  label: "production commerce gates stay visible before real payments",
  ok:
    adminPaymentsPage.includes("Production payment gates") &&
    adminPaymentsPage.includes("const paymentReconciliationChecks = [") &&
    adminPaymentsPage.includes("const hostedPayoutQaChecks = [") &&
    adminPaymentsPage.includes("Reconciliation checklist") &&
    adminPaymentsPage.includes("Hosted payout QA pass") &&
    adminPaymentsPage.includes("verification-required payout notice") &&
    adminPaymentsPage.includes("the payout setup card shows complete") &&
    adminPaymentsPage.includes("seller payout filter") &&
    adminPaymentsPage.includes("Search the payment reference in Admin > Payments") &&
    adminPaymentsPage.includes("webhook receipt, payment audit row, user-facing status") &&
    adminPaymentsPage.includes("fulfillment, ad delivery, booking deposit state") &&
    adminPaymentsPage.includes("bookingPaymentStatusLabel(status)") &&
    adminPaymentsPage.includes("titleCaseStatus(value)") &&
    adminPaymentsPage.includes("Choose a documented payout policy") &&
    adminPaymentsPage.includes("booking refund, cancellation, appointment-confirmation") &&
    adminPaymentsPage.includes("do not collect bank or card payout data in TTC forms") &&
    adminMerchPage.includes("Checkout and refund status are limited right now") &&
    adminMerchPage.includes("finish tax, shipping, fulfillment, payouts, and payment safety rules") &&
    accountPage.includes("merchSellerReadinessItems") &&
    accountPage.includes("Seller payout path") &&
    accountPage.includes("Seller payout setup") &&
    accountPage.includes("secure hosted setup flow") &&
    accountPage.includes("raw bank, routing, card, or debit payout numbers") &&
    accountPage.includes('action="/api/stripe/connect/onboarding"') &&
    accountPage.includes("Fulfillment gate") &&
    accountPage.includes("Refunds, disputes, and unusual order issues stay in private admin review") &&
    accountPage.includes("stay in private support review") &&
    privacyPage.includes("Checkout is limited right now") &&
    supportPage.includes("Merch checkout is limited right now"),
});
checks.push({
  label: "Stripe Connect seller onboarding stays hosted and server-side",
  ok:
    accountPage.includes(".from(\"stripe_connect_accounts\")") &&
    accountPage.includes("sellerPayoutReady") &&
    accountPage.includes("sellerPayoutAccount") &&
    accountPage.includes("payoutSetupNotice") &&
    accountPage.includes("Continue payout setup") &&
    accountPage.includes("Start payout setup") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("payout_status") &&
    stripeConnectReturn.includes("payout_status") &&
    stripeConnectReturn.includes('"complete"') &&
    stripeConnectReturn.includes('"needs_more"') &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("stripe.accounts.create") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("stripe.accountLinks.create") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("type: \"account_onboarding\"") &&
    stripeConnectReturn.includes("stripe.accounts.retrieve") &&
    stripeConnectReturn.includes("More details may still be needed before payouts are active.") &&
    !stripeConnectReturn.includes("Stripe may still need more details") &&
    readFileSync("src/lib/stripe/connect.ts", "utf8").includes("stripeConnectStatus") &&
    stripeWebhook.includes("stripeConnectStatus") &&
    stripeWebhook.includes('event.type === "account.updated"') &&
    readFileSync("supabase/migrations/20260715101500_stripe_connect_seller_accounts.sql", "utf8").includes("create table if not exists public.stripe_connect_accounts") &&
    readFileSync("supabase/migrations/20260715101500_stripe_connect_seller_accounts.sql", "utf8").includes("enable row level security") &&
    readFileSync("supabase/migrations/20260715101500_stripe_connect_seller_accounts.sql", "utf8").includes("grant select, insert, update, delete on public.stripe_connect_accounts to service_role"),
});
checks.push({
  label: "Stripe Connect onboarding and return recover from provider errors",
  ok:
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes(
      'console.error("Seller payout onboarding failed.", error)',
    ) &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes(
      'console.error("Seller payout account lookup failed.", existingAccountError)',
    ) &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes(
      "Seller payout setup is temporarily unavailable. Please try again.",
    ) &&
    stripeConnectReturn.includes('console.error("Seller payout return check failed.", error)') &&
    stripeConnectReturn.includes(
      'console.error("Seller payout return lookup failed.", connectAccountError)',
    ) &&
    stripeConnectReturn.includes(
      "Seller payout setup could not be checked. Please try again.",
    ),
});
checks.push({
  label: "admin Merch review shows seller payout readiness",
  ok:
    adminMerchPage.includes(".from(\"stripe_connect_accounts\")") &&
    adminMerchPage.includes("Payout ready") &&
    adminMerchPage.includes("Payout setup incomplete") &&
    adminMerchPage.includes("Payout not started") &&
    adminMerchPage.includes("Payout note:") &&
    productPlan.includes("Admin Merch payout-readiness chips"),
});
checks.push({
  label: "admin Merch filters preserve fulfillment review context",
  ok:
    adminMerchPage.includes('name="fulfillment"') &&
    adminMerchPage.includes("value={activeOrderFulfillmentStatus}") &&
    adminMerchPage.includes("orderFulfillmentStatus: activeOrderFulfillmentStatus") &&
    adminMerchPage.includes("orderStatus: activeOrderStatus"),
});
checks.push({
  label: "admin Merch activation requires seller payout readiness",
  ok:
    adminActions.includes("This seller must finish payout setup before Merch checkout can be activated.") &&
    adminActions.includes('status === "active" && !product.is_official') &&
    adminActions.includes(".from(\"stripe_connect_accounts\")") &&
    adminActions.includes("charges_enabled") &&
    adminActions.includes("payouts_enabled") &&
    adminActions.includes("details_submitted") &&
    adminMerchPage.includes("const canActivateCheckout") &&
    adminMerchPage.includes("Activation waits for seller payout setup") &&
    adminMerchPage.includes("disabled={activationBlocked}") &&
    adminMerchPage.includes("Seller payout setup is required before checkout can be activated.") &&
    productPlan.includes("admin activation guard requiring seller payout readiness"),
});
checks.push({
  label: "merch checkout requires seller payout readiness",
  ok:
    merchCheckout.includes("Merch checkout blocked by seller payout readiness.") &&
    merchCheckout.includes(".from(\"stripe_connect_accounts\")") &&
    merchCheckout.includes("charges_enabled") &&
    merchCheckout.includes("payouts_enabled") &&
    merchCheckout.includes("details_submitted") &&
    merchCheckout.includes("Checkout is temporarily unavailable for this product.") &&
    !merchCheckout.includes("seller payout setup is incomplete"),
});
checks.push({
  label: "admin Merch can filter seller payout readiness",
  ok:
    adminMerchPage.includes("function sellerPayoutFilter") &&
    adminMerchPage.includes('params.set("seller_payout", sellerPayoutStatus)') &&
    adminMerchPage.includes("Seller payout") &&
    adminMerchPage.includes("sellerPayoutFilters.map") &&
    adminMerchPage.includes('activeSellerPayoutStatus === "not_started"') &&
    adminMerchPage.includes("productQuery.not") &&
    publicSmoke.includes('path: "/admin/merch?seller_payout=incomplete"') &&
    productPlan.includes("payout-readiness filters"),
});
checks.push({
  label: "admin Merch can filter order fulfillment review",
  ok:
    adminMerchPage.includes("const orderFulfillmentFilters") &&
    adminMerchPage.includes("function orderFulfillmentFilter") &&
    adminMerchPage.includes("Needs fulfillment") &&
    adminMerchPage.includes("Seller fulfilled") &&
    adminMerchPage.includes('params.set("fulfillment", orderFulfillmentStatus)') &&
    adminMerchPage.includes(".is(\"seller_fulfilled_at\", null)") &&
    adminMerchPage.includes(".not(\"seller_fulfilled_at\", \"is\", null)") &&
    adminMerchPage.includes('orderQuery = orderQuery.eq("status", "paid")') &&
    adminMerchPage.includes("needsFulfillmentItemCount") &&
    adminMerchPage.includes("Needs fulfillment:") &&
    adminMerchPage.includes("fulfillment by") &&
    publicSmoke.includes('path: "/admin/merch?fulfillment=needs_fulfillment"') &&
    productPlan.includes("fulfillment filters for paid orders needing seller fulfillment"),
});
checks.push({
  label: "admin Merch queues include searchable product and order review",
  ok:
    adminMerchPage.includes("Search Merch admin") &&
    adminMerchPage.includes("Product title, order item, customer email, shipping name, or payment ID") &&
    adminMerchPage.includes("title.ilike") &&
    adminMerchPage.includes('from("merch_order_items")') &&
    adminMerchPage.includes("title_snapshot") &&
    adminMerchPage.includes("uniqueMatchingOrderItemIds") &&
    adminMerchPage.includes("customer_email.ilike") &&
    adminMerchPage.includes("stripe_payment_intent_id.ilike") &&
    adminMerchPage.includes("Payment intent:") &&
    productPlan.includes("order item title, customer, shipping, and payment-reference search"),
});
checks.push({
  label: "admin Merch and payment queues use friendly status labels",
  ok:
    adminMerchPage.includes("commerceStatusLabel(order.status)") &&
    adminMerchPage.includes("titleCaseStatus(value)") &&
    !adminMerchPage.includes('product.status.replace("_", " ")') &&
    !adminMerchPage.includes('product.moderationStatus.replace("_", " ")') &&
    !adminMerchPage.includes('order.status.replace("_", " ")') &&
    !adminPaymentsPage.includes("return value.replaceAll(\"_\", \" \")"),
});
checks.push({
  label: "ad campaign surfaces use shared friendly labels",
  ok:
    accountPage.includes("titleCaseStatus(value)") &&
    accountPage.includes("Merch ads stay in Merch.") &&
    accountPage.includes("Merch campaigns stay in Merch and focus on product views") &&
    adminAdsPage.includes("titleCaseStatus(value)") &&
    adminAdsPage.includes("grantAdCampaignCredit") &&
    adminAdsPage.includes("Apply ad credit") &&
    adminActions.includes("export async function grantAdCampaignCredit") &&
    adminActions.includes("await requireAdmin()") &&
    adminActions.includes('payment_status: "waived"') &&
    adminActions.includes('event_type: "ad_campaign_credit_granted"') &&
    adminActions.includes("credit_amount_cents") &&
    adminActions.includes("Only unpaid, failed, refunded, or already-waived ad campaigns can receive manual credit.") &&
    productPlan.includes("manual ad credits are started as campaign-level payment waivers") &&
    !accountPage.includes('return value.replaceAll("_", " ")') &&
    !adminAdsPage.includes('return value.replaceAll("_", " ")'),
});
checks.push({
  label: "admin payments watches booking deposit state",
  ok:
    adminActions.includes("export async function resetStaleBookingDepositCheckouts") &&
    adminActions.includes("export async function refundBookingDeposit") &&
    adminActions.includes('event_type: "reset_stale_booking_deposit_checkouts"') &&
    adminActions.includes('event_type: "refund_booking_deposit_requested"') &&
    adminActions.includes("createStripeClient") &&
    adminActions.includes("stripe.refunds.create") &&
    adminActions.includes('payment_intent: booking.stripe_payment_intent_id') &&
    adminActions.includes('confirm !== "refund"') &&
    adminActions.includes('.eq("status", "deposit_pending")') &&
    adminActions.includes('.eq("payment_status", "checkout_started")') &&
    adminActions.includes('payment_status: "payment_failed"') &&
    adminActions.includes('status: "accepted"') &&
    adminActions.includes('stripe_checkout_session_id: null') &&
    adminActions.includes('profile?.role !== "admin" && profile?.role !== "owner"') &&
    adminPaymentsPage.includes("const bookingPaymentStatuses") &&
    adminPaymentsPage.includes("refundBookingDeposit") &&
    adminPaymentsPage.includes("resetStaleBookingDepositCheckouts") &&
    adminPaymentsPage.includes('table: "booking_requests"') &&
    adminPaymentsPage.includes("booking_page") &&
    adminPaymentsPage.includes("booking_payment_status") &&
    adminPaymentsPage.includes("event_type") &&
    adminPaymentsPage.includes("audit_type") &&
    adminPaymentsPage.includes("audit_page") &&
    adminPaymentsPage.includes("const paymentEventTypes") &&
    adminPaymentsPage.includes("const paymentAuditTypes") &&
    adminPaymentsPage.includes("const paymentDisputeAuditTypes") &&
    adminPaymentsPage.includes("function paymentEventFilterHref") &&
    adminPaymentsPage.includes("function auditFilterHref") &&
    adminPaymentsPage.includes("function bookingFilterHref") &&
    adminPaymentsPage.includes("paymentStatusFilter") &&
    adminPaymentsPage.includes("eventTypeFilter") &&
    adminPaymentsPage.includes("eventTypeLabel") &&
    adminPaymentsPage.includes("auditTypeFilter") &&
    adminPaymentsPage.includes("bookingCurrentPage") &&
    adminPaymentsPage.includes("Payment audit") &&
    adminPaymentsPage.includes("paymentAuditLogs") &&
    adminPaymentsPage.includes("paymentDisputeAuditCount") &&
    adminPaymentsPage.includes("bookingRefundReviewCount") &&
    adminPaymentsPage.includes("booking_refund_review_requested") &&
    adminPaymentsPage.includes("booking_refund_problem") &&
    adminPaymentsPage.includes("ad_campaign_credit_granted") &&
    adminPaymentsPage.includes("Ad credit granted") &&
    adminPaymentsPage.includes("user_ad_credit_granted") &&
    adminPaymentsPage.includes("User ad credit granted") &&
    adminPaymentsPage.includes("payment_disputes") &&
    adminPaymentsPage.includes("merch_payment_dispute") &&
    adminPaymentsPage.includes("ad_payment_dispute") &&
    adminPaymentsPage.includes("booking_payment_dispute") &&
    adminPaymentsPage.includes("charge.dispute.created") &&
    adminPaymentsPage.includes("charge.dispute.closed") &&
    adminPaymentsPage.includes("charge.dispute.funds_withdrawn") &&
    adminPaymentsPage.includes("charge.dispute.funds_reinstated") &&
    adminPaymentsPage.includes("refund_booking_deposit_requested") &&
    adminPaymentsPage.includes("reset_stale_booking_deposit_checkouts") &&
    adminPaymentsPage.includes(".range(auditFrom, auditTo)") &&
    adminPaymentsPage.includes("Booking deposits") &&
    adminPaymentsPage.includes("recentBookingDeposits") &&
    adminPaymentsPage.includes(".gt(\"total_cents\", 0)") &&
    adminPaymentsPage.includes(".range(bookingFrom, bookingTo)") &&
    adminPaymentsPage.includes('query.eq("event_type", paymentEventTypeFilter)') &&
    adminPaymentsPage.includes('.eq("event_type", paymentAuditTypeFilter)') &&
    adminPaymentsPage.includes('query.eq("payment_status", bookingPaymentStatusFilter)') &&
    adminPaymentsPage.includes("Search payment admin") &&
    adminPaymentsPage.includes("Event ID, payment intent, booking title, target ID, or audit summary") &&
    adminPaymentsPage.includes("event_id.ilike") &&
    adminPaymentsPage.includes("target_id.ilike") &&
    adminPaymentsPage.includes("stripe_payment_intent_id.ilike") &&
    adminPaymentsPage.includes("paymentEventFilterHref(eventType, 1, activeSearch)") &&
    adminPaymentsPage.includes("paymentEventFilterHref(paymentEventTypeFilter, page, activeSearch)") &&
    adminPaymentsPage.includes("auditFilterHref(auditType, 1, activeSearch)") &&
    adminPaymentsPage.includes("auditFilterHref(paymentAuditTypeFilter, page, activeSearch)") &&
    adminPaymentsPage.includes("bookingFilterHref(status, 1, activeSearch)") &&
    adminPaymentsPage.includes("stripe_payment_intent_id") &&
    adminPaymentsPage.includes("Type refund to send full refund") &&
    adminPaymentsPage.includes("href={`/u/${booking.client.username}`}") &&
    adminPaymentsPage.includes("href={`/u/${booking.artist.username}`}") &&
    adminPaymentsPage.includes("bookingPaymentStatusLabel(booking.payment_status)") &&
    adminPaymentsPage.includes("TTC fee") &&
    adminPaymentsPage.includes("Stale booking deposit checkouts over 24h") &&
    adminPaymentsPage.includes('bookingFilterHref("checkout_started", 1, activeSearch)') &&
    adminPaymentsPage.includes("Reset stale booking checkouts") &&
    adminPaymentsPage.includes("Dispute audit entries need review") &&
    adminPaymentsPage.includes('auditFilterHref("payment_disputes", 1, activeSearch)') &&
    adminPaymentsPage.includes("Booking refund reviews need admin review") &&
    adminPaymentsPage.includes('"booking_refund_review_requested"') &&
    adminPaymentsPage.includes("Booking deposit states") &&
    adminPaymentsPage.includes('.eq("status", "deposit_pending")') &&
    adminPaymentsPage.includes('.eq("payment_status", "checkout_started")') &&
    productPlan.includes("supports event/audit/booking payment search"),
});
checks.push({
  label: "public payment copy avoids collecting raw payout credentials",
  ok:
    !paymentSafetySource.includes("bank account number") &&
    !paymentSafetySource.includes("routing number") &&
    !paymentSafetySource.includes("debit card number") &&
    !paymentSafetySource.includes("card payout form") &&
    adminPaymentsPage.includes("secure hosted onboarding flow") &&
    accountPage.includes("TTC stores payout readiness status only"),
});

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
  if (!check.ok && check.message) {
    console.error(`  ${check.message}`);
  }
}

if (failures.length) {
  console.error(`${failures.length} payment guard smoke check(s) failed.`);
  process.exit(1);
}
