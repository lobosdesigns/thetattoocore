import { readFileSync } from "node:fs";

const generator = readFileSync("scripts/generate-private-release-handoff.mjs", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const mobileRunbook = readFileSync("docs/MOBILE_APP_SUBMISSION_RUNBOOK.md", "utf8");
const realDeviceQa = readFileSync("docs/REAL_DEVICE_QA_CHECKLIST.md", "utf8");
const consoleTabsWriter = readFileSync("scripts/write-private-console-tabs.mjs", "utf8");
const evidenceGate = readFileSync("scripts/verify-release-evidence.mjs", "utf8");
const evidenceFixture = readFileSync(
  "scripts/fixtures/release-evidence.passed.md",
  "utf8",
);
const evidenceGateTest = readFileSync(
  "scripts/test-release-evidence-gate.mjs",
  "utf8",
);

const checks = [
  {
    label: "private handoff output is ignored and generated locally",
    ok:
      packageJson.includes('"prepare:private-release-handoff": "node scripts/generate-private-release-handoff.mjs"') &&
      packageJson.includes('"prepare:private-console-tabs": "node scripts/write-private-console-tabs.mjs"') &&
      packageJson.includes('"smoke:handoff": "node scripts/smoke-private-handoff-template.mjs"') &&
      packageJson.includes('"verify:release-evidence": "node scripts/verify-release-evidence.mjs"') &&
      packageJson.includes('"verify:distribution-evidence": "npm run test:release-evidence-gate && node scripts/verify-release-evidence.mjs"') &&
      packageJson.includes('"test:distribution-evidence-command": "node scripts/test-distribution-evidence-command.mjs"') &&
      packageJson.includes('"test:release-evidence-gate": "node scripts/test-release-evidence-gate.mjs"') &&
      packageJson.includes("npm run smoke:mobile:ios && npm run verify:distribution-evidence") &&
      packageJson.includes("npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run smoke:handoff && npm run smoke:docs") &&
      packageJson.includes("npm run smoke:payments && npm run smoke:payment-cutover && npm run smoke:pwa && npm run smoke:security && npm run smoke:handoff && npm run smoke:docs") &&
      packageJson.includes("npm run smoke:store && npm run smoke:pwa && npm run smoke:handoff && npm run smoke:docs") &&
      gitignore.includes("/private-release-handoff/") &&
      generator.includes('const outputDir = "private-release-handoff"') &&
      generator.includes('const outputPath = join(outputDir, "release-handoff-template.md")') &&
      generator.includes("mkdirSync(outputDir, { recursive: true })") &&
      generator.includes("if (existsSync(outputPath))") &&
      generator.includes("copyFileSync(outputPath, backupPath)") &&
      generator.includes("Preserved existing handoff") &&
      generator.includes("writeFileSync(outputPath, template)"),
  },
  {
    label: "private handoff template covers store, QA, payment, legal, and push evidence",
    ok:
      generator.includes("## Store Console Evidence") &&
      generator.includes("## Reviewer Access") &&
      generator.includes("## Real-Device QA") &&
      generator.includes("Result | Proof filename | Proof date") &&
      generator.includes("## Two-User DM Evidence") &&
      generator.includes("Private proof filename or location | Proof date") &&
      generator.includes("## Payment And Commerce Evidence") &&
      packageJson.includes('"smoke:payment-cutover": "node scripts/smoke-payment-cutover-evidence.mjs"') &&
      generator.includes("Release candidate") &&
      generator.includes("Expected mode checked") &&
      generator.includes("Server key mode checked") &&
      generator.includes("Webhook endpoint/events checked") &&
      generator.includes("Penny/live-test proof") &&
      generator.includes("Seller payout readiness") &&
      generator.includes("## Payment Dashboard Readiness Log") &&
      generator.includes("Use this for private payment dashboard evidence before any live-money cutover") &&
      generator.includes("Account verification") &&
      generator.includes("Verify email, business, profile, verified status, and identity readiness") &&
      generator.includes("Connect setup") &&
      generator.includes("Business model, connected-account test, and integration-guide choices") &&
      generator.includes("API and webhook mode") &&
      generator.includes("Expected live/test mode, server key mode, webhook endpoint, and event list match the release candidate") &&
      generator.includes("Live-money proof") &&
      generator.includes("Penny test, Admin reconciliation, refund/dispute procedure, payout gate, and native checkout policy review") &&
      generator.includes("## Native Push Evidence") &&
      generator.includes("Use this for private Android/iOS alert evidence only") &&
      generator.includes("project IDs, sender") &&
      generator.includes("app config files, device tokens") &&
      generator.includes("Evidence area | Platform | Required private proof | Repo-safe result") &&
      generator.includes("Project exists") &&
      generator.includes("TTC push project exists with Android and iOS apps registered for com.thetattoocore.app") &&
      generator.includes("Android app config is present only in the private build environment and excluded from git") &&
      generator.includes("iOS app config is present only in the private build environment and excluded from git") &&
      generator.includes("Device token registration") &&
      generator.includes("registers a device token") &&
      generator.includes("exact version name and version code") &&
      generator.includes("exact TestFlight version and build number") &&
      generator.includes("Test alert reaches the Android device for the selected release track and build") &&
      generator.includes("Test alert reaches the iOS device for the selected TestFlight build") &&
      generator.includes("Tapping the alert opens the expected safe in-app destination") &&
      generator.includes("Opt-out, quiet hours, and category preferences suppress delivery where expected") &&
      generator.includes("## Legal And Policy Review") &&
      generator.includes("## Legal Submission Signoff Matrix") &&
      generator.includes("exact build, release track, and web deploy") &&
      generator.includes("Public legal URLs") &&
      generator.includes("Child Safety Standards") &&
      generator.includes("account deletion request path match the submitted build") &&
      generator.includes("Account deletion and retention") &&
      generator.includes("Deletion SLA, manual review owner, retention exceptions") &&
      generator.includes("UGC and safety policy") &&
      generator.includes("no visible nudity, no scratcher promotion, no AI art/search claims") &&
      generator.includes("Store questionnaires") &&
      generator.includes("App Privacy/Data Safety, age/content rating, optional Accessibility Nutrition Labels claims") &&
      generator.includes("Google Play declarations") &&
      generator.includes("Commerce and payments") &&
      generator.includes("native payment-policy classification") &&
      generator.includes("Evidence privacy") &&
      generator.includes("Reviewer credentials, phone details, console screenshots, payment identifiers") &&
      generator.includes("Reviewer contact saved in consoles") &&
      generator.includes("## Current Console Blockers To Clear") &&
      generator.includes("App Review monitoring and response evidence") &&
      generator.includes("iOS App Version 1.0 build 1.0 (3) submitted for App Review") &&
      generator.includes("reviewer messages, status changes, rejection notes, or approval proof privately") &&
      generator.includes("Submitted-build console field evidence") &&
      generator.includes("selected build, 13-inch iPad screenshot upload, primary category, free pricing") &&
      generator.includes("Content Rights, App Privacy, Privacy Policy URL, and Age 18+ override") &&
      generator.includes("Apple currently treats these labels as voluntary") &&
      generator.includes("leave them unclaimed unless submitted-build iPhone/iPad QA supports an honest label") &&
      generator.includes("Organization account confirmed") &&
      generator.includes("personal-account 12-tester/14-day production-access gate is not applicable") &&
      generator.includes("Closed-test tester links and opt-in evidence") &&
      generator.includes("Save Android/web join links privately") &&
      generator.includes("device Play account matches the tester-community member") &&
      generator.includes("confirm web opt-in with that account") &&
      generator.includes("listing/install proof") &&
      generator.includes("## Google Play Tester Install Evidence") &&
      generator.includes("Device Play account matches tester member") &&
      generator.includes("Web opt-in accepted") &&
      generator.includes("Android listing offers Install/Update") &&
      generator.includes("Installed release/version/build") &&
      generator.includes("A missing listing, account mismatch, or unconfirmed web opt-in is a blocker") &&
      generator.includes("API 36 signed upload bundle") &&
      generator.includes("Version code 4 / version name 1.0.3 API 36 update is active and verified installed") &&
      generator.includes("do not upload the same version code again") &&
      generator.includes("archive tester participation evidence") &&
      generator.includes("Console submit/retry evidence") &&
      generator.includes("record the visible error code, page URL, retry path") &&
      generator.includes("whether reload/new-tab retry was attempted") &&
      generator.includes("Publishing overview still shows changes not sent for review") &&
      generator.includes("Account activation and Connect setup") &&
      generator.includes("Sandbox test connected account and marketplace destination-charge integration guide are confirmed") &&
      generator.includes("account, email, business, identity, and production verification still need private completion evidence") &&
      generator.includes("Production app mode preflight") &&
      generator.includes("explicit mode Needs review, server key mode Test, webhook signing Ready") &&
      generator.includes("checkout blocked until the expected mode is readable and matched | blocked") &&
      generator.includes("## Google Play Closed-Test Retry Log") &&
      generator.includes("Visible status or error code") &&
      generator.includes("reload and saved-tab retry if status changes or install link fails") &&
      generator.includes("Next retry owner") &&
      generator.includes("Google Play API 36 signed upload bundle") &&
      generator.includes("Google Play closed-test tester links") &&
      generator.includes("Google Play phone screenshots") &&
      generator.includes("Google Play feature graphic") &&
      generator.includes("App Store iPhone 6.5-inch screenshots") &&
      generator.includes("App Store 13-inch iPad screenshots") &&
      generator.includes("Accessibility Nutrition Labels") &&
      generator.includes("Child safety standards declaration") &&
      generator.includes("Health apps declaration") &&
      generator.includes("Financial features declaration") &&
      generator.includes("Ads declaration") &&
      generator.includes("Account deletion web resource") &&
      generator.includes("Production-access closed test, if required") &&
      generator.includes("## Private Console Tab Restore") &&
      generator.includes("active launch-console tabs need a crash-safe handoff") &&
      generator.includes("exact console URLs private") &&
      generator.includes("TheTattooCore Launch Console Tabs.html") &&
      generator.includes("Google Play, App Store Connect, Firebase console, payment dashboard, owner TTC app session") &&
      generator.includes("Alert delivery") &&
      generator.includes("Tap routing"),
  },
  {
    label: "strict release evidence gate is exact-build and privacy-safe",
    ok:
      evidenceGate.includes('const EXPECTED_ANDROID_BUILD = "1.0.3 (4)"') &&
      evidenceGate.includes('const EXPECTED_IOS_TESTFLIGHT_BUILD = "1.0 (4)"') &&
      evidenceGate.includes('const EXPECTED_IOS_REVIEW_BUILD = "1.0 (3)"') &&
      evidenceGate.includes("private release evidence requirement(s) remain incomplete") &&
      evidenceGate.includes("--test-fixture") &&
      evidenceGate.includes("TTC_SANITIZED_RELEASE_EVIDENCE_FIXTURE") &&
      evidenceGate.includes("sanitized fixtures cannot approve a live release") &&
      evidenceGate.includes("function requireExact") &&
      evidenceGate.includes("const REQUIRED_LEGAL_REVIEW_AREAS = [") &&
      evidenceGate.includes("const REQUIRED_LEGAL_SIGNOFF_AREAS = [") &&
      evidenceGate.includes("function requiredUniqueRow") &&
      evidenceGate.includes("process.env.TTC_RELEASE_CANDIDATE") &&
      evidenceGate.includes("current web release candidate is required") &&
      evidenceGate.includes("const MAX_PROOF_AGE_DAYS = 45") &&
      evidenceGate.includes("function requireProofDate") &&
      evidenceGateTest.includes("release evidence rejects an unbound candidate") &&
      evidenceGateTest.includes("release evidence rejects sanitized fixtures outside fixture mode") &&
      evidenceGateTest.includes("release evidence requires an explicit fixture marker") &&
      evidenceGateTest.includes("release evidence rejects a partial candidate match") &&
      evidenceGateTest.includes("release evidence rejects fixture proof in live evidence") &&
      evidenceGateTest.includes("release evidence rejects a missing legal review row") &&
      evidenceGateTest.includes("release evidence rejects duplicate legal signoff rows") &&
      evidenceGateTest.includes("release evidence rejects stale legal review dates") &&
      evidenceGateTest.includes("release evidence rejects future legal signoff dates") &&
      evidenceGateTest.includes("release evidence rejects a stale candidate") &&
      evidenceGateTest.includes("release evidence rejects an invalid candidate format") &&
      evidenceGateTest.includes("release evidence rejects missing critical private proof") &&
      evidenceGateTest.includes("release evidence rejects stale critical private proof") &&
      evidenceGateTest.includes("release evidence rejects a mismatched tester build") &&
      evidenceGateTest.includes("release evidence rejects stale real-device proof dates") &&
      evidenceGateTest.includes("release evidence rejects promoted Android install-only QA") &&
      evidenceGateTest.includes("release evidence rejects promoted iPad install-only QA") &&
      evidenceGateTest.includes("release evidence rejects historical two-user DM builds") &&
      evidenceGate.includes("Android install source must be Google Play") &&
      evidenceGate.includes("Android evidence basis must be device-captured") &&
      evidenceGate.includes("Android QA scope must be full checklist") &&
      evidenceGate.includes("iOS device model must be an iPhone") &&
      evidenceGate.includes("iOS evidence basis must be device-captured") &&
      evidenceGate.includes("iOS QA scope must be full checklist") &&
      evidenceGate.includes('row?.["Build or release version"]') &&
      generator.includes("| Platform | Build or release version | Sender alias | Recipient alias |") &&
      evidenceFixture.includes("| Android | 1.0.3 (4) | fixture-sender | fixture-recipient |") &&
      evidenceFixture.includes("| iOS | 1.0 (4) | fixture-sender | fixture-recipient |") &&
      generator.includes("Android must come from Google Play") &&
      generator.includes("actual iPhone") &&
      generator.includes("keep iPad install-only") &&
      !evidenceGate.includes("console.error(markdown") &&
      evidenceFixture.includes("TTC_SANITIZED_RELEASE_EVIDENCE_FIXTURE") &&
      evidenceFixture.includes("fixture-release-candidate") &&
      evidenceFixture.includes("Closed testing - Alpha 1.0.3 (4)") &&
      evidenceFixture.includes("App Review 1.0 (3)") &&
      evidenceFixture.includes("| Accessibility Nutrition Labels | n/a | n/a |") &&
      evidenceFixture.includes("| Child safety standards declaration | n/a | passed |") &&
      evidenceFixture.includes("| Account deletion web resource | n/a | passed |") &&
      evidenceFixture.includes("| iOS | iPhone fixture-device | iOS current | 1.0 (4) | TestFlight | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-07-23 |"),
  },
  {
    label: "private console tab writer keeps exact URLs local-only",
    ok:
      consoleTabsWriter.includes("private-release-handoff/console-tabs.json") &&
      consoleTabsWriter.includes("TheTattooCore Launch Console Tabs.html") &&
      consoleTabsWriter.includes("Console tab restore files must be written to Desktop or private-release-handoff") &&
      consoleTabsWriter.includes("Keep this off git") &&
      consoleTabsWriter.includes("target=\"_blank\"") &&
      consoleTabsWriter.includes("window.open(tab.url") &&
      !consoleTabsWriter.includes("play.google.com/console") &&
      !consoleTabsWriter.includes("appstoreconnect.apple.com/apps") &&
      !consoleTabsWriter.includes("dashboard.stripe.com/acct_") &&
      !consoleTabsWriter.includes("console.firebase.google.com/u/"),
  },
  {
    label: "private handoff template blocks sensitive evidence from repo docs",
    ok:
      generator.includes("Do not commit reviewer passwords") &&
      generator.includes("one-time codes") &&
      generator.includes("tester emails") &&
      generator.includes("personal phone") &&
      generator.includes("account identifiers") &&
      generator.includes("raw device logs") &&
      generator.includes("console screenshots") &&
      generator.includes("payment") &&
      generator.includes("bank/card details") &&
      generator.includes("private DMs") &&
      generator.includes("license documents") &&
      generator.includes("buyer addresses") &&
      generator.includes("private user content") &&
      generator.includes("Repo-visible summaries should use only platform") &&
      generator.includes("pass/fail/blocker status"),
  },
  {
    label: "readiness docs point private evidence collection to the ignored template",
    ok:
      mobileRunbook.includes("npm.cmd run prepare:private-release-handoff") &&
      mobileRunbook.includes("npm.cmd run prepare:private-console-tabs") &&
      mobileRunbook.includes("Keep the generated `private-release-handoff/` folder out of git") &&
      mobileRunbook.includes("Keep exact console tab URLs in the ignored private handoff folder or Desktop restore file only") &&
      mobileRunbook.includes("copy only repo-safe pass/fail summaries back into readiness docs") &&
      realDeviceQa.includes("npm.cmd run prepare:private-release-handoff") &&
      realDeviceQa.includes("The generated") &&
      realDeviceQa.includes("private-release-handoff/") &&
      realDeviceQa.includes("console, device, payment, legal, and push-delivery evidence only"),
  },
];

let failures = 0;

for (const check of checks) {
  if (check.ok) {
    console.log(`PASS ${check.label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${check.label}`);
  }
}

if (failures > 0) {
  console.error(`${failures} private handoff smoke check(s) failed.`);
  process.exit(1);
}
