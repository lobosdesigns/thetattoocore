import { readFileSync } from "node:fs";

const docs = {
  "docs/APP_STORE_READINESS.md": readFileSync("docs/APP_STORE_READINESS.md", "utf8"),
  "docs/PRODUCT_PLAN.md": readFileSync("docs/PRODUCT_PLAN.md", "utf8"),
  "docs/NATIVE_WRAPPER_PREP.md": readFileSync("docs/NATIVE_WRAPPER_PREP.md", "utf8"),
  "docs/MOBILE_APP_SUBMISSION_RUNBOOK.md": readFileSync(
    "docs/MOBILE_APP_SUBMISSION_RUNBOOK.md",
    "utf8",
  ),
  "docs/REAL_DEVICE_QA_CHECKLIST.md": readFileSync("docs/REAL_DEVICE_QA_CHECKLIST.md", "utf8"),
  "docs/PAYMENT_PRODUCTION_READINESS.md": readFileSync(
    "docs/PAYMENT_PRODUCTION_READINESS.md",
    "utf8",
  ),
  "docs/STORE_LISTING_DRAFT.md": readFileSync("docs/STORE_LISTING_DRAFT.md", "utf8"),
  "docs/SCREENSHOT_PREP.md": readFileSync("docs/SCREENSHOT_PREP.md", "utf8"),
  "docs/AGE_RATING_PREP.md": readFileSync("docs/AGE_RATING_PREP.md", "utf8"),
  "docs/DATA_SAFETY_PREP.md": readFileSync("docs/DATA_SAFETY_PREP.md", "utf8"),
};
const packageJson = readFileSync("package.json", "utf8");
const allDocs = Object.values(docs).join("\n");
const forbiddenContactSnippets = [
  "lobo3319@gmail.com",
  "lobosden@hotmail.com",
  "D@k0t",
  "Dakota",
  "Calder",
];
const forbiddenStoreListingProviderSnippets = [
  "Cloudflare",
  "Supabase",
  "HostGator",
  "Stripe",
  "service key",
  "service role",
];
const forbiddenSubmissionRunbookProviderSnippets = [
  "Cloudflare",
  "Supabase",
  "HostGator",
  "Stripe",
  "service-role",
  "service role",
];
const forbiddenStorePrepProviderSnippets = [
  "Cloudflare",
  "Supabase",
  "HostGator",
  "Stripe",
];

const checks = [
  {
    label: "readiness docs link native wrapper prep",
    ok:
      docs["docs/APP_STORE_READINESS.md"].includes("docs/NATIVE_WRAPPER_PREP.md") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("docs/NATIVE_WRAPPER_PREP.md"),
  },
  {
    label: "readiness docs link the real-device QA checklist",
    ok:
      docs["docs/APP_STORE_READINESS.md"].includes("docs/REAL_DEVICE_QA_CHECKLIST.md") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("docs/REAL_DEVICE_QA_CHECKLIST.md"),
  },
  {
    label: "readiness docs link data safety prep",
    ok:
      docs["docs/APP_STORE_READINESS.md"].includes("docs/DATA_SAFETY_PREP.md") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("docs/DATA_SAFETY_PREP.md"),
  },
  {
    label: "readiness docs link screenshot prep",
    ok:
      docs["docs/APP_STORE_READINESS.md"].includes("docs/SCREENSHOT_PREP.md") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("docs/SCREENSHOT_PREP.md") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("docs/SCREENSHOT_PREP.md"),
  },
  {
    label: "readiness docs link production payment gates",
    ok:
      docs["docs/APP_STORE_READINESS.md"].includes("docs/PAYMENT_PRODUCTION_READINESS.md") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes(
        "docs/PAYMENT_PRODUCTION_READINESS.md",
      ),
  },
  {
    label: "public readiness docs use company support contact",
    ok:
      allDocs.includes("support@thetattoocore.com") &&
      forbiddenContactSnippets.every((snippet) => !allDocs.includes(snippet)),
  },
  {
    label: "mobile submission runbook avoids visible provider names",
    ok: forbiddenSubmissionRunbookProviderSnippets.every(
      (snippet) => !docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes(snippet),
    ),
  },
  {
    label: "store listing draft includes launch safety stance",
    ok:
      docs["docs/STORE_LISTING_DRAFT.md"].includes("18+") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("visible nudity is not allowed") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("Temporary Stories") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("banner photo") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("No AI art") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("no scratcher promotion"),
  },
  {
    label: "store listing draft avoids visible provider names",
    ok: forbiddenStoreListingProviderSnippets.every(
      (snippet) => !docs["docs/STORE_LISTING_DRAFT.md"].includes(snippet),
    ),
  },
  {
    label: "native wrapper prep keeps app shell safe and minimal",
    ok:
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Start URL: `https://thetattoocore.com/login`") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Do not place private API keys") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Allowed Navigation") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Native Permissions") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("do not request precise device location") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("do not prompt on first open") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Store Review Safety") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Stories, Stuff, Gigs, Merch, and booking/deposit routes") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Story, Gossip, Stuff, Gigs, Merch, booking") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("docs/REAL_DEVICE_QA_CHECKLIST.md") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("docs/SCREENSHOT_PREP.md") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("raw payment or payout credentials"),
  },
  {
    label: "screenshot prep blocks private, unsafe, and technical visible content",
    ok:
      docs["docs/SCREENSHOT_PREP.md"].includes("Required Screenshot Set") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Do Not Capture") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("private DMs") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("license/certification documents") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("real payment data") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("infrastructure names") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("no-visible-nudity rules") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("no-AI stance"),
  },
  {
    label: "age rating prep avoids visible provider names",
    ok: forbiddenStorePrepProviderSnippets.every(
      (snippet) => !docs["docs/AGE_RATING_PREP.md"].includes(snippet),
    ),
  },
  {
    label: "age rating prep covers UGC, ads, commerce, AI, and no visible nudity",
    ok:
      docs["docs/AGE_RATING_PREP.md"].includes("User-generated content") &&
      docs["docs/AGE_RATING_PREP.md"].includes("Visible nudity is not allowed") &&
      docs["docs/AGE_RATING_PREP.md"].includes("Stories") &&
      docs["docs/AGE_RATING_PREP.md"].includes("Ads") &&
      docs["docs/AGE_RATING_PREP.md"].includes("Marketplace/commerce") &&
      docs["docs/AGE_RATING_PREP.md"].includes("AI"),
  },
  {
    label: "data safety prep covers launch data and privacy review areas",
    ok:
      docs["docs/DATA_SAFETY_PREP.md"].includes("Account data") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("User-generated content") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("direct messages") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("private verification/license documents") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Raw card, bank, routing, and payout credentials must not be collected") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("coarse location") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("account deletion requests") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("support@thetattoocore.com"),
  },
  {
    label: "real-device QA checklist covers launch-critical flows",
    ok:
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Create a new account") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("forgot-password") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("4U") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Use the image crop tools") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Story photo/GIF/short video") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("No active stories yet") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Gossip") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Stuff") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Gigs") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Merch") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("DM") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Attach a photo/GIF") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("DM access should come from the bottom DM shortcut") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("connected follower/following member's username") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("only the sent-message list scrolls") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("private profile connected by an accepted follow relationship") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("private Add to calendar download") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("verification") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Stripe test checkout") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm run smoke:public") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm run smoke:mobile") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("missing-detail fallback") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("No reload-loop screens"),
  },
  {
    label: "mobile submission runbook includes Stories and booking deposit QA",
    ok:
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("4U, Stories, Gossip") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("booking/deposit paths"),
  },
  {
    label: "product plan uses plain push and translation roadmap wording",
    ok:
      docs["docs/PRODUCT_PLAN.md"].includes("installed app push third") &&
      docs["docs/PRODUCT_PLAN.md"].includes("mobile app push for iOS and Android apps") &&
      docs["docs/PRODUCT_PLAN.md"].includes("vetted translation service") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("PWA browser push") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("installed-PWA") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("PWA web push") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("APNs") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("FCM") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("Firebase Cloud Messaging") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("provider-backed") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("payment-provider review") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("payment-provider rules") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("payment-provider review"),
  },
  {
    label: "product plan records final-phase help center and article comments",
    ok:
      docs["docs/PRODUCT_PLAN.md"].includes("## Help Center And Education") &&
      docs["docs/PRODUCT_PLAN.md"].includes("FAQ, how-to articles, and step-by-step tutorials") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Started for launch with public `/help`, `/help/[slug]` guide pages") &&
      docs["docs/PRODUCT_PLAN.md"].includes("screenshots, short clips where useful") &&
      docs["docs/PRODUCT_PLAN.md"].includes("setting appointments") &&
      docs["docs/PRODUCT_PLAN.md"].includes("creating ads") &&
      docs["docs/PRODUCT_PLAN.md"].includes("setting up Merch products") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Verification education") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Each Help Center article should support member comments") &&
      docs["docs/PRODUCT_PLAN.md"].includes("pin official answers") &&
      docs["docs/PRODUCT_PLAN.md"].includes("turn repeated questions into new FAQ entries"),
  },
  {
    label: "payment readiness doc keeps real-money gates explicit",
    ok:
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Stripe Checkout") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Stripe Connect") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Stripe-hosted onboarding") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("do not collect bank") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("tax handling") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("refund") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("dispute") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("app-store rules"),
  },
  {
    label: "readiness docs mention PWA asset and scaffold guards",
    ok:
      docs["docs/APP_STORE_READINESS.md"].includes("PWA smoke guards verify") &&
      docs["docs/APP_STORE_READINESS.md"].includes("removed scaffold asset URLs stay unavailable") &&
      docs["docs/APP_STORE_READINESS.md"].includes("photo/GIF attachments") &&
      docs["docs/APP_STORE_READINESS.md"].includes("participant-only `.ics` calendar downloads"),
  },
  {
    label: "full verification keeps focused DM guards in the chain",
    ok:
      packageJson.includes('"smoke:dm": "node scripts/smoke-dm-guards.mjs"') &&
      packageJson.includes("npm run smoke:stories && npm run smoke:dm && npm run smoke:booking") &&
      docs["docs/APP_STORE_READINESS.md"].includes("dedicated DM smoke guard suite"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} docs readiness smoke check(s) failed.`);
  process.exit(1);
}
