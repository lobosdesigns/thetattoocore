import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RedirectSignal,
  createSupabaseDouble,
  loadAdminActions,
  makeForm,
  testIds,
} from "./admin-module-test-harness.mjs";

async function expectRedirect(operation) {
  try {
    await operation();
  } catch (error) {
    assert.ok(error instanceof RedirectSignal, `Expected redirect, got ${error}`);
    return error.location;
  }

  assert.fail("Expected action to terminate through redirect");
}

function staffClient(role, execute) {
  return createSupabaseDouble({
    claims: {
      email: `${role}@example.com`,
      sub: testIds.actor,
    },
    execute(query) {
      if (
        query.table === "profiles" &&
        query.operation === "select" &&
        query.selection === "role"
      ) {
        return { data: { role }, error: null };
      }

      return execute(query);
    },
  });
}

{
  let mutations = 0;
  const productClient = staffClient("moderator", (query) => {
    if (query.table === "merch_products" && query.operation === "select") {
      return {
        data: {
          category: "other",
          currency: "USD",
          fulfillment_notes: null,
          id: testIds.other,
          is_official: true,
          price_cents: 2_500,
          profiles: null,
          return_policy: null,
          seller_id: testIds.third,
          shipping_required: false,
          ships_from_city: null,
          ships_from_region: null,
          status: "paused",
          title: "Fixture flash",
        },
        error: null,
      };
    }

    if (query.operation === "update" || query.operation === "insert") {
      mutations += 1;
      return { data: null, error: null };
    }

    throw new Error(`Unexpected product query on ${query.table}`);
  });
  const { actions } = await loadAdminActions({
    async createClient() {
      return productClient.client;
    },
  });

  await expectRedirect(() =>
    actions.updateMerchProductStatus(
      makeForm({
        product_id: testIds.other,
        status: "paused",
      }),
    ),
  );

  assert.equal(mutations, 0);
}
console.log("PASS repeated merchandise product decisions are no-op safe");

{
  let mutations = 0;
  const campaignClient = staffClient("moderator", (query) => {
    if (query.table === "ad_campaigns" && query.operation === "select") {
      return {
        data: {
          advertiser_id: testIds.third,
          campaign_type: "featured",
          goal: "reach",
          id: testIds.other,
          payment_dispute_hold: false,
          payment_status: "waived",
          status: "approved",
        },
        error: null,
      };
    }

    if (query.operation === "update" || query.operation === "insert") {
      mutations += 1;
      return { data: null, error: null };
    }

    throw new Error(`Unexpected campaign query on ${query.table}`);
  });
  const { actions } = await loadAdminActions({
    async createClient() {
      return campaignClient.client;
    },
  });

  await expectRedirect(() =>
    actions.updateAdCampaignStatus(
      makeForm({
        campaign_id: testIds.other,
        status: "approved",
      }),
    ),
  );

  assert.equal(mutations, 0);
}
console.log("PASS repeated ad campaign decisions are no-op safe");

{
  let mutations = 0;
  const campaignClient = staffClient("admin", (query) => {
    if (query.table === "ad_campaigns" && query.operation === "select") {
      return {
        data: {
          advertiser_id: testIds.third,
          campaign_type: "featured",
          daily_budget_cents: 1_000,
          goal: "reach",
          id: testIds.other,
          payment_status: "waived",
          prepaid_amount_cents: 1_000,
          status: "approved",
        },
        error: null,
      };
    }

    if (query.operation === "update" || query.operation === "insert") {
      mutations += 1;
      return { data: null, error: null };
    }

    throw new Error(`Unexpected campaign-credit query on ${query.table}`);
  });
  const { actions } = await loadAdminActions({
    async createClient() {
      return campaignClient.client;
    },
  });

  await expectRedirect(() =>
    actions.grantAdCampaignCredit(
      makeForm({
        campaign_id: testIds.other,
        credit_amount: "10",
        credit_reason: "promo",
      }),
    ),
  );

  assert.equal(mutations, 0);
}
console.log("PASS repeated identical campaign credits are no-op safe");

{
  let rpcCalls = 0;
  let directCreditWrites = 0;
  const creditClient = createSupabaseDouble({
    claims: {
      email: "admin@example.com",
      sub: testIds.actor,
    },
    execute(query) {
      if (
        query.table === "profiles" &&
        query.operation === "select" &&
        query.selection === "role"
      ) {
        return { data: { role: "admin" }, error: null };
      }

      if (query.table === "profiles" && query.operation === "select") {
        return {
          data: { id: testIds.other, username: "fixture_user" },
          error: null,
        };
      }

      if (
        query.table === "ad_credit_ledger" ||
        query.table === "admin_audit_logs"
      ) {
        directCreditWrites += 1;
        return { data: null, error: null };
      }

      throw new Error(`Unexpected user-credit query on ${query.table}`);
    },
    async rpc(name, payload) {
      assert.equal(name, "grant_admin_ad_credit");
      assert.equal(payload.p_actor_id, undefined);
      assert.equal(payload.p_operation_id, testIds.third);
      rpcCalls += 1;
      return { data: rpcCalls === 1, error: null };
    },
  });
  const { actions } = await loadAdminActions({
    async createClient() {
      return creditClient.client;
    },
  });
  const form = {
    credit_amount: "10",
    credit_reason: "promo",
    operation_id: testIds.third,
    profile_id: testIds.other,
  };

  await expectRedirect(() => actions.grantUserAdCredit(makeForm(form)));
  await expectRedirect(() => actions.grantUserAdCredit(makeForm(form)));

  assert.equal(rpcCalls, 2);
  assert.equal(directCreditWrites, 0);
}
console.log(
  "PASS additive user credits use one server-authorized transactional operation key",
);

{
  let lineItemWrites = 0;
  let auditWrites = 0;
  const orderClient = staffClient("admin", (query) => {
    if (query.table === "merch_orders" && query.operation === "select") {
      return {
        data: {
          buyer_id: testIds.third,
          currency: "USD",
          id: testIds.other,
          inventory_reservation_status: "consumed",
          status: "paid",
          total_cents: 5_000,
        },
        error: null,
      };
    }

    if (
      query.operation === "rpc" &&
      query.table === "admin_update_merch_order_status"
    ) {
      return { data: false, error: null };
    }

    if (query.table === "merch_order_items") {
      lineItemWrites += 1;
      return { data: null, error: null };
    }

    if (query.table === "admin_audit_logs") {
      auditWrites += 1;
      return { data: null, error: null };
    }

    throw new Error(`Unexpected order query on ${query.table}`);
  });
  const { actions } = await loadAdminActions({
    async createClient() {
      return orderClient.client;
    },
  });

  await expectRedirect(() =>
    actions.updateMerchOrderStatus(
      makeForm({
        order_id: testIds.other,
        status: "fulfilled",
      }),
    ),
  );

  assert.equal(lineItemWrites, 0);
  assert.equal(auditWrites, 0);
}
console.log(
  "PASS raced merchandise fulfillment cannot update line items or append an audit twice",
);

function stripePaymentIntent(kind, targetField, targetId) {
  return {
    latest_charge: {
      amount_refunded: 0,
      application_fee_amount: 0,
      id: "ch_fixture",
      transfer_data: null,
    },
    livemode: false,
    metadata: {
      payment_kind: kind,
      [targetField]: targetId,
    },
  };
}

{
  let auditRecorded = false;
  let refundCreateCalls = 0;
  let refundListCalls = 0;
  const userClient = staffClient("admin", (query) => {
    throw new Error(`Unexpected user refund query on ${query.table}`);
  });
  const privateClient = createSupabaseDouble({
    claims: null,
    execute(query) {
      if (query.table === "merch_orders" && query.operation === "select") {
        return {
          data: {
            id: testIds.other,
            payment_dispute_hold: false,
            status: "paid",
            stripe_payment_intent_id: "pi_merch_fixture",
            total_cents: 5_000,
          },
          error: null,
        };
      }

      if (
        query.table === "admin_audit_logs" &&
        query.operation === "select"
      ) {
        return {
          data: auditRecorded ? [{ id: testIds.third }] : [],
          error: null,
        };
      }

      if (
        query.table === "admin_audit_logs" &&
        query.operation === "insert"
      ) {
        auditRecorded = true;
        return { data: null, error: null };
      }

      throw new Error(`Unexpected private merch refund query on ${query.table}`);
    },
  });
  const stripe = {
    paymentIntents: {
      async retrieve() {
        return stripePaymentIntent(
          "merch_order",
          "merch_order_id",
          testIds.other,
        );
      },
    },
    refunds: {
      async create(params, options) {
        refundCreateCalls += 1;
        assert.equal(
          options.idempotencyKey,
          `merch-full-refund-v1:${testIds.other}:ch_fixture`,
        );
        return {
          id: "re_merch_fixture",
          metadata: params.metadata,
          status: "pending",
        };
      },
      async list() {
        refundListCalls += 1;
        return { data: [] };
      },
    },
  };
  const { actions } = await loadAdminActions({
    createAdminClient() {
      return privateClient.client;
    },
    async createClient() {
      return userClient.client;
    },
    createStripeClient() {
      return stripe;
    },
    stripeCheckoutPreflight() {
      return { actual: false, ready: true };
    },
  });
  const form = {
    confirm: "refund",
    order_id: testIds.other,
  };

  await expectRedirect(() => actions.refundMerchOrder(makeForm(form)));
  await expectRedirect(() => actions.refundMerchOrder(makeForm(form)));

  assert.equal(refundCreateCalls, 1);
  assert.equal(refundListCalls, 1);
}
console.log(
  "PASS repeated merchandise refunds reuse one Stripe key and one audit record",
);

{
  let auditRecorded = false;
  let refundCreateCalls = 0;
  const userClient = staffClient("admin", (query) => {
    throw new Error(`Unexpected user booking-refund query on ${query.table}`);
  });
  const privateClient = createSupabaseDouble({
    claims: null,
    execute(query) {
      if (query.table === "booking_requests" && query.operation === "select") {
        return {
          data: {
            id: testIds.other,
            payment_dispute_hold: false,
            payment_status: "paid",
            status: "deposit_paid",
            stripe_payment_intent_id: "pi_booking_fixture",
            title: "Fixture booking",
            total_cents: 10_000,
          },
          error: null,
        };
      }

      if (
        query.table === "admin_audit_logs" &&
        query.operation === "select"
      ) {
        return {
          data: auditRecorded ? [{ id: testIds.third }] : [],
          error: null,
        };
      }

      if (
        query.table === "admin_audit_logs" &&
        query.operation === "insert"
      ) {
        auditRecorded = true;
        return { data: null, error: null };
      }

      throw new Error(
        `Unexpected private booking refund query on ${query.table}`,
      );
    },
  });
  const stripe = {
    paymentIntents: {
      async retrieve() {
        return stripePaymentIntent(
          "booking_deposit",
          "booking_request_id",
          testIds.other,
        );
      },
    },
    refunds: {
      async create(params, options) {
        refundCreateCalls += 1;
        assert.equal(
          options.idempotencyKey,
          `booking-full-refund-v1:${testIds.other}:pi_booking_fixture`,
        );
        return {
          id: "re_booking_fixture",
          metadata: params.metadata,
          status: "pending",
        };
      },
      async list() {
        return { data: [] };
      },
    },
  };
  const { actions } = await loadAdminActions({
    createAdminClient() {
      return privateClient.client;
    },
    async createClient() {
      return userClient.client;
    },
    createStripeClient() {
      return stripe;
    },
    stripeCheckoutPreflight() {
      return { actual: false, ready: true };
    },
  });
  const form = {
    booking_id: testIds.other,
    confirm: "refund",
  };

  await expectRedirect(() => actions.refundBookingDeposit(makeForm(form)));
  await expectRedirect(() => actions.refundBookingDeposit(makeForm(form)));

  assert.equal(refundCreateCalls, 1);
}
console.log(
  "PASS repeated booking refunds reuse one Stripe key and one audit record",
);

{
  let auditWrites = 0;
  let refundCreateCalls = 0;
  const userClient = staffClient("admin", (query) => {
    throw new Error(`Unexpected failed-refund user query on ${query.table}`);
  });
  const privateClient = createSupabaseDouble({
    claims: null,
    execute(query) {
      if (query.table === "booking_requests" && query.operation === "select") {
        return {
          data: {
            id: testIds.other,
            payment_dispute_hold: false,
            payment_status: "paid",
            status: "deposit_paid",
            stripe_payment_intent_id: "pi_booking_fixture",
            title: "Fixture booking",
            total_cents: 10_000,
          },
          error: null,
        };
      }

      if (
        query.table === "admin_audit_logs" &&
        query.operation === "select"
      ) {
        return { data: [], error: null };
      }

      if (
        query.table === "admin_audit_logs" &&
        query.operation === "insert"
      ) {
        auditWrites += 1;
        return { data: null, error: null };
      }

      throw new Error(`Unexpected failed-refund query on ${query.table}`);
    },
  });
  const stripe = {
    paymentIntents: {
      async retrieve() {
        return stripePaymentIntent(
          "booking_deposit",
          "booking_request_id",
          testIds.other,
        );
      },
    },
    refunds: {
      async create() {
        refundCreateCalls += 1;
        throw new Error("A failed refund must not be retried automatically");
      },
      async list() {
        return {
          data: [
            {
              id: "re_failed_fixture",
              metadata: {
                booking_request_id: testIds.other,
                refund_kind: "booking_deposit",
              },
              status: "failed",
            },
          ],
        };
      },
    },
  };
  const { actions } = await loadAdminActions({
    createAdminClient() {
      return privateClient.client;
    },
    async createClient() {
      return userClient.client;
    },
    createStripeClient() {
      return stripe;
    },
    stripeCheckoutPreflight() {
      return { actual: false, ready: true };
    },
  });

  await expectRedirect(() =>
    actions.refundBookingDeposit(
      makeForm({
        booking_id: testIds.other,
        confirm: "refund",
      }),
    ),
  );

  assert.equal(refundCreateCalls, 0);
  assert.equal(auditWrites, 0);
}
console.log(
  "PASS failed booking refunds stop for payment review without success audits",
);

{
  const migration = await readFile(
    "supabase/migrations/20260730123000_enforce_admin_operation_idempotency.sql",
    "utf8",
  );
  const usersPage = await readFile("src/app/admin/users/page.tsx", "utf8");
  const actionsSource = await readFile("src/app/admin/actions.ts", "utf8");

  assert.match(migration, /operation_id uuid/i);
  assert.match(migration, /grant_admin_ad_credit/i);
  assert.match(migration, /on conflict \(operation_id\) do nothing/i);
  assert.match(
    migration,
    /create unique index[\s\S]*admin_audit_logs_operation_key_uidx[\s\S]*where operation_key is not null/i,
  );
  assert.match(migration, /admin_update_merch_order_status[\s\S]*for update/i);
  assert.match(
    migration,
    /update public\.merch_order_items[\s\S]*insert into public\.admin_audit_logs/i,
  );
  assert.doesNotMatch(
    migration,
    /update public\.ad_credit_ledger\s+set operation_id/i,
  );
  assert.match(usersPage, /name="operation_id"/);
  assert.match(
    actionsSource,
    /operation_key: merchRefundRequestKey[\s\S]*operation_key: bookingRefundRequestKey/,
  );
  assert.match(
    actionsSource,
    /operation_key: `booking-checkout-reconciliation-v1:/,
  );
}
console.log(
  "PASS database and form contracts enforce stable operation keys for one-time commerce effects",
);
