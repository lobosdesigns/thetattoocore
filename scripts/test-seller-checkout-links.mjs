import assert from "node:assert/strict";
import { importTypeScriptWithStubs } from "./admin-module-test-harness.mjs";

const {
  SELLER_CHECKOUT_TERMS_VERSION,
  sellerCheckoutLinksEnabled,
  sellerCheckoutPurchaseReadiness,
  sellerCheckoutSubmissionReadiness,
  validateSellerCheckoutUrl,
} = await importTypeScriptWithStubs(
  "src/lib/merch/seller-checkout.ts",
  { "server-only": {} },
);

function assertModuleValue(actual, expected, message) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message);
}

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

assert.equal(SELLER_CHECKOUT_TERMS_VERSION, "seller-checkout-v1");
assertModuleValue(validateSellerCheckoutUrl(validLiveUrl), {
  ok: true,
  url: validLiveUrl,
});
console.log("PASS canonical URL validation");

for (const value of invalidUrls) {
  const result = validateSellerCheckoutUrl(value);
  assert.equal(result.ok, false, `expected URL to be rejected: ${JSON.stringify(value)}`);
  assert.notEqual(result.code, "test_link");
}
assertModuleValue(validateSellerCheckoutUrl(null), { ok: false, code: "required" });
assertModuleValue(validateSellerCheckoutUrl("https://buy.stripe.com/test_123"), {
  ok: false,
  code: "test_link",
});
assertModuleValue(
  validateSellerCheckoutUrl("https://buy.stripe.com/test_123", { allowTest: true }),
  { ok: true, url: "https://buy.stripe.com/test_123" },
);
console.log("PASS malicious URL rejection");

const gateCases = [
  [{}, false],
  [{ STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: "false" }, false],
  [{ STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: "trueish" }, false],
  [{ STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: " TRUE " }, false],
  [{ STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: true }, false],
  [{ STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: {} }, false],
  [{ STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: "true" }, true],
];
for (const [environment, expected] of gateCases) {
  assert.equal(sellerCheckoutLinksEnabled(environment), expected);
}
console.log("PASS exact release gate behavior");

const readyInput = {
  externalCheckoutUrl: validLiveUrl,
  fulfillmentNotes: "Ships within five business days.",
  inventoryQuantity: 10,
  inventoryReserved: 2,
  isOfficial: false,
  moderationStatus: "active",
  returnPolicy: "Returns accepted within thirty days.",
  sellerCheckoutTermsAcceptedAt: "2026-08-01T12:00:00.000Z",
  sellerCheckoutTermsVersion: SELLER_CHECKOUT_TERMS_VERSION,
  sellerVerified: true,
  shippingRequired: true,
  shipsFromCity: "Austin",
  shipsFromRegion: "TX",
  status: "active",
};

const submissionFailureCases = [
  ["official product", { isOfficial: true }, "official_product"],
  ["unverified seller", { sellerVerified: false }, "seller_unverified"],
  ["sold-out product", { inventoryReserved: 10 }, "sold_out"],
  ["missing terms", { sellerCheckoutTermsVersion: null }, "missing_terms"],
  [
    "incomplete fulfillment",
    { fulfillmentNotes: "Short", returnPolicy: "Returns" },
    "missing_fulfillment",
  ],
  ["invalid URL", { externalCheckoutUrl: "https://buy.stripe.com/test_123" }, "invalid_url"],
];

for (const [label, changes, reason] of submissionFailureCases) {
  assertModuleValue(sellerCheckoutSubmissionReadiness({ ...readyInput, ...changes }), {
    ready: false,
    reason,
    url: null,
  }, label);
}
assertModuleValue(
  sellerCheckoutSubmissionReadiness({
    ...readyInput,
    sellerCheckoutTermsAcceptedAt: "not-a-timestamp",
  }),
  { ready: false, reason: "missing_terms", url: null },
);
assertModuleValue(
  sellerCheckoutSubmissionReadiness({
    ...readyInput,
    shippingRequired: true,
    shipsFromCity: null,
  }),
  { ready: false, reason: "missing_fulfillment", url: null },
);
assertModuleValue(
  sellerCheckoutSubmissionReadiness({
    ...readyInput,
    shippingRequired: false,
    shipsFromCity: null,
    shipsFromRegion: null,
  }),
  { ready: true, reason: null, url: validLiveUrl },
);
console.log("PASS submission readiness");

assertModuleValue(
  sellerCheckoutPurchaseReadiness(readyInput, {}),
  { ready: false, reason: "disabled", url: null },
);
assertModuleValue(
  sellerCheckoutPurchaseReadiness(readyInput, {
    STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: "true",
  }),
  { ready: true, reason: null, url: validLiveUrl },
);
assertModuleValue(
  sellerCheckoutPurchaseReadiness(
    { ...readyInput, status: "inactive" },
    { STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: "true" },
  ),
  { ready: false, reason: "not_active", url: null },
);
assertModuleValue(
  sellerCheckoutPurchaseReadiness(
    { ...readyInput, moderationStatus: "hidden" },
    { STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: "true" },
  ),
  { ready: false, reason: "not_moderated", url: null },
);
console.log("PASS public purchase readiness");
