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
  "docs/LEGAL_REVIEW_PREP.md": readFileSync("docs/LEGAL_REVIEW_PREP.md", "utf8"),
};
const packageJson = readFileSync("package.json", "utf8");
const screenshotGenerator = readFileSync("scripts/generate-safe-store-screenshots.mjs", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");
const helpArticlePage = readFileSync("src/app/help/[slug]/page.tsx", "utf8");
const helpCenterData = readFileSync("src/lib/help-center.ts", "utf8");
const helpSearch = readFileSync("src/app/help/help-center-search.tsx", "utf8");
const helpActions = readFileSync("src/app/help/actions.ts", "utf8");
const adminActions = readFileSync("src/app/admin/actions.ts", "utf8");
const adminContentPage = readFileSync("src/app/admin/content/page.tsx", "utf8");
const adminReportsPage = readFileSync("src/app/admin/reports/page.tsx", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const helpCommentsMigration = readFileSync(
  "supabase/migrations/20260715232157_help_article_comments.sql",
  "utf8",
);
const helpCommentReportsMigration = readFileSync(
  "supabase/migrations/20260717004733_add_help_comment_report_subject.sql",
  "utf8",
);
const contentReportForm = readFileSync("src/app/content-report-form.tsx", "utf8");
const mainActions = readFileSync("src/app/actions.ts", "utf8");
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
    label: "readiness docs link final legal review prep",
    ok:
      docs["docs/APP_STORE_READINESS.md"].includes("docs/LEGAL_REVIEW_PREP.md") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("docs/LEGAL_REVIEW_PREP.md"),
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
      docs["docs/STORE_LISTING_DRAFT.md"].includes("Help Center") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("No AI art") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("no scratcher promotion") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("review-controlled checkout") &&
      !docs["docs/STORE_LISTING_DRAFT.md"].includes("hosted checkout"),
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
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("August 31, 2026") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Android 16 / API 36") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("target Android 16 / API 36") &&
      docs["docs/APP_STORE_READINESS.md"].includes("targetSdkVersion` set to 36") &&
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
      docs["docs/SCREENSHOT_PREP.md"].includes("no-AI stance") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("## Upload Validation Evidence") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Track each store asset set separately") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("| Google Play phone screenshots | Release track, version") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("| Google Play feature graphic | Uploaded feature graphic") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("| App Store iPhone 6.5-inch screenshots | iOS build/version") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("| App Store 13-inch iPad screenshots | iOS build/version") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Apple App Store Connect: record the uploaded iPhone 6.5-inch set") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("13-inch iPad set") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Google Play Console: record the uploaded phone screenshot set") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("feature graphic") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("matches the submitted build after final metadata") &&
      screenshotGenerator.includes("mobile-login-signup.png") &&
      screenshotGenerator.includes("mobile-help-support.png") &&
      screenshotGenerator.includes("Visible nudity is not allowed"),
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
      docs["docs/AGE_RATING_PREP.md"].includes("AI") &&
      docs["docs/AGE_RATING_PREP.md"].includes("Social media capability questions") &&
      docs["docs/AGE_RATING_PREP.md"].includes("not a dating app") &&
      docs["docs/AGE_RATING_PREP.md"].includes("not invite-only") &&
      docs["docs/AGE_RATING_PREP.md"].includes("Apple's current age-rating social media capability questions") &&
      docs["docs/AGE_RATING_PREP.md"].includes("Google Play App content answers") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Social, no dating/sexual-relationship purpose") &&
      docs["docs/APP_STORE_READINESS.md"].includes("no precise location sharing") &&
      docs["docs/APP_STORE_READINESS.md"].includes("yes blocking, yes reporting, yes chat moderation") &&
      docs["docs/APP_STORE_READINESS.md"].includes("no invited-friends-only limitation"),
  },
  {
    label: "data safety prep covers current data and privacy review areas",
    ok:
      docs["docs/DATA_SAFETY_PREP.md"].includes("Account data") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("User-generated content") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("direct messages") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Help Center questions") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("private verification/license documents") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Raw card, bank, routing, and payout credentials must not be collected") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("coarse location") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("account deletion requests") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Google Play Data Safety must be completed before closed testing, open testing, or production release") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("internal testing are currently exempt from Data Safety section inclusion") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("internal-only exemption note, closed/open testing if used, and production") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("support@thetattoocore.com") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("## App Store Privacy Evidence") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("reviewed against the submitted iOS build") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Privacy URL `https://thetattoocore.com/privacy`") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("do not infer tracking from the iOS native privacy manifest alone") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("final App Privacy console summary"),
  },
  {
    label: "legal review prep covers final policy and release signoff evidence",
    ok:
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Terms and Content Policy") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("no visible nudity") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("no AI art/search claims") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Account deletion") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("seller payout timing") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("refund/dispute handling") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Native app review") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Store submissions") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Do not store reviewer passwords") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Public URLs reviewed") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("block release, allow internal testing only, allow public release") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Production commerce remains gated"),
  },
  {
    label: "real-device QA checklist covers app-critical flows",
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
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("controlled launch checkout") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run smoke:public") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run smoke:mobile") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Google Play internal testing track") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("TestFlight group") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("one actual iPhone/TestFlight device for release evidence") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("iPhone-sized browser viewport is useful for layout scouting only") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Open Admin > Media Ops") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Beta QA launch checklist") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("support/help/legal") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("beta app testing guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Search/Saved guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("privacy/safety/support guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Booking guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("deposit confirmation") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Ads guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Merch-only ads") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Merch guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("private buyer shipping details") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Order Support guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Verification guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("unlocked tools") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("missing-detail fallback") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("No reload-loop screens") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Evidence Pack Template") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("App build or web deploy version") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Native install source") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("release track, version, and build number") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("second known account for two-user DM read/reply checks") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Repo-safe two-user DM evidence should record only tester aliases") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Keep email addresses, passwords, one-time codes, private message bodies") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Screenshot or clip filename") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Console/log review result for web browser, Android wrapper WebView, and iOS TestFlight") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("keep raw logs, stack traces with account data, device identifiers, and console screenshots in the private handoff") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Browser/device console check showing no uncaught app errors") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Android internal-testing install proof") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("iOS TestFlight install proof") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Android and iOS login/signup/reset staying inside the app") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Admin Payments review evidence using safe test references") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Native Build And Install Evidence Matrix") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("| Android | Google Play internal testing | Version name, version code") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("| iOS | TestFlight internal testing | iOS version/build number") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("release channel, version/build, date, device model, and pass/fail status") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Native build/install evidence should use the matrix") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("release channel, version/build, install source, tester account pair") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Record a safe console/log review summary for mobile web, Android wrapper WebView, and iOS TestFlight"),
  },
  {
    label: "mobile submission runbook includes Stories, help, and booking deposit QA",
    ok:
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("4U, Stories, Gossip") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("booking/deposit paths") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run smoke:mobile") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("support/help/legal routes") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Search/Saved, Booking, Ads, Merch, Verification") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("privacy/safety Help Center guides") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("/help/beta-app-testing") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Merch guide shortcut") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("seller payout setup details"),
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
      docs["docs/PRODUCT_PLAN.md"].includes("getting-started guide") &&
      docs["docs/PRODUCT_PLAN.md"].includes("screenshots, short clips where useful") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Help Center needs a media pass before broader beta") &&
      docs["docs/PRODUCT_PLAN.md"].includes("setting appointments") &&
      docs["docs/PRODUCT_PLAN.md"].includes("creating ads") &&
      docs["docs/PRODUCT_PLAN.md"].includes("setting up Merch products") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Verification education") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Each Help Center article should support member comments") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Started for launch with RLS-protected `help_article_comments`") &&
      docs["docs/PRODUCT_PLAN.md"].includes("pin official answers") &&
      docs["docs/PRODUCT_PLAN.md"].includes("turn repeated questions into new FAQ entries") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Admin > Content Help review") &&
      docs["docs/PRODUCT_PLAN.md"].includes("beta tester checklist guide"),
  },
  {
    label: "help center has a first-run guide and avoids roadmap-style support copy",
    ok:
      helpArticlePage.includes("Visual walkthroughs avoid private messages") &&
      helpArticlePage.includes("Safe capture plan") &&
      helpArticlePage.includes("Capture with safe sample content only.") &&
      helpArticlePage.includes("No visual walkthrough is queued") &&
      helpArticlePage.includes("const tutorialMedia = article.tutorialMedia ?? []") &&
      helpArticlePage.includes('"assetSrc" in item && typeof item.assetSrc === "string"') &&
      helpArticlePage.includes('item.kind === "short_clip" ? "Short video" : "Screenshot"') &&
      helpArticlePage.includes('item.kind === "screenshot" && assetSrc') &&
      helpArticlePage.includes('item.kind === "short_clip" && assetSrc') &&
      helpArticlePage.includes('controlsList="nodownload"') &&
      helpArticlePage.includes('preload="metadata"') &&
      helpArticlePage.includes("safe tutorial screenshot") &&
      helpArticlePage.includes("ask a guide question") &&
      helpActions.includes("Question submitted for moderation.") &&
      helpCenterData.includes('slug: "getting-started"') &&
      helpCenterData.includes('slug: "beta-tester-checklist"') &&
      helpCenterData.includes('slug: "beta-app-testing"') &&
      helpCenterData.includes("Getting started on TheTattooCore") &&
      helpCenterData.includes("Beta tester checklist") &&
      helpCenterData.includes("How to test the beta app") &&
      helpCenterData.includes("App wrapper navigation pass") &&
      helpCenterData.includes("tutorialMedia") &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-login-signup.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-help-support.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-profile-search.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-verification-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-booking-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-4u-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-stories-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-gossip-safe.png"') &&
      helpCenterData.includes("Privacy and support controls") &&
      helpCenterData.includes("Signup to first Settings save") &&
      helpCenterData.includes("Admin beta go/no-go") &&
      helpCenterData.includes("Two-user DM and notification pass") &&
      helpCenterData.includes("Booking request to calendar") &&
      helpCenterData.includes("Booking setup sections") &&
      helpCenterData.includes("Verification form basics") &&
      helpCenterData.includes("Merch product setup") &&
      helpCenterData.includes('slug: "order-refunds-disputes"') &&
      helpCenterData.includes("Order support, refunds, and disputes") &&
      helpCenterData.includes("What happens if there is a dispute?") &&
      helpCenterData.includes("Buyer order support path") &&
      helpCenterData.includes("Seller payouts and payment safety") &&
      helpCenterData.includes("Should I send payout details to support?") &&
      helpCenterData.includes("Stories rail preview") &&
      helpCenterData.includes("Gossip discussion preview") &&
      helpCenterData.includes("Stories, DMs, and safety controls") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("getting-started guide") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("Launch setup checklist") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("launchGuideScreenshotSlots") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("launchGuideClipSlots") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("short-clip slots") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("Tutorial capture queue") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("Screenshot and short-video priorities") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("Safe sample accounts only") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("Merch and payouts") &&
      helpSearch.includes("Search getting started, beta app, bookings") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("launchGuideSlugs") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes('"beta-tester-checklist"') &&
      readFileSync("src/app/help/page.tsx", "utf8").includes('"beta-app-testing"') &&
      readFileSync("src/app/help/page.tsx", "utf8").includes('"order-refunds-disputes"') &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("screenshots /") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes("short clips") &&
      readFileSync("src/app/admin/media-ops/page.tsx", "utf8").includes("/help/beta-tester-checklist") &&
      helpSearch.includes("helpSearchAliases") &&
      helpSearch.includes("matchesSearch") &&
      helpSearch.includes("tattooer") &&
      helpSearch.includes("guestspots") &&
      helpSearch.includes("shirts") &&
      helpSearch.includes("bookmarks") &&
      helpSearch.includes("favorites") &&
      helpSearch.includes("appointments") &&
      helpSearch.includes("harassment") &&
      helpSearch.includes("unblock") &&
      helpSearch.includes("caption") &&
      helpSearch.includes("spam") &&
      helpSearch.includes("badge") &&
      helpSearch.includes("denied") &&
      helpSearch.includes("article.slug") &&
      helpSearch.includes("article.keywords") &&
      helpSearch.includes("article.relatedSlugs") &&
      helpCenterData.includes("payout setup") &&
      helpCenterData.includes("google calendar") &&
      helpCenterData.includes("shop link") &&
      helpCenterData.includes("How do I find saved things again?") &&
      helpCenterData.includes("saved items") &&
      helpCenterData.includes("What does blocking do?") &&
      helpCenterData.includes("blocked profiles") &&
      helpCenterData.includes("How should I use replies and DMs?") &&
      helpCenterData.includes("Story replies") &&
      helpCenterData.includes("verified badge") &&
      helpCenterData.includes("business docs") &&
      helpSearch.includes("payout") &&
      helpSearch.includes("chargeback") &&
      helpSearch.includes("merchant") &&
      helpSearch.includes("package") &&
      helpSearch.includes("shipping") &&
      helpSearch.includes("wrong") &&
      helpSearch.includes("overflow") &&
      helpSearch.includes("password") &&
      helpSearch.includes("screenshot") &&
      helpSearch.includes("webview") &&
      helpSearch.includes("outside browser") &&
      helpCenterData.includes("bug report") &&
      helpCenterData.includes("What if a beta link opens outside the app?") &&
      helpCenterData.includes("confirmation link") &&
      helpCenterData.includes("safe screenshot") &&
      docs["docs/PRODUCT_PLAN.md"].includes("structured article keywords") &&
      readFileSync("src/app/help/page.tsx", "utf8").includes(
        "Signed-in members can ask deeper questions",
      ) &&
      !readFileSync("src/app/help/page.tsx", "utf8").includes("will grow into") &&
      !readFileSync("src/app/help/page.tsx", "utf8").includes("will support"),
  },
  {
    label: "help center is discoverable from signed-in app surfaces",
    ok:
      accountPage.includes("<AccountSettingsWorkspace tabs={accountWorkspaceTabs}>") &&
      accountPage.includes("Data and help") &&
      accountPage.includes("Open Help Center") &&
      readFileSync("src/app/page.tsx", "utf8").includes('[CircleHelp, "Help", "/help"]') &&
      accountPage.includes("/help/seller-payouts-payment-safety") &&
      accountPage.includes("Set things up without waiting on support") &&
      adminPage.includes('[CircleHelp, "Help", "/help"]') &&
      adminPage.includes('action: "Open Help"') &&
      adminPage.includes("Self-serve tutorials and guide questions") &&
      supportPage.includes("Launch setup checklist") &&
      supportPage.includes("beta app testing") &&
      supportPage.includes("Priority setup guides for profile") &&
      supportPage.includes('href: "/help/beta-app-testing"') &&
      supportPage.includes('href: "/help/merch-products-orders"') &&
      supportPage.includes('href: "/help/seller-payouts-payment-safety"') &&
      supportPage.includes("Product review, seller readiness") &&
      supportPage.includes("Seller payout setup") &&
      profilePage.includes('href="/help/artist-profile-shop-links"') &&
      profilePage.includes('aria-label="Open profile help"') &&
      docs["docs/PRODUCT_PLAN.md"].includes("Help must be easy to find while logged in") &&
      docs["docs/PRODUCT_PLAN.md"].includes(
        "direct Help links from Settings, profile headers, and Admin",
      ),
  },
  {
    label: "help article questions have schema, RLS, and signed-in submit flow",
    ok:
      helpCommentsMigration.includes("create table if not exists public.help_article_comments") &&
      helpCommentsMigration.includes("alter table public.help_article_comments enable row level security") &&
      helpCommentsMigration.includes("Visible help comments are public") &&
      helpCommentsMigration.includes("Members can submit help comments") &&
      helpCommentsMigration.includes("Moderators can update help comments") &&
      helpCommentsMigration.includes("status = 'pending_review'") &&
      helpArticlePage.includes("const commentPageSize = 25") &&
      helpArticlePage.includes("commentFetchLimit") &&
      helpArticlePage.includes("hasMoreComments") &&
      helpArticlePage.includes("createHelpArticleComment") &&
      helpArticlePage.includes("Guide Questions") &&
      helpArticlePage.includes("Load more questions") &&
      helpArticlePage.includes("Submit question") &&
      helpArticlePage.includes("help_article_comments") &&
      helpArticlePage.includes("ContentReportForm") &&
      helpArticlePage.includes('subjectType="help_article_comment"') &&
      helpActions.includes("getHelpArticle(slug)") &&
      helpActions.includes("Please wait a moment before submitting another guide question.") &&
      helpActions.includes("status: \"pending_review\"") &&
      helpActions.includes("Question submitted for moderation."),
  },
  {
    label: "help article questions have admin moderation controls",
    ok:
      adminContentPage.includes("[\"help_article_comment\", \"Help\"]") &&
      adminContentPage.includes("HelpQuestionCard") &&
      adminContentPage.includes("moderateHelpArticleComment") &&
      adminContentPage.includes("Official answer") &&
      adminContentPage.includes("Pin on guide") &&
      adminActions.includes("export async function moderateHelpArticleComment") &&
      adminActions.includes("help_comment_${status}") &&
      adminActions.includes("target_type: \"help_article_comment\"") &&
      adminActions.includes("revalidatePath(helpArticlePath(comment.article_slug))"),
  },
  {
    label: "help guide questions can be reported for moderation",
    ok:
      helpCommentReportsMigration.includes(
        "alter type public.report_subject_type add value if not exists 'help_article_comment'",
      ) &&
      contentReportForm.includes("Report guide question") &&
      contentReportForm.includes("help_article_comment") &&
      mainActions.includes('"help_article_comment"') &&
      mainActions.includes('table: "help_article_comments"') &&
      adminContentPage.includes("HelpQuestionCard") &&
      adminReportsPage.includes('reportSubjectIds("help_article_comment")') &&
      adminReportsPage.includes('reportSubjectKey("help_article_comment"'),
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
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("app-store rules") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Draft Seller Payout Release Policy") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Draft Shipping And Tax Procedure") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Draft Refund And Dispute Procedure") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Draft Booking Deposit Procedure") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("## Production Evidence Pack") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Live webhook event list captured and matched to the app-required event set") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Live/test mode setting, server payment key mode, and webhook mode reviewed together") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Penny test receipt captured for one approved flow after policy review") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Delayed or async payment success reconciliation captured before fulfillment, ad delivery, booking closeout, or seller payout release.") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Seller payout policy approval recorded with payout timing") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Native app policy review recorded before exposing checkout in native wrappers") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Support, Terms, Privacy, and Help copy checked against the live build") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Repo-safe summary fields are limited to release candidate") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Admin > Payments reconciliation result") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Keep payment intent IDs, checkout session IDs") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("raw console exports in the private release handoff only") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("buyer shipping addresses private") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Only verified artists and studios should request deposits"),
  },
  {
    label: "real-device QA covers admin payment and Merch search",
    ok:
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("In Admin > Payments, search by a safe test payment/event reference") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("webhook receipts, payment audit rows, and booking deposits remain paginated and filterable") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("In Admin > Merch, search by a product/order/customer/payment reference") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("product and order queues remain paginated and filterable"),
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
    label: "readiness docs keep final submission blockers explicit",
    ok:
      docs["docs/APP_STORE_READINESS.md"].includes("## Submission Blocker Matrix") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Store consoles") &&
      docs["docs/APP_STORE_READINESS.md"].includes("13-inch iPad screenshot upload") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Content Rights") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Data Safety review") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Legal and policy") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Final counsel-reviewed Terms/Privacy") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Real-device QA") &&
      docs["docs/APP_STORE_READINESS.md"].includes("full two-user DM read/reply pass") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Payments and payouts") &&
      docs["docs/APP_STORE_READINESS.md"].includes("small live-payment test after review") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Native wrapper") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Android API 36") &&
      docs["docs/APP_STORE_READINESS.md"].includes("app-link association files"),
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
