import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);

function loadTypeScriptModule(filePath, cache = new Map()) {
  const absolutePath = path.resolve(root, filePath);
  if (cache.has(absolutePath)) return cache.get(absolutePath).exports;

  const output = ts.transpileModule(readFileSync(absolutePath, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolutePath,
    reportDiagnostics: true,
  });
  const errors = (output.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `TypeScript transpilation failed for ${filePath}`);

  const loaded = { exports: {} };
  cache.set(absolutePath, loaded);
  const localRequire = (specifier) => {
    if (specifier.startsWith("node:")) return nativeRequire(specifier);
    if (specifier.startsWith(".")) {
      const resolved = path.resolve(path.dirname(absolutePath), specifier);
      return loadTypeScriptModule(
        path.extname(resolved) ? resolved : `${resolved}.ts`,
        cache,
      );
    }
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {${output.outputText}\n})`,
    { filename: absolutePath },
  );
  wrapper(loaded.exports, localRequire, loaded, absolutePath, path.dirname(absolutePath));
  return loaded.exports;
}

const {
  stripeAdCreditDisputeAction,
  stripeAdCreditDisputeReconciliation,
  stripeAdCreditGrantFromCheckout,
  stripeAdCreditRefundFromCharge,
} = loadTypeScriptModule("src/lib/ads/stripe-credit.ts");

const profileId = "11111111-1111-4111-8111-111111111111";
const paymentIntentId = "pi_1234567890abcdef";
const validMetadata = {
  ad_credit_product_id: "ttc.adcredit.2500",
  credit_cents: "2500",
  payment_kind: "ad_credit_purchase",
  profile_id: profileId,
};
const validSession = {
  amount_subtotal: 2500,
  amount_total: 2500,
  client_reference_id: profileId,
  currency: "usd",
  metadata: validMetadata,
  mode: "payment",
  payment_intent: paymentIntentId,
  payment_status: "paid",
  status: "complete",
  total_details: {
    amount_discount: 0,
    amount_shipping: 0,
    amount_tax: 0,
  },
};

assert.deepEqual(stripeAdCreditGrantFromCheckout(validSession), {
  creditCents: 2500,
  origin: "stripe_web",
  productId: "ttc.adcredit.2500",
  profileId,
  providerCurrency: "usd",
  providerPaidAmountCents: 2500,
  providerTransactionId: paymentIntentId,
});

for (const mutation of [
  { amount_total: 1 },
  { amount_subtotal: 1 },
  { client_reference_id: "22222222-2222-4222-8222-222222222222" },
  { currency: "eur" },
  { mode: "subscription" },
  { payment_intent: { id: paymentIntentId } },
  { payment_status: "unpaid" },
  { status: "open" },
  { total_details: { amount_discount: 1, amount_shipping: 0, amount_tax: 0 } },
  { total_details: { amount_discount: 0, amount_shipping: 1, amount_tax: 0 } },
  { total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 1 } },
  { metadata: { ...validMetadata, ad_credit_product_id: "ttc.adcredit.5000" } },
  { metadata: { ...validMetadata, credit_cents: "02500" } },
  { metadata: { ...validMetadata, payment_kind: "ad_campaign" } },
  { metadata: { ...validMetadata, profile_id: "or=(status.eq.active)" } },
]) {
  assert.equal(
    stripeAdCreditGrantFromCheckout({ ...validSession, ...mutation }),
    null,
  );
}
assert.equal(stripeAdCreditGrantFromCheckout(null), null);
console.log("PASS Stripe ad credit grant requires exact settled package identity");

const chargeId = "ch_1234567890abcdef";
const disputeId = "dp_1234567890abcdef";
const validCharge = {
  id: chargeId,
  amount: 2500,
  amount_refunded: 2500,
  currency: "usd",
  metadata: validMetadata,
  payment_intent: paymentIntentId,
  refunded: true,
};
assert.deepEqual(stripeAdCreditRefundFromCharge(validCharge), {
  action: "terminal_void",
  fullPurchase: false,
  kind: "full",
  origin: "stripe_web",
  productId: "ttc.adcredit.2500",
  profileId,
  providerAmountCents: 2500,
  providerCurrency: "usd",
  providerLifecycleId: chargeId,
  providerPaidAmountCents: 2500,
  providerTransactionId: paymentIntentId,
  purchaseCreditCents: 2500,
  reason: "refund",
  reconciliationCreditCents: 2500,
});
assert.deepEqual(
  stripeAdCreditRefundFromCharge({
    ...validCharge,
    amount_refunded: 500,
    refunded: false,
  }),
  {
    action: "terminal_void",
    fullPurchase: false,
    kind: "partial",
    origin: "stripe_web",
    productId: "ttc.adcredit.2500",
    profileId,
    providerAmountCents: 500,
    providerCurrency: "usd",
    providerLifecycleId: chargeId,
    providerPaidAmountCents: 2500,
    providerTransactionId: paymentIntentId,
    purchaseCreditCents: 2500,
    reason: "refund",
    reconciliationCreditCents: 500,
  },
);
for (const mutation of [
  { id: "not-a-charge" },
  { amount: 5000 },
  { amount_refunded: 2501 },
  { currency: "eur" },
  { metadata: { ...validMetadata, payment_kind: "booking_deposit" } },
  { payment_intent: "not.a.safe.id" },
  { refunded: true, amount_refunded: 500 },
]) {
  assert.equal(stripeAdCreditRefundFromCharge({ ...validCharge, ...mutation }), null);
}
console.log("PASS Stripe ad credit refunds reject forged or inconsistent charges");

assert.equal(stripeAdCreditDisputeAction("charge.dispute.created", "needs_response"), "hold");
assert.equal(stripeAdCreditDisputeAction("charge.dispute.updated", "under_review"), "hold");
assert.equal(stripeAdCreditDisputeAction("charge.dispute.funds_withdrawn", "lost"), "terminal_void");
assert.equal(stripeAdCreditDisputeAction("charge.dispute.closed", "lost"), "terminal_void");
assert.equal(stripeAdCreditDisputeAction("charge.dispute.closed", "won"), "release");
assert.equal(stripeAdCreditDisputeAction("charge.dispute.closed", "prevented"), "release");
assert.equal(stripeAdCreditDisputeAction("charge.dispute.funds_reinstated", "won"), "release");
assert.equal(stripeAdCreditDisputeAction("payment_intent.succeeded", "won"), null);
assert.equal(stripeAdCreditDisputeAction("charge.dispute.updated", "forged"), null);
console.log("PASS Stripe dispute actions separate temporary holds from terminal loss");

const validDispute = {
  amount: 2500,
  charge: chargeId,
  currency: "usd",
  id: disputeId,
  status: "needs_response",
};
assert.deepEqual(
  stripeAdCreditDisputeReconciliation(
    "charge.dispute.created",
    validDispute,
    validCharge,
  ),
  {
    action: "hold",
    fullPurchase: false,
    origin: "stripe_web",
    productId: "ttc.adcredit.2500",
    profileId,
    providerAmountCents: 2500,
    providerCurrency: "usd",
    providerLifecycleId: disputeId,
    providerPaidAmountCents: 2500,
    providerTransactionId: paymentIntentId,
    purchaseCreditCents: 2500,
    reason: "dispute",
    reconciliationCreditCents: 2500,
  },
);
assert.deepEqual(
  stripeAdCreditDisputeReconciliation(
    "charge.dispute.closed",
    { ...validDispute, amount: 500, status: "lost" },
    validCharge,
  ),
  {
    action: "terminal_void",
    fullPurchase: false,
    origin: "stripe_web",
    productId: "ttc.adcredit.2500",
    profileId,
    providerAmountCents: 500,
    providerCurrency: "usd",
    providerLifecycleId: disputeId,
    providerPaidAmountCents: 2500,
    providerTransactionId: paymentIntentId,
    purchaseCreditCents: 2500,
    reason: "dispute",
    reconciliationCreditCents: 500,
  },
);
for (const [disputeMutation, chargeMutation] of [
  [{ id: "not-a-dispute" }, {}],
  [{ amount: 2501 }, {}],
  [{ charge: "ch_other12345678" }, {}],
  [{ currency: "eur" }, {}],
  [{ status: "forged" }, {}],
  [{}, { metadata: { ...validMetadata, profile_id: "or=(status.eq.active)" } }],
]) {
  assert.equal(
    stripeAdCreditDisputeReconciliation(
      "charge.dispute.updated",
      { ...validDispute, ...disputeMutation },
      { ...validCharge, ...chargeMutation },
    ),
    null,
  );
}
console.log("PASS Stripe dispute reconciliation binds stable dispute and charge identity");

const webhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
assert.ok(webhook.includes("stripeAdCreditGrantFromCheckout"));
assert.ok(webhook.includes("grantVerifiedAdCreditPurchase"));
assert.ok(webhook.includes("reconcileVerifiedAdCreditPurchase"));
assert.ok(webhook.includes("async function grantStripeAdCreditPurchase"));
assert.ok(webhook.includes('session.metadata?.payment_kind === "ad_credit_purchase"'));
assert.ok(webhook.includes("await grantStripeAdCreditPurchase(session)"));
assert.ok(webhook.includes("async function reconcileStripeAdCreditPurchaseIfPresent"));
assert.ok(webhook.includes("eventId: event.id"));
assert.ok(webhook.includes("stripeAdCreditDisputeReconciliation"));
assert.ok(webhook.includes("providerEventId: eventId"));
assert.equal(webhook.includes("success_url alone"), false);
console.log("PASS Stripe webhook grants and reconciles ad credit through server-only RPCs");

console.log("USER INPUT SECURITY REVIEW: PASS Stripe ad credit metadata fails closed");
