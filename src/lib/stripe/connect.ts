import "server-only";
import type Stripe from "stripe";

export function stripeConnectStatus(account: Stripe.Account, livemode: boolean) {
  const currentlyDue = account.requirements?.currently_due ?? [];

  return {
    account_type: account.type ?? "express",
    charges_enabled: account.charges_enabled,
    country: account.country ?? null,
    default_currency: account.default_currency ?? null,
    details_submitted: account.details_submitted,
    disabled_reason: account.requirements?.disabled_reason ?? null,
    last_synced_at: new Date().toISOString(),
    livemode,
    onboarding_completed_at:
      account.details_submitted && account.charges_enabled && account.payouts_enabled
        ? new Date().toISOString()
        : null,
    payouts_enabled: account.payouts_enabled,
    requirements_currently_due: currentlyDue,
    stripe_account_id: account.id,
    updated_at: new Date().toISOString(),
  };
}
