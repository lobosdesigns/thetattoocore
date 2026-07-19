export type PlatformFeeKind = "ad" | "booking" | "merch";

export const platformFeeRate = 0.02;
export const platformFeePercentLabel = "2%";

export function calculatePlatformFeeCents(amountCents: number) {
  if (amountCents <= 0) return 0;

  return Math.ceil(amountCents * platformFeeRate);
}

export function platformFeeDescription(kind: PlatformFeeKind) {
  const label =
    kind === "ad"
      ? "ad checkout"
      : kind === "booking"
        ? "booking deposit processing"
        : "Merch checkout";

  return `Transparent ${platformFeePercentLabel} TTC platform fee for ${label}.`;
}
