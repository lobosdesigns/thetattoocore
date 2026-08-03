import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const webhookRoute = readFileSync(
  new URL("../src/app/api/stripe/webhook/route.ts", import.meta.url),
  "utf8",
);
const stripeServer = readFileSync(
  new URL("../src/lib/stripe/server.ts", import.meta.url),
  "utf8",
);
const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

assert.ok(envExample.includes("STRIPE_WEBHOOK_SECRET=whsec_from_"));
assert.ok(envExample.includes("STRIPE_CONNECT_WEBHOOK_SECRET=whsec_from_"));
assert.ok(
  stripeServer.includes(
    "export function stripeConnectWebhookSigningSecretConfigured",
  ),
);
assert.ok(stripeServer.includes("process.env.STRIPE_CONNECT_WEBHOOK_SECRET"));
assert.ok(webhookRoute.includes('source: "platform"'));
assert.ok(webhookRoute.includes('source: "connect"'));
assert.ok(webhookRoute.includes("stripeWebhookAccountScope"));
assert.ok(webhookRoute.includes("p_account_scope: accountScope"));
assert.equal(webhookRoute.includes("console.error(candidate.secret"), false);

console.log("PASS platform and Connect webhook signing configuration rejects malformed values");
