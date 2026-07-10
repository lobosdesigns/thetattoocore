export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://thetattoocore.com";

export const siteName = "TheTattooCore";
export const siteDescription =
  "The heart of the tattoo community for artists, studios, collectors, and tattoo enthusiasts.";
export const supportEmail = "lobosden@hotmail.com";
export const brandShareImage = `${siteUrl}/icon.svg?v=ttc-shield`;
export const brandShareImageAlt = `${siteName} shield logo`;

export function shareImage(url: string, alt = `${siteName} shared content`) {
  return {
    alt,
    url,
  };
}
