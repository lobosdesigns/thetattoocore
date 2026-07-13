import { readFileSync } from "node:fs";

const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const profileForm = readFileSync("src/app/account/profile-form.tsx", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
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
      accountActions.includes("...(bannerUrl ? { banner_url: bannerUrl } : {})") &&
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
