import assert from "node:assert/strict";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const {
  nativeSessionAccountHeader,
  nativeSessionAccountId,
  nativeSessionFailureStatus,
  nativeSessionResumeAction,
  nativeSessionReturnPath,
} = await importSelfContainedTypeScript(
  "../src/lib/native-session.ts",
  import.meta.url,
);

assert.equal(nativeSessionFailureStatus(null), 401);
assert.equal(nativeSessionFailureStatus({ name: "AuthSessionMissingError" }), 401);
assert.equal(
  nativeSessionFailureStatus({
    name: "AuthSessionMissingError",
    status: 400,
  }),
  401,
);
assert.equal(
  nativeSessionFailureStatus({
    name: "AuthRetryableFetchError",
    status: 0,
  }),
  503,
);
assert.equal(nativeSessionFailureStatus({ status: 401 }), 401);
assert.equal(nativeSessionFailureStatus({ status: 403 }), 401);
assert.equal(nativeSessionFailureStatus({ status: 429 }), 503);
assert.equal(nativeSessionFailureStatus({ status: 500 }), 503);
assert.equal(nativeSessionFailureStatus({ name: "UnexpectedAuthError" }), 503);

assert.equal(nativeSessionReturnPath("/messages"), "/messages");
assert.equal(nativeSessionReturnPath("/account"), "/account");
assert.equal(nativeSessionReturnPath("/login"), "/account");
assert.equal(nativeSessionReturnPath("//example.test"), "/account");
assert.equal(nativeSessionReturnPath("https://example.test"), "/account");
assert.equal(nativeSessionReturnPath("/login?return_to=/messages"), "/account");
assert.equal(nativeSessionReturnPath(null), "/account");

const ownerAccountId = "00000000-0000-4000-8000-000000000101";
const testerAccountId = "00000000-0000-4000-8000-000000000202";

assert.equal(nativeSessionAccountHeader, "X-TTC-Account-ID");
assert.equal(nativeSessionAccountId(ownerAccountId), ownerAccountId);
assert.equal(nativeSessionAccountId("not-an-account-id"), null);
assert.equal(nativeSessionAccountId(`${ownerAccountId}\r\nX-Forged: true`), null);
assert.equal(nativeSessionAccountId(null), null);

assert.equal(
  nativeSessionResumeAction(401, "/login", null, null),
  "preserve-auth-form",
);
assert.equal(
  nativeSessionResumeAction(401, "/forgot-password", null, null),
  "preserve-auth-form",
);
assert.equal(
  nativeSessionResumeAction(401, "/login/../account", null, null),
  "login",
);
assert.equal(
  nativeSessionResumeAction(401, "/login%0d%0aaccount", null, null),
  "login",
);
assert.equal(
  nativeSessionResumeAction(401, "/account", ownerAccountId, null),
  "login",
);
assert.equal(
  nativeSessionResumeAction(204, "/settings", ownerAccountId, ownerAccountId),
  "refresh",
);
assert.equal(
  nativeSessionResumeAction(204, "/settings", ownerAccountId, testerAccountId),
  "replace-route",
);
assert.equal(
  nativeSessionResumeAction(204, "/login", null, testerAccountId),
  "replace-route",
);
assert.equal(
  nativeSessionResumeAction(204, "/settings", ownerAccountId, null),
  "retry",
);
assert.equal(
  nativeSessionResumeAction(503, "/settings", ownerAccountId, null),
  "retry",
);

console.log("PASS native resume preserves auth forms and resets changed accounts");
