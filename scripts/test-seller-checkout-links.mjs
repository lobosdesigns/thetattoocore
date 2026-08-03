import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import vm from "node:vm";
import ts from "typescript";
import {
  RedirectSignal,
  createSupabaseDouble,
  importTypeScriptWithStubs,
  makeForm,
  testIds,
} from "./admin-module-test-harness.mjs";

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
const { isVerifiedArtistOrShop, isVerifiedProfessional } =
  await importTypeScriptWithStubs("src/lib/verification.ts", {});
const {
  inspectMediaFile: inspectRealMediaFile,
  validateMediaMetadata: validateRealMediaMetadata,
} = await importTypeScriptWithStubs("src/lib/media/metadata.ts", {});

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
let adminActionsSource = readSource("src/app/admin/actions.ts");
let adminMerchPageSource = readSource("src/app/admin/merch/page.tsx");
const adminOverviewSource = readSource("src/app/admin/page.tsx");
const composerSource = readSource("src/app/floating-composer.tsx");
let merchPageSource = readSource("src/app/merch/[id]/page.tsx");
let sellerCheckoutDialogSource = existsSync(
  "src/app/merch/seller-checkout-dialog.tsx",
)
  ? readSource("src/app/merch/seller-checkout-dialog.tsx")
  : "";
const sellerCheckoutFieldsSource = existsSync("src/app/merch/seller-checkout-fields.tsx")
  ? readSource("src/app/merch/seller-checkout-fields.tsx")
  : "";
const productCardSources = [
  "src/app/page.tsx",
  "src/app/merch/page.tsx",
  "src/app/search/page.tsx",
  "src/app/saved/page.tsx",
  "src/app/u/[username]/page.tsx",
].map((path) => ({ path, source: readSource(path) }));

function replaceMutation(source, search, replacement, expectedCount = 1) {
  const actualCount = source.split(search).length - 1;
  assert.equal(
    actualCount,
    expectedCount,
    "Mutation target count changed for " + JSON.stringify(search),
  );
  return source.split(search).join(replacement);
}

const task4SourceMutations = {
  "reverse-native-platform-guard": () => {
    sellerCheckoutDialogSource = replaceMutation(
      sellerCheckoutDialogSource,
      "if (!Capacitor.isNativePlatform()) return;",
      "if (Capacitor.isNativePlatform()) return;",
    );
  },
  "unconditional-admin-read": () => {
    merchPageSource = replaceMutation(
      merchPageSource,
      "if (canReadSellerCheckout) {",
      "if (true) {",
    );
  },
  "unsafe-product-title-html": () => {
    merchPageSource = replaceMutation(
      merchPageSource,
      '<h1 className="text-2xl font-bold">{product.title}</h1>',
      '<h1 className="text-2xl font-bold" dangerouslySetInnerHTML={{ __html: product.title }} />',
    );
  },
  "unsafe-seller-name-html": () => {
    sellerCheckoutDialogSource = replaceMutation(
      sellerCheckoutDialogSource,
      '<strong className="text-[var(--foreground)]">{sellerName}</strong>.',
      '<strong className="text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: sellerName }} />.',
    );
  },
};

const task4MutationName = process.env.TTC_SELLER_CHECKOUT_TASK4_MUTANT;
if (task4MutationName) {
  const mutate = task4SourceMutations[task4MutationName];
  assert.equal(
    typeof mutate,
    "function",
    "Unknown TTC_SELLER_CHECKOUT_TASK4_MUTANT: " + task4MutationName,
  );
  mutate();
}

function mutateAdminMerchStatusAction(source, mutate) {
  const start = source.indexOf("export async function updateMerchProductStatus");
  const end = source.indexOf("export async function updateMerchOrderStatus", start);
  assert.notEqual(start, -1, "Task 6 admin action start was not found");
  assert.notEqual(end, -1, "Task 6 admin action end was not found");

  return source.slice(0, start) + mutate(source.slice(start, end)) + source.slice(end);
}

function forgeAdminMerchPageReadiness(source) {
  const ast = ts.createSourceFile(
    "src/app/admin/merch/page.tsx",
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  const matches = [];

  visitSource(ast, (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "sellerCheckoutReadiness" &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "sellerCheckoutSubmissionReadiness"
    ) {
      matches.push(node.initializer);
    }
  });

  assert.equal(matches.length, 1, "admin page readiness mapping count changed");
  const [readinessCall] = matches;
  const forgedReadiness = `({
      ready: true,
      reason: null,
      url: sellerCheckoutByProduct.get(product.id)?.external_checkout_url ?? null,
    })`;

  return (
    source.slice(0, readinessCall.getStart(ast)) +
    forgedReadiness +
    source.slice(readinessCall.getEnd())
  );
}

const task6SourceMutations = {
  "admin-before-moderator": () => {
    adminActionsSource = mutateAdminMerchStatusAction(adminActionsSource, (source) =>
      replaceMutation(
        source,
        "  const { supabase } = await requireModerator();",
        "  createAdminClient();\n  const { supabase } = await requireModerator();",
      ),
    );
  },
  "bypass-official-rejection": () => {
    adminActionsSource = mutateAdminMerchStatusAction(adminActionsSource, (source) =>
      replaceMutation(
        source,
        'if (status === "active" && product.is_official) {',
        'if (status === "active" && false && product.is_official) {',
      ),
    );
  },
  "bypass-readiness-rejection": () => {
    adminActionsSource = mutateAdminMerchStatusAction(adminActionsSource, (source) =>
      replaceMutation(
        source,
        "if (!checkoutReadiness.ready) {",
        "if (false && !checkoutReadiness.ready) {",
      ),
    );
  },
  "bypass-source-status-guard": () => {
    adminActionsSource = mutateAdminMerchStatusAction(adminActionsSource, (source) =>
      replaceMutation(
        source,
        'if (status === "active" && product.status !== "approved") {',
        'if (status === "active" && false && product.status !== "approved") {',
      ),
    );
  },
  "bypass-ui-source-status-guard": () => {
    adminMerchPageSource = replaceMutation(
      adminMerchPageSource,
      '    product.status === "approved" &&\n    checkoutReadiness.ready;',
      "    true &&\n    checkoutReadiness.ready;",
    );
  },
  "drift-missing-terms-message": () => {
    adminActionsSource = mutateAdminMerchStatusAction(adminActionsSource, (source) =>
      replaceMutation(
        source,
        'checkoutReadiness.reason === "missing_terms"',
        'checkoutReadiness.reason === "invalid_url"',
      ),
    );
  },
  "expose-raw-admin-error": () => {
    adminActionsSource = mutateAdminMerchStatusAction(adminActionsSource, (source) =>
      replaceMutation(
        source,
        'console.error("Admin Merch seller checkout lookup failed.");',
        'console.error("Admin Merch seller checkout lookup failed: " + checkoutError?.message);',
        2,
      ),
    );
  },
  "expose-unvalidated-admin-link": () => {
    adminMerchPageSource = replaceMutation(
      adminMerchPageSource,
      "href={checkoutReadiness.url}",
      "href={product.externalCheckoutUrl}",
    );
  },
  "forged-page-readiness": () => {
    adminMerchPageSource = forgeAdminMerchPageReadiness(adminMerchPageSource);
  },
  "unconditional-admin-link": () => {
    adminMerchPageSource = replaceMutation(
      adminMerchPageSource,
      "{checkoutReadiness.ready ? (",
      "{true ? (",
    );
  },
  "unscoped-admin-action-read": () => {
    adminActionsSource = mutateAdminMerchStatusAction(adminActionsSource, (source) =>
      replaceMutation(source, '      .eq("seller_id", product.seller_id)\n', ""),
    );
  },
  "unscoped-admin-page-read": () => {
    adminMerchPageSource = replaceMutation(
      adminMerchPageSource,
      '      .in("id", productIds)\n',
      "",
    );
  },
};

const task6MutationName = process.env.TTC_SELLER_CHECKOUT_TASK6_MUTANT;
if (task6MutationName) {
  const mutate = task6SourceMutations[task6MutationName];
  assert.equal(
    typeof mutate,
    "function",
    "Unknown TTC_SELLER_CHECKOUT_TASK6_MUTANT: " + task6MutationName,
  );
  mutate();
}

function mutateCreateMerchAction(source, mutate) {
  const start = source.indexOf("export async function createMerchProduct");
  const end = source.indexOf("export async function editMarketplaceListing", start);
  assert.notEqual(start, -1, "create Merch action start was not found");
  assert.notEqual(end, -1, "create Merch action end was not found");

  return source.slice(0, start) + mutate(source.slice(start, end)) + source.slice(end);
}

const actionMutations = {
  "acceptance-bypass": (source) =>
    replaceMutation(
      source,
      "if (!sellerAcceptedCheckoutTerms) {",
      "if (false && !sellerAcceptedCheckoutTerms) {",
      2,
    ),
  "checkout-log-leak": (source) =>
    replaceMutation(
      source,
      'console.error("Merch checkout setup failed.");',
      'console.error("Merch checkout setup failed: " + checkoutResult.url);',
    ),
  "edit-lookup-log-leak": (source) =>
    replaceMutation(
      source,
      'console.error("Merch product edit lookup failed.");',
      'console.error("Merch product edit lookup failed: " + checkoutResult.url);',
    ),
  "forged-edit-seller-id": (source) =>
    replaceMutation(
      source,
      "return_policy: returnPolicy || null,\n      status: nextStatus,",
      'return_policy: returnPolicy || null,\n      seller_id: cleanText(formData.get("seller_id"), 80),\n      status: nextStatus,',
    ),
  "forged-seller-id": (source) =>
    replaceMutation(
      source,
      "seller_id: userId,\n      shipping_required: shippingRequired,",
      'seller_id: cleanText(formData.get("seller_id"), 80),\n      shipping_required: shippingRequired,',
    ),
  "category-allowlist-bypass": (source) =>
    mutateCreateMerchAction(source, (createSource) =>
      replaceMutation(
        createSource,
        'const category = MERCH_CATEGORIES.has(rawCategory) ? rawCategory : "other";',
        "const category = rawCategory;",
      ),
    ),
  "inventory-cap-bypass": (source) =>
    mutateCreateMerchAction(source, (createSource) =>
      replaceMutation(
        createSource,
        "? Math.max(0, Math.min(100000, Math.floor(inventoryNumber)))",
        "? Math.max(0, Math.floor(inventoryNumber))",
      ),
    ),
  "inventory-finite-bypass": (source) =>
    mutateCreateMerchAction(source, (createSource) =>
      replaceMutation(
        createSource,
        "const inventoryQuantity = Number.isFinite(inventoryNumber)",
        "const inventoryQuantity = true",
      ),
    ),
  "media-original-filename-path": (source) =>
    replaceMutation(
      source,
      'const path = `${userId}/merch/${productId}/${crypto.randomUUID()}.${extensionFor(file)}`;',
      'const path = `${userId}/merch/${productId}/${file.name}`;',
    ),
  "media-validation-bypass": (source) =>
    mutateCreateMerchAction(source, (createSource) =>
      replaceMutation(
        createSource,
        "if (validationMessage) {",
        "if (false && validationMessage) {",
      ),
    ),
  "price-cap-bypass": (source) =>
    replaceMutation(
      source,
      "return Math.min(500000, Math.round(parsed * 100));",
      "return Math.round(parsed * 100);",
    ),
  "price-finite-bypass": (source) =>
    replaceMutation(
      source,
      "if (!Number.isFinite(parsed) || parsed <= 0) return 0;",
      "if (parsed <= 0) return 0;",
    ),
  "return-path-control-bypass": (source) =>
    replaceMutation(
      source,
      "if (/[\\u0000-\\u001f\\u007f]/.test(path)) return fallback;",
      "if (false && /[\\u0000-\\u001f\\u007f]/.test(path)) return fallback;",
    ),
  "shipping-boolean-bypass": (source) =>
    replaceMutation(
      source,
      'formData.get("shipping_required") === "on"',
      'Boolean(formData.get("shipping_required"))',
      2,
    ),
  "unbounded-create-title": (source) =>
    mutateCreateMerchAction(source, (createSource) =>
      replaceMutation(
        createSource,
        'const title = cleanText(formData.get("title"), 120);',
        'const title = String(formData.get("title") ?? "").trim();',
      ),
    ),
  "media-attach-log-leak": (source) =>
    replaceMutation(
      source,
      'console.error("Merch media attach failed.");',
      'console.error("Merch media attach failed: " + checkoutResult.url);',
    ),
  "official-edit-bypass": (source) =>
    replaceMutation(
      source,
      "if (product.is_official) {",
      "if (false && product.is_official) {",
      2,
    ),
  "skip-admin-neutralization": (source) =>
    replaceMutation(
      source,
      "if (deleteError || !deletedProduct) {",
      "if (false && (deleteError || !deletedProduct)) {",
    ),
  "submit-log-leak": (source) =>
    replaceMutation(
      source,
      'console.error("Merch product submit failed.");',
      'console.error("Merch product submit failed: " + checkoutResult.url);',
    ),
  "unscoped-edit-lookup": (source) =>
    replaceMutation(
      source,
      '.eq("id", productId)\n    .maybeSingle<{\n      id: string;\n      inventory_reserved: number;\n      is_official: boolean;\n      profiles:',
      '.maybeSingle<{\n      id: string;\n      inventory_reserved: number;\n      is_official: boolean;\n      profiles:',
    ),
  "unscoped-trusted-create": (source) =>
    replaceMutation(
      source,
      '.eq("id", product.id)\n      .eq("seller_id", userId)\n      .select("id")',
      '.eq("id", product.id)\n      .select("id")',
    ),
  "unverified-edit-bypass": (source) =>
    replaceMutation(
      source,
      "if (!isVerifiedProfessional(product.profiles)) {",
      "if (false && !isVerifiedProfessional(product.profiles)) {",
    ),
  "zero-row-admin-neutralization-success": (source) =>
    replaceMutation(
      source,
      "if (cleanupError || !cleanedProduct) {",
      "if (cleanupError) {",
    ),
  "zero-row-create-success": (source) =>
    replaceMutation(
      source,
      "if (checkoutError || !checkoutProduct) {",
      "if (checkoutError) {",
    ),
  "zero-row-edit-success": (source) =>
    replaceMutation(
      source,
      "if (error || !updatedProduct) {",
      "if (error) {",
    ),
  "zero-row-seller-delete-success": (source) =>
    replaceMutation(
      source,
      "if (deleteError || !deletedProduct) {",
      "if (deleteError) {",
    ),
};

function actionSourceForTest() {
  const mutationName = process.env.TTC_SELLER_CHECKOUT_ACTION_MUTANT;

  if (!mutationName) {
    return { cleanup: () => {}, path: "src/app/actions.ts" };
  }

  const mutate = actionMutations[mutationName];
  assert.equal(
    typeof mutate,
    "function",
    "Unknown TTC_SELLER_CHECKOUT_ACTION_MUTANT: " + mutationName,
  );

  const directory = mkdtempSync(join(tmpdir(), "seller-checkout-action-mutant-"));
  const path = join(directory, "actions.ts");
  writeFileSync(path, mutate(actionsSource), "utf8");

  return {
    cleanup() {
      rmSync(directory, { force: true, recursive: true });
    },
    path,
  };
}

const verifiedProfile = {
  account_type: "artist",
  license_verified_at: "2026-08-01T12:00:00.000Z",
};
const productId = testIds.third;
const submittedUrl = "https://buy.stripe.com/a1B2_c3D4";
const forgedAcceptanceVersion = "attacker-controlled-version";
const forgedAcceptanceTimestamp = "1999-12-31T23:59:59.999Z";
const hostileMerchText = {
  description:
    "Description </p><script>alert(1)</script>\r\n' OR 1=1 --\u0001",
  fulfillment_notes:
    'Fulfillment <svg onload=alert(2)>\r\n{"$ne":null}',
  return_policy:
    "Returns </textarea><img src=x onerror=alert(3)>\u0000",
  ships_from_city: "Austin\r\nX-Injected: yes",
  ships_from_region: "TX\u0002<script>alert(4)</script>",
  title: "<img src=x onerror=alert(5)>",
};
const providerSecrets = {
  attach: "provider-attach-row-secret",
  cleanup: "provider-cleanup-row-secret",
  delete: "provider-delete-row-secret",
  edit: "provider-edit-row-secret",
  insert: "provider-insert-row-secret",
  lookup: "provider-lookup-row-secret",
  storage: "provider-storage-row-secret",
  trusted: "provider-trusted-row-secret",
};
const validMetadata = {
  durationSeconds: null,
  height: 640,
  mediaType: "image",
  mimeType: "image/png",
  width: 640,
};

let activeScenario = null;

function option(options, name, fallback) {
  return Object.hasOwn(options, name) ? options[name] : fallback;
}

function createMerchScenario(options = {}) {
  const scenario = {
    adminClientCalls: 0,
    adminClientUnavailable: option(options, "adminClientUnavailable", false),
    claims: option(options, "claims", {
      email: "seller@example.com",
      sub: testIds.actor,
    }),
    createClientCalls: 0,
    editProduct: option(options, "editProduct", {
      id: productId,
      inventory_reserved: 0,
      is_official: false,
      profiles: verifiedProfile,
      seller_id: testIds.actor,
      status: "active",
    }),
    editProductError: option(options, "editProductError", null),
    events: [],
    logs: [],
    mediaAttachResult: option(options, "mediaAttachResult", {
      data: null,
      error: null,
    }),
    mediaInspections: 0,
    realMediaValidation: option(options, "realMediaValidation", false),
    mediaValidationMessage: option(options, "mediaValidationMessage", null),
    neutralizationResult: option(options, "neutralizationResult", {
      data: { id: productId },
      error: null,
    }),
    productInsertResult: option(options, "productInsertResult", {
      data: { id: productId },
      error: null,
    }),
    profile: option(options, "profile", verifiedProfile),
    profileExists: option(options, "profileExists", true),
    revalidatedPaths: [],
    sellerDeleteResult: option(options, "sellerDeleteResult", {
      data: null,
      error: { message: providerSecrets.delete },
    }),
    storageRemovals: [],
    storageUploadResult: option(options, "storageUploadResult", {
      data: { path: "stored" },
      error: null,
    }),
    storageUploads: [],
    trustedCreateResult: option(options, "trustedCreateResult", {
      data: { id: productId },
      error: null,
    }),
    trustedEditResult: option(options, "trustedEditResult", {
      data: { id: productId },
      error: null,
    }),
  };

  const seller = createSupabaseDouble({
    claims: scenario.claims,
    execute(query) {
      scenario.events.push({ client: "seller", query });

      if (
        query.table === "profiles" &&
        query.operation === "select" &&
        query.selection === "id, banned_at, suspended_at"
      ) {
        return {
          data: scenario.profileExists
            ? {
                banned_at: null,
                id: testIds.actor,
                suspended_at: null,
              }
            : null,
          error: null,
        };
      }

      if (
        query.table === "profiles" &&
        query.operation === "select" &&
        query.selection === "account_type, license_verified_at"
      ) {
        return { data: scenario.profile, error: null };
      }

      if (query.table === "merch_products" && query.operation === "insert") {
        return scenario.productInsertResult;
      }

      if (query.table === "merch_products" && query.operation === "select") {
        return {
          data: scenario.editProduct,
          error: scenario.editProductError,
        };
      }

      if (query.table === "merch_products" && query.operation === "delete") {
        return scenario.sellerDeleteResult;
      }

      if (query.table === "merch_product_media" && query.operation === "insert") {
        return scenario.mediaAttachResult;
      }

      throw new Error(
        "Unexpected seller query: " + String(query.operation) + " " + query.table,
      );
    },
  });
  seller.client.storage = {
    from(bucket) {
      return {
        async remove(paths) {
          scenario.storageRemovals.push({ bucket, paths });
          scenario.events.push({ bucket, paths, type: "storage-remove" });
          return { data: null, error: null };
        },
        async upload(path, file, options) {
          scenario.storageUploads.push({ bucket, file, options, path });
          scenario.events.push({ bucket, path, type: "storage-upload" });
          return scenario.storageUploadResult;
        },
      };
    },
  };

  const admin = createSupabaseDouble({
    claims: null,
    execute(query) {
      scenario.events.push({ client: "admin", query });

      if (query.table !== "merch_products" || query.operation !== "update") {
        throw new Error(
          "Unexpected admin query: " + String(query.operation) + " " + query.table,
        );
      }

      if (query.payload?.status === "archived") {
        return scenario.neutralizationResult;
      }

      if (
        Object.keys(query.payload ?? {}).length === 3 &&
        Object.hasOwn(query.payload ?? {}, "seller_checkout_terms_version")
      ) {
        return scenario.trustedCreateResult;
      }

      return scenario.trustedEditResult;
    },
  });

  scenario.admin = admin;
  scenario.seller = seller;
  return scenario;
}

function withScenario(options, callback) {
  const previousScenario = activeScenario;
  const scenario = createMerchScenario(options);
  activeScenario = scenario;

  return Promise.resolve()
    .then(() => callback(scenario))
    .finally(() => {
      activeScenario = previousScenario;
    });
}

function currentScenario() {
  assert.ok(activeScenario, "Action test stub used without an active scenario");
  return activeScenario;
}

async function loadMerchActions(path) {
  const actionConsole = {
    debug() {},
    error(...args) {
      currentScenario().logs.push(args);
    },
    info() {},
    log() {},
    warn() {},
  };

  return importTypeScriptWithStubs(
    path,
    {
      "@/lib/feed-post-publish": {
        publishFeedPostWithRequiredMedia: async () => ({ error: null }),
        settlePublishedFeedPostTags: async () => {},
      },
      "@/lib/media/metadata": {
        async inspectMediaFile(file) {
          const scenario = currentScenario();
          scenario.mediaInspections += 1;
          scenario.events.push({ type: "media-inspection" });
          if (scenario.realMediaValidation) {
            return inspectRealMediaFile(file);
          }
          return validMetadata;
        },
        validateMediaMetadata(metadata) {
          const scenario = currentScenario();
          return scenario.realMediaValidation
            ? validateRealMediaMetadata(metadata)
            : scenario.mediaValidationMessage;
        },
      },
      "@/lib/merch/seller-checkout": {
        SELLER_CHECKOUT_TERMS_VERSION,
        validateSellerCheckoutUrl,
      },
      "@/lib/notifications": {
        allowsInAppNotification: () => false,
        notificationPreferenceSelect: () => "notification_preferences",
      },
      "@/lib/notification-write": {
        insertNotifications: async () => ({ error: null }),
      },
      "@/lib/payments/fees": {
        calculatePlatformFeeCents: () => 0,
      },
      "@/lib/supabase/admin": {
        createAdminClient() {
          const scenario = currentScenario();
          scenario.adminClientCalls += 1;
          scenario.events.push({ type: "admin-client" });

          if (scenario.adminClientUnavailable) {
            throw new Error("admin unavailable");
          }

          return scenario.admin.client;
        },
      },
      "@/lib/supabase/server": {
        async createClient() {
          const scenario = currentScenario();
          scenario.createClientCalls += 1;
          return scenario.seller.client;
        },
      },
      "@/lib/tag-audience": {
        resolveEligibleTaggedProfiles: async () => [],
      },
      "@/lib/urls": {
        cleanExternalUrl: (value) => String(value ?? ""),
      },
      "@/lib/verification": {
        isVerifiedArtistOrShop,
        isVerifiedProfessional,
      },
      "next/cache": {
        revalidatePath(pathname) {
          currentScenario().revalidatedPaths.push(pathname);
        },
      },
      "next/navigation": {
        redirect(location) {
          throw new RedirectSignal(String(location));
        },
      },
    },
    {
      console: actionConsole,
      globals: { File },
    },
  );
}

function validCreateForm(changes = {}) {
  const values = {
    category: "apparel",
    description: "A heavyweight seller-owned shirt with durable printing.",
    external_checkout_url: submittedUrl,
    fulfillment_notes: "Ships within five business days with tracking.",
    inventory_quantity: "12",
    is_indexable: "true",
    is_official: "true",
    price: "35.00",
    return_policy: "Returns accepted within thirty days of delivery.",
    seller_checkout_terms_accepted: "on",
    seller_checkout_terms_accepted_at: forgedAcceptanceTimestamp,
    seller_checkout_terms_version: forgedAcceptanceVersion,
    seller_id: testIds.other,
    shipping_required: "on",
    ships_from_city: "Austin",
    ships_from_region: "TX",
    status: "active",
    title: "Seller-owned shirt",
    ...changes,
  };
  const media = Object.hasOwn(changes, "media")
    ? changes.media
    : new File(["fake png"], "shirt.png", { type: "image/png" });
  delete values.media;
  const formData = makeForm(values);

  if (media) {
    formData.set("media", media);
  }

  return formData;
}

function validEditForm(changes = {}) {
  return makeForm({
    category: "apparel",
    description: "Updated seller-owned merchandise details.",
    external_checkout_url: submittedUrl,
    fulfillment_notes: "Ships within five business days with tracking.",
    inventory_quantity: "12",
    price: "35.00",
    product_id: productId,
    return_path: "/merch/" + productId,
    return_policy: "Returns accepted within thirty days of delivery.",
    seller_checkout_terms_accepted: "on",
    seller_checkout_terms_accepted_at: forgedAcceptanceTimestamp,
    seller_checkout_terms_version: forgedAcceptanceVersion,
    seller_id: testIds.other,
    shipping_required: "on",
    ships_from_city: "Austin",
    ships_from_region: "TX",
    status: "active",
    title: "Updated seller-owned shirt",
    ...changes,
  });
}

function formWithEntry(formData, name, value) {
  if (value === undefined) {
    formData.delete(name);
  } else {
    formData.set(name, value);
  }
  return formData;
}

function pngBytes(size = 24) {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes[19] = 1;
  bytes[23] = 1;
  return bytes;
}

function pngFile(name = "product.png", type = "image/png", size = 24) {
  return new File([pngBytes(size)], name, { type });
}

async function redirectedBy(action, formData) {
  let outcome;

  try {
    await action(formData);
  } catch (error) {
    outcome = error;
  }

  assert.ok(
    outcome instanceof RedirectSignal,
    "Expected a fixed redirect, received " + String(outcome),
  );
  return outcome.location;
}

function homeRedirect(message) {
  return "/?message=" + encodeURIComponent(message) + "#merch";
}

function editRedirect(message) {
  return "/merch/" + productId + "?message=" + encodeURIComponent(message);
}

function actionQueries(scenario, client, table, operation) {
  return scenario[client].queries.filter(
    (query) => query.table === table && query.operation === operation,
  );
}

function productInsertPayload(scenario) {
  const inserts = actionQueries(scenario, "seller", "merch_products", "insert");
  assert.equal(inserts.length, 1, "expected one parameterized Merch product insert");
  return inserts[0].payload;
}

function assertQueryFilters(query, expected, label) {
  assertModuleValue(query.filters, expected, label);
}

function logText(scenario) {
  return scenario.logs
    .flat()
    .map((value) => {
      if (value && typeof value === "object" && "message" in value) {
        return String(value.message);
      }

      return String(value);
    })
    .join("\n");
}

function assertNoSensitiveOutput(scenario, location, values) {
  const output = location + "\n" + logText(scenario);

  for (const value of values) {
    assert.equal(
      output.includes(value),
      false,
      "Redirect or log leaked hostile/provider value: " + value,
    );
  }
}

function assertValidationStopped(scenario) {
  assert.equal(scenario.adminClientCalls, 0, "validation reached the admin client");
  assert.equal(scenario.mediaInspections, 0, "validation reached media inspection");
  assert.equal(scenario.storageUploads.length, 0, "validation reached media upload");
  assert.equal(
    actionQueries(scenario, "seller", "merch_products", "insert").length,
    0,
    "validation reached product insertion",
  );
  assert.equal(
    actionQueries(scenario, "admin", "merch_products", "update").length,
    0,
    "validation reached a trusted write",
  );
}

function assertMediaValidationStopped(scenario) {
  assert.equal(scenario.adminClientCalls, 1, "media validation skipped admin availability");
  assert.equal(scenario.mediaInspections, 1, "media validation did not inspect one file");
  assert.equal(scenario.storageUploads.length, 0, "invalid media reached storage");
  assert.equal(
    actionQueries(scenario, "seller", "merch_products", "insert").length,
    0,
    "invalid media reached product insertion",
  );
  assert.equal(
    actionQueries(scenario, "admin", "merch_products", "update").length,
    0,
    "invalid media reached a trusted write",
  );
}

function assertExactEditAuthorizationLookup(scenario) {
  const lookups = actionQueries(
    scenario,
    "seller",
    "merch_products",
    "select",
  );
  assert.equal(lookups.length, 1, "edit authorization did not read one product");
  assert.equal(
    lookups[0].selection,
    "id, seller_id, status, is_official, inventory_reserved, profiles:profiles!merch_products_seller_id_fkey(account_type, license_verified_at)",
  );
  assertQueryFilters(
    lookups[0],
    [{ column: "id", operator: "eq", value: productId }],
    "edit authorization lookup was not scoped to the requested product ID",
  );
  assert.equal(lookups[0].terminal, "maybeSingle");
}

function assertCleanupQueries(scenario) {
  const deletes = actionQueries(scenario, "seller", "merch_products", "delete");
  assert.equal(deletes.length, 1, "seller cleanup DELETE was not attempted once");
  assertQueryFilters(
    deletes[0],
    [
      { column: "id", operator: "eq", value: productId },
      { column: "seller_id", operator: "eq", value: testIds.actor },
    ],
    "seller cleanup DELETE was not exact ID-and-seller scoped",
  );
  assert.equal(deletes[0].selection, "id");
  assert.equal(deletes[0].terminal, "maybeSingle");

  const cleanupUpdates = actionQueries(
    scenario,
    "admin",
    "merch_products",
    "update",
  ).filter((query) => query.payload?.status === "archived");
  assert.equal(cleanupUpdates.length, 1, "admin neutralization was not attempted once");
  assertModuleValue(
    cleanupUpdates[0].payload,
    {
      external_checkout_url: null,
      is_indexable: false,
      seller_checkout_terms_accepted_at: null,
      seller_checkout_terms_version: null,
      status: "archived",
    },
    "admin neutralization changed the wrong columns",
  );
  assertQueryFilters(
    cleanupUpdates[0],
    [
      { column: "id", operator: "eq", value: productId },
      { column: "seller_id", operator: "eq", value: testIds.actor },
    ],
    "admin neutralization was not exact ID-and-seller scoped",
  );
  assert.equal(cleanupUpdates[0].selection, "id");
  assert.equal(cleanupUpdates[0].terminal, "maybeSingle");

  const deleteIndex = scenario.events.findIndex(
    (event) =>
      event.client === "seller" &&
      event.query.table === "merch_products" &&
      event.query.operation === "delete",
  );
  const cleanupIndex = scenario.events.findIndex(
    (event) =>
      event.client === "admin" &&
      event.query.payload?.status === "archived",
  );
  assert.ok(deleteIndex !== -1 && deleteIndex < cleanupIndex);
}

function assertFailClosedInsert(scenario) {
  const inserts = actionQueries(scenario, "seller", "merch_products", "insert");
  assert.equal(inserts.length, 1);
  assert.equal(
    inserts[0].payload.seller_id,
    testIds.actor,
    "forged seller ID reached the parameterized insert",
  );
  assert.equal(inserts[0].payload.status, "pending_review");
  assert.equal(inserts[0].payload.is_indexable, false);
  assert.equal(inserts[0].payload.is_official, false);
  assert.equal("external_checkout_url" in inserts[0].payload, false);
  assert.equal("seller_checkout_terms_version" in inserts[0].payload, false);
  assert.equal("seller_checkout_terms_accepted_at" in inserts[0].payload, false);
}

function assertTrustedEditPayload(query, expectedStatus = "pending_review") {
  const payload = JSON.parse(JSON.stringify(query.payload));
  const updatedAt = payload.updated_at;
  delete payload.updated_at;

  assert.equal(typeof updatedAt, "string");
  assert.equal(new Date(updatedAt).toISOString(), updatedAt);
  assertModuleValue(payload, {
    category: "apparel",
    description: "Updated seller-owned merchandise details.",
    external_checkout_url: submittedUrl,
    fulfillment_notes: "Ships within five business days with tracking.",
    inventory_quantity: 12,
    is_indexable: false,
    price_cents: 3500,
    return_policy: "Returns accepted within thirty days of delivery.",
    seller_checkout_terms_accepted_at: null,
    seller_checkout_terms_version: SELLER_CHECKOUT_TERMS_VERSION,
    shipping_required: true,
    ships_from_city: "Austin",
    ships_from_region: "TX",
    status: expectedStatus,
    title: "Updated seller-owned shirt",
  });
}

async function runMerchActionContracts(actions) {
  await withScenario({ claims: null }, async (scenario) => {
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm(),
    );
    assert.equal(location, "/login");
    assert.equal(scenario.seller.queries.length, 0);
    assertValidationStopped(scenario);
  });

  await withScenario(
    {
      profile: {
        account_type: "artist",
        license_verified_at: null,
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect(
          "Verified artist, studio, or vendor status is required to submit Merch.",
        ),
      );
      assertValidationStopped(scenario);
    },
  );

  await withScenario({}, async (scenario) => {
    const hostileUrl = "javascript:alert(submitted-checkout-secret)";
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm({ external_checkout_url: hostileUrl }),
    );
    assert.equal(
      location,
      homeRedirect("Add a valid Stripe Payment Link from buy.stripe.com."),
    );
    assertValidationStopped(scenario);
    assertNoSensitiveOutput(scenario, location, [hostileUrl]);
  });

  for (const acceptanceValue of [
    undefined,
    "true",
    "yes",
    "1",
    "ON",
    new File(["on"], "acceptance.txt", { type: "text/plain" }),
  ]) {
    await withScenario({}, async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        formWithEntry(
          validCreateForm(),
          "seller_checkout_terms_accepted",
          acceptanceValue,
        ),
      );
      assert.equal(
        location,
        homeRedirect(
          "Confirm the seller checkout responsibilities before submitting Merch.",
        ),
        "seller acceptance accepted a value other than exact on",
      );
      assertValidationStopped(scenario);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        forgedAcceptanceVersion,
        forgedAcceptanceTimestamp,
      ]);
    });
  }

  await withScenario({}, async (scenario) => {
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm(hostileMerchText),
    );
    assert.equal(location, homeRedirect("Merch submitted for admin review."));
    const payload = productInsertPayload(scenario);
    for (const [name, value] of Object.entries(hostileMerchText)) {
      assert.equal(payload[name], value, `${name} was not preserved as parameter data`);
    }
    assertModuleValue(scenario.logs, []);
    assertNoSensitiveOutput(scenario, location, Object.values(hostileMerchText));
  });

  for (const [formName, payloadName, maxLength] of [
    ["title", "title", 120],
    ["description", "description", 4000],
    ["ships_from_city", "ships_from_city", 80],
    ["ships_from_region", "ships_from_region", 80],
    ["fulfillment_notes", "fulfillment_notes", 1000],
    ["return_policy", "return_policy", 1000],
  ]) {
    await withScenario({}, async (scenario) => {
      const oversized = "x".repeat(maxLength) + "<script>overflow</script>";
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm({ [formName]: oversized }),
      );
      assert.equal(location, homeRedirect("Merch submitted for admin review."));
      assert.equal(
        productInsertPayload(scenario)[payloadName],
        "x".repeat(maxLength),
        `${formName} must remain bounded to ${maxLength} characters`,
      );
    });
  }

  await withScenario({}, async (scenario) => {
    const fileValue = new File(["hostile"], "../field<script>.txt", {
      type: "text/html",
    });
    const formData = validCreateForm();
    for (const name of [
      "title",
      "description",
      "category",
      "ships_from_city",
      "ships_from_region",
      "fulfillment_notes",
      "return_policy",
    ]) {
      formData.set(name, fileValue);
    }
    const location = await redirectedBy(actions.createMerchProduct, formData);
    assert.equal(location, homeRedirect("Merch submitted for admin review."));
    const payload = productInsertPayload(scenario);
    assert.equal(
      payload.category,
      "other",
      "category allowlist accepted a File-valued seller enum",
    );
    for (const name of [
      "title",
      "description",
      "ships_from_city",
      "ships_from_region",
      "fulfillment_notes",
      "return_policy",
    ]) {
      assert.equal(payload[name], "[object File]");
    }
    assert.equal(JSON.stringify(payload).includes(fileValue.name), false);
  });

  for (const [categoryInput, expectedCategory] of [
    ["official", "official"],
    [" apparel ", "apparel"],
    ["APPAREL", "other"],
    ["' OR category.not.is.null --", "other"],
    ["<img src=x onerror=alert(6)>", "other"],
    ["x".repeat(200), "other"],
  ]) {
    await withScenario({}, async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm({ category: categoryInput }),
      );
      assert.equal(location, homeRedirect("Merch submitted for admin review."));
      assert.equal(
        productInsertPayload(scenario).category,
        expectedCategory,
        "category allowlist accepted an unexpected seller enum",
      );
    });
  }

  for (const value of [
    "-1",
    "NaN",
    "Infinity",
    "1e309",
    "1 OR 1=1",
    "<script>35</script>",
    new File(["35"], "price.txt", { type: "text/plain" }),
  ]) {
    await withScenario({}, async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        formWithEntry(validCreateForm(), "price", value),
      );
      assert.equal(
        location,
        homeRedirect("Add a valid Merch price."),
        "non-finite or malformed price reached the product insert",
      );
      assertValidationStopped(scenario);
    });
  }

  for (const value of [
    "-1",
    "NaN",
    "Infinity",
    "1e309",
    "1 OR 1=1",
    "<script>12</script>",
    new File(["12"], "inventory.txt", { type: "text/plain" }),
  ]) {
    await withScenario({}, async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        formWithEntry(validCreateForm(), "inventory_quantity", value),
      );
      assert.equal(
        location,
        homeRedirect("Add at least 1 Merch item in inventory."),
        "non-finite or malformed inventory reached the product insert",
      );
      assertValidationStopped(scenario);
    });
  }

  await withScenario({}, async (scenario) => {
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm({
        inventory_quantity: "999999999999",
        price: "99999999999999999999",
      }),
    );
    assert.equal(location, homeRedirect("Merch submitted for admin review."));
    const payload = productInsertPayload(scenario);
    assert.equal(payload.price_cents, 500000, "price overflow must stay capped");
    assert.equal(
      payload.inventory_quantity,
      100000,
      "inventory overflow must stay capped",
    );
  });

  await withScenario({}, async (scenario) => {
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm({ inventory_quantity: "2.9e1", price: "1e2" }),
    );
    assert.equal(location, homeRedirect("Merch submitted for admin review."));
    const payload = productInsertPayload(scenario);
    assert.equal(payload.price_cents, 10000);
    assert.equal(payload.inventory_quantity, 29);
  });

  for (const value of [
    undefined,
    "true",
    "1",
    "yes",
    "ON",
    new File(["on"], "shipping.txt", { type: "text/plain" }),
  ]) {
    await withScenario({}, async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        formWithEntry(validCreateForm(), "shipping_required", value),
      );
      assert.equal(location, homeRedirect("Merch submitted for admin review."));
      assert.equal(
        productInsertPayload(scenario).shipping_required,
        false,
        "shipping toggle accepted a value other than exact on",
      );
    });
  }

  await withScenario({}, async (scenario) => {
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm({
        fulfillment_notes: "too short",
        shipping_required: undefined,
        ships_from_city: undefined,
        ships_from_region: undefined,
      }),
    );
    assert.equal(
      location,
      homeRedirect(
        "Add fulfillment notes for Merch, including timing, shipping, or pickup details.",
      ),
    );
    assertValidationStopped(scenario);
  });

  await withScenario({}, async (scenario) => {
    const hostileMediaUrl = "https://evil.example/product.png\r\nX-Test: injected";
    const location = await redirectedBy(
      actions.createMerchProduct,
      formWithEntry(validCreateForm(), "media", hostileMediaUrl),
    );
    assert.equal(
      location,
      homeRedirect("Merch needs a product photo, GIF, or short video."),
    );
    assert.equal(scenario.adminClientCalls, 1);
    assert.equal(scenario.mediaInspections, 0);
    assert.equal(scenario.storageUploads.length, 0);
    assert.equal(
      actionQueries(scenario, "seller", "merch_products", "insert").length,
      0,
    );
    assertNoSensitiveOutput(scenario, location, [hostileMediaUrl]);
  });

  for (const file of [
    new File(
      ["<script>alert(8)</script>"],
      "../evil.png\r\nContent-Type: text/html",
      { type: "image/png" },
    ),
    new File(["not a movie"], "../../evil.mp4", { type: "video/mp4" }),
  ]) {
    await withScenario({ realMediaValidation: true }, async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm({ media: file }),
      );
      assert.equal(
        location,
        homeRedirect(
          "The file could not be verified as a supported image or video.",
        ),
        "invalid media bytes bypassed real metadata validation",
      );
      assertMediaValidationStopped(scenario);
      assertNoSensitiveOutput(scenario, location, [file.name, file.type]);
    });
  }

  await withScenario({ realMediaValidation: true }, async (scenario) => {
    const oversizedImage = pngFile(
      "../../oversized<script>.png",
      "image/png",
      10 * 1024 * 1024 + 1,
    );
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm({ media: oversizedImage }),
    );
    assert.equal(
      location,
      homeRedirect("Images can be up to 10 MB after optimization."),
    );
    assertMediaValidationStopped(scenario);
    assertNoSensitiveOutput(scenario, location, [oversizedImage.name]);
  });

  await withScenario({ realMediaValidation: true }, async (scenario) => {
    const hostileFilename = "..\\..\\<img src=x onerror=alert(9)>.png";
    const validBytesWithFalseMime = pngFile(
      hostileFilename,
      "text/html",
    );
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm({ media: validBytesWithFalseMime }),
    );
    assert.equal(location, homeRedirect("Merch submitted for admin review."));
    assert.equal(scenario.storageUploads.length, 1);
    const upload = scenario.storageUploads[0];
    assert.equal(
      upload.path.includes(hostileFilename),
      false,
      "hostile original filename reached the generated storage path",
    );
    assert.equal(upload.path.includes(".."), false);
    assert.equal(upload.path.startsWith(`${testIds.actor}/merch/${productId}/`), true);
    assert.equal(upload.path.endsWith(".png"), true);
    assert.equal(upload.options.contentType, "image/png");
    assert.equal(upload.file, validBytesWithFalseMime);
    assertNoSensitiveOutput(scenario, location, [hostileFilename, "text/html"]);
  });

  await withScenario(
    { adminClientUnavailable: true },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect("Seller checkout is unavailable. Please try again."),
      );
      assert.equal(scenario.adminClientCalls, 1);
      assert.equal(scenario.mediaInspections, 0);
      assert.equal(scenario.storageUploads.length, 0);
      assert.equal(
        actionQueries(scenario, "seller", "merch_products", "insert").length,
        0,
      );
      assert.equal(scenario.admin.queries.length, 0);
      assertModuleValue(scenario.logs, []);
    },
  );

  await withScenario(
    {
      productInsertResult: {
        data: null,
        error: { message: providerSecrets.insert },
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect("Could not submit Merch for review. Please try again."),
      );
      assert.equal(scenario.adminClientCalls, 1);
      assert.equal(scenario.mediaInspections, 1);
      assert.equal(
        actionQueries(scenario, "seller", "merch_products", "insert").length,
        1,
      );
      assert.equal(scenario.admin.queries.length, 0);
      assert.equal(scenario.storageUploads.length, 0);
      assert.equal(scenario.storageRemovals.length, 0);
      assert.equal(
        actionQueries(scenario, "seller", "merch_product_media", "insert").length,
        0,
      );
      assert.equal(
        actionQueries(scenario, "seller", "merch_products", "delete").length,
        0,
      );
      assertModuleValue(scenario.logs, [["Merch product submit failed."]]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        providerSecrets.insert,
      ]);
    },
  );

  await withScenario({}, async (scenario) => {
    const location = await redirectedBy(
      actions.createMerchProduct,
      validCreateForm(),
    );
    assert.equal(location, homeRedirect("Merch submitted for admin review."));
    assertFailClosedInsert(scenario);

    const trustedUpdates = actionQueries(
      scenario,
      "admin",
      "merch_products",
      "update",
    );
    assert.equal(trustedUpdates.length, 1);
    assertModuleValue(trustedUpdates[0].payload, {
      external_checkout_url: submittedUrl,
      seller_checkout_terms_accepted_at: null,
      seller_checkout_terms_version: SELLER_CHECKOUT_TERMS_VERSION,
    });
    assertQueryFilters(
      trustedUpdates[0],
      [
        { column: "id", operator: "eq", value: productId },
        { column: "seller_id", operator: "eq", value: testIds.actor },
      ],
      "create trusted write was not exact ID-and-seller scoped",
    );
    assert.equal(trustedUpdates[0].selection, "id");
    assert.equal(trustedUpdates[0].terminal, "maybeSingle");

    const inspectionIndex = scenario.events.findIndex(
      (event) => event.type === "media-inspection",
    );
    const insertIndex = scenario.events.findIndex(
      (event) =>
        event.client === "seller" &&
        event.query.table === "merch_products" &&
        event.query.operation === "insert",
    );
    const trustedIndex = scenario.events.findIndex(
      (event) =>
        event.client === "admin" &&
        event.query.payload?.external_checkout_url === submittedUrl,
    );
    const uploadIndex = scenario.events.findIndex(
      (event) => event.type === "storage-upload",
    );
    assert.ok(
      inspectionIndex !== -1 &&
        inspectionIndex < insertIndex &&
        insertIndex < trustedIndex &&
        trustedIndex < uploadIndex,
      "valid create side effects ran out of order",
    );
    assertModuleValue(scenario.logs, []);
    assertNoSensitiveOutput(scenario, location, [
      forgedAcceptanceVersion,
      forgedAcceptanceTimestamp,
      testIds.other,
    ]);
  });

  await withScenario(
    {
      trustedCreateResult: { data: null, error: null },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect("Could not prepare seller checkout. Please try again."),
        "zero-row trusted create was treated as seller checkout success",
      );
      assertFailClosedInsert(scenario);
      assertCleanupQueries(scenario);
      assert.equal(scenario.storageUploads.length, 0);
      assert.equal(
        actionQueries(scenario, "seller", "merch_product_media", "insert").length,
        0,
      );
      assertModuleValue(scenario.logs, [["Merch checkout setup failed."]]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        providerSecrets.delete,
      ]);
    },
  );

  await withScenario(
    {
      sellerDeleteResult: { data: null, error: null },
      trustedCreateResult: { data: null, error: null },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect("Could not prepare seller checkout. Please try again."),
      );
      assertFailClosedInsert(scenario);
      assertCleanupQueries(scenario);
      assert.equal(scenario.storageUploads.length, 0);
      assert.equal(
        actionQueries(scenario, "seller", "merch_product_media", "insert").length,
        0,
      );
      assertModuleValue(scenario.logs, [["Merch checkout setup failed."]]);
      assertNoSensitiveOutput(scenario, location, [submittedUrl]);
    },
  );

  await withScenario(
    {
      neutralizationResult: { data: null, error: null },
      trustedCreateResult: { data: null, error: null },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect("Could not prepare seller checkout. Please try again."),
      );
      assertFailClosedInsert(scenario);
      assertCleanupQueries(scenario);
      assert.equal(scenario.storageUploads.length, 0);
      assert.equal(scenario.storageRemovals.length, 0);
      assert.equal(
        actionQueries(scenario, "seller", "merch_product_media", "insert").length,
        0,
      );
      assertModuleValue(scenario.logs, [
        ["Merch checkout setup failed."],
        ["Merch pending-row cleanup failed."],
      ]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        providerSecrets.delete,
      ]);
    },
  );

  await withScenario(
    {
      neutralizationResult: {
        data: null,
        error: { message: providerSecrets.cleanup },
      },
      trustedCreateResult: {
        data: null,
        error: { message: providerSecrets.trusted },
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect("Could not prepare seller checkout. Please try again."),
      );
      assertFailClosedInsert(scenario);
      assertCleanupQueries(scenario);
      assert.equal(scenario.storageUploads.length, 0);
      assertModuleValue(scenario.logs, [
        ["Merch checkout setup failed."],
        ["Merch pending-row cleanup failed."],
      ]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        providerSecrets.cleanup,
        providerSecrets.delete,
        providerSecrets.trusted,
      ]);
    },
  );

  await withScenario(
    {
      storageUploadResult: {
        data: null,
        error: { message: providerSecrets.storage },
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect("Could not upload Merch media. Please try again."),
      );
      assertCleanupQueries(scenario);
      assert.equal(scenario.storageUploads.length, 1);
      assert.equal(
        actionQueries(scenario, "seller", "merch_product_media", "insert").length,
        0,
      );
      assertModuleValue(scenario.logs, [
        ["Merch media storage upload failed."],
        ["Merch media upload failed."],
      ]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        providerSecrets.delete,
        providerSecrets.storage,
      ]);
    },
  );

  await withScenario(
    {
      mediaAttachResult: {
        data: null,
        error: { message: providerSecrets.attach },
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm(),
      );
      assert.equal(
        location,
        homeRedirect(
          "Media uploaded but could not attach to the Merch product. Please try again.",
        ),
      );
      assertCleanupQueries(scenario);
      assert.equal(scenario.storageUploads.length, 1);
      assert.equal(scenario.storageRemovals.length, 1);
      assertModuleValue(scenario.storageRemovals[0], {
        bucket: "merch-media",
        paths: [scenario.storageUploads[0].path],
      });
      assert.equal(
        actionQueries(scenario, "seller", "merch_product_media", "insert").length,
        1,
      );
      assertModuleValue(scenario.logs, [["Merch media attach failed."]]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        providerSecrets.attach,
        providerSecrets.delete,
      ]);
    },
  );

  await withScenario({}, async (scenario) => {
    const hostileUrl = "https://buy.stripe.com/a1B2?provider=secret";
    const location = await redirectedBy(
      actions.editMerchProduct,
      validEditForm({ external_checkout_url: hostileUrl }),
    );
    assert.equal(
      location,
      editRedirect("Add a valid Stripe Payment Link from buy.stripe.com."),
    );
    assertValidationStopped(scenario);
    assert.equal(
      actionQueries(scenario, "seller", "merch_products", "select").length,
      0,
    );
    assertNoSensitiveOutput(scenario, location, [hostileUrl]);
  });

  await withScenario({}, async (scenario) => {
    const location = await redirectedBy(
      actions.editMerchProduct,
      validEditForm({ seller_checkout_terms_accepted: "yes" }),
    );
    assert.equal(
      location,
      editRedirect(
        "Confirm the seller checkout responsibilities before saving Merch.",
      ),
    );
    assertValidationStopped(scenario);
    assert.equal(
      actionQueries(scenario, "seller", "merch_products", "select").length,
      0,
    );
    assertNoSensitiveOutput(scenario, location, [
      submittedUrl,
      forgedAcceptanceVersion,
      forgedAcceptanceTimestamp,
    ]);
  });

  await withScenario({}, async (scenario) => {
    const location = await redirectedBy(
      actions.editMerchProduct,
      validEditForm({ return_policy: "too short" }),
    );
    assert.equal(
      location,
      editRedirect("Add a short return or refund note for Merch buyers."),
    );
    assertValidationStopped(scenario);
  });

  for (const unsafeReturnPath of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "\\evil.example\\steal",
    `/merch/${productId}\r\nX-Test: injected`,
    `/merch/${productId}\u0000suffix`,
    "javascript:alert(10)",
  ]) {
    await withScenario(
      {
        editProduct: {
          id: productId,
          inventory_reserved: 0,
          is_official: false,
          profiles: verifiedProfile,
          seller_id: testIds.actor,
          status: "pending_review",
        },
      },
      async (scenario) => {
        const location = await redirectedBy(
          actions.editMerchProduct,
          validEditForm({ return_path: unsafeReturnPath }),
        );
        assert.equal(
          location,
          editRedirect("Merch product updated."),
          "unsafe edit return target escaped the fixed product fallback",
        );
        assert.equal(location.includes("\r"), false);
        assert.equal(location.includes("\n"), false);
        assert.equal(location.includes("\u0000"), false);
        assertNoSensitiveOutput(scenario, location, [unsafeReturnPath]);
      },
    );
  }

  await withScenario(
    {
      editProduct: {
        id: productId,
        inventory_reserved: 0,
        is_official: false,
        profiles: verifiedProfile,
        seller_id: testIds.actor,
        status: "pending_review",
      },
    },
    async (scenario) => {
      const safeReturnPath = `/merch/${productId}?tab=details#edit`;
      const location = await redirectedBy(
        actions.editMerchProduct,
        validEditForm({ return_path: safeReturnPath }),
      );
      assert.equal(
        location,
        `/merch/${productId}?tab=details&message=${encodeURIComponent(
          "Merch product updated.",
        )}#edit`,
      );
      assert.equal(scenario.revalidatedPaths.includes(`/merch/${productId}`), true);
    },
  );

  for (const hostileProductId of [
    "' OR id.not.is.null --",
    "id.eq." + testIds.other,
    testIds.other,
    new File([testIds.other], "product-id.txt", { type: "text/plain" }),
  ]) {
    await withScenario({ editProduct: null }, async (scenario) => {
      const formData = formWithEntry(
        validEditForm(),
        "product_id",
        hostileProductId,
      );
      const location = await redirectedBy(actions.editMerchProduct, formData);
      assert.equal(location, editRedirect("Merch product was not found."));
      const lookups = actionQueries(
        scenario,
        "seller",
        "merch_products",
        "select",
      );
      assert.equal(lookups.length, 1);
      assertQueryFilters(
        lookups[0],
        [
          {
            column: "id",
            operator: "eq",
            value: String(hostileProductId),
          },
        ],
        "forged product ID escaped exact parameter filtering",
      );
      assert.equal(scenario.admin.queries.length, 0);
    });
  }

  for (const options of [
    {
      editProductError: { message: providerSecrets.lookup },
    },
    {
      editProduct: null,
    },
  ]) {
    await withScenario(options, async (scenario) => {
      const location = await redirectedBy(
        actions.editMerchProduct,
        validEditForm(),
      );
      assert.equal(location, editRedirect("Merch product was not found."));
      assertExactEditAuthorizationLookup(scenario);
      assert.equal(scenario.adminClientCalls, 0);
      assert.equal(scenario.admin.queries.length, 0);
      assert.equal(scenario.storageUploads.length, 0);
      assertModuleValue(scenario.logs, [["Merch product edit lookup failed."]]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        providerSecrets.lookup,
      ]);
    });
  }

  await withScenario(
    {
      editProduct: {
        id: productId,
        inventory_reserved: 0,
        is_official: false,
        profiles: verifiedProfile,
        seller_id: testIds.other,
        status: "active",
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.editMerchProduct,
        validEditForm(),
      );
      assert.equal(location, editRedirect("You can only edit your own Merch."));
      assertExactEditAuthorizationLookup(scenario);
      assert.equal(scenario.adminClientCalls, 0);
      assert.equal(scenario.admin.queries.length, 0);
    },
  );

  await withScenario(
    {
      editProduct: {
        id: productId,
        inventory_reserved: 0,
        is_official: false,
        profiles: {
          account_type: "artist",
          license_verified_at: null,
        },
        seller_id: testIds.actor,
        status: "active",
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.editMerchProduct,
        validEditForm(),
      );
      assert.equal(
        location,
        editRedirect(
          "Verified artist, studio, or vendor status is required to edit Merch.",
        ),
      );
      assertExactEditAuthorizationLookup(scenario);
      assert.equal(scenario.adminClientCalls, 0);
      assert.equal(scenario.admin.queries.length, 0);
      assertModuleValue(scenario.logs, []);
      assertNoSensitiveOutput(scenario, location, [submittedUrl]);
    },
  );

  await withScenario(
    {
      editProduct: {
        id: productId,
        inventory_reserved: 0,
        is_official: true,
        profiles: verifiedProfile,
        seller_id: testIds.actor,
        status: "active",
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.editMerchProduct,
        validEditForm(),
      );
      assert.equal(
        location,
        editRedirect("Official TTC Merch must be edited from admin."),
      );
      assertExactEditAuthorizationLookup(scenario);
      assert.equal(scenario.adminClientCalls, 0);
      assert.equal(scenario.admin.queries.length, 0);
    },
  );

  await withScenario(
    {
      trustedEditResult: { data: null, error: null },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.editMerchProduct,
        validEditForm(),
      );
      assert.equal(
        location,
        editRedirect(
          "Could not update Merch product. It may be gone or owned by another account.",
        ),
        "zero-row trusted edit was treated as Merch update success",
      );
      const updates = actionQueries(
        scenario,
        "admin",
        "merch_products",
        "update",
      );
      assert.equal(updates.length, 1);
      assertQueryFilters(
        updates[0],
        [
          { column: "id", operator: "eq", value: productId },
          { column: "seller_id", operator: "eq", value: testIds.actor },
          { column: "status", operator: "eq", value: "active" },
          { column: "is_official", operator: "eq", value: false },
        ],
        "zero-row edit trusted write did not recheck the authorized row snapshot",
      );
      assertTrustedEditPayload(updates[0]);
      assertModuleValue(scenario.logs, [["Merch product update failed."]]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        forgedAcceptanceVersion,
        forgedAcceptanceTimestamp,
      ]);
    },
  );

  await withScenario(
    {
      trustedEditResult: {
        data: null,
        error: { message: providerSecrets.edit },
      },
    },
    async (scenario) => {
      const location = await redirectedBy(
        actions.editMerchProduct,
        validEditForm(),
      );
      assert.equal(
        location,
        editRedirect(
          "Could not update Merch product. It may be gone or owned by another account.",
        ),
      );
      const updates = actionQueries(
        scenario,
        "admin",
        "merch_products",
        "update",
      );
      assert.equal(updates.length, 1);
      assertTrustedEditPayload(updates[0]);
      assertModuleValue(scenario.logs, [["Merch product update failed."]]);
      assertNoSensitiveOutput(scenario, location, [
        submittedUrl,
        providerSecrets.edit,
      ]);
    },
  );

  for (const status of ["active", "approved"]) {
    await withScenario(
      {
        editProduct: {
          id: productId,
          inventory_reserved: 0,
          is_official: false,
          profiles: verifiedProfile,
          seller_id: testIds.actor,
          status,
        },
      },
      async (scenario) => {
        const location = await redirectedBy(
          actions.editMerchProduct,
          validEditForm(),
        );
        assert.equal(
          location,
          homeRedirect("Merch updated and sent back to review."),
        );
        const updates = actionQueries(
          scenario,
          "admin",
          "merch_products",
          "update",
        );
        assert.equal(updates.length, 1);
        assertTrustedEditPayload(updates[0]);
        assertQueryFilters(
          updates[0],
          [
            { column: "id", operator: "eq", value: productId },
            { column: "seller_id", operator: "eq", value: testIds.actor },
            { column: "status", operator: "eq", value: status },
            { column: "is_official", operator: "eq", value: false },
          ],
          status + " edit trusted write did not recheck the authorized row snapshot",
        );
        assertModuleValue(scenario.logs, []);
        assertNoSensitiveOutput(scenario, location, [
          forgedAcceptanceVersion,
          forgedAcceptanceTimestamp,
          testIds.other,
        ]);
      },
    );
  }

  console.log("PASS direct seller checkout Server Action security contracts");
}

const actionSource = actionSourceForTest();
try {
  const actions = await loadMerchActions(actionSource.path);
  await runMerchActionContracts(actions);
} finally {
  actionSource.cleanup();
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

function task6AdminActionSourceForTest() {
  const directory = mkdtempSync(join(tmpdir(), "seller-checkout-admin-action-"));
  const path = join(directory, "actions.ts");
  const transformedSource = adminActionsSource.replace(
    'const { sellerCheckoutSubmissionReadiness } = await import("@/lib/merch/seller-checkout");',
    "",
  );
  writeFileSync(path, transformedSource, "utf8");

  return {
    cleanup() {
      rmSync(directory, { force: true, recursive: true });
    },
    path,
  };
}

async function loadTask6AdminActions({
  console: consoleValue,
  createAdminClient,
  createClient,
}) {
  const source = task6AdminActionSourceForTest();

  try {
    const actions = await importTypeScriptWithStubs(
      source.path,
      {
        "@/lib/admin-role-hierarchy": {
          canModerateUserStatus: () => false,
          isAssignableUserRole: () => false,
        },
        "@/lib/mail/hostgator": {
          sendHostgatorEmail: async () => {},
        },
        "@/lib/notification-write": {
          insertNotifications: async () => ({ error: null }),
        },
        "@/lib/site": {
          siteName: "TheTattooCore",
          siteUrl: "https://thetattoocore.com",
          supportEmail: "support@example.com",
        },
        "@/lib/stripe/checkout-session": {
          bookingCheckoutReconciliationDecision: () => ({
            action: "hold",
            reason: "test",
          }),
          bookingCheckoutReleaseAttemptDecision: () => ({
            action: "reject",
            reason: "test",
          }),
        },
        "@/lib/stripe/booking-refund": {
          bookingRefundStripeContext: () => null,
        },
        "@/lib/stripe/server": {
          createStripeClient: () => null,
          stripeCheckoutPreflight: () => ({ actual: false, ready: false }),
        },
        "@/lib/supabase/admin": {
          createAdminClient,
        },
        "@/lib/supabase/server": {
          createClient,
        },
        "next/cache": {
          revalidatePath: () => {},
        },
        "next/navigation": {
          redirect(location) {
            throw new RedirectSignal(String(location));
          },
        },
      },
      {
        console: consoleValue,
        globals: { sellerCheckoutSubmissionReadiness },
      },
    );

    return { actions, cleanup: source.cleanup };
  } catch (error) {
    source.cleanup();
    throw error;
  }
}

function task6RedirectMessage(location) {
  return new URL(location, "https://thetattoocore.com").searchParams.get("message");
}

const readyAdminProduct = {
  category: "apparel",
  currency: "USD",
  fulfillment_notes: "Ships within five business days.",
  id: testIds.other,
  inventory_quantity: 8,
  inventory_reserved: 2,
  is_official: false,
  moderation_status: "active",
  price_cents: 2_500,
  profiles: {
    account_type: "artist",
    license_verified_at: "2026-08-01T12:00:00.000Z",
  },
  return_policy: "Returns accepted within fourteen days.",
  seller_id: testIds.third,
  shipping_required: true,
  ships_from_city: "Austin",
  ships_from_region: "TX",
  status: "approved",
  title: "Fixture flash",
};
const readyAdminCheckoutRow = {
  external_checkout_url: validLiveUrl,
  id: testIds.other,
  seller_checkout_terms_accepted_at: "2026-08-01T12:00:00.000Z",
  seller_checkout_terms_version: SELLER_CHECKOUT_TERMS_VERSION,
};

async function runTask6AdminActivation({
  adminError = null,
  checkoutRow = readyAdminCheckoutRow,
  product = readyAdminProduct,
  rpcResult = { data: true, error: null },
  submittedStatus = "active",
} = {}) {
  const events = [];
  const logs = [];
  const normal = createSupabaseDouble({
    claims: { sub: testIds.actor },
    execute(query) {
      if (query.table === "profiles" && query.operation === "select") {
        events.push("moderator-authorized");
        return { data: { role: "moderator" }, error: null };
      }

      if (query.table === "merch_products" && query.operation === "select") {
        events.push({ client: "authenticated", query });
        return { data: product, error: null };
      }

      throw new Error(
        `Unexpected authenticated query: ${String(query.operation)} ${query.table}`,
      );
    },
    rpc(name, payload) {
      events.push({ client: "authenticated", name, payload, type: "rpc" });
      return Promise.resolve(
        typeof rpcResult === "function"
          ? rpcResult({ name, payload })
          : rpcResult,
      );
    },
  });
  const admin = createSupabaseDouble({
    execute(query) {
      events.push({ client: "admin", query });
      if (query.table === "merch_products" && query.operation === "select") {
        return { data: checkoutRow, error: adminError };
      }

      throw new Error(`Unexpected admin query: ${String(query.operation)} ${query.table}`);
    },
  });
  const consoleValue = Object.create(console);
  consoleValue.error = (...values) => {
    logs.push(values.map(String).join(" "));
  };
  const loaded = await loadTask6AdminActions({
    console: consoleValue,
    createAdminClient() {
      events.push("admin-client-created");
      return admin.client;
    },
    async createClient() {
      return normal.client;
    },
  });
  let outcome;

  try {
    await loaded.actions.updateMerchProductStatus(
      makeForm({
        note: "Reviewed",
        product_id: product.id,
        return_to: "/admin/merch?product_status=pending_review",
        status: submittedStatus,
      }),
    );
  } catch (error) {
    outcome = error;
  } finally {
    loaded.cleanup();
  }

  assert.ok(outcome instanceof RedirectSignal, `unexpected Task 6 outcome: ${outcome}`);

  return {
    admin,
    events,
    location: outcome.location,
    logs,
    normal,
  };
}

{
  const scenario = await runTask6AdminActivation();
  assert.equal(task6RedirectMessage(scenario.location), "Merch product updated.");
  assert.ok(
    scenario.events.indexOf("moderator-authorized") <
      scenario.events.indexOf("admin-client-created"),
    "service-role client was created before moderator authorization",
  );
  const adminReads = scenario.admin.queries.filter(
    (query) => query.table === "merch_products" && query.operation === "select",
  );
  assert.equal(adminReads.length, 1);
  assert.equal(
    adminReads[0].selection,
    "id, external_checkout_url, seller_checkout_terms_version, seller_checkout_terms_accepted_at",
  );
  assertQueryFilters(
    adminReads[0],
    [
      { column: "id", operator: "eq", value: readyAdminProduct.id },
      { column: "seller_id", operator: "eq", value: readyAdminProduct.seller_id },
    ],
    "admin seller checkout read was not exact ID-and-seller scoped",
  );
  const statusRpcs = scenario.events.filter(
    (event) => event?.type === "rpc" && event.name === "admin_update_merch_product_status",
  );
  assert.equal(statusRpcs.length, 1);
  assertModuleValue(statusRpcs[0].payload, {
    p_expected_status: "approved",
    p_note: "Reviewed",
    p_product_id: readyAdminProduct.id,
    p_status: "active",
  });
  assertModuleValue(scenario.logs, []);
}

const approvedStatusRequiredMessage =
  "Merch must be approved before seller checkout can be activated.";

for (const sourceStatus of [
  "pending_review",
  "paused",
  "rejected",
  "archived",
]) {
  const scenario = await runTask6AdminActivation({
    product: { ...readyAdminProduct, status: sourceStatus },
  });
  assert.equal(
    task6RedirectMessage(scenario.location),
    approvedStatusRequiredMessage,
    `${sourceStatus} product activated without an approved source status`,
  );
  assert.equal(
    scenario.events.includes("admin-client-created"),
    false,
    `${sourceStatus} source status reached the protected readiness read`,
  );
  assert.equal(
    scenario.events.some((event) => event?.type === "rpc"),
    false,
    `${sourceStatus} source status reached the activation RPC`,
  );
}

{
  const scenario = await runTask6AdminActivation({
    product: { ...readyAdminProduct, status: "pending_review" },
    submittedStatus: " active ",
  });
  assert.equal(task6RedirectMessage(scenario.location), approvedStatusRequiredMessage);
  assert.equal(
    scenario.events.some((event) => event?.type === "rpc"),
    false,
    "padded active status bypassed the approved source-status guard",
  );
}

{
  let statusAtRpc = "approved";
  const scenario = await runTask6AdminActivation({
    rpcResult({ name, payload }) {
      assert.equal(name, "admin_update_merch_product_status");
      assert.equal(payload.p_expected_status, "approved");
      statusAtRpc = "pending_review";

      return {
        data: statusAtRpc === payload.p_expected_status,
        error: null,
      };
    },
  });
  assert.equal(statusAtRpc, "pending_review");
  assert.equal(
    task6RedirectMessage(scenario.location),
    "Merch product changed before this decision. Review it and try again.",
  );
  assert.equal(
    scenario.events.filter(
      (event) =>
        event?.type === "rpc" &&
        event.name === "admin_update_merch_product_status",
    ).length,
    1,
  );
}

for (const { checkoutRow, message, product } of [
  {
    message: "Official TTC Merch cannot be activated in this release.",
    product: { ...readyAdminProduct, is_official: true },
  },
  {
    message:
      "This seller must be artist, studio, or vendor license verified before Merch can be approved or activated.",
    product: {
      ...readyAdminProduct,
      profiles: { account_type: "artist", license_verified_at: null },
    },
  },
  {
    message: "Merch needs available inventory before seller checkout can be activated.",
    product: { ...readyAdminProduct, inventory_quantity: 2 },
  },
  {
    message:
      "Merch needs ship-from, fulfillment, and return/refund details before seller checkout can be activated.",
    product: { ...readyAdminProduct, fulfillment_notes: "short" },
  },
  {
    checkoutRow: {
      ...readyAdminCheckoutRow,
      seller_checkout_terms_accepted_at: null,
      seller_checkout_terms_version: null,
    },
    message:
      "The seller must accept the current seller checkout responsibilities before Merch can be activated.",
  },
  {
    checkoutRow: {
      ...readyAdminCheckoutRow,
      external_checkout_url: "javascript:provider-secret",
    },
    message:
      "Merch needs a valid live Stripe Payment Link before seller checkout can be activated.",
  },
]) {
  const scenario = await runTask6AdminActivation({
    checkoutRow: checkoutRow ?? readyAdminCheckoutRow,
    product: product ?? readyAdminProduct,
  });
  assert.equal(task6RedirectMessage(scenario.location), message);
  assert.ok(!scenario.location.includes("buy.stripe.com"));
  assert.ok(!scenario.location.includes("provider-secret"));
  assert.equal(
    scenario.events.some((event) => event?.type === "rpc"),
    false,
    `readiness failure reached status RPC: ${message}`,
  );
}

{
  const secretError = "provider-db-secret-token";
  const scenario = await runTask6AdminActivation({
    adminError: { message: secretError },
    checkoutRow: null,
  });
  assert.equal(
    task6RedirectMessage(scenario.location),
    "Could not review seller checkout readiness. Please try again.",
  );
  assertModuleValue(scenario.logs, ["Admin Merch seller checkout lookup failed."]);
  assert.ok(!scenario.location.includes(secretError));
  assert.ok(!scenario.logs.join(" ").includes(secretError));
  assert.ok(!scenario.location.includes(validLiveUrl));
}

for (const values of [
  { product_id: "' OR 1=1 --", status: "active" },
  { product_id: testIds.other, status: "active<script>" },
  { product_id: testIds.other, status: "active\u0000approved" },
  { product_id: testIds.other, status: "active,approved" },
]) {
  let authCalls = 0;
  const loaded = await loadTask6AdminActions({
    console,
    createAdminClient() {
      throw new Error("malformed input reached the admin client");
    },
    async createClient() {
      authCalls += 1;
      throw new Error("malformed input reached authentication");
    },
  });
  let outcome;

  try {
    await loaded.actions.updateMerchProductStatus(makeForm(values));
  } catch (error) {
    outcome = error;
  } finally {
    loaded.cleanup();
  }

  assert.ok(outcome instanceof RedirectSignal);
  assert.equal(
    task6RedirectMessage(outcome.location),
    "Choose a valid merch product status.",
  );
  assert.equal(authCalls, 0);
  assert.ok(!outcome.location.includes(String(values.product_id)));
  assert.ok(!outcome.location.includes(String(values.status)));
}
console.log("PASS direct admin seller checkout moderation security contracts");

function executableFunctionFromSource(source, fileName, functionName) {
  const ast = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  const matches = [];
  visitSource(ast, (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === functionName
    ) {
      matches.push(node);
    }
  });
  assert.equal(matches.length, 1, `${functionName} declaration count changed`);
  const output = ts.transpileModule(
    `${matches[0].getText(ast)}\nglobalThis.__functionUnderTest = ${functionName};`,
    {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const context = vm.createContext({});
  new vm.Script(output).runInContext(context);
  return context.__functionUnderTest;
}

const adminSearchTerm = executableFunctionFromSource(
  adminMerchPageSource,
  "src/app/admin/merch/page.tsx",
  "searchTerm",
);
for (const [value, expected] of [
  ["<script>alert(1)</script>", "script alert 1 script"],
  ["' OR 1=1 --", "OR 1 1 --"],
  ["buyer\r\nseller", "buyer seller"],
  [["safe@example.com", "ignored"], "safe@example.com"],
  ["x".repeat(120), "x".repeat(80)],
]) {
  assert.equal(adminSearchTerm(value), expected);
}
console.log("PASS malicious admin Merch search normalization");

function syntheticModule(context, identifier, exports) {
  const names = Object.keys(exports);

  return new vm.SyntheticModule(
    names,
    function initializeStub() {
      for (const name of names) {
        this.setExport(name, exports[name]);
      }
    },
    { context, identifier: `stub:${identifier}` },
  );
}

async function renderSellerCheckoutDialogBoundary(sellerName) {
  const transpiled = ts.transpileModule(sellerCheckoutDialogSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "src/app/merch/seller-checkout-dialog.tsx",
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "Seller checkout dialog boundary must transpile");

  function TestIcon() {
    return null;
  }

  const context = vm.createContext({ console });
  const stubs = {
    "@capacitor/core": {
      Capacitor: {
        isNativePlatform() {
          return false;
        },
      },
    },
    "lucide-react": {
      ExternalLink: TestIcon,
      X: TestIcon,
    },
    react: {
      useCallback(callback) {
        return callback;
      },
      useEffect() {},
      useRef() {
        return { current: null };
      },
      useState(initialValue) {
        return [initialValue === false ? true : initialValue, () => {}];
      },
    },
    "react/jsx-runtime": {
      Fragment,
      jsx,
      jsxs,
    },
  };
  const modules = new Map();
  const dialogModule = new vm.SourceTextModule(transpiled.outputText, {
    context,
    identifier: "test:seller-checkout-dialog-boundary",
  });
  await dialogModule.link((specifier) => {
    if (modules.has(specifier)) return modules.get(specifier);
    assert.ok(
      Object.hasOwn(stubs, specifier),
      `Missing seller checkout dialog boundary stub for ${specifier}`,
    );
    const stubModule = syntheticModule(context, specifier, stubs[specifier]);
    modules.set(specifier, stubModule);
    return stubModule;
  });
  await dialogModule.evaluate();

  return renderToStaticMarkup(
    dialogModule.namespace.SellerCheckoutDialog({
      checkoutUrl: validLiveUrl,
      sellerName,
    }),
  );
}

const hostileSellerName =
  'Seller </strong><img src=x onerror="alert(11)"><script>alert(12)</script>\r\n';
const hostileSellerMarkup =
  await renderSellerCheckoutDialogBoundary(hostileSellerName);
const escapedSellerName = renderToStaticMarkup(hostileSellerName);
assert.equal(
  hostileSellerMarkup.split(escapedSellerName).length - 1,
  3,
  "hostile seller name was not rendered three times as escaped React text",
);
assert.equal(hostileSellerMarkup.includes("<img src=x"), false);
assert.equal(hostileSellerMarkup.includes("<script>alert(12)</script>"), false);
assert.equal(
  hostileSellerMarkup.includes(`href="${validLiveUrl}"`),
  true,
  "seller name changed the validated checkout link sink",
);
console.log("PASS hostile seller name is inert at the React render boundary");

async function renderMerchProductTextBoundary() {
  const transpiled = ts.transpileModule(merchPageSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "src/app/merch/[id]/page.tsx",
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "Merch product text boundary must transpile");

  const product = {
    ...hostileMerchText,
    category: "other",
    currency: "USD",
    id: productId,
    inventory_quantity: 12,
    inventory_reserved: 0,
    is_official: false,
    merch_product_media: [],
    moderation_status: "active",
    price_cents: 3500,
    seller_id: testIds.actor,
    shipping_required: true,
    status: "active",
  };
  const profile = {
    ...verifiedProfile,
    display_name: "Verified Seller",
    id: testIds.actor,
    username: "verified-seller",
  };
  const normal = createSupabaseDouble({
    claims: { sub: testIds.actor },
    execute(query) {
      if (query.table === "merch_products" && query.operation === "select") {
        return { data: product, error: null };
      }
      if (query.table === "saved_items" && query.operation === "select") {
        return { data: null, error: null };
      }
      throw new Error(
        `Unexpected Merch text boundary query: ${String(query.operation)} ${query.table}`,
      );
    },
  });
  const admin = createSupabaseDouble({
    execute(query) {
      if (query.table === "merch_products" && query.operation === "select") {
        return {
          data: {
            external_checkout_url: submittedUrl,
            seller_checkout_terms_accepted_at: "2026-08-02T12:00:00.000Z",
            seller_checkout_terms_version: SELLER_CHECKOUT_TERMS_VERSION,
          },
          error: null,
        };
      }
      throw new Error(
        `Unexpected Merch text admin query: ${String(query.operation)} ${query.table}`,
      );
    },
  });

  function EmptyComponent() {
    return null;
  }
  const context = vm.createContext({ console, process, URL });
  const stubs = {
    "@/app/actions": {
      archiveMerchProduct: "/test/archive-merch",
      editMerchProduct: "/test/edit-merch",
    },
    "@/app/content-report-form": { ContentReportForm: EmptyComponent },
    "@/app/media-lightbox": { MediaLightbox: EmptyComponent },
    "@/app/merch/seller-checkout-dialog": {
      SellerCheckoutDialog: EmptyComponent,
    },
    "@/app/merch/seller-checkout-fields": {
      SellerCheckoutFields: EmptyComponent,
    },
    "@/app/notification-bell-link": {
      NotificationBellLink: EmptyComponent,
    },
    "@/app/protected-video": { ProtectedVideo: EmptyComponent },
    "@/app/saved-item-button": { SavedItemButton: EmptyComponent },
    "@/app/share-actions": { ShareActions: EmptyComponent },
    "@/lib/merch/seller-checkout": {
      sellerCheckoutLinksEnabled() {
        return true;
      },
      sellerCheckoutPurchaseReadiness() {
        return { ready: true, reason: null, url: submittedUrl };
      },
    },
    "@/lib/public-profile-hydration": {
      async loadPublicProfileMap() {
        return new Map([[testIds.actor, profile]]);
      },
    },
    "@/lib/route-ids": { isUuid: () => true },
    "@/lib/site": {
      brandShareImage: "/share.png",
      brandShareImageAlt: "TheTattooCore",
      metadataKeywords: () => [],
      seoKeywordGroups: { merch: [] },
      shareImage: () => ({ alt: "Merch", url: "/share.png" }),
      siteKeywords: [],
      siteName: "TheTattooCore",
      siteUrl: "https://thetattoocore.com",
    },
    "@/lib/supabase/admin": { createAdminClient: () => admin.client },
    "@/lib/supabase/server": { createClient: async () => normal.client },
    "@/lib/verification": { isVerifiedProfessional },
    "next/link": { default: "a" },
    "next/navigation": {
      notFound() {
        throw new Error("Unexpected notFound");
      },
    },
    "react/jsx-runtime": { Fragment, jsx, jsxs },
  };
  for (const icon of [
    "ArrowLeft",
    "BadgeCheck",
    "ImageIcon",
    "Pencil",
    "ShieldCheck",
    "Trash2",
  ]) {
    (stubs["lucide-react"] ??= {})[icon] = EmptyComponent;
  }
  const modules = new Map();
  const pageModule = new vm.SourceTextModule(transpiled.outputText, {
    context,
    identifier: "test:merch-product-text-boundary",
  });
  await pageModule.link((specifier) => {
    if (modules.has(specifier)) return modules.get(specifier);
    assert.ok(
      Object.hasOwn(stubs, specifier),
      `Missing Merch text boundary stub for ${specifier}`,
    );
    const stubModule = syntheticModule(context, specifier, stubs[specifier]);
    modules.set(specifier, stubModule);
    return stubModule;
  });
  await pageModule.evaluate();
  const element = await pageModule.namespace.default({
    params: Promise.resolve({ id: productId }),
    searchParams: Promise.resolve({}),
  });
  return renderToStaticMarkup(element);
}

const hostileMerchMarkup = await renderMerchProductTextBoundary();
for (const [name, value] of Object.entries(hostileMerchText)) {
  assert.equal(
    hostileMerchMarkup.includes(renderToStaticMarkup(value)),
    true,
    `${name} was not escaped at the Merch detail React boundary`,
  );
}
for (const activeMarkup of [
  "<script>alert(1)</script>",
  "<svg onload=alert(2)>",
  "<img src=x onerror=alert(3)>",
  "<script>alert(4)</script>",
  "<img src=x onerror=alert(5)>",
]) {
  assert.equal(
    hostileMerchMarkup.includes(activeMarkup),
    false,
    `hostile listing markup became active HTML: ${activeMarkup}`,
  );
}
console.log("PASS hostile listing text is inert at the Merch React boundary");

let adminMerchPageBoundaryScenario = null;

async function loadAdminMerchPageBoundary() {
  const transpiled = ts.transpileModule(adminMerchPageSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "src/app/admin/merch/page.tsx",
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "Admin Merch page boundary must transpile");

  function TestIcon() {
    return null;
  }

  const context = vm.createContext({
    URL,
    URLSearchParams,
    console,
    process,
  });
  const stubs = {
    "../actions": {
      refundMerchOrder: "/test/refund-merch-order",
      updateMerchOrderStatus: "/test/update-merch-order-status",
      updateMerchProductStatus: "/test/update-merch-product-status",
    },
    "../admin-section-nav": {
      AdminSectionNav() {
        return null;
      },
    },
    "@/lib/merch/seller-checkout": {
      sellerCheckoutSubmissionReadiness,
    },
    "@/lib/status-labels": {
      commerceStatusLabel(value) {
        return String(value);
      },
      titleCaseStatus(value) {
        return String(value).replaceAll("_", " ");
      },
    },
    "@/lib/status-message": {
      safeStatusMessage() {
        return null;
      },
    },
    "@/lib/supabase/admin": {
      createAdminClient() {
        assert.ok(adminMerchPageBoundaryScenario, "missing admin page scenario");
        return adminMerchPageBoundaryScenario.admin.client;
      },
    },
    "@/lib/supabase/server": {
      async createClient() {
        assert.ok(adminMerchPageBoundaryScenario, "missing admin page scenario");
        return adminMerchPageBoundaryScenario.normal.client;
      },
    },
    "@/lib/verification": {
      isVerifiedProfessional,
    },
    "lucide-react": {
      ArrowLeft: TestIcon,
      ChevronLeft: TestIcon,
      ChevronRight: TestIcon,
      CreditCard: TestIcon,
      ExternalLink: TestIcon,
      Package: TestIcon,
      ShieldCheck: TestIcon,
      Store: TestIcon,
      Undo2: TestIcon,
    },
    "next/link": {
      default: "a",
    },
    "next/navigation": {
      redirect(location) {
        throw new RedirectSignal(String(location));
      },
    },
    "react/jsx-runtime": {
      Fragment,
      jsx,
      jsxs,
    },
  };
  const modules = new Map();
  const pageModule = new vm.SourceTextModule(transpiled.outputText, {
    context,
    identifier: "test:admin-merch-page-boundary",
  });

  await pageModule.link((specifier) => {
    if (modules.has(specifier)) return modules.get(specifier);
    assert.ok(
      Object.hasOwn(stubs, specifier),
      `Missing admin page boundary stub for ${specifier}`,
    );
    const stubModule = syntheticModule(context, specifier, stubs[specifier]);
    modules.set(specifier, stubModule);
    return stubModule;
  });
  await pageModule.evaluate();

  return pageModule.namespace.default;
}

async function renderAdminMerchPageBoundary({
  externalCheckoutUrl,
  status = "approved",
}) {
  const product = {
    ...readyAdminProduct,
    created_at: "2026-08-01T12:00:00.000Z",
    profiles: {
      ...readyAdminProduct.profiles,
      display_name: "Verified Seller",
      username: "verified-seller",
    },
    status,
  };
  const normal = createSupabaseDouble({
    claims: { sub: testIds.actor },
    execute(query) {
      if (query.table === "profiles" && query.operation === "select") {
        return {
          data: {
            display_name: "Moderator",
            role: "moderator",
            username: "moderator",
          },
          error: null,
        };
      }

      if (query.table === "merch_products" && query.operation === "select") {
        return { count: 1, data: [product], error: null };
      }

      if (query.table === "merch_order_items" && query.operation === "select") {
        return { count: 0, data: [], error: null };
      }

      if (query.table === "merch_orders" && query.operation === "select") {
        return { count: 0, data: [], error: null };
      }

      throw new Error(
        `Unexpected admin page authenticated query: ${String(query.operation)} ${query.table}`,
      );
    },
  });
  const admin = createSupabaseDouble({
    execute(query) {
      if (query.table === "merch_products" && query.operation === "select") {
        return {
          data: [
            {
              ...readyAdminCheckoutRow,
              external_checkout_url: externalCheckoutUrl,
            },
          ],
          error: null,
        };
      }

      throw new Error(
        `Unexpected admin page service-role query: ${String(query.operation)} ${query.table}`,
      );
    },
  });
  adminMerchPageBoundaryScenario = { admin, normal };

  try {
    const element = await adminMerchPageBoundary({
      searchParams: Promise.resolve({}),
    });

    return {
      admin,
      markup: renderToStaticMarkup(element),
      normal,
    };
  } finally {
    adminMerchPageBoundaryScenario = null;
  }
}

function reviewStripePaymentLinks(markup) {
  return [...markup.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)]
    .map(([anchor]) => anchor)
    .filter((anchor) => anchor.includes("Review Stripe Payment Link"));
}

function activateButton(markup) {
  const match = markup.match(
    /<button\b(?=[^>]*\bvalue="active")[^>]*>Activate<\/button>/,
  );
  assert.ok(match, "Admin Merch Activate button was not rendered");
  return match[0];
}

function assertActivateDisabled(markup, label) {
  assert.match(
    activateButton(markup),
    /\sdisabled(?:=""|(?=\s|>))/,
    `${label}: Activate was enabled`,
  );
}

const adminMerchPageBoundary = await loadAdminMerchPageBoundary();
const hostileProtectedCheckoutUrls = [
  ["javascript URL", "javascript:alert(1)"],
  ["data URL", "data:text/html,provider-secret"],
  ["lookalike host", "https://buy.stripe.com.evil.example/a1B2"],
  ["raw invalid value", "not a Stripe Payment Link"],
];

for (const [label, externalCheckoutUrl] of hostileProtectedCheckoutUrls) {
  const { markup } = await renderAdminMerchPageBoundary({
    externalCheckoutUrl,
  });
  assert.equal(
    reviewStripePaymentLinks(markup).length,
    0,
    `${label}: hostile protected row rendered a Review Stripe Payment Link anchor`,
  );
  assertActivateDisabled(markup, label);
  assert.ok(
    !markup.includes(externalCheckoutUrl),
    `${label}: raw protected checkout value reached rendered markup`,
  );
}

const mixedCaseLiveUrl = "HTTPS://BUY.STRIPE.COM/a1B2_c3D4";
const canonicalBoundaryResult = validateSellerCheckoutUrl(mixedCaseLiveUrl);
assert.equal(canonicalBoundaryResult.ok, true);
const validAdminPage = await renderAdminMerchPageBoundary({
  externalCheckoutUrl: mixedCaseLiveUrl,
});
const validReviewLinks = reviewStripePaymentLinks(validAdminPage.markup);
assert.equal(validReviewLinks.length, 1);
assert.ok(validReviewLinks[0].includes(`href="${canonicalBoundaryResult.url}"`));
assert.ok(validReviewLinks[0].includes('target="_blank"'));
assert.ok(
  validReviewLinks[0].includes('rel="ugc nofollow noopener noreferrer"'),
);
assert.ok(!validAdminPage.markup.includes(mixedCaseLiveUrl));
assert.doesNotMatch(
  activateButton(validAdminPage.markup),
  /\sdisabled(?:=""|(?=\s|>))/,
);

for (const sourceStatus of [
  "pending_review",
  "paused",
  "rejected",
  "archived",
]) {
  const { markup } = await renderAdminMerchPageBoundary({
    externalCheckoutUrl: validLiveUrl,
    status: sourceStatus,
  });
  assert.equal(
    reviewStripePaymentLinks(markup).length,
    1,
    `${sourceStatus}: valid protected link was not available for moderator review`,
  );
  assertActivateDisabled(markup, sourceStatus);
  assert.ok(
    markup.includes(approvedStatusRequiredMessage),
    `${sourceStatus}: approved-source activation reason was not rendered`,
  );
}
console.log("PASS admin Merch protected-row page mapping and render boundary");

const sellerCheckoutDialogAst = ts.createSourceFile(
  "src/app/merch/seller-checkout-dialog.tsx",
  sellerCheckoutDialogSource,
  ts.ScriptTarget.ES2022,
  true,
  ts.ScriptKind.TSX,
);
const sellerCheckoutClickHandlers = [];
visitSource(sellerCheckoutDialogAst, (node) => {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "openSellerCheckout" &&
    node.initializer &&
    ts.isArrowFunction(node.initializer)
  ) {
    sellerCheckoutClickHandlers.push(node.initializer);
  }
});
assert.equal(sellerCheckoutClickHandlers.length, 1);

const sellerCheckoutClickHandlerSource = `
export function createSellerCheckoutClickHandler({
  Capacitor,
  checkoutUrl,
  closeDialog,
  setErrorMessage,
}: {
  Capacitor: { isNativePlatform(): boolean };
  checkoutUrl: string;
  closeDialog(): void;
  setErrorMessage(message: string | null): void;
}) {
  return ${sellerCheckoutClickHandlers[0].getText(sellerCheckoutDialogAst)};
}
`;

async function runSellerCheckoutClickScenario(isNativePlatform) {
  const transpiled = ts.transpileModule(sellerCheckoutClickHandlerSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "seller-checkout-click-handler.ts",
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "Dialog click handler must transpile");

  const events = [];
  const browserOpenCalls = [];
  let nativePlatformChecks = 0;
  const context = vm.createContext({ console, setTimeout });
  const browserModule = syntheticModule(context, "@capacitor/browser", {
    Browser: {
      async open(options) {
        events.push("browser-open");
        browserOpenCalls.push(JSON.parse(JSON.stringify(options)));
      },
    },
  });
  const sourceModule = new vm.SourceTextModule(transpiled.outputText, {
    context,
    identifier: "test:seller-checkout-click-handler",
    importModuleDynamically: async (specifier) => {
      assert.equal(specifier, "@capacitor/browser");
      events.push("import-browser");

      if (browserModule.status === "unlinked") {
        await browserModule.link(() => {
          throw new Error("Browser stub has no imports");
        });
      }
      if (browserModule.status === "linked") {
        await browserModule.evaluate();
      }

      return browserModule;
    },
  });
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected static click-handler import: ${specifier}`);
  });
  await sourceModule.evaluate();

  let preventDefaultCalls = 0;
  const handler = sourceModule.namespace.createSellerCheckoutClickHandler({
    Capacitor: {
      isNativePlatform() {
        nativePlatformChecks += 1;
        return isNativePlatform;
      },
    },
    checkoutUrl: validLiveUrl,
    closeDialog() {},
    setErrorMessage() {},
  });
  handler({
    preventDefault() {
      preventDefaultCalls += 1;
      events.push("prevent-default");
    },
  });
  const synchronousPreventDefaultCalls = preventDefaultCalls;

  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    browserOpenCalls,
    events,
    nativePlatformChecks,
    preventDefaultCalls,
    synchronousPreventDefaultCalls,
  };
}

const webCheckoutClick = await runSellerCheckoutClickScenario(false);
assert.equal(webCheckoutClick.nativePlatformChecks, 1);
assert.equal(webCheckoutClick.synchronousPreventDefaultCalls, 0);
assert.equal(webCheckoutClick.preventDefaultCalls, 0);
assertModuleValue(webCheckoutClick.events, []);
assertModuleValue(webCheckoutClick.browserOpenCalls, []);

const nativeCheckoutClick = await runSellerCheckoutClickScenario(true);
assert.equal(nativeCheckoutClick.nativePlatformChecks, 1);
assert.equal(nativeCheckoutClick.synchronousPreventDefaultCalls, 1);
assert.equal(nativeCheckoutClick.preventDefaultCalls, 1);
assertModuleValue(nativeCheckoutClick.events, [
  "prevent-default",
  "import-browser",
  "browser-open",
]);
assertModuleValue(nativeCheckoutClick.browserOpenCalls, [{ url: validLiveUrl }]);
console.log("PASS seller checkout web and native click behavior");

function visitSource(node, visitor) {
  visitor(node);
  node.forEachChild((child) => visitSource(child, visitor));
}

const merchPageAst = ts.createSourceFile(
  "src/app/merch/[id]/page.tsx",
  merchPageSource,
  ts.ScriptTarget.ES2022,
  true,
  ts.ScriptKind.TSX,
);
const checkoutGateDeclarations = [];
const protectedReadGuards = [];
visitSource(merchPageAst, (node) => {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "canReadSellerCheckout" &&
    node.initializer
  ) {
    checkoutGateDeclarations.push(node);
  }

  if (ts.isIfStatement(node)) {
    const body = node.thenStatement.getText(merchPageAst);
    if (
      body.includes("createAdminClient()") &&
      body.includes("external_checkout_url")
    ) {
      protectedReadGuards.push(node);
    }
  }
});
assert.equal(checkoutGateDeclarations.length, 1);
assert.equal(protectedReadGuards.length, 1);

const checkoutGateScript = new vm.Script(
  `(${checkoutGateDeclarations[0].initializer.getText(merchPageAst)})`,
);
const protectedReadGuardScript = new vm.Script(
  `(${protectedReadGuards[0].expression.getText(merchPageAst)})`,
);
const protectedReadScenarios = [
  {
    environment: {},
    expected: false,
    isOfficial: false,
    isOwner: false,
    label: "missing gate blocks non-owner protected read",
  },
  ...["false", "TRUE", " true ", "1", true, 1, null].map((gateValue) => ({
    environment: { TTC_SELLER_CHECKOUT_LINKS_ENABLED: gateValue },
    expected: false,
    isOfficial: false,
    isOwner: false,
    label: `malformed gate ${JSON.stringify(gateValue)} blocks non-owner protected read`,
  })),
  {
    environment: { TTC_SELLER_CHECKOUT_LINKS_ENABLED: "true" },
    expected: false,
    isOfficial: true,
    isOwner: false,
    label: "official product blocks exact-gate buyer protected read",
  },
  {
    environment: { TTC_SELLER_CHECKOUT_LINKS_ENABLED: "true" },
    expected: false,
    isOfficial: true,
    isOwner: true,
    label: "official product blocks owner protected read",
  },
  {
    environment: {},
    expected: true,
    isOfficial: false,
    isOwner: true,
    label: "non-official owner can read protected checkout fields",
  },
  {
    environment: { TTC_SELLER_CHECKOUT_LINKS_ENABLED: "true" },
    expected: true,
    isOfficial: false,
    isOwner: false,
    label: "exact gate allows eligible non-official buyer protected read",
  },
];

for (const scenario of protectedReadScenarios) {
  const context = vm.createContext({
    isOwnProduct: scenario.isOwner,
    process: { env: scenario.environment },
    product: { is_official: scenario.isOfficial },
    sellerCheckoutLinksEnabled,
  });
  const canReadSellerCheckout = checkoutGateScript.runInContext(context);
  context.canReadSellerCheckout = canReadSellerCheckout;
  const protectedReadReached = protectedReadGuardScript.runInContext(context);

  assert.equal(
    canReadSellerCheckout,
    scenario.expected,
    `${scenario.label}: gate decision`,
  );
  assert.equal(
    protectedReadReached,
    scenario.expected,
    `${scenario.label}: admin read reachability`,
  );
}
console.log("PASS protected seller checkout admin-read gate matrix");

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
const adminMerchStatusAction = sourceSection(
  adminActionsSource,
  "export async function updateMerchProductStatus",
  "export async function updateMerchOrderStatus",
);
const adminMerchProductCard = sourceSection(
  adminMerchPageSource,
  "function ProductCard",
  "function OrderCard",
);
const adminProtectedCheckoutQuery = sourceSection(
  adminMerchPageSource,
  "const productIds =",
  "const products: MerchProduct[]",
);
const ownerCheckoutQuery = sourceSection(
  merchPageSource,
  "const canReadSellerCheckout",
  "const checkoutReadiness",
);
const sourceContractFailures = [];

function sourceContract(label, ok) {
  if (!ok) sourceContractFailures.push(label);
}

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
      editMerchForm.indexOf('name="return_policy"'),
);
sourceContract(
  "protected checkout fields use an exact admin read only for the owner or enabled buyer flow",
  merchPageSource.includes("const isOwnProduct = claims?.sub === product.seller_id") &&
    ownerCheckoutQuery.includes(
      "isOwnProduct || sellerCheckoutLinksEnabled(process.env)",
    ) &&
    ownerCheckoutQuery.includes("createAdminClient()") &&
    ownerCheckoutQuery.includes("external_checkout_url") &&
    ownerCheckoutQuery.includes("seller_checkout_terms_accepted_at") &&
    ownerCheckoutQuery.includes("seller_checkout_terms_version") &&
    ownerCheckoutQuery.includes('.eq("id", product.id)') &&
    ownerCheckoutQuery.includes('.eq("seller_id", product.seller_id)') &&
    ownerCheckoutQuery.includes("if (!checkoutError && checkoutRow)") &&
    !ownerCheckoutQuery.includes("console."),
);
sourceContract(
  "product detail uses seller purchase readiness and never posts to TTC checkout",
  merchPageSource.includes("sellerCheckoutPurchaseReadiness") &&
    merchPageSource.includes("const checkoutReadiness =") &&
    !merchPageSource.includes('/api/merch/checkout'),
);
sourceContract(
  "buyer handoff is anonymous and shown only for a ready non-owner listing",
  merchPageSource.includes("{isOwnProduct ? (") &&
    merchPageSource.includes(") : checkoutReadiness.ready &&") &&
    merchPageSource.includes("available > 0 &&") &&
    merchPageSource.includes("sellerVerified &&") &&
    merchPageSource.includes('product.status === "active"') &&
    merchPageSource.includes('product.moderation_status === "active"') &&
    merchPageSource.includes("<SellerCheckoutDialog") &&
    merchPageSource.includes("checkoutUrl={checkoutReadiness.url}") &&
    merchPageSource.includes("sellerName={product.profiles.display_name}") &&
    !merchPageSource.includes("Sign in to buy") &&
    !merchPageSource.includes("/login?return_to="),
);
sourceContract(
  "product cards never select or render protected seller checkout URLs",
  productCardSources.every(
    ({ source }) => !source.includes("external_checkout_url"),
  ),
);
sourceContract(
  "seller checkout dialog exposes the approved serializable interface",
  sellerCheckoutDialogSource.includes('"use client"') &&
    sellerCheckoutDialogSource.includes("export function SellerCheckoutDialog({") &&
    sellerCheckoutDialogSource.includes("checkoutUrl: string") &&
    sellerCheckoutDialogSource.includes("sellerName: string"),
);
sourceContract(
  "seller checkout dialog traps focus and returns it after Escape or close",
  sellerCheckoutDialogSource.includes('aria-modal="true"') &&
    sellerCheckoutDialogSource.includes('role="dialog"') &&
    sellerCheckoutDialogSource.includes("closeButtonRef.current?.focus()") &&
    sellerCheckoutDialogSource.includes('event.key === "Escape"') &&
    sellerCheckoutDialogSource.includes('event.key !== "Tab"') &&
    sellerCheckoutDialogSource.includes("dialogRef.current.contains(focused)") &&
    sellerCheckoutDialogSource.includes("openerRef.current?.focus()"),
);
sourceContract(
  "seller checkout disclosure names the seller and assigns every purchase responsibility",
  sellerCheckoutDialogSource.includes("{sellerName}") &&
    [
      "payment",
      "tax",
      "shipping",
      "returns",
      "refunds",
      "disputes",
      "purchase support",
    ].every((term) => sellerCheckoutDialogSource.toLowerCase().includes(term)),
);
sourceContract(
  "seller checkout web anchor is protected and preserves the validated URL unchanged",
  sellerCheckoutDialogSource.includes("href={checkoutUrl}") &&
    sellerCheckoutDialogSource.includes('target="_blank"') &&
    sellerCheckoutDialogSource.includes(
      'rel="ugc nofollow noopener noreferrer"',
    ),
);

const nativeGuardIndex = sellerCheckoutDialogSource.indexOf(
  "Capacitor.isNativePlatform()",
);
const preventDefaultIndex = sellerCheckoutDialogSource.indexOf(
  "event.preventDefault()",
  nativeGuardIndex,
);
const browserImportIndex = sellerCheckoutDialogSource.indexOf(
  'import("@capacitor/browser")',
  preventDefaultIndex,
);
const browserOpenIndex = sellerCheckoutDialogSource.indexOf(
  "Browser.open({ url: checkoutUrl })",
  browserImportIndex,
);
sourceContract(
  "native seller checkout prevents WebView navigation before dynamic Browser handoff",
  sellerCheckoutDialogSource.includes(
    'import { Capacitor } from "@capacitor/core"',
  ) &&
    nativeGuardIndex !== -1 &&
    preventDefaultIndex > nativeGuardIndex &&
    browserImportIndex > preventDefaultIndex &&
    browserOpenIndex > browserImportIndex,
);
sourceContract(
  "native seller checkout failures remain fixed and provider-data-free",
  sellerCheckoutDialogSource.includes(
    'setErrorMessage("Could not open seller checkout. Try again.")',
  ) &&
    !sellerCheckoutDialogSource.includes("console.") &&
    !sellerCheckoutDialogSource.includes("error.message") &&
    !sellerCheckoutDialogSource.includes("String(error)"),
);
sourceContract(
  "seller checkout handoff never appends buyer order callback or query data",
  [
    "URLSearchParams",
    "searchParams",
    "buyerId",
    "buyer_id",
    "orderId",
    "order_id",
    "callback",
    "success_url",
    "client_reference_id",
  ].every((token) => !sellerCheckoutDialogSource.includes(token)) &&
    !sellerCheckoutDialogSource.includes("new URL(") &&
    !sellerCheckoutDialogSource.includes("`${checkoutUrl}?") &&
    occurrenceCount(sellerCheckoutDialogSource, "checkoutUrl") >= 4,
);
sourceContract(
  "owner reservations are labeled as legacy TTC checkout records",
  !merchPageSource.includes("reserved in active checkout") &&
    merchPageSource.includes("reserved in legacy TTC checkout records"),
);
sourceContract(
  "admin Merch activation uses seller checkout readiness after moderator authorization",
  adminMerchStatusAction.includes("sellerCheckoutSubmissionReadiness") &&
    adminMerchStatusAction.indexOf("await requireModerator()") <
      adminMerchStatusAction.indexOf("createAdminClient()") &&
    adminMerchStatusAction.includes("external_checkout_url") &&
    adminMerchStatusAction.includes("seller_checkout_terms_version") &&
    adminMerchStatusAction.includes("seller_checkout_terms_accepted_at") &&
    adminMerchStatusAction.includes('.eq("id", product.id)') &&
    adminMerchStatusAction.includes('.eq("seller_id", product.seller_id)') &&
    adminMerchStatusAction.includes('status === "active"') &&
    adminMerchStatusAction.includes('product.status !== "approved"') &&
    adminMerchStatusAction.includes(approvedStatusRequiredMessage) &&
    adminMerchStatusAction.includes("admin_update_merch_product_status") &&
    !adminMerchStatusAction.includes("checkoutError?.message") &&
    !adminMerchStatusAction.includes("checkoutError.message"),
);
sourceContract(
  "admin Merch activation rejects official TTC checkout and removes Connect readiness",
  adminMerchStatusAction.includes("Official TTC Merch cannot be activated in this release.") &&
    !adminMerchStatusAction.includes("stripeCheckoutPreflight") &&
    !adminMerchStatusAction.includes('.from("stripe_connect_accounts")') &&
    !adminMerchStatusAction.includes("charges_enabled") &&
    !adminMerchStatusAction.includes("payouts_enabled") &&
    !adminMerchStatusAction.includes("details_submitted"),
);
sourceContract(
  "admin Merch page reviews protected seller links without payout filters",
  adminMerchPageSource.includes("sellerCheckoutSubmissionReadiness") &&
    adminMerchPageSource.includes("createAdminClient()") &&
    adminMerchPageSource.includes(
      'id, external_checkout_url, seller_checkout_terms_version, seller_checkout_terms_accepted_at',
    ) &&
    adminMerchPageSource.includes('target="_blank"') &&
    adminMerchPageSource.includes('rel="ugc nofollow noopener noreferrer"') &&
    adminMerchPageSource.includes("Review Stripe Payment Link") &&
    adminProtectedCheckoutQuery.includes('.in("id", productIds)') &&
    adminProtectedCheckoutQuery.includes("productIdSet.has(row.id)") &&
    adminMerchProductCard.includes('product.status === "approved"') &&
    adminMerchProductCard.includes(approvedStatusRequiredMessage) &&
    adminMerchProductCard.includes("{checkoutReadiness.ready ? (") &&
    adminMerchProductCard.includes("href={checkoutReadiness.url}") &&
    !adminMerchProductCard.includes("externalCheckoutUrl") &&
    !adminMerchProductCard.includes("external_checkout_url") &&
    !adminMerchPageSource.includes("seller_payout") &&
    !adminMerchPageSource.includes("SellerPayoutFilter") &&
    !adminMerchPageSource.includes('.from("stripe_connect_accounts")'),
);
sourceContract(
  "admin Merch keeps historical TTC order and refund controls",
  adminMerchPageSource.includes("Historical TTC Orders") &&
    adminMerchPageSource.includes("refundMerchOrder") &&
    adminMerchPageSource.includes("payment_dispute_hold") &&
    adminMerchPageSource.includes("fulfillment"),
);
sourceContract(
  "admin overview distinguishes seller checkout from historical TTC reconciliation",
  adminOverviewSource
    .toLowerCase()
    .includes("seller-owned external physical-goods checkout") &&
    adminOverviewSource.includes("Historical TTC checkout reconciliation") &&
    !adminOverviewSource.includes(
      "Checkout receipts, payment status, refund status, and payout readiness live on a focused ops page.",
    ),
);

if (sourceContractFailures.length > 0) {
  for (const label of sourceContractFailures) {
    console.error("FAIL " + label);
  }
  process.exitCode = 1;
} else {
  console.log("PASS seller checkout JSX and protected-read structural contracts");
}
