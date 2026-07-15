import { existsSync, readFileSync } from "node:fs";

const files = {
  appleDescription: "native/store-metadata/apple-app-store/en-US/description.txt",
  appleKeywords: "native/store-metadata/apple-app-store/en-US/keywords.txt",
  appleName: "native/store-metadata/apple-app-store/en-US/name.txt",
  appleSubtitle: "native/store-metadata/apple-app-store/en-US/subtitle.txt",
  googleDescription: "native/store-metadata/google-play/en-US/full-description.txt",
  googleShort: "native/store-metadata/google-play/en-US/short-description.txt",
  googleTitle: "native/store-metadata/google-play/en-US/title.txt",
  readme: "native/store-metadata/README.md",
};

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8").trim() : "");
const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]));
const allText = Object.values(source).join("\n").toLowerCase();

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
      source.appleKeywords.length <= 100,
  },
  {
    label: "store descriptions include launch safety position",
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
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} store metadata smoke check(s) failed.`);
  process.exit(1);
}
