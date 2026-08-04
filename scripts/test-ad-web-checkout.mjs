import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const {
  adCheckoutBodyAllowed,
  parseAdCheckoutForm,
  readBoundedAdCheckoutForm,
  safeAdCheckoutReturnPath,
} = await importSelfContainedTypeScript(
  "../src/lib/ads/web-checkout.ts",
  import.meta.url,
);

function form(entries) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

assert.deepEqual(
  parseAdCheckoutForm(
    form([
      ["product_id", "ttc.adcredit.2500"],
      ["return_to", "/account?ads=5#advertising-settings"],
    ]),
  ),
  {
    kind: "purchase",
    productId: "ttc.adcredit.2500",
    returnTo: "/account?ads=5#advertising-settings",
  },
);
assert.deepEqual(
  parseAdCheckoutForm(
    form([
      ["campaign_id", "11111111-1111-4111-8111-111111111111"],
      ["return_to", "/account#advertising-settings"],
    ]),
  ),
  {
    campaignId: "11111111-1111-4111-8111-111111111111",
    kind: "campaign",
    returnTo: "/account#advertising-settings",
  },
);

for (const entries of [
  [],
  [["product_id", "ttc.adcredit.999999"]],
  [["campaign_id", "not-a-uuid"]],
  [
    ["product_id", "ttc.adcredit.2500"],
    ["campaign_id", "11111111-1111-4111-8111-111111111111"],
  ],
  [
    ["product_id", "ttc.adcredit.2500"],
    ["product_id", "ttc.adcredit.5000"],
  ],
  [
    ["campaign_id", "11111111-1111-4111-8111-111111111111"],
    ["return_to", "/account"],
    ["return_to", "/admin"],
  ],
  [
    ["product_id", "ttc.adcredit.2500"],
    ["credit_cents", "1000000"],
  ],
  [
    ["product_id", "ttc.adcredit.2500"],
    ["profile_id", "22222222-2222-4222-8222-222222222222"],
  ],
  [
    ["product_id", "ttc.adcredit.2500"],
    ["price", "1"],
  ],
]) {
  assert.equal(parseAdCheckoutForm(form(entries)), null);
}
console.log("PASS ad checkout accepts one exact server-priced intent");

for (const value of [
  "https://evil.example/checkout",
  "//evil.example/checkout",
  "/\\evil",
  "javascript:alert(1)",
  "/account\r\nLocation: https://evil.example",
  `/${"a".repeat(241)}`,
  { toString: () => "/account" },
]) {
  assert.equal(safeAdCheckoutReturnPath(value), null);
}
assert.equal(
  safeAdCheckoutReturnPath(" /account?ads=5#advertising-settings "),
  "/account?ads=5#advertising-settings",
);
assert.equal(safeAdCheckoutReturnPath(null), null);
console.log("PASS ad checkout return paths stay internal and bounded");

for (const value of ["-1", "1.5", "NaN", "4097", "9e9", " 12", {}, true]) {
  assert.equal(adCheckoutBodyAllowed(value), false);
}
assert.equal(adCheckoutBodyAllowed("0"), true);
assert.equal(adCheckoutBodyAllowed("4096"), true);
assert.equal(adCheckoutBodyAllowed(null), true);
console.log("PASS ad checkout rejects declared oversized or malformed bodies");

const boundedForm = await readBoundedAdCheckoutForm(
  new Request("https://example.test/api/ads/checkout", {
    body: "product_id=ttc.adcredit.2500&return_to=%2Faccount%23advertising-settings",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  }),
);
assert.deepEqual(parseAdCheckoutForm(boundedForm), {
  kind: "purchase",
  productId: "ttc.adcredit.2500",
  returnTo: "/account#advertising-settings",
});
for (const request of [
  new Request("https://example.test/api/ads/checkout", {
    body: `product_id=ttc.adcredit.2500&padding=${"x".repeat(4097)}`,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  }),
  new Request("https://example.test/api/ads/checkout", {
    body: "product_id=ttc.adcredit.2500",
    headers: {
      "content-length": "5000",
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  }),
  new Request("https://example.test/api/ads/checkout", {
    body: "product_id=ttc.adcredit.2500",
    headers: { "content-type": "text/plain" },
    method: "POST",
  }),
  new Request("https://example.test/api/ads/checkout", {
    body: "product_id=ttc.adcredit.2500",
    headers: {
      "content-encoding": "gzip",
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  }),
]) {
  assert.equal(await readBoundedAdCheckoutForm(request), null);
}
console.log("PASS ad checkout bounds streamed bodies even without Content-Length");

const route = readFileSync("src/app/api/ads/checkout/route.ts", "utf8");
const fees = readFileSync("src/lib/payments/fees.ts", "utf8");
const post = route.slice(route.indexOf("export async function POST"));
const surfaceGateIndex = post.indexOf("if (!adPurchaseSurfaceEnabled(surface))");
const bodyGateIndex = post.indexOf("if (!adCheckoutBodyAllowed(");
const boundedReadIndex = post.indexOf("await readBoundedAdCheckoutForm(request)");
const formIndex = post.indexOf("parseAdCheckoutForm(formData)");
const accountIndex = post.indexOf("const supabase = await createClient()");
const campaignSpendIndex = post.indexOf('"spend_ad_credit_for_campaign"');
const webOnlyIndex = post.indexOf('if (surface !== "web")');
const stripeKeyIndex = post.indexOf("process.env.STRIPE_SECRET_KEY");

assert.ok(surfaceGateIndex >= 0);
assert.ok(bodyGateIndex > surfaceGateIndex);
assert.ok(boundedReadIndex > bodyGateIndex);
assert.ok(formIndex > boundedReadIndex);
assert.ok(accountIndex > formIndex);
assert.ok(campaignSpendIndex > accountIndex);
assert.ok(webOnlyIndex > campaignSpendIndex);
assert.ok(stripeKeyIndex > webOnlyIndex);
assert.ok(route.includes("adPurchaseSurfaceFromUserAgent"));
assert.ok(route.includes("adCreditPackageForProductId(intent.productId)"));
assert.ok(route.includes('"metadata[payment_kind]": "ad_credit_purchase"'));
assert.ok(route.includes('"metadata[ad_credit_product_id]": productId'));
assert.ok(route.includes("productId: intent.productId"));
assert.ok(route.includes('"metadata[profile_id]": profileId'));
assert.ok(
  /"line_items\[0\]\[price_data\]\[unit_amount\]": String\(\s*creditPackage\.webPriceCents,?\s*\)/s.test(
    route,
  ),
);
assert.ok(
  /checkoutCreationEnabled:\s*stripeCheckoutCreationMasterEnabled\(\)\s*&&\s*adPurchaseSurfaceEnabled\("web"\)/s.test(
    route,
  ),
);
assert.equal(route.includes("calculatePlatformFeeCents"), false);
assert.equal(route.includes("platformFeeDescription"), false);
assert.equal(route.includes("metadata[platform_fee_cents]"), false);
assert.equal(route.includes('payment_kind]": "ad_campaign"'), false);
assert.equal(route.includes('.from("ad_campaigns")'), false);
assert.equal(route.includes("request.formData()"), false);
assert.ok(fees.includes('if (kind === "ad")'));
assert.ok(
  fees.includes("No additional TTC platform fee applies to ad credit purchases."),
);
assert.ok(
  fees.includes("Transparent ${platformFeePercentLabel} TTC application fee deducted from provider funds for booking deposits."),
);
console.log("PASS web checkout buys fixed credits while campaign spend stays ledger-only");

console.log("USER INPUT SECURITY REVIEW: PASS web ad checkout inputs fail closed");
