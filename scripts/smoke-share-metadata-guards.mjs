import { readFileSync } from "node:fs";

const feedDetail = readFileSync("src/app/p/[id]/page.tsx", "utf8");
const threadDetail = readFileSync("src/app/t/[id]/page.tsx", "utf8");
const stuffDetail = readFileSync("src/app/stuff/[id]/page.tsx", "utf8");
const gigsDetail = readFileSync("src/app/gigs/[id]/page.tsx", "utf8");
const merchDetail = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const profileDetail = readFileSync("src/app/u/[username]/page.tsx", "utf8");
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
      profileDetail.includes("follow: !profile.is_private") &&
      profileDetail.includes("index: !profile.is_private") &&
      profileDetail.includes("type: \"profile\"") &&
      profileDetail.includes("twitter:"),
  },
  {
    label: "Live public smoke checks profile share tags",
    ok:
      publicSmoke.includes("/u/ceocore") &&
      publicSmoke.includes('property="og:title"') &&
      publicSmoke.includes('property="og:image"') &&
      publicSmoke.includes('name="twitter:card"') &&
      publicSmoke.includes('name="twitter:image"'),
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
      publicSmoke.includes(
        "const requiredSitemapUrls = [baseUrl, `${baseUrl}/merch`]",
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
