import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(
  "src/app/account/ad-credit-purchase-options.tsx",
  "utf8",
);
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const appleFlow = component.slice(
  component.indexOf("const verifyAppleTransaction"),
  component.indexOf("const verifyGooglePurchase"),
);
const nativeSetup = component.slice(
  component.indexOf("async function setup"),
  component.indexOf("void setup()"),
);

assert.ok(component.startsWith('"use client";'));
assert.ok(component.includes('registerPlugin<AdPurchasePlugin>("TtcAdPurchases")'));
assert.ok(component.includes('surface === "web"'));
assert.ok(component.includes('action="/api/ads/checkout"'));
assert.ok(component.includes('name="product_id"'));
assert.ok(component.includes("formattedPrice"));
assert.ok(component.includes("displayPrice"));
assert.ok(component.includes("plugin.getProducts()"));
assert.ok(component.includes("plugin.recoverTransactions()"));
assert.ok(component.includes("plugin.queryPurchases()"));
assert.ok(component.includes('plugin.addListener("transactionUpdated"'));
assert.ok(component.includes('plugin.addListener("purchasesUpdated"'));
assert.ok(component.includes("await plugin.configureAccount({ profileId })"));
assert.ok(component.includes("void plugin.clearAccount({ profileId })"));
assert.ok(
  nativeSetup.indexOf("if (cancelled) return") <
    nativeSetup.indexOf("await plugin.configureAccount({ profileId })"),
);
assert.ok(component.includes("profileId,"));
assert.ok(component.includes('postPurchase("/api/ads/purchases/apple"'));
assert.ok(component.includes('postPurchase("/api/ads/purchases/google"'));
assert.ok(component.includes("grantId: grant.grantId"));
assert.ok(component.includes("signedTransactionJWS: transaction.signedTransactionJWS"));
assert.equal(component.includes("serverGrantConfirmed"), false);
assert.ok(
  appleFlow.indexOf('postPurchase("/api/ads/purchases/apple"') <
    appleFlow.indexOf("plugin.finishTransaction"),
);
assert.ok(component.includes("signedTransaction: transaction.signedTransactionJWS"));
assert.ok(component.includes("Retry purchase verification"));
assert.ok(component.includes("await plugin.recoverTransactions()"));
assert.equal(component.includes("STRIPE_SECRET_KEY"), false);
assert.equal(component.includes("creditCents:"), false);
console.log("PASS native ad purchase UI grants on the server before iOS finish");

assert.ok(accountPage.includes('import { headers } from "next/headers"'));
assert.ok(accountPage.includes("adPurchaseSurfaceFromUserAgent"));
assert.ok(accountPage.includes("adPurchaseSurfaceEnabled"));
assert.ok(accountPage.includes("<AdCreditPurchaseOptions"));
assert.ok(accountPage.includes('credit_origin, expires_at'));
assert.ok(
  accountPage.includes('.or("expires_at.is.null,expires_at.gte.now")'),
);
assert.equal(accountPage.includes("const adCreditNow = Date.now()"), false);
assert.ok(accountPage.includes("Purchased credit"));
assert.ok(accountPage.includes("Promotional credit"));
assert.ok(/Purchased credit does\s+not expire\./.test(accountPage));
assert.ok(accountPage.includes("adPurchaseEnabled &&"));
assert.ok(accountPage.includes("adCreditBalanceCents >= campaign.daily_budget_cents"));
assert.equal(accountPage.includes("AD_PURCHASES_AVAILABLE"), false);
assert.equal(accountPage.includes("Pay ${dollars(campaign.daily_budget_cents)} ad budget"), false);
const campaignInsert = accountActions.slice(
  accountActions.indexOf('.from("ad_campaigns")'),
  accountActions.indexOf('.from("ad_campaign_placements")'),
);
assert.ok(campaignInsert.includes("platform_fee_cents: 0"));
assert.ok(campaignInsert.includes("prepaid_amount_cents: 0"));
console.log("PASS Account separates purchase surfaces, credit origins, and campaign spend");
