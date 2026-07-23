import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const generator = readFileSync("scripts/generate-private-release-handoff.mjs", "utf8");
const paymentReadiness = readFileSync("docs/PAYMENT_PRODUCTION_READINESS.md", "utf8");
const packageJson = readFileSync("package.json", "utf8");

const requiredFlows = [
  "Merch checkout",
  "Booking deposit",
  "Ads checkout",
  "Seller payout readiness",
];

const requiredEvidenceColumns = [
  "Release candidate",
  "Expected mode checked",
  "Server key mode checked",
  "Webhook endpoint/events checked",
  "Admin reconciliation",
  "Refund/dispute/payout gate",
  "Penny/live-test proof",
  "Result",
];
const requiredDashboardAreas = [
  "Account verification",
  "Connect setup",
  "API and webhook mode",
  "Live-money proof",
];
const requiredPaymentBlockers = [
  "Account activation and Connect setup",
  "Production app mode preflight",
];
const defaultPrivateEvidencePath = "private-release-handoff/release-handoff-template.md";
const fixtureRoot = resolve("scripts/fixtures");
const fixtureMarker = "SANITIZED PAYMENT GO-LIVE TEST FIXTURE - NOT RELEASE EVIDENCE";
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

function releaseCandidatesMatch(recorded, expected) {
  const normalizedRecorded = recorded.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();
  if (!normalizedRecorded || !normalizedExpected) return false;
  if (normalizedRecorded === normalizedExpected) return true;

  const commitPattern = /^[0-9a-f]{7,40}$/;
  return (
    commitPattern.test(normalizedRecorded) &&
    commitPattern.test(normalizedExpected) &&
    (normalizedRecorded.startsWith(normalizedExpected) ||
      normalizedExpected.startsWith(normalizedRecorded))
  );
}

function validateStrictEvidence(
  source,
  expectedReleaseCandidate,
  { allowFixtureOnly = false } = {},
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

      for (const column of requiredEvidenceColumns.slice(1)) {
        const blocker = stateBlocker(
          `Payment flow / ${flow} / ${column}`,
          row[column] ?? "",
          {
            allowNotApplicable:
              flow === "Seller payout readiness" &&
              column === "Penny/live-test proof",
          },
        );
        if (blocker) blockers.push(blocker);
      }
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

      const attemptDate = row["Attempt date/time"]?.trim() ?? "";
      if (!attemptDate) {
        blockers.push(`Payment dashboard / ${area} / Attempt date/time: missing`);
      } else if (Number.isNaN(Date.parse(attemptDate))) {
        blockers.push(
          `Payment dashboard / ${area} / Attempt date/time: invalid date`,
        );
      }

      const blocker = stateBlocker(
        `Payment dashboard / ${area} / Result`,
        row.Result ?? "",
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
  const releaseCandidateOption = optionState(args, "--release-candidate");
  const optionNames = new Set([
    "--strict",
    "--test-fixture",
    "--evidence",
    "--release-candidate",
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
  if (evidenceOption.values.length > 1) {
    return ["Strict command option --evidence: duplicate values"];
  }
  if (releaseCandidateOption.values.length > 1) {
    return ["Strict command option --release-candidate: duplicate values"];
  }

  const evidencePath = resolve(
    evidenceOption.values[0] ?? defaultPrivateEvidencePath,
  );
  const expectedReleaseCandidate =
    releaseCandidateOption.values[0] ??
    (testFixtureMode ? "fixture-release-candidate" : currentGitReleaseCandidate());
  if (!expectedReleaseCandidate) {
    return ["Strict command release candidate: missing"];
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

  return validateStrictEvidence(evidence, expectedReleaseCandidate, {
    allowFixtureOnly: testFixtureMode,
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

if (
  paymentEvidenceSection.includes("| Seller payout readiness | pending | pending | pending | pending | pending | pending | n/a | pending |") &&
  dashboardLogSection.includes("| | Live-money proof | Penny test, Admin reconciliation, refund/dispute procedure, payout gate, and native checkout policy review | pending | | |")
) {
  pass("private handoff keeps payout and live-money proof blocked until reviewed");
} else {
  fail("private handoff keeps payout and live-money proof blocked until reviewed");
}

if (
  currentBlockersSection.includes("| Payments | Account activation and Connect setup |") &&
  currentBlockersSection.includes("Sandbox test connected account and marketplace destination-charge integration guide are confirmed") &&
  currentBlockersSection.includes("account, email, business, identity, and production verification still need private completion evidence") &&
  currentBlockersSection.includes("| Payments | Production app mode preflight |") &&
  currentBlockersSection.includes("explicit mode Needs review, server key mode Test, webhook signing Ready") &&
  currentBlockersSection.includes("checkout blocked until the expected mode is readable and matched | blocked |")
) {
  pass("private handoff records the current fail-closed payment activation state");
} else {
  fail("private handoff records the current fail-closed payment activation state");
}

const requiredReadinessText = [
  "Repo-safe summary fields are limited to release candidate, test flow, live/test mode result",
  "Keep payment intent IDs, checkout session IDs, webhook event IDs, refund IDs, dispute IDs, seller account IDs",
  "`pending`, `passed`, or `blocked`; no payment IDs",
  "Each flow must be verified against the same release candidate",
  "Every required Payments blocker and Payment Dashboard row must name a non-placeholder private proof filename or location",
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
