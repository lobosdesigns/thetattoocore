import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npmCommand,
  [
    "run",
    "verify:distribution-evidence",
    "--",
    "--release-candidate",
    "fixture-release-candidate",
    "--evidence",
    "scripts/fixtures/release-evidence.passed.md",
    "--reference-date",
    "2026-07-23",
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
  console.error(
    "FAIL distribution evidence command forwards release-candidate options.",
  );
  process.exit(1);
}

if (
  !result.stdout.includes(
    "PASS private release evidence is complete for the selected web, Android, and iOS release candidates.",
  )
) {
  console.error(
    "FAIL distribution evidence command did not verify the supplied fixture.",
  );
  process.exit(1);
}

console.log(
  "PASS distribution evidence command forwards release-candidate options.",
);
