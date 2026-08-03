import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npmCommand,
  [
    "run",
    "verify:seller-link-rollout-evidence",
    "--",
    "--release-candidate",
    "fixture-seller-link-release",
    "--evidence",
    "scripts/fixtures/payment-go-live-evidence.passed.md",
    "--reference-date",
    "2026-08-02",
    "--test-fixture",
  ],
  {
    encoding: "utf8",
    shell: process.platform === "win32",
  },
);

if (result.status !== 0) {
  process.stderr.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  console.error("FAIL seller-link rollout command forwards private evidence options.");
  process.exit(1);
}

const expectedOutput = [
  "PASS seller-link rollout gate accepts the sanitized complete fixture",
  "PASS sanitized fixture validates the seller-link rollout gate",
];
const missingOutput = expectedOutput.filter(
  (message) => !result.stdout.includes(message),
);

if (missingOutput.length) {
  console.error("FAIL seller-link rollout command skipped evidence regression coverage.");
  process.exit(1);
}

console.log("PASS seller-link rollout command forwards private evidence options.");
