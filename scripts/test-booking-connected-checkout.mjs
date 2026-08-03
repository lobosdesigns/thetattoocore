import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const {
  STRIPE_API_VERSION,
  StripeCheckoutRequestError,
  createConnectedCheckoutSession,
  expireConnectedCheckoutSessionBeforeRollback,
  expireConnectedStripeCheckoutSession,
} = await importSelfContainedTypeScript(
  "../src/lib/stripe/checkout-session.ts",
  import.meta.url,
);

const body = new URLSearchParams({
  "line_items[0][price_data][unit_amount]": "10000",
  "payment_intent_data[application_fee_amount]": "200",
  mode: "payment",
});
const secretKey = "test_secret_value";

const { bookingRefundAmountProgress, bookingRefundStripeContext } =
  await importSelfContainedTypeScript(
  "../src/lib/stripe/booking-refund.ts",
  import.meta.url,
);

assert.equal(
  bookingRefundAmountProgress({
    currentAmount: 100,
    incomingAmount: 200,
    totalAmount: 200,
  }),
  "advance",
);
assert.equal(
  bookingRefundAmountProgress({
    currentAmount: 200,
    incomingAmount: 200,
    totalAmount: 200,
  }),
  "current",
);
assert.equal(
  bookingRefundAmountProgress({
    currentAmount: 200,
    incomingAmount: 100,
    totalAmount: 200,
  }),
  "stale",
);
assert.equal(
  bookingRefundAmountProgress({
    currentAmount: 201,
    incomingAmount: 100,
    totalAmount: 200,
  }),
  null,
);
console.log("PASS booking refund totals reject invalid values and never move backward");

assert.deepEqual(
  bookingRefundStripeContext({
    connectedAccountId: "acct_ConnectedBooking123",
    feePayer: "provider",
    paymentChargeModel: "connected_direct",
  }),
  {
    refundApplicationFee: true,
    stripeAccount: "acct_ConnectedBooking123",
  },
);
assert.deepEqual(
  bookingRefundStripeContext({
    connectedAccountId: null,
    feePayer: "client",
    paymentChargeModel: "platform",
  }),
  { refundApplicationFee: false, stripeAccount: null },
);
for (const unsafeRouting of [
  {
    connectedAccountId: "acct_bad/slash",
    feePayer: "provider",
    paymentChargeModel: "connected_direct",
  },
  {
    connectedAccountId: "acct_bad\r\nStripe-Account: injected",
    feePayer: "provider",
    paymentChargeModel: "connected_direct",
  },
  {
    connectedAccountId: null,
    feePayer: "provider",
    paymentChargeModel: "connected_direct",
  },
  {
    connectedAccountId: "acct_ConnectedBooking123",
    feePayer: "client",
    paymentChargeModel: "connected_direct",
  },
  {
    connectedAccountId: "acct_ConnectedBooking123",
    feePayer: "client",
    paymentChargeModel: "platform",
  },
]) {
  assert.equal(bookingRefundStripeContext(unsafeRouting), null);
}
console.log("PASS booking refunds fail closed on unsafe charge routing");

for (const connectedAccountId of [
  "",
  "acct_",
  "acct_bad space",
  "acct_bad/slash",
  "acct_bad\r\nInjected: true",
  "ca_not_an_account",
  "acct_" + "a".repeat(250),
]) {
  let attempts = 0;

  await assert.rejects(
    () =>
      createConnectedCheckoutSession({
        body,
        connectedAccountId,
        fetcher: async () => {
          attempts += 1;
          return Response.json({ id: "cs_test_invalid", url: null });
        },
        idempotencyKey: "ttc_booking_connected_invalid",
        secretKey,
      }),
    (error) => {
      assert.ok(error instanceof StripeCheckoutRequestError);
      assert.equal(error.outcomeUnknown, false);
      assert.equal(error.message, "Checkout could not open.");
      if (connectedAccountId) {
        assert.equal(error.message.includes(connectedAccountId), false);
      }
      return true;
    },
  );
  assert.equal(attempts, 0);
}
console.log("PASS connected checkout rejects malformed account context before fetch");

{
  const calls = [];
  const connectedAccountId = "acct_ConnectedBooking123";
  const session = await createConnectedCheckoutSession({
    body,
    connectedAccountId,
    fetcher: async (input, init) => {
      calls.push({ init, input: String(input) });
      return Response.json({
        id: "cs_test_connected_booking",
        url: "https://checkout.example/connected-booking",
      });
    },
    idempotencyKey: "ttc_booking_connected_123",
    secretKey,
  });

  assert.deepEqual(session, {
    id: "cs_test_connected_booking",
    url: "https://checkout.example/connected-booking",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.headers?.["Stripe-Account"], connectedAccountId);
  assert.equal(calls[0].init?.headers?.["Stripe-Version"], STRIPE_API_VERSION);
  assert.equal(
    calls[0].init?.headers?.["Idempotency-Key"],
    "ttc_booking_connected_123",
  );
  assert.equal(calls[0].input.includes(connectedAccountId), false);
  assert.equal(String(calls[0].init?.body).includes(connectedAccountId), false);
}
console.log("PASS connected checkout sends validated account context in the Stripe header");

{
  const calls = [];
  const connectedAccountId = "acct_ConnectedBooking123";
  const expired = await expireConnectedStripeCheckoutSession({
    connectedAccountId,
    fetcher: async (input, init) => {
      calls.push({ init, input: String(input) });
      return Response.json({ id: "cs_test_connected_expire", status: "expired" });
    },
    idempotencyKey: "ttc_booking_connected_expire",
    secretKey,
    sessionId: "cs_test_connected_expire",
  });

  assert.equal(expired, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].input,
    "https://api.stripe.com/v1/checkout/sessions/cs_test_connected_expire/expire",
  );
  assert.equal(calls[0].init?.headers?.["Stripe-Account"], connectedAccountId);
  assert.equal(calls[0].init?.headers?.["Stripe-Version"], STRIPE_API_VERSION);
}
console.log("PASS connected checkout expiration uses the same account context");

{
  let attempts = 0;
  let rollbackCalls = 0;
  const released = await expireConnectedCheckoutSessionBeforeRollback({
    connectedAccountId: "acct_bad/slash",
    fetcher: async () => {
      attempts += 1;
      return Response.json({ id: "cs_test_invalid_expire" });
    },
    idempotencyKey: "ttc_booking_connected_invalid_expire",
    rollback: async () => {
      rollbackCalls += 1;
      return true;
    },
    secretKey,
    sessionId: "cs_test_invalid_expire",
  });

  assert.equal(released, false);
  assert.equal(attempts, 0);
  assert.equal(rollbackCalls, 0);
}
console.log("PASS invalid connected expiration keeps the local reservation held");

const bookingRoute = readFileSync(
  new URL("../src/app/api/bookings/checkout/route.ts", import.meta.url),
  "utf8",
);

assert.match(
  bookingRoute,
  /createConnectedCheckoutSession\(\{[\s\S]*?connectedAccountId[\s\S]*?idempotencyKey[\s\S]*?secretKey/,
);
assert.match(
  bookingRoute,
  /expireConnectedCheckoutSessionBeforeRollback\(\{[\s\S]*?connectedAccountId/,
);
assert.ok(
  bookingRoute.includes(
    '"payment_intent_data[application_fee_amount]": String(booking.platform_fee_cents)',
  ),
);
assert.equal(bookingRoute.includes("line_items[1]"), false);
assert.equal(bookingRoute.includes("platformFeeDescription"), false);
assert.match(
  bookingRoute,
  /"line_items\[0\]\[price_data\]\[unit_amount\]": String\(\s*booking\.deposit_amount_cents,?\s*\)/,
);
assert.ok(
  bookingRoute.includes("booking.total_cents !== booking.deposit_amount_cents"),
);
assert.ok(bookingRoute.includes("stripeWebhookSigningSecretConfigured()"));
assert.ok(
  bookingRoute.includes("stripeConnectWebhookSigningSecretConfigured()"),
);
console.log("PASS booking Checkout charges only the deposit and deducts the TTC fee from provider funds");

assert.ok(bookingRoute.includes('.from("stripe_connect_accounts")'));
assert.ok(bookingRoute.includes('.eq("profile_id", booking.artist_id)'));
assert.ok(bookingRoute.includes('.eq("livemode", checkoutPreflight.actual)'));
assert.ok(bookingRoute.includes('.eq("charges_enabled", true)'));
assert.ok(bookingRoute.includes('.eq("payouts_enabled", true)'));
assert.ok(bookingRoute.includes('.eq("details_submitted", true)'));
assert.ok(bookingRoute.includes('.is("disabled_reason", null)'));
assert.ok(bookingRoute.includes("requirements_currently_due"));
assert.ok(bookingRoute.includes("stripe_connected_account_id"));
assert.ok(bookingRoute.includes("p_connected_account_id"));
assert.ok(
  bookingRoute.indexOf("const adminSupabase = createAdminClient()") <
    bookingRoute.indexOf('.from("booking_requests")'),
);
assert.match(
  bookingRoute,
  /adminSupabase\s*\n?\s*\.from\("booking_requests"\)[\s\S]*?\.eq\("client_id", claims\.sub\)/,
);
console.log("PASS booking Checkout derives a live ready account from the accepted provider");

for (const forbiddenField of [
  "amount",
  "application_fee_amount",
  "connected_account_id",
  "fee_payer",
  "payment_charge_model",
  "payment_status",
  "stripe_account_id",
  "total_cents",
]) {
  assert.equal(
    bookingRoute.includes(`formData.get("${forbiddenField}")`),
    false,
    `booking Checkout must not trust caller field ${forbiddenField}`,
  );
}
console.log("PASS booking Checkout ignores caller-supplied money and routing fields");

const bookingCreateActions = readFileSync(
  new URL("../src/app/actions.ts", import.meta.url),
  "utf8",
);
const bookingAccountActions = readFileSync(
  new URL("../src/app/account/actions.ts", import.meta.url),
  "utf8",
);

assert.ok(bookingCreateActions.includes("const totalCents = depositAmountCents;"));
assert.ok(bookingCreateActions.includes('fee_payer: "provider"'));
assert.ok(bookingCreateActions.includes('payment_charge_model: "connected_direct"'));
assert.ok(bookingCreateActions.includes("depositAmountCents < 50"));
assert.equal(bookingCreateActions.includes("plus TTC fee"), false);
assert.equal(bookingCreateActions.includes("plus the TTC fee"), false);

assert.ok(
  bookingAccountActions.includes(
    "const finalTotalCents = finalDepositAmountCents;",
  ),
);
assert.ok(bookingAccountActions.includes('fee_payer: "provider"'));
assert.ok(
  bookingAccountActions.includes('payment_charge_model: "connected_direct"'),
);
assert.ok(bookingAccountActions.includes("finalDepositAmountCents < 50"));
assert.ok(
  bookingAccountActions.includes(
    "The client pays the deposit amount. TTC deducts a 2% platform fee from the provider side",
  ),
);
assert.equal(bookingAccountActions.includes("plus TTC fee"), false);
console.log("PASS booking creation and acceptance opt into provider-paid direct-charge arithmetic");

const { stripeWebhookAccountScope } = await importSelfContainedTypeScript(
  "../src/lib/stripe/webhook-account.ts",
  import.meta.url,
);

assert.equal(
  stripeWebhookAccountScope({ eventAccount: undefined, source: "platform" }),
  "platform",
);
assert.equal(
  stripeWebhookAccountScope({
    eventAccount: "acct_ConnectedBooking123",
    source: "connect",
  }),
  "acct_ConnectedBooking123",
);
for (const input of [
  { eventAccount: "acct_ConnectedBooking123", source: "platform" },
  { eventAccount: undefined, source: "connect" },
  { eventAccount: "acct_bad/slash", source: "connect" },
  { eventAccount: "acct_bad\r\nInjected: true", source: "connect" },
  { eventAccount: "ca_wrong_kind", source: "connect" },
]) {
  assert.equal(stripeWebhookAccountScope(input), null);
}
console.log("PASS webhook source and connected-account scope must agree");

const stripeWebhookRoute = readFileSync(
  new URL("../src/app/api/stripe/webhook/route.ts", import.meta.url),
  "utf8",
);
const bookingWebhookTransition = stripeWebhookRoute.slice(
  stripeWebhookRoute.indexOf("async function markBookingCheckoutSession"),
  stripeWebhookRoute.indexOf("async function markConnectedBookingRefunded"),
);

assert.ok(stripeWebhookRoute.includes("STRIPE_CONNECT_WEBHOOK_SECRET"));
assert.ok(stripeWebhookRoute.includes("stripeWebhookAccountScope"));
assert.ok(stripeWebhookRoute.includes("p_account_scope: accountScope"));
assert.match(
  stripeWebhookRoute,
  /markBookingCheckoutSession\(\{[\s\S]*?connectedAccountId: accountScope/,
);
assert.ok(
  stripeWebhookRoute.includes('.eq("stripe_connected_account_id", connectedAccountId)'),
);
assert.ok(
  stripeWebhookRoute.includes("session.amount_total !== depositAmountCents"),
);
assert.ok(stripeWebhookRoute.includes('event.type === "application_fee.created"'));
assert.ok(stripeWebhookRoute.includes('event.type === "application_fee.refunded"'));
assert.ok(stripeWebhookRoute.includes("stripe_application_fee_id"));
assert.ok(stripeWebhookRoute.includes("refunded_amount_cents"));
assert.ok(stripeWebhookRoute.includes("refunded_platform_fee_cents"));
assert.ok(stripeWebhookRoute.includes("bookingRefundAmountProgress"));
assert.ok(stripeWebhookRoute.includes("recordLatestBookingApplicationFee"));
assert.match(
  stripeWebhookRoute,
  /stripe\.applicationFees\.retrieve\(applicationFeeId\)/,
);
assert.ok(stripeWebhookRoute.includes("applicationFee.account"));
assert.ok(stripeWebhookRoute.includes("stripeAccount: connectedAccountId"));
assert.ok(
  bookingWebhookTransition.includes(
    '!["complete", "expired"].includes(session.status ?? "")',
  ),
);
assert.ok(
  bookingWebhookTransition.includes("stripe_connected_account_id: null"),
);
assert.match(
  stripeWebhookRoute,
  /markRefunded\(\{[\s\S]*?accountScope[\s\S]*?charge[\s\S]*?stripe/,
);
assert.match(
  stripeWebhookRoute,
  /recordRefundProblem\(\{[\s\S]*?accountScope/,
);
assert.match(
  stripeWebhookRoute,
  /recordPaymentDispute\(\{[\s\S]*?accountScope/,
);
assert.equal(stripeWebhookRoute.includes("stripeAccountId: account.id"), false);
console.log("PASS Stripe webhooks reconcile direct charges within connected-account scope");

const adminActions = readFileSync(
  new URL("../src/app/admin/actions.ts", import.meta.url),
  "utf8",
);
const bookingReconciliationAction = adminActions.slice(
  adminActions.indexOf("export async function reconcileBookingDepositCheckout"),
  adminActions.indexOf("export async function refundBookingDeposit"),
);
const bookingRefundAction = adminActions.slice(
  adminActions.indexOf("export async function refundBookingDeposit"),
);
assert.ok(bookingReconciliationAction.includes("bookingRefundStripeContext"));
assert.ok(bookingReconciliationAction.includes("stripe_connected_account_id"));
assert.ok(bookingReconciliationAction.includes("payment_charge_model"));
assert.ok(bookingReconciliationAction.includes("fee_payer"));
assert.match(
  bookingReconciliationAction,
  /stripe\.checkout\.sessions\.retrieve\([\s\S]*?checkoutSessionId,[\s\S]*?\{\},[\s\S]*?checkoutStripeOptions/,
);
assert.match(
  bookingReconciliationAction,
  /stripe\.checkout\.sessions\.expire\([\s\S]*?checkoutSession\.id,[\s\S]*?\{\},[\s\S]*?checkoutStripeOptions/,
);
assert.ok(
  bookingReconciliationAction.includes("stripe_connected_account_id: null"),
);
assert.equal(
  bookingReconciliationAction.includes('formData.get("connected_account_id")'),
  false,
);
console.log("PASS admin booking reconciliation uses trusted connected-account scope");

assert.ok(bookingRefundAction.includes("bookingRefundStripeContext"));
assert.ok(bookingRefundAction.includes("refund_application_fee"));
assert.ok(bookingRefundAction.includes("stripeAccount"));
assert.ok(bookingRefundAction.includes("stripe_connected_account_id"));
assert.ok(bookingRefundAction.includes("payment_charge_model"));
assert.ok(bookingRefundAction.includes("fee_payer"));
assert.ok(bookingRefundAction.includes("matchingRefund.amount !== booking.total_cents"));
assert.ok(bookingRefundAction.includes("matchingRefundChargeId !== latestCharge.id"));
assert.equal(bookingRefundAction.includes('formData.get("connected_account_id")'), false);
assert.equal(bookingRefundAction.includes('formData.get("refund_application_fee")'), false);
assert.equal(bookingRefundAction.includes('formData.get("refund_amount")'), false);
console.log("PASS admin booking refunds derive connected routing and fee reversal server-side");

const accountPage = readFileSync(
  new URL("../src/app/account/page.tsx", import.meta.url),
  "utf8",
);
const messagesPage = readFileSync(
  new URL("../src/app/messages/page.tsx", import.meta.url),
  "utf8",
);
const connectOnboardingRoute = readFileSync(
  new URL("../src/app/api/stripe/connect/onboarding/route.ts", import.meta.url),
  "utf8",
);
const connectReturnRoute = readFileSync(
  new URL("../src/app/api/stripe/connect/return/route.ts", import.meta.url),
  "utf8",
);
const adminPaymentsPage = readFileSync(
  new URL("../src/app/admin/payments/page.tsx", import.meta.url),
  "utf8",
);
const adminBookingPaymentStatuses = adminPaymentsPage.slice(
  adminPaymentsPage.indexOf("const bookingPaymentStatuses"),
  adminPaymentsPage.indexOf("const paymentEventTypes"),
);

for (const surface of [accountPage, messagesPage]) {
  assert.ok(surface.includes("payment_charge_model"));
  assert.ok(surface.includes("fee_payer"));
  assert.ok(surface.includes("Client pays"));
  assert.ok(surface.includes("TTC fee from provider"));
  assert.ok(surface.includes("Before payment processing fees"));
}
assert.ok(accountPage.includes("Booking payment setup"));
assert.ok(accountPage.includes("stripeConnectOnboardingEnabled"));
assert.ok(accountPage.includes("bookingWebhooksReady"));
assert.ok(accountPage.includes("bookingProviderPaymentReady"));
assert.ok(accountPage.includes("bookingCheckoutEnabled"));
assert.ok(accountPage.includes("requirements_currently_due"));
assert.equal(connectOnboardingRoute.includes("sellerBusinessType"), false);
assert.equal(connectOnboardingRoute.includes("vendor"), false);
assert.equal(connectOnboardingRoute.includes("merch, art, prints"), false);
assert.match(connectOnboardingRoute, /tattoo appointment deposits/i);
assert.ok(
  connectOnboardingRoute.includes(
    "stripeConnectWebhookSigningSecretConfigured",
  ),
);
assert.ok(connectOnboardingRoute.includes("connectWebhookReady"));
assert.ok(connectOnboardingRoute.includes("countryCode"));
assert.equal(connectOnboardingRoute.includes('country: profile.country_code || "US"'), false);
assert.match(
  connectOnboardingRoute,
  /stripe\.accounts\.update\(stripeAccountId,[\s\S]*?card_payments:[\s\S]*?requested: true[\s\S]*?transfers:[\s\S]*?requested: true/,
);
assert.ok(connectReturnRoute.includes("Booking payment setup"));
assert.ok(adminBookingPaymentStatuses.includes('"partially_refunded"'));
assert.ok(adminPaymentsPage.includes('"application_fee.created"'));
assert.ok(adminPaymentsPage.includes('"application_fee.refunded"'));
assert.ok(adminPaymentsPage.includes("account_scope"));
assert.ok(
  adminPaymentsPage.includes('key={`${event.event_id}:${event.account_scope}`}'),
);
assert.ok(adminPaymentsPage.includes("Connected payment account updated"));
assert.equal(
  adminPaymentsPage.includes("Legacy TTC seller payout readiness updated"),
  false,
);
assert.ok(adminPaymentsPage.includes("stripe_connected_account_id"));
assert.ok(adminPaymentsPage.includes("stripe_application_fee_id"));
assert.ok(adminPaymentsPage.includes("Provider before processing"));
assert.ok(adminPaymentsPage.includes("TTC fee reversed"));
assert.ok(adminPaymentsPage.includes("Reconciliation warning"));
console.log("PASS booking payment setup and money copy match provider-paid direct charges");
