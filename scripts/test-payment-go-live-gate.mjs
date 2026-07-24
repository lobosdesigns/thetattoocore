import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const gatePath = "scripts/smoke-payment-cutover-evidence.mjs";
const fixturePath = "scripts/fixtures/payment-go-live-evidence.passed.md";
const fixtureCandidate = "0123456789abcdef0123456789abcdef01234567";
const fixtureReferenceDate = "2026-07-23";
const fixtureSource = readFileSync(fixturePath, "utf8");
const variantDir = mkdtempSync(
  join("scripts", "fixtures", ".payment-go-live-test-"),
);

function writeVariant(name, from, to) {
  const path = join(variantDir, name);
  const source = fixtureSource.replaceAll(from, to);

  if (source === fixtureSource) {
    throw new Error(`Fixture variant ${name} did not change the source.`);
  }

  writeFileSync(path, source);
  return path;
}

const staleFixture = writeVariant(
  "stale-dashboard-date.md",
  "2026-07-22T12:00:00Z",
  "2026-05-01T12:00:00Z",
);
const futureFixture = writeVariant(
  "future-dashboard-date.md",
  "2026-07-22T12:00:00Z",
  "2026-07-24T12:00:00Z",
);
const ambiguousFixture = writeVariant(
  "ambiguous-dashboard-date.md",
  "2026-07-22T12:00:00Z",
  "07/22/2026 12:00",
);
const mixedExcludedAdsFixture = writeVariant(
  "mixed-excluded-ads.md",
  "| Ads checkout | 0123456789abcdef0123456789abcdef01234567 | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
  "| Ads checkout | 0123456789abcdef0123456789abcdef01234567 | passed | n/a | n/a | n/a | n/a | n/a | n/a |",
);

function runGate(evidencePath, releaseCandidate = fixtureCandidate) {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      evidencePath,
      "--release-candidate",
      releaseCandidate,
    ],
    { encoding: "utf8" },
  );
}

function runProductionClockOverride() {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      fixturePath,
      "--release-candidate",
      fixtureCandidate,
    ],
    { encoding: "utf8" },
  );
}

function runProductionUnknownCandidate() {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--evidence",
      fixturePath,
      "--release-candidate",
      "0000000000000000000000000000000000000000",
    ],
    { encoding: "utf8" },
  );
}

const checks = [
  {
    label: "payment gate accepts current ISO-dated fixture evidence",
    result: runGate(fixturePath),
    verify(result) {
      return (
        result.status === 0 &&
        result.stdout.includes(
          "PASS sanitized payment go-live fixture validates strict gate",
        )
      );
    },
  },
  {
    label: "payment gate rejects stale dashboard evidence",
    result: runGate(staleFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("date must be within 45 days")
      );
    },
  },
  {
    label: "payment gate rejects future dashboard evidence",
    result: runGate(futureFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("date cannot be in the future")
      );
    },
  },
  {
    label: "payment gate rejects ambiguous dashboard dates",
    result: runGate(ambiguousFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("Attempt date/time: invalid date")
      );
    },
  },
  {
    label: "payment gate rejects mixed evidence for an excluded Ads flow",
    result: runGate(mixedExcludedAdsFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Payment flow / Ads checkout / Expected mode checked: must be exactly n/a while Ads checkout is excluded",
        )
      );
    },
  },
  {
    label: "payment gate rejects symbolic release candidates",
    result: runGate(fixturePath, "latest"),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("must be a 7-40 character Git commit ID")
      );
    },
  },
  {
    label: "payment gate rejects unresolved production commits",
    result: runProductionUnknownCandidate(),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("does not resolve to a local Git commit")
      );
    },
  },
  {
    label: "payment gate rejects production clock overrides",
    result: runProductionClockOverride(),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("--reference-date: test fixtures only")
      );
    },
  },
];

let failures = 0;

for (const check of checks) {
  if (check.verify(check.result)) {
    console.log(`PASS ${check.label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${check.label}`);
  }
}

rmSync(variantDir, { force: true, recursive: true });

if (failures > 0) {
  console.error(`${failures} payment go-live gate test(s) failed.`);
  process.exit(1);
}
