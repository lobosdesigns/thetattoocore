import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const {
  stripeCheckoutCreationEnabled,
  stripeConnectOnboardingEnabled,
  stripeKeyMode,
} = await importSelfContainedTypeScript(
  "../src/lib/stripe/release-gates.ts",
  import.meta.url,
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
console.log("PASS Stripe key modes accept only supported secret and restricted prefixes");

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
    true,
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
];

for (const [environment, flow, expected] of checkoutGateCases) {
  assert.equal(stripeCheckoutCreationEnabled(flow, environment), expected);
}
console.log("PASS checkout creation requires exact master and selected flow gates");

const onboardingGateCases = [
  [{}, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: "false" }, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: "trueish" }, false],
  [{ STRIPE_CONNECT_ONBOARDING_ENABLED: " TRUE " }, true],
];

for (const [environment, expected] of onboardingGateCases) {
  assert.equal(stripeConnectOnboardingEnabled(environment), expected);
}
console.log("PASS connected-account onboarding requires its own exact gate");

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
