import { readFileSync } from "node:fs";

const searchPage = readFileSync("src/app/search/page.tsx", "utf8");
const accessGuard = readFileSync("scripts/smoke-public-profile-access-guards.mjs", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const protectedFields = [
  "adult_terms_accepted_at",
  "is_adult_confirmed",
  "notify_follow_activity",
  "notify_message_activity",
  "notify_feed_activity",
  "notification_quiet_hours",
  "theme_preference",
  "preferred_language",
  "location_personalization_enabled",
  "moderation_note",
  "license_verified_by",
  "license_verification_request_id",
  "suspended_at",
  "banned_at",
  "role",
  "service_role",
  "email",
  "phone",
  "address",
];

assert(searchPage.includes('.from("public_profiles")'), "search reads public profiles through public_profiles");
assert(!/\.from\(\s*["'`]profiles["'`]\s*\)/.test(searchPage), "search never queries protected public.profiles directly");
assert(!searchPage.includes("profiles:profiles"), "search does not use embedded protected profile joins");
assert(searchPage.includes("loadPublicProfileMap"), "search hydrates result-card profiles through the shared public profile map");
assert(searchPage.includes("author_id") && searchPage.includes("seller_id") && searchPage.includes("poster_id"), "search selects only relationship ids for content profile hydration");
assert(!searchPage.includes("visiblePrivateProfileIds"), "search does not include accepted-private-follow compatibility results");
assert(searchPage.includes("filterSearchResultsWithPublicProfiles"), "search suppresses content rows whose public profile cannot be hydrated");
assert(searchPage.includes("dedupeById"), "search deduplicates result rows before pagination");

for (const field of protectedFields) {
  assert(!searchPage.includes(field), `search source does not request protected field ${field}`);
}

assert(accessGuard.includes("search must not query public.profiles directly"), "public profile access guard enforces search direct-profile ban");
assert(accessGuard.includes("search must not embed protected profile joins"), "public profile access guard enforces search embedded-profile ban");

if (process.exitCode) process.exit(process.exitCode);
console.log("All search visibility checks passed.");
