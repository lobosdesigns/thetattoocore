const webhookSigningSecretPattern = /^whsec_[A-Za-z0-9]{16,}$/;

export function stripeWebhookSigningSecretFormatValid(
  value: string | null | undefined,
) {
  return typeof value === "string" && webhookSigningSecretPattern.test(value);
}
