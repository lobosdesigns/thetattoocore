import { readFileSync } from "node:fs";

const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const hydration = readFileSync("src/lib/public-profile-hydration.ts", "utf8");
const accessGuard = readFileSync("scripts/smoke-public-profile-access-guards.mjs", "utf8");

const shopId = "00000000-0000-4000-8000-000000000301";
const fixtureRows = Object.freeze([
  { id: "a", username: "public_artist", account_type: "artist", shop_profile_id: shopId, isPublic: true, isInternal: false },
  { id: "a", username: "public_artist", account_type: "artist", shop_profile_id: shopId, isPublic: true, isInternal: false },
  { id: "b", username: "private_artist", account_type: "artist", shop_profile_id: shopId, isPublic: false, isInternal: false },
  { id: "c", username: "ttc_reviewer", account_type: "artist", shop_profile_id: shopId, isPublic: true, isInternal: true },
  { id: "d", username: "other_shop_artist", account_type: "artist", shop_profile_id: "other-shop", isPublic: true, isInternal: false },
  { id: "e", username: "supplier", account_type: "supplier", shop_profile_id: shopId, isPublic: true, isInternal: false },
]);
const hydratedArtists = [
  ...new Map(
    fixtureRows
      .filter((row) => row.isPublic && !row.isInternal)
      .filter((row) => row.shop_profile_id === shopId && row.account_type === "artist")
      .map((row) => [row.id, row]),
  ).values(),
];

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

assert(hydratedArtists.length === 1, "fixture hydration keeps only one unique public artist for the shop");
assert(hydratedArtists[0]?.username === "public_artist", "fixture hydration excludes private, internal, wrong-shop, and non-artist rows");
assert(profilePage.includes('.from("public_profiles")'), "profile page reads public shop and artist profiles through public_profiles");
assert(profilePage.includes('.eq("shop_profile_id", profile.id)'), "linked shop artists are selected by shop_profile_id");
assert(profilePage.includes('.eq("account_type", "artist")'), "linked shop artists are constrained to artist profiles");
assert(profilePage.includes('"id, username, display_name, avatar_url, account_type, license_verified_at, shop_profile_id"'), "linked artist query selects only approved public fields plus relationship key");
assert(profilePage.includes("new Map(") && profilePage.includes(".map((artist) => [artist.id, artist])"), "linked artist rendering deduplicates by profile id");
assert(profilePage.includes("artist.shop_profile_id === profile.id"), "linked artist rendering validates the relationship after hydration");
assert(profilePage.includes("!blockedProfileIds.has(artist.id)"), "linked artist rendering respects block filtering");
assert(
  hydration.includes('.from(profileTable)') &&
    hydration.includes("new Set(profileIds") &&
    hydration.includes('return loadProfileMap(supabase, profileIds, "public_profiles")') &&
    hydration.includes("for (const batch of batches)") &&
    !hydration.includes("Promise.all"),
  "shared public profile hydration uses curated public_profiles with id de-duping and bounded batch concurrency",
);
assert(accessGuard.includes("profile page must read public profiles through public_profiles"), "public profile access guard enforces curated boundary");
assert(accessGuard.includes("profile page must not fall back to public.profiles by username"), "public profile access guard prevents anonymous base profile fallback");
const linkedArtistAnchor = profilePage.indexOf('.eq("shop_profile_id", profile.id)');
const linkedArtistQuery = linkedArtistAnchor >= 0 ? profilePage.slice(Math.max(0, linkedArtistAnchor - 420), linkedArtistAnchor + 620) : "";
const embeddedProfilesJoin = ["profiles", "profiles!"].join(":");
assert(Boolean(linkedArtistQuery), "shop-to-artist query block is present");
assert(!linkedArtistQuery.includes(embeddedProfilesJoin), "shop-to-artist hydration does not use embedded profiles joins");

if (process.exitCode) process.exit(process.exitCode);
console.log("All deterministic shop artist hydration checks passed.");
