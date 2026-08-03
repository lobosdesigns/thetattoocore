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

const currentUnknownRows = [
  "| Current App Review version/build | UNKNOWN |",
  "| Current TestFlight version/build | UNKNOWN |",
  "| Current Google Play Production version/build | UNKNOWN |",
  "| Current Google Play Alpha version/build | UNKNOWN |",
  "| Current installed Android version/build | UNKNOWN |",
  "| Current installed TestFlight iPad version/build | UNKNOWN |",
];
const retiredActiveHandoffInstructions = [
  "Official TTC Merch checkout",
  "Marketplace Merch checkout",
  "Seller payout readiness",
  "Official TTC Merch is Armed",
  "Enable Official TTC Merch checkout",
  "production app mode preflight",
];
const sellerRolloutSteps = [
  "1. Approved migration",
  "2. First inactive Worker upload",
  "3. Deploy while disabled",
  "4. Private seller link review",
  "5. Second inactive upload and approval",
  "6. Cross-platform QA",
  "7. Rollback",
];

function containsInOrder(source, snippets) {
  let cursor = 0;
  for (const snippet of snippets) {
    const index = source.indexOf(snippet, cursor);
    if (index < 0) return false;
    cursor = index + snippet.length;
  }
  return true;
}

function releaseCandidateKeepsCurrentStateUnknown(source) {
  const start = source.indexOf("## Release Candidate");
  const end = source.indexOf("## Current Console Blockers To Clear", start);
  if (start < 0 || end < 0) return false;

  const section = source.slice(start, end);
  const hardcodedCurrentIdentity =
    /Current (?:App Review|TestFlight|Google Play (?:Production|Alpha)|installed (?:Android|TestFlight iPad))[^\r\n|]*\d+(?:\.\d+)+\s*\(\d+\)/i;

  return (
    currentUnknownRows.every(
      (row) => section.split(row).length - 1 === 1,
    ) && !hardcodedCurrentIdentity.test(section)
  );
}

function activeHandoffUsesSellerOwnedTruth(source) {
  return (
    source.includes("| Android checked-in source candidate | 1.0.5 (6) |") &&
    source.includes("| iOS checked-in source candidate | 1.0 (5) |") &&
    releaseCandidateKeepsCurrentStateUnknown(source) &&
    source.includes("## Seller-Owned Merch Rollout Evidence") &&
    source.includes("seller-owned Payment Link") &&
    source.includes("seller handles purchase support") &&
    source.includes("external browser") &&
    source.includes("no false TTC payment, order, receipt, or success state") &&
    source.includes("TTC_SELLER_CHECKOUT_LINKS_ENABLED=false") &&
    source.includes("TTC_NATIVE_PUSH_DELIVERY_ENABLED=false") &&
    source.includes("STRIPE_EXPECTED_LIVEMODE=false") &&
    containsInOrder(source, sellerRolloutSteps) &&
    retiredActiveHandoffInstructions.every((text) => !source.includes(text))
  );
}

const activeHandoffMutants = [
  generator.replace(
    "## Release Candidate",
    "## Release Candidate\n\nCurrent App Review 1.0 (3) is selected.",
  ),
  generator.replace(
    "## Seller-Owned Merch Rollout Evidence",
    "## Seller-Owned Merch Rollout Evidence\n\nEnable Official TTC Merch checkout and seller payout readiness for release.",
  ),
];

const checks = [
  {
    label: "private handoff output is ignored and generated locally",
    ok:
      packageJson.includes(
        '"prepare:private-release-handoff": "node scripts/generate-private-release-handoff.mjs"',
      ) &&
      packageJson.includes(
        '"prepare:private-console-tabs": "node scripts/write-private-console-tabs.mjs"',
      ) &&
      packageJson.includes(
        '"smoke:handoff": "node scripts/smoke-private-handoff-template.mjs"',
      ) &&
      gitignore.includes("/private-release-handoff/") &&
      generator.includes('const outputDir = "private-release-handoff"') &&
      generator.includes("if (existsSync(outputPath))") &&
      generator.includes("copyFileSync(outputPath, backupPath)") &&
      generator.includes("writeFileSync(outputPath, template)"),
  },
  {
    label: "private handoff defaults current distribution state to unknown and rejects retired payment instructions",
    ok:
      activeHandoffUsesSellerOwnedTruth(generator) &&
      activeHandoffMutants.every(
        (mutant) => !activeHandoffUsesSellerOwnedTruth(mutant),
      ),
  },
  {
    label: "private handoff keeps source candidates separate from supplied distribution evidence",
    ok:
      generator.includes("Repository source identity is not") ||
      (generator.includes("checked-in source candidate") &&
        generator.includes("Current App Review version/build") &&
        generator.includes("Current TestFlight version/build") &&
        generator.includes("Current Google Play Production version/build") &&
        generator.includes("Current Google Play Alpha version/build") &&
        generator.includes("Current installed Android version/build") &&
        generator.includes("Current installed TestFlight iPad version/build")),
  },
  {
    label: "current package commands use seller-link evidence and exclude retired go-live paths",
    ok:
      packageJson.includes(
        '"smoke:seller-link-rollout": "node scripts/smoke-payment-cutover-evidence.mjs"',
      ) &&
      packageJson.includes(
        '"test:seller-link-rollout-evidence": "node scripts/test-payment-go-live-gate.mjs"',
      ) &&
      packageJson.includes(
        '"verify:seller-link-rollout-evidence": "npm run smoke:env && npm run test:seller-link-rollout-evidence && node scripts/smoke-payment-cutover-evidence.mjs --strict"',
      ) &&
      !packageJson.includes('"verify:payment-go-live"') &&
      !packageJson.includes('"verify:payment-production-evidence"') &&
      !packageJson.includes('"smoke:payment-cutover"') &&
      !packageJson.includes('"test:payment-go-live-gate"'),
  },
  {
    label: "distribution evidence gate fails closed on unknown private state",
    ok:
      evidenceGate.includes('const SOURCE_ANDROID_CANDIDATE = "1.0.5 (6)"') &&
      evidenceGate.includes('const SOURCE_IOS_CANDIDATE = "1.0 (5)"') &&
      evidenceGate.includes("function currentIdentityBuild(area, label, value)") &&
      evidenceGate.includes('fail(area, `current ${label} identity cannot be UNKNOWN`)') &&
      evidenceGate.includes("function requireCurrentCandidateBuild(area, label, value, sourceCandidate)") &&
      evidenceGate.includes('"App Review",') &&
      evidenceGate.includes('"TestFlight",') &&
      evidenceGate.includes('"Google Play Production",') &&
      evidenceGate.includes('"Google Play Alpha",') &&
      evidenceGate.includes('"installed Android",') &&
      evidenceGate.includes('"installed TestFlight iPad",') &&
      evidenceGateTest.includes('label: "release evidence fails closed when current App Review identity is unknown"') &&
      evidenceGateTest.includes('label: "release evidence rejects candidate-only state presented as served evidence"') &&
      !evidenceGate.includes("EXPECTED_IOS_REVIEW_BUILD") &&
      !evidenceGate.includes("App Review must remain on build"),
  },
  {
    label: "release evidence fixture supplies private identities and tests unknown rejection",
    ok:
      evidenceFixture.includes("TTC_SANITIZED_RELEASE_EVIDENCE_FIXTURE") &&
      evidenceFixture.includes("| Android checked-in source candidate | 1.0.5 (6) |") &&
      evidenceFixture.includes("| iOS checked-in source candidate | 1.0 (5) |") &&
      evidenceFixture.includes("| Current App Review version/build |") &&
      evidenceFixture.includes("| Current TestFlight version/build |") &&
      evidenceFixture.includes("| Current Google Play Production version/build |") &&
      evidenceFixture.includes("| Current Google Play Alpha version/build |") &&
      !currentUnknownRows.some((row) => evidenceFixture.includes(row)) &&
      evidenceGateTest.includes(
        "release evidence fails closed when current App Review identity is unknown",
      ) &&
      evidenceGateTest.includes(
        "release evidence rejects candidate-only state presented as served evidence",
      ),
  },
  {
    label: "private handoff defaults native physical-goods review to pending",
    ok:
      generator.includes(
        "| Apple | Native physical-goods classification and review evidence |",
      ) &&
      generator.includes(
        "| Google Play | Native physical-goods classification and review evidence |",
      ) &&
      generator.match(/Native physical-goods classification and review evidence[^\n]+\| pending \| \|/g)
        ?.length === 2,
  },
  {
    label: "private handoff blocks sensitive evidence from repository output",
    ok:
      generator.includes("Do not commit reviewer passwords") &&
      generator.includes("one-time codes") &&
      generator.includes("tester emails") &&
      generator.includes("account identifiers") &&
      generator.includes("raw device logs") &&
      generator.includes("console screenshots") &&
      generator.includes("bank/card details") &&
      generator.includes("buyer addresses") &&
      generator.includes("private user content") &&
      generator.includes("Do not paste a seller") &&
      generator.includes("URL, account identifier, buyer data, receipt, transaction record, or secret here"),
  },
  {
    label: "private console tab writer keeps exact URLs local only",
    ok:
      consoleTabsWriter.includes("private-release-handoff/console-tabs.json") &&
      consoleTabsWriter.includes("Keep this off git") &&
      !consoleTabsWriter.includes("play.google.com/console") &&
      !consoleTabsWriter.includes("appstoreconnect.apple.com/apps") &&
      !consoleTabsWriter.includes("dashboard.stripe.com/acct_"),
  },
  {
    label: "readiness docs point private evidence to the ignored handoff",
    ok:
      mobileRunbook.includes("npm.cmd run prepare:private-release-handoff") &&
      mobileRunbook.includes("Keep the generated `private-release-handoff/` folder out of git") &&
      realDeviceQa.includes("npm.cmd run prepare:private-release-handoff") &&
      realDeviceQa.includes("private-release-handoff/"),
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
