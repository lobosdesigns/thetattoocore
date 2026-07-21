export type VerificationProfile = {
  account_type: string;
  license_verified_at?: string | null;
};

export const verificationEligibleAccountTypes = ["artist", "studio", "vendor"];
export const artistShopAccountTypes = ["artist", "studio"];

export function isVerifiedProfessional(profile?: VerificationProfile | null) {
  return Boolean(
    profile?.license_verified_at &&
      verificationEligibleAccountTypes.includes(profile.account_type),
  );
}

export function isVerifiedArtistOrShop(profile?: VerificationProfile | null) {
  return Boolean(
    profile?.license_verified_at &&
      artistShopAccountTypes.includes(profile.account_type),
  );
}
