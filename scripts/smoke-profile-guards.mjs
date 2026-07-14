import { readFileSync } from "node:fs";

const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const profileForm = readFileSync("src/app/account/profile-form.tsx", "utf8");
const followListPage = readFileSync("src/app/u/[username]/follow-list-page.tsx", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const savedPage = readFileSync("src/app/saved/page.tsx", "utf8");
const searchPage = readFileSync("src/app/search/page.tsx", "utf8");
const urls = readFileSync("src/lib/urls.ts", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");

const socialFields = [
  "website_url",
  "instagram_url",
  "tiktok_url",
  "facebook_url",
  "youtube_url",
  "x_url",
];

const checks = [
  {
    label: "profile form keeps bio, avatar, banner, social links, and shop link editable",
    ok:
      profileForm.includes("Profile photo") &&
      profileForm.includes('name="avatar"') &&
      profileForm.includes("Banner photo") &&
      profileForm.includes('name="banner"') &&
      profileForm.includes('name="remove_banner"') &&
      profileForm.includes('name="bio"') &&
      profileForm.includes("maxLength={500}") &&
      profileForm.includes('name="shop_profile_username"') &&
      profileForm.includes('pattern="@?[a-zA-Z0-9_]{3,30}"') &&
      socialFields.every((field) => profileForm.includes(`name="${field}"`)),
  },
  {
    label: "profile form remains tabbed instead of one long profile editor",
    ok:
      profileForm.includes("const profileTabs = [") &&
      profileForm.includes('["profile", "Profile"]') &&
      profileForm.includes('["appearance", "Appearance"]') &&
      profileForm.includes('["language", "Language"]') &&
      profileForm.includes('["privacy", "Privacy"]') &&
      profileForm.includes('["notifications", "Notifications"]') &&
      profileForm.includes("profileTabFromHash"),
  },
  {
    label: "profile updates sanitize public text and outbound URLs",
    ok:
      accountActions.includes("export async function updateProfile") &&
      accountActions.includes("async function uploadBanner") &&
      accountActions.includes("bio: cleanText(formData.get(\"bio\"), 500) || null") &&
      accountActions.includes('const banner = fileFromForm(formData, "banner")') &&
      accountActions.includes('formData.get("remove_banner") === "on"') &&
      accountActions.includes("removeBanner ? { banner_url: null }") &&
      socialFields.every((field) =>
        accountActions.includes(`${field}: cleanExternalUrl(formData.get("${field}"), 240)`),
      ),
  },
  {
    label: "artist shop links resolve only to studio profile rows",
    ok:
      accountActions.includes("const shopProfileUsername = cleanProfileUsername(") &&
      accountActions.includes('formData.get("shop_profile_username")') &&
      accountActions.includes('.select("id, account_type, username")') &&
      accountActions.includes('if (shopProfile.account_type !== "studio")') &&
      accountActions.includes('redirect(accountPath("Shop profile must be a Studio account."))') &&
      accountActions.includes('shop_profile_id: accountType === "artist" ? shopProfileId : null'),
  },
  {
    label: "public profile renders bio, shop chip, and social link chips safely",
    ok:
      profilePage.includes("{profile.bio}") &&
      profilePage.includes("profile.banner_url") &&
      profilePage.includes("profile.shop_profile") &&
      profilePage.includes('label={`Shop: ${profile.shop_profile.display_name}`}') &&
      socialFields.every((field) => profilePage.includes(`profile.${field}`)) &&
      profilePage.includes("rel={userGeneratedLinkRel}") &&
      profilePage.includes('target="_blank"'),
  },
  {
    label: "studio profiles can show linked artists",
    ok:
      profilePage.includes("function LinkedArtistsSection") &&
      profilePage.includes('profile.account_type === "studio"') &&
      profilePage.includes('.eq("shop_profile_id", profile.id)') &&
      profilePage.includes("<LinkedArtistsSection"),
  },
  {
    label: "search previews include bio and shop profile context",
    ok:
      searchPage.includes("account_type, bio, city, license_verified_at, region, shop_profile_id") &&
      searchPage.includes("shopProfileText(profile)") &&
      searchPage.includes("profileShopMap") &&
      searchPage.includes("profile.bio"),
  },
  {
    label: "profile discovery surfaces can show profile banners",
    ok:
      searchPage.includes("banner_url") &&
      searchPage.includes("profile.banner_url") &&
      savedPage.includes("banner_url") &&
      savedPage.includes("profileBannerUrl") &&
      savedPage.includes("card.profileBannerUrl") &&
      followListPage.includes("banner_url") &&
      followListPage.includes("person.banner_url"),
  },
  {
    label: "follow lists hide blocked relationships and blocked row profiles",
    ok:
      followListPage.includes("async function getBlockedProfileIds") &&
      followListPage.includes('from("user_blocks")') &&
      followListPage.includes("const hasBlockRelationship = Boolean(blockRecord)") &&
      followListPage.includes("!hasBlockRelationship") &&
      followListPage.includes("!blockedProfileIds.has(row.profiles.id)"),
  },
  {
    label: "profile preview widgets filter blocked profiles",
    ok:
      profilePage.includes("async function getBlockedProfileIds") &&
      profilePage.includes("const visibleFollowerPreview") &&
      profilePage.includes("const visibleFollowingPreview") &&
      profilePage.includes("const visibleLinkedArtists") &&
      profilePage.includes("!blockedProfileIds.has(follow.profiles.id)") &&
      profilePage.includes("!blockedProfileIds.has(artist.id)") &&
      profilePage.includes("followers={visibleFollowerPreview}") &&
      profilePage.includes("artists={visibleLinkedArtists}"),
  },
  {
    label: "search discovery filters blocked profiles and owned content",
    ok:
      searchPage.includes("async function getBlockedProfileIds") &&
      searchPage.includes("const blockedProfileIds = await getBlockedProfileIds") &&
      searchPage.includes("const resultFetchLimit = resultLimit + 25") &&
      searchPage.includes("const filteredFeedResults = (feedPosts ?? []).filter") &&
      searchPage.includes("const filteredThreadResults = (threads ?? []).filter") &&
      searchPage.includes("const filteredListingResults = (listings ?? []).filter") &&
      searchPage.includes("const filteredGigResults = (gigs ?? []).filter") &&
      searchPage.includes("const filteredMerchResults = (merchProducts ?? []).filter") &&
      searchPage.includes("const feedResults = filteredFeedResults.slice(0, resultLimit)") &&
      searchPage.includes("(feedPosts?.length ?? 0) === resultFetchLimit") &&
      searchPage.includes("product.is_official ||") &&
      searchPage.includes("!blockedProfileIds.has(profile.id)") &&
      searchPage.includes("!blockedProfileIds.has(post.profiles.id)") &&
      searchPage.includes("feedResults.map"),
  },
  {
    label: "saved discovery filters blocked profiles and owned content",
    ok:
      savedPage.includes("async function getBlockedProfileIds") &&
      savedPage.includes("const blockedProfileIds = await getBlockedProfileIds") &&
      savedPage.includes("const savedFetchLimit = savedLimit + 25") &&
      savedPage.includes("const allCards = saved") &&
      savedPage.includes("const cards = allCards.slice(0, savedLimit)") &&
      savedPage.includes("const hasMoreSaved =") &&
      savedPage.includes("saved.length === savedFetchLimit") &&
      savedPage.includes("const feedMap = new Map") &&
      savedPage.includes("const threadMap = new Map") &&
      savedPage.includes("const listingMap = new Map") &&
      savedPage.includes("const gigMap = new Map") &&
      savedPage.includes("const merchMap = new Map") &&
      savedPage.includes("const profileMap = new Map") &&
      savedPage.includes("product.is_official ||") &&
      savedPage.includes("!blockedProfileIds.has(profile.id)") &&
      savedPage.includes("!blockedProfileIds.has(post.profiles.id)"),
  },
  {
    label: "outbound profile links use safe URL and rel policy",
    ok:
      urls.includes('["http:", "https:"].includes(url.protocol)') &&
      urls.includes('userGeneratedLinkRel = "ugc nofollow noopener noreferrer"'),
  },
  {
    label: "plan records public bio, socials, and artist-to-shop links",
    ok:
      productPlan.includes("Profiles need a small public bio plus safe outbound links") &&
      productPlan.includes("Profiles need a wide banner/cover photo") &&
      productPlan.includes("Done for launch with editable banner upload/removal") &&
      productPlan.includes("banner-aware discovery surfaces") &&
      productPlan.includes("Instagram, TikTok, Facebook, YouTube, and X links") &&
      productPlan.includes("artist-to-studio/shop profile link") &&
      productPlan.includes("public linked-artist list on studio/shop profiles"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} profile guard smoke check(s) failed.`);
  process.exit(1);
}
