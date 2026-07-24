import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const gatePath = "scripts/verify-release-evidence.mjs";
const fixturePath = "scripts/fixtures/release-evidence.passed.md";
const fixtureCandidate = "fixture-release-candidate";
const fixtureReferenceDate = "2026-07-23";
const fixtureMarker = "<!-- TTC_SANITIZED_RELEASE_EVIDENCE_FIXTURE -->";
const liveCandidate = "live-release-candidate";
const fixtureSource = readFileSync(fixturePath, "utf8");
const variantDir = mkdtempSync(
  join("scripts", "fixtures", ".release-evidence-test-"),
);
const liveVariantDir = mkdtempSync(join(tmpdir(), "ttc-release-evidence-test-"));

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
    "| Alpha 1.0.3 (4) | fixture-device 2026-07-23 | fixture-tester-install-proof |",
    "| Alpha 1.0.1 (2) | fixture-device 2026-07-23 | fixture-tester-install-proof |",
  ),
);
const productionTrackFixture = writeVariant("production-track.md", (source) =>
  source.replace(
    "| Android release track and version/build | Closed testing - Alpha 1.0.3 (4) |",
    "| Android release track and version/build | Google Play Production 1.0.3 (4) Active |",
  ),
);
const unknownTrackFixture = writeVariant("unknown-track.md", (source) =>
  source.replace(
    "| Android release track and version/build | Closed testing - Alpha 1.0.3 (4) |",
    "| Android release track and version/build | Candidate 1.0.3 (4) |",
  ),
);
const staleRealDeviceDateFixture = writeVariant(
  "stale-real-device-date.md",
  (source) =>
    source.replace(
      "| Android | fixture-device | Android 16 | 1.0.3 (4) | Google Play | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-07-23 |",
      "| Android | fixture-device | Android 16 | 1.0.3 (4) | Google Play | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-05-01 |",
    ),
);
const promotedIpadFixture = writeVariant("promoted-ipad.md", (source) =>
  source.replace(
    "| iOS | iPhone fixture-device | iOS current | 1.0 (4) | TestFlight | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-07-23 |",
    "| iOS | iPad fixture-device | iOS current | 1.0 (4) | TestFlight | Wi-Fi and cellular | owner-confirmed | install only | passed | fixture-proof | 2026-07-23 |",
  ),
);
const promotedAndroidPartialFixture = writeVariant(
  "promoted-android-partial.md",
  (source) =>
    source.replace(
      "| Android | fixture-device | Android 16 | 1.0.3 (4) | Google Play | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-07-23 |",
      "| Android | fixture-device | Android 16 | 1.0.3 (4) | manual install | Wi-Fi | owner-confirmed | install only | passed | fixture-proof | 2026-07-23 |",
    ),
);
const missingMarkerFixture = writeVariant("missing-marker.md", (source) =>
  source.replace(fixtureMarker, ""),
);
const livePlaceholderFixture = join(liveVariantDir, "live-placeholder.md");
writeFileSync(
  livePlaceholderFixture,
  fixtureSource
    .replace(fixtureMarker, "")
    .replaceAll(fixtureCandidate, liveCandidate),
);
const missingLegalReviewFixture = writeVariant(
  "missing-legal-review.md",
  (source) =>
    source.replace(
      "| Terms and Privacy match submitted build | reviewer | 2026-07-23 | passed | Fixture |\n",
      "",
    ),
);
const duplicateLegalSignoffFixture = writeVariant(
  "duplicate-legal-signoff.md",
  (source) =>
    source.replace(
      "| Public legal URLs | Sanitized fixture | passed | reviewer | 2026-07-23 | fixture-proof |",
      [
        "| Public legal URLs | Sanitized fixture | passed | reviewer | 2026-07-23 | fixture-proof |",
        "| Public legal URLs | Sanitized fixture | passed | reviewer | 2026-07-23 | fixture-proof |",
      ].join("\n"),
    ),
);
const staleLegalDateFixture = writeVariant(
  "stale-legal-date.md",
  (source) =>
    source.replace(
      "| Terms and Privacy match submitted build | reviewer | 2026-07-23 | passed | Fixture |",
      "| Terms and Privacy match submitted build | reviewer | 2026-05-01 | passed | Fixture |",
    ),
);
const futureLegalDateFixture = writeVariant(
  "future-legal-date.md",
  (source) =>
    source.replace(
      "| Public legal URLs | Sanitized fixture | passed | reviewer | 2026-07-23 | fixture-proof |",
      "| Public legal URLs | Sanitized fixture | passed | reviewer | 2026-07-24 | fixture-proof |",
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
    label: "release evidence accepts the exact build on the production track",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      productionTrackFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return result.status === 0;
    },
  },
  {
    label: "release evidence rejects an unidentified Android track",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      unknownTrackFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Android release track must identify Alpha, closed testing, or production",
        )
      );
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
    label: "release evidence rejects sanitized fixtures outside fixture mode",
    result: runGate([
      "--evidence",
      fixturePath,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "sanitized fixture candidates cannot approve a live release",
        )
      );
    },
  },
  {
    label: "release evidence requires an explicit fixture marker",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      missingMarkerFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("release evidence fixture marker is missing")
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
    label: "release evidence rejects a partial candidate match",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      fixturePath,
      "--release-candidate",
      "fixture-release",
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
          "installed Android build must be exact build 1.0.3 (4)",
        )
      );
    },
  },
  {
    label: "release evidence rejects stale real-device proof dates",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      staleRealDeviceDateFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Real-Device QA: Android proof date must be within 45 days",
        )
      );
    },
  },
  {
    label: "release evidence rejects promoted Android install-only QA",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      promotedAndroidPartialFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Real-Device QA: Android install source must be Google Play",
        ) &&
        result.stderr.includes(
          "Real-Device QA: Android evidence basis must be device-captured",
        ) &&
        result.stderr.includes(
          "Real-Device QA: Android QA scope must be full checklist",
        )
      );
    },
  },
  {
    label: "release evidence rejects promoted iPad install-only QA",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      promotedIpadFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Real-Device QA: iOS device model must be an iPhone",
        ) &&
        result.stderr.includes(
          "Real-Device QA: iOS evidence basis must be device-captured",
        ) &&
        result.stderr.includes(
          "Real-Device QA: iOS QA scope must be full checklist",
        )
      );
    },
  },
  {
    label: "release evidence rejects fixture proof in live evidence",
    result: runGate([
      "--verbose",
      "--evidence",
      livePlaceholderFixture,
      "--release-candidate",
      liveCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "private proof cannot use fixture or sample placeholders",
        )
      );
    },
  },
  {
    label: "release evidence rejects a missing legal review row",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      missingLegalReviewFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Terms and Privacy match submitted build row is missing",
        )
      );
    },
  },
  {
    label: "release evidence rejects duplicate legal signoff rows",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      duplicateLegalSignoffFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Public legal URLs row must appear exactly once",
        )
      );
    },
  },
  {
    label: "release evidence rejects stale legal review dates",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      staleLegalDateFixture,
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
    label: "release evidence rejects future legal signoff dates",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      futureLegalDateFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("proof date cannot be in the future")
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
rmSync(liveVariantDir, { force: true, recursive: true });

if (failures > 0) {
  console.error(`${failures} release evidence gate test(s) failed.`);
  process.exit(1);
}
