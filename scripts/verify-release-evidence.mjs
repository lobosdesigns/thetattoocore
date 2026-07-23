import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_ANDROID_BUILD = "1.0.2 (3)";
const EXPECTED_IOS_TESTFLIGHT_BUILD = "1.0 (4)";
const EXPECTED_IOS_REVIEW_BUILD = "1.0 (3)";
const DEFAULT_EVIDENCE_PATH =
  "private-release-handoff/release-handoff-template.md";
const MAX_PROOF_AGE_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const testFixture = args.includes("--test-fixture");
const verbose = args.includes("--verbose");

function optionValue(name, fallback = "") {
  const optionIndex = args.indexOf(name);
  return optionIndex >= 0 ? (args[optionIndex + 1] ?? "") : fallback;
}

const evidencePath = optionValue("--evidence", DEFAULT_EVIDENCE_PATH);
const expectedReleaseCandidate = optionValue(
  "--release-candidate",
  process.env.TTC_RELEASE_CANDIDATE ?? "",
);
const referenceDateOption = optionValue("--reference-date");
const releaseCandidatePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{6,127}$/;

if (!expectedReleaseCandidate) {
  console.error(
    "FAIL current web release candidate is required. Pass --release-candidate or set TTC_RELEASE_CANDIDATE.",
  );
  process.exit(1);
}

if (!releaseCandidatePattern.test(expectedReleaseCandidate)) {
  console.error("FAIL current web release candidate format is invalid.");
  process.exit(1);
}

if (referenceDateOption && !testFixture) {
  console.error("FAIL reference date is available only for fixture tests.");
  process.exit(1);
}

const referenceDate = referenceDateOption || new Date().toISOString().slice(0, 10);
const referenceTimestamp = Date.parse(`${referenceDate}T00:00:00Z`);

if (
  !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ||
  !Number.isFinite(referenceTimestamp)
) {
  console.error("FAIL release evidence reference date is invalid.");
  process.exit(1);
}

if (
  testFixture &&
  !resolve(evidencePath).includes(
    resolve("scripts/fixtures").replace(/[\\/]$/, ""),
  )
) {
  console.error("FAIL release evidence fixture must stay under scripts/fixtures.");
  process.exit(1);
}

if (!existsSync(evidencePath)) {
  console.error(
    "FAIL private release evidence is missing. Generate the ignored handoff first.",
  );
  process.exit(1);
}

const markdown = readFileSync(evidencePath, "utf8");

function cleanCell(value = "") {
  return value
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/\s+/g, " ");
}

function normalize(value = "") {
  return cleanCell(value).toLowerCase();
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function parseSectionTables(source) {
  const sections = new Map();
  const lines = source.split(/\r?\n/);
  let section = "";

  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^##\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1];
      continue;
    }

    if (!section || !lines[index].trim().startsWith("|")) {
      continue;
    }

    const tableLines = [];
    while (index < lines.length && lines[index].trim().startsWith("|")) {
      tableLines.push(lines[index].trim());
      index += 1;
    }
    index -= 1;

    const parsedRows = tableLines
      .map((line) =>
        line
          .slice(1, -1)
          .split("|")
          .map(cleanCell),
      )
      .filter((cells) => !isSeparatorRow(cells));

    if (parsedRows.length < 2) {
      continue;
    }

    const [headers, ...rows] = parsedRows;
    sections.set(section, {
      headers,
      rows: rows.map((cells) =>
        Object.fromEntries(
          headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]),
        ),
      ),
    });
  }

  return sections;
}

const tables = parseSectionTables(markdown);
const failures = [];

function fail(area, item) {
  failures.push(`${area}: ${item}`);
}

function section(name) {
  const table = tables.get(name);
  if (!table) {
    fail(name, "required evidence table is missing");
  }
  return table;
}

function rowBy(table, column, value) {
  return table?.rows.find(
    (row) => normalize(row[column]) === normalize(value),
  );
}

const passingResults = new Set([
  "approved",
  "complete",
  "completed",
  "pass",
  "passed",
  "ready",
]);
const incompleteValues = new Set([
  "blocked",
  "fail",
  "failed",
  "n/a",
  "na",
  "pending",
  "tbd",
  "todo",
]);

function isPassing(value) {
  return passingResults.has(normalize(value));
}

function hasValue(value) {
  const cleaned = normalize(value);
  return (
    cleaned.length > 0 &&
    !incompleteValues.has(cleaned) &&
    !cleaned.includes("<") &&
    !cleaned.includes("replace me")
  );
}

function requirePassing(area, item, value) {
  if (!isPassing(value)) {
    fail(area, item);
  }
}

function requireValue(area, item, value) {
  if (!hasValue(value)) {
    fail(area, item);
  }
}

function requireContains(area, item, value, expected) {
  if (!normalize(value).includes(normalize(expected))) {
    fail(area, item);
  }
}

function requireProof(area, item, value) {
  requireValue(area, `${item} private proof`, value);
}

function requireProofDate(area, item, value) {
  const cleaned = cleanCell(value);
  const proofTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(cleaned)
    ? Date.parse(`${cleaned}T00:00:00Z`)
    : Number.NaN;

  if (!Number.isFinite(proofTimestamp)) {
    fail(area, `${item} proof date must use YYYY-MM-DD`);
    return;
  }

  const proofAgeDays = (referenceTimestamp - proofTimestamp) / DAY_MS;
  if (proofAgeDays < 0) {
    fail(area, `${item} proof date cannot be in the future`);
  } else if (proofAgeDays > MAX_PROOF_AGE_DAYS) {
    fail(
      area,
      `${item} proof date must be within ${MAX_PROOF_AGE_DAYS} days`,
    );
  }
}

const releaseCandidate = section("Release Candidate");
if (releaseCandidate) {
  const webDeploy = rowBy(releaseCandidate, "Field", "Web deploy version");
  const androidBuild = rowBy(
    releaseCandidate,
    "Field",
    "Android release track and version/build",
  );
  const iosBuild = rowBy(
    releaseCandidate,
    "Field",
    "iOS TestFlight version/build",
  );
  const targetDate = rowBy(
    releaseCandidate,
    "Field",
    "Store-review target date",
  );
  const reviewerContact = rowBy(
    releaseCandidate,
    "Field",
    "Reviewer contact saved in consoles",
  );
  const reviewerAccount = rowBy(
    releaseCandidate,
    "Field",
    "Reviewer account validated for selected build/track",
  );

  requireValue("Release Candidate", "web deploy version", webDeploy?.Value);
  requireContains(
    "Release Candidate",
    "web deploy does not match the requested release candidate",
    webDeploy?.Value,
    expectedReleaseCandidate,
  );
  requireContains(
    "Release Candidate",
    "Android Alpha build must be exact build 1.0.2 (3)",
    androidBuild?.Value,
    EXPECTED_ANDROID_BUILD,
  );
  requireContains(
    "Release Candidate",
    "Android release track must identify Alpha or closed testing",
    androidBuild?.Value,
    normalize(androidBuild?.Value).includes("alpha") ? "alpha" : "closed",
  );
  requireContains(
    "Release Candidate",
    "iOS TestFlight build must be exact build 1.0 (4)",
    iosBuild?.Value,
    EXPECTED_IOS_TESTFLIGHT_BUILD,
  );
  requireValue("Release Candidate", "store-review target date", targetDate?.Value);
  requirePassing(
    "Release Candidate",
    "reviewer contact saved in consoles",
    reviewerContact?.Value,
  );
  requirePassing(
    "Release Candidate",
    "reviewer account validated for selected build/track",
    reviewerAccount?.Value,
  );
}

const blockers = section("Current Console Blockers To Clear");
if (blockers) {
  const requiredBlockers = [
    ["Apple", "App Review monitoring and response evidence", "pass"],
    ["Apple", "Submitted-build console field evidence", "pass"],
    ["Apple", "Accessibility Nutrition Labels evidence", "n/a"],
    ["Google Play", "Closed testing production-access evidence", "n/a"],
    ["Google Play", "Closed-test tester links and opt-in evidence", "pass"],
    ["Google Play", "API 36 closed-test release", "pass"],
    ["Google Play", "Console submit/retry evidence", "pass-or-na"],
  ];

  for (const [platform, blockerName, rule] of requiredBlockers) {
    const row = blockers.rows.find(
      (candidate) =>
        normalize(candidate.Platform) === normalize(platform) &&
        normalize(candidate.Blocker) === normalize(blockerName),
    );
    if (!row) {
      fail("Current Console Blockers", `${platform} ${blockerName}`);
      continue;
    }

    const result = normalize(row.Result);
    if (
      (rule === "pass" && !isPassing(result)) ||
      (rule === "n/a" && !["n/a", "na"].includes(result)) ||
      (rule === "pass-or-na" &&
        !isPassing(result) &&
        !["n/a", "na"].includes(result))
    ) {
      fail("Current Console Blockers", `${platform} ${blockerName}`);
    }
    requireProof(
      "Current Console Blockers",
      `${platform} ${blockerName}`,
      row["Private proof filename or location"],
    );
  }

  const appleReview = blockers.rows.find(
    (row) =>
      normalize(row.Platform) === "apple" &&
      normalize(row.Blocker) ===
        normalize("App Review monitoring and response evidence"),
  );
  requireContains(
    "Current Console Blockers",
    "Apple App Review must remain on build 1.0 (3)",
    appleReview?.["Current handoff value"],
    EXPECTED_IOS_REVIEW_BUILD,
  );
}

const storeEvidence = section("Store Console Evidence");
if (storeEvidence) {
  const requirements = [
    ["Build selection", "Apple result", "pass"],
    ["Build selection", "Google Play result", "pass"],
    ["Google Play API 36 signed upload bundle", "Google Play result", "pass"],
    ["Google Play closed-test tester links", "Google Play result", "pass"],
    ["Google Play phone screenshots", "Google Play result", "pass"],
    ["Google Play feature graphic", "Google Play result", "pass"],
    ["App Store iPhone 6.5-inch screenshots", "Apple result", "pass"],
    ["App Store 13-inch iPad screenshots", "Apple result", "pass"],
    ["Category and pricing", "Apple result", "pass"],
    ["Category and pricing", "Google Play result", "pass"],
    ["Content rights", "Apple result", "pass"],
    ["App Privacy / Data Safety", "Apple result", "pass"],
    ["App Privacy / Data Safety", "Google Play result", "pass"],
    ["Age/content rating", "Apple result", "pass"],
    ["Age/content rating", "Google Play result", "pass"],
    ["Accessibility Nutrition Labels", "Apple result", "n/a"],
    ["Child safety standards declaration", "Google Play result", "pass"],
    ["Health apps declaration", "Google Play result", "pass"],
    ["Financial features declaration", "Google Play result", "pass"],
    ["Ads declaration", "Google Play result", "pass"],
    ["Account deletion web resource", "Google Play result", "pass"],
    ["Production-access closed test, if required", "Google Play result", "n/a"],
    ["Final validation and submit readiness", "Apple result", "pass"],
    ["Final validation and submit readiness", "Google Play result", "pass"],
  ];

  const checkedAreas = new Set();
  for (const [area, column, rule] of requirements) {
    const row = rowBy(storeEvidence, "Area", area);
    if (!row) {
      fail("Store Console Evidence", `${area} ${column}`);
      continue;
    }
    const result = normalize(row[column]);
    if (
      (rule === "pass" && !isPassing(result)) ||
      (rule === "n/a" && !["n/a", "na"].includes(result))
    ) {
      fail("Store Console Evidence", `${area} ${column}`);
    }

    if (!checkedAreas.has(area)) {
      checkedAreas.add(area);
      requireProof(
        "Store Console Evidence",
        area,
        row["Private proof filename or location"],
      );
      requireValue(
        "Store Console Evidence",
        `${area} repo-safe summary`,
        row["Repo-safe summary"],
      );
    }
  }
}

const testerInstall = section("Google Play Tester Install Evidence");
if (testerInstall) {
  const passingInstall = testerInstall.rows.find((row) => isPassing(row.Result));
  if (!passingInstall) {
    fail("Google Play Tester Install Evidence", "passing tester install row");
  } else {
    requireValue(
      "Google Play Tester Install Evidence",
      "tester alias",
      passingInstall["Tester alias"],
    );
    requirePassing(
      "Google Play Tester Install Evidence",
      "device Play account matches tester member",
      passingInstall["Device Play account matches tester member"],
    );
    requirePassing(
      "Google Play Tester Install Evidence",
      "web opt-in accepted",
      passingInstall["Web opt-in accepted"],
    );
    requirePassing(
      "Google Play Tester Install Evidence",
      "listing offers install or update",
      passingInstall["Android listing offers Install/Update"],
    );
    requireContains(
      "Google Play Tester Install Evidence",
      "installed Android build must be exact build 1.0.2 (3)",
      passingInstall["Installed release/version/build"],
      EXPECTED_ANDROID_BUILD,
    );
    requireValue(
      "Google Play Tester Install Evidence",
      "device and date",
      passingInstall["Device and date"],
    );
    requireProof(
      "Google Play Tester Install Evidence",
      "tester install",
      passingInstall["Private proof filename or location"],
    );
    requireProofDate(
      "Google Play Tester Install Evidence",
      "tester install",
      passingInstall["Proof date"],
    );
  }
}

const reviewerAccess = section("Reviewer Access");
if (reviewerAccess) {
  for (const [platform, expectedBuild] of [
    ["Apple", EXPECTED_IOS_REVIEW_BUILD],
    ["Google Play", EXPECTED_ANDROID_BUILD],
  ]) {
    const row = rowBy(reviewerAccess, "Platform", platform);
    requireValue("Reviewer Access", `${platform} tester alias`, row?.["Tester alias"]);
    requireContains(
      "Reviewer Access",
      `${platform} account must be email-confirmed`,
      row?.["Account state"],
      "email-confirmed",
    );
    requireContains(
      "Reviewer Access",
      `${platform} exact build or track`,
      row?.["Build or track validated"],
      expectedBuild,
    );
    requirePassing("Reviewer Access", `${platform} result`, row?.Result);
    if (isPassing(row?.Result)) {
      requireProof(
        "Reviewer Access",
        platform,
        row?.["Private proof filename or location"],
      );
      requireProofDate(
        "Reviewer Access",
        platform,
        row?.["Proof date"],
      );
    }
  }
}

const realDeviceQa = section("Real-Device QA");
if (realDeviceQa) {
  for (const [platform, expectedBuild] of [
    ["Android", EXPECTED_ANDROID_BUILD],
    ["iOS", EXPECTED_IOS_TESTFLIGHT_BUILD],
  ]) {
    const row = rowBy(realDeviceQa, "Platform", platform);
    for (const column of [
      "Device model",
      "OS version",
      "Install source",
      "Network",
    ]) {
      requireValue("Real-Device QA", `${platform} ${column}`, row?.[column]);
    }
    requireContains(
      "Real-Device QA",
      `${platform} exact build`,
      row?.["Build or deploy version"],
      expectedBuild,
    );
    requirePassing("Real-Device QA", `${platform} result`, row?.Result);
    requireProof("Real-Device QA", platform, row?.["Proof filename"]);
  }
}

const dmEvidence = section("Two-User DM Evidence");
if (dmEvidence) {
  for (const platform of ["Android", "iOS"]) {
    const row = rowBy(dmEvidence, "Platform", platform);
    requireValue("Two-User DM Evidence", `${platform} sender alias`, row?.["Sender alias"]);
    requireValue(
      "Two-User DM Evidence",
      `${platform} recipient alias`,
      row?.["Recipient alias"],
    );
    for (const column of [
      "Text send/read/reply",
      "Attachment",
      "Notification route",
      "Result",
    ]) {
      requirePassing("Two-User DM Evidence", `${platform} ${column}`, row?.[column]);
    }
    if (isPassing(row?.Result)) {
      requireProof(
        "Two-User DM Evidence",
        platform,
        row?.["Private proof filename or location"],
      );
      requireProofDate(
        "Two-User DM Evidence",
        platform,
        row?.["Proof date"],
      );
    }
  }
}

const nativePush = section("Native Push Evidence");
if (nativePush) {
  const requirements = [
    ["Project exists", "Android and iOS"],
    ["Android app config", "Android"],
    ["iOS app config", "iOS"],
    ["Device token registration", "Android"],
    ["Device token registration", "iOS"],
    ["Alert delivery", "Android"],
    ["Alert delivery", "iOS"],
    ["Tap routing", "Android"],
    ["Tap routing", "iOS"],
    ["Preferences respected", "Android and iOS"],
  ];

  for (const [area, platform] of requirements) {
    const row = nativePush.rows.find(
      (candidate) =>
        normalize(candidate["Evidence area"]) === normalize(area) &&
        normalize(candidate.Platform) === normalize(platform),
    );
    requirePassing(
      "Native Push Evidence",
      `${area} ${platform}`,
      row?.["Repo-safe result"],
    );
    requireProof(
      "Native Push Evidence",
      `${area} ${platform}`,
      row?.["Private proof filename or location"],
    );
  }
}

const legalReview = section("Legal And Policy Review");
if (legalReview) {
  for (const row of legalReview.rows) {
    const area = hasValue(row.Area) ? row.Area : "required review row";
    requireValue("Legal And Policy Review", `${area} reviewer`, row["Reviewer role or initials"]);
    requireValue("Legal And Policy Review", `${area} review date`, row["Review date"]);
    requirePassing("Legal And Policy Review", `${area} result`, row.Result);
  }
}

const legalSignoff = section("Legal Submission Signoff Matrix");
if (legalSignoff) {
  for (const row of legalSignoff.rows) {
    const area = hasValue(row.Area) ? row.Area : "required signoff row";
    requirePassing("Legal Submission Signoff Matrix", `${area} result`, row.Result);
    requireValue(
      "Legal Submission Signoff Matrix",
      `${area} reviewer`,
      row["Reviewer role or initials"],
    );
    requireValue(
      "Legal Submission Signoff Matrix",
      `${area} review date`,
      row["Review date"],
    );
    requireProof(
      "Legal Submission Signoff Matrix",
      area,
      row["Private proof filename or location"],
    );
  }
}

if (failures.length > 0) {
  if (verbose) {
    for (const failure of failures) {
      console.error(`FAIL ${failure}`);
    }
  } else {
    const failuresByArea = new Map();
    for (const failure of failures) {
      const [area] = failure.split(":");
      failuresByArea.set(area, (failuresByArea.get(area) ?? 0) + 1);
    }
    for (const [area, count] of failuresByArea) {
      console.error(`FAIL ${area} (${count} incomplete requirement(s))`);
    }
  }
  console.error(
    `${failures.length} private release evidence requirement(s) remain incomplete.`,
  );
  process.exit(1);
}

console.log(
  "PASS private release evidence is complete for the selected web, Android, and iOS release candidates.",
);
