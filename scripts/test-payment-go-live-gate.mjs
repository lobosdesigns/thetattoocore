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
  const source = fixtureSource.replaceAll(from, to);

  if (source === fixtureSource) {
    throw new Error(`Fixture variant ${name} did not change the source.`);
  }

  return writeSource(name, source);
}

function writeSource(name, source) {
  const path = join(variantDir, name);
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
const armedExcludedMarketplaceFixture = writeVariant(
  "armed-excluded-marketplace.md",
  "| Marketplace Merch checkout | 0123456789abcdef0123456789abcdef01234567 | blocked | fixture-only | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
  "| Marketplace Merch checkout | 0123456789abcdef0123456789abcdef01234567 | armed | fixture-only | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
);
const missingExcludedGateProofFixture = writeVariant(
  "missing-excluded-gate-proof.md",
  "| Booking deposit | 0123456789abcdef0123456789abcdef01234567 | blocked | fixture-only | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
  "| Booking deposit | 0123456789abcdef0123456789abcdef01234567 | blocked | | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
);
const completedProductionEvidenceFixture = writeSource(
  "completed-production-evidence.md",
  fixtureSource
    .replace(
      "| Official TTC Merch checkout | 0123456789abcdef0123456789abcdef01234567 | armed | fixture-only | passed | passed | passed | passed | passed | pending | passed |",
      "| Official TTC Merch checkout | 0123456789abcdef0123456789abcdef01234567 | enabled | fixture-only | passed | passed | passed | passed | passed | passed | passed |",
    )
    .replace(
      "| | Post-transaction production proof | Recorded only after a genuine authorized sale | pending | | fixture |",
      "| 2026-07-22T12:00:00Z | Post-transaction production proof | Sanitized fixture proof | passed | fixture-only | fixture |",
    ),
);

function runGate(
  evidencePath,
  releaseCandidate = fixtureCandidate,
  phase = "preauthorization",
) {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--phase",
      phase,
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
    label: "payment gate accepts official-Merch-only preauthorization evidence",
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
    label: "payment gate rejects n/a evidence for an armed excluded flow",
    result: runGate(armedExcludedMarketplaceFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Payment flow / Marketplace Merch checkout / Release switch state: must be exactly blocked while the flow is excluded",
        )
      );
    },
  },
  {
    label: "payment gate rejects excluded n/a without private blocked-state proof",
    result: runGate(missingExcludedGateProofFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Payment flow / Booking deposit / Private gate proof filename or location: missing",
        )
      );
    },
  },
  {
    label: "payment preauthorization does not require a production transaction",
    result: runGate(fixturePath),
    verify(result) {
      return result.status === 0;
    },
  },
  {
    label: "post-transaction evidence gate rejects pending production proof",
    result: runGate(fixturePath, fixtureCandidate, "post-transaction"),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Payment flow / Official TTC Merch checkout / Post-transaction production proof: pending",
        )
      );
    },
  },
  {
    label: "post-transaction evidence gate accepts completed production proof",
    result: runGate(
      completedProductionEvidenceFixture,
      fixtureCandidate,
      "post-transaction",
    ),
    verify(result) {
      return result.status === 0;
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
