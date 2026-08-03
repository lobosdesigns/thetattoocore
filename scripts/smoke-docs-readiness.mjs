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
  "docs/PHASE_8_5_CROSS_PLATFORM_QA.md": readFileSync(
    "docs/PHASE_8_5_CROSS_PLATFORM_QA.md",
    "utf8",
  ),
  "docs/DATA_SAFETY_PREP.md": readFileSync("docs/DATA_SAFETY_PREP.md", "utf8"),
  "docs/LEGAL_REVIEW_PREP.md": readFileSync("docs/LEGAL_REVIEW_PREP.md", "utf8"),
  "docs/release/v1.1.0-environment-inventory.md": readFileSync(
    "docs/release/v1.1.0-environment-inventory.md",
    "utf8",
  ),
  "native/thetattoocore-mobile/README.md": readFileSync(
    "native/thetattoocore-mobile/README.md",
    "utf8",
  ),
  "native/thetattoocore-mobile/ios/APPLE_UPLOAD_CHECKLIST.md": readFileSync(
    "native/thetattoocore-mobile/ios/APPLE_UPLOAD_CHECKLIST.md",
    "utf8",
  ),
  "native/store-metadata/README.md": readFileSync("native/store-metadata/README.md", "utf8"),
  "native/store-metadata/screenshot-inventory.md": readFileSync(
    "native/store-metadata/screenshot-inventory.md",
    "utf8",
  ),
};
const packageJson = readFileSync("package.json", "utf8");
const screenshotGenerator = readFileSync("scripts/generate-safe-store-screenshots.mjs", "utf8");
const androidDeviceProbe = readFileSync("scripts/android-device-qa-probe.mjs", "utf8");
const readinessDoc = docs["docs/APP_STORE_READINESS.md"];

const retiredCurrentScreenshotFiles = [
  "mobile-payout-safe.png",
  "mobile-order-support-safe.png",
  "mobile-merch-help-shortcut-safe.png",
];
const retiredCurrentScreenshotTerms = [
  "Payout Readiness",
  "Payout safety guide",
  "submitted build `1.0 (3)`",
  "During active review",
];

function currentScreenshotSourcesUseSellerOwnedTruth({ generator, inventory, readme }) {
  const combined = `${generator}\n${inventory}\n${readme}`;
  return (
    combined.includes("mobile-seller-payment-link-safe.png") &&
    combined.includes("mobile-seller-purchase-support-safe.png") &&
    combined.includes("mobile-listing-safety-safe.png") &&
    combined.includes("seller-owned Payment Link") &&
    combined.includes("seller handles purchase support") &&
    combined.includes("external browser") &&
    combined.includes("no false TTC payment, order, receipt, or success state") &&
    combined.includes("listing safety") &&
    combined.includes("historical TTC order records") &&
    retiredCurrentScreenshotFiles.every(
      (file) =>
        !inventory.includes(file) &&
        !readme.includes(file) &&
        !generator.includes(`"${file}": header`),
    ) &&
    retiredCurrentScreenshotTerms.every((term) => !combined.includes(term))
  );
}

const screenshotSources = {
  generator: screenshotGenerator,
  inventory: docs["native/store-metadata/screenshot-inventory.md"],
  readme: docs["native/store-metadata/README.md"],
};
const screenshotSourceMutants = [
  {
    ...screenshotSources,
    inventory: `${screenshotSources.inventory}\nCurrent App Review uses submitted build \`1.0 (3)\`.`,
  },
  {
    ...screenshotSources,
    generator: `${screenshotSources.generator}\n"mobile-payout-safe.png": header`,
  },
];

function markdownSection(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return "";

  const end = nextHeading
    ? markdown.indexOf(nextHeading, start + heading.length)
    : -1;
  return markdown.slice(start, end === -1 ? undefined : end);
}

function markdownH2Section(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return "";

  const following = markdown.slice(start + heading.length);
  const nextHeadingOffset = following.search(/\n## [^#]/);

  return nextHeadingOffset === -1
    ? markdown.slice(start)
    : markdown.slice(start, start + heading.length + nextHeadingOffset);
}

function containsOrderedSnippets(source, snippets) {
  let cursor = 0;

  for (const snippet of snippets) {
    const index = source.indexOf(snippet, cursor);
    if (index === -1) return false;
    cursor = index + snippet.length;
  }

  return true;
}

const controlledSellerRolloutHeading =
  "## Controlled Seller-Link Rollout Sequence - Current And Operative";
const controlledSellerRolloutStepSnippets = [
  "Apply the protected seller-checkout migration only after exact owner approval",
  "Build and upload an inactive Worker version with `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`",
  "Deploy that verified Worker version while `TTC_SELLER_CHECKOUT_LINKS_ENABLED` remains false",
  "Have one seller provide one live seller Payment Link through the protected workflow",
  "After explicit owner approval to enable seller links, prepare a second inactive Worker upload and prove only `TTC_SELLER_CHECKOUT_LINKS_ENABLED` changes to true",
  "Run web, Android phone, and TestFlight iPad QA",
  "Rollback by restoring `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`",
];

function controlledSellerRolloutIsValid(markdown) {
  const section = markdownH2Section(markdown, controlledSellerRolloutHeading);

  return (
    section.length > 0 &&
    controlledSellerRolloutStepSnippets.every((snippet, index) =>
      section.includes(`${index + 1}. ${snippet}`),
    ) &&
    containsOrderedSnippets(section, controlledSellerRolloutStepSnippets)
  );
}

function swapFirst(source, first, second) {
  const marker = "__TTC_ROLLOUT_STEP_SWAP__";
  if (!source.includes(first) || !source.includes(second)) return source;

  return source.replace(first, marker).replace(second, first).replace(marker, second);
}

const compactWhitespace = (value) => value.replace(/\s+/g, " ").trim();
const appCurrentStoreIdentityHeading =
  "## Current Store Identity Status - Verification Required";
const legacyCurrentStoreSnapshotHeading = "## Current Store Console Snapshot";
const currentStoreConsoleSnapshot =
  markdownH2Section(readinessDoc, appCurrentStoreIdentityHeading) ||
  markdownSection(
    readinessDoc,
    legacyCurrentStoreSnapshotHeading,
    "### Historical TTC-Owned Marketplace Payment Evidence - July 24, 2026 (Non-Operative)",
  );
const currentBlockerMatrix = markdownSection(
  readinessDoc,
  "## Public Distribution Blocker Matrix",
  "## Before Public Distribution Or Any Replacement Submission",
);
const appHistoricalPaymentsHeading =
  "### Historical TTC-Owned Marketplace Payment Evidence - July 24, 2026 (Non-Operative)";
const appCurrentDistributionHeading = "### Current Seller-Owned Distribution Steps";
const appHistoricalReadinessHeading =
  "### Historical Readiness Deployment Record - Dated, Non-Operative";
const staleCurrentSellerCheckoutSnippets = [
  "controlled live server-key and expected-mode cutover",
  "seller payout readiness",
  "small live purchase/refund evidence",
  "production marketplace purchases",
  "secure seller payout or manual payout process",
  "production seller payout releases remain gated",
  "official ttc merch checkout is the only selected pilot flow",
];

function currentAppSellerCheckoutText(markdown) {
  const snapshotEnd = markdown.includes(appHistoricalPaymentsHeading)
    ? appHistoricalPaymentsHeading
    : "## Public Distribution Blocker Matrix";
  const currentStoreIdentity =
    markdownH2Section(markdown, appCurrentStoreIdentityHeading) ||
    markdownSection(markdown, legacyCurrentStoreSnapshotHeading, snapshotEnd);

  return [
    markdownH2Section(markdown, "## Seller-Owned Merch Current Position - August 2, 2026"),
    markdownH2Section(markdown, "## Build Artifact And Store Evidence Boundary - August 2, 2026"),
    currentStoreIdentity,
    markdownSection(
      markdown,
      "## Public Distribution Blocker Matrix",
      "## Before Public Distribution Or Any Replacement Submission",
    ),
    markdownSection(markdown, appCurrentDistributionHeading, appHistoricalReadinessHeading),
  ].join("\n");
}

function currentPaymentSellerCheckoutText(markdown) {
  return [
    markdownH2Section(markdown, "## Current Position - August 2, 2026"),
    markdownH2Section(markdown, controlledSellerRolloutHeading),
  ].join("\n");
}

function currentSellerCheckoutInstructionsAreClean(appStoreDoc, paymentDoc) {
  const currentText = `${currentAppSellerCheckoutText(appStoreDoc)}\n${currentPaymentSellerCheckoutText(paymentDoc)}`.toLowerCase();

  return staleCurrentSellerCheckoutSnippets.every(
    (snippet) => !currentText.includes(snippet),
  );
}

function paymentPilotHistoryIsUnambiguous(markdown) {
  const requiredHeadings = [
    "## Historical TTC-Owned Pilot Operations - Non-Operative",
    "### Historical TTC-Owned Production Switch Checklist - Non-Operative",
    "### Historical TTC-Owned Production Evidence Pack - Non-Operative",
    "### Historical TTC-Owned Live-Money Cutover Preflight Matrix - Non-Operative",
    "### Historical TTC-Owned Draft Seller Payout Release Policy - Non-Operative",
    "### Historical TTC-Owned Draft Shipping And Tax Procedure - Non-Operative",
    "### Historical TTC-Owned Draft Refund And Dispute Procedure - Non-Operative",
  ];

  return (
    requiredHeadings.every((heading) => markdown.includes(heading)) &&
    markdown.includes("Do not execute these historical TTC-owned pilot instructions")
  );
}

function appStorePaymentHistoryIsUnambiguous(markdown) {
  return (
    markdown.includes(appHistoricalPaymentsHeading) &&
    markdown.includes(appHistoricalReadinessHeading) &&
    markdown.includes("Historical evidence only; it is not the current seller checkout path")
  );
}
const mobileSubmissionRunbook = docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"];
const realDeviceQaChecklist = docs["docs/REAL_DEVICE_QA_CHECKLIST.md"];
const mobileCurrentPosition = compactWhitespace(
  markdownSection(
    mobileSubmissionRunbook,
    "## Current Position",
    "## Current Store Rules Check",
  ),
);
const googlePlayInstallHandoff = compactWhitespace(
  markdownSection(
    mobileSubmissionRunbook,
    "## Google Play Install And Controlled QA Handoff",
    "## Required Before Public Distribution Or Any Replacement Submission",
  ),
);
const firstNativeBuildSteps = compactWhitespace(
  markdownSection(
    mobileSubmissionRunbook,
    "## First Native Build Steps",
    "### Historical Google Play Evidence - July 21-23, 2026 (Non-Operative)",
  ),
);
const mobileRequiredBeforeDistribution = compactWhitespace(
  markdownSection(
    mobileSubmissionRunbook,
    "## Required Before Public Distribution Or Any Replacement Submission",
    "## Final Store-Console Evidence",
  ),
);
const realDeviceSetup = compactWhitespace(
  markdownSection(realDeviceQaChecklist, "## Setup", "## Auth And Account"),
);
const nativeBuildInstallMatrix = compactWhitespace(
  markdownSection(
    realDeviceQaChecklist,
    "## Native Build And Install Evidence Matrix",
    "## Android Connected-Device Probe",
  ),
);
const androidConnectedDeviceProbe = compactWhitespace(
  markdownSection(realDeviceQaChecklist, "## Android Connected-Device Probe"),
);
const currentAndroidOperationalText = [
  markdownH2Section(
    mobileSubmissionRunbook,
    "## Seller-Owned Merch Position - August 2, 2026",
  ),
  mobileCurrentPosition,
  googlePlayInstallHandoff,
  mobileRequiredBeforeDistribution,
  firstNativeBuildSteps,
  realDeviceSetup,
  nativeBuildInstallMatrix,
  androidConnectedDeviceProbe,
]
  .join("\n")
  .toLowerCase();
const staleAlphaFirstOperationalSnippets = [
  "closed testing - alpha now serves",
  "currently served closed testing - alpha release",
  "active google play closed-testing build",
  "active closed-test build",
  "google play closed-testing track",
  "android closed-testing install proof",
  "| android | google play closed testing.",
  "confirm the android device's selected google play account belongs to the configured tester community",
  "confirm the closed-test store listing offers install or update",
];
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const settingsPage = readFileSync("src/app/settings/page.tsx", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const adminPaymentsPage = readFileSync("src/app/admin/payments/page.tsx", "utf8");
const adminMediaOpsPage = readFileSync("src/app/admin/media-ops/page.tsx", "utf8");
const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");
const helpLandingPage = readFileSync("src/app/help/page.tsx", "utf8");
const searchPage = readFileSync("src/app/search/page.tsx", "utf8");
const helpArticlePage = readFileSync("src/app/help/[slug]/page.tsx", "utf8");
const protectedVideo = readFileSync("src/app/protected-video.tsx", "utf8");
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
const androidBuildGradle = readFileSync(
  "native/thetattoocore-mobile/android/app/build.gradle",
  "utf8",
);
const iosProject = readFileSync(
  "native/thetattoocore-mobile/ios/App/App.xcodeproj/project.pbxproj",
  "utf8",
);
const allDocs = Object.values(docs).join("\n");
const safeTutorialClipPath = "public/tutorial-clips/mobile-main-navigation-safe.mp4";
const safeStoriesDmsClipPath = "public/tutorial-clips/mobile-stories-dms-safety-safe.mp4";
const safeDmNotificationClipPath = "public/tutorial-clips/mobile-dm-notification-pass-safe.mp4";
const safeMerchFulfillmentClipPath = "public/tutorial-clips/mobile-merch-fulfillment-safe.mp4";
const safeBookingCalendarClipPath = "public/tutorial-clips/mobile-booking-calendar-safe.mp4";
const safeVerificationReviewClipPath = "public/tutorial-clips/mobile-verification-review-safe.mp4";
const safeAdsCreditsClipPath = "public/tutorial-clips/mobile-ads-credits-safe.mp4";
const safeOrderRefundClipPath = "public/tutorial-clips/mobile-order-refund-review-safe.mp4";
const safeAppWrapperClipPath = "public/tutorial-clips/mobile-app-wrapper-navigation-safe.mp4";
const safeProfilePhotoClipPath = "public/tutorial-clips/mobile-profile-photo-banner-safe.mp4";
const safePrivacyScreenshotPath = "public/screenshots/mobile-privacy-safety-safe.png";
const safeMerchShortcutScreenshotPath = "public/screenshots/mobile-listing-safety-safe.png";
const safeSellerSupportScreenshotPath =
  "public/screenshots/mobile-seller-purchase-support-safe.png";
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

const productCurrentSellerHeading =
  "## Seller-Owned Merch Plan - Current And Operative (August 2, 2026)";
const productHistoricalPaymentsHeading =
  "### Historical TTC-Owned Merch Payment Implementation - July 24, 2026 (Non-Operative)";
const productCurrentPaymentsHeading =
  "### Current Seller-Owned Merch Payment Position - August 2, 2026";
const productHistoricalSupportHeading =
  "### Historical TTC-Owned Seller Payout Support - July 24, 2026 (Non-Operative)";
const phaseCurrentSellerQaHeading =
  "## Current Seller-Link QA Interpretation - August 2, 2026";

function currentProductPlanText(markdown) {
  if (!markdown.includes(productCurrentSellerHeading)) return markdown;

  return [
    markdownH2Section(markdown, productCurrentSellerHeading),
    markdownSection(markdown, "## Core Experience", "## Notification Roadmap"),
    markdownSection(markdown, "## Platform Stance", productHistoricalPaymentsHeading),
    markdownSection(markdown, productCurrentPaymentsHeading, "## Visual Direction"),
    markdownSection(markdown, "## Lightweight Ads", productHistoricalSupportHeading),
    markdownSection(markdown, "## Help Center And Education", "## Later Columns"),
    markdownH2Section(markdown, "## Later Columns"),
  ].join("\n");
}

function currentPhaseQaText(markdown) {
  if (!markdown.includes(phaseCurrentSellerQaHeading)) return markdown;

  return [
    markdownH2Section(markdown, phaseCurrentSellerQaHeading),
    markdownSection(markdown, "## Carry Forward To Phase 9", "## Review Status"),
  ].join("\n");
}

function currentReadmeSellerText(markdown) {
  return markdownSection(
    markdown,
    "## Seller-Owned Merch Checkout - Current Position (August 2, 2026)",
    "## Native Signing And App Config",
  );
}

function currentMobileSellerText(markdown) {
  return [
    markdownH2Section(markdown, "## Seller-Owned Merch Position - August 2, 2026"),
    markdownH2Section(markdown, "## Current Position"),
    markdownH2Section(markdown, "## Google Play Install And Controlled QA Handoff"),
    markdownH2Section(
      markdown,
      "## Required Before Public Distribution Or Any Replacement Submission",
    ),
    markdownSection(
      markdown,
      "## First Native Build Steps",
      "### Historical Google Play Evidence - July 21-23, 2026 (Non-Operative)",
    ),
  ].join("\n");
}

function currentSellerOwnedSurfaceTexts(overrides = {}) {
  const source = (key, fallback) => overrides[key] ?? fallback;

  return {
    appStore: currentAppSellerCheckoutText(
      source("appStore", docs["docs/APP_STORE_READINESS.md"]),
    ),
    ageRating: source("ageRating", docs["docs/AGE_RATING_PREP.md"]),
    environmentInventory: source(
      "environmentInventory",
      docs["docs/release/v1.1.0-environment-inventory.md"],
    ),
    helpLanding: source("helpLanding", helpLandingPage),
    mediaOps: source("mediaOps", adminMediaOpsPage),
    mobileRunbook: currentMobileSellerText(
      source("mobileRunbook", docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"]),
    ),
    paymentReadiness: currentPaymentSellerCheckoutText(
      source("paymentReadiness", docs["docs/PAYMENT_PRODUCTION_READINESS.md"]),
    ),
    phaseQa: currentPhaseQaText(
      source("phaseQa", docs["docs/PHASE_8_5_CROSS_PLATFORM_QA.md"]),
    ),
    productPlan: currentProductPlanText(
      source("productPlan", docs["docs/PRODUCT_PLAN.md"]),
    ),
    readme: currentReadmeSellerText(source("readme", docs["README.md"])),
    search: source("search", searchPage),
  };
}

const staleCurrentSnippetsBySurface = {
  appStore: [
    ...staleCurrentSellerCheckoutSnippets,
    "app store build currently in review remains unchanged",
    "apple ios `1.0` build `1.0 (3)` remains in app review",
    "google play production serves `1.0.3 (4)` publicly",
    "google play currently serves api 36 release `1.0.3 (4)`",
    "exact current app review identity: `",
    "exact current testflight identity: `",
    "exact current google play production identity: `",
    "exact current google play closed testing - alpha identity: `",
  ],
  ageRating: [
    "merch and ads use controlled launch checkout",
    "launch commerce is controlled until seller approval, payout, tax, refund",
    "decide whether merch checkout appears in native builds",
    "ttc merch checkout",
  ],
  environmentInventory: [
    "exact `true` enables the checkout creation master",
    "exact `true` is required for seller onboarding",
    "until seller payout release approval",
    "use `stripe_connect_onboarding_enabled=true` for seller payouts",
  ],
  helpLanding: ["merch and payouts", "find payout help", "payout safety"],
  mediaOps: [
    "run merch, ad, and booking-deposit controlled checkout flows",
    "seller payouts, platform fees",
    "capture controlled merch checkout",
    "seller payout guidance",
    "keep real purchases gated until seller payouts",
    "controlled new ttc merch checkout",
    "connect seller payout setup",
    "payout release",
  ],
  mobileRunbook: [
    "the app store build currently in review remains unchanged",
    "google play production serves api 36 release `1.0.3 (4)` publicly",
    "closed testing - alpha serves `1.0.4 (5)`",
    "app review remains on build `1.0 (3)`",
    "strict gate also checks the exact android alpha `1.0.5 (6)`, app review `1.0 (3)`, testflight `1.0 (5)`",
    "google play production and closed testing - alpha currently serve `1.0.3 (4)`",
    "while app store version `1.0` continues review with build `1.0 (3)`",
    "current checkout returns",
    "exact current app review identity: `",
    "exact current testflight identity: `",
    "exact current google play production identity: `",
    "exact current google play closed testing - alpha identity: `",
  ],
  paymentReadiness: staleCurrentSellerCheckoutSnippets,
  phaseQa: [
    "checkout success, guarded checkout, seller payout gates",
    "seller payout release remains disabled",
    "ttc merch checkout",
  ],
  productPlan: [
    "merch is now in controlled launch checkout",
    "seller payout onboarding status",
    "production seller approval, deeper payout release rules",
    "ttc platform fees should be transparent and configurable by payment type",
    "seller payout setup must never dump members",
    "seller payouts guide explains",
    "merch/payouts",
    "seller payout readiness",
    "ttc connect seller onboarding",
    "ttc handles new merch refunds",
    "stale pending merch checkouts",
    "paid orders needing seller fulfillment",
    "orders/payouts",
    "seller payout tools",
    "review-controlled checkout/webhooks second",
    "controlled launch checkout, paid webhooks",
    "seller-side paid line-item fulfillment",
    "enable ttc merch checkout and seller payouts now",
  ],
  readme: [
    "the checkout creation master and selected checkout-flow switch are the exposure controls",
    "for a safe rollback, disable `stripe_checkout_creation_enabled`",
    "server-only seller-onboarding release switch; keep `false` pending separate approval",
    "use `stripe_connect_onboarding_enabled=true` for seller payouts",
  ],
  search: [
    "merch checkout stays review-controlled",
    "use support for order, refund",
    "ttc support handles new seller-owned purchase support",
    "ttc handles new merch refunds",
  ],
};

function currentSellerOwnedSurfacesAreClean(surfaceTexts) {
  return Object.entries(staleCurrentSnippetsBySurface).every(([surface, snippets]) => {
    const currentText = surfaceTexts[surface].toLowerCase();
    return snippets.every((snippet) => !currentText.includes(snippet));
  });
}

const currentSellerOwnedSurfaceText = currentSellerOwnedSurfaceTexts();
const staleCurrentSurfaceMutationCases = Object.entries(staleCurrentSnippetsBySurface).flatMap(
  ([surface, snippets]) =>
    snippets.map((snippet, index) => ({
      label: `docs ${surface} mutation rejects stale current claim ${index + 1}`,
      ok: !currentSellerOwnedSurfacesAreClean({
        ...currentSellerOwnedSurfaceText,
        [surface]: `${currentSellerOwnedSurfaceText[surface]}\n${snippet}`,
      }),
    })),
);

const buildEvidenceRequiredSnippets = [
  "Checked-in Android source candidate: `1.0.5 (6)`",
  "Checked-in iOS source candidate: `1.0 (5)`",
  "Repository source identity is not signed-artifact, upload, console-selection, served-track, or installed-device proof",
  "Exact current App Review identity: **UNKNOWN**",
  "Exact current TestFlight identity: **UNKNOWN**",
  "Exact current Google Play Production identity: **UNKNOWN**",
  "Exact current Google Play Closed testing - Alpha identity: **UNKNOWN**",
  "separately authorized read-only signed-in console/device verification",
  "re-verified before QA or release claims",
];
const unsupportedCandidateServedClaims = [
  "Android `1.0.5 (6)` is active in Alpha",
  "Alpha serves `1.0.5 (6)`",
  "Google Play Production serves `1.0.5 (6)`",
  "iOS `1.0 (5)` is active in TestFlight",
  "TestFlight serves `1.0 (5)`",
  "App Review uses `1.0 (5)`",
];

function buildEvidenceTruthIsUnambiguous(appStoreDoc, mobileDoc) {
  const currentAppText = currentAppSellerCheckoutText(appStoreDoc);
  const currentMobileText = currentMobileSellerText(mobileDoc);

  return (
    androidBuildGradle.includes("versionCode 6") &&
    androidBuildGradle.includes('versionName "1.0.5"') &&
    iosProject.includes("CURRENT_PROJECT_VERSION = 5;") &&
    iosProject.includes("MARKETING_VERSION = 1.0;") &&
    mobileDoc.includes("### Historical Store Baseline - July 24, 2026 (Non-Operative)") &&
    mobileDoc.includes("This dated record does not establish a current served, selected, review, testing, or installed identity") &&
    [currentAppText, currentMobileText].every((text) =>
      buildEvidenceRequiredSnippets.every((snippet) => text.includes(snippet)),
    ) &&
    unsupportedCandidateServedClaims.every(
      (snippet) =>
        !currentAppText.includes(snippet) && !currentMobileText.includes(snippet),
    )
  );
}

const unsupportedBuildMutationCases = unsupportedCandidateServedClaims.map(
  (snippet, index) => ({
    label: `docs build-evidence mutation rejects candidate-as-served claim ${index + 1}`,
    ok: !buildEvidenceTruthIsUnambiguous(
      docs["docs/APP_STORE_READINESS.md"].replace(
        "## Seller-Owned Merch Current Position - August 2, 2026",
        `## Seller-Owned Merch Current Position - August 2, 2026\n\n${snippet}`,
      ),
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"],
    ),
  }),
);

function withoutDatedNonOperativeSections(markdown) {
  const kept = [];
  let excludedHeadingLevel = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);

    if (excludedHeadingLevel !== null) {
      if (!heading || heading[1].length > excludedHeadingLevel) continue;
      excludedHeadingLevel = null;
    }

    if (
      heading &&
      /historical/i.test(heading[2]) &&
      /non-operative/i.test(heading[2])
    ) {
      excludedHeadingLevel = heading[1].length;
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n");
}

const currentBuildEvidenceRequiredSnippets = [
  "Checked-in Android source candidate: `1.0.5 (6)`",
  "Checked-in iOS source candidate: `1.0 (5)`",
  "Exact current App Review identity: **UNKNOWN**",
  "Exact current TestFlight identity: **UNKNOWN**",
  "Exact current Google Play Production identity: **UNKNOWN**",
  "Exact current Google Play Closed testing - Alpha identity: **UNKNOWN**",
  "Exact current installed Android identity: **UNKNOWN**",
  "Exact current installed iOS identity: **UNKNOWN**",
  "Repository source identity is not signed-artifact, upload, console-selection, served-track, or installed-device proof",
  "separately authorized read-only signed-in console/device verification",
];
const currentBuildTruthPaths = [
  "docs/PAYMENT_PRODUCTION_READINESS.md",
  "docs/LEGAL_REVIEW_PREP.md",
  "docs/STORE_LISTING_DRAFT.md",
  "docs/MOBILE_APP_SUBMISSION_RUNBOOK.md",
  "docs/REAL_DEVICE_QA_CHECKLIST.md",
  "docs/NATIVE_WRAPPER_PREP.md",
  "native/thetattoocore-mobile/README.md",
  "native/thetattoocore-mobile/ios/APPLE_UPLOAD_CHECKLIST.md",
];
const staleCurrentBuildSnippets = [
  "app store build currently in review",
  "already in review",
  "remains in app review",
  "production serves",
  "alpha serves",
  "active production release",
  "current api 36 baseline",
  "exact public release `1.0.3 (4)`",
  "candidate `1.0.3 (4)`",
  "installed google play production `1.0.3 (4)`",
  "android `1.0.5 (6)` is active in alpha",
  "ios `1.0 (5)` is active in testflight",
];
const currentIdentityPattern =
  /exact current (?:app review|testflight|google play production|google play closed testing - alpha|installed android|installed ios) identity:\s*(\*\*UNKNOWN\*\*|`[^`\r\n]*`|[^\s\r\n]+)/gi;

function hasKnownCurrentIdentity(markdown) {
  return [...markdown.matchAll(currentIdentityPattern)].some(
    ([, value]) => value !== "**UNKNOWN**",
  );
}

function currentBuildSourceTruthIsSafe(markdown) {
  const currentText = withoutDatedNonOperativeSections(markdown);
  const lowerCurrentText = currentText.toLowerCase();

  return (
    currentBuildEvidenceRequiredSnippets.every((snippet) => currentText.includes(snippet)) &&
    !hasKnownCurrentIdentity(currentText) &&
    !lowerCurrentText.includes("1.0.3 (4)") &&
    !lowerCurrentText.includes("1.0.4 (5)") &&
    staleCurrentBuildSnippets.every((snippet) => !lowerCurrentText.includes(snippet))
  );
}

const unsafeCurrentBuildTruthPaths = currentBuildTruthPaths.filter(
  (path) => !currentBuildSourceTruthIsSafe(docs[path]),
);

const currentBuildTruthMutationSnippets = [
  "Exact current App Review identity: `1.0 (3)`",
  "Google Play Closed testing - Alpha serves Android `1.0.5 (6)`.",
  "Use exact public release `1.0.3 (4)` for current QA.",
];
const currentBuildTruthMutationCases = currentBuildTruthPaths.flatMap((path) =>
  currentBuildTruthMutationSnippets.map((snippet, index) => ({
    label: `docs ${path} rejects current build contradiction ${index + 1}`,
    ok: !currentBuildSourceTruthIsSafe(`${snippet}\n${docs[path]}`),
  })),
);

const controlledSellerRolloutDocs = [
  "docs/PAYMENT_PRODUCTION_READINESS.md",
  "docs/APP_STORE_READINESS.md",
  "docs/LEGAL_REVIEW_PREP.md",
  "docs/MOBILE_APP_SUBMISSION_RUNBOOK.md",
];
const paymentReadinessDoc = docs["docs/PAYMENT_PRODUCTION_READINESS.md"];
const rolloutMissingStepMutationCases = controlledSellerRolloutStepSnippets.map(
  (snippet, index) => ({
    label: `docs rollout mutation rejects missing controlled step ${index + 1}`,
    source: paymentReadinessDoc.replace(snippet, ""),
  }),
);
const rolloutOrderMutationSource = swapFirst(
  paymentReadinessDoc,
  controlledSellerRolloutStepSnippets[3],
  controlledSellerRolloutStepSnippets[4],
);

const checks = [
  {
    label: "current screenshot sources use seller-owned purchase support and reject payout or hard-coded review claims",
    ok:
      currentScreenshotSourcesUseSellerOwnedTruth(screenshotSources) &&
      screenshotSourceMutants.every(
        (mutant) => !currentScreenshotSourcesUseSellerOwnedTruth(mutant),
      ),
  },
  {
    label: "seller-owned Merch copy is consistent across member and admin surfaces",
    ok:
      accountPage.includes("Merch and orders") &&
      accountPage.includes("Sellers add their own live Payment Link when creating or editing a product") &&
      accountPage.includes("historical TTC order support records") &&
      settingsPage.includes("Merch, seller checkout, historical orders, fulfillment, and support") &&
      supportPage.includes("The seller processes payment and handles shipping, taxes, returns, refunds, disputes, and purchase support") &&
      privacyPage.includes("The seller processes payment and handles shipping, taxes, returns, refunds, disputes, and purchase support") &&
      helpCenterData.includes('slug: "seller-payouts-payment-safety"') &&
      helpCenterData.includes('title: "Seller checkout and payment safety"') &&
      helpCenterData.includes("Buyers contact the seller for receipts, shipping, returns, refunds, disputes, and purchase support") &&
      helpLandingPage.includes("Seller Payment Links and fulfillment") &&
      helpLandingPage.includes("seller handles payment, shipping, taxes, returns, refunds, disputes, receipts, and purchase support") &&
      searchPage.includes("seller-owned Payment Link") &&
      compactWhitespace(searchPage).includes("The seller handles payment, receipts, shipping, returns, refunds, disputes, and purchase support") &&
      compactWhitespace(searchPage).includes("TTC Support handles listing-safety reports and explicitly historical TTC orders") &&
      compactWhitespace(adminPaymentsPage).includes("Legacy TTC checkout controls") &&
      compactWhitespace(adminPaymentsPage).includes("disabled for the seller-link release") &&
      !accountPage.includes("stripeConnectOnboardingEnabled") &&
      !accountPage.includes("stripeCheckoutPreflight") &&
      !accountPage.includes('from("stripe_connect_accounts")') &&
      !accountPage.includes("payout_status") &&
      !accountPage.includes("payout_issue") &&
      !helpCenterData.includes('/screenshots/mobile-payout-safe.png') &&
      !helpCenterData.includes('/tutorial-clips/mobile-payment-safety-safe.mp4'),
  },
  {
    label: "privacy preserves historical records and excludes new external purchase data",
    ok:
      privacyPage.includes("TTC stores the seller's listing link and acceptance record") &&
      privacyPage.includes("does not receive new external purchase card, shipping, receipt, or transaction data") &&
      privacyPage.toLowerCase().includes("historical ttc test orders and payment audits") &&
      privacyPage.includes("listing-safety reports") &&
      !privacyPage.includes("TTC processes new external Merch payments"),
  },
  {
    label: "current release docs supersede the TTC-owned pilot without claiming rollout",
    ok:
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("## Current Position - August 2, 2026") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Seller-owned Stripe Payment Links are the selected physical-goods model") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("TTC Checkout, Connect, and destination-charge controls remain false and historical") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("TTC_SELLER_CHECKOUT_LINKS_ENABLED=false") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("No migration, production change, live seller URL, deployment, or native upload has occurred") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Have one seller provide one live seller Payment Link") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("web, Android phone, and TestFlight iPad QA") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].toLowerCase().includes("rollback proof") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Exact current App Review identity: **UNKNOWN**") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("seller-owned external checkout") &&
      compactWhitespace(docs["docs/DATA_SAFETY_PREP.md"]).includes("new external Merch purchase data") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("seller-owned Payment Link") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("seller-owned external checkout") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("TestFlight iPad") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Android phone") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("external browser") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("no false success state"),
  },
  {
    label: "every current seller-owned surface rejects stale payout fee Connect checkout and rollback instructions",
    ok:
      currentSellerCheckoutInstructionsAreClean(
        docs["docs/APP_STORE_READINESS.md"],
        paymentReadinessDoc,
      ) && currentSellerOwnedSurfacesAreClean(currentSellerOwnedSurfaceText),
  },
  {
    label: "current seller-owned Help product Admin rating and QA surfaces state the selected responsibilities",
    ok:
      docs["docs/PRODUCT_PLAN.md"].includes(productCurrentSellerHeading) &&
      docs["docs/PRODUCT_PLAN.md"].includes("TTC does not create the new Merch payment") &&
      docs["docs/PRODUCT_PLAN.md"].includes("historical TTC pending-checkout rows") &&
      docs["docs/PRODUCT_PLAN.md"].includes("Merch and orders") &&
      docs["docs/PRODUCT_PLAN.md"].includes("seller-link review") &&
      docs["docs/PRODUCT_PLAN.md"].includes("legacy TTC reconciliation") &&
      adminMediaOpsPage.includes("Review the seller-owned Payment Link") &&
      adminMediaOpsPage.includes("historical TTC seller-payout reconciliation") &&
      docs["docs/AGE_RATING_PREP.md"].includes("reviewed seller-owned Payment Links") &&
      docs["docs/PHASE_8_5_CROSS_PLATFORM_QA.md"].includes(phaseCurrentSellerQaHeading) &&
      docs["docs/PHASE_8_5_CROSS_PLATFORM_QA.md"].includes("no false TTC payment, order, receipt, or success state"),
  },
  {
    label: "legacy TTC-owned payment operations are clearly historical and non-operative",
    ok:
      paymentPilotHistoryIsUnambiguous(paymentReadinessDoc) &&
      appStorePaymentHistoryIsUnambiguous(docs["docs/APP_STORE_READINESS.md"]) &&
      docs["docs/PRODUCT_PLAN.md"].includes(productHistoricalPaymentsHeading) &&
      docs["docs/PRODUCT_PLAN.md"].includes(productHistoricalSupportHeading) &&
      docs["docs/PRODUCT_PLAN.md"].includes("Historical facts only; do not use this section as current launch work") &&
      docs["docs/PHASE_8_5_CROSS_PLATFORM_QA.md"].includes("historical TTC-owned checkout evidence only and is non-operative"),
  },
  {
    label: "seller-link rollback uses only the new gate while retired payment switches stay false and historical",
    ok:
      docs["README.md"].includes("The only current seller-link rollback control is `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`") &&
      docs["docs/release/v1.1.0-environment-inventory.md"].includes("The only current seller-link rollback control is `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false`") &&
      docs["README.md"].includes("Retired historical TTC payment control") &&
      docs["docs/release/v1.1.0-environment-inventory.md"].includes("Retired historical TTC payment control"),
  },
  {
    label: "checked-in native candidates remain distinct from unknown current store identities",
    ok: buildEvidenceTruthIsUnambiguous(
      docs["docs/APP_STORE_READINESS.md"],
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"],
    ),
  },
  {
    label: "every named current release source rejects contradictory exact build claims",
    message:
      unsafeCurrentBuildTruthPaths.length > 0
        ? `unsafe current build truth: ${unsafeCurrentBuildTruthPaths.join(", ")}`
        : undefined,
    ok:
      androidBuildGradle.includes("versionCode 6") &&
      androidBuildGradle.includes('versionName "1.0.5"') &&
      iosProject.includes("CURRENT_PROJECT_VERSION = 5;") &&
      iosProject.includes("MARKETING_VERSION = 1.0;") &&
      unsafeCurrentBuildTruthPaths.length === 0,
  },
  {
    label: "controlled seller checkout rollout is complete and ordered in current docs",
    ok: controlledSellerRolloutDocs.every((path) =>
      controlledSellerRolloutIsValid(docs[path]),
    ),
  },
  ...rolloutMissingStepMutationCases.map(({ label, source }) => ({
    label,
    ok: !controlledSellerRolloutIsValid(source),
  })),
  {
    label: "docs rollout mutation rejects inverted private-review and enablement steps",
    ok: !controlledSellerRolloutIsValid(rolloutOrderMutationSource),
  },
  ...staleCurrentSurfaceMutationCases,
  ...unsupportedBuildMutationCases,
  ...currentBuildTruthMutationCases,
  {
    label: "seller checkout docs stay free of live links account IDs and secrets",
    ok:
      !/https:\/\/buy[.]stripe[.]com\//i.test(allDocs) &&
      !/\bacct_[A-Za-z0-9]+\b/.test(allDocs) &&
      !/\bsk_(?:live|test)_[A-Za-z0-9]{12,}\b/.test(allDocs) &&
      !/\bwhsec_[A-Za-z0-9]{12,}\b/.test(allDocs),
  },
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
      docs["docs/APP_STORE_READINESS.md"].includes("Help URL: https://thetattoocore.com/help") &&
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
      docs["docs/STORE_LISTING_DRAFT.md"].includes("seller-owned external checkout") &&
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
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Checked-in Android source candidate: `1.0.5 (6)`") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Exact current Google Play Closed testing - Alpha identity: **UNKNOWN**") &&
      docs["docs/APP_STORE_READINESS.md"].includes("targetSdkVersion` set to 36") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("do not request precise device location") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("do not prompt on first open") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Store Review Safety") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Stories, Stuff, Gigs, Merch, and booking/deposit routes") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Story, Gossip, Stuff, Gigs, Merch, booking") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("docs/REAL_DEVICE_QA_CHECKLIST.md") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("docs/SCREENSHOT_PREP.md") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("raw payment or payout credentials") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("reviewed seller-owned Payment Link") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("opens in the external browser") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("without a TTC payment, order, receipt, or success claim") &&
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
      docs["docs/SCREENSHOT_PREP.md"].includes("upload 2-8 JPEG or 24-bit PNG files with no") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("alpha, each 320-3840 px on every side") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("no more than a 2:1 aspect ratio") &&
      docs["docs/SCREENSHOT_PREP.md"].includes("one 1024 x 500 JPEG or 24-bit PNG with no") &&
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
      screenshotGenerator.includes("mobile-seller-payment-link-safe.png") &&
      screenshotGenerator.includes("mobile-seller-purchase-support-safe.png") &&
      screenshotGenerator.includes("mobile-listing-safety-safe.png") &&
      !screenshotGenerator.includes('"mobile-payout-safe.png": header') &&
      !screenshotGenerator.includes('"mobile-order-support-safe.png": header') &&
      !screenshotGenerator.includes('"mobile-merch-help-shortcut-safe.png": header') &&
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
      docs["docs/AGE_RATING_PREP.md"].includes("Support, Help, Child Safety Standards, Terms, Privacy") &&
      docs["docs/AGE_RATING_PREP.md"].includes("account deletion request, Child Safety Standards") &&
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
      docs["docs/DATA_SAFETY_PREP.md"].includes("Raw card, bank, routing, payout, external receipt, external shipping, and external transaction data must not be collected") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("New Merch payment processing happens through the seller's external checkout") &&
      !docs["docs/DATA_SAFETY_PREP.md"].includes("hosted payment-provider flows") &&
      !docs["docs/DATA_SAFETY_PREP.md"].includes("payment-provider reviews") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("coarse location") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("account deletion requests") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Google Play Data Safety must be current before closed testing, open testing, or production release") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("internal testing are currently exempt from public Data Safety section inclusion") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("internal-only exemption note, closed/open testing if used, and production") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("one private Google Play answer matrix for every declared data type") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Child safety standards, Health apps, Financial features") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("account-deletion web resource declarations") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("## Google Play Answer Matrix") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("support@thetattoocore.com") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("## App Store Privacy Evidence") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("reviewed against the submitted iOS build") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Privacy URL `https://thetattoocore.com/privacy`") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Device ID as linked to the member") &&
      docs["docs/DATA_SAFETY_PREP.md"].includes("Xcode aggregate Privacy Report") &&
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
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("seller-owned Payment Link terms") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("seller tax/shipping/return/refund/dispute/support duties") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Native app review") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Store submissions") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Accessibility Nutrition Labels") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Child Safety Standards") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("https://thetattoocore.com/child-safety-standards") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Do not store reviewer passwords") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Public URLs reviewed") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("block release, allow internal testing only, allow public release") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Seller-owned Merch remains gated") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("## Submission Signoff Matrix") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("exact build, release track, and web deploy") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Public legal URLs") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("account deletion request path match the submitted build") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Account deletion and retention") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Deletion SLA, manual review owner, retention exceptions") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("UGC and safety policy") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("report/block tools, moderation escalation") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Store questionnaires") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("App Privacy/Data Safety, age/content rating, optional Accessibility Nutrition Labels claims") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Google Play required declarations") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Xcode 26 and the iOS 26 SDK") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Android 16 / API 36 beginning August 31, 2026") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("same-app advertising or post boosts") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Native same-app ad checkout must remain blocked") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("must not mark it complete until the account") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Google Play Data Safety applies to apps on closed, open, and production") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Received DMs expose a per-message report control") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("the reporter belongs to the conversation") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("selected-build two-user DM reporting QA") &&
      !docs["docs/LEGAL_REVIEW_PREP.md"].includes("does not yet expose a message-report flow") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("evidence must show the actual submitted build with fictional or consented") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Play Age Signals API") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("significant-change notices") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("applicable age-signal/state-law decisions") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("https://developer.apple.com/news/upcoming-requirements/") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("https://support.google.com/googleplay/android-developer/answer/16569691") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Commerce and payments") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("exact-build physical-goods classification") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Native same-app advertising checkout remains gated") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Evidence privacy") &&
      docs["docs/LEGAL_REVIEW_PREP.md"].includes("Reviewer credentials, phone details, console screenshots, payment identifiers"),
  },
  {
    label: "real-device QA checklist covers app-critical flows",
    ok:
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Create a new account") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("forgot-password") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Stay signed in on this device") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("fully close and relaunch the Android and iOS apps") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("unchecked session remains session-only") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("4U") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Use the image crop tools") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Story photo/GIF/short video") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("No active stories yet") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Gossip") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Stuff") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Gigs") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Merch") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("DM") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Tag another known test account from 4U, Gossip, Gigs, and comments") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("stale notification that opens to a blocked, missing, or unauthorized page") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("4U, Gossip, Gigs, and comment tagging proof") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Attach a photo/GIF") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("DM access should come from the bottom DM shortcut") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("connected follower/following member's username") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("only the sent-message list scrolls") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("private profile connected by an accepted follow relationship") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("private Add to calendar download") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("verification") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Seller-Owned Merch Handoff") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run smoke:public") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run smoke:mobile") &&
      packageJson.includes('"smoke:mobile:narrow": "set SMOKE_MOBILE_WIDTH=320&& set SMOKE_MOBILE_HEIGHT=568&& node scripts/smoke-mobile-browser.mjs"') &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run smoke:mobile:narrow") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("320x568 without document overflow") &&
      packageJson.includes('"smoke:mobile:ios": "set SMOKE_MOBILE_PROFILE=ios&& node scripts/smoke-mobile-browser.mjs"') &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run smoke:mobile:ios") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("iPhone Safari-shaped scouting pass") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Google Play Production or controlled Alpha testing") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("TestFlight group") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("one actual iPhone/TestFlight device for release evidence") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("iPhone-sized browser viewport is useful for layout scouting only") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Open Admin > Media Ops") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Beta QA launch checklist") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("support/help/legal") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Support, Help, Child Safety Standards, Privacy, and Terms links") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("beta app testing guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Search/Saved guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("privacy/safety/support guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Booking guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("deposit confirmation") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Ads guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Merch-only ads") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Merch guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("seller-owned Payment Links") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Purchase Support guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Verification guide") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("unlocked tools") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("missing-detail fallback") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("No reload-loop screens") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Evidence Pack Template") &&
      packageJson.includes('"prepare:private-release-handoff": "node scripts/generate-private-release-handoff.mjs"') &&
      packageJson.includes('"smoke:handoff": "node scripts/smoke-private-handoff-template.mjs"') &&
      packageJson.includes("npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run smoke:handoff && npm run smoke:docs") &&
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
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Android Google Play install proof") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("iOS TestFlight install proof") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Android and iOS login/signup/reset staying inside the app") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Public Help, Support, Child Safety Standards, Privacy, and Terms links opening correctly") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Admin Payments review evidence using safe test references") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Accessibility Nutrition Labels proof") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("VoiceOver, Voice Control, Larger Text") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Accessibility Nutrition Labels Evidence Matrix") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("| Common task | VoiceOver | Voice Control | Larger Text | Differentiate Without Color Alone | Sufficient Contrast | Reduced Motion | Captions | Audio Descriptions | Repo-safe note |") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Sign up, log in, reset password, and open Help/Support/legal links.") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Repo-safe accessibility summary fields are limited to release candidate") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Native Build And Install Evidence Matrix") &&
      nativeBuildInstallMatrix.includes("| Android | Google Play Production;") &&
      nativeBuildInstallMatrix.includes("Closed testing - Alpha only for controlled QA.") &&
      nativeBuildInstallMatrix.includes("installed from Production") &&
      nativeBuildInstallMatrix.includes("same-account web opt-in") &&
      nativeBuildInstallMatrix.includes("12-tester participation, 14-day duration, feedback summary") &&
      nativeBuildInstallMatrix.includes("| iOS | TestFlight internal testing | iOS version/build number") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("release channel, version/build, date, device model, and pass/fail status") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("manual evidence only:") &&
      realDeviceSetup.includes("exact Google Play Production and Alpha identities") &&
      realDeviceSetup.includes("installed Android identity") &&
      realDeviceSetup.includes("Keep all three unknown until verified") &&
      realDeviceSetup.includes("source candidate or prior screenshot is not served-track or install proof") &&
      realDeviceSetup.includes("Only for Alpha controlled QA") &&
      realDeviceSetup.includes("selected Google Play account belongs to the configured tester community") &&
      realDeviceSetup.includes("blocks Alpha controlled-QA evidence only") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("automation unavailable") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("platform tools or `adb` missing from Windows PATH") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("Do not treat missing automation as a") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("## Android Connected-Device Probe") &&
      packageJson.includes('"verify:native-predevice": "npm run smoke:env && npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run smoke:handoff && npm run smoke:docs && npm run smoke:store && npm run smoke:mobile && npm run smoke:mobile:ios"') &&
      packageJson.includes('"verify:native-release": "npm run smoke:env && npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run smoke:handoff && npm run smoke:docs && npm run qa:android-device:required && npm run smoke:store && npm run smoke:mobile && npm run smoke:mobile:ios"') &&
      packageJson.includes('"qa:android-device": "node scripts/android-device-qa-probe.mjs"') &&
      packageJson.includes('"qa:android-device:required": "node scripts/android-device-qa-probe.mjs --require-device --wait-ms=30000"') &&
      packageJson.includes("npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run qa:android-device && npm run smoke:store") &&
      androidConnectedDeviceProbe.includes("npm.cmd run qa:android-device") &&
      androidConnectedDeviceProbe.includes("npm.cmd run qa:android-device:required") &&
      androidConnectedDeviceProbe.includes("separately verified Google Play track identity chosen for this QA pass") &&
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
      mobileCurrentPosition.includes("wrapper work is active") &&
      !mobileCurrentPosition.includes("wrapper work is starting") &&
      mobileCurrentPosition.includes("Checked-in Android source candidate: `1.0.5 (6)`") &&
      mobileCurrentPosition.includes("Checked-in iOS source candidate: `1.0 (5)`") &&
      mobileCurrentPosition.includes("Exact current Google Play Production identity: **UNKNOWN**") &&
      mobileCurrentPosition.includes("Exact current Google Play Closed testing - Alpha identity: **UNKNOWN**") &&
      mobileCurrentPosition.includes("Repository source identity is not signed-artifact, upload, console-selection, served-track, or installed-device proof") &&
      googlePlayInstallHandoff.length > 0 &&
      packageJson.includes('"qa:android-device:open-test": "node scripts/android-device-qa-probe.mjs --open-test-join"') &&
      googlePlayInstallHandoff.includes("npm.cmd run qa:android-device:open-test") &&
      docs["docs/REAL_DEVICE_QA_CHECKLIST.md"].includes("npm.cmd run qa:android-device:open-test") &&
      googlePlayInstallHandoff.includes("separately authorized read-only signed-in console/device verification") &&
      googlePlayInstallHandoff.includes("record the exact console-served identity") &&
      googlePlayInstallHandoff.includes("re-verified before QA or release claims") &&
      googlePlayInstallHandoff.includes("same account that belongs to the configured tester community") &&
      googlePlayInstallHandoff.includes("account has opted in") &&
      googlePlayInstallHandoff.includes("verified Production or Alpha listing") &&
      firstNativeBuildSteps.includes("do not claim any candidate is uploaded, selected, served, or installed") &&
      staleAlphaFirstOperationalSnippets.every(
        (snippet) => !currentAndroidOperationalText.includes(snippet),
      ) &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("release channel, version/build, install source, tester account pair") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("organization account. Google's current 12-testers-for-14-days production-access gate applies to newly created personal accounts") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Record a safe console/log review summary for mobile web, Android wrapper WebView, and iOS TestFlight") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("run the `Android Connected-Device Probe`") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Empty or unauthorized `adb devices -l` output is a handoff blocker") &&
      packageJson.includes('"verify:app-review-preflight": "npm run lint && npm run build && npm run smoke:env && npm run smoke:security && npm run smoke:content && npm run smoke:theme && npm run smoke:payments && npm run smoke:store && npm run smoke:pwa && npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run qa:android-device && npm run smoke:handoff && npm run smoke:docs && npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:narrow && npm run smoke:mobile:ios && npm run verify:distribution-evidence"') &&
      packageJson.includes('"verify:distribution-evidence": "npm run test:release-evidence-gate && node scripts/verify-release-evidence.mjs"') &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run verify:app-review-preflight") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes('$env:TTC_RELEASE_CANDIDATE="<current-git-commit-hash>"') &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("--release-candidate <current-git-commit-hash>") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("current local Git commit hash is mandatory") &&
      !docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("<current-production-version>") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("actual ignored private handoff") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("It checks lint, production build, production environment boundaries") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("content-policy/reporting guardrails") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("app-link association endpoints") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("the repo-safe Android connected-device probe") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("without counting technical checks as real-device or private console evidence") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run verify:native-predevice") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run verify:native-release") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("without counting as real-device evidence") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("checks environment boundaries, private native config exclusions, native wrapper and staged-alert safety, app-link association endpoints, private handoff-template validation, and readiness docs first") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("intentionally fails until the Android probe sees an authorized device") &&
      docs["native/thetattoocore-mobile/README.md"].includes("npm.cmd run verify:native-predevice") &&
      docs["native/thetattoocore-mobile/README.md"].includes("Use the pre-device command to check environment boundaries") &&
      docs["native/thetattoocore-mobile/README.md"].includes("app-link association endpoints") &&
      docs["native/thetattoocore-mobile/README.md"].includes("The release command checks the same starting") &&
      docs["native/thetattoocore-mobile/README.md"].includes("gates first") &&
      docs["native/thetattoocore-mobile/README.md"].includes("%LOCALAPPDATA%\\Android\\Sdk\\platform-tools\\adb.exe") &&
      docs["native/thetattoocore-mobile/README.md"].includes("ANDROID_QA adb_server=started") &&
      docs["native/thetattoocore-mobile/README.md"].includes("ANDROID_QA adb_server=start failed") &&
      docs["native/thetattoocore-mobile/README.md"].includes("waits briefly for USB/debug authorization") &&
      docs["native/thetattoocore-mobile/README.md"].includes("authorized device") &&
      docs["native/thetattoocore-mobile/README.md"].includes("separately verified Google Play track and installed identities selected for the QA pass") &&
      docs["native/thetattoocore-mobile/README.md"].includes("Google Play Production and controlled Alpha testing") &&
      docs["native/thetattoocore-mobile/README.md"].includes("Current Play Production release") &&
      docs["native/thetattoocore-mobile/README.md"].includes("tester participation/duration evidence"),
  },
  {
    label: "mobile submission runbook includes Stories, help, and booking deposit QA",
    ok:
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("4U, Stories, Gossip") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("booking/deposit paths") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("npm.cmd run smoke:mobile") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Support, Help, Child Safety Standards, Privacy, and Terms routes") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Search/Saved, Booking, Ads, Merch, Verification") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("privacy/safety Help Center guides") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("/help/beta-app-testing") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Merch guide shortcut") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("seller Payment Links") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Accessibility Nutrition Labels") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("VoiceOver, Voice Control, Larger Text") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("seller-owned external checkout") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("checkout-return handling") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("## Final Store-Console Evidence") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Build selection | Apple build number, Google release track") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Reviewer account | Reviewer test account email") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Final reviewer access | Selected Apple build and Google release track") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("`validated for selected build/track`") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Contact details | Support email, support URL, help URL, privacy URL") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Screenshot upload | App Store iPhone/iPad validation") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Category and pricing | App Store categories, Google Play category") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Content rights | Confirmation that icons, generated screenshots") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Privacy and data safety | App Privacy, Google Data Safety") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Age/content rating | App Store age rating, Google Play/IARC summary") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Accessibility Nutrition Labels | Optional VoiceOver, Voice Control, Larger Text") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Google Play required declarations | Child safety standards, Health apps") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Account deletion web resource | Public URL saved in Google Play") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Google Play closed testing | Tester list or Google Group selection") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("| Final validation | Console errors cleared") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("## Reviewer Notes Template") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("TheTattooCore is an 18+ body-art community app") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Visible nudity is not allowed") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Email: [enter reviewer account email in console only]") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Password: [enter reviewer password in console only]") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Help URL: https://thetattoocore.com/help") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Reporting, blocking, private-account controls") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("TTC Checkout, Connect, and destination-charge controls remain disabled and historical") &&
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
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Last checked: July 23, 2026") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple App Privacy: privacy policy URL is required") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple privacy manifests") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Generate Xcode's aggregate Privacy Report") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple Content Rights") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple age rating") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("saved higher-age override") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("random or anonymous chat is explicitly covered") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("TTC does not offer anonymous or random chat") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("one iPhone screenshot") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("current App Store Connect help") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("2064 x 2752 or 2048 x 2732") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple Accessibility Nutrition Labels") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple currently describes these labels as voluntary") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Apple minimum functionality") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("App/Universal Link handling") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Google Play target API") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Android 16 / API 36") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Checked-in Android source candidate: `1.0.5 (6)`") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("source does not prove a current") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Production, Alpha, or installed identity") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Re-verify those identities before") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Google Play production access") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("current 12-testers-for-14-days gate") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("applies to newly created personal accounts") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Google Play App content") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Child safety standards, Health apps, Financial") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Official source set checked: Apple App Store Connect App Privacy") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("screenshot specifications, screenshot upload, release notes") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Repo-safe current-rule source URLs") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://developer.apple.com/documentation/bundleresources/privacy-manifest-files") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://developer.apple.com/support/third-party-SDK-requirements/") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://developer.apple.com/app-store/app-privacy-details/") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://developer.apple.com/news/?id=d75yllv4") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://developer.android.com/google/play/requirements/target-sdk") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://support.google.com/googleplay/android-developer/answer/14747720") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("https://support.google.com/googleplay/android-developer/answer/13327111") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("private release handoff only"),
  },
  {
    label: "product plan uses plain push and translation roadmap wording",
    ok:
      docs["docs/PRODUCT_PLAN.md"].includes("installed app push third") &&
      docs["docs/PRODUCT_PLAN.md"].includes("mobile app push for iOS and Android apps") &&
      docs["docs/PRODUCT_PLAN.md"].includes("vetted translation service") &&
      docs["docs/PRODUCT_PLAN.md"].includes("seller-owned Payment Link") &&
      docs["docs/PRODUCT_PLAN.md"].includes("historical TTC seller-payout reconciliation") &&
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
      docs["docs/PRODUCT_PLAN.md"].includes("seller Payment Link review") &&
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
      helpArticlePage.includes("<ProtectedVideo") &&
      protectedVideo.includes('controlsList="nodownload noplaybackrate noremoteplayback"') &&
      protectedVideo.includes('preload="metadata"') &&
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
      helpCenterData.includes('assetSrc: "/screenshots/mobile-listing-safety-safe.png"') &&
      screenshotGenerator.includes('"mobile-listing-safety-safe.png"') &&
      existsSync(safeMerchShortcutScreenshotPath) &&
      statSync(safeMerchShortcutScreenshotPath).size > 10_000 &&
      !helpCenterData.includes('assetSrc: "/screenshots/mobile-payout-safe.png"') &&
      !helpCenterData.includes('assetSrc: "/screenshots/mobile-order-support-safe.png"') &&
      !helpCenterData.includes('assetSrc: "/screenshots/mobile-merch-help-shortcut-safe.png"') &&
      helpCenterData.includes('assetSrc: "/screenshots/mobile-seller-purchase-support-safe.png"') &&
      existsSync(safeSellerSupportScreenshotPath) &&
      statSync(safeSellerSupportScreenshotPath).size > 10_000 &&
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
      !helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-payment-safety-safe.mp4"') &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-app-wrapper-navigation-safe.mp4"') &&
      existsSync(safeAppWrapperClipPath) &&
      statSync(safeAppWrapperClipPath).size > 50_000 &&
      helpCenterData.includes('assetSrc: "/tutorial-clips/mobile-profile-photo-banner-safe.mp4"') &&
      existsSync(safeProfilePhotoClipPath) &&
      statSync(safeProfilePhotoClipPath).size > 50_000 &&
      helpShortClipBlocks.length >= 10 &&
      helpShortClipBlocks.every((block) => block.includes("assetSrc:")) &&
      helpTutorialAssetPaths.length >= 23 &&
      helpTutorialAssetPaths.every(isNonEmptyHelpTutorialAsset) &&
      helpCenterData.includes("Admin beta go/no-go") &&
      helpCenterData.includes("Two-user DM and notification pass") &&
      helpCenterData.includes("Booking request to calendar") &&
      helpCenterData.includes("Booking setup sections") &&
      helpCenterData.includes("Verification form basics") &&
      helpCenterData.includes("Submit for review walkthrough") &&
      helpCenterData.includes("Review ad credits") &&
      !helpCenterData.includes('title: "Use ad credits"') &&
      helpCenterData.includes("Merch product setup") &&
      helpCenterData.includes("Listing and seller link guide") &&
      helpCenterData.includes("Historical TTC order support") &&
      helpCenterData.includes('slug: "order-refunds-disputes"') &&
      helpCenterData.includes("Purchase support, refunds, and disputes") &&
      helpCenterData.includes("What happens if there is a dispute?") &&
      helpCenterData.includes("Seller purchase support") &&
      helpCenterData.includes("Fulfillment and refund review") &&
      helpCenterData.includes("Seller checkout and payment safety") &&
      helpCenterData.includes("Should I send private payment details to TTC?") &&
      !helpCenterData.includes("Payment safety walkthrough") &&
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
      helpCenterData.includes("Merch and orders") &&
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
      !helpCenterData.includes("payout setup") &&
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
      supportPage.includes("Product review, seller Payment Links") &&
      supportPage.includes("Seller-owned checkout readiness") &&
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
    label: "payment readiness preserves historical real-money evidence as non-operative",
    ok:
      paymentPilotHistoryIsUnambiguous(docs["docs/PAYMENT_PRODUCTION_READINESS.md"]) &&
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
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Separate Booking Deposit Procedure") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("### Historical TTC-Owned Production Evidence Pack - Non-Operative") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Live webhook event list captured and matched to the app-required event set") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Live/test mode setting, server payment key mode, and webhook mode reviewed together") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("receipt and reconciliation proof captured for the first genuine authorized Official TTC Merch customer sale") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Delayed or async payment success reconciliation captured before fulfillment, ad delivery, booking closeout, or seller payout release.") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Seller payout policy approval recorded with payout timing") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Separate Apple and Google Play exact-build physical-goods classification or reviewer-note evidence recorded privately before preauthorization") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Support, Terms, Privacy, and Help copy checked against the live build") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Repo-safe summary fields are limited to release candidate") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("### Historical TTC-Owned Live-Money Cutover Preflight Matrix - Non-Operative") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Flow | Mode and webhook preflight | Required live event proof | Admin reconciliation proof | Fulfillment or delivery gate | Payout/refund/dispute gate | Repo-safe result |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Official TTC Merch pilot checkout |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Marketplace Merch checkout |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Prepaid ad campaign checkout |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Booking deposit checkout |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("| Seller payout readiness |") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Official TTC Merch must be `armed` and every excluded flow must be `blocked`") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Admin > Payments reconciliation result") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Keep payment intent IDs, checkout session IDs") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("raw console exports in the private release handoff only") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("npm.cmd run smoke:env") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("npm.cmd run smoke:payments") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("environment drift, event coverage drift, and secret-boundary regressions") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Native checkout policy review must be dated") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Apple App Review Guidelines 3.1.3(e)") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("Google Play Payments policy section 3") &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes("exact-build reviewer notes or classification evidence remain pending by default") &&
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
    label: "payment readiness keeps the first launch scope and rollback explicit",
    ok:
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "The operating sequence is web-first for US-only, TTC-owned physical Merch; this is not technical native isolation because the iOS and Android wrappers load the production web app.",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Apple App Review Guidelines 3.1.3(e)",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "https://developer.apple.com/app-store/review/guidelines/",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Google Play Payments policy section 3",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "https://support.google.com/googleplay/android-developer/answer/9858738",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Both policies classify payments for physical goods outside store billing, but they do not prove approval for TheTattooCore's exact native builds.",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Exact-build Apple and Google Play review notes or physical-goods classification remain separate strict private preauthorization gates.",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Booking deposits, marketplace Merch, connected-account onboarding/routing, and ads remain disabled pending their separate approvals.",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Setting `STRIPE_EXPECTED_LIVEMODE=true` is not the checkout launch action; the creation master and selected flow gate are the exposure controls.",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Safe rollback disables `STRIPE_CHECKOUT_CREATION_ENABLED` while retaining the live expected mode, live key, and live webhook signing configuration so delayed events, refunds, disputes, expiration, and reconciliation continue.",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Never use real card details merely to test live mode. The first production proof must be a genuine authorized customer sale under normal terms, after the separate go-live approval.",
      ) &&
      docs["docs/PAYMENT_PRODUCTION_READINESS.md"].includes(
        "Do not claim the pilot is approved, deployed, or live.",
      ),
  },
  {
    label: "README keeps live-mode safety and pilot status explicit",
    ok:
      docs["README.md"].includes(
        "`STRIPE_EXPECTED_LIVEMODE`: keep `false` until live keys, live webhook handling, policy review, and the separate dark-staging approval are complete. Setting it to `true` is not the checkout launch action.",
      ) &&
      docs["README.md"].includes(
        "Never use real card details merely to test live mode.",
      ) &&
      docs["README.md"].includes(
        "The first production proof is a genuine authorized customer sale under normal terms after separate go-live approval.",
      ) &&
      docs["README.md"].includes(
        "Neither the historical TTC-owned pilot nor the seller-link release is approved, deployed, or live by this repository change.",
      ),
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
      docs["docs/APP_STORE_READINESS.md"].includes("## Public Distribution Blocker Matrix") &&
      docs["docs/APP_STORE_READINESS.md"].includes("## Before Public Distribution Or Any Replacement Submission") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("## Required Before Public Distribution Or Any Replacement Submission") &&
      docs["docs/APP_STORE_READINESS.md"].includes(appCurrentStoreIdentityHeading) &&
      docs["docs/APP_STORE_READINESS.md"].includes("| Surface | Repo-safe status | Next action | Private evidence location |") &&
      currentStoreConsoleSnapshot.includes("Exact current App Review identity: **UNKNOWN**") &&
      currentStoreConsoleSnapshot.includes("Exact current TestFlight identity: **UNKNOWN**") &&
      currentStoreConsoleSnapshot.includes("Exact current Google Play Production identity: **UNKNOWN**") &&
      currentStoreConsoleSnapshot.includes("Exact current Google Play Closed testing - Alpha identity: **UNKNOWN**") &&
      currentStoreConsoleSnapshot.includes("Last evidence-backed console/device baseline (July 24, 2026)") &&
      currentStoreConsoleSnapshot.includes("Repository source identity is not signed-artifact, upload, console-selection, served-track, or installed-device proof") &&
      currentStoreConsoleSnapshot.includes("separately authorized read-only signed-in console/device verification") &&
      currentStoreConsoleSnapshot.includes("Seller-owned external Merch checkout is selected") &&
      currentStoreConsoleSnapshot.includes("TTC_SELLER_CHECKOUT_LINKS_ENABLED=false") &&
      currentStoreConsoleSnapshot.includes("Follow the controlled seller-link rollout sequence in order") &&
      docs["docs/APP_STORE_READINESS.md"].includes(appHistoricalPaymentsHeading) &&
      docs["docs/APP_STORE_READINESS.md"].includes("Historical evidence only; it is not the current seller checkout path") &&
      docs["docs/APP_STORE_READINESS.md"].includes("native-alert source and private configuration evidence remains separate from store identity") &&
      docs["docs/APP_STORE_READINESS.md"].includes("service-only DM delivery outbox") &&
      docs["docs/APP_STORE_READINESS.md"].includes("before enabling global delivery or making store claims") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("TTC Firebase project has not been created yet") &&
      docs["docs/APP_STORE_READINESS.md"].includes("candidate source and prior device evidence do not prove a current store install") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("native Firebase/FCM delivery") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Complete the Native Push Private Evidence Matrix") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Private release handoff only") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Private payment handoff only") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Private native QA handoff only") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Store consoles") &&
      currentBlockerMatrix.includes("App Review, TestFlight, Google Play Production, and Closed testing - Alpha identities are UNKNOWN") &&
      currentBlockerMatrix.includes("re-verified before QA or release claims") &&
      docs["docs/APP_STORE_READINESS.md"].includes("13-inch iPad screenshots uploaded") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Content Rights") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Accessibility Nutrition Labels") &&
      (docs["docs/APP_STORE_READINESS.md"].includes("Data Safety review") ||
        docs["docs/APP_STORE_READINESS.md"].includes("Data Safety saved")) &&
      currentBlockerMatrix.includes("checked-in candidates `1.0.5 (6)` and `1.0 (5)`") &&
      docs["docs/APP_STORE_READINESS.md"].includes("applicable tester evidence") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Legal and policy") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Final counsel-reviewed Terms/Privacy") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Real-device QA") &&
      docs["docs/APP_STORE_READINESS.md"].includes("full two-user DM read/reply pass") &&
      currentBlockerMatrix.includes("Seller-owned Merch checkout") &&
      currentBlockerMatrix.includes("TTC does not process the new external purchase or seller payout") &&
      currentBlockerMatrix.includes("second inactive-upload inspection and explicit owner approval") &&
      !staleCurrentSellerCheckoutSnippets.some((snippet) =>
        currentBlockerMatrix.toLowerCase().includes(snippet),
      ) &&
      !docs["docs/APP_STORE_READINESS.md"].includes("Stripe Connect or manual payout process") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("hosted onboarding links") &&
      !docs["docs/APP_STORE_READINESS.md"].includes("provider review") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Native wrapper") &&
      docs["docs/APP_STORE_READINESS.md"].includes("Android API 36") &&
      docs["docs/APP_STORE_READINESS.md"].includes("checked-in Android source candidate `1.0.5 (6)`") &&
      docs["docs/APP_STORE_READINESS.md"].includes("App Link evidence must be repeated on the re-verified exact build") &&
      docs["docs/APP_STORE_READINESS.md"].includes("iOS Universal Link and broader exact-build evidence remain incomplete") &&
      docs["docs/MOBILE_APP_SUBMISSION_RUNBOOK.md"].includes("Run `npm.cmd run smoke:app-links` after every deploy") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Run `npm.cmd run smoke:app-links` after deployment") &&
      docs["docs/STORE_LISTING_DRAFT.md"].includes("Child Safety Standards: https://thetattoocore.com/child-safety-standards") &&
      docs["native/store-metadata/README.md"].includes("Child Safety Standards URL: `https://thetattoocore.com/child-safety-standards`"),
  },
  {
    label: "native push setup evidence stays private and route-testable",
    ok:
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("## Native Push Private Evidence Matrix") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| Firebase project | Project exists for TheTattooCore") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| Android app config | Android app config file added only to the private build environment") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("| iOS app config | Checked-in iOS source candidate `1.0 (5)` references the ignored private app-config path") &&
      docs["docs/NATIVE_WRAPPER_PREP.md"].includes("Source does not prove that private configuration, signing, TestFlight selection, or an installed build is current") &&
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
      packageJson.includes('"smoke:dm": "node scripts/test-message-conversation-selection.mjs && node scripts/test-messaging-notifications-contracts.mjs && node scripts/test-phase3-db-contracts.mjs && node scripts/smoke-dm-guards.mjs"') &&
      packageJson.includes("npm run smoke:stories && npm run smoke:dm && npm run smoke:booking") &&
      packageJson.includes("npm run smoke:env && npm run smoke:security && npm run smoke:content && npm run smoke:theme && npm run smoke:payments && npm run smoke:store && npm run smoke:pwa && npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run qa:android-device && npm run smoke:handoff && npm run smoke:docs && npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:narrow && npm run smoke:mobile:ios && npm run verify:distribution-evidence") &&
      packageJson.includes("npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run qa:android-device && npm run smoke:store") &&
      packageJson.includes("npm run smoke:env && npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run smoke:handoff && npm run smoke:docs && npm run smoke:store && npm run smoke:mobile && npm run smoke:mobile:ios") &&
      packageJson.includes("npm run smoke:env && npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run smoke:handoff && npm run smoke:docs && npm run qa:android-device:required && npm run smoke:store") &&
      packageJson.includes("npm run smoke:public && npm run smoke:mobile && npm run smoke:mobile:narrow && npm run smoke:mobile:ios") &&
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
