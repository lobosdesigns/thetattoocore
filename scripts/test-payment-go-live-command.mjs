import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npmCommand,
  [
    "run",
    "verify:payment-go-live",
    "--",
    "--release-candidate=0123456789abcdef0123456789abcdef01234567",
    "--evidence=scripts/fixtures/payment-go-live-evidence.passed.md",
    "--reference-date=2026-07-23",
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
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
  }
  console.error("FAIL payment go-live command verifies its parser and evidence.");
  process.exit(1);
}

const expectedOutput = [
  "PASS payment gate accepts current ISO-dated fixture evidence",
  "PASS sanitized payment go-live fixture validates strict gate",
];
const missingOutput = expectedOutput.filter(
  (message) => !result.stdout.includes(message),
);

if (missingOutput.length) {
  console.error(
    "FAIL payment go-live command skipped parser regression coverage.",
  );
  process.exit(1);
}

console.log("PASS payment go-live command verifies its parser and evidence.");
