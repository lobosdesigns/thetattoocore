import assert from "node:assert/strict";
import {
  createSupabaseDouble,
  importTypeScriptWithStubs,
  testIds,
} from "./admin-module-test-harness.mjs";

const originalEnvironment = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

process.env.STRIPE_SECRET_KEY = "sk_test_merch_checkout_route";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_merch_checkout_route";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_merch_checkout_route";

const officialProduct = {
  currency: "usd",
  description: "Official TTC merch",
  fulfillment_notes: "Ships in two business days.",
  id: "official-merch-product",
  inventory_quantity: 10,
  inventory_reserved: 0,
  is_official: true,
  price_cents: 2500,
  profiles: null,
  return_policy: "Returns accepted within 30 days.",
  seller_id: testIds.other,
  shipping_required: false,
  ships_from_city: "Austin",
  ships_from_region: "TX",
  sku: "TTC-OFFICIAL-001",
  title: "TheTattooCore shirt",
};

const marketplaceProduct = {
  ...officialProduct,
  is_official: false,
  profiles: {
    account_type: "artist",
    license_verified_at: "2026-08-01T00:00:00.000Z",
  },
  shipping_required: true,
};

const readyPayoutAccount = {
  charges_enabled: true,
  details_submitted: true,
  livemode: false,
  payouts_enabled: true,
  stripe_account_id: "acct_marketplace_ready",
};

let activeScenario;

function makeRedirect(url, { status }) {
  return new Response(null, {
    headers: { location: String(url) },
    status,
  });
}

function createScenario(
  product,
  {
    destinationChargesEnabled = true,
    payoutAccount = readyPayoutAccount,
  } = {},
) {
  const effects = {
    adminClientCreations: 0,
    inventoryReservations: 0,
    orderWrites: 0,
    stripeBodies: [],
  };

  const checkoutSupabase = createSupabaseDouble({
    claims: { sub: testIds.actor },
    execute(query) {
      if (query.table === "merch_products" && query.operation === "select") {
        return { data: product, error: null };
      }

      if (
        (query.table === "merch_orders" || query.table === "merch_order_items") &&
        query.operation === "insert"
      ) {
        effects.orderWrites += 1;
        return { error: null };
      }

      throw new Error(`Unexpected checkout query: ${query.operation} ${query.table}`);
    },
  });

  const adminSupabase = createSupabaseDouble({
    execute(query) {
      if (
        query.table === "stripe_connect_accounts" &&
        query.operation === "select"
      ) {
        return {
          data: payoutAccount,
          error: null,
        };
      }

      if (query.table === "merch_orders" && query.operation === "update") {
        return { data: { id: "order-123" }, error: null };
      }

      throw new Error(`Unexpected admin query: ${query.operation} ${query.table}`);
    },
    async rpc(name) {
      if (name === "reserve_merch_inventory_for_order") {
        effects.inventoryReservations += 1;
        return { error: null };
      }

      throw new Error(`Unexpected admin RPC: ${name}`);
    },
  });

  return {
    adminSupabase,
    checkoutSupabase,
    destinationChargesEnabled,
    effects,
  };
}

const route = await importTypeScriptWithStubs(
  "src/app/api/merch/checkout/route.ts",
  {
    "@/lib/http/reliability": {
      checkRateLimit: () => ({ limited: false, remaining: 7, resetAt: 0 }),
    },
    "@/lib/payments/fees": {
      calculatePlatformFeeCents: () => 50,
      platformFeeDescription: () => "TTC platform fee",
    },
    "@/lib/site": {
      siteName: "TheTattooCore",
      siteUrl: "https://thetattoocore.com",
    },
    "@/lib/stripe/checkout-session": {
      createStripeCheckoutSession: async ({ body }) => {
        activeScenario.effects.stripeBodies.push(body);
        return {
          id: "cs_merch_checkout_route",
          url: "https://checkout.example/merch",
        };
      },
      expireCheckoutSessionBeforeRollback: async () => true,
      StripeCheckoutRequestError: class StripeCheckoutRequestError extends Error {},
    },
    "@/lib/stripe/release-gates": {
      stripeCheckoutCreationEnabled: () => true,
    },
    "@/lib/stripe/server": {
      stripeCheckoutPreflight: () => ({ actual: false, ready: true }),
      stripeMerchDestinationChargesEnabled: () =>
        activeScenario.destinationChargesEnabled,
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => {
        activeScenario.effects.adminClientCreations += 1;
        return activeScenario.adminSupabase.client;
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => activeScenario.checkoutSupabase.client,
    },
    "@/lib/verification": {
      isVerifiedProfessional: (profile) =>
        Boolean(profile?.license_verified_at && profile.account_type === "artist"),
    },
    "next/cache": {
      revalidatePath: () => undefined,
    },
    "next/server": {
      NextResponse: {
        redirect: makeRedirect,
      },
    },
  },
  { console: { error: () => undefined, log: () => undefined } },
);

async function postCheckout(product, options) {
  activeScenario = createScenario(product, options);
  const formData = new FormData();
  formData.set("product_id", product.id);
  formData.set("quantity", "1");

  const response = await route.POST(
    new Request("https://thetattoocore.com/api/merch/checkout", {
      body: formData,
      method: "POST",
    }),
  );

  return { response, scenario: activeScenario };
}

function allowedCountries(body) {
  return [...body.entries()]
    .filter(([key]) => key.startsWith("shipping_address_collection[allowed_countries]"))
    .map(([, value]) => value);
}

function marketplaceRejectionState(response, scenario) {
  const location = new URL(response.headers.get("location"));
  const memberMessage = location.searchParams.get("message");

  return {
    inventoryReservations: scenario.effects.inventoryReservations,
    memberMessage,
    orderWrites: scenario.effects.orderWrites,
    payoutLookups: scenario.adminSupabase.queries.filter(
      (query) =>
        query.table === "stripe_connect_accounts" && query.operation === "select",
    ).length,
    providerNamed: /stripe|supabase/i.test(memberMessage ?? ""),
    stripeRequests: scenario.effects.stripeBodies.length,
  };
}

try {
  {
    const { response, scenario } = await postCheckout(officialProduct);
    const location = new URL(response.headers.get("location"));

    assert.deepEqual(
      {
        adminClientCreations: scenario.effects.adminClientCreations,
        inventoryReservations: scenario.effects.inventoryReservations,
        memberMessage: location.searchParams.get("message"),
        orderWrites: scenario.effects.orderWrites,
        stripeRequests: scenario.effects.stripeBodies.length,
      },
      {
        adminClientCreations: 0,
        inventoryReservations: 0,
        memberMessage: "Checkout is temporarily unavailable for this product.",
        orderWrites: 0,
        stripeRequests: 0,
      },
    );
  }
  console.log("PASS official non-shipping Merch is rejected before checkout side effects");

  {
    const shippingOfficial = { ...officialProduct, shipping_required: true };
    const { scenario } = await postCheckout(shippingOfficial);
    const body = scenario.effects.stripeBodies[0];

    assert.deepEqual(allowedCountries(body), ["US"]);
    assert.deepEqual(
      {
        automaticTax: body.get("automatic_tax[enabled]"),
        platformFeeTaxBehavior: body.get(
          "line_items[1][price_data][tax_behavior]",
        ),
        productTaxBehavior: body.get(
          "line_items[0][price_data][tax_behavior]",
        ),
        productTaxCode: body.get(
          "line_items[0][price_data][product_data][tax_code]",
        ),
      },
      {
        automaticTax: "true",
        platformFeeTaxBehavior: "exclusive",
        productTaxBehavior: "exclusive",
        productTaxCode: "txcd_99999999",
      },
    );
  }
  console.log(
    "PASS official shipping-required Merch sends Stripe US-only automatic tangible-goods tax",
  );

  {
    const { scenario } = await postCheckout(marketplaceProduct);

    assert.equal(
      scenario.adminSupabase.queries.some(
        (query) =>
          query.table === "stripe_connect_accounts" && query.operation === "select",
      ),
      true,
    );
    assert.deepEqual(allowedCountries(scenario.effects.stripeBodies[0]), ["US", "CA"]);
    assert.equal(
      scenario.effects.stripeBodies[0].has("automatic_tax[enabled]"),
      false,
    );
  }
  console.log(
    "PASS marketplace shipping-required Merch keeps seller readiness, US/CA, and tax liability blocked",
  );

  {
    const { response, scenario } = await postCheckout(marketplaceProduct, {
      destinationChargesEnabled: false,
    });

    assert.deepEqual(marketplaceRejectionState(response, scenario), {
      inventoryReservations: 0,
      memberMessage: "Checkout is temporarily unavailable for this product.",
      orderWrites: 0,
      payoutLookups: 0,
      providerNamed: false,
      stripeRequests: 0,
    });
  }
  console.log("PASS disabled marketplace destination charges stop before payout lookup and checkout effects");

  {
    const { response, scenario } = await postCheckout(marketplaceProduct, {
      payoutAccount: {
        ...readyPayoutAccount,
        payouts_enabled: false,
      },
    });

    assert.deepEqual(marketplaceRejectionState(response, scenario), {
      inventoryReservations: 0,
      memberMessage: "Checkout is temporarily unavailable for this product.",
      orderWrites: 0,
      payoutLookups: 1,
      providerNamed: false,
      stripeRequests: 0,
    });
  }
  console.log("PASS unready marketplace payout account fails closed before checkout effects");
} finally {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
