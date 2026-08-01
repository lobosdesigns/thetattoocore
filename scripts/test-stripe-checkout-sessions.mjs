import assert from "node:assert/strict";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const {
  StripeCheckoutRequestError,
  STRIPE_API_VERSION,
  bookingCheckoutReconciliationDecision,
  bookingCheckoutReleaseAttemptDecision,
  bookingPaidTransitionDecision,
  createStripeCheckoutSession,
  expireCheckoutSessionBeforeRollback,
  expireStripeCheckoutSession,
} = await importSelfContainedTypeScript(
  "../src/lib/stripe/checkout-session.ts",
  import.meta.url,
);

const secretKey = "test_secret_value";
const createBody = new URLSearchParams({
  mode: "payment",
  success_url: "https://thetattoocore.com/merch/checkout/success",
});

assert.equal(STRIPE_API_VERSION, "2026-06-24.dahlia");
console.log("PASS raw Checkout helpers export the pinned Stripe API version");

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
    calls.map((call) => call.init?.headers?.["Stripe-Version"]),
    [STRIPE_API_VERSION, STRIPE_API_VERSION],
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
          "Stripe-Version": STRIPE_API_VERSION,
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

const heldBooking = {
  artistId: "artist-123",
  clientId: "client-456",
  currency: "usd",
  id: "booking-789",
  totalCents: 12500,
};
const expiredUnpaidBookingSession = {
  amountTotal: heldBooking.totalCents,
  artistId: heldBooking.artistId,
  bookingId: heldBooking.id,
  clientId: heldBooking.clientId,
  clientReferenceId: heldBooking.id,
  currency: heldBooking.currency,
  id: "cs_test_booking_reconcile",
  livemode: false,
  mode: "payment",
  paymentKind: "booking_deposit",
  paymentStatus: "unpaid",
  status: "expired",
};

assert.deepEqual(
  bookingCheckoutReconciliationDecision({
    booking: heldBooking,
    expectedLivemode: false,
    session: expiredUnpaidBookingSession,
    sessionId: expiredUnpaidBookingSession.id,
  }),
  { action: "release", reason: "expired_unpaid" },
);
assert.deepEqual(
  bookingCheckoutReconciliationDecision({
    booking: heldBooking,
    expectedLivemode: false,
    session: {
      ...expiredUnpaidBookingSession,
      status: "open",
    },
    sessionId: expiredUnpaidBookingSession.id,
  }),
  { action: "expire", reason: "open_unpaid" },
);
console.log("PASS booking reconciliation distinguishes open and expired unpaid sessions");

for (const session of [
  { ...expiredUnpaidBookingSession, paymentStatus: "paid" },
  { ...expiredUnpaidBookingSession, paymentStatus: "no_payment_required" },
]) {
  assert.deepEqual(
    bookingCheckoutReconciliationDecision({
      booking: heldBooking,
      expectedLivemode: false,
      session,
      sessionId: expiredUnpaidBookingSession.id,
    }),
    { action: "hold", reason: "payment_activity" },
  );
}
assert.deepEqual(
  bookingCheckoutReconciliationDecision({
    booking: heldBooking,
    expectedLivemode: false,
    session: {
      ...expiredUnpaidBookingSession,
      status: "complete",
    },
    sessionId: expiredUnpaidBookingSession.id,
  }),
  { action: "hold", reason: "unresolved_status" },
);
console.log("PASS booking reconciliation keeps payment activity and unresolved states held");

for (const session of [
  { ...expiredUnpaidBookingSession, amountTotal: 12499 },
  { ...expiredUnpaidBookingSession, artistId: "other-artist" },
  { ...expiredUnpaidBookingSession, bookingId: "other-booking" },
  { ...expiredUnpaidBookingSession, clientId: "other-client" },
  { ...expiredUnpaidBookingSession, clientReferenceId: "other-booking" },
  { ...expiredUnpaidBookingSession, currency: "cad" },
  { ...expiredUnpaidBookingSession, id: "cs_other" },
  { ...expiredUnpaidBookingSession, livemode: true },
  { ...expiredUnpaidBookingSession, mode: "setup" },
  { ...expiredUnpaidBookingSession, paymentKind: "merch_order" },
]) {
  assert.deepEqual(
    bookingCheckoutReconciliationDecision({
      booking: heldBooking,
      expectedLivemode: false,
      session,
      sessionId: expiredUnpaidBookingSession.id,
    }),
    { action: "hold", reason: "identity_mismatch" },
  );
}
console.log("PASS booking reconciliation holds every identity mismatch");

assert.deepEqual(
  bookingCheckoutReleaseAttemptDecision({
    bookingId: heldBooking.id,
    releasedBookingId: heldBooking.id,
    updateError: false,
    verifiedReleasedBookingId: null,
    verificationError: false,
  }),
  { action: "accept", reason: "update_matched" },
);
assert.deepEqual(
  bookingCheckoutReleaseAttemptDecision({
    bookingId: heldBooking.id,
    releasedBookingId: null,
    updateError: true,
    verifiedReleasedBookingId: heldBooking.id,
    verificationError: false,
  }),
  { action: "accept", reason: "update_outcome_verified" },
);
assert.deepEqual(
  bookingCheckoutReleaseAttemptDecision({
    bookingId: heldBooking.id,
    releasedBookingId: null,
    updateError: false,
    verifiedReleasedBookingId: heldBooking.id,
    verificationError: false,
  }),
  { action: "accept", reason: "already_released" },
);
console.log("PASS booking release accepts matched and verified idempotent outcomes");

for (const decision of [
  bookingCheckoutReleaseAttemptDecision({
    bookingId: heldBooking.id,
    releasedBookingId: null,
    updateError: true,
    verifiedReleasedBookingId: null,
    verificationError: false,
  }),
  bookingCheckoutReleaseAttemptDecision({
    bookingId: heldBooking.id,
    releasedBookingId: null,
    updateError: true,
    verifiedReleasedBookingId: null,
    verificationError: true,
  }),
]) {
  assert.equal(decision.action, "reject");
}
console.log("PASS booking release rejects unverified or changed state");

assert.deepEqual(
  bookingPaidTransitionDecision({
    bookingId: heldBooking.id,
    existingPaidBookingId: null,
    lookupError: false,
    paymentIntentId: "pi_booking_paid",
    transitionedCount: 1,
  }),
  { action: "accept", reason: "transitioned" },
);
assert.deepEqual(
  bookingPaidTransitionDecision({
    bookingId: heldBooking.id,
    existingPaidBookingId: heldBooking.id,
    lookupError: false,
    paymentIntentId: "pi_booking_paid",
    transitionedCount: 0,
  }),
  { action: "accept", reason: "already_paid" },
);
for (const decision of [
  bookingPaidTransitionDecision({
    bookingId: heldBooking.id,
    existingPaidBookingId: null,
    lookupError: false,
    paymentIntentId: "pi_booking_paid",
    transitionedCount: 0,
  }),
  bookingPaidTransitionDecision({
    bookingId: heldBooking.id,
    existingPaidBookingId: null,
    lookupError: true,
    paymentIntentId: "pi_booking_paid",
    transitionedCount: 0,
  }),
  bookingPaidTransitionDecision({
    bookingId: heldBooking.id,
    existingPaidBookingId: null,
    lookupError: false,
    paymentIntentId: null,
    transitionedCount: 0,
  }),
]) {
  assert.equal(decision.action, "retry");
}
console.log("PASS booking paid transition retries mismatched and unverified zero-row outcomes");
