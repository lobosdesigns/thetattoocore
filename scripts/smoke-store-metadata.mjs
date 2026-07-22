import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename } from "node:path";

const files = {
  appleDescription: "native/store-metadata/apple-app-store/en-US/description.txt",
  appleKeywords: "native/store-metadata/apple-app-store/en-US/keywords.txt",
  appleName: "native/store-metadata/apple-app-store/en-US/name.txt",
  applePromotionalText: "native/store-metadata/apple-app-store/en-US/promotional-text.txt",
  appleSubtitle: "native/store-metadata/apple-app-store/en-US/subtitle.txt",
  appleWhatsNewInternal: "native/store-metadata/apple-app-store/en-US/whats-new-internal.txt",
  googleDescription: "native/store-metadata/google-play/en-US/full-description.txt",
  googleReleaseNotesInternal: "native/store-metadata/google-play/en-US/release-notes-internal.txt",
  googleShort: "native/store-metadata/google-play/en-US/short-description.txt",
  googleTitle: "native/store-metadata/google-play/en-US/title.txt",
  readiness: "docs/APP_STORE_READINESS.md",
  dataSafetyPrep: "docs/DATA_SAFETY_PREP.md",
  realDeviceQa: "docs/REAL_DEVICE_QA_CHECKLIST.md",
  screenshotPrep: "docs/SCREENSHOT_PREP.md",
  storeListingDraft: "docs/STORE_LISTING_DRAFT.md",
  readme: "native/store-metadata/README.md",
  screenshotGenerator: "scripts/generate-safe-store-screenshots.mjs",
  screenshotInventory: "native/store-metadata/screenshot-inventory.md",
};

const read = (path) =>
  existsSync(path) ? readFileSync(path, "utf8").replace(/\r\n/g, "\n").trim() : "";
const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]));
const packageJson = readFileSync("package.json", "utf8");
const publicMetadataKeys = [
  "appleDescription",
  "appleKeywords",
  "appleName",
  "applePromotionalText",
  "appleSubtitle",
  "appleWhatsNewInternal",
  "googleDescription",
  "googleReleaseNotesInternal",
  "googleShort",
  "googleTitle",
];
const publicMetadataText = publicMetadataKeys.map((key) => source[key]).join("\n").toLowerCase();
const storeScreenshotText = source.screenshotGenerator.toLowerCase();
const currentBlockerMatrix = source.readiness.slice(source.readiness.indexOf("## Submission Blocker Matrix"));

function pngInfo(path) {
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  const signature = bytes.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    return null;
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

function generatedPngs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".png"))
    .map((name) => `${dir}/${name}`)
    .sort();
}

function hasExpectedPngs(paths, expectedCount, width, height) {
  return (
    paths.length === expectedCount &&
    paths.every((path) => {
      const info = pngInfo(path);
      return info?.width === width && info.height === height && info.colorType !== 4 && info.colorType !== 6;
    })
  );
}

function hasExpectedPngsAnySize(paths, expectedCount, sizes) {
  return (
    paths.length === expectedCount &&
    paths.every((path) => {
      const info = pngInfo(path);
      return sizes.some(
        ([width, height]) =>
          info?.width === width &&
          info.height === height &&
          info.colorType !== 4 &&
          info.colorType !== 6,
      );
    })
  );
}

function namesFor(paths) {
  return paths.map((path) => basename(path)).sort();
}

function hasExpectedNames(paths, expectedNames) {
  const actualNames = namesFor(paths);

  return (
    actualNames.length === expectedNames.length &&
    expectedNames.every((name, index) => actualNames[index] === name)
  );
}

function describeNameMismatch(paths, expectedNames) {
  const actualNames = namesFor(paths);
  const missing = expectedNames.filter((name) => !actualNames.includes(name));
  const unexpected = actualNames.filter((name) => !expectedNames.includes(name));
  const parts = [];

  if (missing.length > 0) parts.push(`missing: ${missing.join(", ")}`);
  if (unexpected.length > 0) parts.push(`unexpected: ${unexpected.join(", ")}`);

  return parts.join("; ");
}

function selectedNamesAreAvailable(selectedNames, generatedNames) {
  return selectedNames.every((name) => generatedNames.includes(name));
}

function selectedGooglePlayScreenshotPaths() {
  return uploadSelectedScreenshotNames.playPhone.map(
    (name) => `native/store-metadata/generated/google-play/phone-screenshots/${name}`,
  );
}

function selectedAppStorePhoneScreenshotPaths() {
  return uploadSelectedScreenshotNames.appStorePhone.map(
    (name) => `native/store-metadata/generated/apple-app-store/iphone-6-5/${name}`,
  );
}

function selectedAppStoreIpadScreenshotPaths() {
  return uploadSelectedScreenshotNames.appStoreIpad.map(
    (name) => `native/store-metadata/generated/apple-app-store/ipad-13/${name}`,
  );
}

function filesAreAtMost(paths, maxBytes) {
  return paths.every((path) => existsSync(path) && statSync(path).size <= maxBytes);
}

function draftFieldValue(fieldName) {
  const line = source.storeListingDraft
    .split(/\r?\n/)
    .find((row) => row.startsWith(`| ${fieldName} |`));
  if (!line) return "";

  const [, , , value = ""] = line.split("|").map((part) => part.trim());

  return value;
}

function draftFieldUnderLimit(fieldName, limit) {
  const value = draftFieldValue(fieldName);

  return value.length > 0 && value.length <= limit;
}

function draftFieldMatchesFile(fieldName, fileKey) {
  const value = draftFieldValue(fieldName);

  return value.length > 0 && source[fileKey] === value;
}

function markdownSectionBody(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex === -1) return "";

  const body = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (line.startsWith("## ")) break;
    body.push(line);
  }

  return body.join("\n").trim();
}

function withinCharacterLimit(value, limit) {
  return Array.from(value).length > 0 && Array.from(value).length <= limit;
}

function appleKeywordTokens() {
  return source.appleKeywords.split(",");
}

function appleKeywordsAreConsoleReady() {
  const tokens = appleKeywordTokens();
  const normalizedTokens = tokens.map((token) => token.toLowerCase());

  return (
    tokens.length > 1 &&
    tokens.every((token) => token.length > 0 && token === token.trim()) &&
    new Set(normalizedTokens).size === normalizedTokens.length
  );
}

const draftFullDescription = markdownSectionBody(source.storeListingDraft, "Full Description");

const generatedScreenshots = {
  playPhone: generatedPngs("native/store-metadata/generated/google-play/phone-screenshots"),
  playFeature: ["native/store-metadata/generated/google-play/feature-graphic-1024x500.png"],
  appStorePhone: generatedPngs("native/store-metadata/generated/apple-app-store/iphone-6-5"),
  appStoreIpad: generatedPngs("native/store-metadata/generated/apple-app-store/ipad-13"),
};

const expectedScreenshotNames = {
  playPhone: [
    "mobile-4u-safe-1080x1920.png",
    "mobile-ads-safe-1080x1920.png",
    "mobile-booking-safe-1080x1920.png",
    "mobile-gossip-safe-1080x1920.png",
    "mobile-help-support-1080x1920.png",
    "mobile-home-1080x1920.png",
    "mobile-login-signup-1080x1920.png",
    "mobile-merch-help-shortcut-safe-1080x1920.png",
    "mobile-merch-safe-1080x1920.png",
    "mobile-order-support-safe-1080x1920.png",
    "mobile-payout-safe-1080x1920.png",
    "mobile-privacy-safety-safe-1080x1920.png",
    "mobile-profile-search-1080x1920.png",
    "mobile-stories-safe-1080x1920.png",
    "mobile-verification-safe-1080x1920.png",
  ],
  playFeature: ["feature-graphic-1024x500.png"],
  appStorePhone: [
    "mobile-4u-safe-1242x2688.png",
    "mobile-ads-safe-1242x2688.png",
    "mobile-booking-safe-1242x2688.png",
    "mobile-gossip-safe-1242x2688.png",
    "mobile-help-support-1242x2688.png",
    "mobile-home-1242x2688.png",
    "mobile-login-signup-1242x2688.png",
    "mobile-merch-help-shortcut-safe-1242x2688.png",
    "mobile-merch-safe-1242x2688.png",
    "mobile-order-support-safe-1242x2688.png",
    "mobile-payout-safe-1242x2688.png",
    "mobile-privacy-safety-safe-1242x2688.png",
    "mobile-profile-search-1242x2688.png",
    "mobile-stories-safe-1242x2688.png",
    "mobile-verification-safe-1242x2688.png",
  ],
  appStoreIpad: [
    "mobile-4u-safe-2048x2732.png",
    "mobile-home-2048x2732.png",
    "mobile-login-signup-2048x2732.png",
  ],
};

const uploadSelectedScreenshotNames = {
  playPhone: [
    "mobile-home-1080x1920.png",
    "mobile-login-signup-1080x1920.png",
    "mobile-4u-safe-1080x1920.png",
    "mobile-gossip-safe-1080x1920.png",
    "mobile-stories-safe-1080x1920.png",
    "mobile-profile-search-1080x1920.png",
    "mobile-privacy-safety-safe-1080x1920.png",
    "mobile-help-support-1080x1920.png",
  ],
  appStorePhone: [
    "mobile-home-1242x2688.png",
    "mobile-login-signup-1242x2688.png",
    "mobile-4u-safe-1242x2688.png",
    "mobile-gossip-safe-1242x2688.png",
    "mobile-stories-safe-1242x2688.png",
    "mobile-profile-search-1242x2688.png",
    "mobile-verification-safe-1242x2688.png",
    "mobile-booking-safe-1242x2688.png",
    "mobile-privacy-safety-safe-1242x2688.png",
    "mobile-help-support-1242x2688.png",
  ],
  appStoreIpad: [
    "mobile-home-2048x2732.png",
    "mobile-login-signup-2048x2732.png",
    "mobile-4u-safe-2048x2732.png",
  ],
};

const blockedTerms = [
  "cloudflare",
  "cloud messaging",
  "fcm",
  "firebase",
  "supabase",
  "hostgator",
  "stripe",
  "api key",
  "service-role",
  "database",
  "server",
];

const blockedOverpromiseTerms = [
  "live payments",
  "instant payouts",
  "guaranteed refunds",
  "public launch",
  "unrestricted marketplace",
  "real-money checkout",
  "same-day payout",
  "push notifications",
  "native push",
  "real-time push",
];
const blockedStoreTeaserPatterns = [
  /\bbest\b/i,
  /#\s*1/i,
  /\btop\b/i,
  /\bnew\b/i,
  /\bfree\b/i,
  /\bdiscount\b/i,
  /\bsale\b/i,
  /\bmillion downloads\b/i,
  /\bdownload now\b/i,
  /\binstall now\b/i,
  /\bplay now\b/i,
  /\btry now\b/i,
];
const storeTeaserFields = [
  source.googleShort,
  source.appleSubtitle,
  source.applePromotionalText,
];

const blockedPrivateEvidenceTerms = [
  "936-730-7104",
  "reviewer password:",
  "password=",
  "one-time code",
  "private phone:",
  "bank account number",
  "card number",
  "dashboard id",
];

const googlePlayScreenshotMaxBytes = 8 * 1024 * 1024;

const checks = [
  {
    label: "store metadata files exist",
    ok: Object.values(files).every((path) => existsSync(path)),
  },
  {
    label: "store names and short fields fit common console limits",
    ok:
      source.googleTitle.length > 0 &&
      source.googleTitle.length <= 30 &&
      source.googleShort.length > 0 &&
      source.googleShort.length <= 80 &&
      source.appleName.length > 0 &&
      source.appleName.length <= 30 &&
      source.appleSubtitle.length > 0 &&
      source.appleSubtitle.length <= 30 &&
      source.appleKeywords.length <= 100 &&
      source.applePromotionalText.length > 0 &&
      source.applePromotionalText.length <= 170 &&
      source.appleWhatsNewInternal.length > 0 &&
      source.appleWhatsNewInternal.length <= 4000 &&
      source.googleReleaseNotesInternal.length > 0 &&
      source.googleReleaseNotesInternal.length <= 500,
  },
  {
    label: "store full descriptions fit current 4000 character console limit",
    ok:
      withinCharacterLimit(source.googleDescription, 4000) &&
      withinCharacterLimit(source.appleDescription, 4000) &&
      source.storeListingDraft.includes("| Google Play full description | 4,000 characters |") &&
      source.storeListingDraft.includes("| App Store description | 4,000 characters |") &&
      source.storeListingDraft.includes("Current full-description limit check") &&
      source.storeListingDraft.includes("4,000 characters"),
  },
  {
    label: "store upload text matches console-ready draft fields",
    ok:
      draftFieldMatchesFile("Google Play short description", "googleShort") &&
      source.googleDescription === draftFullDescription &&
      source.appleDescription === draftFullDescription &&
      draftFieldMatchesFile("App Store subtitle", "appleSubtitle") &&
      draftFieldMatchesFile("App Store promotional text", "applePromotionalText") &&
      draftFieldMatchesFile("App Store keywords", "appleKeywords") &&
      draftFieldMatchesFile("App Store release notes", "appleWhatsNewInternal") &&
      draftFieldMatchesFile("Google Play release notes", "googleReleaseNotesInternal"),
  },
  {
    label: "App Store keywords are comma separated unique tokens",
    ok: appleKeywordsAreConsoleReady(),
  },
  {
    label: "store descriptions include current safety position",
    ok:
      source.googleDescription.includes("18+") &&
      source.googleDescription.includes("visible nudity is not allowed") &&
      source.googleDescription.includes("professional tattoo equipment") &&
      source.appleDescription.includes("18+") &&
      source.appleDescription.includes("visible nudity is not allowed") &&
      source.appleDescription.includes("professional tattoo equipment"),
  },
  {
    label: "store metadata avoids public infrastructure details",
    ok: blockedTerms.every((term) => !publicMetadataText.includes(term)),
  },
  {
    label: "store screenshot text avoids public infrastructure details",
    ok: blockedTerms.every((term) => !storeScreenshotText.includes(term)),
  },
  {
    label: "store metadata avoids over-promising launch commerce status",
    ok: blockedOverpromiseTerms.every((term) => !publicMetadataText.includes(term)),
  },
  {
    label: "store teaser fields avoid ranking price and install CTA copy",
    ok: blockedStoreTeaserPatterns.every(
      (pattern) => !storeTeaserFields.some((field) => pattern.test(field)),
    ),
  },
  {
    label: "store screenshot text avoids over-promising launch commerce status",
    ok: blockedOverpromiseTerms.every((term) => !storeScreenshotText.includes(term)),
  },
  {
    label: "store screenshot text avoids private console evidence",
    ok: blockedPrivateEvidenceTerms.every((term) => !storeScreenshotText.includes(term)),
  },
  {
    label: "store internal notes avoid native push overclaims",
    ok:
      source.appleWhatsNewInternal.includes("profile privacy controls") &&
      source.appleWhatsNewInternal.includes("4U/Gossip/Gigs tagging") &&
      source.appleWhatsNewInternal.includes("review-controlled commerce flows") &&
      source.appleWhatsNewInternal.includes("in-app alerts") &&
      source.googleReleaseNotesInternal.includes("profile privacy controls") &&
      source.googleReleaseNotesInternal.includes("4U/Gossip/Gigs tagging") &&
      source.googleReleaseNotesInternal.includes("review-controlled commerce flows") &&
      source.googleReleaseNotesInternal.includes("in-app alerts") &&
      !source.appleWhatsNewInternal.includes("search, notifications, reporting") &&
      !source.googleReleaseNotesInternal.includes("search, notifications, reporting"),
  },
  {
    label: "store metadata README keeps console handoff fields private and complete",
    ok:
      packageJson.includes('"verify:store-release"') &&
      packageJson.includes('"verify:app-review-preflight"') &&
      packageJson.includes("npm run lint && npm run build && npm run smoke:env && npm run smoke:content && npm run smoke:store && npm run smoke:pwa && npm run smoke:handoff && npm run smoke:docs && npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:ios") &&
      packageJson.includes("npm run lint && npm run build && npm run smoke:env && npm run smoke:security && npm run smoke:content && npm run smoke:theme && npm run smoke:payments && npm run smoke:store && npm run smoke:pwa && npm run smoke:native && npm run qa:android-device && npm run smoke:handoff && npm run smoke:docs && npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:ios") &&
      source.readme.includes("npm.cmd run verify:app-review-preflight") &&
      source.readme.includes("npm.cmd run verify:store-release") &&
      source.readme.includes("This checks lint, production build, production environment boundaries") &&
      source.readme.includes("production environment boundaries") &&
      source.readme.includes("security copy and headers, content-policy/reporting guardrails, theme") &&
      source.readme.includes("payment guardrails, store metadata") &&
      source.readme.includes("native wrapper") &&
      source.readme.includes("private handoff-template validation") &&
      source.readme.includes("Android-profile mobile routes") &&
      source.readme.includes("iOS-profile mobile routes") &&
      source.readme.includes("without storing") &&
      source.readme.includes("private console screenshots") &&
      source.readme.includes("real-device evidence") &&
      source.readme.includes("narrower guard") &&
      source.readme.includes("still checks the private") &&
      source.readme.includes("handoff-template before upload evidence is collected") &&
      source.readme.includes("## Console Field Handoff") &&
      source.readme.includes("Support URL: `https://thetattoocore.com/support`") &&
      source.readme.includes("Privacy URL: `https://thetattoocore.com/privacy`") &&
      source.readme.includes("Terms URL: `https://thetattoocore.com/terms`") &&
      source.readme.includes("App start URL: `https://thetattoocore.com/login`") &&
      source.readme.includes("Support email: `support@thetattoocore.com`") &&
      source.readme.includes("App Store category handoff: set Primary Category to `Social Networking`") &&
      source.readme.includes("App Store Content Rights handoff: confirm TTC has rights or permission") &&
      source.readme.includes("do not use third-party tattoo art, music, logos, private user content, or payment/account screenshots") &&
      source.readme.includes("App Store pricing handoff: set the v1 app price to free") &&
      source.readme.includes("Google Play category handoff: app category is `Social`") &&
      source.readme.includes("Reviewer account status: test account created and sign-in validated") &&
      source.readme.includes("Final reviewer access status: confirm the selected Apple build and Google release track") &&
      source.readme.includes("Screenshot upload status: use upload-ready no-alpha PNG derivatives") &&
      source.readme.includes("Contact phone: keep console-only/private") &&
      source.readme.includes("## Private Console Evidence Template") &&
      source.readme.includes("| Build selection | Apple build number, Google release track") &&
      source.readme.includes("| Google Play API 36 signed upload bundle | Fresh bundle built from the checked-in API 36 wrapper") &&
      source.readme.includes("privately signed, and checked against real-device QA before public submission or post-deadline updates") &&
      source.readme.includes("no keystore, signing certificate, local path, or console identifiers") &&
      source.readme.includes("| Google Play closed testing | Tester list or Google Group selection") &&
      source.readme.includes("14-day continuous opt-in window if production access requires it") &&
      source.readme.includes("| Reviewer account | Test account creation, email-confirmed sign-in") &&
      source.readme.includes("| Final reviewer access | Selected Apple build and Google release track reviewer sign-in details") &&
      source.readme.includes("`pending`, `validated for selected build/track`, or `needs retry`") &&
      source.readme.includes("| Contact details | Support email, support URL, privacy URL") &&
      source.readme.includes("| Screenshot upload | App Store iPhone/iPad validation") &&
      source.readme.includes("| Category and pricing | App Store categories, Google Play category") &&
      source.readme.includes("| Content rights | Confirmation that icons, generated screenshots") &&
      source.readme.includes("| Privacy and data safety | App Privacy, Google Data Safety") &&
      source.readme.includes("| Age/content rating | App Store age rating, Google Play/IARC summary") &&
      source.readme.includes("| Accessibility Nutrition Labels | VoiceOver, Voice Control, Larger Text") &&
      source.readme.includes("| Final validation | Console errors cleared") &&
      blockedPrivateEvidenceTerms.every((term) => !source.readme.toLowerCase().includes(term)),
  },
  {
    label: "store readiness docs keep current console blockers guarded",
    ok:
      source.readiness.includes("Apple iOS `1.0` build `1.0 (3)` is submitted for App Review") &&
      source.readiness.includes("iOS App Version `1.0` build `1.0 (3)` was submitted for App Review") &&
      source.readiness.includes("age/content rating, Accessibility Nutrition Labels, Google Play closed-test tester opt-in/duration evidence if required, and final console validation") &&
      source.readiness.includes("Closed testing - Alpha release `1 (1.0)` is available to selected testers on Google Play") &&
      source.readiness.includes("The track tester access now uses the same Google Group tester community as the Lobos Designs closed test") &&
      source.readiness.includes("the track is active, and the Android/web tester join links are saved privately") &&
      (source.readiness.includes("final content-rating summary/save handoff, and any required closed-test production-access evidence") ||
        source.readiness.includes("14-day production-access evidence still needs eligible tester opt-in/install proof")) &&
      source.readiness.includes("App Store Connect shows `Waiting for Review` and `1 Item Submitted`") &&
      source.readiness.includes("Age 18+ override") &&
      source.readiness.includes("Monitor App Review status and reviewer messages") &&
      source.readiness.includes("group-member opt-in/install proof and 14-day production-access tester evidence if required") &&
      source.readiness.includes("Google Play closed-test tester opt-in/duration evidence if required") &&
      source.readiness.includes("build selection, reviewer test access, developer/legal entity, reviewer contact phone") &&
      source.readiness.includes("Do not store reviewer passwords, private phone numbers, account-owner data, or console identifiers in repo docs") &&
      source.dataSafetyPrep.includes("Google Play Data Safety must be current before closed testing, open testing, or production release") &&
      source.dataSafetyPrep.includes("Apps active only on Google Play internal testing are currently exempt") &&
      source.screenshotPrep.includes("Track each store asset set separately") &&
      source.screenshotPrep.includes("npm.cmd run verify:store-release") &&
      source.screenshotPrep.includes("lint, production build, production environment boundaries, content-policy/reporting guardrails, store metadata, PWA install assets, private handoff-template validation, readiness docs, public routes, Android-profile mobile routes, and iOS-profile mobile routes") &&
      source.storeListingDraft.includes("## Console-Ready Fields") &&
      source.storeListingDraft.includes("| Google Play short description | 80 characters | Tattoo community for artists, studios, vendors, collectors, and fans. |") &&
      source.storeListingDraft.includes("| App Store subtitle | 30 characters | Tattoo community hub |") &&
      source.storeListingDraft.includes("| App Store promotional text | 170 characters |") &&
      source.storeListingDraft.includes("| App Store keywords | 100 characters | tattoo,artists,studios,shops,body art,merch,gigs,guest spots,booking,stories,DMs,verification |") &&
      source.storeListingDraft.includes("shops, body art, tattoo community, guest spots, booking, gigs, merch, stories") &&
      source.storeListingDraft.includes("| Google Play release notes | 500 characters |") &&
      source.storeListingDraft.includes("| App Store primary category | Console choice | Social Networking |") &&
      source.storeListingDraft.includes("| Google Play app category | Console choice | Social |") &&
      draftFieldUnderLimit("Google Play short description", 80) &&
      draftFieldUnderLimit("App Store subtitle", 30) &&
      draftFieldUnderLimit("App Store promotional text", 170) &&
      draftFieldUnderLimit("App Store keywords", 100) &&
      draftFieldUnderLimit("App Store release notes", 4000) &&
      draftFieldUnderLimit("Google Play release notes", 500) &&
      source.storeListingDraft.includes("visible nudity is not allowed") &&
      source.storeListingDraft.includes("No AI art") &&
      source.storeListingDraft.includes("no scratcher promotion") &&
      blockedPrivateEvidenceTerms.every((term) => !currentBlockerMatrix.toLowerCase().includes(term)),
  },
  {
    label: "App Store Accessibility Nutrition Labels evidence matrix stays submitted-build gated",
    ok:
      source.realDeviceQa.includes("## Accessibility Nutrition Labels Evidence Matrix") &&
      source.realDeviceQa.includes("Test only the submitted iPhone/iPad build") &&
      source.realDeviceQa.includes("mark unsupported features honestly") &&
      source.realDeviceQa.includes("VoiceOver") &&
      source.realDeviceQa.includes("Voice Control") &&
      source.realDeviceQa.includes("Larger Text") &&
      source.realDeviceQa.includes("Differentiate Without Color Alone") &&
      source.realDeviceQa.includes("Sufficient Contrast") &&
      source.realDeviceQa.includes("Reduced Motion") &&
      source.realDeviceQa.includes("Captions") &&
      source.realDeviceQa.includes("Audio Descriptions") &&
      source.realDeviceQa.includes("Sign up, log in, reset password, and open Help/Support/legal links.") &&
      source.realDeviceQa.includes("Navigate 4U, Gossip, Stuff, Gigs, Merch, Search, profile, Settings, and Account.") &&
      source.realDeviceQa.includes("Create a safe post/Story, report/block content, and submit account deletion request.") &&
      source.realDeviceQa.includes("Complete the two-user DM pass, including reply, read indicator, attachment, and notification route.") &&
      source.realDeviceQa.includes("Run verification upload, booking request/deposit return, Merch browsing/order history, and controlled checkout return paths.") &&
      source.realDeviceQa.includes("Repo-safe accessibility summary fields are limited to release candidate") &&
      source.realDeviceQa.includes("Do not commit private messages, payment data, license documents, console screenshots, account identifiers, tester emails, or personal contact details"),
  },
  {
    label: "store screenshot inventory blocks unsafe review images",
    ok:
      source.screenshotInventory.includes("public/screenshots/mobile-home.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-login-signup.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-stories-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-verification-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-booking-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-ads-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-merch-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-merch-help-shortcut-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-payout-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-order-support-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-privacy-safety-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-help-support.png") &&
      source.screenshotInventory.includes("## Screenshot Replacement Status") &&
      source.screenshotInventory.includes("| Google Play phone screenshots | Generated safe phone derivatives") &&
      source.screenshotInventory.includes("| Google Play feature graphic | Generated TTC-branded 1024 x 500 PNG") &&
      source.screenshotInventory.includes("| App Store iPhone 6.5-inch screenshots | Generated safe iPhone derivatives") &&
      source.screenshotInventory.includes("| App Store 13-inch iPad screenshots | Generated safe iPad derivatives") &&
      source.screenshotInventory.includes("2064 x 2752 is also accepted by the current 13-inch iPad class") &&
      source.screenshotPrep.includes("Current Apple 13-inch iPad screenshot validation should accept either 2064 x") &&
      source.screenshotPrep.includes("2752 or 2048 x 2732 portrait PNG/JPEG files") &&
      source.screenshotInventory.includes("Safe draft only; not submission-ready until real-device capture and Play Console upload validation are recorded privately.") &&
      source.screenshotInventory.includes("Safe draft only; not submission-ready until Play Console feature-graphic validation is recorded privately.") &&
      source.screenshotInventory.includes("Safe draft only; not submission-ready until real-device capture and App Store Connect upload validation are recorded privately.") &&
      source.screenshotInventory.includes("Safe draft only; not submission-ready until App Store Connect iPad upload validation is recorded privately.") &&
      source.screenshotInventory.includes("Replace generated draft assets with final real-device screenshots") &&
      source.screenshotInventory.includes("Merch guide shortcut screenshot is covered by") &&
      !source.screenshotInventory.includes("Generated placeholder ready") &&
      source.screenshotInventory.includes("4U, Gossip, Stuff, Gigs, Merch") &&
      source.screenshotInventory.includes("verification, booking, privacy/safety, Help, and Support") &&
      source.screenshotInventory.includes("DM should appear as a") &&
      source.screenshotInventory.includes("not as a main swipe/feed column") &&
      source.screenshotInventory.includes("private DMs") &&
      source.screenshotInventory.includes("license documents") &&
      source.screenshotInventory.includes("visible nudity") &&
      source.screenshotInventory.includes("infrastructure/provider names") &&
      source.screenshotInventory.includes("Merch guide shortcut") &&
      source.screenshotInventory.includes("seller payout setup details"),
  },
  {
    label: "store screenshot selected upload sets fit current console count caps",
    ok:
      uploadSelectedScreenshotNames.playPhone.length >= 4 &&
      uploadSelectedScreenshotNames.playPhone.length <= 8 &&
      uploadSelectedScreenshotNames.appStorePhone.length >= 1 &&
      uploadSelectedScreenshotNames.appStorePhone.length <= 10 &&
      uploadSelectedScreenshotNames.appStoreIpad.length >= 1 &&
      uploadSelectedScreenshotNames.appStoreIpad.length <= 10 &&
      selectedNamesAreAvailable(
        uploadSelectedScreenshotNames.playPhone,
        expectedScreenshotNames.playPhone,
      ) &&
      selectedNamesAreAvailable(
        uploadSelectedScreenshotNames.appStorePhone,
        expectedScreenshotNames.appStorePhone,
      ) &&
      selectedNamesAreAvailable(
        uploadSelectedScreenshotNames.appStoreIpad,
        expectedScreenshotNames.appStoreIpad,
      ) &&
      source.screenshotInventory.includes("## Upload-Selected Screenshot Sets") &&
      source.screenshotInventory.includes("Current Google Play phone cap: 4 to 8 screenshots") &&
      source.screenshotInventory.includes("Current App Store screenshot cap: 1 to 10 screenshots") &&
      source.screenshotInventory.includes("selected 13-inch iPad set") &&
      source.screenshotInventory.includes("## Console Upload Validation Packet") &&
      source.screenshotInventory.includes("Create one private packet for each store asset set before public review") &&
      source.screenshotInventory.includes("selected build or release track") &&
      source.screenshotInventory.includes("uploaded filenames") &&
      source.screenshotInventory.includes("upload validation result") &&
      source.screenshotInventory.includes("final action owner") &&
      source.screenshotInventory.includes("raw console screenshots") &&
      source.screenshotInventory.includes("private reviewer credentials") &&
      source.screenshotInventory.includes("contact phone details") &&
      source.screenshotInventory.includes("dashboard IDs") &&
      source.screenshotInventory.includes("Before marking a set `validated`") &&
      source.screenshotInventory.includes("PNG files have no alpha channel") &&
      source.screenshotInventory.includes("file sizes are within the store limit") &&
      source.screenshotInventory.includes("infrastructure/provider names") &&
      source.screenshotInventory.includes("still match the selected") &&
      source.screenshotInventory.includes("metadata, privacy, age-rating, and payment-status edits") &&
      uploadSelectedScreenshotNames.playPhone.every((name) =>
        source.screenshotInventory.includes(name),
      ) &&
      uploadSelectedScreenshotNames.appStorePhone.every((name) =>
        source.screenshotInventory.includes(name),
      ) &&
      uploadSelectedScreenshotNames.appStoreIpad.every((name) =>
        source.screenshotInventory.includes(name),
      ),
  },
  {
    label: "selected Google Play phone screenshots fit current 8 MB upload limit",
    ok:
      filesAreAtMost(selectedGooglePlayScreenshotPaths(), googlePlayScreenshotMaxBytes) &&
      source.screenshotInventory.includes("Current Google Play phone upload size cap: 8 MB per screenshot") &&
      source.screenshotPrep.includes("Google Play phone screenshots should be 8 MB or smaller per file"),
  },
  {
    label: "selected App Store screenshots match upload dimensions and no-alpha output",
    ok:
      hasExpectedPngs(
        selectedAppStorePhoneScreenshotPaths(),
        uploadSelectedScreenshotNames.appStorePhone.length,
        1242,
        2688,
      ) &&
      hasExpectedPngsAnySize(
        selectedAppStoreIpadScreenshotPaths(),
        uploadSelectedScreenshotNames.appStoreIpad.length,
        [
          [2048, 2732],
          [2064, 2752],
        ],
      ) &&
      source.screenshotInventory.includes("Current App Store screenshot cap: 1 to 10 screenshots") &&
      source.screenshotInventory.includes("PNG files have no alpha channel") &&
      source.screenshotInventory.includes("dimensions match the store class"),
  },
  {
    label: "generated Google Play screenshots match upload dimensions",
    ok:
      hasExpectedPngs(generatedScreenshots.playPhone, 15, 1080, 1920) &&
      hasExpectedPngs(generatedScreenshots.playFeature, 1, 1024, 500),
  },
  {
    label: "generated Google Play screenshots cover expected safe scenes",
    ok:
      hasExpectedNames(generatedScreenshots.playPhone, expectedScreenshotNames.playPhone) &&
      hasExpectedNames(generatedScreenshots.playFeature, expectedScreenshotNames.playFeature),
    message: [
      describeNameMismatch(generatedScreenshots.playPhone, expectedScreenshotNames.playPhone),
      describeNameMismatch(generatedScreenshots.playFeature, expectedScreenshotNames.playFeature),
    ]
      .filter(Boolean)
      .join("; "),
  },
  {
    label: "generated App Store screenshots match upload dimensions",
    ok:
      hasExpectedPngs(generatedScreenshots.appStorePhone, 15, 1242, 2688) &&
      hasExpectedPngsAnySize(generatedScreenshots.appStoreIpad, 3, [
        [2048, 2732],
        [2064, 2752],
      ]),
  },
  {
    label: "generated App Store screenshots cover expected safe scenes",
    ok:
      hasExpectedNames(generatedScreenshots.appStorePhone, expectedScreenshotNames.appStorePhone) &&
      hasExpectedNames(generatedScreenshots.appStoreIpad, expectedScreenshotNames.appStoreIpad),
    message: [
      describeNameMismatch(generatedScreenshots.appStorePhone, expectedScreenshotNames.appStorePhone),
      describeNameMismatch(generatedScreenshots.appStoreIpad, expectedScreenshotNames.appStoreIpad),
    ]
      .filter(Boolean)
      .join("; "),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  for (const check of failures) {
    if (check.message) {
      console.error(`  ${check.message}`);
    }
  }
  console.error(`${failures.length} store metadata smoke check(s) failed.`);
  process.exit(1);
}
