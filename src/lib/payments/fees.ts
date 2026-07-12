export type PlatformFeeKind = "ad" | "merch";

export const platformFeeRate = 0.02;
export const platformFeePercentLabel = "2%";

export function calculatePlatformFeeCents(amountCents: number) {
  if (amountCents <= 0) return 0;

  return Math.ceil(amountCents * platformFeeRate);
}

export function platformFeeDescription(kind: PlatformFeeKind) {
  const label = kind === "ad" ? "ad checkout" : "Merch checkout";

  return `Transparent ${platformFeePercentLabel} TTC platform fee for test-mode ${label}.`;
}
