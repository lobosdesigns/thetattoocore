import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const gatePath = resolve("scripts/verify-release-evidence.mjs");
const fixturePath = "scripts/fixtures/release-evidence.passed.md";
const fixtureCandidate = "fixture-release-candidate";
const fixtureReferenceDate = "2026-07-23";
const fixtureMarker = "<!-- TTC_SANITIZED_RELEASE_EVIDENCE_FIXTURE -->";
const releaseProfile = "native-store-distribution";
const noDefaultReleaseProfile = "--no-default-release-profile";
const gitHead = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
});
if (gitHead.status !== 0 || !gitHead.stdout.trim()) {
  throw new Error("Unable to resolve the current Git commit for live-mode tests.");
}
const liveCandidate = gitHead.stdout.trim();

function findUnresolvedCandidate() {
  for (const digit of "0123456789abcdef") {
    const candidate = digit.repeat(40);
    const probe = spawnSync(
      "git",
      ["cat-file", "-e", `${candidate}^{object}`],
      { stdio: "ignore" },
    );
    if (probe.status !== 0) return candidate;
  }

  throw new Error("Unable to find an unresolved Git object ID for live-mode tests.");
}

const unresolvedCandidate = findUnresolvedCandidate();
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

const unknownCurrentAppReviewFixture = writeVariant(
  "unknown-current-app-review.md",
  (source) =>
    source.replace(
      "| Current App Review version/build | App Review 1.0 (5) |",
      "| Current App Review version/build | UNKNOWN |",
    ),
);
const candidateOnlyAsServedFixture = writeVariant(
  "candidate-only-as-served.md",
  (source) =>
    source.replace(
      "| Current TestFlight version/build | TestFlight 1.0 (5) |",
      "| Current TestFlight version/build | Checked-in iOS source candidate 1.0 (5); no console proof |",
    ),
);

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
    "| Alpha 1.0.5 (6) | fixture-device 2026-07-23 | fixture-tester-install-proof |",
    "| Alpha 1.0.1 (2) | fixture-device 2026-07-23 | fixture-tester-install-proof |",
  ),
);
const mixedAndroidBuildFixture = writeVariant(
  "mixed-android-build.md",
  (source) =>
    source.replace(
      "| Current Google Play Alpha version/build | Closed testing - Alpha 1.0.5 (6) |",
      "| Current Google Play Alpha version/build | Closed testing - Alpha 1.0.5 (6) plus stale 1.0.3 (4) |",
    ),
);
const mixedPrefixedAndroidBuildFixture = writeVariant(
  "mixed-prefixed-android-build.md",
  (source) =>
    source.replace(
      "| Current Google Play Alpha version/build | Closed testing - Alpha 1.0.5 (6) |",
      "| Current Google Play Alpha version/build | Closed testing - Alpha 1.0.5 (6) plus stale v1.0 (4) |",
    ),
);
const duplicateAndroidCandidateFixture = writeVariant(
  "duplicate-android-candidate.md",
  (source) =>
    source.replace(
      "| Android checked-in source candidate | 1.0.5 (6) |",
      [
        "| Android checked-in source candidate | 1.0.5 (6) |",
        "| Android checked-in source candidate | 1.0.3 (4) |",
      ].join("\n"),
    ),
);
const mismatchedIosCandidateFixture = writeVariant(
  "mismatched-ios-candidate.md",
  (source) =>
    source.replace(
      "| Current TestFlight version/build | TestFlight 1.0 (5) |",
      "| Current TestFlight version/build | TestFlight 1.0 (4) |",
    ),
);
const mixedAppReviewFixture = writeVariant(
  "mixed-app-review.md",
  (source) =>
    source.replace(
      "| Apple | App Review monitoring and response evidence | App Store Connect iOS App Version 1.0 build 1.0 (5) | passed | fixture-proof |",
      "| Apple | App Review monitoring and response evidence | App Store Connect iOS App Version 1.0 build 1.0 (5) plus stale 1.0 (3) | passed | fixture-proof |",
    ),
);
const mismatchedAppReviewFixture = writeVariant(
  "mismatched-app-review.md",
  (source) =>
    source.replace(
      "| Apple | App Review monitoring and response evidence | App Store Connect iOS App Version 1.0 build 1.0 (5) | passed | fixture-proof |",
      "| Apple | App Review monitoring and response evidence | App Store Connect iOS App Version 1.0 build 1.0 (4) | passed | fixture-proof |",
    ),
);
const productionTrackFixture = writeVariant("production-track.md", (source) =>
  source
    .replace(
      "| Current Google Play Production version/build | Production 1.0.3 (4) |",
      "| Current Google Play Production version/build | Production 1.0.5 (6) Active |",
    )
    .replace(
      "| Current Google Play Alpha version/build | Closed testing - Alpha 1.0.5 (6) |",
      "| Current Google Play Alpha version/build | Alpha 1.0.4 (5) |",
    ),
);
const unknownTrackFixture = writeVariant("unknown-track.md", (source) =>
  source
    .replace(
      "| Current Google Play Production version/build | Production 1.0.3 (4) |",
      "| Current Google Play Production version/build | No active release verified |",
    )
    .replace(
      "| Current Google Play Alpha version/build | Closed testing - Alpha 1.0.5 (6) |",
      "| Current Google Play Alpha version/build | No active release verified |",
    ),
);
const staleRealDeviceDateFixture = writeVariant(
  "stale-real-device-date.md",
  (source) =>
    source.replace(
      "| Android | fixture-device | Android 16 | 1.0.5 (6) | Google Play | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-07-23 |",
      "| Android | fixture-device | Android 16 | 1.0.5 (6) | Google Play | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-05-01 |",
    ),
);
const promotedIpadFixture = writeVariant("promoted-ipad.md", (source) =>
  source.replace(
    "| iOS | iPhone fixture-device | iOS current | 1.0 (5) | TestFlight | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-07-23 |",
    "| iOS | iPad fixture-device | iOS current | 1.0 (5) | TestFlight | Wi-Fi and cellular | owner-confirmed | install only | passed | fixture-proof | 2026-07-23 |",
  ),
);
const promotedAndroidPartialFixture = writeVariant(
  "promoted-android-partial.md",
  (source) =>
    source.replace(
      "| Android | fixture-device | Android 16 | 1.0.5 (6) | Google Play | Wi-Fi and cellular | device-captured | full checklist | passed | fixture-proof | 2026-07-23 |",
      "| Android | fixture-device | Android 16 | 1.0.5 (6) | manual install | Wi-Fi | owner-confirmed | install only | passed | fixture-proof | 2026-07-23 |",
    ),
);
const mismatchedDmBuildFixture = writeVariant(
  "mismatched-dm-build.md",
  (source) =>
    source.replace(
      "| Android | 1.0.5 (6) | fixture-sender | fixture-recipient |",
      "| Android | 1.0.2 (3) | fixture-sender | fixture-recipient |",
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
const tagRepoDir = mkdtempSync(join(tmpdir(), "ttc-release-tag-test-"));

function runTagRepoGit(args) {
  const result = spawnSync("git", args, {
    cwd: tagRepoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "TTC Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "TTC Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `Git fixture command failed: git ${args.join(" ")}: ${result.stderr.trim()}`,
    );
  }

  return result.stdout.trim();
}

runTagRepoGit(["init", "--quiet"]);
runTagRepoGit(["commit", "--allow-empty", "--message", "fixture commit"]);
runTagRepoGit(["tag", "--annotate", "fixture-tag", "--message", "fixture tag"]);
const annotatedTagCandidate = runTagRepoGit(["rev-parse", "refs/tags/fixture-tag"]);
const annotatedTagEvidence = join(liveVariantDir, "annotated-tag.md");
writeFileSync(
  annotatedTagEvidence,
  fixtureSource
    .replace(fixtureMarker, "")
    .replaceAll(fixtureCandidate, annotatedTagCandidate),
);
const missingLegalReviewFixture = writeVariant(
  "missing-legal-review.md",
  (source) =>
    source.replace(
      "| Terms and Privacy match submitted build | reviewer | 2026-07-23 | passed | Fixture |",
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

function runGate(args, env = {}, cwd = undefined) {
  const useDefaultProfile = !args.includes(noDefaultReleaseProfile);
  const forwardedArgs = args.filter((arg) => arg !== noDefaultReleaseProfile);
  const profileArgs =
    useDefaultProfile && !forwardedArgs.includes("--release-profile")
      ? ["--release-profile", releaseProfile]
      : [];

  return spawnSync(process.execPath, [gatePath, ...profileArgs, ...forwardedArgs], {
    cwd,
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
    label: "release evidence fails closed when current App Review identity is unknown",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      unknownCurrentAppReviewFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("current App Review identity cannot be UNKNOWN")
      );
    },
  },
  {
    label: "release evidence rejects candidate-only state presented as served evidence",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      candidateOnlyAsServedFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "current TestFlight identity must come from separately supplied private evidence",
        )
      );
    },
  },
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
        result.stdout.includes(
          "PASS private release evidence is complete for the selected native-store-distribution",
        )
      );
    },
  },
  {
    label: "release evidence rejects a missing release profile",
    result: runGate([
      noDefaultReleaseProfile,
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
        result.status === 1 &&
        result.stderr.includes("release profile is required")
      );
    },
  },
  {
    label: "release evidence rejects an unknown release profile",
    result: runGate([
      "--release-profile",
      "web-production",
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
        result.status === 1 &&
        result.stderr.includes("unsupported release profile")
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
    label: "release evidence rejects mixed current and stale Android builds",
    result: runGate([
      "--test-fixture",
      "--verbose",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      mixedAndroidBuildFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "current Google Play Alpha identity must contain at most one exact build",
        )
      );
    },
  },
  {
    label: "release evidence rejects v-prefixed stale Android builds",
    result: runGate([
      "--test-fixture",
      "--verbose",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      mixedPrefixedAndroidBuildFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "current Google Play Alpha identity must contain at most one exact build",
        )
      );
    },
  },
  {
    label: "release evidence rejects duplicate Android candidate rows",
    result: runGate([
      "--test-fixture",
      "--verbose",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      duplicateAndroidCandidateFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Android checked-in source candidate row must appear exactly once",
        )
      );
    },
  },
  {
    label: "release evidence rejects a mismatched current TestFlight identity",
    result: runGate([
      "--test-fixture",
      "--verbose",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      mismatchedIosCandidateFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "current TestFlight identity must match checked-in source candidate 1.0 (5)",
        )
      );
    },
  },
  {
    label: "release evidence rejects mixed App Review builds",
    result: runGate([
      "--test-fixture",
      "--verbose",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      mixedAppReviewFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Apple App Review evidence must match the privately supplied current review identity",
        )
      );
    },
  },
  {
    label: "release evidence rejects a mismatched App Review build",
    result: runGate([
      "--test-fixture",
      "--verbose",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      mismatchedAppReviewFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Apple App Review evidence must match the privately supplied current review identity",
        )
      );
    },
  },
  {
    label: "release evidence rejects current tracks without the source candidate",
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
          "current Google Play Production or Alpha evidence must identify the checked-in Android source candidate",
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
    label: "release evidence rejects a mutable live candidate label",
    result: runGate([
      "--evidence",
      livePlaceholderFixture,
      "--release-candidate",
      "live-release-candidate",
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "live release candidate must be a 7-40 character Git commit ID",
        )
      );
    },
  },
  {
    label: "release evidence rejects an unresolved live commit",
    result: runGate([
      "--evidence",
      livePlaceholderFixture,
      "--release-candidate",
      unresolvedCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "live release candidate does not resolve to a local Git commit",
        )
      );
    },
  },
  {
    label: "release evidence resolves a valid live environment candidate",
    result: runGate(
      ["--verbose", "--evidence", livePlaceholderFixture],
      {
        TTC_RELEASE_CANDIDATE: liveCandidate,
      },
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "private proof cannot use fixture or sample placeholders",
        ) &&
        !result.stderr.includes("live release candidate")
      );
    },
  },
  {
    label: "release evidence rejects a mutable live environment candidate",
    result: runGate(
      ["--evidence", livePlaceholderFixture],
      {
        TTC_RELEASE_CANDIDATE: "live-release-candidate",
      },
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "live release candidate must be a 7-40 character Git commit ID",
        )
      );
    },
  },
  {
    label: "release evidence rejects an unresolved live environment commit",
    result: runGate(
      ["--evidence", livePlaceholderFixture],
      {
        TTC_RELEASE_CANDIDATE: unresolvedCandidate,
      },
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "live release candidate does not resolve to a local Git commit",
        )
      );
    },
  },
  {
    label: "release evidence rejects an annotated tag object hash",
    result: runGate(
      [
        "--evidence",
        annotatedTagEvidence,
        "--release-candidate",
        annotatedTagCandidate,
      ],
      {},
      tagRepoDir,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "live release candidate does not resolve to a local Git commit",
        )
      );
    },
  },
  {
    label: "release evidence reports an unavailable local Git repository",
    result: runGate(
      [
        "--evidence",
        livePlaceholderFixture,
        "--release-candidate",
        liveCandidate,
      ],
      {},
      liveVariantDir,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("unable to inspect the local Git repository")
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
          "installed Android evidence must match the privately supplied current installed identity",
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
    label: "release evidence rejects historical two-user DM builds",
    result: runGate([
      "--test-fixture",
      "--reference-date",
      fixtureReferenceDate,
      "--verbose",
      "--evidence",
      mismatchedDmBuildFixture,
      "--release-candidate",
      fixtureCandidate,
    ]),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Two-User DM Evidence: Android DM evidence must match the privately supplied current identity",
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
rmSync(tagRepoDir, { force: true, recursive: true });

if (failures > 0) {
  console.error(`${failures} release evidence gate test(s) failed.`);
  process.exit(1);
}
