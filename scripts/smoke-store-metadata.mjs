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
  readme: "native/store-metadata/README.md",
  screenshotInventory: "native/store-metadata/screenshot-inventory.md",
};

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8").trim() : "");
const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]));
const allText = Object.values(source).join("\n").toLowerCase();

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
    ok: blockedTerms.every((term) => !allText.includes(term)),
  },
  {
    label: "store screenshot inventory blocks unsafe review images",
    ok:
      source.screenshotInventory.includes("public/screenshots/mobile-home.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-login-signup.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-stories-safe.png") &&
      source.screenshotInventory.includes("public/screenshots/mobile-help-support.png") &&
      source.screenshotInventory.includes("Replace generated placeholders with final real-device screenshots") &&
      source.screenshotInventory.includes("4U, Gossip, Stuff, Gigs, and Merch") &&
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
      hasExpectedPngs(generatedScreenshots.playPhone, 7, 1080, 1920) &&
      hasExpectedPngs(generatedScreenshots.playFeature, 1, 1024, 500),
  },
  {
    label: "generated App Store screenshots match upload dimensions",
    ok:
      hasExpectedPngs(generatedScreenshots.appStorePhone, 7, 1242, 2688) &&
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
