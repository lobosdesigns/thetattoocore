import { readFileSync } from "node:fs";

const feedDetail = readFileSync("src/app/p/[id]/page.tsx", "utf8");
const threadDetail = readFileSync("src/app/t/[id]/page.tsx", "utf8");
const stuffDetail = readFileSync("src/app/stuff/[id]/page.tsx", "utf8");
const gigsDetail = readFileSync("src/app/gigs/[id]/page.tsx", "utf8");
const merchDetail = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const profileDetail = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const profileStructuredDataStart = profileDetail.indexOf(
  "function publicProfileStructuredData",
);
const profileStructuredDataEnd = profileDetail.indexOf(
  "function serializeStructuredData",
);
const profileStructuredData =
  profileStructuredDataStart >= 0 && profileStructuredDataEnd > profileStructuredDataStart
    ? profileDetail.slice(profileStructuredDataStart, profileStructuredDataEnd)
    : "";
const helpPage = readFileSync("src/app/help/page.tsx", "utf8");
const childSafetyPage = readFileSync("src/app/child-safety-standards/page.tsx", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const termsPage = readFileSync("src/app/terms/page.tsx", "utf8");
const siteConstants = readFileSync("src/lib/site.ts", "utf8");
const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
const robots = readFileSync("src/app/robots.ts", "utf8");
const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
const middlewareSource = readFileSync("src/middleware.ts", "utf8");
const notFoundPage = readFileSync("src/app/not-found.tsx", "utf8");
const profileIndexing = readFileSync("src/lib/profile-indexing.ts", "utf8");
const publicProfilesMigration = readFileSync("supabase/migrations/20260725160000_create_public_profiles_view.sql", "utf8");

const publicContentDetails = [
  ["4U detail", feedDetail, 'post.visibility === "public_preview" && !post.is_sensitive'],
  ["Gossip detail", threadDetail, 'thread.visibility === "public_preview" && !thread.is_sensitive'],
  ["Stuff detail", stuffDetail, 'listing.visibility === "public_preview" && !listing.is_sensitive'],
  ["Gigs detail", gigsDetail, 'gig.visibility === "public_preview" && !gig.is_sensitive'],
];

const detailChecks = publicContentDetails.flatMap(([name, source, publicCondition]) => [
  {
    label: `${name} only indexes non-sensitive public previews`,
    ok:
      source.includes("const publicIndexable") &&
      source.includes(publicCondition) &&
      source.includes("follow: publicIndexable") &&
      source.includes("index: publicIndexable"),
  },
  {
    label: `${name} uses brand image fallback for non-public or sensitive shares`,
    ok:
      source.includes("brandShareImage") &&
      source.includes("brandShareImageAlt") &&
      source.includes(": brandShareImage") &&
      source.includes(": brandShareImageAlt"),
  },
  {
    label: `${name} emits Open Graph and Twitter metadata`,
    ok:
      source.includes("openGraph:") &&
      source.includes("twitter:") &&
      source.includes("card: \"summary_large_image\"") &&
      source.includes("shareImage("),
  },
]);

const checks = [
  ...detailChecks,
  {
    label: "Site metadata defines safe shared SEO keyword groups",
    ok:
      siteConstants.includes("export const siteKeywords") &&
      siteConstants.includes('"tattoo community"') &&
      siteConstants.includes('"tattoo artists"') &&
      siteConstants.includes('"tattoo studios"') &&
      siteConstants.includes('"tattoo shops"') &&
      siteConstants.includes('"body art"') &&
      siteConstants.includes('"tattoo merch"') &&
      siteConstants.includes('"tattoo gigs"') &&
      siteConstants.includes('"guest spots"') &&
      siteConstants.includes('"tattoo booking"') &&
      siteConstants.includes('"artist verification"') &&
      siteConstants.includes('"shop verification"') &&
      siteConstants.includes('"tattoo marketplace"') &&
      siteConstants.includes("export const seoKeywordGroups") &&
      siteConstants.includes("childSafety:") &&
      siteConstants.includes('"child safety standards"') &&
      siteConstants.includes('"booking profile"') &&
      siteConstants.includes('"vendor listings"') &&
      siteConstants.includes("metadataKeywords(") &&
      !siteConstants.toLowerCase().includes("supabase") &&
      !siteConstants.toLowerCase().includes("stripe") &&
      !siteConstants.toLowerCase().includes("firebase"),
  },
  {
    label: "Root metadata exposes canonical discovery keywords and googlebot previews",
    ok:
      rootLayout.includes("keywords: metadataKeywords(siteKeywords)") &&
      rootLayout.includes('category: "social networking"') &&
      rootLayout.includes("creator: siteName") &&
      rootLayout.includes("itunes:") &&
      rootLayout.includes('appId: "6791179517"') &&
      rootLayout.includes("appArgument: siteUrl") &&
      rootLayout.includes("publisher: siteName") &&
      rootLayout.includes('"max-image-preview": "large"') &&
      rootLayout.includes('"max-snippet": -1') &&
      rootLayout.includes('"max-video-preview": -1'),
  },
  {
    label: "Canonical homepage renders an indexable signed-out public preview",
    ok:
      homePage.includes("function PublicVisitorGate") &&
      homePage.includes(">Public preview</") &&
      homePage.includes("!isSignedIn ? (") &&
      homePage.includes("<PublicVisitorGate") &&
      !homePage.includes('redirect("/login")') &&
      publicSmoke.includes('path: "/"') &&
      publicSmoke.includes("Sign in to post, reply, DM, follow creators"),
  },
  {
    label: "Public detail metadata emits route-specific SEO keywords",
    ok:
      feedDetail.includes("keywords: metadataKeywords(") &&
      feedDetail.includes("seoKeywordGroups.feed") &&
      threadDetail.includes("keywords: metadataKeywords(") &&
      threadDetail.includes("seoKeywordGroups.gossip") &&
      stuffDetail.includes("keywords: metadataKeywords(") &&
      stuffDetail.includes("seoKeywordGroups.stuff") &&
      gigsDetail.includes("keywords: metadataKeywords(") &&
      gigsDetail.includes("seoKeywordGroups.gigs") &&
      merchDetail.includes("keywords: metadataKeywords(") &&
      merchDetail.includes("seoKeywordGroups.merch") &&
      profileDetail.includes("keywords: metadataKeywords(") &&
      profileDetail.includes("seoKeywordGroups.profile"),
  },
  {
    label: "Public support and legal pages publish page-level canonical metadata",
    ok:
      helpPage.includes("canonical: `${siteUrl}/help`") &&
      childSafetyPage.includes("canonical: `${siteUrl}/child-safety-standards`") &&
      supportPage.includes("canonical: `${siteUrl}/support`") &&
      privacyPage.includes("canonical: `${siteUrl}/privacy`") &&
      termsPage.includes("canonical: `${siteUrl}/terms`"),
  },
  {
    label: "Public support and legal pages expose safe discovery keywords",
    ok:
      helpPage.includes("keywords: metadataKeywords(siteKeywords, seoKeywordGroups.help)") &&
      childSafetyPage.includes("keywords: metadataKeywords(") &&
      childSafetyPage.includes("seoKeywordGroups.childSafety") &&
      childSafetyPage.includes("seoKeywordGroups.help") &&
      supportPage.includes("keywords: metadataKeywords(") &&
      supportPage.includes("seoKeywordGroups.help") &&
      supportPage.includes('"tattoo app support"') &&
      privacyPage.includes("keywords: metadataKeywords(") &&
      privacyPage.includes('"tattoo app privacy"') &&
      termsPage.includes("keywords: metadataKeywords(") &&
      termsPage.includes('"tattoo community terms"') &&
      [helpPage, childSafetyPage, supportPage, privacyPage, termsPage].every(
        (source) =>
          !source.toLowerCase().includes("supabase") &&
          !source.toLowerCase().includes("stripe") &&
          !source.toLowerCase().includes("firebase"),
      ),
  },
  {
    label:
      "Public support offers account and associated-data deletion outside the installed app",
    ok:
      supportPage.includes('href: "#account-deletion"') &&
      supportPage.includes('id="account-deletion"') &&
      supportPage.includes("Delete your account and associated data") &&
      supportPage.includes("If you cannot sign in or no longer have the app") &&
      supportPage.includes("Email deletion request") &&
      supportPage.includes("unresolved orders or payment disputes") &&
      supportPage.includes("review target is within 30 days"),
  },
  {
    label:
      "Public privacy copy discloses opt-in device alert delivery data",
    ok:
      privacyPage.includes("Notifications And Device Data") &&
      privacyPage.includes("When you opt in to app alerts") &&
      privacyPage.includes("app-generated installation identifier") &&
      privacyPage.includes("delivery token linked to your signed-in account") &&
      privacyPage.includes("not used for advertising tracking") &&
      privacyPage.includes("TheTattooCore settings or device settings"),
  },
  {
    label: "Merch detail uses safe product image or brand fallback metadata",
    ok:
      merchDetail.includes("brandShareImage") &&
      merchDetail.includes("brandShareImageAlt") &&
      merchDetail.includes('media?.media_type === "image"') &&
      merchDetail.includes(": brandShareImage") &&
      merchDetail.includes("openGraph:") &&
      merchDetail.includes("twitter:") &&
      merchDetail.includes("card: \"summary_large_image\""),
  },
  {
    label: "Unavailable merch products are not indexed",
    ok:
      merchDetail.includes("if (!product)") &&
      merchDetail.includes("follow: false") &&
      merchDetail.includes("index: false"),
  },
  {
    label: "Public profile share images exclude sensitive and non-public work",
    ok:
      profileDetail.includes(".eq(\"visibility\", \"public_preview\")") &&
      profileDetail.includes(".eq(\"is_sensitive\", false)") &&
      profileDetail.includes("profile.is_private") &&
      profileDetail.includes("? brandShareImage") &&
      profileDetail.includes("brandShareImageAlt"),
  },
  {
    label: "Public profile metadata indexes public profiles only",
    ok:
      profileDetail.includes("const noindexProfile") &&
      profileDetail.includes("isInternalIndexingProfile(profile.username)") &&
      profileDetail.includes("follow: !noindexProfile") &&
      profileDetail.includes("index: !noindexProfile") &&
      profileDetail.includes("type: \"profile\"") &&
      profileDetail.includes("twitter:"),
  },
  {
    label: "Public profile structured data is privacy-gated and script-safe",
    ok:
      profileStructuredData.includes('"@type": "ProfilePage"') &&
      profileStructuredData.includes(
        '"@type": profile.account_type === "studio" ? "Organization" : "Person"',
      ) &&
      profileStructuredData.includes("alternateName: `@${profile.username}`") &&
      profileStructuredData.includes("dateCreated: profile.created_at") &&
      !profileStructuredData.includes("profile.id") &&
      !profileStructuredData.toLowerCase().includes("follower") &&
      profileDetail.includes("profile.is_private ||") &&
      profileDetail.includes("isInternalIndexingProfile(profile.username) ||") &&
      profileDetail.includes("hasBlockRelationship") &&
      profileDetail.includes('type="application/ld+json"') &&
      profileDetail.includes('.replace(/</g, "\\\\u003c")'),
  },
  {
    label: "Live public smoke checks profile share tags",
    ok:
      publicSmoke.includes("/u/ceocore") &&
      publicSmoke.includes('property="og:title"') &&
      publicSmoke.includes('property="og:image"') &&
      publicSmoke.includes('name="twitter:card"') &&
      publicSmoke.includes('name="twitter:image"') &&
      publicSmoke.includes('"@type":"ProfilePage"') &&
      publicSmoke.includes('"alternateName":"@ceocore"'),
  },
  {
    label: "Canonical production host and HTTPS redirect is exact and single-hop",
    ok:
      middlewareSource.includes('const canonicalHost = "thetattoocore.com"') &&
      middlewareSource.includes("redirectableProductionHosts") &&
      middlewareSource.includes("`www.${canonicalHost}`") &&
      middlewareSource.includes('request.headers.get("host")?.toLowerCase().split(":")[0]') &&
      middlewareSource.includes('requestHost === canonicalHost && request.nextUrl.protocol === "https:"') &&
      middlewareSource.includes("request.nextUrl.clone()") &&
      middlewareSource.includes('redirectUrl.protocol = "https:"') &&
      middlewareSource.includes("redirectUrl.hostname = canonicalHost") &&
      middlewareSource.includes('redirectUrl.port = ""') &&
      middlewareSource.includes("NextResponse.redirect(redirectUrl, 308)"),
  },
  {
    label: "Canonical redirect does not target local, preview, or unrelated hosts",
    ok:
      middlewareSource.includes("!requestHost || !redirectableProductionHosts.has(requestHost)") &&
      !middlewareSource.includes(".endsWith(canonicalHost)") &&
      !middlewareSource.includes("includes(canonicalHost)") &&
      !middlewareSource.includes("NEXT_PUBLIC_SITE_URL"),
  },
  {
    label: "Known internal QA, reviewer, and checkout profiles are noindexed",
    ok:
      profileIndexing.includes('"ttc_reviewer"') &&
      profileIndexing.includes('"qa_android_dm"') &&
      profileIndexing.includes('"ttc_tester"') &&
      profileIndexing.includes('"checkouttest"') &&
      sitemap.includes(".from(\"public_profiles\")") &&
      !sitemap.includes("isInternalIndexingProfile") &&
      publicProfilesMigration.includes("lower(username) not in") &&
      publicProfilesMigration.includes("'ttc_reviewer'") &&
      publicProfilesMigration.includes("'qa_android_dm'") &&
      publicProfilesMigration.includes("'ttc_tester'") &&
      publicProfilesMigration.includes("'checkouttest'") &&
      profileDetail.includes("const noindexProfile") &&
      profileDetail.includes("follow: !noindexProfile") &&
      profileDetail.includes("index: !noindexProfile") &&
      profileDetail.includes("isInternalIndexingProfile(profile.username) ||") &&
      profileDetail.includes("publicProfileStructuredData(profile)"),
  },
  {
    label: "Not-found page keeps real 404 handling and overrides robots metadata",
    ok:
      notFoundPage.includes("export const metadata") &&
      notFoundPage.includes("robots:") &&
      notFoundPage.includes("googleBot:") &&
      notFoundPage.includes("index: false") &&
      notFoundPage.includes("follow: false") &&
      notFoundPage.includes("export default function NotFound") &&
      !notFoundPage.includes("redirect(") &&
      !notFoundPage.includes("permanentRedirect("),
  },
  {
    label: "Static sitemap entries use stable modification dates",
    ok:
      sitemap.includes('const staticContentLastModified = new Date("2026-07-22T00:00:00.000Z")') &&
      sitemap.includes("const dynamicFallbackLastModified = staticContentLastModified") &&
      sitemap.includes("lastModified: staticContentLastModified") &&
      sitemap.includes("helpArticles.map") &&
      !sitemap.includes("const now = new Date()") &&
      !sitemap.includes("lastModified: now"),
  },
  {
    label: "Page-specific Open Graph URLs preserve shared image and description fields",
    ok:
      siteConstants.includes("export function siteOpenGraph") &&
      siteConstants.includes("description: siteDescription") &&
      siteConstants.includes("images: [shareImage(brandShareImage, brandShareImageAlt)]") &&
      rootLayout.includes("openGraph: siteOpenGraph(siteUrl)") &&
      helpPage.includes("openGraph: siteOpenGraph(`${siteUrl}/help`)") &&
      childSafetyPage.includes("openGraph: siteOpenGraph(`${siteUrl}/child-safety-standards`)") &&
      supportPage.includes("openGraph: siteOpenGraph(`${siteUrl}/support`)") &&
      privacyPage.includes("openGraph: siteOpenGraph(`${siteUrl}/privacy`)") &&
      termsPage.includes("openGraph: siteOpenGraph(`${siteUrl}/terms`)") &&
      [helpPage, childSafetyPage, supportPage, privacyPage, termsPage].every((source) =>
        source.includes("siteOpenGraph"),
      ),
  },
  {
    label: "Robots allows public shareable detail paths and blocks private app areas",
    ok:
      robots.includes('"/p/"') &&
      robots.includes('"/t/"') &&
      robots.includes('"/stuff/"') &&
      robots.includes('"/gigs/"') &&
      robots.includes('"/child-safety-standards"') &&
      robots.includes('"/help"') &&
      robots.includes('"/merch/"') &&
      robots.includes('"/support"') &&
      robots.includes('"/u/"') &&
      robots.includes('"/messages"') &&
      robots.includes('"/notifications"') &&
      robots.includes('"/admin"'),
  },
  {
    label: "Sitemap keeps the canonical homepage discoverable",
    ok:
      sitemap.includes('changeFrequency: "daily"') &&
      sitemap.includes("priority: 1") &&
      sitemap.includes("url: siteUrl") &&
      sitemap.includes("staticContentLastModified") &&
      publicSmoke.includes(
        "const requiredSitemapUrls = [canonicalBaseUrl, `${canonicalBaseUrl}/merch`]",
      ),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} share metadata guard smoke check(s) failed.`);
  process.exit(1);
}
