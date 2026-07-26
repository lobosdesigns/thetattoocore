import { readFileSync } from "node:fs";

const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const publicProfiles = readFileSync("src/lib/public-profiles.ts", "utf8");
const publicProfileMigration = readFileSync("supabase/migrations/20260725160000_create_public_profiles_view.sql", "utf8");

const publicStudioFixture = Object.freeze({
  account_type: "studio",
  avatar_url: "https://cdn.example.test/studio/avatar.jpg",
  banner_url: "https://cdn.example.test/studio/banner.jpg",
  bio: "Appointment-only custom tattoo studio with public booking direction.",
  city: "Dallas",
  country: "US",
  created_at: "2026-07-01T00:00:00.000Z",
  display_name: "Needle Room Studio",
  facebook_url: "https://facebook.com/needleroom",
  followers_visibility: "public",
  following_visibility: "public",
  id: "00000000-0000-4000-8000-000000000201",
  instagram_url: "https://instagram.com/needleroom",
  license_verified_at: "2026-07-02T00:00:00.000Z",
  region: "TX",
  shop_profile_id: null,
  tiktok_url: null,
  username: "needleroom",
  website_url: "https://needleroom.example.test",
  x_url: null,
  youtube_url: null,
});

const publicArtistFixture = Object.freeze({
  account_type: "artist",
  avatar_url: "https://cdn.example.test/artists/ana.jpg",
  display_name: "Ana Linework",
  id: "00000000-0000-4000-8000-000000000202",
  license_verified_at: "2026-07-04T00:00:00.000Z",
  shop_profile_id: publicStudioFixture.id,
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
  "email",
  "phone",
  "address",
];

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

assert(publicStudioFixture.account_type === "studio", "public shop fixture is represented by a studio profile");
assert(publicArtistFixture.shop_profile_id === publicStudioFixture.id, "artist fixture links to shop through shop_profile_id");
assert(profilePage.includes("function ShopOverviewSection"), "profile route renders a dedicated shop overview section");
assert(profilePage.includes("Tattoo shop experience"), "shop overview has reader-facing shop context");
assert(profilePage.includes("Public contact"), "shop overview presents public contact links only");
assert(profilePage.includes("No public website or social link is listed for this studio."), "shop overview has a clear public-contact empty state");
assert(profilePage.includes("Location not listed"), "shop overview has a clear location empty state");
assert(profilePage.includes("Booking not listed"), "shop overview has a clear booking empty state");
assert(profilePage.includes("No linked public artists yet"), "shop linked artists section has an empty state");
assert(profilePage.includes("Verified shop"), "shop overview distinguishes verified studio profiles");
assert(profilePage.includes("Style signals"), "shop overview exposes specialty/style signals derived from public portfolio tags");
assert(profilePage.includes("visiblePortfolioCount"), "shop overview displays public portfolio count");
assert(profilePage.includes("artistCount={visibleLinkedArtists.length}"), "shop overview displays linked public artist count");
assert(profilePage.includes('profile.account_type === "studio" ? "Organization" : "Person"'), "studio structured data uses Organization");
assert(profilePage.includes("canonical: `${siteUrl}/u/${profile.username}`"), "shop route uses stable canonical /u username URL");
assert(profilePage.includes('type="application/ld+json"'), "shop route emits structured data when public");
assert(profilePage.includes("serializeStructuredData") && profilePage.includes('.replace(/</g, "\\\\u003c")'), "structured data escapes HTML-significant characters");
assert(profilePage.includes("profile.website_url") && profilePage.includes("profile.instagram_url"), "shop page can render approved public website/social fields");
assert(!profilePage.includes("profile.phone") && !profilePage.includes("profile.email") && !profilePage.includes("profile.address"), "shop page does not render unsupported private contact fields");
assert(publicProfiles.includes("shop_profile_id: string | null"), "public profile contract exposes shop_profile_id only as public relationship key");
assert(publicProfileMigration.includes("shop_profile_id") && publicProfileMigration.includes("where is_private = false"), "public profile view exposes only non-private shop/profile rows");
for (const field of protectedFields) {
  assert(!Object.hasOwn(publicStudioFixture, field), `shop fixture excludes protected field ${field}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log("All deterministic shop presentation checks passed.");
