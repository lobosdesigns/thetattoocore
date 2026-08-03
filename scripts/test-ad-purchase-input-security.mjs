import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);

function loadTypeScriptModule(
  filePath,
  cache = new Map(),
  dependencies = new Map(),
) {
  const absolutePath = path.resolve(root, filePath);
  if (cache.has(absolutePath)) return cache.get(absolutePath).exports;
  const source = readFileSync(absolutePath, "utf8");
  const output = ts.transpileModule(source, {
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
  const loadedModule = { exports: {} };
  cache.set(absolutePath, loadedModule);
  const localRequire = (specifier) => {
    if (dependencies.has(specifier)) return dependencies.get(specifier);
    if (specifier === "server-only") return {};
    if (specifier.startsWith("node:")) return nativeRequire(specifier);
    if (
      specifier === "@apple/app-store-server-library" ||
      specifier === "google-auth-library"
    ) {
      return nativeRequire(specifier);
    }
    if (specifier.startsWith(".")) {
      const resolved = path.resolve(path.dirname(absolutePath), specifier);
      return loadTypeScriptModule(
        path.extname(resolved) ? resolved : `${resolved}.ts`,
        cache,
        dependencies,
      );
    }
    throw new Error(`Unexpected test module dependency: ${specifier}`);
  };
  vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {${output.outputText}\n})`,
    { filename: absolutePath },
  )(
    loadedModule.exports,
    localRequire,
    loadedModule,
    absolutePath,
    path.dirname(absolutePath),
  );
  return loadedModule.exports;
}

const packagesModule = loadTypeScriptModule("src/lib/ads/credit-packages.ts");
const grantModule = loadTypeScriptModule("src/lib/ads/purchase-grant.ts");
const grantSource = readFileSync("src/lib/ads/purchase-grant.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const routes = {
  apple: readFileSync("src/app/api/ads/purchases/apple/route.ts", "utf8"),
  appleConfirm: readFileSync(
    "src/app/api/ads/purchases/apple/confirm/route.ts",
    "utf8",
  ),
  appleNotifications: readFileSync(
    "src/app/api/ads/purchases/apple/notifications/route.ts",
    "utf8",
  ),
  google: readFileSync("src/app/api/ads/purchases/google/route.ts", "utf8"),
  googleNotifications: readFileSync(
    "src/app/api/ads/purchases/google/notifications/route.ts",
    "utf8",
  ),
};
const profileId = "00000000-0000-4000-8000-000000000901";
const otherProfileId = "00000000-0000-4000-8000-000000000902";

const nextServerMock = {
  NextResponse: {
    json(body, init = {}) {
      const headers = new Headers(init.headers);
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(body), {
        headers,
        status: init.status ?? 200,
      });
    },
  },
};

function loadRoute(filePath, dependencies) {
  return loadTypeScriptModule(
    filePath,
    new Map(),
    new Map([
      ["next/cache", { revalidatePath() {} }],
      ["next/server", nextServerMock],
      ["@/lib/ads/credit-packages", packagesModule],
      ...dependencies,
    ]),
  );
}

function jsonRequest(url, body) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function streamedJsonRequest(chunks, headers = {}) {
  const encoder = new TextEncoder();
  const encoded = chunks.map((chunk) =>
    typeof chunk === "string" ? encoder.encode(chunk) : chunk,
  );
  let index = 0;
  return new Request("https://example.test/api/ads/purchases/apple", {
    body: new ReadableStream({
      pull(controller) {
        if (index >= encoded.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoded[index]);
        index += 1;
      },
    }),
    duplex: "half",
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });
}

const maliciousInputs = [
  "'; drop table public.ad_credit_ledger; --",
  '" or "1"="1',
  "<script>alert(1)</script>",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "https://androidpublisher.googleapis.com.evil.example/token",
  "https://api.storekit.apple.com@evil.example/inApps/v1",
  "../../private/service-account.json",
  '{"$ne":""}',
  "%27.or.profile_id.neq.null",
  "not.is.null",
  "value\r\nAuthorization: Bearer stolen",
  "value\u0000suffix",
  "\u0430pple_iap",
];

for (const value of maliciousInputs) {
  assert.equal(grantModule.isProfileId(value), false, `profile injection rejected: ${value}`);
  assert.equal(
    grantModule.isProviderTransactionId(value),
    false,
    `transaction injection rejected: ${value}`,
  );
  assert.equal(grantModule.cleanAppleSignedTransaction(value), null, `forged JWS rejected: ${value}`);
  assert.equal(grantModule.cleanGooglePurchaseToken(value), null, `forged Play token rejected: ${value}`);
}
assert.equal(
  grantModule.isProfileId(profileId),
  true,
);
const shapedAppleJws =
  `eyJhbGciOiJFUzI1NiJ9.eyJ0cmFuc2FjdGlvbklkIjoiMSJ9.${"A".repeat(86)}`;
assert.equal(grantModule.cleanAppleSignedTransaction(shapedAppleJws), shapedAppleJws);
assert.equal(
  grantModule.cleanGooglePurchaseToken("play-token_ABC.123:def-456"),
  "play-token_ABC.123:def-456",
);
console.log("PASS provider identifiers use strict bounded allowlists");

const forbiddenReconciliationClient = {
  async rpc() {
    throw new Error("invalid reconciliation input reached the database");
  },
};
for (const action of ["void", "reinstate", ...maliciousInputs]) {
  assert.deepEqual(
    await grantModule.reconcileVerifiedAdCreditPurchase(
      forbiddenReconciliationClient,
      {
        action,
        origin: "stripe_web",
        providerEventId: "dp_1234567890abcdef",
        providerTransactionId: "pi_1234567890abcdef",
      },
    ),
    { ok: false, reason: "invalid_reconciliation" },
    `reconciliation action rejected before RPC: ${action}`,
  );
}
console.log("PASS reconciliation actions reject legacy and malicious values before RPC");

assert.equal(
  packageJson.dependencies["@apple/app-store-server-library"],
  "3.1.0",
);
assert.equal(packageJson.dependencies["google-auth-library"], "10.5.0");
assert.ok(grantSource.includes('from "@apple/app-store-server-library"'));
assert.ok(grantSource.includes("SignedDataVerifier"));
assert.ok(grantSource.includes("verifyAndDecodeTransaction"));
assert.ok(grantSource.includes("verifyAndDecodeNotification"));
assert.equal(grantSource.includes("X509Certificate"), false);
assert.equal(grantSource.includes("certificateRawHasExtension"), false);
assert.ok(grantSource.includes('from "google-auth-library"'));
assert.ok(grantSource.includes("OAuth2Client"));
assert.ok(grantSource.includes("verifyIdToken"));
assert.equal(grantSource.includes("tokeninfo"), false);
console.log("PASS provider trust uses pinned official Apple and Google libraries");

const officialAppleCalls = [];
const officialAppleConfiguration = {
  allowSandbox: false,
  appAppleId: 123456789,
  bundleId: "com.thetattoocore.app",
  productionVerifier: {
    async verifyAndDecodeNotification(value) {
      officialAppleCalls.push(["production-notification", value]);
      return { notificationUUID: profileId, version: "2.0" };
    },
    async verifyAndDecodeTransaction(value) {
      officialAppleCalls.push(["production-transaction", value]);
      return { transactionId: "2000000000000001" };
    },
  },
  sandboxVerifier: null,
};
assert.deepEqual(
  await grantModule.verifyAppleSignedTransaction(
    shapedAppleJws,
    officialAppleConfiguration,
  ),
  { transactionId: "2000000000000001" },
);
assert.deepEqual(
  await grantModule.verifyAppleSignedNotification(
    shapedAppleJws,
    officialAppleConfiguration,
  ),
  { notificationUUID: profileId, version: "2.0" },
);
assert.deepEqual(officialAppleCalls, [
  ["production-transaction", shapedAppleJws],
  ["production-notification", shapedAppleJws],
]);
assert.equal(
  await grantModule.verifyAppleSignedTransaction(shapedAppleJws, {
    ...officialAppleConfiguration,
    productionVerifier: {
      async verifyAndDecodeTransaction() {
        throw new Error("certificate verification failed");
      },
    },
  }),
  null,
);

const sandboxAppleCalls = [];
const sandboxAppleConfiguration = {
  ...officialAppleConfiguration,
  allowSandbox: true,
  productionVerifier: {
    async verifyAndDecodeTransaction() {
      sandboxAppleCalls.push("production");
      throw new Error("production verification failed");
    },
  },
  sandboxVerifier: {
    async verifyAndDecodeTransaction() {
      sandboxAppleCalls.push("sandbox");
      return { environment: "Sandbox", transactionId: "2000000000000002" };
    },
  },
};
assert.deepEqual(
  await grantModule.verifyAppleSignedTransaction(
    shapedAppleJws,
    sandboxAppleConfiguration,
  ),
  { environment: "Sandbox", transactionId: "2000000000000002" },
);
assert.deepEqual(sandboxAppleCalls, ["production", "sandbox"]);

sandboxAppleCalls.length = 0;
assert.equal(
  await grantModule.verifyAppleSignedTransaction(shapedAppleJws, {
    ...sandboxAppleConfiguration,
    allowSandbox: false,
  }),
  null,
);
assert.deepEqual(sandboxAppleCalls, ["production"]);

const unsignedSandboxPayload = `${"H".repeat(24)}.${Buffer.from(
  JSON.stringify({ environment: "Sandbox" }),
).toString("base64url")}.${"S".repeat(86)}`;
const unsignedEnvironmentCalls = [];
assert.deepEqual(
  await grantModule.verifyAppleSignedTransaction(unsignedSandboxPayload, {
    ...sandboxAppleConfiguration,
    productionVerifier: {
      async verifyAndDecodeTransaction() {
        unsignedEnvironmentCalls.push("production");
        return { environment: "Production", transactionId: "2000000000000003" };
      },
    },
    sandboxVerifier: {
      async verifyAndDecodeTransaction() {
        unsignedEnvironmentCalls.push("sandbox");
        return { environment: "Sandbox", transactionId: "2000000000000004" };
      },
    },
  }),
  { environment: "Production", transactionId: "2000000000000003" },
);
assert.deepEqual(unsignedEnvironmentCalls, ["production"]);
console.log("PASS Apple verification is production-first and Sandbox is independently gated");

const fakeAppleRoot = `-----BEGIN CERTIFICATE-----\n${Buffer.alloc(96, 7).toString(
  "base64",
)}\n-----END CERTIFICATE-----`;
const appleVerifierFactoryCalls = [];
const appleVerifierFactory = (
  rootCertificates,
  enableOnlineChecks,
  environment,
  bundleId,
  appAppleId,
) => {
  const verifier = { environment };
  appleVerifierFactoryCalls.push({
    appAppleId,
    bundleId,
    enableOnlineChecks,
    environment,
    rootCertificateCount: rootCertificates.length,
    verifier,
  });
  return verifier;
};
const appleConfigurationEnvironment = {
  APPLE_APP_STORE_APP_ID: "123456789",
  APPLE_APP_STORE_BUNDLE_ID: "com.thetattoocore.app",
  APPLE_APP_STORE_ROOT_CA_PEM: fakeAppleRoot,
};
const productionOnlyAppleConfiguration = grantModule.appleStoreConfiguration(
  appleConfigurationEnvironment,
  appleVerifierFactory,
);
assert.equal(productionOnlyAppleConfiguration.allowSandbox, false);
assert.equal(productionOnlyAppleConfiguration.appAppleId, 123456789);
assert.equal(productionOnlyAppleConfiguration.sandboxVerifier, null);
assert.equal(appleVerifierFactoryCalls.length, 1);
assert.deepEqual(appleVerifierFactoryCalls[0], {
  appAppleId: 123456789,
  bundleId: "com.thetattoocore.app",
  enableOnlineChecks: true,
  environment: "Production",
  rootCertificateCount: 1,
  verifier: productionOnlyAppleConfiguration.productionVerifier,
});

appleVerifierFactoryCalls.length = 0;
const dualAppleConfiguration = grantModule.appleStoreConfiguration(
  {
    ...appleConfigurationEnvironment,
    APPLE_APP_STORE_ALLOW_SANDBOX: "true",
  },
  appleVerifierFactory,
);
assert.equal(dualAppleConfiguration.allowSandbox, true);
assert.equal(appleVerifierFactoryCalls.length, 2);
assert.equal(appleVerifierFactoryCalls[0].environment, "Production");
assert.equal(appleVerifierFactoryCalls[0].appAppleId, 123456789);
assert.equal(appleVerifierFactoryCalls[1].environment, "Sandbox");
assert.equal(appleVerifierFactoryCalls[1].appAppleId, undefined);
assert.equal(
  dualAppleConfiguration.sandboxVerifier,
  appleVerifierFactoryCalls[1].verifier,
);
assert.equal(
  grantModule.isAppleStoreEnvironmentAllowed(
    "Production",
    productionOnlyAppleConfiguration,
  ),
  true,
);
assert.equal(
  grantModule.isAppleStoreEnvironmentAllowed(
    "Sandbox",
    productionOnlyAppleConfiguration,
  ),
  false,
);
assert.equal(
  grantModule.isAppleStoreEnvironmentAllowed("Sandbox", dualAppleConfiguration),
  true,
);

for (const invalidEnvironment of [
  { APPLE_APP_STORE_APP_ID: undefined },
  { APPLE_APP_STORE_ALLOW_SANDBOX: "TRUE" },
  { APPLE_APP_STORE_ALLOW_SANDBOX: "1" },
  { APPLE_APP_STORE_ALLOW_SANDBOX: " true " },
  { APPLE_APP_STORE_ENVIRONMENT: "Sandbox" },
]) {
  assert.equal(
    grantModule.appleStoreConfiguration(
      { ...appleConfigurationEnvironment, ...invalidEnvironment },
      appleVerifierFactory,
    ),
    null,
  );
}
console.log("PASS Apple configuration always requires Production identity and exact Sandbox opt-in");

const invalidServiceAccountConfiguration = {
  allowTestPurchases: false,
  packageName: "com.thetattoocore.app",
  pubSubAudience: "https://example.test/google-notifications",
  pubSubServiceAccountEmail: "push@example.iam.gserviceaccount.com",
  pubSubSubscription: "projects/example/subscriptions/ad-purchases",
  serviceAccount: {
    clientEmail: "billing@example.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\ninvalid\n-----END PRIVATE KEY-----",
    tokenUri: "https://oauth2.googleapis.com/token",
  },
};
assert.equal(
  await grantModule.verifyGooglePlayProductPurchase(
    "play-token_ABC.123:def-456",
    invalidServiceAccountConfiguration,
  ),
  null,
  "invalid provider signing material fails closed without throwing",
);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("provider failure with sensitive details");
};
try {
  assert.equal(
    await grantModule.consumeGooglePlayProduct({
      accessToken: "provider-access-token",
      configuration: invalidServiceAccountConfiguration,
      productId: "ttc.adcredit.2500",
      purchaseToken: "play-token_ABC.123:def-456",
    }),
    false,
  );
  assert.equal(
    await grantModule.reviewGooglePendingRefund({
      accessToken: "provider-access-token",
      configuration: invalidServiceAccountConfiguration,
      orderId: "GPA.1234-5678-9012-34567",
      pendingRefundToken: "pending-refund-token_ABC.123:def-456",
    }),
    false,
  );
} finally {
  globalThis.fetch = originalFetch;
}
console.log("PASS provider signing and network failures remain closed and non-throwing");

const googleRefundReviewRequests = [];
globalThis.fetch = async (url, init) => {
  googleRefundReviewRequests.push({ url: String(url), init });
  return new Response(null, { status: 200 });
};
try {
  assert.equal(
    await grantModule.reviewGooglePendingRefund({
      accessToken: "provider-access-token",
      configuration: invalidServiceAccountConfiguration,
      orderId: "GPA.1234-5678-9012-34567",
      pendingRefundToken: "pending-refund-token_ABC.123:def-456",
    }),
    true,
  );
  assert.equal(googleRefundReviewRequests.length, 1);
  assert.equal(
    googleRefundReviewRequests[0].url,
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
      "com.thetattoocore.app/orders/GPA.1234-5678-9012-34567:reviewrefund",
  );
  assert.equal(googleRefundReviewRequests[0].init.method, "POST");
  assert.deepEqual(googleRefundReviewRequests[0].init.headers, {
    authorization: "Bearer provider-access-token",
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(googleRefundReviewRequests[0].init.body), {
    pendingRefundToken: "pending-refund-token_ABC.123:def-456",
    refundPreference: "NEUTRAL",
    sampleContentProvided: false,
  });

  for (const invalidReview of [
    {
      orderId: maliciousInputs[0],
      pendingRefundToken: "pending-refund-token_ABC.123:def-456",
    },
    {
      orderId: "GPA.1234-5678-9012-34567",
      pendingRefundToken: maliciousInputs[0],
    },
  ]) {
    assert.equal(
      await grantModule.reviewGooglePendingRefund({
        accessToken: "provider-access-token",
        configuration: invalidServiceAccountConfiguration,
        ...invalidReview,
      }),
      false,
    );
  }
  assert.equal(googleRefundReviewRequests.length, 1);
} finally {
  globalThis.fetch = originalFetch;
}
console.log("PASS Google refund review sends a bounded neutral recommendation only");

const googlePushToken = `${"h".repeat(24)}.${"p".repeat(48)}.${"s".repeat(96)}`;
const googlePushRequest = new Request(
  "https://example.test/google-notifications",
  {
    headers: { authorization: `Bearer ${googlePushToken}` },
    method: "POST",
  },
);
const nowSeconds = Math.floor(Date.now() / 1000);
const validGooglePushClaims = {
  aud: invalidServiceAccountConfiguration.pubSubAudience,
  email: invalidServiceAccountConfiguration.pubSubServiceAccountEmail,
  email_verified: true,
  exp: nowSeconds + 300,
  iat: nowSeconds - 10,
  iss: "https://accounts.google.com",
  sub: "1234567890",
};
const googleVerifierCalls = [];
const googleVerifier = (claims, error = null) => ({
  async verifyIdToken(options) {
    googleVerifierCalls.push(options);
    if (error) throw error;
    return { getPayload: () => claims };
  },
});
assert.equal(
  await grantModule.verifyGooglePubSubPush(
    googlePushRequest,
    invalidServiceAccountConfiguration,
    googleVerifier(validGooglePushClaims),
  ),
  true,
);
assert.deepEqual(googleVerifierCalls, [
  {
    audience: invalidServiceAccountConfiguration.pubSubAudience,
    idToken: googlePushToken,
  },
]);
for (const forgedClaims of [
  { ...validGooglePushClaims, aud: "https://evil.example/push" },
  { ...validGooglePushClaims, email: "attacker@example.iam.gserviceaccount.com" },
  { ...validGooglePushClaims, email_verified: false },
  { ...validGooglePushClaims, exp: nowSeconds - 1 },
  { ...validGooglePushClaims, iat: nowSeconds + 301 },
  { ...validGooglePushClaims, iss: "https://evil.example" },
]) {
  assert.equal(
    await grantModule.verifyGooglePubSubPush(
      googlePushRequest,
      invalidServiceAccountConfiguration,
      googleVerifier(forgedClaims),
    ),
    false,
  );
}
assert.equal(
  await grantModule.verifyGooglePubSubPush(
    googlePushRequest,
    invalidServiceAccountConfiguration,
    googleVerifier(null, new Error("key retrieval failed")),
  ),
  false,
);
console.log("PASS Google push auth verifies signature, audience, sender, and time claims");

const allowedAppleKeys = new Set(["signedTransaction"]);
const validJsonRequest = new Request("https://example.test/api/ads/purchases/apple", {
  body: JSON.stringify({ signedTransaction: "a.b.c" }),
  headers: { "content-type": "application/json" },
  method: "POST",
});
assert.deepEqual(await grantModule.readBoundedJsonObject(validJsonRequest, allowedAppleKeys), {
  ok: true,
  value: { signedTransaction: "a.b.c" },
});

for (const body of [
  "null",
  "[]",
  '"string"',
  JSON.stringify({ signedTransaction: "a.b.c", creditCents: 999999 }),
  JSON.stringify({ signedTransaction: "a.b.c", profileId: "victim" }),
  JSON.stringify({ signedTransaction: "a.b.c", provider: "stripe_web" }),
  JSON.stringify({ signedTransaction: "a.b.c", price: 1 }),
  JSON.stringify({ signedTransaction: "a.b.c", url: "https://evil.example" }),
  JSON.stringify({ signedTransaction: "a.b.c", __proto_pollution__: true }),
]) {
  const result = await grantModule.readBoundedJsonObject(
    new Request("https://example.test/api/ads/purchases/apple", {
      body,
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
    allowedAppleKeys,
  );
  assert.deepEqual(result, { ok: false, status: 400 }, `unexpected shape rejected: ${body}`);
}

assert.deepEqual(
  await grantModule.readBoundedJsonObject(
    new Request("https://example.test/api/ads/purchases/apple", {
      body: JSON.stringify({ signedTransaction: "a.b.c" }),
      headers: { "content-type": "text/plain" },
      method: "POST",
    }),
    allowedAppleKeys,
  ),
  { ok: false, status: 415 },
);
assert.deepEqual(
  await grantModule.readBoundedJsonObject(
    new Request("https://example.test/api/ads/purchases/apple", {
      body: JSON.stringify({ signedTransaction: "x".repeat(20_000) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
    allowedAppleKeys,
  ),
  { ok: false, status: 413 },
);
assert.deepEqual(
  await grantModule.readBoundedJsonObject(
    streamedJsonRequest([
      '{"signedTransaction":"',
      "x".repeat(16_384),
      '"}',
    ]),
    allowedAppleKeys,
  ),
  { ok: false, status: 413 },
  "a streamed body without Content-Length is bounded while reading",
);
assert.deepEqual(
  await grantModule.readBoundedJsonObject(
    streamedJsonRequest([JSON.stringify({ signedTransaction: "a.b.c" })], {
      "content-encoding": "gzip",
    }),
    allowedAppleKeys,
  ),
  { ok: false, status: 415 },
  "encoded request bodies are rejected before parsing",
);
assert.deepEqual(
  await grantModule.readBoundedJsonObject(
    streamedJsonRequest([new Uint8Array([0xc3, 0x28])]),
    allowedAppleKeys,
  ),
  { ok: false, status: 400 },
  "invalid UTF-8 is rejected instead of replacement-decoded",
);
console.log("PASS JSON inputs reject extra authority, unsupported media, and oversized bodies");

const routeAdmin = { rpc() {} };
let routeAuthenticatedProfileId = profileId;
const routeClaimsClient = {
  auth: {
    async getClaims() {
      return {
        data: {
          claims: routeAuthenticatedProfileId
            ? { sub: routeAuthenticatedProfileId }
            : null,
        },
      };
    },
  },
};
const appleConfiguration = {
  allowSandbox: false,
  appAppleId: 123456789,
  bundleId: "com.thetattoocore.app",
  productionVerifier: {},
  sandboxVerifier: null,
};
const validAppleTransaction = {
  appAccountToken: profileId,
  bundleId: appleConfiguration.bundleId,
  environment: "Production",
  productId: "ttc.adcredit.2500",
  quantity: 1,
  transactionId: "2000000000000001",
  type: "Consumable",
};
let appleTransaction = validAppleTransaction;
const appleGrantCalls = [];
const applePurchaseRoute = loadRoute(
  "src/app/api/ads/purchases/apple/route.ts",
  [
    [
      "@/lib/ads/purchase-grant",
      {
        ...grantModule,
        appleStoreConfiguration: () => appleConfiguration,
        grantVerifiedAdCreditPurchase: async (_client, purchase) => {
          appleGrantCalls.push(purchase);
          return {
            grantId: "10000000-0000-4000-8000-000000000901",
            ok: true,
            outcome: "granted",
          };
        },
        verifyAppleSignedTransaction: async () => appleTransaction,
      },
    ],
    ["@/lib/supabase/admin", { createAdminClient: () => routeAdmin }],
    ["@/lib/supabase/server", { createClient: async () => routeClaimsClient }],
  ],
);
const originalIosGate = process.env.TTC_IOS_AD_PURCHASES_ENABLED;
try {
  process.env.TTC_IOS_AD_PURCHASES_ENABLED = "false";
  assert.equal(
    (
      await applePurchaseRoute.POST(
        jsonRequest("https://example.test/api/ads/purchases/apple", {
          signedTransaction: shapedAppleJws,
        }),
      )
    ).status,
    503,
  );

  process.env.TTC_IOS_AD_PURCHASES_ENABLED = "true";
  assert.equal(
    (
      await applePurchaseRoute.POST(
        jsonRequest("https://example.test/api/ads/purchases/apple", {
          creditCents: 999_999,
          signedTransaction: shapedAppleJws,
        }),
      )
    ).status,
    400,
  );

  for (const invalidTransaction of [
    { ...validAppleTransaction, appAccountToken: otherProfileId },
    { ...validAppleTransaction, productId: "ttc.adcredit.2501" },
    { ...validAppleTransaction, quantity: 2 },
    { ...validAppleTransaction, revocationDate: Date.now() },
    { ...validAppleTransaction, environment: "Sandbox" },
  ]) {
    appleTransaction = invalidTransaction;
    assert.equal(
      (
        await applePurchaseRoute.POST(
          jsonRequest("https://example.test/api/ads/purchases/apple", {
            signedTransaction: shapedAppleJws,
          }),
        )
      ).status,
      400,
    );
  }

  appleTransaction = validAppleTransaction;
  const appleSuccess = await applePurchaseRoute.POST(
    jsonRequest("https://example.test/api/ads/purchases/apple", {
      signedTransaction: shapedAppleJws,
    }),
  );
  assert.equal(appleSuccess.status, 200);
  assert.equal(
    (await appleSuccess.json()).grantId,
    "10000000-0000-4000-8000-000000000901",
  );
  assert.equal(appleGrantCalls.length, 1);
  assert.deepEqual(appleGrantCalls[0], {
    creditCents: 2500,
    origin: "apple_iap",
    productId: "ttc.adcredit.2500",
    profileId,
    providerTransactionId: "2000000000000001",
  });

  appleConfiguration.allowSandbox = true;
  appleConfiguration.sandboxVerifier = {};
  appleTransaction = {
    ...validAppleTransaction,
    environment: "Sandbox",
    transactionId: "2000000000000002",
  };
  assert.equal(
    (
      await applePurchaseRoute.POST(
        jsonRequest("https://example.test/api/ads/purchases/apple", {
          signedTransaction: shapedAppleJws,
        }),
      )
    ).status,
    200,
  );
  assert.equal(appleGrantCalls.at(-1).providerTransactionId, "2000000000000002");
} finally {
  appleConfiguration.allowSandbox = false;
  appleConfiguration.sandboxVerifier = null;
  appleTransaction = validAppleTransaction;
  if (originalIosGate === undefined) {
    delete process.env.TTC_IOS_AD_PURCHASES_ENABLED;
  } else {
    process.env.TTC_IOS_AD_PURCHASES_ENABLED = originalIosGate;
  }
}

console.log("PASS Apple purchase route rejects forged authority, accounts, and states");

const appleGrantId = "10000000-0000-4000-8000-000000000901";
let appleConfirmTransaction = validAppleTransaction;
let appleConfirmResult = { grantId: appleGrantId, ok: true };
const appleConfirmCalls = [];
const appleConfirmRoute = loadRoute(
  "src/app/api/ads/purchases/apple/confirm/route.ts",
  [
    [
      "@/lib/ads/purchase-grant",
      {
        ...grantModule,
        appleStoreConfiguration: () => appleConfiguration,
        confirmVerifiedAdCreditPurchase: async (_client, purchase) => {
          appleConfirmCalls.push(purchase);
          return appleConfirmResult;
        },
        verifyAppleSignedTransaction: async () => appleConfirmTransaction,
      },
    ],
    ["@/lib/supabase/admin", { createAdminClient: () => routeAdmin }],
    ["@/lib/supabase/server", { createClient: async () => routeClaimsClient }],
  ],
);
const appleConfirmRequest = (overrides = {}) =>
  jsonRequest("https://example.test/api/ads/purchases/apple/confirm", {
    grantId: appleGrantId,
    signedTransactionJWS: shapedAppleJws,
    ...overrides,
  });

routeAuthenticatedProfileId = null;
assert.equal((await appleConfirmRoute.POST(appleConfirmRequest())).status, 401);
routeAuthenticatedProfileId = profileId;
assert.equal(
  (await appleConfirmRoute.POST(appleConfirmRequest({ confirmed: true }))).status,
  400,
);
assert.equal(
  (await appleConfirmRoute.POST(appleConfirmRequest({ grantId: "not-a-uuid" })))
    .status,
  400,
);

appleConfirmTransaction = {
  ...validAppleTransaction,
  appAccountToken: otherProfileId,
};
assert.equal((await appleConfirmRoute.POST(appleConfirmRequest())).status, 400);
assert.deepEqual(appleConfirmCalls, []);

appleConfirmTransaction = {
  ...validAppleTransaction,
  environment: "Sandbox",
};
assert.equal((await appleConfirmRoute.POST(appleConfirmRequest())).status, 400);
assert.deepEqual(appleConfirmCalls, []);

appleConfirmTransaction = validAppleTransaction;
appleConfirmResult = { ok: false, reason: "confirmation_failed" };
assert.equal((await appleConfirmRoute.POST(appleConfirmRequest())).status, 409);

appleConfirmResult = { grantId: appleGrantId, ok: true };
const appleConfirmation = await appleConfirmRoute.POST(appleConfirmRequest());
assert.equal(appleConfirmation.status, 200);
assert.deepEqual(await appleConfirmation.json(), {
  authenticated: true,
  confirmed: true,
  grantId: appleGrantId,
  ok: true,
  productId: "ttc.adcredit.2500",
  profileId,
  transactionId: "2000000000000001",
});
assert.equal(appleConfirmCalls.length, 2);
assert.deepEqual(appleConfirmCalls.at(-1), {
  creditCents: 2500,
  grantId: appleGrantId,
  origin: "apple_iap",
  productId: "ttc.adcredit.2500",
  profileId,
  providerTransactionId: "2000000000000001",
});
console.log("PASS Apple finish confirmation binds auth, signed transaction, and durable grant id");

const googleConfiguration = {
  ...invalidServiceAccountConfiguration,
  allowTestPurchases: false,
};
const validGooglePurchase = {
  accessToken: "provider-access-token",
  consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
  isTestPurchase: false,
  obfuscatedExternalAccountId: grantModule.googlePlayAccountId(profileId),
  orderId: "GPA.1234-5678-9012-34567",
  productId: "ttc.adcredit.2500",
  purchaseState: "PURCHASED",
  quantity: 1,
  refundableQuantity: 1,
};
let googlePurchase = validGooglePurchase;
const googleSequence = [];
const googlePurchaseRoute = loadRoute(
  "src/app/api/ads/purchases/google/route.ts",
  [
    [
      "@/lib/ads/purchase-grant",
      {
        ...grantModule,
        consumeGooglePlayProduct: async () => {
          googleSequence.push("consume");
          return true;
        },
        googlePlayConfiguration: () => googleConfiguration,
        grantVerifiedAdCreditPurchase: async () => {
          googleSequence.push("grant");
          return {
            grantId: "10000000-0000-4000-8000-000000000901",
            ok: true,
            outcome: "granted",
          };
        },
        verifyGooglePlayProductPurchase: async () => {
          googleSequence.push("verify");
          return googlePurchase;
        },
      },
    ],
    ["@/lib/supabase/admin", { createAdminClient: () => routeAdmin }],
    ["@/lib/supabase/server", { createClient: async () => routeClaimsClient }],
  ],
);
const googleRequest = (overrides = {}) =>
  jsonRequest("https://example.test/api/ads/purchases/google", {
    productId: "ttc.adcredit.2500",
    purchaseToken: "play-token_ABC.123:def-456",
    ...overrides,
  });
const originalAndroidGate = process.env.TTC_ANDROID_AD_PURCHASES_ENABLED;
try {
  process.env.TTC_ANDROID_AD_PURCHASES_ENABLED = "false";
  assert.equal((await googlePurchaseRoute.POST(googleRequest())).status, 503);
  assert.deepEqual(googleSequence, []);

  process.env.TTC_ANDROID_AD_PURCHASES_ENABLED = "true";
  assert.equal(
    (await googlePurchaseRoute.POST(googleRequest({ creditCents: 999_999 }))).status,
    400,
  );
  assert.equal(
    (
      await googlePurchaseRoute.POST(
        googleRequest({ productId: "ttc.adcredit.2501" }),
      )
    ).status,
    400,
  );
  assert.deepEqual(googleSequence, []);

  for (const invalidPurchase of [
    { ...validGooglePurchase, purchaseState: "PENDING" },
    { ...validGooglePurchase, purchaseState: "CANCELLED" },
    { ...validGooglePurchase, refundableQuantity: 0 },
    {
      ...validGooglePurchase,
      obfuscatedExternalAccountId: grantModule.googlePlayAccountId(otherProfileId),
    },
    { ...validGooglePurchase, isTestPurchase: true },
  ]) {
    googleSequence.length = 0;
    googlePurchase = invalidPurchase;
    assert.equal((await googlePurchaseRoute.POST(googleRequest())).status, 400);
    assert.deepEqual(googleSequence, ["verify"]);
  }

  googleSequence.length = 0;
  googlePurchase = validGooglePurchase;
  assert.equal((await googlePurchaseRoute.POST(googleRequest())).status, 200);
  assert.deepEqual(googleSequence, ["verify", "grant", "consume"]);

  googleSequence.length = 0;
  googlePurchase = {
    ...validGooglePurchase,
    consumptionState: "CONSUMPTION_STATE_CONSUMED",
  };
  assert.equal((await googlePurchaseRoute.POST(googleRequest())).status, 200);
  assert.deepEqual(googleSequence, ["verify", "grant"]);
} finally {
  if (originalAndroidGate === undefined) {
    delete process.env.TTC_ANDROID_AD_PURCHASES_ENABLED;
  } else {
    process.env.TTC_ANDROID_AD_PURCHASES_ENABLED = originalAndroidGate;
  }
}
console.log("PASS Google purchase route rejects pending, canceled, refunded, and switched accounts");

const appleNotificationJws = `${"A".repeat(24)}.${"B".repeat(24)}.${"C".repeat(86)}`;
const appleNotificationTransactionJws = `${"D".repeat(24)}.${"E".repeat(24)}.${"F".repeat(86)}`;
const appleNotificationUuid = "00000000-0000-4000-8000-000000000903";
const appleNotificationData = {
  appAppleId: appleConfiguration.appAppleId,
  bundleId: appleConfiguration.bundleId,
  environment: "Production",
  signedTransactionInfo: appleNotificationTransactionJws,
};
let appleNotification = {
  data: appleNotificationData,
  notificationType: "REFUND",
  notificationUUID: appleNotificationUuid,
  version: "2.0",
};
let appleNotificationTransaction = {
  ...validAppleTransaction,
  revocationDate: Date.now(),
};
const appleCallbackActions = [];
const appleReconciliationInputs = [];
const appleNotificationRoute = loadRoute(
  "src/app/api/ads/purchases/apple/notifications/route.ts",
  [
    [
      "@/lib/ads/purchase-grant",
      {
        ...grantModule,
        appleStoreConfiguration: () => appleConfiguration,
        grantVerifiedAdCreditPurchase: async () => {
          appleCallbackActions.push("grant");
          return {
            grantId: "10000000-0000-4000-8000-000000000901",
            ok: true,
            outcome: "granted",
          };
        },
        reconcileVerifiedAdCreditPurchase: async (_client, input) => {
          appleCallbackActions.push(`reconcile:${input.action}`);
          appleReconciliationInputs.push(input);
          return {
            ledgerId: "10000000-0000-4000-8000-000000000901",
            ok: true,
            outcome: "terminal_voided",
          };
        },
        verifyAppleSignedNotification: async () => appleNotification,
        verifyAppleSignedTransaction: async () => appleNotificationTransaction,
      },
    ],
    ["@/lib/supabase/admin", { createAdminClient: () => routeAdmin }],
  ],
);
const appleCallbackRequest = () =>
  jsonRequest("https://example.test/api/ads/purchases/apple/notifications", {
    signedPayload: appleNotificationJws,
  });

appleNotification = { ...appleNotification, version: "1.0" };
assert.equal((await appleNotificationRoute.POST(appleCallbackRequest())).status, 400);
appleNotification = { ...appleNotification, version: "2.0" };
appleNotificationTransaction = validAppleTransaction;
assert.equal((await appleNotificationRoute.POST(appleCallbackRequest())).status, 400);
assert.deepEqual(appleCallbackActions, []);

appleNotification = {
  ...appleNotification,
  data: { ...appleNotificationData, environment: "Sandbox" },
};
appleNotificationTransaction = {
  ...validAppleTransaction,
  environment: "Sandbox",
  revocationDate: Date.now(),
};
assert.equal((await appleNotificationRoute.POST(appleCallbackRequest())).status, 400);
assert.deepEqual(appleCallbackActions, []);

appleNotification = {
  ...appleNotification,
  data: appleNotificationData,
};

appleNotificationTransaction = { ...validAppleTransaction, revocationDate: Date.now() };
assert.equal((await appleNotificationRoute.POST(appleCallbackRequest())).status, 200);
assert.deepEqual(appleCallbackActions, ["reconcile:terminal_void"]);
assert.deepEqual(appleReconciliationInputs.at(-1), {
  action: "terminal_void",
  fullPurchase: true,
  origin: "apple_iap",
  productId: "ttc.adcredit.2500",
  profileId,
  providerAmountCents: null,
  providerCurrency: null,
  providerEventId: `apple:${appleNotificationUuid}`,
  providerLifecycleId: `apple-refund:${validAppleTransaction.transactionId}`,
  providerPaidAmountCents: null,
  providerTransactionId: validAppleTransaction.transactionId,
  purchaseCreditCents: 2500,
  reason: "refund",
  reconciliationCreditCents: 2500,
});

appleCallbackActions.length = 0;
appleNotification = { ...appleNotification, notificationType: "REFUND_REVERSED" };
appleNotificationTransaction = validAppleTransaction;
assert.equal((await appleNotificationRoute.POST(appleCallbackRequest())).status, 200);
assert.deepEqual(appleCallbackActions, ["reconcile:refund_reverse"]);
assert.equal(appleReconciliationInputs.at(-1).providerLifecycleId, `apple-refund:${validAppleTransaction.transactionId}`);
assert.equal(appleReconciliationInputs.at(-1).reason, "refund");

appleCallbackActions.length = 0;
appleNotification = { ...appleNotification, notificationType: "REVOKE" };
appleNotificationTransaction = { ...validAppleTransaction, revocationDate: Date.now() };
assert.equal((await appleNotificationRoute.POST(appleCallbackRequest())).status, 200);
assert.deepEqual(appleCallbackActions, ["reconcile:terminal_void"]);
assert.equal(appleReconciliationInputs.at(-1).providerLifecycleId, `apple-revocation:${validAppleTransaction.transactionId}`);
assert.equal(appleReconciliationInputs.at(-1).reason, "revocation");

appleCallbackActions.length = 0;
appleNotification = { ...appleNotification, notificationType: "ONE_TIME_CHARGE" };
appleNotificationTransaction = validAppleTransaction;
assert.equal((await appleNotificationRoute.POST(appleCallbackRequest())).status, 200);
assert.deepEqual(appleCallbackActions, ["grant"]);

appleCallbackActions.length = 0;
appleConfiguration.allowSandbox = true;
appleConfiguration.sandboxVerifier = {};
appleNotification = {
  ...appleNotification,
  data: { ...appleNotificationData, environment: "Sandbox" },
};
appleNotificationTransaction = {
  ...validAppleTransaction,
  environment: "Sandbox",
  transactionId: "2000000000000002",
};
assert.equal((await appleNotificationRoute.POST(appleCallbackRequest())).status, 200);
assert.deepEqual(appleCallbackActions, ["grant"]);
appleConfiguration.allowSandbox = false;
appleConfiguration.sandboxVerifier = null;
console.log("PASS Apple notifications reject schema drift and reconcile signed refund states");

let googlePushAuthorized = true;
let googleNotificationPurchase = validGooglePurchase;
let googleReviewRefundSucceeds = true;
let googleAuditError = null;
const googleCallbackActions = [];
const googleAdminAuditRows = [];
const googlePersistedAudits = new Map();
const googleReconciliationInputs = [];
const googleRefundReviewInputs = [];
const googleRouteAdmin = {
  rpc() {},
  from(table) {
    assert.equal(table, "admin_audit_logs");
    return {
      async insert(row) {
        googleCallbackActions.push("audit");
        googleAdminAuditRows.push(row);
        if (googleAuditError) return { error: googleAuditError };
        if (googlePersistedAudits.has(row.operation_key)) {
          return { error: { code: "23505" } };
        }
        googlePersistedAudits.set(row.operation_key, row);
        return { error: null };
      },
    };
  },
};
const googleNotificationRoute = loadRoute(
  "src/app/api/ads/purchases/google/notifications/route.ts",
  [
    [
      "@/lib/ads/purchase-grant",
      {
        ...grantModule,
        consumeGooglePlayProduct: async () => {
          googleCallbackActions.push("consume");
          return true;
        },
        googlePlayConfiguration: () => googleConfiguration,
        grantVerifiedAdCreditPurchase: async () => {
          googleCallbackActions.push("grant");
          return {
            grantId: "10000000-0000-4000-8000-000000000901",
            ok: true,
            outcome: "granted",
          };
        },
        reconcileVerifiedAdCreditPurchase: async (_client, input) => {
          googleCallbackActions.push(`reconcile:${input.action}`);
          googleReconciliationInputs.push(input);
          return {
            ledgerId: "10000000-0000-4000-8000-000000000901",
            ok: true,
            outcome: "voided",
          };
        },
        reviewGooglePendingRefund: async (input) => {
          googleCallbackActions.push("review_refund");
          googleRefundReviewInputs.push(input);
          return googleReviewRefundSucceeds;
        },
        resolveGoogleAdPurchaseProfile: async () => {
          googleCallbackActions.push("resolve");
          return profileId;
        },
        verifyGooglePlayProductPurchase: async () => {
          googleCallbackActions.push("verify");
          return googleNotificationPurchase;
        },
        verifyGooglePubSubPush: async () => googlePushAuthorized,
      },
    ],
    ["@/lib/supabase/admin", { createAdminClient: () => googleRouteAdmin }],
  ],
);
let googleMessageId = 1000;
function googleCallbackRequest(developerNotification, subscription, explicitMessageId) {
  const callbackMessageId = explicitMessageId ?? String(googleMessageId + 1);
  googleMessageId = Math.max(googleMessageId, Number(callbackMessageId));
  return jsonRequest("https://example.test/api/ads/purchases/google/notifications", {
    message: {
      data: Buffer.from(JSON.stringify(developerNotification)).toString("base64"),
      messageId: callbackMessageId,
    },
    subscription: subscription ?? googleConfiguration.pubSubSubscription,
  });
}
const googleDeveloperNotification = (event) => ({
  packageName: googleConfiguration.packageName,
  version: "1.0",
  ...event,
});
const oneTimeNotification = (notificationType) =>
  googleDeveloperNotification({
    oneTimeProductNotification: {
      notificationType,
      purchaseToken: "play-token_ABC.123:def-456",
      sku: "ttc.adcredit.2500",
      version: "1.0",
    },
  });

googlePushAuthorized = false;
assert.equal(
  (await googleNotificationRoute.POST(googleCallbackRequest(oneTimeNotification(1))))
    .status,
  401,
);
googlePushAuthorized = true;
assert.equal(
  (
    await googleNotificationRoute.POST(
      googleCallbackRequest(oneTimeNotification(1), "projects/evil/subscriptions/other"),
    )
  ).status,
  400,
);

assert.equal(
  (await googleNotificationRoute.POST(googleCallbackRequest(oneTimeNotification(2))))
    .status,
  200,
);
assert.deepEqual(googleCallbackActions, ["reconcile:terminal_void"]);
assert.deepEqual(googleReconciliationInputs.at(-1), {
  action: "terminal_void",
  fullPurchase: true,
  origin: "google_play",
  productId: "ttc.adcredit.2500",
  profileId: null,
  providerAmountCents: null,
  providerCurrency: null,
  providerEventId: `google:${googleMessageId}`,
  providerLifecycleId: "google-cancel:play-token_ABC.123:def-456",
  providerPaidAmountCents: null,
  providerTransactionId: "play-token_ABC.123:def-456",
  purchaseCreditCents: 2500,
  reason: "cancellation",
  reconciliationCreditCents: 2500,
});

googleCallbackActions.length = 0;
googleNotificationPurchase = { ...validGooglePurchase, purchaseState: "PENDING" };
assert.equal(
  (await googleNotificationRoute.POST(googleCallbackRequest(oneTimeNotification(1))))
    .status,
  400,
);
assert.deepEqual(googleCallbackActions, ["verify"]);

googleCallbackActions.length = 0;
googleNotificationPurchase = validGooglePurchase;
assert.equal(
  (await googleNotificationRoute.POST(googleCallbackRequest(oneTimeNotification(1))))
    .status,
  200,
);
assert.deepEqual(googleCallbackActions, ["verify", "resolve", "grant", "consume"]);

googleCallbackActions.length = 0;
const voidedNotification = googleDeveloperNotification({
  voidedPurchaseNotification: {
    orderId: "GPA.1234-5678-9012-34567",
    productType: 2,
    purchaseToken: "play-token_ABC.123:def-456",
    refundType: 1,
  },
});
assert.equal(
  (await googleNotificationRoute.POST(googleCallbackRequest(voidedNotification))).status,
  200,
);
assert.deepEqual(googleCallbackActions, ["reconcile:terminal_void"]);
assert.deepEqual(googleReconciliationInputs.at(-1), {
  action: "terminal_void",
  fullPurchase: true,
  origin: "google_play",
  productId: null,
  profileId: null,
  providerAmountCents: null,
  providerCurrency: null,
  providerEventId: `google:${googleMessageId}`,
  providerLifecycleId: "google-void:GPA.1234-5678-9012-34567",
  providerPaidAmountCents: null,
  providerTransactionId: "play-token_ABC.123:def-456",
  purchaseCreditCents: null,
  reason: "refund",
  reconciliationCreditCents: null,
});

googleCallbackActions.length = 0;
const pendingRefundReviewNotification = googleDeveloperNotification({
  pendingRefundReviewNotification: {
    obfuscatedAccountId: grantModule.googlePlayAccountId(profileId),
    orderId: "GPA.1234-5678-9012-34567",
    pendingRefundToken: "pending-refund-token_ABC.123:def-456",
    refundReason: 7,
    version: "1.0",
  },
});
const pendingRefundMessageId = String(googleMessageId + 1);
const pendingRefundResponse = await googleNotificationRoute.POST(
  googleCallbackRequest(
    pendingRefundReviewNotification,
    undefined,
    pendingRefundMessageId,
  ),
);
assert.equal(pendingRefundResponse.status, 200);
assert.deepEqual(await pendingRefundResponse.json(), { ok: true });
assert.deepEqual(googleCallbackActions, ["review_refund", "audit"]);
assert.deepEqual(googleRefundReviewInputs.at(-1), {
  configuration: googleConfiguration,
  orderId: "GPA.1234-5678-9012-34567",
  pendingRefundToken: "pending-refund-token_ABC.123:def-456",
});
const pendingRefundAuditKey = `google-play-refund-review:v1:${createHash("sha256")
  .update(
    `ttc-google-play-refund-review\0${pendingRefundMessageId}\0pending-refund-token_ABC.123:def-456`,
  )
  .digest("hex")}`;
assert.deepEqual(googleAdminAuditRows.at(-1), {
  actor_id: null,
  event_type: "google_play_refund_review_neutral",
  metadata: {
    provider: "google_play",
    recommendation: "neutral",
    refund_reason: "chargeback",
  },
  operation_key: pendingRefundAuditKey,
  summary: "Google Play chargeback review received a neutral recommendation.",
  target_id: null,
  target_type: "google_play_refund_review",
});
assert.equal(
  JSON.stringify(googleAdminAuditRows.at(-1)).includes("GPA.1234"),
  false,
);
assert.equal(
  JSON.stringify(googleAdminAuditRows.at(-1)).includes("pending-refund-token"),
  false,
);
assert.equal(
  JSON.stringify(googleAdminAuditRows.at(-1)).includes(pendingRefundMessageId),
  false,
);
assert.equal(googlePersistedAudits.size, 1);

googleCallbackActions.length = 0;
const exactReplayResponse = await googleNotificationRoute.POST(
  googleCallbackRequest(
    pendingRefundReviewNotification,
    undefined,
    pendingRefundMessageId,
  ),
);
assert.equal(exactReplayResponse.status, 200);
assert.deepEqual(googleCallbackActions, ["review_refund", "audit"]);
assert.equal(googleAdminAuditRows.at(-1).operation_key, pendingRefundAuditKey);
assert.equal(googlePersistedAudits.size, 1);

googleCallbackActions.length = 0;
googleReviewRefundSucceeds = false;
const originalConsoleError = console.error;
console.error = () => {};
try {
  assert.equal(
    (
      await googleNotificationRoute.POST(
        googleCallbackRequest(pendingRefundReviewNotification),
      )
    ).status,
    503,
  );
} finally {
  console.error = originalConsoleError;
}
assert.deepEqual(googleCallbackActions, ["review_refund"]);
googleReviewRefundSucceeds = true;

googleCallbackActions.length = 0;
googleAuditError = { code: "42501" };
const crashWindowMessageId = String(googleMessageId + 1);
console.error = () => {};
try {
  assert.equal(
    (
      await googleNotificationRoute.POST(
        googleCallbackRequest(
          pendingRefundReviewNotification,
          undefined,
          crashWindowMessageId,
        ),
      )
    ).status,
    500,
  );
} finally {
  console.error = originalConsoleError;
}
assert.deepEqual(googleCallbackActions, ["review_refund", "audit"]);
googleAuditError = null;

googleCallbackActions.length = 0;
assert.equal(
  (
    await googleNotificationRoute.POST(
      googleCallbackRequest(
        pendingRefundReviewNotification,
        undefined,
        crashWindowMessageId,
      ),
    )
  ).status,
  200,
);
assert.deepEqual(googleCallbackActions, ["review_refund", "audit"]);
assert.equal(googlePersistedAudits.size, 2);

for (const invalidPendingRefund of [
  {
    ...pendingRefundReviewNotification.pendingRefundReviewNotification,
    purchaseToken: "play-token_ABC.123:def-456",
  },
  {
    ...pendingRefundReviewNotification.pendingRefundReviewNotification,
    refundReason: 6,
  },
  {
    ...pendingRefundReviewNotification.pendingRefundReviewNotification,
    pendingRefundToken: maliciousInputs[0],
  },
]) {
  googleCallbackActions.length = 0;
  assert.equal(
    (
      await googleNotificationRoute.POST(
        googleCallbackRequest(
          googleDeveloperNotification({
            pendingRefundReviewNotification: invalidPendingRefund,
          }),
        ),
      )
    ).status,
    400,
  );
  assert.deepEqual(googleCallbackActions, []);
}
console.log("PASS Google callbacks authenticate envelopes and reject canceled or pending grants");

assert.ok(routes.apple.includes('process.env.TTC_IOS_AD_PURCHASES_ENABLED !== "true"'));
assert.ok(routes.google.includes('process.env.TTC_ANDROID_AD_PURCHASES_ENABLED !== "true"'));
assert.ok(routes.apple.includes("readBoundedJsonObject"));
assert.ok(routes.google.includes("readBoundedJsonObject"));
assert.ok(routes.apple.includes("verifyAppleSignedTransaction"));
assert.ok(routes.apple.includes("appAccountToken !== profileId"));
assert.ok(routes.apple.includes("grantVerifiedAdCreditPurchase"));
assert.ok(routes.apple.includes("grantId: grant.grantId"));
assert.ok(routes.appleConfirm.includes('new Set(["grantId", "signedTransactionJWS"])'));
assert.ok(routes.appleConfirm.includes("verifyAppleSignedTransaction"));
assert.ok(routes.appleConfirm.includes("confirmVerifiedAdCreditPurchase"));
assert.ok(routes.appleConfirm.includes("authenticated: true"));
assert.ok(routes.appleConfirm.includes("confirmed: true"));
assert.equal(routes.appleConfirm.includes("TTC_IOS_AD_PURCHASES_ENABLED"), false);
assert.ok(routes.google.includes("verifyGooglePlayProductPurchase"));
assert.ok(routes.google.includes("googlePlayAccountId(profileId)"));
assert.ok(routes.google.includes('purchaseState !== "PURCHASED"'));
assert.ok(routes.google.includes("grantVerifiedAdCreditPurchase"));
assert.ok(routes.google.includes("consumeGooglePlayProduct"));
assert.ok(
  routes.google.indexOf("grantVerifiedAdCreditPurchase") <
    routes.google.indexOf("consumeGooglePlayProduct"),
  "Google credit is durable before server-side consumption",
);
console.log("PASS authenticated purchase routes bind signed provider identity before grants");

assert.ok(routes.appleNotifications.includes("verifyAppleSignedNotification"));
assert.ok(routes.appleNotifications.includes("verifyAppleSignedTransaction"));
assert.ok(routes.appleNotifications.includes('notification.version !== "2.0"'));
assert.ok(routes.appleNotifications.includes("notificationUUID"));
assert.ok(routes.appleNotifications.includes('notificationType === "REFUND"'));
assert.ok(routes.appleNotifications.includes('notificationType === "REFUND_REVERSED"'));
assert.ok(routes.appleNotifications.includes('notificationType === "REVOKE"'));
assert.ok(routes.appleNotifications.includes('"refund_reverse"'));
assert.ok(routes.appleNotifications.includes('"terminal_void"'));
assert.ok(routes.appleNotifications.includes('"apple-refund"'));
assert.ok(routes.appleNotifications.includes('"apple-revocation"'));
assert.equal(routes.appleNotifications.includes('action: "release"'), false);
assert.ok(routes.appleNotifications.includes("reconcileVerifiedAdCreditPurchase"));
assert.ok(routes.googleNotifications.includes("verifyGooglePubSubPush"));
assert.ok(routes.googleNotifications.includes("messageId"));
assert.ok(routes.googleNotifications.includes("resolveGoogleAdPurchaseProfile"));
assert.ok(routes.googleNotifications.includes("reconcileVerifiedAdCreditPurchase"));
assert.ok(routes.googleNotifications.includes('action: "terminal_void"'));
assert.equal(routes.googleNotifications.includes('action: "release"'), false);
assert.ok(routes.googleNotifications.includes("pendingRefundReviewNotification"));
assert.ok(routes.googleNotifications.includes("reviewGooglePendingRefund"));
assert.ok(routes.googleNotifications.includes("google_play_refund_review_neutral"));
assert.equal(routes.googleNotifications.includes("ReviewRefund is not configured"), false);
assert.ok(
  routes.googleNotifications.indexOf(
    'eventFields[0] === "pendingRefundReviewNotification"',
  ) < routes.googleNotifications.indexOf("const rpcClient"),
);
for (const source of Object.values(routes)) {
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
  assert.equal(source.includes("eval("), false);
  assert.equal(source.includes("new Function("), false);
  assert.equal(source.includes("payload.url"), false);
  assert.equal(source.includes("payload.price"), false);
  assert.equal(source.includes("payload.creditCents"), false);
  assert.equal(source.includes("payload.profileId"), false);
  assert.equal(source.includes("error.message"), false);
  for (const maliciousInput of maliciousInputs) {
    assert.equal(source.includes(maliciousInput), false);
  }
}
console.log("PASS signed callbacks are replay-safe and do not expose caller authority or secrets");

console.log("USER INPUT SECURITY REVIEW: PASS paid ad purchase inputs fail closed");
