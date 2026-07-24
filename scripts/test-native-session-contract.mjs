import assert from "node:assert/strict";
import {
  nativeSessionFailureStatus,
  nativeSessionReturnPath,
} from "../src/lib/native-session.ts";

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

console.log("PASS native resume session verdict and return-path contract");
