import { existsSync, readFileSync, statSync } from "node:fs";

const docs = {
  "README.md": readFileSync("README.md", "utf8"),
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
  "native/thetattoocore-mobile/README.md": readFileSync(
    "native/thetattoocore-mobile/README.md",
    "utf8",
  ),
};
const packageJson = readFileSync("package.json", "utf8");
const screenshotGenerator = readFileSync("scripts/generate-safe-store-screenshots.mjs", "utf8");
const androidDeviceProbe = readFileSync("scripts/android-device-qa-probe.mjs", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");
const helpArticlePage = readFileSync("src/app/help/[slug]/page.tsx", "utf8");
const helpCenterData = readFileSync("src/lib/help-center.ts", "utf8");
const helpShortClipBlocks = [...helpCenterData.matchAll(/\{[^{}]*kind: "short_clip"[^{}]*\}/gs)].map(
  ([block]) => block,
);
const helpTutorialAssetPaths = [
  ...new Set(
    [...helpCenterData.matchAll(/assetSrc: "(\/(?:screenshots|tutorial-clips)\/[^"]+)"/g)].map(
      ([, assetSrc]) => `public${assetSrc}`,
    ),
  ),
];
const isNonEmptyHelpTutorialAsset = (assetPath) => {
  return describeHelpTutorialAssetIssue(assetPath) === "";
};

const describeHelpTutorialAssetIssue = (assetPath) => {
  if (!existsSync(assetPath)) {
    return `${assetPath} is missing`;
  }

  const minimumSize = assetPath.endsWith(".mp4") ? 50_000 : 10_000;
  const size = statSync(assetPath).size;

  if (size <= minimumSize) {
    return `${assetPath} is ${size} bytes; expected more than ${minimumSize}`;
  }

  return "";
};

const describeHelpTutorialAssetIssues = () => {
  const shortClipBlocksWithoutAssets = helpShortClipBlocks
    .map((block, index) => ({ block, index: index + 1 }))
    .filter(({ block }) => !block.includes("assetSrc:"))
    .map(({ index }) => `short_clip block ${index} is missing assetSrc`);
  const assetIssues = helpTutorialAssetPaths.map(describeHelpTutorialAssetIssue).filter(Boolean);

  return [...shortClipBlocksWithoutAssets, ...assetIssues].join("; ");
};
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
const safeTutorialClipPath = "public/tutorial-clips/mobile-main-navigation-safe.mp4";
const safeStoriesDmsClipPath = "public/tutorial-clips/mobile-stories-dms-safety-safe.mp4";
const safeDmNotificationClipPath = "public/tutorial-clips/mobile-dm-notification-pass-safe.mp4";
const safeMerchFulfillmentClipPath = "public/tutorial-clips/mobile-merch-fulfillment-safe.mp4";
const safeBookingCalendarClipPath = "public/tutorial-clips/mobile-booking-calendar-safe.mp4";
const safeVerificationReviewClipPath = "public/tutorial-clips/mobile-verification-review-safe.mp4";
const safeAdsCreditsClipPath = "public/tutorial-clips/mobile-ads-credits-safe.mp4";
const safeOrderRefundClipPath = "public/tutorial-clips/mobile-order-refund-review-safe.mp4";
const safePaymentSafetyClipPath = "public/tutorial-clips/mobile-payment-safety-safe.mp4";
const safeAppWrapperClipPath = "public/tutorial-clips/mobile-app-wrapper-navigation-safe.mp4";
const safeProfilePhotoClipPath = "public/tutorial-clips/mobile-profile-photo-banner-safe.mp4";
const safePrivacyScreenshotPath = "public/screenshots/mobile-privacy-safety-safe.png";
const safeMerchShortcutScreenshotPath = "public/screenshots/mobile-merch-help-shortcut-safe.png";
const forbiddenContactSnippets = [
  "lobo3319@gmail.com",
  "lobosden@hotmail.com",
  "D@k0t",
  "Dakota",
  "Calder",
];
const forbiddenStoreListingProviderSnippets = [
  "Cloudflare",
  "Cloud Messaging",
  "FCM",
  "Firebase",
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
const forbiddenRepoReviewerEmailPattern = /\breviewer@[a-z0-9._%+-]+\.[a-z]{2,}\b/i;
const nativePushReadyClaimPattern =
  /\bnative push (is )?(live|enabled|ready|supported|available)\b/i;
const repoSafeSubmissionDocsText = [
  docs["docs/APP_STORE_READINESS.md"],
  docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"],
  docs["docs/NATIVE_WRAPPER_PREP.md"],
].join("\n");

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
    label: "repo readiness docs keep reviewer emails private",
    ok: !forbiddenRepoReviewerEmailPattern.test(docs["docs/APP_STORE_READINESS.md"]),
  },
  {
    label: "top-level README uses Windows npm commands for local release work",
    ok:
      docs["README.md"].includes("npm.cmd run dev") &&
      docs["README.md"].includes("npm.cmd run verify") &&
      docs["README.md"].includes("npm.cmd run deploy") &&
      !docs["README.md"].includes("npm run deploy") &&
      !docs["README.md"].includes("npm run verify"),
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
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("checked-in Android wrapper now targets API 36") &&
      docs["docs/APP_STORE_READINESS.md"].includes("targetSdkVersion` set to 36") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("do not request precise device location") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("do not prompt on first open") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Store Review Safety") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Stories, Stuff, Gigs, Merch, and booking/deposit routes") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Story, Gossip, Stuff, Gigs, Merch, booking") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("docs/REAL_DEVICE_QA_CHECKLIST.md") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("docs/SCREENSHOT_PREP.md") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("raw payment or payout credentials") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("review-controlled checkout flow") &&
      !docs["docs/NATIVE_WRAPPER_PREP.md"].includes("hosted checkout"),
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
      docs["docs/SCREENSHOT_PREP.md"].includes("## Private Upload Validation Packet") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Use one private packet per release candidate") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("`pending`, `uploaded`, `needs replacement`, `blocked`, or `validated`") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Store surface and asset set") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Submitted build or release track") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Console validation result, rejection category if any") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("dimensions, file count, no-alpha output") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("generated draft screenshots were replaced or explicitly re-captured") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("Keep raw console screenshots") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("store-dashboard IDs in the private handoff only") &&
      screenshotGenerator.includes("mobile-login-signup.png") &&
      screenshotGenerator.includes("mobile-ads-safe.png") &&
      screenshotGenerator.includes("mobile-merch-safe.png") &&
      screenshotGenerator.includes("mobile-payout-safe.png") &&
      screenshotGenerator.includes("mobile-order-support-safe.png") &&
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
      docs["docs/AGE_RATING_PREP.md"].includes("payment-policy") &&
      !docs["docs/AGE_RATING_PREP.md"].includes("payment-provider") &&
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
      docs["docs/DATA_SAFETY_PREP.md"].includes("password handled by the account sign-in system") &&
      !docs["docs/DATA_SAFETY_PREP.md"].includes("auth provider") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("private verification/license documents") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Raw card, bank, routing, and payout credentials must not be collected") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("approved review-controlled checkout flows") &&
      !docs["docs/DATA_SAFETY_PREP.md"].includes("hosted payment-provider flows") &&
      !docs["docs/DATA_SAFETY_PREP.md"].includes("payment-provider reviews") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("coarse location") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("account deletion requests") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Google Play Data Safety must be current before closed testing, open testing, or production release") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("internal testing are currently exempt from public Data Safety section inclusion") &&
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
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Accessibility Nutrition Labels") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Do not store reviewer passwords") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Public URLs reviewed") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("block release, allow internal testing only, allow public release") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Production commerce remains gated") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("## Submission Signoff Matrix") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("exact build, release track, and web deploy") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Public legal URLs") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("account deletion request path match the submitted build") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Account deletion and retention") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Deletion SLA, manual review owner, retention exceptions") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("UGC and safety policy") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("report/block tools, moderation escalation") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Store questionnaires") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("App Privacy/Data Safety, age/content rating, Accessibility Nutrition Labels") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Commerce and payments") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("native payment-policy classification") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Evidence privacy") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Reviewer credentials, phone details, console screenshots, payment identifiers"),
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
      packageJson.includes('"smoke:mobile:ios": "set SMOKE_MOBILE_PROFILE=ios&& node scripts/smoke-mobile-browser.mjs"') &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run smoke:mobile:ios") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("iPhone Safari-shaped scouting pass") &&
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
      packageJson.includes('"prepare:private-release-handoff": "node scripts/generate-private-release-handoff.mjs"') &&
      packageJson.includes('"smoke:handoff": "node scripts/smoke-private-handoff-template.mjs"') &&
      packageJson.includes("npm run smoke:native && npm run smoke:handoff && npm run smoke:docs") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run prepare:private-release-handoff") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run prepare:private-release-handoff") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("private-release-handoff/") &&
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
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Accessibility Nutrition Labels proof") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("VoiceOver, Voice Control, Larger Text") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Accessibility Nutrition Labels Evidence Matrix") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("| Common task | VoiceOver | Voice Control | Larger Text | Differentiate Without Color Alone | Sufficient Contrast | Reduced Motion | Captions | Audio Descriptions | Repo-safe note |") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Sign up, log in, reset password, and open Help/Support/legal links.") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Repo-safe accessibility summary fields are limited to release candidate") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Native Build And Install Evidence Matrix") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("| Android | Google Play internal testing or closed testing if production access requires it.") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("12-tester participation, 14-day duration, feedback summary") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("| iOS | TestFlight internal testing | iOS version/build number") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("release channel, version/build, date, device model, and pass/fail status") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("manual evidence only:") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("automation unavailable") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("platform tools or `adb` missing from Windows PATH") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Do not treat missing automation as a") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Android Connected-Device Probe") &&
      packageJson.includes('"verify:native-predevice": "npm run smoke:env && npm run smoke:native && npm run smoke:handoff && npm run smoke:docs && npm run smoke:store && npm run smoke:mobile && npm run smoke:mobile:ios"') &&
      packageJson.includes('"verify:native-release": "npm run smoke:env && npm run smoke:native && npm run smoke:handoff && npm run smoke:docs && npm run qa:android-device:required && npm run smoke:store && npm run smoke:mobile && npm run smoke:mobile:ios"') &&
      packageJson.includes('"qa:android-device": "node scripts/android-device-qa-probe.mjs"') &&
      packageJson.includes('"qa:android-device:required": "node scripts/android-device-qa-probe.mjs --require-device --wait-ms=30000"') &&
      packageJson.includes("npm run smoke:native && npm run qa:android-device && npm run smoke:store") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run qa:android-device") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run qa:android-device:required") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("waits briefly for the USB/debug authorization state to settle") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run verify:native-predevice") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run verify:native-release") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("pre-device native readiness scout") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("environment guard") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("native wrapper guard") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("expected to fail while no authorized Android device") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("platform-tools\\adb.exe") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("adb start-server") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("adb devices -l") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("authorized") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("dumpsys package com.thetattoocore.app") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("https://thetattoocore.com/login") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Android automation not yet available") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("passing Android console/log review") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Native build/install evidence should use the matrix") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("release channel, version/build, install source, tester account pair") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("at least 12 testers opted in for 14 continuous days") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Record a safe console/log review summary for mobile web, Android wrapper WebView, and iOS TestFlight") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("run the `Android Connected-Device Probe`") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Empty or unauthorized `adb devices -l` output is a handoff blocker") &&
      packageJson.includes('"verify:app-review-preflight": "npm run lint && npm run build && npm run smoke:env && npm run smoke:security && npm run smoke:content && npm run smoke:theme && npm run smoke:payments && npm run smoke:store && npm run smoke:pwa && npm run smoke:native && npm run qa:android-device && npm run smoke:handoff && npm run smoke:docs && npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:ios"') &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run verify:app-review-preflight") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("It checks lint, production build, production environment boundaries") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("content-policy/reporting guardrails") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("the repo-safe Android connected-device probe") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("without counting as real-device or private console evidence") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run verify:native-predevice") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run verify:native-release") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("without counting as real-device evidence") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("checks environment boundaries, private native config exclusions, private handoff-template validation, and readiness docs first") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("intentionally fails until the Android probe sees an authorized device") &&
      docs["native/thetattoocore-mobile/README.md"].includes("npm.cmd run verify:native-predevice") &&
      docs["native/thetattoocore-mobile/README.md"].includes("Use the pre-device command to check environment boundaries") &&
      docs["native/thetattoocore-mobile/README.md"].includes("The release command checks the same starting gates first") &&
      docs["native/thetattoocore-mobile/README.md"].includes("%LOCALAPPDATA%\\Android\\Sdk\\platform-tools\\adb.exe") &&
      docs["native/thetattoocore-mobile/README.md"].includes("ANDROID_QA adb_server=started") &&
      docs["native/thetattoocore-mobile/README.md"].includes("ANDROID_QA adb_server=start failed") &&
      docs["native/thetattoocore-mobile/README.md"].includes("waits briefly for USB/debug authorization") &&
      docs["native/thetattoocore-mobile/README.md"].includes("authorized device") &&
      docs["native/thetattoocore-mobile/README.md"].includes("Play testing release under review"),
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
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("seller payout setup details") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Accessibility Nutrition Labels") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("VoiceOver, Voice Control, Larger Text") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("review-controlled checkout") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("checkout-return handling") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("## Final Store-Console Evidence") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Build selection | Apple build number, Google release track") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Reviewer account | Reviewer test account email") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Final reviewer access | Selected Apple build and Google release track") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("`validated for selected build/track`") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Contact details | Support email, support URL, privacy URL") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Screenshot upload | App Store iPhone/iPad validation") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Category and pricing | App Store categories, Google Play category") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Content rights | Confirmation that icons, generated screenshots") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Privacy and data safety | App Privacy, Google Data Safety") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Age/content rating | App Store age rating, Google Play/IARC summary") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Accessibility Nutrition Labels | VoiceOver, Voice Control, Larger Text") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Google Play closed testing | Tester list or Google Group selection") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Final validation | Console errors cleared") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("## Reviewer Notes Template") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("TheTattooCore is an 18+ body-art community app") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Visible nudity is not allowed") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Email: [enter reviewer account email in console only]") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Password: [enter reviewer password in console only]") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Reporting, blocking, private-account controls") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Checkout and seller payout release remain gated") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("never commit passwords, access codes, private phone details, or one-time codes") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("do not store private phone numbers or owner personal contact data") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("do not commit store-console screenshots with private account data") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("keep tester emails, group membership, console screenshots, and application answers private") &&
      !docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("hosted checkout"),
  },
  {
    label: "mobile submission runbook records current store rules check",
    ok:
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("## Current Store Rules Check") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Last checked: July 21, 2026") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple App Privacy: privacy policy URL is required") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple Content Rights") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("one iPhone screenshot") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("current App Store Connect help") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("2064 x 2752 or 2048 x 2732") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple Accessibility Nutrition Labels") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Google Play target API") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Android 16 / API 36") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Google Play production access") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("12 testers opted in for 14 continuous days") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Official source set checked: Apple App Store Connect App Privacy") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("screenshot specifications, screenshot upload, release notes") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Repo-safe current-rule source URLs") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://support.google.com/googleplay/android-developer/answer/11926878") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Google Play target API, Data Safety, testing-track, production-access testing, and payments help") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("private release handoff only"),
  },
  {
    label: "product plan uses plain push and translation roadmap wording",
    ok:
      docs["docs/PRODUCT_PLAN.md"].includes("installed app push third") &&
      docs["docs/PRODUCT_PLAN.md"].includes("mobile app push for iOS and Android apps") &&
      docs["docs/PRODUCT_PLAN.md"].includes("vetted translation service") &&
      docs["docs/PRODUCT_PLAN.md"].includes("review-controlled checkout/webhooks") &&
      docs["docs/PRODUCT_PLAN.md"].includes("seller payout QA checklist") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("PWA browser push") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("installed-PWA") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("PWA web push") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("APNs") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("FCM") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("Firebase Cloud Messaging") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("provider-backed") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("payment-provider review") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("payment-provider rules") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("hosted checkout") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("hosted payout") &&
      !docs["docs/PRODUCT_PLAN.md"].includes("Stripe-hosted") &&
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
      docs["docs/PRODUCT_PLAN.md"].includes("ads/ad credits") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Merch setup") &&
      docs["docs/PRODUCT_PLAN.md"].includes("seller payout readiness") &&
      docs["docs/PRODUCT_PLAN.md"].includes("order support") &&
      docs["docs/PRODUCT_PLAN.md"].includes("first safe tutorial short clip") &&
      docs["docs/PRODUCT_PLAN.md"].includes("second safe tutorial short clip") &&
      docs["docs/PRODUCT_PLAN.md"].includes("third safe tutorial short clip") &&
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
    message: describeHelpTutorialAssetIssues(),
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
      helpCenterData.includes('assetSrc: "/screenshots/mobile-ads-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-merch-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-merch-help-shortcut-safe.png"') &&
      screenshotGenerator.includes('"mobile-merch-help-shortcut-safe.png"') &&
      existsSync(safeMerchShortcutScreenshotPath) &&
      statSync(safeMerchShortcutScreenshotPath).size > 10_000 &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-payout-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-order-support-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-privacy-safety-safe.png"') &&
      screenshotGenerator.includes('"mobile-privacy-safety-safe.png"') &&
      existsSync(safePrivacyScreenshotPath) &&
      statSync(safePrivacyScreenshotPath).size > 10_000 &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-4u-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-stories-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-gossip-safe.png"') &&
      helpCenterData.includes("Privacy and support controls") &&
      helpCenterData.includes("Signup to first Settings save") &&
      helpCenterData.includes("Photo and banner setup") &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-main-navigation-safe.mp4"') &&
      existsSync(safeTutorialClipPath) &&
      statSync(safeTutorialClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-stories-dms-safety-safe.mp4"') &&
      existsSync(safeStoriesDmsClipPath) &&
      statSync(safeStoriesDmsClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-dm-notification-pass-safe.mp4"') &&
      existsSync(safeDmNotificationClipPath) &&
      statSync(safeDmNotificationClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-merch-fulfillment-safe.mp4"') &&
      existsSync(safeMerchFulfillmentClipPath) &&
      statSync(safeMerchFulfillmentClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-booking-calendar-safe.mp4"') &&
      existsSync(safeBookingCalendarClipPath) &&
      statSync(safeBookingCalendarClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-verification-review-safe.mp4"') &&
      existsSync(safeVerificationReviewClipPath) &&
      statSync(safeVerificationReviewClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-ads-credits-safe.mp4"') &&
      existsSync(safeAdsCreditsClipPath) &&
      statSync(safeAdsCreditsClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-order-refund-review-safe.mp4"') &&
      existsSync(safeOrderRefundClipPath) &&
      statSync(safeOrderRefundClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-payment-safety-safe.mp4"') &&
      existsSync(safePaymentSafetyClipPath) &&
      statSync(safePaymentSafetyClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-app-wrapper-navigation-safe.mp4"') &&
      existsSync(safeAppWrapperClipPath) &&
      statSync(safeAppWrapperClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-profile-photo-banner-safe.mp4"') &&
      existsSync(safeProfilePhotoClipPath) &&
      statSync(safeProfilePhotoClipPath).size > 50_000 &&
      helpShortClipBlocks.length >= 11 &&
      helpShortClipBlocks.every((block) => block.includes("assetSrc:")) &&
      helpTutorialAssetPaths.length >= 25 &&
      helpTutorialAssetPaths.every(isNonEmptyHelpTutorialAsset) &&
      helpCenterData.includes("Admin beta go/no-go") &&
      helpCenterData.includes("Two-user DM and notification pass") &&
      helpCenterData.includes("Booking request to calendar") &&
      helpCenterData.includes("Booking setup sections") &&
      helpCenterData.includes("Verification form basics") &&
      helpCenterData.includes("Submit for review walkthrough") &&
      helpCenterData.includes("Use ad credits") &&
      helpCenterData.includes("Merch product setup") &&
      helpCenterData.includes("Merch guide shortcut") &&
      helpCenterData.includes("Fulfill a Merch order") &&
      helpCenterData.includes('slug: "order-refunds-disputes"') &&
      helpCenterData.includes("Order support, refunds, and disputes") &&
      helpCenterData.includes("What happens if there is a dispute?") &&
      helpCenterData.includes("Buyer order support path") &&
      helpCenterData.includes("Fulfillment and refund review") &&
      helpCenterData.includes("Seller payouts and payment safety") &&
      helpCenterData.includes("Should I send payout details to support?") &&
      helpCenterData.includes("Payment safety walkthrough") &&
      !helpCenterData.includes("hosted account flow") &&
      helpCenterData.includes("Stories rail preview") &&
      helpCenterData.includes("Gossip discussion preview") &&
      helpCenterData.includes("Who can see my 4U or Gossip post?") &&
      helpCenterData.includes("Artists and shops only when the post should stay with verified artists or studios") &&
      helpCenterData.includes("verified artist/vendor audience for professional-only discussion") &&
      helpCenterData.includes("account data-request controls") &&
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
      helpCenterData.includes("calendar app") &&
      helpCenterData.includes("calendar download") &&
      !helpCenterData.includes("google calendar") &&
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
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("secure seller payout onboarding") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("legal and payment-policy review") &&
      !docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("provider review") &&
      !docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("legal/provider review") &&
      !docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Stripe/provider") &&
      !docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("/provider") &&
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
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("## Live-Money Cutover Preflight Matrix") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Flow | Mode and webhook preflight | Required live event proof | Admin reconciliation proof | Fulfillment or delivery gate | Payout/refund/dispute gate | Repo-safe result |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Merch order checkout |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Prepaid ad campaign checkout |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Booking deposit checkout |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Seller payout readiness |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("a single passed flow does not clear the others") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Admin > Payments reconciliation result") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Keep payment intent IDs, checkout session IDs") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("raw console exports in the private release handoff only") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("npm.cmd run smoke:env") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("npm.cmd run smoke:payments") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("environment drift, event coverage drift, and secret-boundary regressions") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Native checkout policy review must be dated") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("July 21, 2026 review source set") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Apple App Review Guidelines and Google Play Payments policy for physical goods, services, digital goods, ads, and external-payment behavior") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Classify every paid native flow separately before promotion") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Merch physical goods") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("accepted booking deposits or services") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("prepaid ad campaigns") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("any digital goods or digital services") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("external payment-link or web-return behavior") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("platform, build or track, flow name, source checked date") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Do not claim native checkout availability") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("final legal review, and live-money payment evidence pack") &&
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
      docs["docs/APP_STORE_READINESS.md"].includes("## Current Store Console Snapshot") &&
      docs["docs/APP_STORE_READINESS.md"].includes("| Surface | Repo-safe status | Next action | Private evidence location |") &&
      docs["docs/APP_STORE_READINESS.md"].includes("iOS App Version `1.0` build `1.0 (3)` was submitted for App Review") &&
      docs["docs/APP_STORE_READINESS.md"].includes("App Store Connect shows `1 Item Submitted`") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Age 18+ override") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Play Console Dashboard shows app update status `Not yet sent for review`") &&
      docs["docs/APP_STORE_READINESS.md"].includes("closed testing is `4 of 5` complete") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Publishing overview shows `Changes not yet submitted for review`") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Monitor App Review status and reviewer messages") &&
      docs["docs/APP_STORE_READINESS.md"].includes("send the release to Google for review") &&
      docs["docs/APP_STORE_READINESS.md"].includes("with account verification and Connect setup still outstanding") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Firebase console is open at the project list/welcome state") &&
      docs["docs/APP_STORE_READINESS.md"].includes("no TTC Firebase project is selected") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Native pre-device verification passed") &&
      docs["docs/APP_STORE_READINESS.md"].includes("zero visible devices") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("native Firebase/FCM delivery") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Complete the Native Push Private Evidence Matrix") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Private release handoff only") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Private payment handoff only") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Private native QA handoff only") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Store consoles") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Apple iOS `1.0` build `1.0 (3)` is submitted for App Review") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Google Play is not yet downloadable because the closed-testing release still needs to be sent to Google for review") &&
      docs["docs/APP_STORE_READINESS.md"].includes("13-inch iPad screenshots uploaded") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Content Rights") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Accessibility Nutrition Labels") &&
      (docs["docs/APP_STORE_READINESS.md"].includes("Data Safety review") ||
        docs["docs/APP_STORE_READINESS.md"].includes("Data Safety saved")) &&
      (docs["docs/APP_STORE_READINESS.md"].includes("required closed-test production-access evidence") ||
        docs["docs/APP_STORE_READINESS.md"].includes("production access still needs closed-test live status")) &&
      docs["docs/APP_STORE_READINESS.md"].includes("closed-test tester opt-in/duration evidence if required") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Legal and policy") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Final counsel-reviewed Terms/Privacy") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Real-device QA") &&
      docs["docs/APP_STORE_READINESS.md"].includes("full two-user DM read/reply pass") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Payments and payouts") &&
      docs["docs/APP_STORE_READINESS.md"].includes("small live-payment test after review") &&
      docs["docs/APP_STORE_READINESS.md"].includes(
        "secure seller payout or manual payout process",
      ) &&
      docs["docs/APP_STORE_READINESS.md"].includes("Secure seller payout setup foundation") &&
      docs["docs/APP_STORE_READINESS.md"].includes("payment-policy review") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("Stripe Connect or manual payout process") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("hosted onboarding links") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("provider review") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Native wrapper") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Android API 36") &&
      docs["docs/APP_STORE_READINESS.md"].includes("app-link association files"),
  },
  {
    label: "native push setup evidence stays private and route-testable",
    ok:
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("## Native Push Private Evidence Matrix") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| Firebase project | Project exists for TheTattooCore") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| Android app config | Android app config file added only to the private build environment") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| iOS app config | iOS app config file added only on the Mac/Xcode build path") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| Device token registration | Signed-in Android and iOS devices register and refresh tokens") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| Delivery and tap routing | Alerts deliver for the tested categories") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| Preference controls | Per-device opt-out, quiet hours, and category preferences stop delivery") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("no project IDs, sender IDs, API keys, or console screenshots") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Do not claim native push support in store metadata") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("repo-safe submission notes should refer to in-app") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("describe the working member path as in-app alerts") &&
      !nativePushReadyClaimPattern.test(repoSafeSubmissionDocsText) &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Use the Native Push Private Evidence Matrix") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Keep project IDs, sender IDs, API keys, app config files, device tokens, notification payloads, signing details, and console screenshots in the private release handoff only"),
  },
  {
    label: "full verification keeps focused DM, Android probe, and mobile guards in the chain",
    ok:
      packageJson.includes('"smoke:dm": "node scripts/smoke-dm-guards.mjs"') &&
      packageJson.includes("npm run smoke:stories && npm run smoke:dm && npm run smoke:booking") &&
      packageJson.includes("npm run smoke:env && npm run smoke:security && npm run smoke:content && npm run smoke:theme && npm run smoke:payments && npm run smoke:store && npm run smoke:pwa && npm run smoke:native && npm run qa:android-device && npm run smoke:handoff && npm run smoke:docs && npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:ios") &&
      packageJson.includes("npm run smoke:native && npm run qa:android-device && npm run smoke:store") &&
      packageJson.includes("npm run smoke:env && npm run smoke:native && npm run smoke:handoff && npm run smoke:docs && npm run smoke:store && npm run smoke:mobile && npm run smoke:mobile:ios") &&
      packageJson.includes("npm run smoke:env && npm run smoke:native && npm run smoke:handoff && npm run smoke:docs && npm run qa:android-device:required && npm run smoke:store") &&
      packageJson.includes("npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:ios") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Android connected-device probe") &&
      docs["docs/APP_STORE_READINESS.md"].includes("dedicated DM smoke guard suite") &&
      androidDeviceProbe.includes("ANDROID_QA handoff=manual evidence only until an authorized device appears") &&
      androidDeviceProbe.includes("record Android automation not yet available in the private handoff"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} docs readiness smoke check(s) failed.`);
  for (const check of failures) {
    if (check.message) {
      console.error(`  ${check.message}`);
    }
  }
  process.exit(1);
}
