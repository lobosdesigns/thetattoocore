import { readFileSync } from "node:fs";

const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const accountSettingsWorkspace = readFileSync(
  "src/app/account/account-settings-workspace.tsx",
  "utf8",
);
const profileForm = readFileSync("src/app/account/profile-form.tsx", "utf8");
const profileContentTabs = readFileSync(
  "src/app/u/[username]/profile-content-tabs.tsx",
  "utf8",
);
const followListPage = readFileSync("src/app/u/[username]/follow-list-page.tsx", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const profileActions = readFileSync("src/app/u/[username]/actions.ts", "utf8");
const savedPage = readFileSync("src/app/saved/page.tsx", "utf8");
const searchPage = readFileSync("src/app/search/page.tsx", "utf8");
const recentSearches = readFileSync("src/app/search/recent-searches.tsx", "utf8");
const urls = readFileSync("src/lib/urls.ts", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");
const mobileSmoke = readFileSync("scripts/smoke-mobile-browser.mjs", "utf8");
const privacyMigration = readFileSync(
  "supabase/migrations/20260721133154_profile_privacy_controls.sql",
  "utf8",
);

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
    label: "account header keeps a clear return path to 4U home",
    ok:
      accountPage.includes("Back to 4U") &&
      accountPage.includes("4U Home") &&
      accountPage.includes('import { Home } from "lucide-react"') &&
      accountPage.includes('href="/#feed"') &&
      accountPage.includes('aria-label="Back to 4U home"') &&
      accountPage.includes("flex flex-wrap items-center justify-end") &&
      mobileSmoke.includes('path: "/account?booking_status=requested"') &&
      mobileSmoke.includes('path: "/settings"'),
  },
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
      profileForm.includes('["about", "About"]') &&
      profileForm.includes('["location", "Location"]') &&
      profileForm.includes('["appearance", "Appearance"]') &&
      profileForm.includes('["privacy", "Privacy"]') &&
      profileForm.includes('["notifications", "Notifications"]') &&
      profileForm.includes('if (hash === "#profile-about-settings") return "about"') &&
      profileForm.includes('if (hash === "#location-settings") return "location"') &&
      profileForm.includes('if (hash === "#language-settings") return "location"') &&
      profileForm.includes('id="profile-about-settings"') &&
      profileForm.includes('id="location-settings"') &&
      profileForm.includes('id="notification-settings"') &&
      profileForm.includes("profileTabFromHash") &&
      profileForm.includes("function profilePanelId(tab: ProfileTab)") &&
      profileForm.includes('aria-label="Profile setup sections"') &&
      profileForm.includes('role="tablist"') &&
      profileForm.includes('role="tab"') &&
      profileForm.includes('role="tabpanel"') &&
      profileForm.includes("aria-controls={profilePanelId(tab)}") &&
      profileForm.includes("aria-selected={isActive}") &&
      profileForm.includes('tabIndex={isActive ? 0 : -1}') &&
      profileForm.includes('event.key === "ArrowRight"') &&
      profileForm.includes('event.key === "ArrowLeft"') &&
      profileForm.includes('event.key === "Home"') &&
      profileForm.includes('event.key === "End"') &&
      profileForm.includes("window.requestAnimationFrame") &&
      profileForm.includes('aria-labelledby={`${profilePanelId("profile")}-tab`}') &&
      !profileForm.includes("aria-pressed={activeTab === tab}"),
  },
  {
    label: "account workspace uses accessible tabs instead of generic pressed buttons",
    ok:
      accountSettingsWorkspace.includes('aria-label="Account areas"') &&
      accountSettingsWorkspace.includes('aria-label="Back to 4U home"') &&
      accountSettingsWorkspace.includes('href="/#feed"') &&
      accountSettingsWorkspace.includes("4U Home") &&
      accountSettingsWorkspace.includes('import { Home } from "lucide-react"') &&
      accountSettingsWorkspace.includes("Settings home") &&
      accountSettingsWorkspace.includes('role="tablist"') &&
      accountSettingsWorkspace.includes('role="tab"') &&
      accountSettingsWorkspace.includes('role="tabpanel"') &&
      accountSettingsWorkspace.includes("aria-controls={tab.id}") &&
      accountSettingsWorkspace.includes("aria-selected={isActive}") &&
      accountSettingsWorkspace.includes('tabIndex={isActive ? 0 : -1}') &&
      accountSettingsWorkspace.includes('event.key === "ArrowRight"') &&
      accountSettingsWorkspace.includes('event.key === "ArrowLeft"') &&
      accountSettingsWorkspace.includes('event.key === "Home"') &&
      accountSettingsWorkspace.includes('event.key === "End"') &&
      accountSettingsWorkspace.includes("window.requestAnimationFrame") &&
      accountSettingsWorkspace.includes('aria-labelledby={`${tab.id}-tab`}') &&
      accountSettingsWorkspace.includes('className={activeTab === tab.id ? "block" : "hidden"}'),
  },
  {
    label: "profile updates sanitize public text and outbound URLs",
    ok:
      accountActions.includes("export async function updateProfile") &&
      accountActions.includes("function cleanFollowVisibility") &&
      accountActions.includes("function cleanCommentPermission") &&
      accountActions.includes("async function uploadBanner") &&
      accountActions.includes("bio: cleanText(formData.get(\"bio\"), 500) || null") &&
      accountActions.includes('followers_visibility: cleanFollowVisibility') &&
      accountActions.includes('following_visibility: cleanFollowVisibility') &&
      accountActions.includes('comment_permission: cleanCommentPermission') &&
      accountActions.includes('const banner = fileFromForm(formData, "banner")') &&
      accountActions.includes('formData.get("remove_banner") === "on"') &&
      accountActions.includes("removeBanner ? { banner_url: null }") &&
      socialFields.every((field) =>
        accountActions.includes(`${field}: cleanExternalUrl(formData.get("${field}"), 240)`),
      ),
  },
  {
    label: "profile and verification failures keep raw storage errors out of member redirects",
    ok:
      accountActions.includes('console.error("Profile photo upload failed.", error)') &&
      accountActions.includes("Could not upload profile photo. Please try again.") &&
      !accountActions.includes('accountPath(error.message || "Could not upload profile photo.")') &&
      accountActions.includes('console.error("Profile banner upload failed.", error)') &&
      accountActions.includes("Could not upload banner photo. Please try again.") &&
      !accountActions.includes('accountPath(error.message || "Could not upload banner photo.")') &&
      accountActions.includes('console.error("Shop profile lookup failed.", shopProfileError)') &&
      accountActions.includes('redirect(accountPath("Shop profile was not found."))') &&
      !accountActions.includes("shopProfileError?.message || \"Shop profile was not found.\"") &&
      accountActions.includes('console.error("Profile save failed.", error)') &&
      accountActions.includes("Could not save profile. Please try again.") &&
      !accountActions.includes('accountPath(error.message || "Could not save profile.")') &&
      accountActions.includes('console.error("Verification status check failed.", pendingError)') &&
      accountActions.includes("Could not check verification status. Please try again.") &&
      !accountActions.includes("pendingError.message || \"Could not check verification status.\"") &&
      accountActions.includes('console.error("Verification document upload failed.", uploadError)') &&
      accountActions.includes("Could not upload license file. Please try again.") &&
      !accountActions.includes("uploadError.message || \"Could not upload license file.\"") &&
      accountActions.includes('console.error("Verification request submit failed.", error)') &&
      accountActions.includes("Could not submit verification. Please try again.") &&
      !accountActions.includes('verificationPath(error.message || "Could not submit verification.")'),
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
    label: "public profile social actions hide raw backend errors from redirects",
    ok:
      profileActions.includes('console.error("Follow target lookup failed.", targetError)') &&
      profileActions.includes('redirect(profilePath(username, "Profile not found."))') &&
      profileActions.includes('console.error("Follow profile failed.", error)') &&
      profileActions.includes('redirect(profilePath(username, "Could not follow profile. Please try again."))') &&
      profileActions.includes('console.error("Unfollow profile failed.", error)') &&
      profileActions.includes('redirect(profilePath(username, "Could not unfollow profile. Please try again."))') &&
      profileActions.includes('console.error("Follow request approval failed.", error)') &&
      profileActions.includes('redirect(profilePath(username, "Could not approve request. Please try again."))') &&
      profileActions.includes('console.error("Follow request decline failed.", error)') &&
      profileActions.includes('redirect(profilePath(username, "Could not decline request. Please try again."))') &&
      profileActions.includes('console.error("Block profile failed.", error)') &&
      profileActions.includes('redirect(profilePath(username, "Could not block profile. Please try again."))') &&
      profileActions.includes('console.error("Unblock profile failed.", error)') &&
      profileActions.includes('redirect(profilePath(username, "Could not unblock profile. Please try again."))') &&
      !profileActions.includes("targetError?.message") &&
      !profileActions.includes("error.message || \"Could not follow profile.\"") &&
      !profileActions.includes("error.message || \"Could not unfollow profile.\"") &&
      !profileActions.includes("error.message || \"Could not approve request.\"") &&
      !profileActions.includes("error.message || \"Could not decline request.\"") &&
      !profileActions.includes("error.message || \"Could not block profile.\"") &&
      !profileActions.includes("error.message || \"Could not unblock profile.\""),
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
      followListPage.includes("function canViewCommunityList") &&
      followListPage.includes("followers_visibility") &&
      followListPage.includes("following_visibility") &&
      followListPage.includes("This member has limited who can view this community list.") &&
      followListPage.includes('from("user_blocks")') &&
      followListPage.includes("const hasBlockRelationship = Boolean(blockRecord)") &&
      followListPage.includes("if (hasBlockRelationship) return false") &&
      followListPage.includes("const fetchTo = to + pageSize") &&
      followListPage.includes(".range(from, fetchTo)") &&
      followListPage.includes("const filteredRows = (rows ?? []).filter") &&
      followListPage.includes("const visibleRows = filteredRows.slice(0, pageSize)") &&
      followListPage.includes("filteredRows.length > pageSize") &&
      followListPage.includes("!blockedProfileIds.has(row.profiles.id)"),
  },
  {
    label: "profile preview widgets filter blocked profiles",
    ok:
      profilePage.includes("async function getBlockedProfileIds") &&
      profilePage.includes("function canViewCommunityList") &&
      profilePage.includes("const canViewFollowers = canViewCommunityList") &&
      profilePage.includes("const canViewFollowing = canViewCommunityList") &&
      profilePage.includes("const visibleFollowerPreview") &&
      profilePage.includes("const visibleFollowingPreview") &&
      profilePage.includes("const visibleLinkedArtists") &&
      profilePage.includes("!blockedProfileIds.has(follow.profiles.id)") &&
      profilePage.includes("!blockedProfileIds.has(artist.id)") &&
      profilePage.includes("followers={visibleFollowerPreview}") &&
      profilePage.includes("artists={visibleLinkedArtists}"),
  },
  {
    label: "privacy settings can limit follow lists and comments",
    ok:
      profileForm.includes('name="followers_visibility"') &&
      profileForm.includes('name="following_visibility"') &&
      profileForm.includes('name="comment_permission"') &&
      profileForm.includes("Who can see followers") &&
      profileForm.includes("Who can see following") &&
      profileForm.includes("Who can comment") &&
      accountPage.includes("followers_visibility, following_visibility, comment_permission") &&
      privacyMigration.includes("add column if not exists followers_visibility") &&
      privacyMigration.includes("add column if not exists following_visibility") &&
      privacyMigration.includes("add column if not exists comment_permission") &&
      privacyMigration.includes("'public', 'followers', 'private'") &&
      privacyMigration.includes("'everyone', 'followers', 'none'"),
  },
  {
    label: "profile content sections page deeper content 25 at a time",
    ok:
      profilePage.includes("const profileContentPageSize = 25") &&
      profilePage.includes("function profileSectionLimit") &&
      profilePage.includes("function profileLoadMoreHref") &&
      profilePage.includes("const feedProfileLimit = profileSectionLimit(query.profile_4u)") &&
      profilePage.includes("const merchProfileLimit = profileSectionLimit(query.profile_merch)") &&
      profilePage.includes(".limit(feedProfileLimit + 1)") &&
      profilePage.includes(".limit(gossipProfileLimit + 1)") &&
      profilePage.includes(".limit(stuffProfileLimit + 1)") &&
      profilePage.includes(".limit(gigsProfileLimit + 1)") &&
      profilePage.includes(".limit(merchProfileLimit + 1)") &&
      profilePage.includes("const hasMoreProfilePosts =") &&
      profilePage.includes("<ProfileLoadMoreLink") &&
      profilePage.includes('label="Load more 4U"') &&
      profilePage.includes('label="Load more Gossip"') &&
      profilePage.includes('label="Load more Stuff"') &&
      profilePage.includes('label="Load more Gigs"') &&
      profilePage.includes('label="Load more Merch"') &&
      productPlan.includes("public profile 4U, Gossip, Stuff, Gigs, and Merch sections"),
  },
  {
    label: "public profile content uses real tabs instead of one long stacked page",
    ok:
      profilePage.includes("ProfileContentTabs") &&
      profilePage.includes('{ count: visiblePosts.length, id: "profile-4u", label: "4U" }') &&
      profilePage.includes('{ count: visibleThreads.length, id: "profile-gossip", label: "Gossip" }') &&
      profilePage.includes('{ count: visibleListings.length, id: "profile-stuff", label: "Stuff" }') &&
      profilePage.includes('{ count: visibleGigs.length, id: "profile-gigs", label: "Gigs" }') &&
      profilePage.includes('{ count: visibleMerchProducts.length, id: "profile-merch", label: "Merch" }') &&
      profileContentTabs.includes('role="tablist"') &&
      profileContentTabs.includes('role="tab"') &&
      profileContentTabs.includes('role="tabpanel"') &&
      profileContentTabs.includes("const isActive = activeTab === tab.id") &&
      profileContentTabs.includes('className={isActive ? "block" : "hidden"}') &&
      profileContentTabs.includes("hidden={!isActive}") &&
      profileContentTabs.includes('tabIndex={isActive ? 0 : -1}') &&
      profileContentTabs.includes('event.key === "ArrowRight"') &&
      profileContentTabs.includes('event.key === "ArrowLeft"') &&
      profileContentTabs.includes('event.key === "Home"') &&
      profileContentTabs.includes('event.key === "End"') &&
      profileContentTabs.includes("window.requestAnimationFrame") &&
      profileContentTabs.includes("window.history.replaceState(null, \"\", `#${tabId}`)") &&
      mobileSmoke.includes("#profile-gossip") &&
      mobileSmoke.includes("Longer posts, questions, and shop talk.") &&
      mobileSmoke.includes("#profile-stuff") &&
      mobileSmoke.includes("Flash, supplies, studio gear, and services.") &&
      mobileSmoke.includes("#profile-gigs") &&
      mobileSmoke.includes("Jobs, conventions, guest spots, and events.") &&
      mobileSmoke.includes("#profile-merch") &&
      mobileSmoke.includes("Fan-facing shirts, prints, art, stickers, and brand goods.") &&
      !profilePage.includes("function ProfileContentNav"),
  },
  {
    label: "public profiles render approved Merch previews",
    ok:
      profilePage.includes('id: "profile-merch"') &&
      profilePage.includes(".from(\"merch_products\")") &&
      profilePage.includes(".eq(\"seller_id\", profile.id)") &&
      profilePage.includes(".eq(\"status\", \"active\")") &&
      profilePage.includes(".eq(\"moderation_status\", \"active\")") &&
      profilePage.includes("product.is_official || isVerifiedProfessional(product.profiles)") &&
      profilePage.includes("visibleMerchProducts") &&
      profilePage.includes("const visibleMerchProductIds = visibleMerchProducts.map") &&
      profilePage.includes(".eq(\"subject_type\", \"merch_product\")") &&
      profilePage.includes("const savedMerchIds = new Set") &&
      profilePage.includes("isSaved={savedMerchIds.has(product.id)}") &&
      profilePage.includes("lg:grid-cols-7") &&
      profilePage.includes("Open merch") &&
      productPlan.includes("profile Merch previews for approved active products"),
  },
  {
    label: "search discovery filters blocked profiles and owned content",
    ok:
      searchPage.includes("async function getBlockedProfileIds") &&
      searchPage.includes("const blockedProfileIds = await getBlockedProfileIds") &&
      searchPage.includes("const resultFetchLimit = resultLimit + 25") &&
      searchPage.includes("const filteredFeedResults = (feedPosts ?? [])") &&
      searchPage.includes("const filteredThreadResults = (threads ?? [])") &&
      searchPage.includes("const filteredListingResults = (listings ?? [])") &&
      searchPage.includes("const filteredGigResults = (gigs ?? [])") &&
      searchPage.includes("const filteredMerchResults = (merchProducts ?? [])") &&
      searchPage.includes("const feedResults = filteredFeedResults.slice(0, resultLimit)") &&
      searchPage.includes("(feedPosts?.length ?? 0) === resultFetchLimit") &&
      searchPage.includes("product.is_official ||") &&
      searchPage.includes("!blockedProfileIds.has(profile.id)") &&
      searchPage.includes("!blockedProfileIds.has(post.profiles.id)") &&
      mobileSmoke.includes('path: "/search?q=shirts&type=merch"') &&
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
      mobileSmoke.includes('path: "/saved"') &&
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
    label: "signed-in profile search can find accepted private follows",
    ok:
      searchPage.includes('.from("follows")') &&
      searchPage.includes('.eq("status", "accepted")') &&
      searchPage.includes("visiblePrivateProfileIds") &&
      searchPage.includes("privateProfilesPromise") &&
      productPlan.includes("private profiles they are connected to through accepted follower/following relationships"),
  },
  {
    label: "search uses tokenized matching and weighted ranking",
    ok:
      searchPage.includes("const rawQuery = cleanQuery(params.q)") &&
      searchPage.includes("const terms = searchTerms(rawQuery)") &&
      searchPage.includes("const query = terms.length ? rawQuery : \"\"") &&
      searchPage.includes("if (!clean) return \"%\"") &&
      searchPage.includes("function searchTerms") &&
      searchPage.includes("const searchTermAliases") &&
      searchPage.includes("function expandSearchTerm") &&
      searchPage.includes('shops: ["shop", "studio"]') &&
      searchPage.includes('dms: ["dm", "message"]') &&
      searchPage.includes('artists: ["artist", "tattooer", "tattooist"]') &&
      searchPage.includes('guestspots: ["guest", "spot", "gig"]') &&
      searchPage.includes('conventions: ["convention", "event", "gig"]') &&
      searchPage.includes('shirts: ["shirt", "apparel", "merch"]') &&
      searchPage.includes('tattoers: ["tattooer", "artist"]') &&
      searchPage.includes("function searchOr") &&
      searchPage.includes("function usernameQuery") &&
      searchPage.includes("const exactUsername = usernameQuery(query)") &&
      searchPage.includes("function weightedSearchScore") &&
      searchPage.includes("function compareSearchResults") &&
      searchPage.includes("function SearchNoResultsTips") &&
      searchPage.includes("Try the exact username") &&
      searchPage.includes("Clear filters") &&
      searchPage.includes("TTC terms work too") &&
      searchPage.includes("profile.username === exactUsername") &&
      searchPage.includes("account_type") &&
      searchPage.includes("visiblePrivateProfileIds.has(profile.id) ? 8 : 0") &&
      searchPage.includes("{ value: profile.username, weight: 40 }") &&
      searchPage.includes("{ value: post.style_tags, weight: 24 }") &&
      searchPage.includes("{ value: listing.category, weight: 20 }") &&
      searchPage.includes("{ value: gig.compensation, weight: 10 }") &&
      searchPage.includes("{ value: product.category, weight: 20 }") &&
      productPlan.includes("common plural and platform-term aliases"),
  },
  {
    label: "search remembers recent searches locally without profiling",
    ok:
      searchPage.includes("RecentSearches") &&
      recentSearches.includes('const storageKey = "ttc.recent-searches.v1"') &&
      recentSearches.includes("const maxRecentSearches = 8") &&
      recentSearches.includes("localStorage.getItem(key)") &&
      recentSearches.includes("localStorage.removeItem(storageKey)") &&
      recentSearches.includes("Recent searches") &&
      recentSearches.includes("hrefFor") &&
      productPlan.includes("browser-local recent search chips"),
  },
  {
    label: "search can pin saved search shortcuts locally",
    ok:
      recentSearches.includes('const savedStorageKey = "ttc.saved-searches.v1"') &&
      recentSearches.includes("const maxSavedSearches = 12") &&
      recentSearches.includes("Saved searches") &&
      recentSearches.includes("currentIsSaved") &&
      recentSearches.includes("writeSavedSearches") &&
      recentSearches.includes("localStorage.removeItem(savedStorageKey)") &&
      productPlan.includes("browser-local saved search shortcuts"),
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
