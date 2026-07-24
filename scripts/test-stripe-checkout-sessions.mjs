import assert from "node:assert/strict";
import {
  StripeCheckoutRequestError,
  createStripeCheckoutSession,
  expireCheckoutSessionBeforeRollback,
  expireStripeCheckoutSession,
} from "../src/lib/stripe/checkout-session.ts";

const secretKey = "test_secret_value";
const createBody = new URLSearchParams({
  mode: "payment",
  success_url: "https://thetattoocore.com/merch/checkout/success",
});

{
  const calls = [];
  const fetcher = async (input, init) => {
    calls.push({ init, input: String(input) });

    if (calls.length === 1) {
      throw new TypeError("temporary network failure");
    }

    return Response.json({
      id: "cs_test_retry_safe",
      url: "https://checkout.example/session",
    });
  };

  const session = await createStripeCheckoutSession({
    body: createBody,
    fetcher,
    idempotencyKey: "ttc_merch_attempt_123",
    secretKey,
  });

  assert.deepEqual(session, {
    id: "cs_test_retry_safe",
    url: "https://checkout.example/session",
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => call.input),
    [
      "https://api.stripe.com/v1/checkout/sessions",
      "https://api.stripe.com/v1/checkout/sessions",
    ],
  );
  assert.deepEqual(
    calls.map((call) => call.init?.headers?.["Idempotency-Key"]),
    ["ttc_merch_attempt_123", "ttc_merch_attempt_123"],
  );
  assert.deepEqual(
    calls.map((call) => call.init?.method),
    ["POST", "POST"],
  );
}
console.log("PASS checkout creation retries once with one idempotency key");

{
  let attempts = 0;

  await assert.rejects(
    () =>
      createStripeCheckoutSession({
        body: createBody,
        fetcher: async () => {
          attempts += 1;
          throw new TypeError("network unavailable");
        },
        idempotencyKey: "ttc_booking_attempt_456",
        secretKey,
      }),
    (error) => {
      assert.ok(error instanceof StripeCheckoutRequestError);
      assert.equal(error.outcomeUnknown, true);
      assert.equal(error.message, "Checkout status could not be confirmed.");
      return true;
    },
  );
  assert.equal(attempts, 2);
}
console.log("PASS unresolved checkout creation stays classified as unknown");

{
  let attempts = 0;

  await assert.rejects(
    () =>
      createStripeCheckoutSession({
        body: createBody,
        fetcher: async () => {
          attempts += 1;
          return Response.json(
            { error: { message: `private ${secretKey}` } },
            { status: 400 },
          );
        },
        idempotencyKey: "ttc_ad_attempt_789",
        secretKey,
      }),
    (error) => {
      assert.ok(error instanceof StripeCheckoutRequestError);
      assert.equal(error.outcomeUnknown, false);
      assert.equal(error.message, "Checkout could not open.");
      assert.equal(error.message.includes(secretKey), false);
      return true;
    },
  );
  assert.equal(attempts, 1);
}
console.log("PASS definite checkout rejection is not retried or exposed");

{
  const calls = [];

  const session = await createStripeCheckoutSession({
    body: createBody,
    fetcher: async (_input, init) => {
      calls.push(init);

      if (calls.length === 1) {
        return Response.json(
          { error: { message: "temporary server failure" } },
          { status: 500 },
        );
      }

      return Response.json({
        id: "cs_test_server_retry",
        url: "https://checkout.example/server-retry",
      });
    },
    idempotencyKey: "ttc_server_retry_123",
    secretKey,
  });

  assert.equal(session.id, "cs_test_server_retry");
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => call?.headers?.["Idempotency-Key"]),
    ["ttc_server_retry_123", "ttc_server_retry_123"],
  );
}
console.log("PASS indeterminate server errors retry once with the same key");

{
  let attempts = 0;

  await assert.rejects(
    () =>
      createStripeCheckoutSession({
        body: createBody,
        fetcher: async () => {
          attempts += 1;

          if (attempts === 1) {
            throw new TypeError("network unavailable");
          }

          return Response.json(
            { error: { message: "idempotent request is still running" } },
            { status: 409 },
          );
        },
        idempotencyKey: "ttc_conflict_retry_123",
        secretKey,
      }),
    (error) => {
      assert.ok(error instanceof StripeCheckoutRequestError);
      assert.equal(error.outcomeUnknown, true);
      assert.equal(error.message, "Checkout status could not be confirmed.");
      return true;
    },
  );
  assert.equal(attempts, 2);
}
console.log("PASS unresolved idempotency conflicts remain classified as unknown");

{
  const calls = [];
  const expired = await expireStripeCheckoutSession({
    fetcher: async (input, init) => {
      calls.push({ init, input: String(input) });
      return Response.json({
        id: "cs_test_expire",
        status: "expired",
      });
    },
    idempotencyKey: "ttc_expire_attempt_123",
    secretKey,
    sessionId: "cs_test_expire",
  });

  assert.equal(expired, true);
  assert.deepEqual(calls, [
    {
      init: {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": "ttc_expire_attempt_123",
        },
        method: "POST",
      },
      input:
        "https://api.stripe.com/v1/checkout/sessions/cs_test_expire/expire",
    },
  ]);
}
console.log("PASS known checkout sessions use authenticated idempotent expiration");

{
  let rollbackCalls = 0;
  const released = await expireCheckoutSessionBeforeRollback({
    fetcher: async () => Response.json({ id: "cs_test_safe" }),
    idempotencyKey: "ttc_expire_safe",
    rollback: async () => {
      rollbackCalls += 1;
      return true;
    },
    secretKey,
    sessionId: "cs_test_safe",
  });

  assert.equal(released, true);
  assert.equal(rollbackCalls, 1);
}
console.log("PASS confirmed expiration releases the local reservation");

{
  let rollbackCalls = 0;
  const released = await expireCheckoutSessionBeforeRollback({
    fetcher: async () => {
      throw new TypeError("expiration status unknown");
    },
    idempotencyKey: "ttc_expire_unknown",
    rollback: async () => {
      rollbackCalls += 1;
    },
    secretKey,
    sessionId: "cs_test_unknown",
  });

  assert.equal(released, false);
  assert.equal(rollbackCalls, 0);
}
console.log("PASS unresolved expiration keeps the local reservation held");

{
  let rollbackCalls = 0;
  const released = await expireCheckoutSessionBeforeRollback({
    fetcher: async () => Response.json({ id: "cs_test_not_released" }),
    idempotencyKey: "ttc_expire_not_released",
    rollback: async () => {
      rollbackCalls += 1;
      return false;
    },
    secretKey,
    sessionId: "cs_test_not_released",
  });

  assert.equal(released, false);
  assert.equal(rollbackCalls, 1);
}
console.log("PASS zero-row rollback stays reconciliation-needed");

{
  const released = await expireCheckoutSessionBeforeRollback({
    fetcher: async () => Response.json({ id: "cs_test_rollback_error" }),
    idempotencyKey: "ttc_expire_rollback_error",
    rollback: async () => {
      throw new Error("database write failed");
    },
    secretKey,
    sessionId: "cs_test_rollback_error",
  });

  assert.equal(released, false);
}
console.log("PASS rollback errors stay reconciliation-needed");
