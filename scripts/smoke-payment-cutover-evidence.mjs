import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { requiredFalseStringBindingsSafety } from "./lib/wrangler-config-safety.mjs";

const generator = readFileSync("scripts/generate-private-release-handoff.mjs", "utf8");
const paymentReadiness = readFileSync("docs/PAYMENT_PRODUCTION_READINESS.md", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const wranglerFixtureSource =
  process.argv.includes("--test-fixture") &&
  process.env.TTC_PAYMENT_GATE_WRANGLER_FIXTURE_SOURCE;
const wranglerConfig =
  typeof wranglerFixtureSource === "string"
    ? wranglerFixtureSource
    : readFileSync("wrangler.jsonc", "utf8");
const currentPaymentReadiness = section(
  paymentReadiness,
  "## Current Position - August 2, 2026",
  "## Historical TTC Checkout Position (Preserved)",
);

const DEFAULT_EVIDENCE_PATH = "private-release-handoff/release-handoff-template.md";
const FIXTURE_MARKER =
  "<!-- TTC_SANITIZED_SELLER_LINK_ROLLOUT_FIXTURE -->";
const MAX_EVIDENCE_AGE_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/i;
const FIXTURE_CANDIDATE_PATTERN = /^fixture-[A-Za-z0-9._-]{7,120}$/;
const requiredSteps = [
  "1. Approved migration",
  "2. First inactive Worker upload",
  "3. Deploy while disabled",
  "4. Private seller link review",
  "5. Second inactive upload and approval",
  "6. Cross-platform QA",
  "7. Rollback",
];
const requiredFalseBindings = [
  "STRIPE_EXPECTED_LIVEMODE",
  "TTC_SELLER_CHECKOUT_LINKS_ENABLED",
  "TTC_NATIVE_PUSH_DELIVERY_ENABLED",
  "STRIPE_CHECKOUT_CREATION_ENABLED",
  "STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED",
  "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED",
  "STRIPE_BOOKING_CHECKOUT_ENABLED",
  "STRIPE_CONNECT_ONBOARDING_ENABLED",
  "STRIPE_MERCH_DESTINATION_CHARGES_ENABLED",
];
const retiredActiveInstructions = [
  "Official TTC Merch checkout",
  "Marketplace Merch checkout",
  "Seller payout readiness",
  "Official TTC Merch is Armed",
  "verify:payment-go-live",
  "verify:payment-production-evidence",
];
const prohibitedEvidencePatterns = [
  /https:\/\/buy[.]stripe[.]com\//i,
  /\bacct_[A-Za-z0-9]+\b/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+\b/,
  /\bwhsec_[A-Za-z0-9]+\b/,
  /\bpi_[A-Za-z0-9]+\b/,
  /\bcs_(?:live|test)_[A-Za-z0-9]+\b/,
];
const incompleteValues = new Set([
  "",
  "blocked",
  "fail",
  "failed",
  "n/a",
  "na",
  "pending",
  "tbd",
  "todo",
  "unknown",
]);

function cleanCell(value = "") {
  return value.trim().replace(/^`|`$/g, "").replace(/\s+/g, " ");
}

function normalize(value = "") {
  return cleanCell(value).toLowerCase();
}

function containsInOrder(source, snippets) {
  let cursor = 0;
  for (const snippet of snippets) {
    const index = source.indexOf(snippet, cursor);
    if (index < 0) return false;
    cursor = index + snippet.length;
  }
  return true;
}

function section(source, heading, nextHeading) {
  const start = source.indexOf(heading);
  if (start < 0) return "";
  const end = nextHeading
    ? source.indexOf(nextHeading, start + heading.length)
    : -1;
  return source.slice(start, end < 0 ? undefined : end);
}

function markdownTable(sectionSource, firstColumn) {
  const lines = sectionSource.split(/\r?\n/);
  const tableStart = lines.findIndex(
    (line) => cleanCell(line.split("|")[1] ?? "") === firstColumn,
  );
  if (tableStart < 0) return null;

  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(cleanCell);
  const headers = cells(lines[tableStart]);
  const rows = [];

  for (const line of lines.slice(tableStart + 1)) {
    if (!line.trim().startsWith("|")) {
      if (rows.length) break;
      continue;
    }
    const values = cells(line);
    if (values.every((value) => /^:?-{3,}:?$/.test(value))) continue;
    rows.push(
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
    );
  }
  return { headers, rows };
}

function uniqueRow(table, column, value, blockers, area) {
  const rows = table?.rows.filter(
    (row) => normalize(row[column]) === normalize(value),
  ) ?? [];
  if (rows.length !== 1) {
    blockers.push(`${area}: ${value} row must appear exactly once`);
  }
  return rows[0];
}

function sourceContractIsSafe({ generatorSource, packageSource }) {
  const rollout = section(
    generatorSource,
    "## Seller-Owned Merch Rollout Evidence",
    "## Seller-Link Rollout Log",
  );
  return (
    rollout.includes("seller-owned Payment Link") &&
    rollout.includes("seller handles purchase support") &&
    rollout.includes("external browser") &&
    rollout.includes("no false TTC payment, order, receipt, or success state") &&
    containsInOrder(rollout, requiredSteps) &&
    requiredFalseBindings.every((key) => rollout.includes(`${key}=false`)) &&
    retiredActiveInstructions.every(
      (instruction) => !generatorSource.includes(instruction),
    ) &&
    packageSource.includes(
      '"smoke:seller-link-rollout": "node scripts/smoke-payment-cutover-evidence.mjs"',
    ) &&
    packageSource.includes(
      '"verify:seller-link-rollout-evidence": "npm run smoke:env && npm run test:seller-link-rollout-evidence && node scripts/smoke-payment-cutover-evidence.mjs --strict"',
    ) &&
    !packageSource.includes('"smoke:payment-cutover"') &&
    !packageSource.includes('"verify:payment-go-live"') &&
    !packageSource.includes('"verify:payment-production-evidence"')
  );
}

function packageCurrentCompositesAreSafe(source) {
  const parsed = JSON.parse(source);
  const activeScripts = Object.entries(parsed.scripts ?? {}).filter(
    ([name]) => !name.startsWith("legacy:"),
  );
  const retiredCommandNames = [
    "smoke:payment-cutover",
    "verify:payment-go-live",
    "verify:payment-production-evidence",
    "test:payment-go-live-gate",
  ];
  return (
    retiredCommandNames.every((name) => !(name in (parsed.scripts ?? {}))) &&
    activeScripts.every(
      ([, command]) =>
        !command.includes("smoke:payment-cutover") &&
        !command.includes("test:payment-go-live-gate"),
    )
  );
}

function wranglerHasRequiredFalseBindings(source) {
  return requiredFalseStringBindingsSafety(source, requiredFalseBindings).ok;
}

function parseArgs(argv) {
  const options = new Map();
  const flags = new Set();
  const valueOptions = new Set([
    "--evidence",
    "--release-candidate",
    "--reference-date",
  ]);
  const flagOptions = new Set(["--strict", "--test-fixture"]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (flagOptions.has(argument)) {
      if (flags.has(argument)) throw new Error(`${argument} may appear only once`);
      flags.add(argument);
      continue;
    }
    if (!valueOptions.has(argument)) throw new Error(`unknown option ${argument}`);
    if (options.has(argument)) throw new Error(`${argument} may appear only once`);
    const value = argv[index + 1] ?? "";
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    options.set(argument, value);
    index += 1;
  }
  return { flags, options };
}

function gitCommitExists(candidate) {
  try {
    return (
      execFileSync("git", ["cat-file", "-t", candidate], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === "commit"
    );
  } catch {
    return false;
  }
}

function strictEvidenceBlockers({
  evidencePath,
  expectedCandidate,
  referenceDate,
  testFixture,
}) {
  const blockers = [];
  const resolvedEvidence = resolve(evidencePath);
  const fixtureRoot = resolve("scripts/fixtures");
  const fixtureRelative = relative(fixtureRoot, resolvedEvidence);
  const fixturePathIsSafe =
    Boolean(fixtureRelative) &&
    !fixtureRelative.startsWith("..") &&
    !isAbsolute(fixtureRelative);

  if (!existsSync(resolvedEvidence)) return ["Private seller-link evidence is missing"];
  if (testFixture && !fixturePathIsSafe) {
    return ["Sanitized fixture path must stay under scripts/fixtures"];
  }
  if (!testFixture && fixturePathIsSafe) {
    return ["Sanitized fixtures cannot approve a live seller-link rollout"];
  }
  if (
    (testFixture && !FIXTURE_CANDIDATE_PATTERN.test(expectedCandidate)) ||
    (!testFixture && !COMMIT_PATTERN.test(expectedCandidate))
  ) {
    return ["Release candidate format is invalid for this evidence mode"];
  }
  if (!testFixture && !gitCommitExists(expectedCandidate)) {
    return ["Live release candidate does not resolve to a local Git commit"];
  }

  const markdown = readFileSync(resolvedEvidence, "utf8");
  const hasMarker = markdown.includes(FIXTURE_MARKER);
  if (testFixture && !hasMarker) blockers.push("Sanitized fixture marker is missing");
  if (!testFixture && hasMarker) {
    blockers.push("Sanitized fixtures cannot approve a live seller-link rollout");
  }
  if (prohibitedEvidencePatterns.some((pattern) => pattern.test(markdown))) {
    blockers.push("Private evidence must not contain a seller link, account ID, payment ID, or secret");
  }

  const releaseTable = markdownTable(section(markdown, "## Release Candidate", "## Current Console Blockers To Clear"), "Field");
  const webDeploy = uniqueRow(
    releaseTable,
    "Field",
    "Web deploy version",
    blockers,
    "Release Candidate",
  );
  if (normalize(webDeploy?.Value) !== normalize(expectedCandidate)) {
    blockers.push("Release Candidate: web deploy does not match the requested release candidate");
  }

  const rolloutTable = markdownTable(
    section(markdown, "## Seller-Owned Merch Rollout Evidence", "## Seller-Link Rollout Log"),
    "Step",
  );
  const requiredColumns = [
    "Step",
    "Required private evidence",
    "Expected state",
    "Result",
    "Private proof filename or location",
    "Proof date",
  ];
  for (const column of requiredColumns) {
    if (!rolloutTable?.headers.includes(column)) {
      blockers.push(`Seller-Owned Merch Rollout Evidence: ${column} column is missing`);
    }
  }

  const referenceTimestamp = Date.parse(`${referenceDate}T00:00:00Z`);
  for (const step of requiredSteps) {
    const row = uniqueRow(
      rolloutTable,
      "Step",
      step,
      blockers,
      "Seller-Owned Merch Rollout Evidence",
    );
    if (normalize(row?.Result) !== "passed") {
      blockers.push(`Seller-Owned Merch Rollout Evidence: ${step} must be passed`);
    }
    const proof = cleanCell(row?.["Private proof filename or location"] ?? "");
    if (incompleteValues.has(normalize(proof))) {
      blockers.push(`Seller-Owned Merch Rollout Evidence: ${step} private proof is required`);
    } else if (!testFixture && /fixture|sample|placeholder/i.test(proof)) {
      blockers.push(`Seller-Owned Merch Rollout Evidence: ${step} proof cannot use fixture placeholders`);
    }
    const proofDate = cleanCell(row?.["Proof date"] ?? "");
    const proofTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(proofDate)
      ? Date.parse(`${proofDate}T00:00:00Z`)
      : Number.NaN;
    if (!Number.isFinite(proofTimestamp)) {
      blockers.push(`Seller-Owned Merch Rollout Evidence: ${step} proof date must use YYYY-MM-DD`);
    } else {
      const ageDays = (referenceTimestamp - proofTimestamp) / DAY_MS;
      if (ageDays < 0) {
        blockers.push(`Seller-Owned Merch Rollout Evidence: ${step} proof date cannot be in the future`);
      } else if (ageDays > MAX_EVIDENCE_AGE_DAYS) {
        blockers.push(
          `Seller-Owned Merch Rollout Evidence: ${step} proof date must be within ${MAX_EVIDENCE_AGE_DAYS} days`,
        );
      }
    }
  }

  return blockers;
}

const sourceMutants = [
  {
    generatorSource: `${generator}\nEnable Official TTC Merch checkout and seller payout readiness for release.`,
    packageSource: packageJson,
  },
  {
    generatorSource: generator,
    packageSource: packageJson.replace(
      '"smoke:seller-link-rollout"',
      '"smoke:payment-cutover"',
    ),
  },
  {
    generatorSource: generator,
    packageSource: packageJson.replace(
      '"verify:seller-link-rollout-evidence": "npm run smoke:env && ',
      '"verify:seller-link-rollout-evidence": "',
    ),
  },
];
const checks = [
  {
    label: "seller-link rollout evidence replaces the retired TTC payment pilot",
    ok:
      sourceContractIsSafe({
        generatorSource: generator,
        packageSource: packageJson,
      }) && sourceMutants.every((mutant) => !sourceContractIsSafe(mutant)),
  },
  {
    label: "current package composites exclude retired TTC payment go-live commands",
    ok: packageCurrentCompositesAreSafe(packageJson),
  },
  {
    label: "seller-link rollout source requires every Wrangler safety binding false",
    ok: wranglerHasRequiredFalseBindings(wranglerConfig),
  },
  {
    label: "payment readiness documents the seller-owned controlled rollout",
    ok:
      currentPaymentReadiness.includes("## Controlled Seller-Link Rollout Sequence - Current And Operative") &&
      currentPaymentReadiness.includes("npm.cmd run verify:seller-link-rollout-evidence") &&
      !currentPaymentReadiness.includes("npm.cmd run verify:payment-go-live") &&
      !currentPaymentReadiness.includes("npm.cmd run verify:payment-production-evidence"),
  },
];

let failures = 0;
for (const check of checks) {
  if (check.ok) console.log(`PASS ${check.label}`);
  else {
    failures += 1;
    console.error(`FAIL ${check.label}`);
  }
}

let parsedArgs;
try {
  parsedArgs = parseArgs(process.argv.slice(2));
} catch (error) {
  failures += 1;
  console.error(`FAIL seller-link rollout options: ${error instanceof Error ? error.message : "invalid options"}`);
}

if (parsedArgs?.flags.has("--strict")) {
  const testFixture = parsedArgs.flags.has("--test-fixture");
  const referenceDateOption = parsedArgs.options.get("--reference-date") ?? "";
  if (referenceDateOption && !testFixture) {
    failures += 1;
    console.error("FAIL seller-link rollout options: --reference-date is fixture-only");
  } else {
    const referenceDate = referenceDateOption || new Date().toISOString().slice(0, 10);
    const candidate =
      parsedArgs.options.get("--release-candidate") ??
      process.env.TTC_RELEASE_CANDIDATE ??
      "";
    const blockers = strictEvidenceBlockers({
      evidencePath:
        parsedArgs.options.get("--evidence") ?? DEFAULT_EVIDENCE_PATH,
      expectedCandidate: candidate,
      referenceDate,
      testFixture,
    });
    if (blockers.length) {
      failures += 1;
      for (const blocker of blockers) console.error(`BLOCKER ${blocker}`);
      console.error(`FAIL strict seller-link rollout evidence (${blockers.length} blocker${blockers.length === 1 ? "" : "s"})`);
    } else {
      console.log(
        `PASS ${testFixture ? "sanitized fixture validates" : "private evidence completes"} the seller-link rollout gate`,
      );
    }
  }
}

if (failures > 0) process.exit(1);
