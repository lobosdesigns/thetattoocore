type StripeEnvironment = Record<string, string | undefined>;

const checkoutFlowFlags = {
  booking: "STRIPE_BOOKING_CHECKOUT_ENABLED",
  marketplace_merch: "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED",
  official_merch: "STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED",
} as const;

function exactTrue(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function stripeKeyMode(key: string | undefined) {
  if (key?.startsWith("sk_test_") || key?.startsWith("rk_test_")) {
    return "test";
  }

  if (key?.startsWith("sk_live_") || key?.startsWith("rk_live_")) {
    return "live";
  }

  return null;
}

export function stripeCheckoutCreationEnabled(
  flow: string,
  environment: StripeEnvironment = process.env,
) {
  const flowFlag = checkoutFlowFlags[flow as keyof typeof checkoutFlowFlags];

  return (
    exactTrue(environment.STRIPE_CHECKOUT_CREATION_ENABLED) &&
    exactTrue(flowFlag ? environment[flowFlag] : undefined)
  );
}

export function stripeConnectOnboardingEnabled(
  environment: StripeEnvironment = process.env,
) {
  return exactTrue(environment.STRIPE_CONNECT_ONBOARDING_ENABLED);
}
