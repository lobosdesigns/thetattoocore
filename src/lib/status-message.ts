const unsafeStatusMessageTerms = [
  "api key",
  "cloudflare",
  "database",
  "firebase",
  "hosted checkout",
  "hosted payout",
  "hosted setup",
  "hostgator",
  "mail provider",
  "payment-provider",
  "payment provider",
  "provider",
  "secret",
  "service key",
  "service role",
  "stripe",
  "supabase",
  "test mode",
  "test-mode",
  "webhook",
  "worker",
];

export function safeStatusMessage(
  value: string | string[] | undefined,
  fallback = "Update could not be shown. Please try again or contact Support.",
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const text = String(rawValue ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

  if (!text) return null;

  const lowerText = text.toLowerCase();
  const hasUnsafeTerm = unsafeStatusMessageTerms.some((term) =>
    lowerText.includes(term),
  );

  return hasUnsafeTerm ? fallback : text;
}
