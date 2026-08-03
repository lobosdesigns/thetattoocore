import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const adCheckout = readFileSync("src/app/api/ads/checkout/route.ts", "utf8");
const adWebCheckout = readFileSync("src/lib/ads/web-checkout.ts", "utf8");
const adCreditPackages = readFileSync("src/lib/ads/credit-packages.ts", "utf8");
const commerceLaunch = readFileSync("src/lib/commerce-launch.ts", "utf8");
const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");
const merchCheckout = readFileSync("src/app/api/merch/checkout/route.ts", "utf8");
const normalizedMerchCheckout = merchCheckout.replace(/\r\n/g, "\n").trim();
const expectedMerchCheckoutTombstone = `export async function POST() {
  return Response.json(
    { error: "Merch checkout is unavailable." },
    { status: 410 },
  );
}`;
const envExample = readFileSync(".env.example", "utf8");
const stripeWebhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const stripeWebhookPost = stripeWebhook.slice(
  stripeWebhook.indexOf("export async function POST"),
);
const adClickRoute = readFileSync("src/app/api/ad-click/route.ts", "utf8");
const stripeServer = readFileSync("src/lib/stripe/server.ts", "utf8");
const stripeReleaseGates = readFileSync("src/lib/stripe/release-gates.ts", "utf8");
const stripeCheckoutSessions = readFileSync(
  "src/lib/stripe/checkout-session.ts",
  "utf8",
);
const platformCheckoutCreation = stripeCheckoutSessions.slice(
  stripeCheckoutSessions.indexOf("export async function createStripeCheckoutSession"),
  stripeCheckoutSessions.indexOf("export async function createConnectedCheckoutSession"),
);
const connectedCheckoutCreation = stripeCheckoutSessions.slice(
  stripeCheckoutSessions.indexOf("export async function createConnectedCheckoutSession"),
  stripeCheckoutSessions.indexOf("export async function expireStripeCheckoutSession"),
);
const platformExpirationRollback = stripeCheckoutSessions.slice(
  stripeCheckoutSessions.indexOf("export async function expireCheckoutSessionBeforeRollback"),
  stripeCheckoutSessions.indexOf(
    "export async function expireConnectedCheckoutSessionBeforeRollback",
  ),
);
const connectedExpirationRollback = stripeCheckoutSessions.slice(
  stripeCheckoutSessions.indexOf(
    "export async function expireConnectedCheckoutSessionBeforeRollback",
  ),
);
const stripeSecretFormat = readFileSync(
  "src/lib/stripe/secret-format.ts",
  "utf8",
);
const merchDetailPage = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const sellerCheckoutDialog = existsSync(
  "src/app/merch/seller-checkout-dialog.tsx",
)
  ? readFileSync("src/app/merch/seller-checkout-dialog.tsx", "utf8")
  : "";
const merchIndexPage = readFileSync("src/app/merch/page.tsx", "utf8");
const merchNotesMigration = readFileSync(
  "supabase/migrations/20260715235500_merch_fulfillment_return_notes.sql",
  "utf8",
);
const merchCheckoutSuccessPage = readFileSync("src/app/merch/checkout/success/page.tsx", "utf8");
const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const accountBookingSection = accountPage.slice(
  accountPage.indexOf('id="booking-settings"'),
  accountPage.indexOf('id="order-settings"'),
);
const accountMerchSection = accountPage.slice(
  accountPage.indexOf('id="order-settings"'),
  accountPage.indexOf('id="data-settings"'),
);
const messagesPage = readFileSync("src/app/messages/page.tsx", "utf8");
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
const merchProductStatusAction = adminActions.slice(
  adminActions.indexOf("export async function updateMerchProductStatus"),
  adminActions.indexOf("export async function updateMerchOrderStatus"),
);
const bookingCheckoutReconciliationAction = adminActions.slice(
  adminActions.indexOf("export async function reconcileBookingDepositCheckout"),
  adminActions.indexOf("export async function refundBookingDeposit"),
);
const bookingRefundAction = adminActions.slice(
  adminActions.indexOf("export async function refundBookingDeposit"),
);
const merchOrderStatusAction = adminActions.slice(
  adminActions.indexOf("export async function updateMerchOrderStatus"),
  adminActions.indexOf("export async function refundMerchOrder"),
);
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
const adminOperationIdempotencyMigration = readFileSync(
  "supabase/migrations/20260730123000_enforce_admin_operation_idempotency.sql",
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
const merchOrderUpdateRestrictionMigrationPath =
  "supabase/migrations/20260724191345_restrict_merch_order_updates.sql";
const merchOrderUpdateRestrictionMigration = existsSync(
  merchOrderUpdateRestrictionMigrationPath,
)
  ? readFileSync(merchOrderUpdateRestrictionMigrationPath, "utf8")
  : "";
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
const currentPaymentDashboardState =
  paymentReadiness.match(
    /^- July 24, 2026 current dashboard state:[^\r\n]*$/m,
  )?.[0] ?? "";
const packageJson = readFileSync("package.json", "utf8");
const packageScripts = JSON.parse(packageJson).scripts;
const envGuardSource = readFileSync("scripts/smoke-env-guards.mjs", "utf8");
const expectedPaymentSmoke =
  "npm run test:stripe-release-gates && npm run test:payment-webhook-config && npm run test:stripe-checkout-sessions && npm run test:booking-connected-checkout && npm run test:booking-lifecycle-db && npm run test:merch-checkout-route && npm run test:seller-checkout && npm run test:ad-credit-purchases && npm run test:ad-purchase-input-security && npm run test:ad-purchase-surfaces && node scripts/smoke-payment-guards.mjs";
const expectedSecuritySmoke =
  "npm run test:seller-checkout && npm run test:ad-purchase-input-security && npm run test:csp-headers && node --no-warnings --experimental-loader ./scripts/server-only-test-loader.mjs --experimental-default-type=module scripts/test-mail-redaction.mjs && node scripts/smoke-security-guards.mjs";
const compactWhitespace = (value) => value.replace(/\s+/g, " ").trim();
const envGuardResult = spawnSync(process.execPath, ["scripts/smoke-env-guards.mjs"], {
  encoding: "utf8",
});

function adminPaymentsCurrentMerchCopyIsSafe(source) {
  return (
    source.includes("Connected payment account updated") &&
    source.includes("Legacy TTC pending Merch checkouts over 24h") &&
    source.includes("seller-owned Payment Link") &&
    source.includes("seller handles payment, tax, shipping, returns, refunds, disputes, receipts, fulfillment, and purchase support") &&
    source.includes("No TTC platform fee applies to seller-owned Merch") &&
    !source.includes('return "Seller payout readiness updated"') &&
    !/>\s*Stale pending Merch checkouts over 24h\s*</.test(source) &&
    !source.includes("Enable TTC Merch checkout and seller payouts now")
  );
}

const injectedCurrentTtcMerchInstruction = adminPaymentsPage.replace(
  "const productionPaymentGates = [",
  'const productionPaymentGates = [\n  "Enable TTC Merch checkout and seller payouts now",',
);
const injectedUnqualifiedLegacyLabels = adminPaymentsPage
  .replace(
    "Connected payment account updated",
    "Seller payout readiness updated",
  )
  .replace(
    "Legacy TTC pending Merch checkouts over 24h",
    "Stale pending Merch checkouts over 24h",
  );

function legacyMerchRoutingReadiness(source, destinationChargesEnabled) {
  const expression = source.match(
    /function legacyMerchRoutingReady\(destinationChargesEnabled: boolean\) \{\s*return ([^;]+);\s*\}/,
  )?.[1];

  if (!expression || !/^[!()\sA-Za-z]+$/.test(expression)) return null;

  try {
    return Function(
      "destinationChargesEnabled",
      `"use strict"; return (${expression});`,
    )(destinationChargesEnabled);
  } catch {
    return null;
  }
}

function legacyMerchRoutingContractIsSafe(source) {
  return (
    legacyMerchRoutingReadiness(source, false) === true &&
    legacyMerchRoutingReadiness(source, true) === false
  );
}

const invertedLegacyMerchRoutingSource = adminPaymentsPage.replace(
  "return !destinationChargesEnabled;",
  "return destinationChargesEnabled;",
);
const paymentCutoverGate = readFileSync(
  "scripts/smoke-payment-cutover-evidence.mjs",
  "utf8",
);
const paymentCutoverGateTest = readFileSync(
  "scripts/test-payment-go-live-gate.mjs",
  "utf8",
);
const paymentGoLiveCommandTest = readFileSync(
  "scripts/test-payment-go-live-command.mjs",
  "utf8",
);
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
  "application_fee.created",
  "application_fee.refunded",
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

checks.push({
  label: "seller checkout and ad purchase contracts run in payment and security verification",
  ok:
    packageScripts["smoke:payments"] === expectedPaymentSmoke &&
    packageScripts["smoke:security"] === expectedSecuritySmoke &&
    packageScripts["smoke:payments"].split(" && ").filter(
      (step) => step === "npm run test:seller-checkout",
    ).length === 1 &&
    packageScripts["smoke:security"].split(" && ").filter(
      (step) => step === "npm run test:seller-checkout",
    ).length === 1 &&
    packageScripts["smoke:payments"].split(" && ").filter(
      (step) => step === "npm run test:ad-credit-purchases",
    ).length === 1 &&
    packageScripts["smoke:payments"].split(" && ").filter(
      (step) => step === "npm run test:ad-purchase-input-security",
    ).length === 1 &&
    packageScripts["smoke:security"].split(" && ").filter(
      (step) => step === "npm run test:ad-purchase-input-security",
    ).length === 1 &&
    packageScripts["smoke:payments"].split(" && ").filter(
      (step) => step === "npm run test:ad-purchase-surfaces",
    ).length === 1,
});

checks.push({
  label: "member Merch surfaces stay isolated from booking Connect and describe seller responsibility",
  ok:
    accountMerchSection.includes("Merch and orders") &&
    accountMerchSection.includes("historical TTC order support records") &&
    supportPage.includes("The seller processes payment and handles shipping, taxes, returns, refunds, disputes, and purchase support") &&
    privacyPage.includes("TTC stores the seller's listing link and acceptance record") &&
    helpCenter.includes('title: "Seller checkout and payment safety"') &&
    accountBookingSection.includes("Booking payment setup") &&
    accountBookingSection.includes('action="/api/stripe/connect/onboarding"') &&
    !accountMerchSection.includes("bookingConnectEnabled") &&
    !accountMerchSection.includes('action="/api/stripe/connect/onboarding"') &&
    !accountMerchSection.includes("stripe_connect_accounts") &&
    !accountPage.includes("Seller payout setup") &&
    !helpCenter.includes("TTC records a small platform fee where checkout is available"),
});

try {
  const centralGateIndex = indexOfOrFail(
    platformCheckoutCreation,
    "if (_options.checkoutCreationEnabled !== true)",
  );
  const centralRequestIndex = indexOfOrFail(
    platformCheckoutCreation,
    "return requestStripeCheckoutSession(_options)",
  );
  const connectedAccountGateIndex = indexOfOrFail(
    connectedCheckoutCreation,
    "if (!validConnectedAccountId(request.connectedAccountId))",
  );
  const connectedRequestIndex = indexOfOrFail(
    connectedCheckoutCreation,
    "return requestStripeCheckoutSession(request)",
  );

  checks.push({
    label: "checkout creation requires a literal enabled decision before network access",
    ok:
      stripeCheckoutSessions.includes("checkoutCreationEnabled: boolean") &&
      stripeCheckoutSessions.includes("async function requestStripeCheckoutSession") &&
      !stripeCheckoutSessions.includes(
        "export async function requestStripeCheckoutSession",
      ) &&
      stripeCheckoutSessions.includes("new StripeCheckoutRequestError(") &&
      stripeCheckoutSessions.includes('"Checkout could not open."') &&
      centralGateIndex < centralRequestIndex &&
      connectedAccountGateIndex < connectedRequestIndex,
  });
} catch (error) {
  checks.push({
    label: "checkout creation release gate structure",
    ok: false,
    message: error.message,
  });
}

try {
  const bookingGateIndex = indexOfOrFail(
    bookingCheckout,
    'stripeCheckoutCreationEnabled("booking")',
  );
  const bookingReservationIndex = indexOfOrFail(
    bookingCheckout,
    'rpc("reserve_booking_deposit_checkout"',
  );
  const bookingSessionIndex = indexOfOrFail(
    bookingCheckout,
    "session = await createBookingCheckoutSession",
  );
  const adSurfaceGateIndex = indexOfOrFail(
    adCheckout,
    "if (!adPurchaseSurfaceEnabled(surface))",
  );
  const adBodyGateIndex = indexOfOrFail(adCheckout, "if (!adCheckoutBodyAllowed(");
  const adFormIndex = indexOfOrFail(
    adCheckout,
    "await readBoundedAdCheckoutForm(request)",
  );
  const adAccountIndex = indexOfOrFail(adCheckout, "const supabase = await createClient()");

  checks.push({
    label: "booking and ad checkout gates precede creation side effects and reach the central helper",
    ok:
      bookingCheckout.includes('import { stripeCheckoutCreationEnabled } from "@/lib/stripe/release-gates"') &&
      bookingCheckout.includes("createConnectedCheckoutSession({") &&
      bookingCheckout.includes("stripeConnectWebhookSigningSecretConfigured()") &&
      bookingCheckout.includes("stripeWebhookSigningSecretConfigured()") &&
      bookingGateIndex < bookingReservationIndex &&
      bookingGateIndex < bookingSessionIndex &&
      adCheckout.includes("createStripeCheckoutSession({") &&
      adCheckout.includes("checkoutCreationEnabled: stripeCheckoutCreationMasterEnabled() &&") &&
      adCheckout.includes('adPurchaseSurfaceEnabled("web")') &&
      adSurfaceGateIndex < adBodyGateIndex &&
      adBodyGateIndex < adFormIndex &&
      adFormIndex < adAccountIndex,
  });
} catch (error) {
  checks.push({
    label: "booking and ad checkout route gate structure",
    ok: false,
    message: error.message,
  });
}

try {
  const onboardingAuthIndex = indexOfOrFail(stripeConnectOnboarding, "if (!claims?.sub)");
  const onboardingVerificationIndex = indexOfOrFail(
    stripeConnectOnboarding,
    "!isVerifiedProfessional(profile)",
  );
  const onboardingGateIndex = indexOfOrFail(
    stripeConnectOnboarding,
    "if (!stripeConnectOnboardingEnabled())",
  );
  const onboardingStripeIndex = indexOfOrFail(
    stripeConnectOnboarding,
    "const stripe = createStripeClient()",
  );
  const onboardingAdminIndex = indexOfOrFail(
    stripeConnectOnboarding,
    "const admin = createAdminClient()",
  );
  const onboardingAccountIndex = indexOfOrFail(
    stripeConnectOnboarding,
    "stripe.accounts.create",
  );
  const onboardingLinkIndex = indexOfOrFail(
    stripeConnectOnboarding,
    "stripe.accountLinks.create",
  );

  checks.push({
    label: "seller onboarding gate preserves auth and verification before remote setup",
    ok:
      stripeConnectOnboarding.includes(
        'import { stripeConnectOnboardingEnabled } from "@/lib/stripe/release-gates"',
      ) &&
      onboardingAuthIndex < onboardingGateIndex &&
      onboardingVerificationIndex < onboardingGateIndex &&
      onboardingGateIndex < onboardingStripeIndex &&
      onboardingGateIndex < onboardingAdminIndex &&
      onboardingGateIndex < onboardingAccountIndex &&
      onboardingGateIndex < onboardingLinkIndex,
  });
} catch (error) {
  checks.push({
    label: "seller onboarding release gate structure",
    ok: false,
    message: error.message,
  });
}

checks.push({
  label: "member payment actions and seller merch use matching independent release gates",
  ok:
    accountPage.includes('stripeCheckoutCreationEnabled("booking")') &&
    accountPage.includes("bookingCheckoutEnabled ? (") &&
    accountPage.includes(
      "const bookingConnectEnabled = stripeConnectOnboardingEnabled()",
    ) &&
    accountBookingSection.includes(
      "!bookingProviderPaymentReady && bookingConnectEnabled",
    ) &&
    accountBookingSection.includes('action="/api/stripe/connect/onboarding"') &&
    !accountMerchSection.includes("bookingConnectEnabled") &&
    !accountMerchSection.includes('action="/api/stripe/connect/onboarding"') &&
    !accountPage.includes("sellerPayoutOnboardingEnabled") &&
    messagesPage.includes('stripeCheckoutCreationEnabled("booking")') &&
    messagesPage.includes("bookingCheckoutEnabled={bookingCheckoutEnabled}") &&
    messagesPage.includes("canPay && bookingCheckoutEnabled ? (") &&
    merchDetailPage.includes("sellerCheckoutPurchaseReadiness") &&
    merchDetailPage.includes("sellerCheckoutLinksEnabled(process.env)") &&
    merchDetailPage.includes("checkoutReadiness.ready") &&
    accountPage.includes("Sellers add their own live Payment Link") &&
    !accountPage.includes("Payment setup is temporarily unavailable.") &&
    messagesPage.includes("Deposit payment is temporarily unavailable.") &&
    merchDetailPage.includes("Purchasing is temporarily unavailable for this product."),
});

checks.push({
  label: "payment completion processing remains outside creation release gates",
  ok:
    !stripeWebhook.includes("stripeCheckoutCreationEnabled") &&
    !stripeWebhook.includes("stripeConnectOnboardingEnabled") &&
    !stripeWebhook.includes("@/lib/stripe/release-gates") &&
    !stripeConnectReturn.includes("stripeCheckoutCreationEnabled") &&
    !stripeConnectReturn.includes("stripeConnectOnboardingEnabled") &&
    !stripeConnectReturn.includes("@/lib/stripe/release-gates"),
});

try {
  const campaignSpendIndex = indexOfOrFail(adCheckout, '"spend_ad_credit_for_campaign"');
  const packageIndex = indexOfOrFail(
    adCheckout,
    "adCreditPackageForProductId(intent.productId)",
  );
  const sessionIndex = indexOfOrFail(
    adCheckout,
    "session = await createAdCreditCheckoutSession",
  );
  const missingUrlIndex = indexOfOrFail(adCheckout, "if (!session.url)");
  const expireIndex = indexOfOrFail(adCheckout, "await expireStripeCheckoutSession({");

  checks.push({
    label: "ad campaign funding spends existing ledger credit without opening Stripe",
    ok:
      campaignSpendIndex < packageIndex &&
      adCheckout.includes('intent.kind === "campaign"') &&
      adCheckout.includes("Ad credit applied. Campaign payment is covered.") &&
      !adCheckout.includes('from("ad_campaigns")') &&
      !adCheckout.includes("reserve") &&
      !adCheckout.includes("stripe_checkout_session_id"),
  });
  checks.push({
    label: "web ad credit checkout uses only server-owned fixed packages",
    ok:
      packageIndex < sessionIndex &&
      adCreditPackages.includes('"ttc.adcredit.2500": { creditCents: 2500, webPriceCents: 2500 }') &&
      adCreditPackages.includes('"ttc.adcredit.5000": { creditCents: 5000, webPriceCents: 5000 }') &&
      adCreditPackages.includes('"ttc.adcredit.10000": { creditCents: 10000, webPriceCents: 10000 }') &&
      adCheckout.includes('"metadata[payment_kind]": "ad_credit_purchase"') &&
      adCheckout.includes('"line_items[0][price_data][unit_amount]": String(') &&
      adCheckout.includes("creditPackage.webPriceCents") &&
      !adCheckout.includes('formData.get("amount') &&
      !adCheckout.includes('formData.get("credit'),
  });
  checks.push({
    label: "URL-less ad credit checkout is expired without a local reservation",
    ok:
      sessionIndex < missingUrlIndex &&
      missingUrlIndex < expireIndex &&
      adCheckout.includes("return NextResponse.redirect(session.url, { status: 303 })"),
  });
} catch (error) {
  checks.push({
    label: "ad checkout flow structure",
    ok: false,
    message: error.message,
  });
}

checks.push({
  label: "ad credit accounting remains ready behind the launch gate",
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
      adCheckout.indexOf("session = await createAdCreditCheckoutSession") &&
    accountPage.includes(".from(\"ad_credit_ledger\")") &&
    accountPage.includes("Available ad credit") &&
    accountPage.includes("Purchased credit does") &&
    accountPage.includes("Promotional credit"),
});
try {
  const adCheckoutPost = adCheckout.slice(
    indexOfOrFail(adCheckout, "export async function POST"),
  );
  const gateIndex = indexOfOrFail(
    adCheckoutPost,
    "if (!adPurchaseSurfaceEnabled(surface))",
  );
  const guardedWork = [
    "adCheckoutBodyAllowed",
    "readBoundedAdCheckoutForm(request)",
    "createClient()",
    '"spend_ad_credit_for_campaign"',
    "createAdCreditCheckoutSession({",
  ];
  const accountPurchaseOptionsIndex = indexOfOrFail(
    accountPage,
    "<AdCreditPurchaseOptions",
  );

  checks.push({
    label: "ad purchases fail closed per surface before account, credit, or checkout work",
    ok:
      commerceLaunch.includes('android: "TTC_ANDROID_AD_PURCHASES_ENABLED"') &&
      commerceLaunch.includes('ios: "TTC_IOS_AD_PURCHASES_ENABLED"') &&
      commerceLaunch.includes('web: "TTC_WEB_AD_PURCHASES_ENABLED"') &&
      commerceLaunch.includes('return environment[gate] === "true"') &&
      adCheckout.includes(
        "adPurchaseSurfaceFromUserAgent",
      ) &&
      adCheckoutPost.includes(
        'return redirectWithMessage("Ad purchases are not available yet.");',
      ) &&
      guardedWork.every((snippet) => gateIndex < indexOfOrFail(adCheckoutPost, snippet)) &&
      accountPage.includes("adPurchaseSurfaceFromUserAgent") &&
      accountPage.includes("adPurchaseSurfaceEnabled(adPurchaseSurface)") &&
      accountPage.includes("Ad purchases are not available yet.") &&
      accountPage.indexOf("const adPurchaseEnabled") < accountPurchaseOptionsIndex &&
      helpCenter.includes(
        "They can be applied where ad purchasing is available.",
      ),
  });
} catch (error) {
  checks.push({
    label: "ad purchase launch gate structure",
    ok: false,
    message: error.message,
  });
}
checks.push({
  label: "payment inventory RPC execution stays limited to intended roles",
  ok:
    merchOrderStatusAction.includes("await requireAdmin()") &&
    merchOrderStatusAction.includes('"admin_update_merch_order_status"') &&
    !merchOrderStatusAction.includes('"cancel_unpaid_merch_order"') &&
    adminOperationIdempotencyMigration.includes(
      "create or replace function public.admin_update_merch_order_status",
    ) &&
    adminOperationIdempotencyMigration.includes(
      "not private.current_user_can_admin()",
    ) &&
    adminOperationIdempotencyMigration.includes(
      "grant execute on function public.admin_update_merch_order_status",
    ) &&
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
    paymentRpcAccessMigration.includes("to authenticated, service_role") &&
    merchOrderUpdateRestrictionMigration.includes(
      "revoke update on table public.merch_orders from public, anon, authenticated",
    ) &&
    merchOrderUpdateRestrictionMigration.includes(
      "grant update on table public.merch_orders to service_role",
    ),
});
checks.push({
  label: "historical Merch inventory reservations remain order-owned and webhook-reconciled",
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
    stripeWebhook.includes('.rpc("mark_problem_merch_order_for_checkout"') &&
    !stripeWebhook.includes('.rpc(\n        "release_merch_inventory_for_order"'),
});
checks.push({
  label: "admin Merch cancellation cannot release an active checkout",
  ok:
    merchOrderStatusAction.includes(
      'status === "cancelled" && order.status === "pending_checkout"',
    ) &&
    merchOrderStatusAction.includes(
      '"This order still has a checkout in progress. Reconcile the checkout before cancelling it."',
    ) &&
    merchOrderStatusAction.includes(
      'order.status !== "payment_failed"',
    ) &&
    merchOrderStatusAction.includes(
      'order.inventory_reservation_status !== "released"',
    ) &&
    merchOrderStatusAction.includes(
      '"Only failed orders can be cancelled here. Refund paid orders in the payment review tools first."',
    ) &&
    merchOrderStatusAction.indexOf('order.status === "payment_failed"') <
      merchOrderStatusAction.indexOf('"admin_update_merch_order_status"') &&
    adminOperationIdempotencyMigration.includes(
      "v_order.inventory_reservation_status <> 'released'",
    ) &&
    adminOperationIdempotencyMigration.includes(
      "from public.cancel_unpaid_merch_order(v_order.id, p_admin_note)",
    ) &&
    !merchOrderStatusAction.includes(
      'await supabase\n      .from("merch_orders")\n      .update',
    ) &&
    !merchOrderStatusAction.includes(
      '!["pending_checkout", "payment_failed"].includes(order.status)',
    ) &&
    adminMerchPage.includes('order.status === "payment_failed"') &&
    adminMerchPage.includes(
      'order.inventoryReservationStatus === "released"',
    ) &&
    adminMerchPage.includes("Checkout in progress must be reconciled before cancellation.") &&
    !adminMerchPage.includes(
      '["pending_checkout", "payment_failed", "cancelled"].includes',
    ) &&
    merchOrderUpdateRestrictionMigration.includes(
      "revoke update on table public.merch_orders from public, anon, authenticated",
    ),
});
checks.push({
  label: "direct seller payout release APIs stay disabled pending policy",
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
    currentPaymentDashboardState.includes("Production account activation and Connect configuration are complete") &&
    currentPaymentDashboardState.includes("both identity workflows") &&
    currentPaymentDashboardState.includes("owner-accepted platform agreement") &&
    currentPaymentDashboardState.includes("signed synthetic non-money event returned `200`") &&
    currentPaymentDashboardState.includes("server payment key remains in test mode") &&
    currentPaymentDashboardState.includes("expected live mode remains unset") &&
    currentPaymentDashboardState.includes("checkout and seller onboarding remain blocked") &&
    currentPaymentDashboardState.includes("no money moved") &&
    paymentReadiness.includes("STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false") &&
    paymentReadiness.includes("immediate transfer to the connected seller balance") &&
    currentPaymentDashboardState.includes("Live-money cutover remains blocked") &&
    currentPaymentDashboardState.includes("webhook mode/event proof") &&
    currentPaymentDashboardState.includes("Admin reconciliation") &&
    currentPaymentDashboardState.includes("controlled purchase/refund proof") &&
    currentPaymentDashboardState.includes("refund/dispute procedure") &&
    currentPaymentDashboardState.includes("payout gate") &&
    currentPaymentDashboardState.includes("native checkout policy review") &&
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
    appActions.includes("async function cleanupCreatedMerchProduct") &&
    appActions.includes("if (checkoutError || !checkoutProduct)") &&
    appActions.includes("seller_checkout_terms_accepted_at: null") &&
    appActions.includes("seller_checkout_terms_version: SELLER_CHECKOUT_TERMS_VERSION") &&
    appActions.includes(".delete()") &&
    appActions.includes('status: "archived"') &&
    appActions.includes("external_checkout_url: null") &&
    appActions.includes("if (cleanupError || !cleanedProduct)"),
});
checks.push({
  label: "Merch submit actions hide raw backend errors from member redirects",
  ok:
    appActions.includes('console.error("Merch product submit failed.")') &&
    appActions.includes('console.error("Merch checkout setup failed.")') &&
    appActions.includes('console.error("Merch pending-row cleanup failed.")') &&
    appActions.includes('"Could not submit Merch for review. Please try again."') &&
    appActions.includes('"Could not prepare seller checkout. Please try again."') &&
    appActions.includes('console.error("Merch media storage upload failed.")') &&
    appActions.includes('throw new Error("Could not upload Merch media.")') &&
    appActions.includes('console.error("Merch media upload failed.")') &&
    appActions.includes('"Could not upload Merch media. Please try again."') &&
    appActions.includes('console.error("Merch media attach failed.")') &&
    appActions.includes('"Media uploaded but could not attach to the Merch product. Please try again."') &&
    !appActions.includes('console.error("Merch product submit failed.",') &&
    !appActions.includes('console.error("Merch checkout setup failed.",') &&
    !appActions.includes('console.error("Merch pending-row cleanup failed.",') &&
    !appActions.includes('console.error("Merch media storage upload failed.",') &&
    !appActions.includes('console.error("Merch media upload failed.",') &&
    !appActions.includes('console.error("Merch media attach failed.",') &&
    !appActions.includes('error?.message || "Could not submit Merch for review."') &&
    !appActions.includes('error.message || "Could not upload Merch media."') &&
    !appActions.includes('error instanceof Error ? error.message : "Could not upload Merch media."') &&
    !appActions.includes('mediaError.message || "Media uploaded but could not attach to the Merch product."'),
});
checks.push({
  label: "Merch owner edit and archive actions hide raw backend errors from member redirects",
  ok:
    appActions.includes('console.error("Merch product edit lookup failed.")') &&
    appActions.includes('console.error("Merch product update failed.")') &&
    appActions.includes('console.error("Merch product archive lookup failed.", productError)') &&
    appActions.includes('console.error("Merch product archive failed.", error)') &&
    appActions.includes('"Could not update Merch product. It may be gone or owned by another account."') &&
    appActions.includes('"Could not archive Merch product. It may be gone or owned by another account."') &&
    !appActions.includes('console.error("Merch product edit lookup failed.",') &&
    !appActions.includes('console.error("Merch product update failed.",') &&
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
    (merchDetailPage.includes("const isOwner = Boolean(viewerId && viewerId === product.profiles?.id)") ||
      merchDetailPage.includes("const isOwner = Boolean(viewerId && viewerId === data.profiles?.id)")) &&
    merchDetailPage.includes("if (!isPublic && !isOwner)") &&
    merchDetailPage.includes("Seller-only product view") &&
    merchDetailPage.includes("Checkout and public discovery open only after admin approval") &&
    merchDetailPage.includes('href="/merch"'),
});
checks.push({
  label: "booking and ad checkout routes require private payment gates before payments",
  ok:
    adCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    adCheckout.includes("Ad credit checkout is temporarily unavailable. Please try again later.") &&
    adCheckout.includes("stripeCheckoutCreationMasterEnabled()") &&
    adCheckout.includes('adPurchaseSurfaceEnabled("web")') &&
    bookingCheckout.includes("stripeConnectWebhookSigningSecretConfigured()") &&
    bookingCheckout.includes("stripeWebhookSigningSecretConfigured()") &&
    bookingCheckout.includes("process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    bookingCheckout.includes("Booking checkout is temporarily unavailable. Please try again later."),
});
checks.push({
  label: "booking and ad checkout routes fail closed on strict payment mode preflight before reservations",
  ok:
    stripeServer.includes("export function stripeCheckoutModeMismatch") &&
    stripeServer.includes("export function stripeCheckoutPreflight") &&
    stripeServer.includes("expectedStripeLivemode()") &&
    stripeServer.includes("stripeSecretKeyLivemode()") &&
    stripeServer.includes('reason: "missing_expected_mode"') &&
    stripeServer.includes('reason: "missing_secret_key"') &&
    stripeServer.includes('reason: "unreadable_secret_key_mode"') &&
    stripeServer.includes('reason: "mode_mismatch"') &&
    stripeServer.includes('reason: "missing_webhook_signing_secret"') &&
    stripeServer.includes('reason: "invalid_webhook_signing_secret"') &&
    stripeServer.includes("stripeWebhookSigningSecretConfigured(webhookSecret)") &&
    stripeSecretFormat.includes(
      "const webhookSigningSecretPattern = /^whsec_[A-Za-z0-9]{16,}$/",
    ) &&
    adCheckout.includes("stripeCheckoutPreflight") &&
    bookingCheckout.includes("stripeCheckoutPreflight") &&
    adCheckout.includes("const checkoutPreflight = stripeCheckoutPreflight()") &&
    bookingCheckout.includes("const checkoutPreflight = stripeCheckoutPreflight()") &&
    adCheckout.includes("if (!checkoutPreflight.ready || !stripeCheckoutCreationMasterEnabled())") &&
    bookingCheckout.includes("if (!checkoutPreflight.ready)") &&
    adCheckout.includes('console.error("Ad credit checkout mode preflight failed.", checkoutPreflight)') &&
    bookingCheckout.includes('console.error("Booking checkout mode preflight failed.", checkoutPreflight)') &&
    adCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") <
      adCheckout.indexOf("session = await createAdCreditCheckoutSession") &&
    bookingCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") <
      bookingCheckout.indexOf("const { data: booking, error }") &&
    adCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") >
      adCheckout.indexOf("if (!claims?.sub)") &&
    bookingCheckout.indexOf("const checkoutPreflight = stripeCheckoutPreflight()") >
      bookingCheckout.indexOf("if (!claims?.sub)"),
});
checks.push({
  label: "booking and ad checkout creation failures log privately and show generic member copy",
  ok:
    adCheckout.includes('console.error("Ad credit checkout session creation failed.", error)') &&
    adCheckout.includes('"Ad credit checkout could not open. Please try again."') &&
    !adCheckout.includes("session.error?.message") &&
    !adCheckout.includes("throw new Error(message)") &&
    !adCheckout.includes("error.message") &&
    bookingCheckout.includes('console.error("Booking checkout session creation failed.", error)') &&
    bookingCheckout.includes('"Booking checkout could not open. Please try again."') &&
    !bookingCheckout.includes("session.error?.message") &&
    !bookingCheckout.includes("throw new Error(message)") &&
    !bookingCheckout.includes('error instanceof Error ? error.message : "Booking checkout could not open."') &&
    stripeCheckoutSessions.includes(': "Checkout could not open."') &&
    stripeCheckoutSessions.includes(
      '"Checkout status could not be confirmed."',
    ) &&
    stripeCheckoutSessions.includes("outcomeUnknown,") &&
    !stripeCheckoutSessions.includes("error.message"),
});
checks.push({
  label: "booking persistence and ad ledger failures do not redirect raw database errors",
  ok:
    !adCheckout.includes(".message ||") &&
    adCheckout.includes('console.error("Ad credit spend failed.", creditError)') &&
    adCheckout.includes('"Ad credit could not be applied. Please try again."') &&
    !adCheckout.includes("creditError.message") &&
    !bookingCheckout.includes(".message ||") &&
    bookingCheckout.includes('console.error("Booking deposit reservation failed.", reserveError)') &&
    bookingCheckout.includes('"The booking deposit could not be reserved before checkout. Please try again."') &&
    bookingCheckout.includes('console.error("Booking checkout session save failed.", updateError)') &&
    bookingCheckout.includes('"Checkout started, but the checkout could not be saved. Please contact support if this repeats."'),
});
checks.push({
  label: "booking reservations expire safely and ad credit checkout has no local reservation",
  ok:
    stripeCheckoutSessions.includes('"Idempotency-Key": _options.idempotencyKey') &&
    stripeCheckoutSessions.includes(
      "export async function expireCheckoutSessionBeforeRollback",
    ) &&
    stripeCheckoutSessions.includes(
      "export async function expireConnectedCheckoutSessionBeforeRollback",
    ) &&
    stripeCheckoutSessions.includes(
      "response.status === 409 || response.status >= 500",
    ) &&
    platformExpirationRollback.indexOf(
      "const expired = await expireStripeCheckoutSession(options)",
    ) <
      platformExpirationRollback.indexOf("await options.rollback()") &&
    connectedExpirationRollback.indexOf(
      "const expired = await expireConnectedStripeCheckoutSession(options)",
    ) < connectedExpirationRollback.indexOf("await options.rollback()") &&
    stripeCheckoutSessions.includes("rollback: () => Promise<boolean>") &&
    stripeCheckoutSessions.includes("return await options.rollback()") &&
    adCheckout.includes("expireStripeCheckoutSession({") &&
    !adCheckout.includes("expireCheckoutSessionBeforeRollback({") &&
    !adCheckout.includes("rollBackReservation") &&
    !adCheckout.includes("releasedCampaign") &&
    bookingCheckout.includes("expireConnectedCheckoutSessionBeforeRollback({") &&
    bookingCheckout.includes(
      "connectedAccountId: connectedAccount.stripe_account_id",
    ) &&
    bookingCheckout.includes("rollback: rollBackReservation") &&
    bookingCheckout.includes('.select("id")') &&
    bookingCheckout.includes("return Boolean(releasedBooking)") &&
    paymentReadiness.includes(
      "Checkout Session creation uses a per-attempt idempotency key and one bounded network retry.",
    ) &&
    paymentReadiness.includes(
      "keeps the reservation held for operator reconciliation instead of exposing a payable orphan",
    ) &&
    !bookingCheckout.includes(
      'console.error("Booking checkout session save failed.", updateError);\n    await rollBackReservation();',
    ) &&
    packageJson.includes('"test:stripe-checkout-sessions"') &&
    packageScripts["smoke:payments"] === expectedPaymentSmoke,
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
    bookingCheckout.includes("session = await createBookingCheckoutSession(") &&
    bookingCheckout.indexOf('.rpc("reserve_booking_deposit_checkout"') <
      bookingCheckout.indexOf("session = await createBookingCheckoutSession(") &&
    !bookingCheckout.includes('.from("booking_requests")\n    .update({\n      payment_status: "checkout_started"'),
});
checks.push({
  label: "booking payment webhooks fail closed across reconciliation races",
  ok:
    stripeWebhook.includes(
      'stripe_checkout_session_id: status === "paid" ? session.id : null',
    ) &&
    stripeWebhook.includes("const transitionedBookings = bookings ?? []") &&
    stripeWebhook.includes(
      'status === "paid" && transitionedBookings.length === 0',
    ) &&
    stripeWebhook.includes(
      '.eq("stripe_checkout_session_id", session.id)',
    ) &&
    stripeWebhook.includes('.eq("payment_status", "paid")') &&
    stripeWebhook.includes('.eq("status", "deposit_paid")') &&
    stripeWebhook.includes(
      '.eq("stripe_payment_intent_id", paymentIntentId)',
    ) &&
    stripeWebhook.includes("bookingPaidTransitionDecision({") &&
    stripeWebhook.includes(
      'if (paidTransitionDecision.action === "retry")',
    ) &&
    stripeCheckoutSessions.includes(
      "export function bookingPaidTransitionDecision",
    ) &&
    stripeWebhook.includes(
      '"Webhook paid booking transition matched no held or already-paid booking."',
    ) &&
    stripeWebhook.includes(
      'throw new Error("Could not confirm booking deposit paid transition.")',
    ) &&
    stripeWebhook.includes("for (const booking of transitionedBookings)"),
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
    stripeWebhook.includes("accountScope === \"platform\" ? {} : { stripeAccount: accountScope }") &&
    stripeWebhook.includes("stripe_charge_id: disputeChargeId(dispute)") &&
    stripeWebhook.includes("recordPaymentDispute({") &&
    stripeWebhook.includes("accountScope,") &&
    stripeWebhook.includes("stripe_event_type: eventType") &&
    stripeWebhook.includes("payment_intent_id: paymentIntentId") &&
    stripeWebhook.includes('event.type === "account.updated"') &&
    stripeWebhook.includes("syncStripeConnectAccountFromWebhook") &&
    stripeWebhook.includes('from("stripe_connect_accounts")') &&
    stripeWebhook.includes("stripeConnectStatus(account, livemode)") &&
    stripeWebhookPost.indexOf("Missing payment verification.") <
      stripeWebhookPost.indexOf("await verifyStripeWebhookEvent({"),
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
  label: "admin payments exposes webhook processing health without raw errors",
  ok:
    adminPaymentsPage.includes(
      "event_id, event_type, account_scope, received_at, status, attempt_count, claimed_at, completed_at",
    ) &&
    adminPaymentsPage.includes('.eq("status", "failed")') &&
    adminPaymentsPage.includes('.eq("status", "processing")') &&
    adminPaymentsPage.includes('.lt("claimed_at", staleWebhookClaimedBefore)') &&
    adminPaymentsPage.includes("Date.now() - 10 * 60 * 1000") &&
    adminPaymentsPage.includes("Boolean(failedWebhookEventCount)") &&
    adminPaymentsPage.includes("Boolean(staleProcessingWebhookEventCount)") &&
    adminPaymentsPage.includes('return "Processed"') &&
    adminPaymentsPage.includes('return "Failed"') &&
    adminPaymentsPage.includes('return "Retrying"') &&
    adminPaymentsPage.includes("Attempt {event.attempt_count}") &&
    adminPaymentsPage.includes("paymentEventScopeLabel(event.account_scope)") &&
    adminPaymentsPage.includes('key={`${event.event_id}:${event.account_scope}`}') &&
    adminPaymentsPage.includes("Claimed {formatDateTime(event.claimed_at)}") &&
    adminPaymentsPage.includes(
      "Completed {formatDateTime(event.completed_at)}",
    ) &&
    adminPaymentsPage.includes("Failed webhook events:") &&
    adminPaymentsPage.includes("Webhook processing over 10m:") &&
    !adminPaymentsPage.includes("last_error"),
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
      "Booking deposit refund request recorded. Final payment status will update shortly.",
    ) &&
    !adminActions.includes("The payment processor will update the final status shortly.") &&
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
    bookingCheckout.includes("createBookingCheckoutSession(") &&
    bookingCheckout.includes('"success_url": successUrl') &&
      bookingCheckout.includes('"cancel_url": cancelUrl'),
});
checks.push({
  label: "ad checkout preserves only safe internal return paths",
  ok:
    adWebCheckout.includes("export function safeAdCheckoutReturnPath") &&
    adWebCheckout.includes('text.startsWith("/")') &&
    adWebCheckout.includes('text.startsWith("//")') &&
    adWebCheckout.includes("text.length > 240") &&
    adWebCheckout.includes("\\u0000-\\u001f\\u007f\\\\") &&
    adCheckout.includes("function pathWithMessage") &&
    adCheckout.includes("const returnUrl = new URL(returnTo, siteUrl)") &&
    adCheckout.includes('returnUrl.searchParams.set("message", message)') &&
    adCheckout.includes("`${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`") &&
    adCheckout.includes("await readBoundedAdCheckoutForm(request)") &&
    adCheckout.includes("parseAdCheckoutForm(formData)") &&
    !adCheckout.includes("request.formData()") &&
    adCheckout.includes("intent.returnTo") &&
    adCheckout.includes("success_url: successUrl") &&
    adCheckout.includes("cancel_url: cancelUrl"),
});
checks.push({
  label: "Merch checkout route is the exact side-effect-free 410 boundary",
  ok: normalizedMerchCheckout === expectedMerchCheckoutTombstone,
});
checks.push({
  label: "merch detail has no TTC fee or internal checkout form",
  ok:
    merchDetailPage.includes("<SellerCheckoutDialog") &&
    !merchDetailPage.includes('/api/merch/checkout') &&
    !merchDetailPage.includes('name="quantity"') &&
    !merchDetailPage.includes("calculatePlatformFeeCents") &&
    !merchDetailPage.includes("TTC platform fee") &&
    !merchDetailPage.includes("Estimated fee on one item"),
});
checks.push({
  label: "historical Merch checkout events retain shared webhook routing",
  ok:
    stripeWebhook.includes("function isMerchCheckoutSession") &&
    stripeWebhook.includes('payment_kind === "merch_order"') &&
    stripeWebhook.includes("Unknown checkout session payment type."),
});
checks.push({
  label: "historical TTC Merch receipt and admin views remain available",
  ok:
    merchCheckoutSuccessPage.includes('.from("merch_orders")') &&
    merchCheckoutSuccessPage.includes('.eq("stripe_checkout_session_id", sessionId)') &&
    merchCheckoutSuccessPage.includes('.eq("buyer_id", claims.sub)') &&
    adminMerchPage.includes('.from("merch_orders")') &&
    adminMerchPage.includes("Historical TTC Orders") &&
    adminMerchPage.includes("updateMerchOrderStatus") &&
    adminMerchPage.includes("refundMerchOrder"),
});
checks.push({
  label: "historical buyer receipt is printable without a false no-order success state",
  ok:
    merchCheckoutSuccessPage.includes("<PrintReceiptButton />") &&
    merchCheckoutSuccessPage.includes('href="/merch"') &&
    merchCheckoutSuccessPage.includes("ttc-print-receipt") &&
    merchCheckoutSuccessPage.includes("ttc-print-hidden") &&
    merchCheckoutSuccessPage.includes("This order will not move forward unless checkout is completed.") &&
    merchCheckoutSuccessPage.includes("use Account orders or Support with this order number") &&
    merchCheckoutSuccessPage.includes('heading: "No TTC order was found"') &&
    merchCheckoutSuccessPage.includes("Seller-owned checkout purchases are confirmed and supported by the seller using the seller's receipt.") &&
    merchCheckoutSuccessPage.includes("const copy = order") &&
    merchCheckoutSuccessPage.includes("? statusCopy(order.status)") &&
    !merchCheckoutSuccessPage.includes("statusCopy(order?.status)") &&
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
  label: "merch refund reviews and guarded full refunds stay admin-controlled",
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
    paymentReadiness.includes("buyer refund-review requests") &&
    adminActions.includes("export async function refundMerchOrder") &&
    adminActions.includes('confirm !== "refund"') &&
    adminActions.includes('profile?.role !== "admin" && profile?.role !== "owner"') &&
    adminActions.includes('["paid", "fulfilled"].includes(order.status)') &&
    adminActions.includes("order.payment_dispute_hold") &&
    adminActions.includes("stripeCheckoutPreflight()") &&
    adminActions.includes('expand: ["latest_charge"]') &&
    adminActions.includes('paymentIntent.metadata?.payment_kind !== "merch_order"') &&
    adminActions.includes("stripe.refunds.list") &&
    adminActions.includes('refund.metadata?.refund_kind === "merch_order_full"') &&
    adminActions.includes('const merchRefundRequestKeyVersion = "merch-full-refund-v1"') &&
    adminActions.includes("refundParams.reverse_transfer = true") &&
    adminActions.includes("refundParams.refund_application_fee = refundApplicationFee") &&
    adminActions.includes("idempotencyKey: merchRefundRequestKey") &&
    adminActions.includes('event_type: "refund_merch_order_requested"') &&
    !adminActions.includes('status: "refunded"') &&
    adminMerchPage.includes("refundMerchOrder") &&
    adminMerchPage.includes("payment_dispute_hold") &&
    adminMerchPage.includes("Refund full order") &&
    adminPaymentsPage.includes('"refund_merch_order_requested"') &&
    adminPaymentsPage.includes("Merch refund requested") &&
    stripeWebhook.includes('event.type === "charge.refunded"') &&
    stripeWebhook.includes(
      "await markRefunded({ accountScope, charge, eventId: event.id, stripe })",
    ) &&
    paymentReadiness.includes("destination-charge refunds reverse the seller transfer") &&
    paymentReadiness.includes("signed payment webhook remains the order-status authority"),
});
checks.push({
  label: "merch products collect and display fulfillment and return notes",
  ok:
    merchNotesMigration.includes("add column if not exists fulfillment_notes") &&
    merchNotesMigration.includes("add column if not exists return_policy") &&
    appActions.includes("fulfillment_notes: fulfillmentNotes || null") &&
    appActions.includes("return_policy: returnPolicy || null") &&
    appActions.includes("Add the city and state/region this Merch ships from.") &&
    (appActions.match(/if \(fulfillmentNotes\.length < 10\)/g) ?? []).length === 2 &&
    (appActions.match(/if \(returnPolicy\.length < 10\)/g) ?? []).length === 2 &&
    !appActions.includes("if (shippingRequired && fulfillmentNotes.length < 10)") &&
    appActions.includes("Add fulfillment notes for Merch, including timing, shipping, or pickup details.") &&
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
  label: "seller checkout activation requires complete product readiness",
  ok:
    merchProductStatusAction.includes("sellerCheckoutSubmissionReadiness") &&
    merchProductStatusAction.includes("inventoryQuantity: product.inventory_quantity") &&
    merchProductStatusAction.includes("inventoryReserved: product.inventory_reserved") &&
    merchProductStatusAction.includes("fulfillmentNotes: product.fulfillment_notes") &&
    merchProductStatusAction.includes("returnPolicy: product.return_policy") &&
    merchProductStatusAction.includes("shippingRequired: product.shipping_required") &&
    merchProductStatusAction.includes("shipsFromCity: product.ships_from_city") &&
    merchProductStatusAction.includes("shipsFromRegion: product.ships_from_region") &&
    adminMerchPage.includes("sellerCheckoutSubmissionReadiness") &&
    adminMerchPage.includes("Fulfillment, returns, or ship-from details required") &&
    adminMerchPage.includes("Available inventory required") &&
    merchDetailPage.includes("sellerCheckoutPurchaseReadiness") &&
    merchDetailPage.includes("fulfillmentNotes: product.fulfillment_notes") &&
    merchDetailPage.includes("returnPolicy: product.return_policy") &&
    merchDetailPage.includes("shippingRequired: product.shipping_required"),
});
checks.push({
  label: "merch detail discloses seller checkout without TTC payment claims",
  ok:
    merchDetailPage.includes("<SellerCheckoutDialog") &&
    merchDetailPage.includes("checkoutReadiness.ready") &&
    sellerCheckoutDialog.includes("{sellerName}") &&
    sellerCheckoutDialog.includes("payment") &&
    sellerCheckoutDialog.includes("tax") &&
    sellerCheckoutDialog.includes("shipping") &&
    sellerCheckoutDialog.includes("returns") &&
    sellerCheckoutDialog.includes("refunds") &&
    sellerCheckoutDialog.includes("disputes") &&
    sellerCheckoutDialog.includes("purchase support") &&
    sellerCheckoutDialog.includes("href={checkoutUrl}") &&
    sellerCheckoutDialog.includes('target="_blank"') &&
    sellerCheckoutDialog.includes('rel="ugc nofollow noopener noreferrer"') &&
    !merchDetailPage.includes('action="/api/merch/checkout"') &&
    !merchDetailPage.includes("Sign in to buy") &&
    !merchDetailPage.includes("calculatePlatformFeeCents") &&
    !merchDetailPage.includes("Estimated fee on one item") &&
    !merchDetailPage.includes("Shipping address is collected during checkout") &&
    merchDetailPage.includes('href="/help/merch-products-orders"'),
});
checks.push({
  label: "booking fee stays at launch rate while new ad credit has no added fee",
  ok:
    fees.includes("export const platformFeeRate = 0.02") &&
    fees.includes('export const platformFeePercentLabel = "2%"') &&
    fees.includes("TTC application fee deducted from provider funds for booking deposits") &&
    fees.includes("No additional TTC platform fee applies to ad credit purchases.") &&
    fees.includes("TTC platform fee for historical Merch checkout") &&
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
    adminPaymentsPage.includes("platformWebhookSecretReady") &&
    adminPaymentsPage.includes("connectWebhookSecretReady") &&
    adminPaymentsPage.includes("This panel shows") &&
    adminPaymentsPage.includes("never shows private key or webhook values") &&
    adminPaymentsPage.includes("Expected mode:") &&
    adminPaymentsPage.includes("Server key mode:") &&
    adminPaymentsPage.includes("stripeWebhookSigningSecretConfigured()") &&
    adminPaymentsPage.includes("Account webhook signing format is configured; live event proof is still required.") &&
    adminPaymentsPage.includes("Connected accounts webhook signing format is configured; live event proof is still required.") &&
    adminPaymentsPage.includes("Checkout is blocked until mode, server key, and webhook signing checks all pass.") &&
    adminPaymentsPage.includes("Checkout mode preflight is ready.") &&
    adminPaymentsPage.includes("Expected mode and server key mode do not match.") &&
    stripeWebhook.includes("eventId: event.id") &&
    envExample.includes("STRIPE_EXPECTED_LIVEMODE=false") &&
    stripeServer.includes("process.env.STRIPE_EXPECTED_LIVEMODE") &&
    stripeServer.includes("process.env.STRIPE_SECRET_KEY") &&
    stripeServer.includes('import { stripeKeyMode } from "./release-gates"') &&
    stripeServer.includes("const mode = stripeKeyMode(secretKey)") &&
    stripeWebhook.includes("expectedStripeLivemode() ?? stripeSecretKeyLivemode()") &&
    stripeWebhook.includes(
      "stripeWebhookSigningSecretConfigured(process.env.STRIPE_WEBHOOK_SECRET)",
    ) &&
    stripeWebhook.includes("process.env.STRIPE_CONNECT_WEBHOOK_SECRET") &&
    stripeWebhook.includes("function stripeLivemodeMatches") &&
    stripeWebhook.includes("return expected !== null && event.livemode === expected;") &&
    !stripeWebhook.includes("expected === null || event.livemode === expected") &&
    stripeWebhook.includes("Payment update ignored because livemode did not match.") &&
    stripeWebhook.includes("function checkoutSessionIsSettled") &&
    stripeWebhook.includes('event.type === "checkout.session.async_payment_succeeded"') &&
    stripeWebhook.includes('session.payment_status === "paid"') &&
    stripeWebhook.includes("Checkout session completed before payment settled.") &&
    paymentReadiness.includes("STRIPE_EXPECTED_LIVEMODE=true") &&
    paymentReadiness.includes("webhooks fail closed") &&
    paymentReadiness.includes("checkout.session.async_payment_succeeded") &&
    paymentReadiness.includes("charge.dispute.updated") &&
    paymentReadiness.includes("charge.dispute.funds_reinstated") &&
    paymentReadiness.includes("account.updated") &&
    packageJson.includes('"test:payment-webhook-config"') &&
    packageScripts["smoke:payments"] === expectedPaymentSmoke &&
    adminPaymentsPage.includes("const paymentReconciliationChecks = [") &&
    adminPaymentsPage.includes("const sellerPayoutQaChecks = [") &&
    adminPaymentsPage.includes("Legacy seller payout evidence") &&
    adminPaymentsPage.includes("Treat existing Connect status, onboarding events, and payout records as legacy TTC checkout evidence only.") &&
    adminPaymentsPage.includes("Do not direct a seller to the retired TTC payout setup flow for seller-owned Payment Links.") &&
    adminPaymentsPage.includes("Confirm all legacy Merch and Connect release switches remain blocked before seller-link QA.") &&
    adminPaymentsPage.includes("Reconciliation checklist") &&
    adminPaymentsPage.includes("Search the payment reference in Admin > Payments") &&
    adminPaymentsPage.includes("webhook receipt, payment audit row, user-facing status") &&
    adminPaymentsPage.includes("For delayed or async payment success, reconcile the success event before fulfillment, ad delivery, booking closeout, or legacy TTC seller payout review.") &&
    adminPaymentsPage.includes("fulfillment, ad delivery, booking deposit state") &&
    adminPaymentsPage.includes("bookingPaymentStatusLabel(status)") &&
    adminPaymentsPage.includes("titleCaseStatus(value)") &&
    adminPaymentsPage.includes("Legacy TTC seller payout review") &&
    adminPaymentsPage.includes("booking refund, cancellation, appointment-confirmation") &&
    adminPaymentsPage.includes("do not collect bank or card payout data in TTC forms") &&
    adminMerchPage.includes("Seller-owned checkout activation requires inventory") &&
    adminMerchPage.includes("Sellers provide their own Stripe Payment Link") &&
    paymentReadiness.includes("Direct API edits or browser-automation shortcuts are not a valid completion test") &&
    paymentReadiness.includes("Delayed or async payment success reconciliation captured before fulfillment, ad delivery, booking closeout, or seller payout release.") &&
    accountPage.includes("merchSellerReadinessItems") &&
    accountPage.includes("Merch and orders") &&
    accountPage.includes("historical TTC order support records") &&
    accountPage.includes("The seller processes payment and handles shipping, taxes, returns, refunds, disputes, and purchase support.") &&
    !accountPage.includes("sellerProfileKind") &&
    !accountPage.includes("Seller payout path") &&
    !accountPage.includes("Seller payout setup") &&
    !accountPage.includes("Payout status:") &&
    accountBookingSection.includes("Booking payment setup") &&
    accountBookingSection.includes('action="/api/stripe/connect/onboarding"') &&
    !accountMerchSection.includes("stripe_connect_accounts") &&
    !accountPage.includes("raw bank, routing, card, or debit payout numbers") &&
    !accountMerchSection.includes('action="/api/stripe/connect/onboarding"') &&
    accountPage.includes("TTC reviews the listing and handles listing-safety reports") &&
    privacyPage.includes("does not receive new external purchase card, shipping, receipt, or transaction data") &&
    supportPage.includes("Contact the seller for receipts, delivery, returns, or payment questions"),
});
checks.push({
  label: "seller payout mode checks preserve signed-out login redirects",
  ok:
    stripeConnectOnboarding.indexOf("if (!claims?.sub)") <
      stripeConnectOnboarding.indexOf(
        "if (!stripe || !admin || !checkoutPreflight.ready || !connectWebhookReady)",
      ) &&
    stripeConnectReturn.indexOf("if (!claims?.sub)") <
      stripeConnectReturn.indexOf("if (!stripe || !admin || !checkoutPreflight.ready)"),
});
checks.push({
  label: "booking Connect readiness stays mode-isolated outside Merch moderation",
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
    !accountPage.includes("sellerPayoutMode") &&
    accountPage.includes('from("stripe_connect_accounts")') &&
    accountBookingSection.includes("Booking payment setup") &&
    !accountMerchSection.includes("stripe_connect_accounts") &&
    !merchProductStatusAction.includes("stripe_connect_accounts") &&
    !merchProductStatusAction.includes("payoutMode") &&
    !adminMerchPage.includes("stripe_connect_accounts") &&
    !adminMerchPage.includes("sellerPayoutMode"),
});
checks.push({
  label: "Stripe Connect booking onboarding stays hosted and server-side",
  ok:
    accountPage.includes('.from("stripe_connect_accounts")') &&
    accountBookingSection.includes("Booking payment setup") &&
    accountBookingSection.includes('action="/api/stripe/connect/onboarding"') &&
    !accountMerchSection.includes('action="/api/stripe/connect/onboarding"') &&
    !accountPage.includes("sellerPayoutReady") &&
    !accountPage.includes("sellerPayoutAccount") &&
    !accountPage.includes("payoutSetupNotice") &&
    !accountPage.includes("Merch and payouts") &&
    !accountPage.includes("payout_status") &&
    !accountPage.includes("payout_issue") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("function payoutIssueCode") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes('"provider_error"') &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes('"unknown_error"') &&
    !readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("message ?? details.raw?.message") &&
    !readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("param ?? details.raw?.param") &&
    !stripeConnectOnboarding.includes("function sellerBusinessType") &&
    !stripeConnectOnboarding.includes('profile.role === "owner"') &&
    !stripeConnectOnboarding.includes('profile.account_type === "vendor"') &&
    stripeConnectOnboarding.includes(
      '!["artist", "studio"].includes(profile.account_type)',
    ) &&
    stripeConnectOnboarding.includes("!isVerifiedProfessional(profile)") &&
    stripeConnectOnboarding.includes(
      "Tattoo appointment deposits and in-person body-art services.",
    ) &&
    stripeConnectOnboarding.includes("card_payments: { requested: true }") &&
    stripeConnectOnboarding.includes("transfers: { requested: true }") &&
    stripeConnectOnboarding.includes(
      "stripeConnectWebhookSigningSecretConfigured",
    ) &&
    stripeConnectOnboarding.indexOf("!connectWebhookReady") <
      stripeConnectOnboarding.indexOf("stripe.accounts.create") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("payout_issue") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("setupStep = \"account_create\"") &&
    !accountPage.includes("Continue payout setup") &&
    !accountPage.includes("Start payout setup") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("payout_status") &&
    stripeConnectReturn.includes("payout_status") &&
    stripeConnectReturn.includes('"complete"') &&
    stripeConnectReturn.includes('"needs_more"') &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("stripe.accounts.create") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("stripe.accountLinks.create") &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes("type: \"account_onboarding\"") &&
    stripeConnectReturn.includes("stripe.accounts.retrieve") &&
    stripeConnectReturn.includes(
      "More details may still be needed before deposits are active.",
    ) &&
    !stripeConnectReturn.includes("before payouts are active") &&
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
      'console.error("Booking payment onboarding failed.", error)',
    ) &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes(
      'console.error("Booking payment account lookup failed.", existingAccountError)',
    ) &&
    readFileSync("src/app/api/stripe/connect/onboarding/route.ts", "utf8").includes(
      "Booking payment setup is temporarily unavailable. Please try again.",
    ) &&
    stripeConnectReturn.includes('console.error("Booking payment return check failed.", error)') &&
    stripeConnectReturn.includes(
      'console.error("Booking payment return lookup failed.", connectAccountError)',
    ) &&
    stripeConnectReturn.includes(
      "Booking payment setup could not be checked. Please try again.",
    ),
});
checks.push({
  label: "admin Merch review shows protected seller checkout readiness",
  ok:
    adminMerchPage.includes("createAdminClient()") &&
    adminMerchPage.includes(
      '"id, external_checkout_url, seller_checkout_terms_version, seller_checkout_terms_accepted_at"',
    ) &&
    adminMerchPage.includes('.in("id", productIds)') &&
    adminMerchPage.includes("sellerCheckoutSubmissionReadiness") &&
    adminMerchPage.includes("Seller checkout ready") &&
    adminMerchPage.includes("Review Stripe Payment Link") &&
    adminMerchPage.includes('target="_blank"') &&
    adminMerchPage.includes('rel="ugc nofollow noopener noreferrer"') &&
    !adminMerchPage.includes("SellerPayoutFilter") &&
    !adminMerchPage.includes("seller_payout"),
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
  label: "admin Merch activation requires seller checkout readiness",
  ok:
    merchProductStatusAction.includes("sellerCheckoutSubmissionReadiness") &&
    merchProductStatusAction.includes("Official TTC Merch cannot be activated in this release.") &&
    merchProductStatusAction.includes("external_checkout_url") &&
    merchProductStatusAction.includes("seller_checkout_terms_version") &&
    merchProductStatusAction.includes("seller_checkout_terms_accepted_at") &&
    merchProductStatusAction.includes('.eq("id", product.id)') &&
    merchProductStatusAction.includes('.eq("seller_id", product.seller_id)') &&
    merchProductStatusAction.includes('product.status !== "approved"') &&
    merchProductStatusAction.includes(
      "Merch must be approved before seller checkout can be activated.",
    ) &&
    merchProductStatusAction.includes("Merch needs a valid live Stripe Payment Link") &&
    merchProductStatusAction.includes("seller checkout responsibilities") &&
    !merchProductStatusAction.includes("stripeCheckoutPreflight") &&
    !merchProductStatusAction.includes("stripe_connect_accounts") &&
    adminMerchPage.includes("const canActivateCheckout") &&
    adminMerchPage.includes('product.status === "approved"') &&
    adminMerchPage.includes(
      "Merch must be approved before seller checkout can be activated.",
    ) &&
    adminMerchPage.includes("disabled={activationBlocked}") &&
    adminMerchPage.includes("checkoutReadiness.ready"),
});
checks.push({
  label: "old TTC Merch and Connect release switches remain false by default",
  ok:
    envExample.includes("STRIPE_CHECKOUT_CREATION_ENABLED=false") &&
    envExample.includes("STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED=false") &&
    envExample.includes("STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED=false") &&
    envExample.includes("STRIPE_CONNECT_ONBOARDING_ENABLED=false") &&
    envExample.includes("STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false") &&
    !envExample.includes("STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED=true") &&
    !envExample.includes("STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED=true") &&
    !envExample.includes("STRIPE_CONNECT_ONBOARDING_ENABLED=true") &&
    !envExample.includes("STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=true"),
});
checks.push({
  label: "payment smoke reuses deterministic Wrangler payment configuration guards",
  ok: envGuardResult.status === 0,
  message:
    envGuardResult.status === 0
      ? undefined
      : "The repository environment guard rejected Wrangler payment configuration.",
});
checks.push({
  label: "payment smoke enforces expected live mode Wrangler mutations",
  ok:
    envGuardResult.status === 0 &&
    envGuardSource.includes("wrangler parser rejects duplicate ${key}") &&
    envGuardSource.includes("wrangler parser rejects enabled ${key}") &&
    envGuardSource.includes("wrangler parser rejects non-string ${key}") &&
    envGuardSource.includes("wrangler parser rejects missing ${key}") &&
    envGuardSource.includes("`${key} must appear exactly once with string value false`") &&
    !envGuardSource.includes("requiresAbsentOrOneFalseString"),
});
checks.push({
  label: "admin payment labels keep new seller links separate from legacy TTC records",
  ok: adminPaymentsCurrentMerchCopyIsSafe(adminPaymentsPage),
});
checks.push({
  label: "admin payment copy guard rejects injected TTC checkout payout and stale labels",
  ok:
    !adminPaymentsCurrentMerchCopyIsSafe(injectedCurrentTtcMerchInstruction) &&
    !adminPaymentsCurrentMerchCopyIsSafe(injectedUnqualifiedLegacyLabels),
});
checks.push({
  label: "legacy Merch destination-charge switch remains fail-closed and unused by the tombstone",
  ok:
    envExample.includes("STRIPE_MERCH_DESTINATION_CHARGES_ENABLED=false") &&
    stripeServer.includes("export function stripeMerchDestinationChargesEnabled()") &&
    stripeServer.includes("process.env.STRIPE_MERCH_DESTINATION_CHARGES_ENABLED") &&
    !merchCheckout.includes("stripeMerchDestinationChargesEnabled") &&
    !merchCheckout.includes("application_fee") &&
    !merchCheckout.includes("transfer_data"),
});
checks.push({
  label: "admin Merch removes payout filters while preserving paged product review",
  ok:
    !adminMerchPage.includes("function sellerPayoutFilter") &&
    !adminMerchPage.includes('params.set("seller_payout"') &&
    !adminMerchPage.includes("sellerPayoutFilters") &&
    !adminMerchPage.includes("activeSellerPayoutStatus") &&
    adminMerchPage.includes('productQuery = productQuery.eq("status", activeProductStatus)') &&
    adminMerchPage.includes(".range(from, to)"),
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
    productPlan.includes("legacy TTC fulfillment/reconciliation filters"),
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
    productPlan.includes("paged product/link review") &&
    productPlan.includes("historical TTC order/fulfillment support"),
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
    adminActions.includes('"admin_grant_ad_campaign_credit"') &&
    adminOperationIdempotencyMigration.includes("payment_status = 'waived'") &&
    adminOperationIdempotencyMigration.includes(
      "'ad_campaign_credit_granted'",
    ) &&
    adminOperationIdempotencyMigration.includes("'credit_amount_cents'") &&
    adminActions.includes("Only unpaid, failed, refunded, or already-waived ad campaigns can receive manual credit.") &&
    productPlan.includes("manual ad credits are started as campaign-level payment waivers") &&
    !accountPage.includes('return value.replaceAll("_", " ")') &&
    !adminAdsPage.includes('return value.replaceAll("_", " ")'),
});
checks.push({
  label: "admin payments watches booking deposit state",
  ok:
    adminActions.includes("export async function reconcileBookingDepositCheckout") &&
    !adminActions.includes("export async function resetStaleBookingDepositCheckouts") &&
    bookingCheckoutReconciliationAction.includes(
      "const checkoutPreflight = stripeCheckoutPreflight()",
    ) &&
    bookingCheckoutReconciliationAction.includes("!checkoutPreflight.ready") &&
    bookingCheckoutReconciliationAction.includes(
      "const checkoutContext = bookingRefundStripeContext({",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "const checkoutStripeOptions: Stripe.RequestOptions",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "stripe.checkout.sessions.retrieve(",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "checkoutStripeOptions",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "bookingUpdatedAt > staleBefore",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      '"This booking checkout is not old enough to reconcile. It remains held for review."',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "bookingCheckoutReconciliationDecision({",
    ) &&
    stripeCheckoutSessions.includes(
      "export function bookingCheckoutReconciliationDecision",
    ) &&
    stripeCheckoutSessions.includes(
      "session.livemode !== expectedLivemode",
    ) &&
    stripeCheckoutSessions.includes('session.mode !== "payment"') &&
    stripeCheckoutSessions.includes(
      'session.paymentKind !== "booking_deposit"',
    ) &&
    stripeCheckoutSessions.includes("session.bookingId !== booking.id") &&
    stripeCheckoutSessions.includes(
      "session.artistId !== booking.artistId",
    ) &&
    stripeCheckoutSessions.includes(
      "session.clientId !== booking.clientId",
    ) &&
    stripeCheckoutSessions.includes(
      "session.clientReferenceId !== booking.id",
    ) &&
    stripeCheckoutSessions.includes(
      "session.amountTotal !== booking.totalCents",
    ) &&
    stripeCheckoutSessions.includes(
      "session.currency?.toLowerCase() !== booking.currency.toLowerCase()",
    ) &&
    stripeCheckoutSessions.includes('session.paymentStatus !== "unpaid"') &&
    stripeCheckoutSessions.includes('session.status === "open"') &&
    stripeCheckoutSessions.includes('session.status === "expired"') &&
    bookingCheckoutReconciliationAction.includes(
      'reconciliationDecision.action === "hold"',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      'reconciliationDecision.action === "expire"',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "stripe.checkout.sessions.expire(",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "checkoutSession.id",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "stripe_connected_account_id: null",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      'releaseQuery.is("stripe_connected_account_id", null)',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      'reconciliationDecision.action !== "release"',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      'event_type: "booking_checkout_reconciliation_approved"',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "if (releaseError || !releasedBooking)",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "bookingCheckoutReleaseAttemptDecision({",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      '.is("stripe_checkout_session_id", null)',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "updateError: Boolean(releaseError)",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      "verifiedReleasedBookingId: alreadyReleasedBooking?.id ?? null",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      'if (releaseDecision.action === "reject")',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      'releaseDecision.reason !== "update_matched"',
    ) &&
    stripeCheckoutSessions.includes(
      "export function bookingCheckoutReleaseAttemptDecision",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      '"Checkout reconciliation was already completed. The booking is ready for a new deposit attempt."',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      '"Admin booking checkout reconciliation audit failed."',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      ".eq(\"stripe_checkout_session_id\", checkoutSessionId)",
    ) &&
    bookingCheckoutReconciliationAction.includes(
      '.eq("payment_dispute_hold", false)',
    ) &&
    bookingCheckoutReconciliationAction.includes(".select(\"id\")") &&
    bookingCheckoutReconciliationAction.includes(".maybeSingle<{ id: string }>()") &&
    bookingCheckoutReconciliationAction.includes(
      '"Checkout was not released because the booking changed during reconciliation."',
    ) &&
    adminActions.includes("export async function refundBookingDeposit") &&
    bookingRefundAction.includes("const checkoutPreflight = stripeCheckoutPreflight()") &&
    bookingRefundAction.includes("!checkoutPreflight.ready") &&
    bookingRefundAction.includes("stripe.paymentIntents.retrieve(") &&
    bookingRefundAction.includes("stripeAccountOptions") &&
    bookingRefundAction.includes("paymentIntent.livemode !== checkoutPreflight.actual") &&
    bookingRefundAction.includes(
      'paymentIntent.metadata?.payment_kind !== "booking_deposit"',
    ) &&
    bookingRefundAction.includes(
      "paymentIntent.metadata?.booking_request_id !== booking.id",
    ) &&
    bookingRefundAction.includes(
      "This payment could not be matched safely to the booking. No refund was requested.",
    ) &&
    adminActions.includes('event_type: "booking_checkout_reconciliation_approved"') &&
    adminActions.includes('event_type: "refund_booking_deposit_requested"') &&
    adminActions.includes("createStripeClient") &&
    adminActions.includes("stripe.refunds.list") &&
    adminActions.includes("stripe.refunds.create") &&
    adminActions.includes('const bookingRefundRequestKeyVersion = "booking-full-refund-v2"') &&
    adminActions.includes("idempotencyKey: bookingRefundRequestKey") &&
    bookingRefundAction.includes("charge: latestCharge.id") &&
    adminActions.includes('refund.metadata?.refund_kind === "booking_deposit"') &&
    adminActions.includes("existingRefundAudits?.length") &&
    adminActions.includes("const { error: refundAuditError } = await adminClient") &&
    adminActions.includes("if (refundAuditError)") &&
    adminActions.includes('"Admin booking deposit refund audit record failed."') &&
    adminActions.includes('"Refund request needs audit confirmation. Retry this action; it will not send a duplicate refund."') &&
    adminActions.includes('confirm !== "refund"') &&
    adminActions.includes('.eq("status", "deposit_pending")') &&
    adminActions.includes('.eq("payment_status", "checkout_started")') &&
    adminActions.includes('payment_status: "payment_failed"') &&
    adminActions.includes('status: "accepted"') &&
    adminActions.includes('stripe_checkout_session_id: null') &&
    adminActions.includes('profile?.role !== "admin" && profile?.role !== "owner"') &&
    bookingCheckoutReconciliationAction.includes(
      'console.error("Admin booking checkout lookup failed.")',
    ) &&
    bookingCheckoutReconciliationAction.includes(
      '"Could not confirm this booking checkout. It remains held for review."',
    ) &&
    adminActions.includes('console.error("Admin booking deposit lookup failed.")') &&
    adminActions.includes('"Booking deposit not found."') &&
    adminActions.includes('console.error("Admin booking deposit refund request failed.")') &&
    adminActions.includes('"Could not confirm booking refund. Retry this action; it will not send a duplicate refund."') &&
    !bookingCheckoutReconciliationAction.includes("error instanceof Error") &&
    !adminActions.includes('error?.message || "Booking deposit not found."') &&
    !adminActions.includes('error instanceof Error ? error.message : "Could not request booking refund."') &&
    adminPaymentsPage.includes("const bookingPaymentStatuses") &&
    adminPaymentsPage.includes("refundBookingDeposit") &&
    adminPaymentsPage.includes("reconcileBookingDepositCheckout") &&
    !adminPaymentsPage.includes("resetStaleBookingDepositCheckouts") &&
    adminPaymentsPage.includes("stripe_checkout_session_id") &&
    adminPaymentsPage.includes("Reconcile held checkout") &&
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
    adminPaymentsPage.includes("Connected payment account updated") &&
    adminPaymentsPage.includes("Legacy TTC pending Merch checkouts over 24h") &&
    !adminPaymentsPage.includes('return "Seller payout readiness updated"') &&
    !/>\s*Stale pending Merch checkouts over 24h\s*</.test(adminPaymentsPage) &&
    adminPaymentsPage.includes("charge.dispute.created") &&
    adminPaymentsPage.includes("charge.dispute.updated") &&
    adminPaymentsPage.includes("charge.dispute.closed") &&
    adminPaymentsPage.includes("charge.dispute.funds_withdrawn") &&
    adminPaymentsPage.includes("charge.dispute.funds_reinstated") &&
    adminPaymentsPage.includes("checkout.session.async_payment_succeeded") &&
    adminPaymentsPage.includes("refund_booking_deposit_requested") &&
    adminPaymentsPage.includes("booking_checkout_reconciliation_approved") &&
    adminPaymentsPage.includes("reset_stale_booking_deposit_checkouts") &&
    adminPaymentsPage.includes("Historical bulk checkout reset") &&
    adminPaymentsPage.includes("Booking checkout release approved") &&
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
    adminPaymentsPage.includes("Open the filtered booking list") &&
    !adminPaymentsPage.includes("Reset stale booking checkouts") &&
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
  label: "admin payment review fails closed when required data is unavailable",
  ok:
    adminPaymentsPage.includes("const { count, error } = await supabase") &&
    adminPaymentsPage.includes("error: results.find(([, , error]) => error)?.[2] ?? null") &&
    adminPaymentsPage.includes("const paymentDataErrors = [") &&
    adminPaymentsPage.includes("stripeEventsError") &&
    adminPaymentsPage.includes("merchStatusCountsError") &&
    adminPaymentsPage.includes("bookingPaymentStatusCountsError") &&
    adminPaymentsPage.includes("paymentDisputeAuditError") &&
    adminPaymentsPage.includes("paymentAuditError") &&
    adminPaymentsPage.includes("bookingDepositError") &&
    adminPaymentsPage.includes(
      "const paymentDataUnavailable = paymentDataErrors.length > 0",
    ) &&
    adminPaymentsPage.includes(
      'console.error("Admin payment review data load failed.", paymentDataErrors)',
    ) &&
    adminPaymentsPage.includes("paymentDataUnavailable ? (") &&
    adminPaymentsPage.includes("Payment review is temporarily unavailable") &&
    compactWhitespace(adminPaymentsPage).includes(
      "No payment decisions should be made from partial",
    ) &&
    compactWhitespace(adminPaymentsPage).includes(
      "performing legacy TTC seller-payout reconciliation. No payment decisions",
    ) &&
    compactWhitespace(adminPaymentsPage).includes(
      "booking deposit updates, or legacy TTC seller-payout reconciliation.",
    ) &&
    adminPaymentsPage.includes("Retry payment review"),
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
  label: "admin payment preflight exposes the Merch seller-routing release gate",
  ok:
    adminPaymentsPage.includes("stripeMerchDestinationChargesEnabled") &&
    adminPaymentsPage.includes("const merchDestinationChargesEnabled = stripeMerchDestinationChargesEnabled()") &&
    adminPaymentsPage.includes("const merchDestinationChargesReady = legacyMerchRoutingReady(") &&
    adminPaymentsPage.includes("detail: merchDestinationChargesEnabled") &&
    adminPaymentsPage.includes('label: "Merch seller routing"') &&
    adminPaymentsPage.includes("ready: merchDestinationChargesReady") &&
    adminPaymentsPage.includes("Legacy TTC checkout controls: Merch seller routing remains disabled for the seller-link release.") &&
    paymentReadiness.includes("Merch seller-routing release switch") &&
    paymentReadiness.includes("does not show private key, webhook, or connected-account values"),
});
checks.push({
  label: "admin payment preflight treats disabled legacy routing as seller-link ready",
  ok: legacyMerchRoutingReadiness(adminPaymentsPage, false) === true,
});
checks.push({
  label: "admin payment preflight treats enabled legacy routing as a blocker",
  ok: legacyMerchRoutingReadiness(adminPaymentsPage, true) === false,
});
checks.push({
  label: "admin payment routing readiness mutation cannot invert the safe state",
  ok: !legacyMerchRoutingContractIsSafe(invertedLegacyMerchRoutingSource),
});
checks.push({
  label: "admin payments exposes separate Stripe release switches without private values",
  ok:
    stripeReleaseGates.startsWith('import "server-only";') &&
    stripeReleaseGates.includes("stripeCheckoutCreationMasterEnabled") &&
    stripeReleaseGates.includes("stripeCheckoutCreationState") &&
    adminPaymentsPage.includes("stripeCheckoutCreationMasterEnabled") &&
    adminPaymentsPage.includes("const checkoutCreationMasterEnabled = stripeCheckoutCreationMasterEnabled()") &&
    adminPaymentsPage.includes('state: stripeCheckoutCreationState("official_merch")') &&
    adminPaymentsPage.includes('state: stripeCheckoutCreationState("booking")') &&
    adminPaymentsPage.includes('state: stripeCheckoutCreationState("marketplace_merch")') &&
    adminPaymentsPage.includes('label: "Checkout creation"') &&
    adminPaymentsPage.includes('label: "Official TTC Merch"') &&
    adminPaymentsPage.includes('label: "Booking deposits"') &&
    adminPaymentsPage.includes('label: "Marketplace Merch"') &&
    adminPaymentsPage.includes('label: "Seller onboarding"') &&
    adminPaymentsPage.includes('releaseSwitch.state === "enabled"') &&
    adminPaymentsPage.includes('releaseSwitch.state === "armed"') &&
    adminPaymentsPage.includes('releaseSwitch.state === "enabled" ? "Enabled"') &&
    adminPaymentsPage.includes(': releaseSwitch.state === "armed"') &&
    adminPaymentsPage.includes('? "Armed"') &&
    adminPaymentsPage.includes(': "Blocked"') &&
    adminPaymentsPage.includes("Legacy TTC checkout controls") &&
    adminPaymentsPage.includes("These controls remain disabled") &&
    adminPaymentsPage.includes("Sanitized states never expose") &&
    !adminPaymentsPage.includes("STRIPE_SECRET_KEY") &&
    !adminPaymentsPage.includes("STRIPE_WEBHOOK_SECRET"),
});
checks.push({
  label: "public smoke requires the exact no-redirect Merch tombstone response",
  ok:
    publicSmoke.includes('path: "/api/merch/checkout"') &&
    publicSmoke.includes("status: [410]") &&
    publicSmoke.includes('bodyEquals: \'{"error":"Merch checkout is unavailable."}\'') &&
    publicSmoke.includes('locationEquals: ""'),
});
checks.push({
  label: "standard payment smoke includes focused Stripe release gates exactly once",
  ok:
    packageScripts["smoke:payments"] === expectedPaymentSmoke &&
    packageScripts["smoke:payments"].split(" && ").filter(
      (step) => step === "npm run test:stripe-release-gates",
    ).length === 1,
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
    adminPaymentsPage.includes("Keep historical Connect and seller payout evidence in admin-only review") &&
    adminPaymentsPage.includes("do not collect bank or card payout data in TTC forms") &&
    accountPage.includes("Sellers add their own live Payment Link") &&
    accountPage.includes("The seller processes payment and handles shipping, taxes, returns, refunds, disputes, and purchase support.") &&
    !accountPage.includes("secure setup flow") &&
    !accountPage.includes("TTC stores payout readiness status only") &&
    !accountPage.includes("bank account number") &&
    !accountPage.includes("routing number") &&
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
    paymentReadiness.includes("Apple App Review Guidelines 3.1.3(e)") &&
    paymentReadiness.includes("Google Play Payments policy section 3") &&
    paymentReadiness.includes("exact-build reviewer notes or classification evidence remain pending by default") &&
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
      '"verify:payment-release": "npm run lint && npm run build && npm run smoke:env && npm run smoke:payments && npm run smoke:seller-link-rollout && npm run smoke:pwa && npm run smoke:security && npm run smoke:handoff && npm run smoke:docs && npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:ios"',
    ) &&
    packageJson.includes('"smoke:seller-link-rollout": "node scripts/smoke-payment-cutover-evidence.mjs"') &&
    packageJson.includes(
      '"test:seller-link-rollout-evidence": "node scripts/test-payment-go-live-gate.mjs"',
    ) &&
    packageJson.includes(
      '"verify:seller-link-rollout-evidence": "npm run smoke:env && npm run test:seller-link-rollout-evidence && node scripts/smoke-payment-cutover-evidence.mjs --strict"',
    ) &&
    packageJson.includes(
      '"test:seller-link-rollout-command": "node scripts/test-payment-go-live-command.mjs"',
    ) &&
    !packageJson.includes('"smoke:payment-cutover"') &&
    !packageJson.includes('"verify:payment-go-live"') &&
    !packageJson.includes('"verify:payment-production-evidence"') &&
    !packageJson.includes('"test:payment-go-live-gate"') &&
    paymentCutoverGate.includes("const MAX_EVIDENCE_AGE_DAYS = 45") &&
    paymentCutoverGate.includes("function strictEvidenceBlockers") &&
    paymentCutoverGate.includes("function gitCommitExists") &&
    paymentCutoverGate.includes("proof date cannot be in the future") &&
    paymentCutoverGate.includes("proof date must be within ${MAX_EVIDENCE_AGE_DAYS} days") &&
    paymentCutoverGate.includes("--reference-date is fixture-only") &&
    paymentCutoverGate.includes("Private evidence must not contain a seller link, account ID, payment ID, or secret") &&
    paymentCutoverGateTest.includes("seller-link rollout gate rejects stale proof") &&
    paymentCutoverGateTest.includes("seller-link rollout gate rejects future proof") &&
    paymentCutoverGateTest.includes("seller-link rollout gate rejects a raw seller link") &&
    paymentCutoverGateTest.includes("seller-link rollout gate rejects a seller account identifier") &&
    paymentCutoverGateTest.includes("seller-link rollout gate rejects duplicate command options") &&
    paymentGoLiveCommandTest.includes(
      "PASS seller-link rollout command forwards private evidence options.",
    ) &&
    paymentReadiness.includes("npm.cmd run verify:payment-release") &&
    paymentReadiness.includes("npm.cmd run smoke:seller-link-rollout") &&
    paymentReadiness.includes("npm.cmd run verify:seller-link-rollout-evidence"),
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
