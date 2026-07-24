import "server-only";
import Stripe from "stripe";
import { stripeWebhookSigningSecretFormatValid } from "./secret-format";

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

export function stripeWebhookSigningSecretConfigured(
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
) {
  return stripeWebhookSigningSecretFormatValid(webhookSecret);
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

export function stripeCheckoutPreflight() {
  const expected = expectedStripeLivemode();
  const actual = stripeSecretKeyLivemode();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (expected === null) {
    return {
      actual,
      expected,
      reason: "missing_expected_mode",
      ready: false,
    } as const;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      actual,
      expected,
      reason: "missing_secret_key",
      ready: false,
    } as const;
  }

  if (actual === null) {
    return {
      actual,
      expected,
      reason: "unreadable_secret_key_mode",
      ready: false,
    } as const;
  }

  if (expected !== actual) {
    return {
      actual,
      expected,
      reason: "mode_mismatch",
      ready: false,
    } as const;
  }

  if (!webhookSecret) {
    return {
      actual,
      expected,
      reason: "missing_webhook_signing_secret",
      ready: false,
    } as const;
  }

  if (!stripeWebhookSigningSecretConfigured(webhookSecret)) {
    return {
      actual,
      expected,
      reason: "invalid_webhook_signing_secret",
      ready: false,
    } as const;
  }

  return {
    actual,
    expected,
    ready: true,
  } as const;
}

export function stripeMerchDestinationChargesEnabled() {
  return (
    process.env.STRIPE_MERCH_DESTINATION_CHARGES_ENABLED?.trim().toLowerCase() ===
    "true"
  );
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
