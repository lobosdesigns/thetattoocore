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

function replaceMutation(source, search, replacement, expectedCount = 1) {
  const actualCount = source.split(search).length - 1;
  assert.equal(
    actualCount,
    expectedCount,
    "Mutation target count changed for " + JSON.stringify(search),
  );
  return source.split(search).join(replacement);
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
  "forged-seller-id": (source) =>
    replaceMutation(
      source,
      "seller_id: userId,\n      shipping_required: shippingRequired,",
      'seller_id: cleanText(formData.get("seller_id"), 80),\n      shipping_required: shippingRequired,',
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
  "unscoped-trusted-create": (source) =>
    replaceMutation(
      source,
      '.eq("id", product.id)\n      .eq("seller_id", userId)\n      .select("id")',
      '.eq("id", product.id)\n      .select("id")',
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
const providerSecrets = {
  cleanup: "provider-cleanup-row-secret",
  delete: "provider-delete-row-secret",
  edit: "provider-edit-row-secret",
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
    events: [],
    logs: [],
    mediaAttachResult: option(options, "mediaAttachResult", {
      data: null,
      error: null,
    }),
    mediaInspections: 0,
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
        return { data: scenario.editProduct, error: null };
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

function isVerifiedProfessional(profile) {
  return Boolean(
    profile?.license_verified_at &&
      ["artist", "studio", "vendor"].includes(profile.account_type),
  );
}

function isVerifiedArtistOrShop(profile) {
  return Boolean(
    profile?.license_verified_at &&
      ["artist", "studio"].includes(profile.account_type),
  );
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
        async inspectMediaFile() {
          const scenario = currentScenario();
          scenario.mediaInspections += 1;
          scenario.events.push({ type: "media-inspection" });
          return validMetadata;
        },
        validateMediaMetadata() {
          return currentScenario().mediaValidationMessage;
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
  assert.equal(inserts[0].payload.seller_id, testIds.actor);
  assert.equal(inserts[0].payload.status, "pending_review");
  assert.equal(inserts[0].payload.is_indexable, false);
  assert.equal(inserts[0].payload.is_official, false);
  assert.equal("external_checkout_url" in inserts[0].payload, false);
  assert.equal("seller_checkout_terms_version" in inserts[0].payload, false);
  assert.equal("seller_checkout_terms_accepted_at" in inserts[0].payload, false);
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

  for (const acceptanceValue of [undefined, "true"]) {
    await withScenario({}, async (scenario) => {
      const location = await redirectedBy(
        actions.createMerchProduct,
        validCreateForm({
          seller_checkout_terms_accepted: acceptanceValue,
        }),
      );
      assert.equal(
        location,
        homeRedirect(
          "Confirm the seller checkout responsibilities before submitting Merch.",
        ),
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
      assert.equal(scenario.adminClientCalls, 0);
      assert.equal(scenario.admin.queries.length, 0);
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
        ],
        "zero-row edit trusted write was not exact ID-and-seller scoped",
      );
      assert.equal(updates[0].payload.is_indexable, false);
      assert.equal(updates[0].payload.status, "pending_review");
      assert.equal(updates[0].payload.external_checkout_url, submittedUrl);
      assert.equal(
        updates[0].payload.seller_checkout_terms_version,
        SELLER_CHECKOUT_TERMS_VERSION,
      );
      assert.equal(updates[0].payload.seller_checkout_terms_accepted_at, null);
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
        assert.equal(updates[0].payload.status, "pending_review");
        assert.equal(updates[0].payload.is_indexable, false);
        assert.equal(updates[0].payload.external_checkout_url, submittedUrl);
        assert.equal(
          updates[0].payload.seller_checkout_terms_version,
          SELLER_CHECKOUT_TERMS_VERSION,
        );
        assert.equal(updates[0].payload.seller_checkout_terms_accepted_at, null);
        assertQueryFilters(
          updates[0],
          [
            { column: "id", operator: "eq", value: productId },
            { column: "seller_id", operator: "eq", value: testIds.actor },
          ],
          status + " edit trusted write was not exact ID-and-seller scoped",
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
const ownerCheckoutQuery = sourceSection(
  merchPageSource,
  "if (isOwnProduct && !product.is_official && claims?.sub)",
  "const checkoutFlow",
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
  "protected checkout URL query is an exact authenticated non-official owner read",
  merchPageSource.includes("const isOwnProduct = claims?.sub === product.seller_id") &&
    ownerCheckoutQuery.includes("createAdminClient()") &&
    ownerCheckoutQuery.includes('.select("external_checkout_url")') &&
    ownerCheckoutQuery.includes('.eq("id", product.id)') &&
    ownerCheckoutQuery.includes('.eq("seller_id", claims.sub)') &&
    ownerCheckoutQuery.includes("if (!checkoutError && checkoutRow)") &&
    !ownerCheckoutQuery.includes("console."),
);

if (sourceContractFailures.length > 0) {
  for (const label of sourceContractFailures) {
    console.error("FAIL " + label);
  }
  process.exitCode = 1;
} else {
  console.log("PASS seller checkout JSX and protected-read structural contracts");
}
