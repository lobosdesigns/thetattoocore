import { spawnSync } from "node:child_process";

const gatePath = "scripts/verify-release-evidence.mjs";
const fixturePath = "scripts/fixtures/release-evidence.passed.md";
const fixtureCandidate = "fixture-release-candidate";

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
    result: runGate(["--test-fixture", "--evidence", fixturePath], {
      TTC_RELEASE_CANDIDATE: fixtureCandidate,
    }),
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

if (failures > 0) {
  console.error(`${failures} release evidence gate test(s) failed.`);
  process.exit(1);
}
