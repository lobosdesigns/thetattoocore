export type StripeWebhookSource = "connect" | "platform";

export function stripeWebhookAccountScope({
  eventAccount,
  source,
}: {
  eventAccount?: string | null;
  source: StripeWebhookSource;
}) {
  if (source === "platform") {
    return eventAccount == null ? "platform" : null;
  }

  return typeof eventAccount === "string" &&
    /^acct_[A-Za-z0-9]{8,200}$/.test(eventAccount)
    ? eventAccount
    : null;
}
