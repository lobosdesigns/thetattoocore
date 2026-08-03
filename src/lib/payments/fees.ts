export type PlatformFeeKind = "ad" | "booking" | "merch";

export const platformFeeRate = 0.02;
export const platformFeePercentLabel = "2%";

export function calculatePlatformFeeCents(amountCents: number) {
  if (amountCents <= 0) return 0;

  return Math.ceil(amountCents * platformFeeRate);
}

export function platformFeeDescription(kind: PlatformFeeKind) {
  if (kind === "ad") {
    return "No additional TTC platform fee applies to ad credit purchases.";
  }

  if (kind === "booking") {
    return `Transparent ${platformFeePercentLabel} TTC application fee deducted from provider funds for booking deposits. Payment processing fees are separate.`;
  }

  return `Transparent ${platformFeePercentLabel} TTC platform fee for historical Merch checkout.`;
}
