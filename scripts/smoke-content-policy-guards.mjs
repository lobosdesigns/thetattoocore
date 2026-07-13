import { readFileSync } from "node:fs";

const actions = readFileSync("src/app/actions.ts", "utf8");
const gigRoute = readFileSync("src/app/api/gigs/route.ts", "utf8");
const composer = readFileSync("src/app/floating-composer.tsx", "utf8");
const mediaInput = readFileSync("src/app/media-input.tsx", "utf8");
const sensitiveGate = readFileSync("src/app/sensitive-content-gate.tsx", "utf8");
const signupPage = readFileSync("src/app/signup/page.tsx", "utf8");
const accountProfileForm = readFileSync("src/app/account/profile-form.tsx", "utf8");
const termsPage = readFileSync("src/app/terms/page.tsx", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");

const memberUploadSource = [composer, mediaInput].join("\n");
const policyCopySource = [
  signupPage,
  accountProfileForm,
  termsPage,
  privacyPage,
  supportPage,
].join("\n");
const forbiddenMemberUploadSnippets = [
  'name="is_sensitive"',
  'name="sensitive_reason"',
  "Mark sensitive",
  "Sensitive upload",
  "body-art nudity context",
];

const checks = [
  {
    label: "server create actions default new uploads to non-sensitive",
    ok:
      actions.includes("function sensitiveFields()") &&
      actions.includes("visible nudity is not allowed") &&
      actions.includes("is_sensitive: false") &&
      actions.includes("sensitive_reason: null") &&
      actions.includes("const sensitive = sensitiveFields()") &&
      actions.includes("is_indexable: visibility === \"public_preview\" && !sensitive.is_sensitive"),
  },
  {
    label: "gigs API create path defaults new uploads to non-sensitive",
    ok:
      gigRoute.includes("const isSensitive = false") &&
      gigRoute.includes("const safeSensitiveReason = null") &&
      gigRoute.includes("is_indexable: visibility === \"public_preview\" && !isSensitive") &&
      gigRoute.includes("is_sensitive: isSensitive") &&
      gigRoute.includes("sensitive_reason: safeSensitiveReason"),
  },
  {
    label: "member upload forms do not expose sensitive or nudity bypass fields",
    ok: forbiddenMemberUploadSnippets.every(
      (snippet) => !memberUploadSource.includes(snippet),
    ),
  },
  {
    label: "member upload copy reinforces optimization and launch video limits",
    ok:
      mediaInput.includes("Phone photos are resized before upload.") &&
      mediaInput.includes("Video upload is intentionally capped for now. More video features are coming soon.") &&
      mediaInput.includes("MP4/MOV preferred") &&
      composer.includes("video/mp4,video/quicktime"),
  },
  {
    label: "sensitive legacy gate requires login or adult confirmation",
    ok:
      sensitiveGate.includes("You must sign in to see content") &&
      sensitiveGate.includes("Confirm 18+ to see content") &&
      sensitiveGate.includes("Sensitive non-nude body-art media requires login and 18+ confirmation.") &&
      sensitiveGate.includes("/login?return_to=") &&
      sensitiveGate.includes("acceptAdultTerms"),
  },
  {
    label: "public policy copy keeps no-visible-nudity launch stance",
    ok:
      policyCopySource.includes("No visible nudity") &&
      policyCopySource.includes("No visible nudity for launch") &&
      policyCopySource.includes("visible nudity is not allowed") &&
      policyCopySource.includes("crop or cover") &&
      policyCopySource.includes("Pornography") &&
      policyCopySource.includes("sexual solicitation"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} content policy guard smoke check(s) failed.`);
  process.exit(1);
}
