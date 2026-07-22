export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://thetattoocore.com";

export const siteName = "TheTattooCore";
export const siteDescription =
  "The heart of the tattoo community for real artists, studios, vendors, collectors, and enthusiasts, with no AI art or scratcher promotion.";
export const supportEmail = "support@thetattoocore.com";
export const brandShareImage = `${siteUrl}/icon.svg?v=ttc-shield`;
export const brandShareImageAlt = `${siteName} shield logo`;

export const siteKeywords = [
  "tattoo community",
  "tattoo artists",
  "tattoo studios",
  "tattoo shops",
  "body art",
  "tattoo merch",
  "tattoo gigs",
  "guest spots",
  "tattoo booking",
  "tattoo stories",
  "artist verification",
  "shop verification",
  "tattoo collectors",
  "tattoo vendors",
  "tattoo marketplace",
] as const;

export const seoKeywordGroups = {
  feed: ["4U", "tattoo posts", "tattoo work", "artist portfolios", "tattoo reels"],
  gigs: ["tattoo jobs", "guest spots", "tattoo conventions", "artist gigs", "shop openings"],
  gossip: ["Gossip", "tattoo discussions", "artist community", "shop talk", "vendor talk"],
  help: ["Help Center", "tattoo app help", "account support", "safety reports", "booking help"],
  merch: ["Merch", "tattoo shirts", "tattoo prints", "artist merch", "studio merch"],
  profile: ["artist profile", "studio profile", "vendor profile", "tattoo shop", "booking profile"],
  stuff: ["Stuff", "verified vendors", "professional tattoo supplies", "studio listings", "vendor listings"],
} as const;

export function metadataKeywords(
  ...groups: Array<readonly string[] | string | null | undefined>
) {
  const values = groups.flatMap((group) => {
    if (!group) return [];
    return typeof group === "string" ? [group] : [...group];
  });

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function shareImage(url: string, alt = `${siteName} shared content`) {
  return {
    alt,
    url,
  };
}
