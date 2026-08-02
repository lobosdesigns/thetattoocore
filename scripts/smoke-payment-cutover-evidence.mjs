import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const generator = readFileSync("scripts/generate-private-release-handoff.mjs", "utf8");
const paymentReadiness = readFileSync("docs/PAYMENT_PRODUCTION_READINESS.md", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const commerceLaunch = readFileSync("src/lib/commerce-launch.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const stripeReleaseGates = readFileSync("src/lib/stripe/release-gates.ts", "utf8");
const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");
const merchCheckout = readFileSync("src/app/api/merch/checkout/route.ts", "utf8");
const stripeConnectOnboarding = readFileSync(
  "src/app/api/stripe/connect/onboarding/route.ts",
  "utf8",
);

function adPurchasesDisabledInSource(source) {
  return (
    source.match(
      /^\s*export const AD_PURCHASES_AVAILABLE = (true|false);\s*$/m,
    )?.[1] === "false"
  );
}

const selectedPilotFlow = "Official TTC Merch checkout";
const excludedPilotFlows = [
  "Marketplace Merch checkout",
  "Booking deposit",
  "Ads checkout",
  "Seller payout readiness",
];
const requiredFlows = [
  selectedPilotFlow,
  ...excludedPilotFlows,
];

const preauthorizationEvidenceColumns = [
  "Expected mode checked",
  "Server key mode checked",
  "Webhook endpoint/events checked",
  "Admin reconciliation",
  "Refund/dispute/payout gate",
];
const postTransactionEvidenceColumn = "Post-transaction production proof";
const requiredEvidenceColumns = [
  "Release candidate",
  "Release switch state",
  "Private gate proof filename or location",
  ...preauthorizationEvidenceColumns,
  postTransactionEvidenceColumn,
  "Result",
];
const requiredDashboardAreas = [
  "Account verification",
  "API and webhook mode",
  "Release switches",
  "Post-transaction production proof",
];
const requiredPaymentBlockers = [
  "Production account activation",
  "Production app mode preflight",
  "Official Merch policy and fulfillment approval",
];
const defaultPrivateEvidencePath = "private-release-handoff/release-handoff-template.md";
const fixtureRoot = resolve("scripts/fixtures");
const fixtureMarker = "SANITIZED PAYMENT GO-LIVE TEST FIXTURE - NOT RELEASE EVIDENCE";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EVIDENCE_AGE_DAYS = 45;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;
const privateProofPlaceholders = new Set([
  "-",
  "blocked",
  "fixture-only",
  "n/a",
  "na",
  "none",
  "not available",
  "not recorded",
  "pending",
  "tbd",
  "todo",
  "unknown",
]);

function envDefaultsFalse(source, key) {
  return new RegExp(`^${key}=false\\s*$`, "m").test(source);
}

function disabledPilotFlowSourceProofs({
  bookingCheckoutSource,
  commerceLaunchSource,
  envExampleSource,
  merchCheckoutSource,
  releaseGatesSource,
  stripeConnectOnboardingSource,
}) {
  const exactGateParser = releaseGatesSource.includes('return value === "true";');
  const checkoutMasterDefaultsFalse = envDefaultsFalse(
    envExampleSource,
    "STRIPE_CHECKOUT_CREATION_ENABLED",
  );

  return {
    "Ads checkout": adPurchasesDisabledInSource(commerceLaunchSource),
    "Booking deposit":
      exactGateParser &&
      checkoutMasterDefaultsFalse &&
      envDefaultsFalse(envExampleSource, "STRIPE_BOOKING_CHECKOUT_ENABLED") &&
      releaseGatesSource.includes(
        'booking: "STRIPE_BOOKING_CHECKOUT_ENABLED"',
      ) &&
      bookingCheckoutSource.includes(
        'stripeCheckoutCreationEnabled("booking")',
      ),
    "Marketplace Merch checkout":
      exactGateParser &&
      checkoutMasterDefaultsFalse &&
      envDefaultsFalse(
        envExampleSource,
        "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED",
      ) &&
      releaseGatesSource.includes(
        'marketplace_merch: "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED"',
      ) &&
      merchCheckoutSource.includes(
        'product.is_official ? "official_merch" : "marketplace_merch"',
      ) &&
      merchCheckoutSource.includes(
        "stripeCheckoutCreationEnabled(checkoutFlow)",
      ),
    "Seller payout readiness":
      exactGateParser &&
      envDefaultsFalse(
        envExampleSource,
        "STRIPE_CONNECT_ONBOARDING_ENABLED",
      ) &&
      envDefaultsFalse(
        envExampleSource,
        "STRIPE_MERCH_DESTINATION_CHARGES_ENABLED",
      ) &&
      stripeConnectOnboardingSource.includes(
        "if (!stripeConnectOnboardingEnabled())",
      ) &&
      merchCheckoutSource.includes(
        "if (!stripeMerchDestinationChargesEnabled())",
      ),
  };
}

const currentDisabledPilotFlowSourceProofs = disabledPilotFlowSourceProofs({
  bookingCheckoutSource: bookingCheckout,
  commerceLaunchSource: commerceLaunch,
  envExampleSource: envExample,
  merchCheckoutSource: merchCheckout,
  releaseGatesSource: stripeReleaseGates,
  stripeConnectOnboardingSource: stripeConnectOnboarding,
});

function pass(label) {
  console.log(`PASS ${label}`);
}

function fail(label, message) {
  console.error(`FAIL ${label}`);
  if (message) console.error(`  ${message}`);
  process.exitCode = 1;
}

function sectionBetween(source, startHeading, endHeading) {
  const start = source.indexOf(startHeading);
  if (start < 0) return null;

  const end = source.indexOf(endHeading, start + startHeading.length);
  if (end < 0) return null;

  return source.slice(start, end);
}

function markdownCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];

  return trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function markdownTable(section, firstColumn) {
  if (!section) return null;

  const lines = section.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) => markdownCells(line)[0] === firstColumn,
  );
  if (headerIndex < 0) return null;

  const columns = markdownCells(lines[headerIndex]);
  const rows = [];

  for (const line of lines.slice(headerIndex + 1)) {
    const cells = markdownCells(line);
    if (!cells.length) {
      if (rows.length) break;
      continue;
    }
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;

    rows.push(
      Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""])),
    );
  }

  return { columns, rows };
}

function stateBlocker(scope, value, { allowNotApplicable = false } = {}) {
  const state = value.trim().toLowerCase();
  if (state === "passed") return null;
  if (allowNotApplicable && state === "n/a") return null;
  if (!state) return `${scope}: missing`;
  if (state === "pending" || state === "blocked") return `${scope}: ${state}`;
  if (state === "n/a") return `${scope}: n/a is not allowed`;

  return `${scope}: must be exactly passed`;
}

function privateProofBlocker(scope, value, { allowFixtureOnly = false } = {}) {
  const proofLocation = value.trim();
  const normalizedProofLocation = proofLocation.toLowerCase();

  if (!proofLocation) return `${scope}: missing`;
  if (allowFixtureOnly && normalizedProofLocation === "fixture-only") return null;
  if (privateProofPlaceholders.has(normalizedProofLocation)) {
    return `${scope}: placeholder is not allowed`;
  }

  return null;
}

function paymentEvidenceDateBlocker(scope, value, referenceTimestamp) {
  const attemptDate = value.trim();
  if (!attemptDate) return `${scope}: missing`;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(attemptDate);
  const isIsoTimestamp =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      attemptDate,
    );
  if (!isDateOnly && !isIsoTimestamp) return `${scope}: invalid date`;

  const attemptTimestamp = Date.parse(
    isDateOnly ? `${attemptDate}T00:00:00Z` : attemptDate,
  );
  if (!Number.isFinite(attemptTimestamp)) return `${scope}: invalid date`;

  const ageDays = (referenceTimestamp - attemptTimestamp) / DAY_MS;
  if (ageDays < 0) return `${scope}: date cannot be in the future`;
  if (ageDays > MAX_EVIDENCE_AGE_DAYS) {
    return `${scope}: date must be within ${MAX_EVIDENCE_AGE_DAYS} days`;
  }

  return null;
}

function releaseCandidatesMatch(recorded, expected) {
  const normalizedRecorded = recorded.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();
  if (
    !COMMIT_PATTERN.test(normalizedRecorded) ||
    !COMMIT_PATTERN.test(normalizedExpected)
  ) {
    return false;
  }
  if (normalizedRecorded === normalizedExpected) return true;

  return (
    (normalizedRecorded.startsWith(normalizedExpected) ||
      normalizedExpected.startsWith(normalizedRecorded))
  );
}

function validateStrictEvidence(
  source,
  expectedReleaseCandidate,
  {
    allowFixtureOnly = false,
    disabledFlowSourceProofs = {},
    phase = "preauthorization",
    referenceTimestamp = Date.now(),
  } = {},
) {
  const blockers = [];
  const currentBlockersTable = markdownTable(
    sectionBetween(
      source,
      "## Current Console Blockers To Clear",
      "## Store Console Evidence",
    ),
    "Platform",
  );
  const paymentEvidenceTable = markdownTable(
    sectionBetween(
      source,
      "## Payment And Commerce Evidence",
      "## Payment Dashboard Readiness Log",
    ),
    "Flow",
  );
  const dashboardLogTable = markdownTable(
    sectionBetween(
      source,
      "## Payment Dashboard Readiness Log",
      "## Native Push Evidence",
    ),
    "Attempt date/time",
  );

  if (!currentBlockersTable) {
    blockers.push("Current Console Blockers To Clear payment table: missing");
  } else {
    for (const blockerName of requiredPaymentBlockers) {
      const row = currentBlockersTable.rows.find(
        (candidate) =>
          candidate.Platform === "Payments" && candidate.Blocker === blockerName,
      );
      if (!row) {
        blockers.push(`Payments blocker / ${blockerName}: missing`);
        continue;
      }

      const blocker = stateBlocker(
        `Payments blocker / ${blockerName} / Result`,
        row.Result ?? "",
      );
      if (blocker) blockers.push(blocker);

      const proofBlocker = privateProofBlocker(
        `Payments blocker / ${blockerName} / Private proof filename or location`,
        row["Private proof filename or location"] ?? "",
        { allowFixtureOnly },
      );
      if (proofBlocker) blockers.push(proofBlocker);
    }
  }

  if (!paymentEvidenceTable) {
    blockers.push("Payment And Commerce Evidence table: missing");
  } else {
    for (const column of requiredEvidenceColumns) {
      if (!paymentEvidenceTable.columns.includes(column)) {
        blockers.push(`Payment And Commerce Evidence / ${column}: column missing`);
      }
    }

    for (const flow of requiredFlows) {
      const row = paymentEvidenceTable.rows.find((candidate) => candidate.Flow === flow);
      if (!row) {
        blockers.push(`Payment flow / ${flow}: missing`);
        continue;
      }

      const recordedReleaseCandidate = row["Release candidate"] ?? "";
      const releaseState = recordedReleaseCandidate.trim().toLowerCase();
      if (!releaseState) {
        blockers.push(`Payment flow / ${flow} / Release candidate: missing`);
      } else if (releaseState === "pending" || releaseState === "blocked") {
        blockers.push(`Payment flow / ${flow} / Release candidate: ${releaseState}`);
      } else if (
        !releaseCandidatesMatch(recordedReleaseCandidate, expectedReleaseCandidate)
      ) {
        blockers.push(
          `Payment flow / ${flow} / Release candidate: stale or mismatched`,
        );
      }

      const gateProofBlocker = privateProofBlocker(
        `Payment flow / ${flow} / Private gate proof filename or location`,
        row["Private gate proof filename or location"] ?? "",
        { allowFixtureOnly },
      );
      if (gateProofBlocker) blockers.push(gateProofBlocker);

      if (excludedPilotFlows.includes(flow)) {
        if ((row["Release switch state"] ?? "").trim().toLowerCase() !== "blocked") {
          blockers.push(
            `Payment flow / ${flow} / Release switch state: must be exactly blocked while the flow is excluded`,
          );
        }
        if (!disabledFlowSourceProofs[flow]) {
          blockers.push(
            `Payment flow / ${flow}: n/a requires candidate source gates and fail-closed defaults`,
          );
        }

        for (const column of [
          ...preauthorizationEvidenceColumns,
          postTransactionEvidenceColumn,
          "Result",
        ]) {
          if ((row[column] ?? "").trim().toLowerCase() !== "n/a") {
            blockers.push(
              `Payment flow / ${flow} / ${column}: must be exactly n/a while the flow is excluded`,
            );
          }
        }
        continue;
      }

      const requiredReleaseState =
        phase === "post-transaction" ? "enabled" : "armed";
      if (
        (row["Release switch state"] ?? "").trim().toLowerCase() !==
        requiredReleaseState
      ) {
        blockers.push(
          `Payment flow / ${flow} / Release switch state: must be exactly ${requiredReleaseState} for ${phase}`,
        );
      }

      for (const column of preauthorizationEvidenceColumns) {
        const blocker = stateBlocker(
          `Payment flow / ${flow} / ${column}`,
          row[column] ?? "",
        );
        if (blocker) blockers.push(blocker);
      }

      const postTransactionState = (row[postTransactionEvidenceColumn] ?? "")
        .trim()
        .toLowerCase();
      if (phase === "post-transaction") {
        const blocker = stateBlocker(
          `Payment flow / ${flow} / ${postTransactionEvidenceColumn}`,
          postTransactionState,
        );
        if (blocker) blockers.push(blocker);
      } else if (!["pending", "passed"].includes(postTransactionState)) {
        blockers.push(
          `Payment flow / ${flow} / ${postTransactionEvidenceColumn}: must be pending or passed for preauthorization`,
        );
      }

      const resultBlocker = stateBlocker(
        `Payment flow / ${flow} / Result`,
        row.Result ?? "",
      );
      if (resultBlocker) blockers.push(resultBlocker);
    }
  }

  if (!dashboardLogTable) {
    blockers.push("Payment Dashboard Readiness Log table: missing");
  } else {
    for (const area of requiredDashboardAreas) {
      const row = dashboardLogTable.rows.find((candidate) => candidate.Area === area);
      if (!row) {
        blockers.push(`Payment dashboard / ${area}: missing`);
        continue;
      }

      const postTransactionArea = area === "Post-transaction production proof";
      const dashboardState = (row.Result ?? "").trim().toLowerCase();
      if (
        postTransactionArea &&
        phase === "preauthorization" &&
        dashboardState === "pending"
      ) {
        continue;
      }

      const attemptDateBlocker = paymentEvidenceDateBlocker(
        `Payment dashboard / ${area} / Attempt date/time`,
        row["Attempt date/time"] ?? "",
        referenceTimestamp,
      );
      if (attemptDateBlocker) blockers.push(attemptDateBlocker);

      const blocker = stateBlocker(
        `Payment dashboard / ${area} / Result`,
        dashboardState,
      );
      if (blocker) blockers.push(blocker);

      const proofBlocker = privateProofBlocker(
        `Payment dashboard / ${area} / Private proof filename or location`,
        row["Private proof filename or location"] ?? "",
        { allowFixtureOnly },
      );
      if (proofBlocker) blockers.push(proofBlocker);
    }
  }

  return blockers;
}

function optionState(args, name) {
  const equalsPrefix = `${name}=`;
  const values = [];
  let missingValue = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(equalsPrefix)) {
      const value = arg.slice(equalsPrefix.length).trim();
      if (value) values.push(value);
      else missingValue = true;
      continue;
    }
    if (arg !== name) continue;

    const value = args[index + 1]?.trim();
    if (value && !value.startsWith("--")) values.push(value);
    else missingValue = true;
  }

  return { missingValue, values };
}

function currentGitReleaseCandidate() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function gitReleaseCandidateExists(candidate) {
  try {
    execFileSync(
      "git",
      ["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`],
      {
        encoding: "utf8",
        stdio: ["ignore", "ignore", "ignore"],
      },
    );
    return true;
  } catch {
    return false;
  }
}

function gitFileAtCandidate(candidate, path) {
  try {
    return execFileSync("git", ["show", `${candidate}:${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function fixturePathIsSafe(path) {
  const pathFromFixtureRoot = relative(fixtureRoot, path);

  return (
    Boolean(pathFromFixtureRoot) &&
    !pathFromFixtureRoot.startsWith("..") &&
    !isAbsolute(pathFromFixtureRoot)
  );
}

function runStrictEvidenceGate() {
  const args = process.argv.slice(2);
  const testFixtureMode = args.includes("--test-fixture");
  const evidenceOption = optionState(args, "--evidence");
  const phaseOption = optionState(args, "--phase");
  const releaseCandidateOption = optionState(args, "--release-candidate");
  const referenceDateOption = optionState(args, "--reference-date");
  const optionNames = new Set([
    "--strict",
    "--test-fixture",
    "--evidence",
    "--phase",
    "--release-candidate",
    "--reference-date",
  ]);
  const unknownOptions = args.filter((arg, index) => {
    if (!arg.startsWith("--")) return false;
    if (arg.includes("=")) return !optionNames.has(arg.slice(0, arg.indexOf("=")));
    if (optionNames.has(arg)) return false;
    return index === 0 || !optionNames.has(args[index - 1]);
  });

  if (unknownOptions.length) {
    return unknownOptions.map((option) => `Strict command option ${option}: unknown`);
  }
  if (evidenceOption.missingValue) {
    return ["Strict command option --evidence: missing path"];
  }
  if (releaseCandidateOption.missingValue) {
    return ["Strict command option --release-candidate: missing value"];
  }
  if (phaseOption.missingValue) {
    return ["Strict command option --phase: missing value"];
  }
  if (referenceDateOption.missingValue) {
    return ["Strict command option --reference-date: missing value"];
  }
  if (evidenceOption.values.length > 1) {
    return ["Strict command option --evidence: duplicate values"];
  }
  if (releaseCandidateOption.values.length > 1) {
    return ["Strict command option --release-candidate: duplicate values"];
  }
  if (phaseOption.values.length > 1) {
    return ["Strict command option --phase: duplicate values"];
  }
  if (referenceDateOption.values.length > 1) {
    return ["Strict command option --reference-date: duplicate values"];
  }
  if (!testFixtureMode && referenceDateOption.values.length) {
    return ["Strict command option --reference-date: test fixtures only"];
  }

  const phase = phaseOption.values[0] ?? "preauthorization";
  if (!["preauthorization", "post-transaction"].includes(phase)) {
    return [
      "Strict command option --phase: must be preauthorization or post-transaction",
    ];
  }

  const referenceDate = referenceDateOption.values[0];
  const referenceTimestamp = referenceDate
    ? /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
      ? Date.parse(`${referenceDate}T23:59:59.999Z`)
      : Number.NaN
    : Date.now();
  if (!Number.isFinite(referenceTimestamp)) {
    return ["Strict command option --reference-date: invalid date"];
  }

  const evidencePath = resolve(
    evidenceOption.values[0] ?? defaultPrivateEvidencePath,
  );
  const expectedReleaseCandidate =
    releaseCandidateOption.values[0] ??
    (testFixtureMode
      ? "0123456789abcdef0123456789abcdef01234567"
      : currentGitReleaseCandidate());
  if (!expectedReleaseCandidate) {
    return ["Strict command release candidate: missing"];
  }
  const normalizedExpectedReleaseCandidate = expectedReleaseCandidate
    .trim()
    .toLowerCase();
  if (!COMMIT_PATTERN.test(normalizedExpectedReleaseCandidate)) {
    return [
      "Strict command release candidate: must be a 7-40 character Git commit ID",
    ];
  }
  if (
    !testFixtureMode &&
    releaseCandidateOption.values.length &&
    !gitReleaseCandidateExists(normalizedExpectedReleaseCandidate)
  ) {
    return [
      "Strict command release candidate: does not resolve to a local Git commit",
    ];
  }
  if (!existsSync(evidencePath)) {
    return ["Private payment evidence file: missing"];
  }

  const evidence = readFileSync(evidencePath, "utf8");
  const isMarkedFixture = evidence.includes(fixtureMarker);
  if (testFixtureMode && !fixturePathIsSafe(evidencePath)) {
    return ["Sanitized fixture path: must stay under scripts/fixtures"];
  }
  if (testFixtureMode && !isMarkedFixture) {
    return ["Sanitized fixture marker: missing"];
  }
  if (!testFixtureMode && isMarkedFixture) {
    return ["Private payment evidence file: test fixtures cannot approve go-live"];
  }

  const candidateSources = testFixtureMode
    ? {
        bookingCheckoutSource: bookingCheckout,
        commerceLaunchSource: commerceLaunch,
        envExampleSource: envExample,
        merchCheckoutSource: merchCheckout,
        releaseGatesSource: stripeReleaseGates,
        stripeConnectOnboardingSource: stripeConnectOnboarding,
      }
    : {
        bookingCheckoutSource: gitFileAtCandidate(
          normalizedExpectedReleaseCandidate,
          "src/app/api/bookings/checkout/route.ts",
        ),
        commerceLaunchSource: gitFileAtCandidate(
          normalizedExpectedReleaseCandidate,
          "src/lib/commerce-launch.ts",
        ),
        envExampleSource: gitFileAtCandidate(
          normalizedExpectedReleaseCandidate,
          ".env.example",
        ),
        merchCheckoutSource: gitFileAtCandidate(
          normalizedExpectedReleaseCandidate,
          "src/app/api/merch/checkout/route.ts",
        ),
        releaseGatesSource: gitFileAtCandidate(
          normalizedExpectedReleaseCandidate,
          "src/lib/stripe/release-gates.ts",
        ),
        stripeConnectOnboardingSource: gitFileAtCandidate(
          normalizedExpectedReleaseCandidate,
          "src/app/api/stripe/connect/onboarding/route.ts",
        ),
      };

  return validateStrictEvidence(evidence, normalizedExpectedReleaseCandidate, {
    allowFixtureOnly: testFixtureMode,
    disabledFlowSourceProofs: disabledPilotFlowSourceProofs(candidateSources),
    phase,
    referenceTimestamp,
  });
}

const paymentEvidenceSection = generator.slice(
  generator.indexOf("## Payment And Commerce Evidence"),
  generator.indexOf("## Payment Dashboard Readiness Log"),
);
const dashboardLogSection = generator.slice(
  generator.indexOf("## Payment Dashboard Readiness Log"),
  generator.indexOf("## Native Push Evidence"),
);
const readinessEvidenceSection = paymentReadiness.slice(
  paymentReadiness.indexOf("## Production Evidence Pack"),
  paymentReadiness.indexOf("## Draft Seller Payout Release Policy"),
);
const currentBlockersSection = generator.slice(
  generator.indexOf("## Current Console Blockers To Clear"),
  generator.indexOf("## Store Console Evidence"),
);

if (
  packageJson.includes('"smoke:payment-cutover": "node scripts/smoke-payment-cutover-evidence.mjs"') &&
  packageJson.includes("npm run smoke:payments && npm run smoke:payment-cutover && npm run smoke:pwa && npm run smoke:security")
) {
  pass("payment cutover guard is wired into payment release verification");
} else {
  fail("payment cutover guard is wired into payment release verification");
}

const missingColumns = requiredEvidenceColumns.filter(
  (column) => !paymentEvidenceSection.includes(column),
);
if (!missingColumns.length) {
  pass("private payment evidence matrix has required repo-safe columns");
} else {
  fail(
    "private payment evidence matrix has required repo-safe columns",
    `missing columns: ${missingColumns.join(", ")}`,
  );
}

const missingFlows = requiredFlows.filter((flow) => !paymentEvidenceSection.includes(`| ${flow} |`));
if (!missingFlows.length) {
  pass("private payment evidence matrix covers launch payment flows");
} else {
  fail(
    "private payment evidence matrix covers launch payment flows",
    `missing flows: ${missingFlows.join(", ")}`,
  );
}

const excludedTemplateRows = excludedPilotFlows.map(
  (flow) =>
    `| ${flow} | pending | blocked | | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`,
);
if (
  excludedTemplateRows.every((row) => paymentEvidenceSection.includes(row)) &&
  Object.values(currentDisabledPilotFlowSourceProofs).every(Boolean) &&
  dashboardLogSection.includes(
    "| | Post-transaction production proof | Record a genuine authorized customer sale and reconciliation only after separate launch approval | pending | | |",
  )
) {
  pass("private handoff keeps excluded flows and post-transaction proof fail closed");
} else {
  fail("private handoff keeps excluded flows and post-transaction proof fail closed");
}

if (
  currentBlockersSection.includes("| Payments | Production account activation |") &&
  currentBlockersSection.includes("Production account activation is complete") &&
  currentBlockersSection.includes("Marketplace Connect setup remains separate from the official Merch pilot | passed |") &&
  currentBlockersSection.includes("| Payments | Marketplace Connect setup |") &&
  currentBlockersSection.includes("Excluded from the official Merch pilot; seller onboarding and destination-charge routing remain blocked | n/a |") &&
  currentBlockersSection.includes("| Payments | Production app mode preflight |") &&
  currentBlockersSection.includes("expected mode Needs review and server key mode Test") &&
  currentBlockersSection.includes("live endpoint and rotated signing secret passed a signed non-money 200 probe") &&
  currentBlockersSection.includes("checkout remains blocked until the live server key and expected mode are matched | blocked |") &&
  currentBlockersSection.includes("| Payments | Official Merch policy and fulfillment approval |") &&
  currentBlockersSection.includes("US shipping, tax, fulfillment, refund/dispute, support, and legal review must pass before the official Merch flow is armed | blocked |")
) {
  pass("private handoff separates official Merch readiness from marketplace Connect");
} else {
  fail("private handoff separates official Merch readiness from marketplace Connect");
}

const requiredReadinessText = [
  "Repo-safe summary fields are limited to release candidate, test flow, live/test mode result",
  "Keep payment intent IDs, checkout session IDs, webhook event IDs, refund IDs, dispute IDs, seller account IDs",
  "Complete the applicable phase privately against one release candidate",
  "Every Payments blocker and Payment Dashboard row required to pass in the selected phase must name a non-placeholder private proof filename or location",
  "Dashboard evidence must be dated no more than 45 days",
  "cannot be future-dated",
  "Official TTC Merch checkout is the only selected pilot flow",
  "preauthorization evidence does not require a production transaction",
  "post-transaction production evidence",
  "Excluded rows may use `n/a` only when their Release switch state is `blocked`",
  "candidate source gates and fail-closed defaults",
];
const missingReadinessText = requiredReadinessText.filter(
  (snippet) => !readinessEvidenceSection.includes(snippet),
);
if (!missingReadinessText.length) {
  pass("payment readiness docs keep repo-safe cutover evidence boundaries explicit");
} else {
  fail(
    "payment readiness docs keep repo-safe cutover evidence boundaries explicit",
    `missing text: ${missingReadinessText.join(" | ")}`,
  );
}

const forbiddenUnboundedRequests = [
  "store payment IDs",
  "store dashboard screenshots",
  "store buyer addresses",
  "store seller account details",
  "store bank details",
  "store card details",
  "store webhook secrets",
  "store raw exports",
];
const forbiddenHits = forbiddenUnboundedRequests.filter((snippet) =>
  paymentReadiness.toLowerCase().includes(snippet),
);
if (!forbiddenHits.length) {
  pass("payment cutover evidence avoids requesting sensitive identifiers in repo docs");
} else {
  fail(
    "payment cutover evidence avoids requesting sensitive identifiers in repo docs",
    `sensitive evidence requested in repo docs: ${forbiddenHits.join(", ")}`,
  );
}

if (!process.exitCode && process.argv.includes("--strict")) {
  let strictBlockers;

  try {
    strictBlockers = runStrictEvidenceGate();
  } catch {
    strictBlockers = ["Strict payment evidence could not be read safely"];
  }

  if (strictBlockers.length) {
    for (const blocker of strictBlockers) {
      console.error(`BLOCKER ${blocker}`);
    }
    fail(
      "strict payment go-live evidence gate",
      `${strictBlockers.length} required payment evidence blocker${strictBlockers.length === 1 ? "" : "s"}`,
    );
  } else if (process.argv.includes("--test-fixture")) {
    pass("sanitized payment go-live fixture validates strict gate (not release evidence)");
  } else {
    pass("strict payment go-live evidence is complete for the selected release candidate");
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
