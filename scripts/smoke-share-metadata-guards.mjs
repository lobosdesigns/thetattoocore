import { readFileSync } from "node:fs";

const feedDetail = readFileSync("src/app/p/[id]/page.tsx", "utf8");
const threadDetail = readFileSync("src/app/t/[id]/page.tsx", "utf8");
const stuffDetail = readFileSync("src/app/stuff/[id]/page.tsx", "utf8");
const gigsDetail = readFileSync("src/app/gigs/[id]/page.tsx", "utf8");
const merchDetail = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const profileDetail = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
const robots = readFileSync("src/app/robots.ts", "utf8");

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
      robots.includes('"/merch/"') &&
      robots.includes('"/u/"') &&
      robots.includes('"/messages"') &&
      robots.includes('"/notifications"') &&
      robots.includes('"/admin"'),
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
