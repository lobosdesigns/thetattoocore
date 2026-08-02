import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTypeScriptWithStubs } from "./admin-module-test-harness.mjs";

const {
  stripeCheckoutCreationEnabled,
  stripeCheckoutCreationMasterEnabled,
  stripeCheckoutCreationState,
  stripeConnectOnboardingEnabled,
  stripeKeyMode,
} = await importTypeScriptWithStubs(
  "src/lib/stripe/release-gates.ts",
  { "server-only": {} },
);

const keyModeCases = [
  ["sk_test_012345", "test"],
  ["sk_live_012345", "live"],
  ["rk_test_012345", "test"],
  ["rk_live_012345", "live"],
  [undefined, null],
  ["", null],
  [" sk_test_012345", null],
  ["SK_TEST_012345", null],
  ["pk_test_012345", null],
  ["sk_sandbox_012345", null],
];

for (const [key, expected] of keyModeCases) {
  assert.equal(stripeKeyMode(key), expected);
}

for (const key of [true, 1, {}]) {
  assert.equal(stripeKeyMode(key), null);
}
console.log("PASS Stripe key modes accept only supported secret and restricted prefixes");

assert.equal(typeof stripeCheckoutCreationMasterEnabled, "function");
for (const [environment, expected] of [
  [{}, false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: "false" }, false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: "trueish" }, false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: " TRUE " }, false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: "TRUE" }, false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: " true" }, false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: "true " }, false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: "true" }, true],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: true }, false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: {} }, false],
]) {
  assert.equal(stripeCheckoutCreationMasterEnabled(environment), expected);
}
console.log("PASS checkout creation master requires its own exact gate");

const checkoutGateCases = [
  [{}, "official_merch", false],
  [{ STRIPE_CHECKOUT_CREATION_ENABLED: "true" }, "official_merch", false],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "false",
      STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED: "true",
    },
    "official_merch",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "trueish",
      STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED: "true",
    },
    "official_merch",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: " true ",
      STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED: " TRUE ",
    },
    "official_merch",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED: "true",
    },
    "marketplace_merch",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED: "true",
    },
    "marketplace_merch",
    true,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_BOOKING_CHECKOUT_ENABLED: "true",
    },
    "booking",
    true,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_BOOKING_CHECKOUT_ENABLED: "false",
    },
    "booking",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_BOOKING_CHECKOUT_ENABLED: "yes",
    },
    "booking",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_BOOKING_CHECKOUT_ENABLED: "true",
    },
    "unknown_flow",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: true,
      STRIPE_BOOKING_CHECKOUT_ENABLED: "true",
    },
    "booking",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_BOOKING_CHECKOUT_ENABLED: {},
    },
    "booking",
    false,
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_BOOKING_CHECKOUT_ENABLED: "true",
    },
    true,
    false,
  ],
];

for (const [environment, flow, expected] of checkoutGateCases) {
  assert.equal(stripeCheckoutCreationEnabled(flow, environment), expected);
}
console.log("PASS checkout creation requires exact master and selected flow gates");

for (const [environment, flow, expected] of [
  [{}, "official_merch", "blocked"],
  [
    { STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED: "true" },
    "official_merch",
    "armed",
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED: "true",
    },
    "official_merch",
    "enabled",
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED: " TRUE ",
    },
    "official_merch",
    "blocked",
  ],
  [
    {
      STRIPE_CHECKOUT_CREATION_ENABLED: "true",
      STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED: "true",
    },
    "unknown_flow",
    "blocked",
  ],
]) {
  assert.equal(stripeCheckoutCreationState(flow, environment), expected);
}
console.log("PASS checkout release state distinguishes blocked, armed, and enabled");

const onboardingGateCases = [
  [{}, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: "false" }, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: "trueish" }, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: " TRUE " }, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: "TRUE" }, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: "true" }, true],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: 1 }, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: {} }, false],
];

for (const [environment, expected] of onboardingGateCases) {
  assert.equal(stripeConnectOnboardingEnabled(environment), expected);
}
console.log("PASS connected-account onboarding requires its own exact gate");

async function stripePreflightForKey(secretKey, expectedLivemode) {
  const server = await importTypeScriptWithStubs(
    "src/lib/stripe/server.ts",
    {
      "./checkout-session": { STRIPE_API_VERSION: "2026-06-24.dahlia" },
      "./release-gates": { stripeKeyMode },
      "./secret-format": {
        stripeWebhookSigningSecretFormatValid: () => true,
      },
      "server-only": {},
      stripe: {
        default: {
          createFetchHttpClient: () => ({}),
          createSubtleCryptoProvider: () => ({}),
        },
      },
    },
    {
      globals: {
        process: {
          env: {
            STRIPE_EXPECTED_LIVEMODE: String(expectedLivemode),
            STRIPE_SECRET_KEY: secretKey,
            STRIPE_WEBHOOK_SECRET: "whsec_test_value",
          },
        },
      },
    },
  );

  return server.stripeCheckoutPreflight();
}

const liveRestrictedPreflight = await stripePreflightForKey(
  "rk_live_012345",
  true,
);
assert.equal(liveRestrictedPreflight.actual, true);
assert.equal(liveRestrictedPreflight.expected, true);
assert.equal(liveRestrictedPreflight.ready, true);

const testRestrictedPreflight = await stripePreflightForKey(
  "rk_test_012345",
  false,
);
assert.equal(testRestrictedPreflight.actual, false);
assert.equal(testRestrictedPreflight.expected, false);
assert.equal(testRestrictedPreflight.ready, true);
console.log("PASS checkout preflight accepts supported restricted key modes");

const stripeServerSource = await readFile(
  new URL("../src/lib/stripe/server.ts", import.meta.url),
  "utf8",
);

assert.match(
  stripeServerSource,
  /import \{ STRIPE_API_VERSION \} from "\.\/checkout-session";/,
);
assert.match(stripeServerSource, /apiVersion: STRIPE_API_VERSION,/);
console.log("PASS Stripe SDK client uses the exported pinned API version");
