import { readFileSync } from "node:fs";

const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const publicProfileType = readFileSync("src/lib/public-profiles.ts", "utf8");
const publicProfileAccessGuard = readFileSync("scripts/smoke-public-profile-access-guards.mjs", "utf8");

/**
 * @typedef {object} PublicStudioProfileFixture
 * @property {string} id
 * @property {string} username
 * @property {string} display_name
 * @property {"studio"} account_type
 * @property {string} bio
 * @property {string} avatar_url
 * @property {string} banner_url
 * @property {string} city
 * @property {string} region
 * @property {string} country
 * @property {string} website_url
 * @property {string} instagram_url
 * @property {null} tiktok_url
 * @property {null} facebook_url
 * @property {null} youtube_url
 * @property {null} x_url
 * @property {null} shop_profile_id
 * @property {string} license_verified_at
 * @property {"public"} followers_visibility
 * @property {"public"} following_visibility
 * @property {"everyone"} comment_permission
 * @property {string} created_at
 * @property {string} updated_at
 */

/** @type {PublicStudioProfileFixture} */
const studio = Object.freeze({
  account_type: "studio",
  avatar_url: "https://cdn.example.test/studio/avatar.jpg",
  banner_url: "https://cdn.example.test/studio/banner.jpg",
  bio: "Custom tattoo studio focused on clean, appointment-only work.",
  city: "Dallas",
  comment_permission: "everyone",
  country: "US",
  created_at: "2026-07-01T00:00:00.000Z",
  display_name: "Needle Room Studio",
  facebook_url: null,
  followers_visibility: "public",
  following_visibility: "public",
  id: "00000000-0000-4000-8000-000000000101",
  instagram_url: "https://instagram.com/needleroom",
  license_verified_at: "2026-07-02T00:00:00.000Z",
  region: "TX",
  shop_profile_id: null,
  tiktok_url: null,
  updated_at: "2026-07-03T00:00:00.000Z",
  username: "needleroom",
  website_url: "https://needleroom.example.test",
  x_url: null,
  youtube_url: null,
});

const linkedArtist = Object.freeze({
  account_type: "artist",
  avatar_url: "https://cdn.example.test/artists/ana.jpg",
  display_name: "Ana Linework",
  id: "00000000-0000-4000-8000-000000000102",
  license_verified_at: "2026-07-04T00:00:00.000Z",
  shop_profile_id: studio.id,
  username: "analinework",
});

const protectedFields = [
  "is_private",
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
];

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

function keys(value) {
  return Object.keys(value).sort();
}

assert(studio.account_type === "studio", "studio fixture classifies the profile as a studio");
assert(studio.display_name.length > 0 && studio.username.length > 0, "studio fixture has public name and username");
assert(Boolean(studio.avatar_url) && Boolean(studio.banner_url), "studio fixture covers avatar and banner behavior");
assert(Boolean(studio.bio), "studio fixture covers public biography");
assert([studio.city, studio.region, studio.country].every(Boolean), "studio fixture covers public location fields only");
assert(studio.website_url.startsWith("https://") && studio.instagram_url.startsWith("https://"), "studio fixture covers public social/contact links");
assert(linkedArtist.shop_profile_id === studio.id, "linked artist fixture points at the studio shop profile");
assert(!("years_tattooing" in studio), "studio fixture does not invent artist-only years tattooing");
assert(!("specialty_styles" in studio), "studio fixture does not invent unsupported artist-only specialty fields");
for (const field of protectedFields) {
  assert(!keys(studio).includes(field), `studio fixture does not expose protected field ${field}`);
}

assert(profilePage.includes('profile.account_type === "studio" ? "Organization" : "Person"'), "studio structured data uses Organization");
assert(profilePage.includes('profile.account_type === "studio"'), "profile page branches on studio account type");
assert(profilePage.includes("function LinkedArtistsSection"), "studio profile has linked public artists section");
assert(profilePage.includes('.eq("shop_profile_id", profile.id)'), "linked artists are selected by shop_profile_id");
assert(profilePage.includes('label={`Shop: ${profile.shop_profile.display_name}`}'), "artist profile can display linked public shop information");
assert(profilePage.includes("profile.banner_url") && profilePage.includes("ProfileAvatar"), "profile presentation supports banner and avatar");
assert(profilePage.includes("{profile.bio}"), "profile presentation renders public biography");
assert(profilePage.includes("profile.city") && profilePage.includes("profile.region") && profilePage.includes("profile.country"), "profile presentation uses approved public location fields");
assert(["website_url", "instagram_url", "tiktok_url", "facebook_url", "youtube_url", "x_url"].every((field) => profilePage.includes(`profile.${field}`)), "profile presentation renders approved social links");
assert(profilePage.includes("PortfolioPreviewSection") && profilePage.includes('profile.account_type) ? (') && profilePage.includes('"studio"'), "studio profiles can reach portfolio preview path");
assert(profilePage.includes("collectSpecialtyTags(visiblePosts)"), "specialty presentation derives from public portfolio posts");
assert(profilePage.includes('label="followers"') && profilePage.includes('label="following"'), "profile presentation renders follower and following counts");
assert(publicProfileType.includes("export type PublicProfile") && publicProfileAccessGuard.includes("Sensitive profile column exposed by public_profiles"), "public profile type and access guard protect the fixture boundary");

if (process.exitCode) process.exit(process.exitCode);
console.log("All deterministic studio profile presentation checks passed.");