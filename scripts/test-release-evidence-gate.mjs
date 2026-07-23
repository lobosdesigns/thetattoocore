import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const gatePath = "scripts/verify-release-evidence.mjs";
const fixturePath = "scripts/fixtures/release-evidence.passed.md";
const fixtureCandidate = "fixture-release-candidate";
const fixtureReferenceDate = "2026-07-23";
const fixtureSource = readFileSync(fixturePath, "utf8");
const variantDir = mkdtempSync(
  join("scripts", "fixtures", ".release-evidence-test-"),
);

function writeVariant(name, transform) {
  const path = join(variantDir, name);
  const source = transform(fixtureSource);

  if (source === fixtureSource) {
    throw new Error(`Fixture variant ${name} did not change the source.`);
  }

  writeFileSync(path, source);
  return path;
}

const missingProofFixture = writeVariant("missing-proof.md", (source) =>
  source.replace("fixture-tester-install-proof", ""),
);
const staleProofFixture = writeVariant("stale-proof.md", (source) =>
  source.replace(
    "| fixture-tester-install-proof | 2026-07-23 | passed |",
    "| fixture-tester-install-proof | 2026-05-01 | passed |",
  ),
);
const mismatchedBuildFixture = writeVariant("mismatched-build.md", (source) =>
  source.replace(
    "| Alpha 1.0.2 (3) | fixture-device 2026-07-23 | fixture-tester-install-proof |",
    "| Alpha 1.0.1 (2) | fixture-device 2026-07-23 | fixture-tester-install-proof |",
  ),
);

function runGate(args, env = {}) {
  return spawnSync(process.execPath, [gatePath, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      TTC_RELEASE_CANDIDATE: "",
      ...env,
    },
  });
}

const checks = [
  {
    label: "release evidence accepts a matching explicit candidate",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      fixturePath,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 0 &&
        result.stdout.includes("PASS private release evidence is complete")
      );
    },
  },
  {
    label: "release evidence accepts a matching environment candidate",
    result: runGate(
      [
        "--test-fixture",
        "--reference-date",
        fixtureReferenceDate,
        "--evidence",
        fixturePath,
      ],
      {
        TTC_RELEASE_CANDIDATE: fixtureCandidate,
      },
    ),
    verify(result) {
      return result.status === 0;
    },
  },
  {
    label: "release evidence rejects an unbound candidate",
    result: runGate(["--evidence", fixturePath]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("current web release candidate is required")
      );
    },
  },
  {
    label: "release evidence rejects a stale candidate",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      fixturePath,
      "--release-candidate",
      "different-release-candidate",
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "web deploy does not match the requested release candidate",
        )
      );
    },
  },
  {
    label: "release evidence rejects an invalid candidate format",
    result: runGate([
      "--test-fixture",
      "--evidence",
      fixturePath,
      "--release-candidate",
      "../bad",
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("release candidate format is invalid")
      );
    },
  },
  {
    label: "release evidence rejects missing critical private proof",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      missingProofFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("tester install private proof")
      );
    },
  },
  {
    label: "release evidence rejects stale critical private proof",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      staleProofFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("proof date must be within 45 days")
      );
    },
  },
  {
    label: "release evidence rejects a mismatched tester build",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      mismatchedBuildFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "installed Android build must be exact build 1.0.2 (3)",
        )
      );
    },
  },
];

let failures = 0;

for (const check of checks) {
  if (check.verify(check.result)) {
    console.log(`PASS ${check.label}`);
    continue;
  }

  failures += 1;
  console.error(`FAIL ${check.label}`);
}

rmSync(variantDir, { force: true, recursive: true });

if (failures > 0) {
  console.error(`${failures} release evidence gate test(s) failed.`);
  process.exit(1);
}
