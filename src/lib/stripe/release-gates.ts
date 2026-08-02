import "server-only";

type StripeEnvironment = Record<string, unknown>;

const checkoutFlowFlags = {
  booking: "STRIPE_BOOKING_CHECKOUT_ENABLED",
  marketplace_merch: "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED",
  official_merch: "STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED",
} as const;

export type StripeCheckoutFlow = keyof typeof checkoutFlowFlags;
export type StripeCheckoutReleaseState = "armed" | "blocked" | "enabled";

function exactTrue(value: unknown) {
  return value === "true";
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

export function stripeCheckoutCreationState(
  flow: StripeCheckoutFlow,
  environment: StripeEnvironment = process.env,
): StripeCheckoutReleaseState {
  const flowFlag = checkoutFlowFlags[flow as keyof typeof checkoutFlowFlags];
  const configured = exactTrue(flowFlag ? environment[flowFlag] : undefined);

  if (!configured) return "blocked";

  return stripeCheckoutCreationMasterEnabled(environment) ? "enabled" : "armed";
}

export function stripeConnectOnboardingEnabled(
  environment: StripeEnvironment = process.env,
) {
  return exactTrue(environment.STRIPE_CONNECT_ONBOARDING_ENABLED);
}
