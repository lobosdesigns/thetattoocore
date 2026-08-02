import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
for (const [label, value] of [
  ["boolean", false],
  ["number", 123],
  ["object", {}],
  ["array", []],
]) {
  assertModuleValue(
    validateSellerCheckoutUrl(value),
    { ok: false, code: "invalid" },
    `expected ${label} checkout URL to be rejected`,
  );
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
  [{ TTC_SELLER_CHECKOUT_LINKS_ENABLED: "false" }, false],
  [{ TTC_SELLER_CHECKOUT_LINKS_ENABLED: "trueish" }, false],
  [{ TTC_SELLER_CHECKOUT_LINKS_ENABLED: " TRUE " }, false],
  [{ TTC_SELLER_CHECKOUT_LINKS_ENABLED: "TRUE" }, false],
  [{ TTC_SELLER_CHECKOUT_LINKS_ENABLED: true }, false],
  [{ TTC_SELLER_CHECKOUT_LINKS_ENABLED: {} }, false],
  [{ STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: "true" }, false],
  [{ TTC_SELLER_CHECKOUT_LINKS_ENABLED: "true" }, true],
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
  ["malformed official-product boolean", { isOfficial: 0 }, "official_product"],
  ["unverified seller", { sellerVerified: false }, "seller_unverified"],
  ["malformed seller-verification boolean", { sellerVerified: "false" }, "seller_unverified"],
  ["sold-out product", { inventoryReserved: 10 }, "sold_out"],
  ["over-reserved inventory", { inventoryQuantity: 2, inventoryReserved: 3 }, "sold_out"],
  ["non-finite inventory quantity", { inventoryQuantity: Infinity }, "sold_out"],
  ["NaN inventory quantity", { inventoryQuantity: Number.NaN }, "sold_out"],
  ["negative inventory quantity", { inventoryQuantity: -1 }, "sold_out"],
  ["fractional inventory quantity", { inventoryQuantity: 2.5 }, "sold_out"],
  ["non-number inventory quantity", { inventoryQuantity: "10" }, "sold_out"],
  [
    "unsafe integer inventory quantity",
    { inventoryQuantity: Number.MAX_SAFE_INTEGER + 1 },
    "sold_out",
  ],
  ["non-finite reserved inventory", { inventoryReserved: Infinity }, "sold_out"],
  ["NaN reserved inventory", { inventoryReserved: Number.NaN }, "sold_out"],
  ["negative reserved inventory", { inventoryReserved: -1 }, "sold_out"],
  ["fractional reserved inventory", { inventoryReserved: 2.5 }, "sold_out"],
  ["non-number reserved inventory", { inventoryReserved: "2" }, "sold_out"],
  [
    "unsafe integer reserved inventory",
    { inventoryReserved: Number.MAX_SAFE_INTEGER + 1 },
    "sold_out",
  ],
  ["missing terms", { sellerCheckoutTermsVersion: null }, "missing_terms"],
  [
    "9-character fulfillment notes",
    { fulfillmentNotes: " 123456789 " },
    "missing_fulfillment",
  ],
  [
    "9-character return policy",
    { returnPolicy: " 123456789 " },
    "missing_fulfillment",
  ],
  ["missing ship-from city", { shipsFromCity: null }, "missing_fulfillment"],
  ["missing ship-from region", { shipsFromRegion: null }, "missing_fulfillment"],
  ["malformed shipping-required boolean", { shippingRequired: 0 }, "missing_fulfillment"],
  ["invalid URL", { externalCheckoutUrl: "https://buy.stripe.com/test_123" }, "invalid_url"],
  ["non-string URL", { externalCheckoutUrl: 123 }, "invalid_url"],
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
  { ready: false, reason: "disabled", url: null },
);
assertModuleValue(
  sellerCheckoutPurchaseReadiness(readyInput, {
    TTC_SELLER_CHECKOUT_LINKS_ENABLED: "true",
  }),
  { ready: true, reason: null, url: validLiveUrl },
);
assertModuleValue(
  sellerCheckoutPurchaseReadiness(
    { ...readyInput, status: "inactive" },
    { TTC_SELLER_CHECKOUT_LINKS_ENABLED: "true" },
  ),
  { ready: false, reason: "not_active", url: null },
);
assertModuleValue(
  sellerCheckoutPurchaseReadiness(
    { ...readyInput, moderationStatus: "hidden" },
    { TTC_SELLER_CHECKOUT_LINKS_ENABLED: "true" },
  ),
  { ready: false, reason: "not_moderated", url: null },
);
console.log("PASS public purchase readiness");

function readSource(path) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

const actionsSource = readSource("src/app/actions.ts");
const composerSource = readSource("src/app/floating-composer.tsx");
const merchPageSource = readSource("src/app/merch/[id]/page.tsx");
const sellerCheckoutFieldsSource = existsSync("src/app/merch/seller-checkout-fields.tsx")
  ? readSource("src/app/merch/seller-checkout-fields.tsx")
  : "";

function actionBody(name) {
  const start = actionsSource.indexOf(`export async function ${name}`);
  if (start === -1) return "";

  const next = actionsSource.indexOf("\nexport async function ", start + 1);
  return actionsSource.slice(start, next === -1 ? undefined : next);
}

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return "";

  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end === -1 ? undefined : end);
}

function occurrenceCount(source, value) {
  return source.split(value).length - 1;
}

function consoleErrorCalls(source) {
  return [...source.matchAll(/console\.error\(([\s\S]*?)\);/g)].map((match) => match[1]);
}

const createMerchProduct = actionBody("createMerchProduct");
const editMerchProduct = actionBody("editMerchProduct");
const uploadMerchMedia = sourceSection(
  actionsSource,
  "async function uploadMerchMedia",
  "async function cleanupCreatedMerchProduct",
);
const createMerchForm = sourceSection(
  composerSource,
  "action={createMerchProduct}",
  "</form>",
);
const editMerchForm = sourceSection(
  merchPageSource,
  "<form action={editMerchProduct}",
  "</form>",
);
const checkoutValidationPattern =
  /validateSellerCheckoutUrl\(\s*formData\.get\("external_checkout_url"\),?\s*\)/;
const checkoutMessages = [
  "Add a live Stripe Payment Link for this Merch product.",
  "Stripe Payment Link must be 500 characters or fewer.",
  "Add a valid Stripe Payment Link from buy.stripe.com.",
  "Use a live Stripe Payment Link, not a test link.",
];
const sourceContractFailures = [];

function sourceContract(label, ok) {
  if (!ok) sourceContractFailures.push(label);
}

for (const [label, source] of [
  ["create", createMerchProduct],
  ["edit", editMerchProduct],
]) {
  sourceContract(
    `${label} reads the checkout URL exactly once from FormData`,
    occurrenceCount(source, 'formData.get("external_checkout_url")') === 1,
  );
  sourceContract(
    `${label} reads seller acceptance exactly once and requires checkbox value on`,
    occurrenceCount(source, 'formData.get("seller_checkout_terms_accepted")') === 1 &&
      source.includes(
        'formData.get("seller_checkout_terms_accepted") === "on"',
      ),
  );
  sourceContract(
    `${label} does not trust acceptance version or timestamp from FormData`,
    !source.includes('formData.get("seller_checkout_terms_version")') &&
      !source.includes('formData.get("seller_checkout_terms_accepted_at")'),
  );
  sourceContract(
    `${label} validates a live checkout URL`,
    checkoutValidationPattern.test(source) && !source.includes("allowTest"),
  );
  sourceContract(
    `${label} maps checkout validation failures to fixed member messages`,
    ["required", "too_long", "invalid", "test_link"].every((code) =>
      source.includes(`case "${code}"`),
    ) && checkoutMessages.every((message) => source.includes(message)),
  );
  sourceContract(
    `${label} writes trusted current acceptance fields`,
    source.includes("external_checkout_url: checkoutResult.url") &&
      source.includes("seller_checkout_terms_accepted_at: null") &&
      source.includes("seller_checkout_terms_version: SELLER_CHECKOUT_TERMS_VERSION"),
  );
  sourceContract(
    `${label} requires fulfillment and return text for every product`,
    source.includes("if (fulfillmentNotes.length < 10)") &&
      source.includes("if (returnPolicy.length < 10)") &&
      !source.includes("if (shippingRequired && fulfillmentNotes.length < 10)"),
  );
  sourceContract(
    `${label} requires ship-from city and region only for shipped products`,
    source.includes("if (shippingRequired && (!shipsFromCity || !shipsFromRegion))"),
  );
  sourceContract(
    `${label} logs only fixed Merch failure labels`,
    consoleErrorCalls(source).every((argumentsSource) => !argumentsSource.includes(",")),
  );
}

const createInsert = sourceSection(
  createMerchProduct,
  '.from("merch_products")\n    .insert({',
  '.select("id")',
);
const createTrustedUpdate = sourceSection(
  createMerchProduct,
  "let checkoutProduct",
  "if (checkoutError || !checkoutProduct)",
);
const cleanupCreatedMerchProduct = sourceSection(
  actionsSource,
  "async function cleanupCreatedMerchProduct",
  "async function uploadCommentMedia",
);
const sellerCleanupDelete = sourceSection(
  cleanupCreatedMerchProduct,
  'const result = await supabase\n      .from("merch_products")\n      .delete()',
  "if (deleteError || !deletedProduct)",
);
const adminCleanupFallback = sourceSection(
  cleanupCreatedMerchProduct,
  'const result = await adminClient\n        .from("merch_products")\n        .update({',
  "if (cleanupError || !cleanedProduct)",
);
const adminCleanupFields = sourceSection(
  adminCleanupFallback,
  ".update({",
  '})\n        .eq("id", productId)',
);
sourceContract(
  "create authenticates and verifies a professional seller",
  createMerchProduct.includes("await requireProfile()") &&
    createMerchProduct.includes("if (!isVerifiedProfessional(profile))"),
);
sourceContract(
  "create inserts a seller-owned pending product without protected fields",
  createInsert.includes("seller_id: userId") &&
    createInsert.includes('status: "pending_review"') &&
    !createInsert.includes("external_checkout_url") &&
    !createInsert.includes("seller_checkout_terms_version") &&
    !createInsert.includes("seller_checkout_terms_accepted_at"),
);
sourceContract(
  "create proves admin availability before insert and media inspection",
  createMerchProduct.indexOf("createAdminClient()") !== -1 &&
    createMerchProduct.indexOf("createAdminClient()") <
      createMerchProduct.indexOf('.from("merch_products")\n    .insert({') &&
    createMerchProduct.indexOf("createAdminClient()") <
      createMerchProduct.indexOf("inspectMediaFile(media)"),
);
sourceContract(
  "create validates checkout and fulfillment before media inspection or product insert",
  createMerchProduct.indexOf("const checkoutResult = validateSellerCheckoutUrl") !== -1 &&
    createMerchProduct.indexOf("const checkoutResult = validateSellerCheckoutUrl") <
      createMerchProduct.indexOf("inspectMediaFile(media)") &&
    createMerchProduct.indexOf("if (fulfillmentNotes.length < 10)") <
      createMerchProduct.indexOf("inspectMediaFile(media)") &&
    createMerchProduct.indexOf("inspectMediaFile(media)") <
      createMerchProduct.indexOf('.from("merch_products")\n    .insert({'),
);
sourceContract(
  "create trusted follow-up is limited by product and seller IDs before media upload",
  createTrustedUpdate.includes('.eq("id", product.id)') &&
    createTrustedUpdate.includes('.eq("seller_id", userId)') &&
    createTrustedUpdate.includes('.select("id")') &&
    createTrustedUpdate.includes(".maybeSingle<{ id: string }>()") &&
    createMerchProduct.indexOf("let checkoutProduct") <
      createMerchProduct.indexOf("uploadMerchMedia({"),
);
sourceContract(
  "create cleanup attempts seller delete first and proves an affected row",
  occurrenceCount(createMerchProduct, "cleanupCreatedMerchProduct({") === 3 &&
    sellerCleanupDelete.includes('.eq("id", productId)') &&
    sellerCleanupDelete.includes('.eq("seller_id", userId)') &&
    sellerCleanupDelete.includes('.select("id")') &&
    sellerCleanupDelete.includes(".maybeSingle<{ id: string }>()") &&
    cleanupCreatedMerchProduct.indexOf(".delete()") <
      cleanupCreatedMerchProduct.indexOf("const result = await adminClient"),
);
sourceContract(
  "create cleanup uses the scoped admin client to archive and clear checkout state",
  cleanupCreatedMerchProduct.includes(
    "adminClient: NonNullable<ReturnType<typeof createAdminClient>>",
  ) &&
    adminCleanupFallback.includes("external_checkout_url: null") &&
    adminCleanupFallback.includes("is_indexable: false") &&
    adminCleanupFallback.includes("seller_checkout_terms_accepted_at: null") &&
    adminCleanupFallback.includes("seller_checkout_terms_version: null") &&
    adminCleanupFallback.includes('status: "archived"') &&
    adminCleanupFallback.includes('.eq("id", productId)') &&
    adminCleanupFallback.includes('.eq("seller_id", userId)') &&
    adminCleanupFallback.includes('.select("id")') &&
    adminCleanupFallback.includes(".maybeSingle<{ id: string }>()"),
);
sourceContract(
  "create cleanup admin fallback changes only the five fail-closed fields",
  JSON.stringify(
    [...adminCleanupFields.matchAll(/^\s+([a-z_]+):/gm)]
      .map((match) => match[1])
      .sort(),
  ) ===
    JSON.stringify(
      [
        "external_checkout_url",
        "is_indexable",
        "seller_checkout_terms_accepted_at",
        "seller_checkout_terms_version",
        "status",
      ].sort(),
    ),
);
sourceContract(
  "create cleanup proves admin fallback results and logs only a fixed failure message",
  cleanupCreatedMerchProduct.includes("if (cleanupError || !cleanedProduct)") &&
    cleanupCreatedMerchProduct.includes(
      'console.error("Merch pending-row cleanup failed.")',
    ) &&
    !cleanupCreatedMerchProduct.includes(
      'console.error("Merch pending-row cleanup failed.",',
    ) &&
    occurrenceCount(createMerchProduct, "adminClient,") >= 3,
);
sourceContract(
  "Merch media upload logs only a fixed failure label",
  consoleErrorCalls(uploadMerchMedia).every(
    (argumentsSource) => !argumentsSource.includes(","),
  ),
);

sourceContract(
  "edit re-reads product ownership and rejects other sellers and official TTC products",
  editMerchProduct.includes('.from("merch_products")') &&
    editMerchProduct.includes('.eq("id", productId)') &&
    editMerchProduct.includes("if (product.seller_id !== userId)") &&
    editMerchProduct.includes("if (product.is_official)"),
);
sourceContract(
  "edit verifies the seller and keeps review transitions fail closed",
  editMerchProduct.includes("if (!isVerifiedProfessional(product.profiles))") &&
    editMerchProduct.includes('product.status === "active" || product.status === "approved"') &&
    editMerchProduct.includes('? "pending_review"') &&
    editMerchProduct.includes("is_indexable: false"),
);
sourceContract(
  "edit trusted update is limited by product and seller IDs",
  editMerchProduct.includes('.eq("id", productId)') &&
    editMerchProduct.includes('.eq("seller_id", userId)') &&
    editMerchProduct.includes('.select("id")') &&
    editMerchProduct.includes(".maybeSingle<{ id: string }>()"),
);
sourceContract(
  "edit validates checkout and fulfillment before the trusted product update",
  editMerchProduct.indexOf("const checkoutResult = validateSellerCheckoutUrl") !== -1 &&
    editMerchProduct.indexOf("const checkoutResult = validateSellerCheckoutUrl") <
      editMerchProduct.indexOf("const adminClient") &&
    editMerchProduct.indexOf("if (fulfillmentNotes.length < 10)") <
      editMerchProduct.indexOf("const adminClient"),
);

sourceContract(
  "shared seller checkout fieldset exports the approved nullable default interface",
  sellerCheckoutFieldsSource.includes("export function SellerCheckoutFields({") &&
    sellerCheckoutFieldsSource.includes('defaultUrl = ""') &&
    sellerCheckoutFieldsSource.includes("defaultUrl?: string | null"),
);
sourceContract(
  "shared seller checkout fieldset requires a bounded URL and fresh acceptance",
  sellerCheckoutFieldsSource.includes('name="external_checkout_url"') &&
    sellerCheckoutFieldsSource.includes('type="url"') &&
    sellerCheckoutFieldsSource.includes("maxLength={500}") &&
    occurrenceCount(sellerCheckoutFieldsSource, "required") >= 2 &&
    sellerCheckoutFieldsSource.includes('name="seller_checkout_terms_accepted"') &&
    sellerCheckoutFieldsSource.includes('type="checkbox"') &&
    !sellerCheckoutFieldsSource.includes("defaultChecked"),
);
sourceContract(
  "shared acceptance covers the complete seller responsibility contract",
  [
    "physical product",
    "price",
    "payment",
    "taxes",
    "shipping",
    "fulfillment",
    "returns",
    "refunds",
    "disputes",
    "support",
    "legal compliance",
  ].every((term) => sellerCheckoutFieldsSource.toLowerCase().includes(term)),
);
sourceContract(
  "create form places the shared checkout fields after fulfillment and return inputs",
  createMerchForm.includes("<SellerCheckoutFields />") &&
    createMerchForm.indexOf("<SellerCheckoutFields />") >
      createMerchForm.indexOf('name="return_policy"'),
);
sourceContract(
  "owner edit form loads and passes the protected checkout URL after fulfillment inputs",
  editMerchForm.includes("<SellerCheckoutFields defaultUrl={sellerCheckoutUrl} />") &&
    editMerchForm.indexOf("<SellerCheckoutFields defaultUrl={sellerCheckoutUrl} />") >
      editMerchForm.indexOf('name="return_policy"') &&
    merchPageSource.includes("createAdminClient()") &&
    merchPageSource.includes('.select("external_checkout_url")') &&
    merchPageSource.includes('.eq("id", product.id)') &&
    merchPageSource.includes('.eq("seller_id", claims.sub)'),
);
const ownerCheckoutQuery = sourceSection(
  merchPageSource,
  "if (isOwnProduct && !product.is_official && claims?.sub)",
  "const checkoutFlow",
);
sourceContract(
  "protected checkout URL query runs only for the exact authenticated non-official owner",
  merchPageSource.includes("const isOwnProduct = claims?.sub === product.seller_id") &&
    ownerCheckoutQuery.includes("createAdminClient()") &&
    ownerCheckoutQuery.includes('.select("external_checkout_url")') &&
    ownerCheckoutQuery.includes('.eq("id", product.id)') &&
    ownerCheckoutQuery.includes('.eq("seller_id", claims.sub)') &&
    ownerCheckoutQuery.includes("if (!checkoutError && checkoutRow)") &&
    !consoleErrorCalls(ownerCheckoutQuery).length,
);

if (sourceContractFailures.length > 0) {
  for (const label of sourceContractFailures) {
    console.error(`FAIL ${label}`);
  }
  process.exitCode = 1;
} else {
  console.log("PASS seller checkout Server Action and form contracts");
}
