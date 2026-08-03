import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const gatePath = resolve("scripts/smoke-payment-cutover-evidence.mjs");
const fixturePath = "scripts/fixtures/payment-go-live-evidence.passed.md";
const fixtureSource = readFileSync(fixturePath, "utf8");
const fixtureCandidate = "fixture-seller-link-release";
const referenceDate = "2026-08-02";
const variantDir = mkdtempSync(
  join("scripts", "fixtures", ".seller-link-rollout-test-"),
);
const outsideFixtureDir = mkdtempSync(join(tmpdir(), "seller-link-rollout-test-"));

function variant(name, transform, root = variantDir) {
  const source = transform(fixtureSource);
  if (source === fixtureSource) {
    throw new Error(`Fixture variant ${name} did not change the source.`);
  }
  const path = join(root, name);
  writeFileSync(path, source);
  return path;
}

const missingMigration = variant("missing-migration.md", (source) =>
  source.replace(
    "| 1. Approved migration | Sanitized fixture | No public seller link | passed | fixture-migration-proof | 2026-08-02 |",
    "",
  ),
);
const pendingPrivateReview = variant("pending-review.md", (source) =>
  source.replace(
    "| 4. Private seller link review | Sanitized fixture | Gate still false | passed |",
    "| 4. Private seller link review | Sanitized fixture | Gate still false | pending |",
  ),
);
const missingProof = variant("missing-proof.md", (source) =>
  source.replace("fixture-second-upload-proof", "pending"),
);
const staleProof = variant("stale-proof.md", (source) =>
  source.replace("| 2026-08-02 |", "| 2026-05-01 |"),
);
const futureProof = variant("future-proof.md", (source) =>
  source.replace("| 2026-08-02 |", "| 2026-08-03 |"),
);
const wrongCandidate = variant("wrong-candidate.md", (source) =>
  source.replace(fixtureCandidate, "fixture-different-release"),
);
const missingMarker = variant("missing-marker.md", (source) =>
  source.replace("<!-- TTC_SANITIZED_SELLER_LINK_ROLLOUT_FIXTURE -->", ""),
);
const rawSellerLink = variant("raw-seller-link.md", (source) =>
  source.replace("Sanitized fixture | Gate still false", "https://buy.stripe.com/example | Gate still false"),
);
const accountId = variant("account-id.md", (source) =>
  source.replace("fixture-link-review-proof", "acct_EXAMPLE123"),
);
const outsideFixture = variant(
  "outside-fixture.md",
  (source) => source.replace("This fixture contains aliases only.", "This fixture stays outside the fixture root."),
  outsideFixtureDir,
);

function runGate(evidence = fixturePath, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--test-fixture",
      "--reference-date",
      referenceDate,
      "--evidence",
      evidence,
      "--release-candidate",
      fixtureCandidate,
      ...extraArgs,
    ],
    { encoding: "utf8" },
  );
}

const checks = [
  {
    label: "seller-link rollout gate accepts the sanitized complete fixture",
    result: runGate(),
    matches: (result) =>
      result.status === 0 &&
      result.stdout.includes("PASS sanitized fixture validates the seller-link rollout gate"),
  },
  {
    label: "seller-link rollout gate rejects a missing controlled step",
    result: runGate(missingMigration),
    matches: (result) =>
      result.status === 1 &&
      result.stderr.includes("1. Approved migration row must appear exactly once"),
  },
  {
    label: "seller-link rollout gate rejects a pending private review",
    result: runGate(pendingPrivateReview),
    matches: (result) =>
      result.status === 1 &&
      result.stderr.includes("4. Private seller link review must be passed"),
  },
  {
    label: "seller-link rollout gate rejects missing private proof",
    result: runGate(missingProof),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("private proof is required"),
  },
  {
    label: "seller-link rollout gate rejects stale proof",
    result: runGate(staleProof),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("proof date must be within 45 days"),
  },
  {
    label: "seller-link rollout gate rejects future proof",
    result: runGate(futureProof),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("proof date cannot be in the future"),
  },
  {
    label: "seller-link rollout gate rejects a mismatched candidate",
    result: runGate(wrongCandidate),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("web deploy does not match"),
  },
  {
    label: "seller-link rollout gate requires the fixture marker",
    result: runGate(missingMarker),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("fixture marker is missing"),
  },
  {
    label: "seller-link rollout gate rejects a raw seller link",
    result: runGate(rawSellerLink),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("must not contain a seller link"),
  },
  {
    label: "seller-link rollout gate rejects a seller account identifier",
    result: runGate(accountId),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("must not contain a seller link"),
  },
  {
    label: "seller-link rollout fixture mode rejects paths outside fixtures",
    result: runGate(outsideFixture),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("must stay under scripts/fixtures"),
  },
  {
    label: "seller-link rollout gate rejects duplicate command options",
    result: runGate(fixturePath, ["--evidence", fixturePath]),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("--evidence may appear only once"),
  },
  {
    label: "seller-link rollout gate rejects unknown command options",
    result: runGate(fixturePath, ["--seller-link", "unsafe"]),
    matches: (result) =>
      result.status === 1 && result.stderr.includes("unknown option --seller-link"),
  },
];

let failures = 0;
for (const check of checks) {
  if (check.matches(check.result)) {
    console.log(`PASS ${check.label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${check.label}`);
  }
}

rmSync(variantDir, { force: true, recursive: true });
rmSync(outsideFixtureDir, { force: true, recursive: true });

if (failures > 0) {
  console.error(`${failures} seller-link rollout evidence test(s) failed.`);
  process.exit(1);
}
