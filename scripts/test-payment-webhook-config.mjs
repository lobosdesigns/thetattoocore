import assert from "node:assert/strict";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const { stripeWebhookSigningSecretFormatValid } = await importSelfContainedTypeScript(
  "../src/lib/stripe/secret-format.ts",
  import.meta.url,
);

assert.equal(
  stripeWebhookSigningSecretFormatValid(
    "whsec_0123456789AbCdEfGhIjKlMnOpQrStUv",
  ),
  true,
);
assert.equal(stripeWebhookSigningSecretFormatValid(undefined), false);
assert.equal(stripeWebhookSigningSecretFormatValid(""), false);
assert.equal(stripeWebhookSigningSecretFormatValid("whsec_"), false);
assert.equal(
  stripeWebhookSigningSecretFormatValid("whsec_placeholder_secret"),
  false,
);
assert.equal(
  stripeWebhookSigningSecretFormatValid(
    " whsec_0123456789AbCdEfGhIjKlMnOpQrStUv",
  ),
  false,
);
assert.equal(
  stripeWebhookSigningSecretFormatValid(
    ["sk", "live", "0123456789AbCdEfGhIjKlMnOpQrStUv"].join("_"),
  ),
  false,
);

console.log("PASS payment webhook signing configuration rejects malformed values");
