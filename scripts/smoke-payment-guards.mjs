import { readFileSync } from "node:fs";

const adCheckout = readFileSync("src/app/api/ads/checkout/route.ts", "utf8");
const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");
const merchCheckout = readFileSync("src/app/api/merch/checkout/route.ts", "utf8");
const stripeWebhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const merchDetailPage = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const merchCheckoutSuccessPage = readFileSync("src/app/merch/checkout/success/page.tsx", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const adminAdsPage = readFileSync("src/app/admin/ads/page.tsx", "utf8");
const merchPrintReceiptButton = readFileSync(
  "src/app/merch/checkout/success/print-receipt-button.tsx",
  "utf8",
);
const adminMerchPage = readFileSync("src/app/admin/merch/page.tsx", "utf8");
const adminPaymentsPage = readFileSync("src/app/admin/payments/page.tsx", "utf8");
const adminActions = readFileSync("src/app/admin/actions.ts", "utf8");
const globalsCss = readFileSync("src/app/globals.css", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const fees = readFileSync("src/lib/payments/fees.ts", "utf8");
const statusLabels = readFileSync("src/lib/status-labels.ts", "utf8");
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
  label: "checkout routes require private payment gates before payments",
  ok:
    adCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    adCheckout.includes("Ad checkout is almost ready. Payment setup is still being finished.") &&
    bookingCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    bookingCheckout.includes("Booking checkout is almost ready. Payment setup is still being finished.") &&
    merchCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    merchCheckout.includes("Checkout is almost ready. Payment setup is still being finished."),
});
checks.push({
  label: "payment webhook rejects unsigned events before processing",
  ok:
    stripeWebhook.includes("const signature = request.headers.get(\"stripe-signature\")") &&
    stripeWebhook.includes("Missing payment verification.") &&
    stripeWebhook.includes("constructEventAsync") &&
    stripeWebhook.indexOf("Missing payment verification.") <
      stripeWebhook.indexOf("constructEventAsync"),
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
    merchCheckout.includes('formData.get("return_to")') &&
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
  label: "shared platform fee helper stays at launch rate",
  ok:
    fees.includes("export const platformFeeRate = 0.02") &&
    fees.includes('export const platformFeePercentLabel = "2%"'),
});
checks.push({
  label: "production commerce gates stay visible before real payments",
  ok:
    adminPaymentsPage.includes("Production payment gates") &&
    adminPaymentsPage.includes("bookingPaymentStatusLabel(status)") &&
    adminPaymentsPage.includes("titleCaseStatus(value)") &&
    adminPaymentsPage.includes("Choose a documented payout policy") &&
    adminPaymentsPage.includes("booking refund, cancellation, appointment-confirmation") &&
    adminPaymentsPage.includes("do not collect bank or card payout data in TTC forms") &&
    adminMerchPage.includes("Checkout and refund status are limited during launch") &&
    adminMerchPage.includes("finish tax, shipping, fulfillment, payouts, and payment safety rules") &&
    privacyPage.includes("Checkout is limited during launch") &&
    supportPage.includes("Merch checkout is limited during launch"),
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
    adminAdsPage.includes("titleCaseStatus(value)") &&
    !accountPage.includes('return value.replaceAll("_", " ")') &&
    !adminAdsPage.includes('return value.replaceAll("_", " ")'),
});
checks.push({
  label: "admin payments watches booking deposit state",
  ok:
    adminActions.includes("export async function resetStaleBookingDepositCheckouts") &&
    adminActions.includes('event_type: "reset_stale_booking_deposit_checkouts"') &&
    adminActions.includes('.eq("status", "deposit_pending")') &&
    adminActions.includes('.eq("payment_status", "checkout_started")') &&
    adminActions.includes('payment_status: "payment_failed"') &&
    adminActions.includes('status: "accepted"') &&
    adminActions.includes('stripe_checkout_session_id: null') &&
    adminActions.includes('profile?.role !== "admin" && profile?.role !== "owner"') &&
    adminPaymentsPage.includes("const bookingPaymentStatuses") &&
    adminPaymentsPage.includes("resetStaleBookingDepositCheckouts") &&
    adminPaymentsPage.includes('table: "booking_requests"') &&
    adminPaymentsPage.includes("Stale booking deposit checkouts over 24h") &&
    adminPaymentsPage.includes("Reset stale booking checkouts") &&
    adminPaymentsPage.includes("Booking deposit states") &&
    adminPaymentsPage.includes('.eq("status", "deposit_pending")') &&
    adminPaymentsPage.includes('.eq("payment_status", "checkout_started")'),
});
checks.push({
  label: "public payment copy avoids collecting raw payout credentials",
  ok:
    !paymentSafetySource.includes("bank account number") &&
    !paymentSafetySource.includes("routing number") &&
    !paymentSafetySource.includes("debit card number") &&
    !paymentSafetySource.includes("card payout form") &&
    adminPaymentsPage.includes("secure hosted onboarding flow"),
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
