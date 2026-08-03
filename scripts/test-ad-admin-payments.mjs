import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/admin/payments/page.tsx", "utf8");

assert.ok(page.includes('import { adPurchaseSurfaceEnabled } from "@/lib/commerce-launch";'));
assert.ok(page.includes("type PurchasedAdCreditRecord ="));
assert.ok(page.includes("const purchasedAdCreditLimit = 25;"));

const originsMatch = page.match(
  /const purchasedAdCreditOrigins = \[(.*?)\] as const;/s,
);
assert.ok(originsMatch, "purchased-credit origin allowlist must be explicit");
const allowedOrigins = [...originsMatch[1].matchAll(/"([a-z_]+)"/g)].map(
  (match) => match[1],
);
assert.deepEqual(allowedOrigins, ["stripe_web", "apple_iap", "google_play"]);

for (const rejectedOrigin of [
  "promo",
  "stripe_web,apple_iap",
  "stripe_web) OR true--",
  "STRIPE_WEB",
  " stripe_web",
  "stripe_web ",
  "",
]) {
  assert.equal(
    allowedOrigins.includes(rejectedOrigin),
    false,
    `malicious or non-purchase origin must fail closed: ${rejectedOrigin}`,
  );
}
console.log("PASS purchased-credit origins use an exact fail-closed allowlist");

const queryStart = page.indexOf('.from("ad_credit_ledger")');
const queryEnd = page.indexOf(".returns<PurchasedAdCreditRecord[]>()", queryStart);
assert.ok(queryStart >= 0 && queryEnd > queryStart, "purchased-credit query is present");
const purchaseQuery = page.slice(queryStart, queryEnd);

for (const field of [
  "id",
  "amount_cents",
  "used_cents",
  "status",
  "created_at",
  "credit_origin",
  "provider_product_id",
  "refundable_cents",
  "display_name",
  "username",
]) {
  assert.ok(purchaseQuery.includes(field), `query selects ${field}`);
}
assert.equal(purchaseQuery.includes("provider_transaction_id"), false);
assert.ok(purchaseQuery.includes('.in("credit_origin", purchasedAdCreditOrigins)'));
assert.ok(purchaseQuery.includes('.order("created_at", { ascending: false })'));
assert.ok(purchaseQuery.includes(".limit(purchasedAdCreditLimit)"));
assert.equal(purchaseQuery.includes("activeSearch"), false);
assert.equal(purchaseQuery.includes("searchParams"), false);
console.log("PASS service-role ledger query is bounded, minimal, and input-independent");

assert.ok(page.includes("purchasedAdCreditsError,"));
const errorBoundary = page.slice(
  page.indexOf("const paymentDataErrors = ["),
  page.indexOf("].filter(Boolean);", page.indexOf("const paymentDataErrors = [")),
);
assert.ok(errorBoundary.includes("purchasedAdCreditsError"));
assert.ok(page.includes("const paymentDataUnavailable = paymentDataErrors.length > 0;"));
console.log("PASS purchased-credit query errors feed the existing fail-closed page state");

for (const [surface, label] of [
  ["web", "Web"],
  ["ios", "iOS"],
  ["android", "Android"],
]) {
  assert.ok(page.includes(`surface: "${surface}"`));
  assert.ok(page.includes(`label: "${label}"`));
}
assert.ok(page.includes("adPurchaseSurfaceEnabled(gate.surface)"));
assert.ok(page.includes("Ad purchase release gates"));
assert.ok(page.includes("Enabled"));
assert.ok(page.includes("Blocked"));
assert.ok(page.includes('"google_play_refund_review_neutral"'));
assert.ok(page.includes('return "Google Play neutral refund review"'));
console.log("PASS all three release gates render sanitized state only");

const sectionStart = page.indexOf("Purchased ad credits");
const sectionEnd = page.indexOf("Ad purchase release gates", sectionStart);
assert.ok(sectionStart >= 0 && sectionEnd > sectionStart);
const purchaseSection = page.slice(sectionStart, sectionEnd);
for (const text of [
  "Purchase origin",
  "Product",
  "Amount",
  "Used",
  "Remaining",
  "Refundable",
  "Status",
  "Created",
]) {
  assert.ok(purchaseSection.includes(text));
}
for (const forbidden of ["<form", "<button", "<input", "action="]) {
  assert.equal(purchaseSection.includes(forbidden), false);
}
assert.equal(purchaseSection.includes("provider_transaction_id"), false);
assert.ok(
  page.includes(
    "Refunds and reconciliation remain operator-reviewed; this view has no direct payment actions.",
  ),
);
console.log("PASS purchased-credit visibility is read-only and operator-reviewed");
