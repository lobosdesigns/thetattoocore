import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  screenshotPrep: "docs/SCREENSHOT_PREP.md",
  storeListingDraft: "docs/STORE_LISTING_DRAFT.md",
  readme: "native/store-metadata/README.md",
  screenshotGenerator: "scripts/generate-safe-store-screenshots.mjs",
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
    label: "store upload text matches console-ready draft fields",
    ok:
      draftFieldMatchesFile("Google Play short description", "googleShort") &&
      draftFieldMatchesFile("App Store subtitle", "appleSubtitle") &&
      draftFieldMatchesFile("App Store promotional text", "applePromotionalText") &&
      draftFieldMatchesFile("App Store keywords", "appleKeywords") &&
      draftFieldMatchesFile("App Store release notes", "appleWhatsNewInternal") &&
      draftFieldMatchesFile("Google Play release notes", "googleReleaseNotesInternal"),
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
      source.readme.includes("Reviewer account status: test account created and sign-in validated") &&
      source.readme.includes("Final reviewer access status: confirm the selected Apple build and Google release track") &&
      source.readme.includes("Screenshot upload status: use upload-ready no-alpha PNG derivatives") &&
      source.readme.includes("Contact phone: keep console-only/private") &&
      source.readme.includes("## Private Console Evidence Template") &&
      source.readme.includes("| Build selection | Apple build number, Google release track") &&
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
      source.readiness.includes("Apple still needs 13-inch iPad screenshot upload, primary category, Content Rights, App Privacy/Privacy Policy URL, pricing, age-rating answers, Accessibility Nutrition Labels, and final submission validation") &&
      source.readiness.includes("age/content rating, Accessibility Nutrition Labels, Google Play closed-test tester opt-in/duration evidence if required, and final console validation") &&
      source.readiness.includes("Google Play still needs the final content-rating summary/save handoff, current Data Safety review, and any required closed-test production-access evidence") &&
      source.readiness.includes("TestFlight internal build and reviewer account exist; public submission not ready") &&
      source.readiness.includes("Internal testing release and reviewer account exist; production review not ready") &&
      source.readiness.includes("final reviewer access validation for the selected build") &&
      source.readiness.includes("final reviewer access validation for the selected release track") &&
      source.readiness.includes("Google Play closed-test tester opt-in/duration evidence if required") &&
      source.readiness.includes("build selection, reviewer test access, developer/legal entity, reviewer contact phone") &&
      source.readiness.includes("Do not store reviewer passwords, private phone numbers, account-owner data, or console identifiers in repo docs") &&
      source.dataSafetyPrep.includes("Google Play Data Safety must be current before closed testing, open testing, or production release") &&
      source.dataSafetyPrep.includes("Apps active only on Google Play internal testing are currently exempt") &&
      source.screenshotPrep.includes("Track each store asset set separately") &&
      source.storeListingDraft.includes("## Console-Ready Fields") &&
      source.storeListingDraft.includes("| Google Play short description | 80 characters | Tattoo community for artists, studios, vendors, collectors, and fans. |") &&
      source.storeListingDraft.includes("| App Store subtitle | 30 characters | Tattoo community hub |") &&
      source.storeListingDraft.includes("| App Store promotional text | 170 characters |") &&
      source.storeListingDraft.includes("| App Store keywords | 100 characters | tattoo,artists,studios,body art,merch,gigs,community,stories,DMs |") &&
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
