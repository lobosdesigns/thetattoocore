import "server-only";
import Stripe from "stripe";

export function expectedStripeLivemode() {
  const value = process.env.STRIPE_EXPECTED_LIVEMODE?.trim().toLowerCase();

  if (value === "true") return true;
  if (value === "false") return false;

  return null;
}

export function stripeSecretKeyLivemode(secretKey = process.env.STRIPE_SECRET_KEY) {
  if (secretKey?.startsWith("sk_live_")) return true;
  if (secretKey?.startsWith("sk_test_")) return false;

  return null;
}

export function stripeCheckoutModeMismatch() {
  const expected = expectedStripeLivemode();
  const actual = stripeSecretKeyLivemode();

  if (expected === null || actual === null || expected === actual) {
    return null;
  }

  return {
    actual,
    expected,
  };
}

export function createStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    appInfo: {
      name: "TheTattooCore",
      url: "https://thetattoocore.com",
    },
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
