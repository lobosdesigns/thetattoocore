type StripeEnvironment = Record<string, unknown>;

const checkoutFlowFlags = {
  booking: "STRIPE_BOOKING_CHECKOUT_ENABLED",
  marketplace_merch: "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED",
  official_merch: "STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED",
} as const;

export type StripeCheckoutFlow = keyof typeof checkoutFlowFlags;

function exactTrue(value: unknown) {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export function stripeKeyMode(key: unknown) {
  if (typeof key !== "string") return null;

  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) {
    return "test";
  }

  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    return "live";
  }

  return null;
}

export function stripeCheckoutCreationMasterEnabled(
  environment: StripeEnvironment = process.env,
) {
  return exactTrue(environment.STRIPE_CHECKOUT_CREATION_ENABLED);
}

export function stripeCheckoutCreationEnabled(
  flow: StripeCheckoutFlow,
  environment: StripeEnvironment = process.env,
) {
  const flowFlag = checkoutFlowFlags[flow as keyof typeof checkoutFlowFlags];

  return (
    stripeCheckoutCreationMasterEnabled(environment) &&
    exactTrue(flowFlag ? environment[flowFlag] : undefined)
  );
}

export function stripeConnectOnboardingEnabled(
  environment: StripeEnvironment = process.env,
) {
  return exactTrue(environment.STRIPE_CONNECT_ONBOARDING_ENABLED);
}
