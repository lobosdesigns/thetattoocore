import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function strictCommandRunsEnvironmentGuard(source) {
  const scripts = JSON.parse(source).scripts ?? {};
  const command = scripts["verify:seller-link-rollout-evidence"] ?? "";
  const steps = command.split(" && ");

  return (
    steps[0] === "npm run smoke:env" &&
    steps.filter((step) => step === "npm run smoke:env").length === 1 &&
    !String(scripts["smoke:env"] ?? "").includes(
      "verify:seller-link-rollout-evidence",
    )
  );
}

const packageSource = readFileSync("package.json", "utf8");
assert.equal(
  strictCommandRunsEnvironmentGuard(packageSource),
  true,
  "strict seller-link rollout command must run smoke:env first without recursion",
);
const commandWithoutEnvironmentGuard = packageSource.replace(
  '"verify:seller-link-rollout-evidence": "npm run smoke:env && ',
  '"verify:seller-link-rollout-evidence": "',
);
assert.notEqual(
  commandWithoutEnvironmentGuard,
  packageSource,
  "strict command smoke:env mutation did not change package.json",
);
assert.equal(
  strictCommandRunsEnvironmentGuard(commandWithoutEnvironmentGuard),
  false,
  "strict command guard accepted removal of smoke:env",
);

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
  "PASS seller checkout release gate is exact false in repo-safe config",
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
