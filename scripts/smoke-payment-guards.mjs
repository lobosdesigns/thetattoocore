import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const adCheckout = readFileSync("src/app/api/ads/checkout/route.ts", "utf8");
const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");
const merchCheckout = readFileSync("src/app/api/merch/checkout/route.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const stripeWebhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const adClickRoute = readFileSync("src/app/api/ad-click/route.ts", "utf8");
const stripeServer = readFileSync("src/lib/stripe/server.ts", "utf8");
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
const stripeConnectOnboarding = readFileSync(
  "src/app/api/stripe/connect/onboarding/route.ts",
  "utf8",
);
const stripeConnectReturn = readFileSync("src/app/api/stripe/connect/return/route.ts", "utf8");
const adCreditSpendMigration = readFileSync(
  "supabase/migrations/20260715041500_spend_ad_credit_for_campaign.sql",
  "utf8",
);
const paymentRpcAccessMigration = readFileSync(
  "supabase/migrations/20260722135223_restrict_payment_inventory_rpc_execute.sql",
  "utf8",
);
const merchInventoryLifecycleMigration = readFileSync(
  "supabase/migrations/20260722144527_merch_inventory_reservation_lifecycle.sql",
  "utf8",
);
const stripeConnectLivemodeMigration = readFileSync(
  "supabase/migrations/20260722152821_stripe_connect_livemode_isolation.sql",
  "utf8",
);
const stripeWebhookClaimMigration = readFileSync(
  "supabase/migrations/20260722194829_stripe_webhook_event_claim_release.sql",
  "utf8",
);
const paymentDisputeHoldMigration = readFileSync(
  "supabase/migrations/20260722202250_payment_dispute_operational_hold.sql",
  "utf8",
);
const legacyMerchFulfillmentRetirementMigration = readFileSync(
  "supabase/migrations/20260722202417_drop_legacy_merch_fulfillment_overload.sql",
  "utf8",
);
const bookingCheckoutReservationMigration = readFileSync(
  "supabase/migrations/20260722205002_reserve_booking_deposit_checkout.sql",
  "utf8",
);
const globalsCss = readFileSync("src/app/globals.css", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const helpPage = readFileSync("src/app/help/page.tsx", "utf8");
const helpCenter = readFileSync("src/lib/help-center.ts", "utf8");
const helpCenterSearch = readFileSync("src/app/help/help-center-search.tsx", "utf8");
const fees = readFileSync("src/lib/payments/fees.ts", "utf8");
const statusLabels = readFileSync("src/lib/status-labels.ts", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");
const paymentReadiness = readFileSync("docs/PAYMENT_PRODUCTION_READINESS.md", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const memberPaymentSafetySource = [
  helpCenter,
  helpCenterSearch,
  helpPage,
  privacyPage,
  supportPage,
].join("\n");
const requiredPaymentWebhookEvents = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
  "account.updated",
];

function missingWebhookEventsIn(sourceText) {
  return requiredPaymentWebhookEvents.filter((eventType) => !sourceText.includes(eventType));
}

const webhookSourceMissingEvents = missingWebhookEventsIn(stripeWebhook);
const paymentReadinessMissingEvents = missingWebhookEventsIn(paymentReadiness);

const codeSearchRoots = ["src/app", "src/lib"];
const codeSearchExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const payoutReleaseForbiddenSnippets = [
  "stripe.transfers.create",
  "stripe.payouts.create",
  ".transfers.create(",
  ".payouts.create(",
  "transfer_data",
  "application_fee_amount",
  "transfer_group",
  "on_behalf_of",
];

function codeFilesUnder(root) {
  const entries = readdirSync(root);
  const files = [];

  for (const entry of entries) {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      files.push(...codeFilesUnder(entryPath));
      continue;
    }

    if ([...codeSearchExtensions].some((extension) => entryPath.endsWith(extension))) {
      files.push(entryPath);
    }
  }

  return files;
}

const payoutReleaseFindings = codeSearchRoots
  .flatMap((root) => codeFilesUnder(root))
  .flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");

    return payoutReleaseForbiddenSnippets
      .filter((snippet) => source.includes(snippet))
      .map((snippet) => `${filePath}: ${snippet}`);
  });

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
  label: "payment inventory RPC execution stays limited to intended roles",
  ok:
    adminActions.includes("const inventoryAdmin =") &&
    adminActions.includes('status === "cancelled" ? createAdminClient() : null') &&
    adminActions.includes("const orderCancellationClient = inventoryAdmin") &&
    adminActions.includes('.rpc("cancel_unpaid_merch_order"') &&
    !adminActions.includes('await supabase.rpc(\n      "cancel_unpaid_merch_order"') &&
    paymentRpcAccessMigration.includes(
      "revoke execute on function public.reserve_merch_inventory_for_order(uuid)",
    ) &&
    paymentRpcAccessMigration.includes(
      "revoke execute on function public.release_merch_inventory_for_order(uuid)",
    ) &&
    paymentRpcAccessMigration.includes(
      "revoke execute on function public.mark_paid_merch_order_for_checkout(",
    ) &&
    (paymentRpcAccessMigration.match(/from public, anon, authenticated;/g) ?? [])
      .length === 3 &&
    paymentRpcAccessMigration.includes(
      "grant execute on function public.reserve_merch_inventory_for_order(uuid)",
    ) &&
    paymentRpcAccessMigration.includes(
      "grant execute on function public.release_merch_inventory_for_order(uuid)",
    ) &&
    (paymentRpcAccessMigration.match(/to service_role;/g) ?? []).length === 3 &&
    paymentRpcAccessMigration.includes(
      "revoke execute on function public.spend_ad_credit_for_campaign(uuid)",
    ) &&
    paymentRpcAccessMigration.includes("from public, anon") &&
    paymentRpcAccessMigration.includes("to authenticated, service_role"),
});
checks.push({
  label: "Merch inventory reservations are order-owned and released atomically",
  ok:
    merchInventoryLifecycleMigration.includes(
      "create type public.merch_inventory_reservation_status as enum",
    ) &&
    merchInventoryLifecycleMigration.includes(
      "inventory_reservation_status = 'reserved'",
    ) &&
    merchInventoryLifecycleMigration.includes(
      "inventory_reservation_status = 'released'",
    ) &&
    merchInventoryLifecycleMigration.includes(
      "inventory_reservation_status = 'consumed'",
    ) &&
    merchInventoryLifecycleMigration.includes(
      "create or replace function public.cancel_unpaid_merch_order",
    ) &&
    merchInventoryLifecycleMigration.includes(
      "create or replace function public.mark_problem_merch_order_for_checkout",
    ) &&
    merchInventoryLifecycleMigration.includes("for update") &&
    merchInventoryLifecycleMigration.includes(
      "perform public.release_merch_inventory_for_order(v_order.id)",
    ) &&
    (merchInventoryLifecycleMigration.match(/from public, anon, authenticated;/g) ?? [])
      .length >= 5 &&
    merchCheckout.includes('.rpc("cancel_unpaid_merch_order"') &&
    !merchCheckout.includes('.rpc("release_merch_inventory_for_order"') &&
    stripeWebhook.includes('.rpc("mark_problem_merch_order_for_checkout"') &&
    !stripeWebhook.includes('.rpc(\n        "release_merch_inventory_for_order"'),
});
checks.push({
  label: "payout readiness does not execute seller payout release",
  ok:
    payoutReleaseFindings.length === 0 &&
    paymentReadiness.includes("Production purchases, seller payout releases, and real ad spending should stay gated") &&
    paymentReadiness.includes("Do not release production seller payouts until this policy is finalized") &&
    productPlan.includes("payout release before manual closeout") &&
    productPlan.includes("Next payment-maturity work is refund/fulfillment edge cases and production payment-policy review"),
  message: payoutReleaseFindings.length
    ? `Found payout release primitives before policy gate: ${payoutReleaseFindings.join("; ")}`
    : undefined,
});
checks.push({
  label: "payment readiness keeps dashboard live-money blockers explicit",
  ok:
    paymentReadiness.includes("dashboard inspection still shows Connect setup") &&
    paymentReadiness.includes("account/go-live verification work in progress") &&
    paymentReadiness.includes("next setup item is `Create a test connected account`") &&
    paymentReadiness.includes("explicit mode `Needs review`") &&
    paymentReadiness.includes("server payment key mode `Test`") &&
    paymentReadiness.includes("webhook signing `Ready`") &&
    paymentReadiness.includes("checkout blocked until the expected mode is readable and matched") &&
    paymentReadiness.includes("Live-money cutover remains blocked") &&
    paymentReadiness.includes("webhook mode/event proof") &&
    paymentReadiness.includes("Admin reconciliation") &&
    paymentReadiness.includes("penny-test proof") &&
    paymentReadiness.includes("refund/dispute procedure") &&
    paymentReadiness.includes("payout gate") &&
    paymentReadiness.includes("native checkout policy review") &&
    paymentReadiness.includes("private handoff"),
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
  label: "Merch submit actions hide raw backend errors from member redirects",
  ok:
    appActions.includes('console.error("Merch product submit failed.", error)') &&
    appActions.includes('"Could not submit Merch for review. Please try again."') &&
    appActions.includes('console.error("Merch media storage upload failed.", error)') &&
    appActions.includes('throw new Error("Could not upload Merch media.")') &&
    appActions.includes('console.error("Merch media upload failed.", error)') &&
    appActions.includes('"Could not upload Merch media. Please try again."') &&
    appActions.includes('console.error("Merch media attach failed.", mediaError)') &&
    appActions.includes('"Media uploaded but could not attach to the Merch product. Please try again."') &&
    !appActions.includes('error?.message || "Could not submit Merch for review."') &&
    !appActions.includes('error.message || "Could not upload Merch media."') &&
    !appActions.includes('error instanceof Error ? error.message : "Could not upload Merch media."') &&
    !appActions.includes('mediaError.message || "Media uploaded but could not attach to the Merch product."'),
});
checks.push({
  label: "Merch owner edit and archive actions hide raw backend errors from member redirects",
  ok:
    appActions.includes('console.error("Merch product edit lookup failed.", productError)') &&
    appActions.includes('console.error("Merch product update failed.", error)') &&
    appActions.includes('console.error("Merch product archive lookup failed.", productError)') &&
    appActions.includes('console.error("Merch product archive failed.", error)') &&
    appActions.includes('"Could not update Merch product. It may be gone or owned by another account."') &&
    appActions.includes('"Could not archive Merch product. It may be gone or owned by another account."') &&
    !appActions.includes('productError?.message || "Merch product was not found."') &&
    !appActions.includes('error?.message ||\n          "Could not update Merch product. It may be gone or owned by another account."') &&
    !appActions.includes('error?.message ||\n          "Could not archive Merch product. It may be gone or owned by another account."'),
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
  label: "checkout routes fail closed on strict payment mode preflight before reservations",
  ok:
    stripeServer.includes("export function stripeCheckoutModeMismatch") &&
    stripeServer.includes("export function stripeCheckoutPreflight") &&
    stripeServer.includes("expectedStripeLivemode()") &&
    stripeServer.includes("stripeSecretKeyLivemode()") &&
    stripeServer.includes('reason: "missing_expected_mode"') &&
    stripeServer.includes('reason: "missing_secret_key"') &&
    stripeServer.includes('reason: "unreadable_secret_key_mode"') &&
    stripeServer.includes('reason: "mode_mismatch"') &&
    adCheckout.includes("stripeCheckoutPreflight") &&
    bookingCheckout.includes("stripeCheckoutPreflight") &&
    merchCheckout.includes("stripeCheckoutPreflight") &&
    adCheckout.includes("const checkoutPreflight = stripeCheckoutPreflight()") &&
    bookingCheckout.includes("const checkoutPreflight = stripeCheckoutPreflight()") &&
    merchCheckout.includes("const checkoutPreflight = stripeCheckoutPreflight()") &&
    adCheckout.includes("if (!checkoutPreflight.ready)") &&
    bookingCheckout.includes("if (!checkoutPreflight.ready)") &&
    merchCheckout.includes("if (!checkoutPreflight.ready)") &&
    adCheckout.includes('console.error("Ad checkout mode preflight failed.", checkoutPreflight)') &&
    bookingCheckout.includes('console.error("Booking checkout mode preflight failed.", checkoutPreflight)') &&
    merchCheckout.includes('console.error("Merch checkout mode preflight failed.", checkoutPreflight)') &&
    adCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") <
      adCheckout.indexOf("const { data: campaign, error }") &&
    bookingCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") <
      bookingCheckout.indexOf("const { data: booking, error }") &&
    merchCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") <
      merchCheckout.indexOf("const { data: product, error }") &&
    adCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") >
      adCheckout.indexOf("if (!claims?.sub)") &&
    bookingCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") >
      bookingCheckout.indexOf("if (!claims?.sub)") &&
    merchCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") >
      merchCheckout.indexOf("if (!claims?.sub)"),
});
checks.push({
  label: "checkout creation failures log privately and show generic member copy",
  ok:
    adCheckout.includes('console.error("Ad checkout session creation failed.", error)') &&
    adCheckout.includes('"Checkout could not open for this ad. Please try again."') &&
    adCheckout.includes('throw new Error("Checkout could not open for this ad.")') &&
    !adCheckout.includes("session.error?.message") &&
    !adCheckout.includes("throw new Error(message)") &&
    !adCheckout.includes('error instanceof Error ? error.message : "Checkout could not open for this ad."') &&
    bookingCheckout.includes('console.error("Booking checkout session creation failed.", error)') &&
    bookingCheckout.includes('"Booking checkout could not open. Please try again."') &&
    bookingCheckout.includes('throw new Error("Booking checkout could not open.")') &&
    !bookingCheckout.includes("session.error?.message") &&
    !bookingCheckout.includes("throw new Error(message)") &&
    !bookingCheckout.includes('error instanceof Error ? error.message : "Booking checkout could not open."') &&
    merchCheckout.includes('console.error("Merch checkout session creation failed.", error)') &&
    merchCheckout.includes('"Checkout could not open. Please try again."') &&
    merchCheckout.includes('throw new Error("Checkout could not open.")') &&
    !merchCheckout.includes("session.error?.message") &&
    !merchCheckout.includes("throw new Error(message)") &&
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
    merchCheckout.includes('"Order setup could not finish. Please try again."') &&
    !merchCheckout.includes('"The order could not be saved before checkout. Please try again."') &&
    merchCheckout.includes('console.error("Merch order item save failed before checkout.", itemError)') &&
    !merchCheckout.includes('"The order item could not be saved before checkout. Please try again."') &&
    merchCheckout.includes('console.error("Merch inventory reservation failed before checkout.", reserveError)') &&
    merchCheckout.includes('"This item could not be held for checkout. Please try again."') &&
    !merchCheckout.includes('"Inventory could not be reserved for checkout. Please try again."') &&
    merchCheckout.includes('console.error("Merch checkout session save failed.", sessionError)') &&
    merchCheckout.includes('"Checkout opened, but order setup could not finish. Please contact Support if this repeats."') &&
    merchCheckout.includes('"Checkout opened, but order setup could not finish. Please try again."') &&
    merchCheckout.includes('"Checkout could not open for this product. Please try again."') &&
    !merchCheckout.includes('"Checkout started, but the order session could not be saved. Please contact support if this repeats."'),
});
checks.push({
  label: "ad and booking checkout roll back reservations when session persistence fails",
  ok:
    adCheckout.includes('console.error("Ad checkout session save failed.", updateError);\n    await rollBackReservation();') &&
    adCheckout.includes('if (!updatedCampaign) {\n    await rollBackReservation();') &&
    bookingCheckout.includes('console.error("Booking checkout session save failed.", updateError);\n    await rollBackReservation();') &&
    bookingCheckout.includes('if (!updatedBooking) {\n    await rollBackReservation();'),
});
checks.push({
  label: "booking checkout atomically revalidates its recipient before payment",
  ok:
    bookingCheckoutReservationMigration.includes(
      "create or replace function public.reserve_booking_deposit_checkout",
    ) &&
    bookingCheckoutReservationMigration.includes("security invoker") &&
    bookingCheckoutReservationMigration.includes("set search_path = ''") &&
    bookingCheckoutReservationMigration.includes("for update of booking, recipient") &&
    bookingCheckoutReservationMigration.includes("booking.client_id = p_client_id") &&
    bookingCheckoutReservationMigration.includes("booking.status = 'accepted'") &&
    bookingCheckoutReservationMigration.includes(
      "booking.payment_status in ('not_ready', 'payment_failed')",
    ) &&
    bookingCheckoutReservationMigration.includes("not booking.payment_dispute_hold") &&
    bookingCheckoutReservationMigration.includes(
      "recipient.account_type in ('artist', 'studio')",
    ) &&
    bookingCheckoutReservationMigration.includes(
      "recipient.license_verified_at is not null",
    ) &&
    bookingCheckoutReservationMigration.includes("recipient.suspended_at is null") &&
    bookingCheckoutReservationMigration.includes("recipient.banned_at is null") &&
    bookingCheckoutReservationMigration.includes(
      "revoke all on function public.reserve_booking_deposit_checkout(uuid, uuid)",
    ) &&
    bookingCheckoutReservationMigration.includes("from public, anon, authenticated") &&
    bookingCheckoutReservationMigration.includes(
      "grant execute on function public.reserve_booking_deposit_checkout(uuid, uuid)",
    ) &&
    bookingCheckoutReservationMigration.includes("to service_role") &&
    bookingCheckout.includes('.rpc("reserve_booking_deposit_checkout"') &&
    bookingCheckout.includes("p_booking_id: booking.id") &&
    bookingCheckout.includes("p_client_id: claims.sub") &&
    bookingCheckout.includes("createBookingCheckoutSession(reservedBooking, returnTo)") &&
    bookingCheckout.indexOf('.rpc("reserve_booking_deposit_checkout"') <
      bookingCheckout.indexOf("createBookingCheckoutSession(reservedBooking, returnTo)") &&
    !bookingCheckout.includes('.from("booking_requests")\n    .update({\n      payment_status: "checkout_started"'),
});
checks.push({
  label: "payment webhook rejects unsigned events before processing",
  ok:
    stripeWebhook.includes("const signature = request.headers.get(\"stripe-signature\")") &&
    stripeWebhook.includes("Missing payment verification.") &&
    stripeWebhook.includes("constructEventAsync") &&
    stripeWebhook.includes('event.type === "refund.failed"') &&
    stripeWebhook.includes("recordRefundProblem") &&
    stripeWebhook.includes('event_type: "merch_refund_problem"') &&
    stripeWebhook.includes('event_type: "ad_refund_problem"') &&
    stripeWebhook.includes('event_type: "booking_refund_problem"') &&
    stripeWebhook.includes("failureReason: refund.failure_reason ?? null") &&
    stripeWebhook.includes('from("merch_orders")') &&
    stripeWebhook.includes('from("ad_campaigns")') &&
    stripeWebhook.includes('from("booking_requests")') &&
    stripeWebhook.includes("const disputeWebhookEvents") &&
    stripeWebhook.includes('"charge.dispute.created"') &&
    stripeWebhook.includes('"charge.dispute.updated"') &&
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
    stripeWebhook.includes("stripeConnectStatus(account, livemode)") &&
    stripeWebhook.indexOf("Missing payment verification.") <
      stripeWebhook.indexOf("constructEventAsync"),
});
checks.push({
  label: "payment disputes impose protected operational holds",
  ok:
    paymentDisputeHoldMigration.includes("alter table public.merch_orders") &&
    paymentDisputeHoldMigration.includes("alter table public.ad_campaigns") &&
    paymentDisputeHoldMigration.includes("alter table public.booking_requests") &&
    paymentDisputeHoldMigration.includes("payment_dispute_hold boolean not null default false") &&
    paymentDisputeHoldMigration.includes("private.prevent_untrusted_payment_dispute_field_changes") &&
    paymentDisputeHoldMigration.includes("security invoker") &&
    paymentDisputeHoldMigration.includes("set search_path = ''") &&
    paymentDisputeHoldMigration.includes("current_user in ('postgres', 'supabase_admin', 'service_role')") &&
    paymentDisputeHoldMigration.includes("v_request_role = 'service_role'") &&
    !paymentDisputeHoldMigration.includes("session_user in") &&
    paymentDisputeHoldMigration.includes("protect_merch_order_payment_dispute_fields") &&
    paymentDisputeHoldMigration.includes("protect_ad_campaign_payment_dispute_fields") &&
    paymentDisputeHoldMigration.includes("protect_booking_request_payment_dispute_fields") &&
    paymentDisputeHoldMigration.includes('drop policy if exists "Active ads are publicly readable"') &&
    paymentDisputeHoldMigration.includes('drop policy if exists "Active ad placements are publicly readable"') &&
    paymentDisputeHoldMigration.includes('drop policy if exists "Ad events can be created"') &&
    paymentDisputeHoldMigration.includes("and not payment_dispute_hold") &&
    paymentDisputeHoldMigration.includes("and not ad_campaigns.payment_dispute_hold") &&
    paymentDisputeHoldMigration.includes("if v_payment_dispute_hold then") &&
    paymentDisputeHoldMigration.includes("This order is under payment review and cannot be fulfilled yet.") &&
    legacyMerchFulfillmentRetirementMigration.includes(
      "revoke all on function public.mark_own_merch_order_item_fulfilled(uuid)",
    ) &&
    legacyMerchFulfillmentRetirementMigration.includes(
      "drop function if exists public.mark_own_merch_order_item_fulfilled(uuid)",
    ) &&
    stripeWebhook.includes('eventType !== "charge.dispute.funds_reinstated"') &&
    stripeWebhook.includes('dispute.status !== "won"') &&
    stripeWebhook.includes('dispute.status !== "warning_closed"') &&
    stripeWebhook.includes("payment_dispute_hold: paymentDisputeHold") &&
    stripeWebhook.includes("payment_dispute_status: dispute.status") &&
    stripeWebhook.includes("operational_hold: paymentDisputeHold") &&
    adminActions.includes("campaign.payment_dispute_hold") &&
    adminActions.includes("This campaign is under payment review and cannot be activated.") &&
    adminActions.includes("booking.payment_dispute_hold") &&
    adminActions.includes("This booking payment is under review and cannot be refunded here yet.") &&
    homePage.includes('.eq("payment_dispute_hold", false)') &&
    merchIndexPage.includes('.eq("payment_dispute_hold", false)') &&
    adClickRoute.includes('.eq("payment_dispute_hold", false)'),
});
checks.push({
  label: "payment webhook claims events before side effects and records completion",
  ok:
    stripeWebhook.includes('"claim_stripe_webhook_event"') &&
    stripeWebhook.includes('"complete_stripe_webhook_event"') &&
    stripeWebhook.includes('"fail_stripe_webhook_event"') &&
    stripeWebhook.includes('claimStatus === "processed"') &&
    stripeWebhook.includes('claimStatus === "processing"') &&
    stripeWebhook.includes('claimStatus !== "claimed"') &&
    stripeWebhook.indexOf('"claim_stripe_webhook_event"') <
      stripeWebhook.indexOf('event.type === "checkout.session.completed"') &&
    stripeWebhook.indexOf('"complete_stripe_webhook_event"') >
      stripeWebhook.indexOf('event.type === "account.updated"') &&
    stripeWebhook.indexOf('"fail_stripe_webhook_event"') >
      stripeWebhook.indexOf("Payment update processing failed.") &&
    !stripeWebhook.includes('.from("stripe_webhook_events")') &&
    stripeWebhookClaimMigration.includes("add column if not exists status text not null default 'processed'") &&
    stripeWebhookClaimMigration.includes("status in ('processing', 'processed', 'failed')") &&
    stripeWebhookClaimMigration.includes("create or replace function public.claim_stripe_webhook_event") &&
    stripeWebhookClaimMigration.includes("for update") &&
    stripeWebhookClaimMigration.includes("now() - interval '10 minutes'") &&
    stripeWebhookClaimMigration.includes("create or replace function public.complete_stripe_webhook_event") &&
    stripeWebhookClaimMigration.includes("create or replace function public.fail_stripe_webhook_event") &&
    stripeWebhookClaimMigration.includes("security invoker") &&
    stripeWebhookClaimMigration.includes("set search_path = ''") &&
    stripeWebhookClaimMigration.includes("revoke all on table public.stripe_webhook_events from anon, authenticated") &&
    stripeWebhookClaimMigration.includes("grant select, insert, update on table public.stripe_webhook_events to service_role") &&
    stripeWebhookClaimMigration.includes("revoke execute on function public.claim_stripe_webhook_event(text, text)") &&
    stripeWebhookClaimMigration.includes("grant execute on function public.claim_stripe_webhook_event(text, text)") &&
    stripeWebhookClaimMigration.includes("to service_role"),
});
checks.push({
  label: "payment webhook required event coverage stays aligned with readiness docs",
  ok: webhookSourceMissingEvents.length === 0 && paymentReadinessMissingEvents.length === 0,
  message: [
    webhookSourceMissingEvents.length > 0
      ? `webhook source missing: ${webhookSourceMissingEvents.join(", ")}`
      : "",
    paymentReadinessMissingEvents.length > 0
      ? `payment readiness doc missing: ${paymentReadinessMissingEvents.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("; "),
});
checks.push({
  label: "payment webhook hides raw Merch order backend errors",
  ok:
    stripeWebhook.includes('console.error("Webhook Merch paid order transition failed.", error)') &&
    stripeWebhook.includes('throw new Error("Could not mark merch order paid.")') &&
    stripeWebhook.includes('console.error("Webhook Merch order payment update failed.", error)') &&
    stripeWebhook.includes('throw new Error("Could not update merch order.")') &&
    !stripeWebhook.includes('error.message || "Could not mark merch order paid."') &&
    !stripeWebhook.includes('error.message || "Could not update merch order."'),
});
checks.push({
  label: "payment webhook hides raw ad payment backend errors",
  ok:
    stripeWebhook.includes('console.error("Webhook ad payment status update failed.", error)') &&
    stripeWebhook.includes('throw new Error("Could not update ad payment status.")') &&
    !stripeWebhook.includes('error.message || "Could not update ad payment status."'),
});
checks.push({
  label: "payment webhook hides raw booking deposit backend errors",
  ok:
    stripeWebhook.includes('console.error("Webhook booking deposit status update failed.", error)') &&
    stripeWebhook.includes('throw new Error("Could not update booking deposit status.")') &&
    !stripeWebhook.includes('error.message || "Could not update booking deposit status."'),
});
checks.push({
  label: "payment webhook hides raw refund backend errors",
  ok:
    stripeWebhook.includes('console.error("Webhook Merch refund status update failed.", error)') &&
    stripeWebhook.includes('throw new Error("Could not update merch refund status.")') &&
    stripeWebhook.includes('console.error("Webhook ad refund status update failed.", adError)') &&
    stripeWebhook.includes('throw new Error("Could not update ad refund status.")') &&
    stripeWebhook.includes('console.error("Webhook booking refund status update failed.", bookingError)') &&
    stripeWebhook.includes('throw new Error("Could not update booking refund status.")') &&
    stripeWebhook.includes('console.error("Webhook refund problem lookup failed.", firstError)') &&
    stripeWebhook.includes('throw new Error("Could not inspect failed refund status.")') &&
    stripeWebhook.includes('console.error("Webhook refund problem audit record failed.", auditError)') &&
    stripeWebhook.includes('throw new Error("Could not record failed refund review.")') &&
    !stripeWebhook.includes('error.message || "Could not update merch refund status."') &&
    !stripeWebhook.includes('adError.message || "Could not update ad refund status."') &&
    !stripeWebhook.includes('bookingError.message || "Could not update booking refund status."') &&
    !stripeWebhook.includes('firstError.message || "Could not inspect failed refund status."'),
});
checks.push({
  label: "payment webhook hides raw dispute backend errors",
  ok:
    stripeWebhook.includes('console.error("Webhook disputed payment hold update failed.", firstError)') &&
    stripeWebhook.includes('throw new Error("Could not update disputed payment safeguards.")') &&
    stripeWebhook.includes('console.error("Webhook payment dispute audit record failed.", auditError)') &&
    stripeWebhook.includes('throw new Error("Could not record disputed payment.")') &&
    !stripeWebhook.includes('firstError.message || "Could not update disputed payment safeguards."'),
});
checks.push({
  label: "payment webhook hides raw event status backend errors",
  ok:
    stripeWebhook.includes('console.error("Webhook event claim failed.", claimError)') &&
    stripeWebhook.includes('console.error("Webhook event completion failed.", completionError)') &&
    stripeWebhook.includes('console.error("Webhook event failure status could not be saved.", failureError)') &&
    stripeWebhook.includes('p_error: "Payment update processing failed."') &&
    stripeWebhook.includes('return stripeResponse("Could not process payment update.", 500)') &&
    !stripeWebhook.includes('claimError.message || "Could not process payment update."') &&
    !stripeWebhook.includes('completionError.message || "Could not complete payment update processing."') &&
    !stripeWebhook.includes('failureError.message || "Could not save payment update failure."'),
});
checks.push({
  label: "payment webhook hides raw connected-account backend errors",
  ok:
    stripeWebhook.includes('console.error("Webhook connected account lookup failed.", existingAccountError)') &&
    stripeWebhook.includes('throw new Error("Could not read Stripe Connect account.")') &&
    stripeWebhook.includes('console.error("Webhook connected account sync failed.", updateError)') &&
    stripeWebhook.includes('throw new Error("Could not sync Stripe Connect account.")') &&
    !stripeWebhook.includes('existingAccountError.message || "Could not read Stripe Connect account."') &&
    !stripeWebhook.includes('updateError.message || "Could not sync Stripe Connect account."'),
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
    bookingCheckout.includes("createBookingCheckoutSession(reservedBooking, returnTo)") &&
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
    adCheckout.includes('return_to=${encodeURIComponent(returnTo ?? "/account#advertising-settings")}') &&
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
    merchCheckoutSuccessPage.includes("This order will not move forward unless checkout is completed.") &&
    merchCheckoutSuccessPage.includes("use Account orders or Support with this order number") &&
    !merchCheckoutSuccessPage.includes("No fulfillment should start") &&
    !merchCheckoutSuccessPage.includes("payment records") &&
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
    accountPage.includes("Add fulfillment proof") &&
    accountPage.includes("Tracking number or handoff note") &&
    accountActions.includes("Add tracking, a tracking link, or a pickup/handoff note before marking Merch fulfilled.") &&
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
    accountActions.includes('console.error("Merch refund review request failed.", error)') &&
    accountActions.includes('"Could not request refund review. Please try again."') &&
    !accountActions.includes('accountPath(error.message || "Could not request refund review."') &&
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
    fees.includes("Transparent") &&
    fees.includes("TTC platform fee for") &&
    !fees.includes("test-mode") &&
    !fees.includes("test mode"),
});
checks.push({
  label: "production commerce gates stay visible before real payments",
  ok:
    adminPaymentsPage.includes("Production payment gates") &&
    adminPaymentsPage.includes("Payment mode preflight") &&
    adminPaymentsPage.includes("paymentModePreflightChecks") &&
    adminPaymentsPage.includes("expectedStripeLivemode()") &&
    adminPaymentsPage.includes("stripeSecretKeyLivemode()") &&
    adminPaymentsPage.includes("stripeCheckoutPreflight()") &&
    adminPaymentsPage.includes("stripeCheckoutModeMismatch()") &&
    adminPaymentsPage.includes("webhookSecretReady") &&
    adminPaymentsPage.includes("This panel shows") &&
    adminPaymentsPage.includes("never shows private key or webhook values") &&
    adminPaymentsPage.includes("Expected mode:") &&
    adminPaymentsPage.includes("Server key mode:") &&
    adminPaymentsPage.includes("Webhook signing secret is configured.") &&
    adminPaymentsPage.includes("Checkout is blocked until the expected mode and server key mode are both readable and matched.") &&
    adminPaymentsPage.includes("Checkout mode preflight is ready.") &&
    adminPaymentsPage.includes("Expected mode and server key mode do not match.") &&
    !stripeWebhook.includes("eventId: event.id") &&
    envExample.includes("STRIPE_EXPECTED_LIVEMODE=false") &&
    stripeServer.includes("process.env.STRIPE_EXPECTED_LIVEMODE") &&
    stripeServer.includes("process.env.STRIPE_SECRET_KEY") &&
    stripeServer.includes('secretKey?.startsWith("sk_live_")') &&
    stripeServer.includes('secretKey?.startsWith("sk_test_")') &&
    stripeWebhook.includes("expectedStripeLivemode() ?? stripeSecretKeyLivemode()") &&
    stripeWebhook.includes("function stripeLivemodeMatches") &&
    stripeWebhook.includes("event.livemode === expected") &&
    stripeWebhook.includes("Payment update ignored because livemode did not match.") &&
    stripeWebhook.includes("function checkoutSessionIsSettled") &&
    stripeWebhook.includes('event.type === "checkout.session.async_payment_succeeded"') &&
    stripeWebhook.includes('session.payment_status === "paid"') &&
    stripeWebhook.includes("Checkout session completed before payment settled.") &&
    paymentReadiness.includes("STRIPE_EXPECTED_LIVEMODE=true") &&
    paymentReadiness.includes("checkout.session.async_payment_succeeded") &&
    paymentReadiness.includes("charge.dispute.updated") &&
    paymentReadiness.includes("charge.dispute.funds_reinstated") &&
    paymentReadiness.includes("account.updated") &&
    adminPaymentsPage.includes("const paymentReconciliationChecks = [") &&
    adminPaymentsPage.includes("const sellerPayoutQaChecks = [") &&
    adminPaymentsPage.includes("API or browser-automation shortcuts do not count as a completed seller test") &&
    adminPaymentsPage.includes("Reconciliation checklist") &&
    adminPaymentsPage.includes("Seller payout QA pass") &&
    adminPaymentsPage.includes("verification-required payout notice") &&
    adminPaymentsPage.includes("the payout setup card shows complete") &&
    adminPaymentsPage.includes("seller payout filter") &&
    adminPaymentsPage.includes("Search the payment reference in Admin > Payments") &&
    adminPaymentsPage.includes("webhook receipt, payment audit row, user-facing status") &&
    adminPaymentsPage.includes("For delayed or async payment success, reconcile the success event before fulfillment, ad delivery, booking closeout, or payout release.") &&
    adminPaymentsPage.includes("fulfillment, ad delivery, booking deposit state") &&
    adminPaymentsPage.includes("bookingPaymentStatusLabel(status)") &&
    adminPaymentsPage.includes("titleCaseStatus(value)") &&
    adminPaymentsPage.includes("Choose a documented payout policy") &&
    adminPaymentsPage.includes("booking refund, cancellation, appointment-confirmation") &&
    adminPaymentsPage.includes("do not collect bank or card payout data in TTC forms") &&
    adminMerchPage.includes("Checkout and refund status stay review-controlled") &&
    adminMerchPage.includes("finish tax, shipping, fulfillment, payouts, and payment safety rules") &&
    paymentReadiness.includes("Direct API edits or browser-automation shortcuts are not a valid completion test") &&
    paymentReadiness.includes("Delayed or async payment success reconciliation captured before fulfillment, ad delivery, booking closeout, or seller payout release.") &&
    accountPage.includes("merchSellerReadinessItems") &&
    accountPage.includes("sellerProfileKind") &&
    accountPage.includes("Seller profile:") &&
    accountPage.includes("Company or organization seller profile") &&
    accountPage.includes("Seller payout path") &&
    accountPage.includes("Seller payout setup") &&
    accountPage.includes("secure setup flow") &&
    accountPage.includes("Payout status:") &&
    !accountPage.includes("Status note:") &&
    !accountPage.includes("sellerPayoutAccount.disabled_reason") &&
    !accountPage.includes("secure hosted setup flow") &&
    accountPage.includes("raw bank, routing, card, or debit payout numbers") &&
    accountPage.includes('action="/api/stripe/connect/onboarding"') &&
    accountPage.includes("Fulfillment gate") &&
    accountPage.includes("Refunds, disputes, and unusual order issues stay in private admin review") &&
    accountPage.includes("stay in private support review") &&
    privacyPage.includes("Checkout stays review-controlled") &&
    supportPage.includes("Merch checkout stays review-controlled"),
});
checks.push({
  label: "seller payout mode checks preserve signed-out login redirects",
  ok:
    stripeConnectOnboarding.indexOf("if (!claims?.sub)") <
      stripeConnectOnboarding.indexOf("if (!stripe || !admin || !checkoutPreflight.ready)") &&
    stripeConnectReturn.indexOf("if (!claims?.sub)") <
      stripeConnectReturn.indexOf("if (!stripe || !admin || !checkoutPreflight.ready)"),
});
checks.push({
  label: "seller payout readiness is isolated by payment mode",
  ok:
    stripeConnectLivemodeMigration.includes("add column if not exists livemode boolean") &&
    stripeConnectLivemodeMigration.includes("where livemode is null") &&
    stripeConnectLivemodeMigration.includes("stripe_connect_accounts_livemode_readiness_check") &&
    stripeConnectLivemodeMigration.includes("not charges_enabled") &&
    readFileSync("src/lib/stripe/connect.ts", "utf8").includes(
      "stripeConnectStatus(account: Stripe.Account, livemode: boolean)",
    ) &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes(
      "existingAccount?.livemode === livemode",
    ) &&
    stripeConnectReturn.includes('.eq("livemode", livemode)') &&
    stripeWebhook.includes("syncStripeConnectAccountFromWebhook(supabase, account, event.livemode)") &&
    stripeWebhook.includes('.eq("livemode", livemode)') &&
    merchCheckout.includes('.eq("livemode", checkoutPreflight.actual)') &&
    merchCheckout.includes("payoutAccount?.livemode === checkoutPreflight.actual") &&
    adminActions.includes('.eq("livemode", payoutMode.actual)') &&
    accountPage.includes('.eq("livemode", sellerPayoutMode.actual)') &&
    adminMerchPage.includes('.eq("livemode", sellerPayoutMode.actual)'),
});
checks.push({
  label: "Stripe Connect seller onboarding stays hosted and server-side",
  ok:
    accountPage.includes(".from(\"stripe_connect_accounts\")") &&
    accountPage.includes("sellerPayoutReady") &&
    accountPage.includes("sellerPayoutAccount") &&
    accountPage.includes("payoutSetupNotice") &&
    accountPage.includes("Merch and payouts") &&
    accountPage.includes("const accountMessage = safeStatusMessage(") &&
    accountPage.includes("Account update could not be shown. Please try again or contact Support.") &&
    accountPage.includes("accountMessage && !payoutSetupNotice") &&
    accountPage.includes("Operator code:") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("function payoutIssueCode") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes('"provider_error"') &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes('"unknown_error"') &&
    !readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("message ?? details.raw?.message") &&
    !readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("param ?? details.raw?.param") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("function sellerBusinessType") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes('profile.role === "owner"') &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes('profile.account_type === "vendor"') &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("payout_issue") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("setupStep = \"account_create\"") &&
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
    adminMerchPage.includes("Product title, order item, buyer, shipping name, or payment reference") &&
    !adminMerchPage.includes("customer email, shipping name, or payment ID") &&
    adminMerchPage.includes("title.ilike") &&
    adminMerchPage.includes('from("merch_order_items")') &&
    adminMerchPage.includes("title_snapshot") &&
    adminMerchPage.includes("uniqueMatchingOrderItemIds") &&
    adminMerchPage.includes("customer_email.ilike") &&
    adminMerchPage.includes("stripe_payment_intent_id.ilike") &&
    adminMerchPage.includes("Payment intent:") &&
    productPlan.includes("order item title, buyer, shipping, and payment-reference search") &&
    productPlan.includes("without prompting operators for raw customer email or payment ID wording"),
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
    adminActions.includes('console.error("Admin stale booking checkout reset failed.", error)') &&
    adminActions.includes('"Could not reset stale booking checkouts. Please try again."') &&
    adminActions.includes('console.error("Admin booking deposit lookup failed.", error)') &&
    adminActions.includes('"Booking deposit not found."') &&
    adminActions.includes('console.error("Admin booking deposit refund request failed.", error)') &&
    adminActions.includes('"Could not request booking refund. Please try again."') &&
    !adminActions.includes('error.message || "Could not reset stale booking checkouts."') &&
    !adminActions.includes('error?.message || "Booking deposit not found."') &&
    !adminActions.includes('error instanceof Error ? error.message : "Could not request booking refund."') &&
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
    adminPaymentsPage.includes("merch_refund_problem") &&
    adminPaymentsPage.includes("Merch refund needs review") &&
    adminPaymentsPage.includes("ad_refund_problem") &&
    adminPaymentsPage.includes("Ad refund needs review") &&
    adminPaymentsPage.includes("booking_refund_problem") &&
    adminPaymentsPage.includes("ad_campaign_credit_granted") &&
    adminPaymentsPage.includes("Ad credit granted") &&
    adminPaymentsPage.includes("user_ad_credit_granted") &&
    adminPaymentsPage.includes("User ad credit granted") &&
    adminPaymentsPage.includes("payment_disputes") &&
    adminPaymentsPage.includes("merch_payment_dispute") &&
    adminPaymentsPage.includes("ad_payment_dispute") &&
    adminPaymentsPage.includes("booking_payment_dispute") &&
    adminPaymentsPage.includes('"account.updated"') &&
    adminPaymentsPage.includes("Seller payout readiness updated") &&
    adminPaymentsPage.includes("charge.dispute.created") &&
    adminPaymentsPage.includes("charge.dispute.updated") &&
    adminPaymentsPage.includes("charge.dispute.closed") &&
    adminPaymentsPage.includes("charge.dispute.funds_withdrawn") &&
    adminPaymentsPage.includes("charge.dispute.funds_reinstated") &&
    adminPaymentsPage.includes("checkout.session.async_payment_succeeded") &&
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
    adminPaymentsPage.includes("Event, payment reference, booking title, target, or audit summary") &&
    !adminPaymentsPage.includes("Event ID, payment intent, booking title, target ID, or audit summary") &&
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
  label: "admin payment copy uses neutral review-tool wording",
  ok:
    adminActions.includes("payment review tools first") &&
    adminMerchPage.includes("payment review tools first") &&
    !adminActions.includes("payment dashboard") &&
    !adminMerchPage.includes("payment dashboard"),
});
checks.push({
  label: "public payment copy avoids collecting raw payout credentials",
  ok:
    !memberPaymentSafetySource.includes("bank account number") &&
    !memberPaymentSafetySource.includes("routing number") &&
    !memberPaymentSafetySource.includes("debit card number") &&
    !memberPaymentSafetySource.includes("card payout form") &&
    !memberPaymentSafetySource.includes("Stripe Connect") &&
    !memberPaymentSafetySource.includes("Connect Express") &&
    !memberPaymentSafetySource.includes("hosted onboarding") &&
    !memberPaymentSafetySource.includes("payment provider") &&
    adminPaymentsPage.includes("secure onboarding flow") &&
    accountPage.includes("secure setup flow") &&
    accountPage.includes("TTC stores payout readiness status only") &&
    !accountPage.includes("Stripe Connect") &&
    !accountPage.includes("Connect Express"),
});
checks.push({
  label: "payment readiness keeps private evidence repo-safe",
  ok:
    paymentReadiness.includes("Repo-safe summary fields are limited to release candidate") &&
    paymentReadiness.includes("webhook event coverage result") &&
    paymentReadiness.includes("Admin > Payments reconciliation result") &&
    paymentReadiness.includes("native checkout policy status") &&
    paymentReadiness.includes("pass/fail/blocker status") &&
    paymentReadiness.includes("Native checkout policy review must be dated") &&
    paymentReadiness.includes("July 21, 2026 review source set") &&
    paymentReadiness.includes("Apple App Review Guidelines and Google Play Payments policy") &&
    paymentReadiness.includes("Classify every paid native flow separately before promotion") &&
    paymentReadiness.includes("Merch physical goods") &&
    paymentReadiness.includes("accepted booking deposits or services") &&
    paymentReadiness.includes("prepaid ad campaigns") &&
    paymentReadiness.includes("any digital goods or digital services") &&
    paymentReadiness.includes("external payment-link or web-return behavior") &&
    paymentReadiness.includes("platform, build or track, flow name, source checked date") &&
    paymentReadiness.includes("Do not claim native checkout availability") &&
    paymentReadiness.includes("final legal review, and live-money payment evidence pack") &&
    paymentReadiness.includes("Keep payment intent IDs, checkout session IDs") &&
    paymentReadiness.includes("webhook event IDs, refund IDs, dispute IDs, seller account IDs") &&
    paymentReadiness.includes("buyer names, shipping addresses") &&
    paymentReadiness.includes("dashboard screenshots") &&
    paymentReadiness.includes("webhook secrets") &&
    paymentReadiness.includes("raw console exports in the private release handoff only"),
});
checks.push({
  label: "payment release verification gate is documented and wired",
  ok:
    packageJson.includes(
      '"verify:payment-release": "npm run lint && npm run build && npm run smoke:env && npm run smoke:payments && npm run smoke:payment-cutover && npm run smoke:pwa && npm run smoke:security && npm run smoke:handoff && npm run smoke:docs && npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:ios"',
    ) &&
    packageJson.includes('"smoke:payment-cutover": "node scripts/smoke-payment-cutover-evidence.mjs"') &&
    paymentReadiness.includes("npm.cmd run verify:payment-release") &&
    paymentReadiness.includes("npm.cmd run smoke:payment-cutover") &&
    paymentReadiness.includes("lint, production build, environment mode checks, payment flow guards, private cutover-evidence rows, app install and alert fallback guards, security headers, private handoff-template validation, readiness docs, public checkout/status routes, and Android-profile plus iOS-profile mobile checkout/account route smoke"),
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
