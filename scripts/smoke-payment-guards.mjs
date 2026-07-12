import { readFileSync } from "node:fs";

const adCheckout = readFileSync("src/app/api/ads/checkout/route.ts", "utf8");
const merchCheckout = readFileSync("src/app/api/merch/checkout/route.ts", "utf8");
const merchCheckoutSuccessPage = readFileSync("src/app/merch/checkout/success/page.tsx", "utf8");
const merchPrintReceiptButton = readFileSync(
  "src/app/merch/checkout/success/print-receipt-button.tsx",
  "utf8",
);
const adminMerchPage = readFileSync("src/app/admin/merch/page.tsx", "utf8");
const adminPaymentsPage = readFileSync("src/app/admin/payments/page.tsx", "utf8");
const globalsCss = readFileSync("src/app/globals.css", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const fees = readFileSync("src/lib/payments/fees.ts", "utf8");
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
  label: "checkout routes require webhook and service-role gates before payments",
  ok:
    adCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    adCheckout.includes("Ad checkout is almost ready. Finish server webhook setup before taking payments.") &&
    merchCheckout.includes("process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY") &&
    merchCheckout.includes("Checkout is almost ready. Finish server webhook setup before taking payments."),
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
  label: "shared platform fee helper stays at launch rate",
  ok:
    fees.includes("export const platformFeeRate = 0.02") &&
    fees.includes('export const platformFeePercentLabel = "2%"'),
});
checks.push({
  label: "production commerce gates stay visible before real payments",
  ok:
    adminPaymentsPage.includes("Production payment gates") &&
    adminPaymentsPage.includes("Choose Stripe Connect or a documented manual payout policy") &&
    adminPaymentsPage.includes("do not collect bank or card payout data in TTC forms") &&
    adminMerchPage.includes("Stripe checkout and refund-status webhooks are wired in test mode") &&
    adminMerchPage.includes("finish tax, shipping, fulfillment, payouts, and payment-provider safety rules") &&
    privacyPage.includes("Stripe checkout is in test mode") &&
    supportPage.includes("Merch checkout is in test mode"),
});
checks.push({
  label: "public payment copy avoids collecting raw payout credentials",
  ok:
    !paymentSafetySource.includes("bank account number") &&
    !paymentSafetySource.includes("routing number") &&
    !paymentSafetySource.includes("debit card number") &&
    !paymentSafetySource.includes("card payout form") &&
    adminPaymentsPage.includes("Stripe-hosted onboarding"),
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
