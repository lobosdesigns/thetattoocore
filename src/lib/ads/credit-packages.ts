export const adCreditPackages = {
  "ttc.adcredit.2500": { creditCents: 2500, webPriceCents: 2500 },
  "ttc.adcredit.5000": { creditCents: 5000, webPriceCents: 5000 },
  "ttc.adcredit.10000": { creditCents: 10000, webPriceCents: 10000 },
} as const;

export type AdCreditProductId = keyof typeof adCreditPackages;

export function isAdCreditProductId(value: unknown): value is AdCreditProductId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(adCreditPackages, value)
  );
}

export function adCreditPackageForProductId(value: unknown) {
  return isAdCreditProductId(value) ? adCreditPackages[value] : null;
}
