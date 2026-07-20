import { existsSync, readFileSync, readdirSync } from "node:fs";

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
  screenshotPrep: "docs/SCREENSHOT_PREP.md",
  storeListingDraft: "docs/STORE_LISTING_DRAFT.md",
  readme: "native/store-metadata/README.md",
  screenshotInventory: "native/store-metadata/screenshot-inventory.md",
};

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8").trim() : "");
const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]));
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

const generatedScreenshots = {
  playPhone: generatedPngs("native/store-metadata/generated/google-play/phone-screenshots"),
  playFeature: ["native/store-metadata/generated/google-play/feature-graphic-1024x500.png"],
  appStorePhone: generatedPngs("native/store-metadata/generated/apple-app-store/iphone-6-5"),
  appStoreIpad: generatedPngs("native/store-metadata/generated/apple-app-store/ipad-13"),
};

const blockedTerms = [
  "cloudflare",
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
    label: "store metadata avoids over-promising launch commerce status",
    ok: blockedOverpromiseTerms.every((term) => !publicMetadataText.includes(term)),
  },
  {
    label: "store internal notes avoid native push overclaims",
    ok:
      source.appleWhatsNewInternal.includes("in-app alerts") &&
      source.googleReleaseNotesInternal.includes("in-app alerts") &&
      !source.appleWhatsNewInternal.includes("search, notifications, reporting") &&
      !source.googleReleaseNotesInternal.includes("search, notifications, reporting"),
  },
  {
    label: "store metadata README keeps console handoff fields private and complete",
    ok:
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
      source.readme.includes("Reviewer credential status: created, validated, and stored only in the store-review console fields") &&
      source.readme.includes("Screenshot upload status: use upload-ready no-alpha PNG derivatives") &&
      source.readme.includes("Contact phone: keep console-only/private") &&
      source.readme.includes("## Private Console Evidence Template") &&
      source.readme.includes("| Build selection | Apple build number, Google release track") &&
      source.readme.includes("| Google Play closed testing | Tester list or Google Group selection") &&
      source.readme.includes("14-day continuous opt-in window if production access requires it") &&
      source.readme.includes("| Reviewer access | Reviewer test account email") &&
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
      source.readiness.includes("Apple still needs 13-inch iPad screenshot upload, primary category, Content Rights, App Privacy/Privacy Policy URL, pricing, age-rating answers, Accessibility Nutrition Labels, and final submission validation") &&
      source.readiness.includes("age/content rating, Accessibility Nutrition Labels, Google Play closed-test tester opt-in/duration evidence if required, and final console validation") &&
      source.readiness.includes("Google Play still needs the final content-rating summary/save handoff, current Data Safety review, and any required closed-test production-access evidence") &&
      source.readiness.includes("Google Play closed-test tester opt-in/duration evidence if required") &&
      source.readiness.includes("build selection, reviewer test access, developer/legal entity, reviewer contact phone") &&
      source.readiness.includes("Do not store reviewer passwords, private phone numbers, account-owner data, or console identifiers in repo docs") &&
      source.dataSafetyPrep.includes("Google Play Data Safety must be completed before closed testing, open testing, or production release") &&
      source.dataSafetyPrep.includes("Apps active only on Google Play internal testing are currently exempt") &&
      source.screenshotPrep.includes("Track each store asset set separately") &&
      source.storeListingDraft.includes("visible nudity is not allowed") &&
      source.storeListingDraft.includes("No AI art") &&
      source.storeListingDraft.includes("no scratcher promotion") &&
      blockedPrivateEvidenceTerms.every((term) => !currentBlockerMatrix.toLowerCase().includes(term)),
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
      source.screenshotInventory.includes("public/screenshots/mobile-payout-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-help-support.png") &&
      source.screenshotInventory.includes("## Screenshot Replacement Status") &&
      source.screenshotInventory.includes("| Google Play phone screenshots | Generated safe phone derivatives") &&
      source.screenshotInventory.includes("| Google Play feature graphic | Generated TTC-branded 1024 x 500 PNG") &&
      source.screenshotInventory.includes("| App Store iPhone 6.5-inch screenshots | Generated safe iPhone derivatives") &&
      source.screenshotInventory.includes("| App Store 13-inch iPad screenshots | Generated safe iPad derivatives") &&
      source.screenshotInventory.includes("Generated placeholder ready; App Store iPad upload evidence remains a blocker.") &&
      source.screenshotInventory.includes("Replace generated placeholders with final real-device screenshots") &&
      source.screenshotInventory.includes("4U, Gossip, Stuff, Gigs, Merch") &&
      source.screenshotInventory.includes("verification, booking, Help, and Support") &&
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
    label: "generated Google Play screenshots match upload dimensions",
    ok:
      hasExpectedPngs(generatedScreenshots.playPhone, 12, 1080, 1920) &&
      hasExpectedPngs(generatedScreenshots.playFeature, 1, 1024, 500),
  },
  {
    label: "generated App Store screenshots match upload dimensions",
    ok:
      hasExpectedPngs(generatedScreenshots.appStorePhone, 12, 1242, 2688) &&
      hasExpectedPngs(generatedScreenshots.appStoreIpad, 3, 2048, 2732),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} store metadata smoke check(s) failed.`);
  process.exit(1);
}
