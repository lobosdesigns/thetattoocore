import { readFileSync } from "node:fs";

const generator = readFileSync("scripts/generate-private-release-handoff.mjs", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const mobileRunbook = readFileSync("docs/MOBILE_APP_SUBMISSION_RUNBOOK.md", "utf8");
const realDeviceQa = readFileSync("docs/REAL_DEVICE_QA_CHECKLIST.md", "utf8");

const checks = [
  {
    label: "private handoff output is ignored and generated locally",
    ok:
      packageJson.includes('"prepare:private-release-handoff": "node scripts/generate-private-release-handoff.mjs"') &&
      packageJson.includes('"smoke:handoff": "node scripts/smoke-private-handoff-template.mjs"') &&
      packageJson.includes("npm run smoke:native && npm run smoke:handoff && npm run smoke:docs") &&
      packageJson.includes("npm run smoke:payments && npm run smoke:security && npm run smoke:handoff && npm run smoke:docs") &&
      packageJson.includes("npm run smoke:store && npm run smoke:pwa && npm run smoke:handoff && npm run smoke:docs") &&
      gitignore.includes("/private-release-handoff/") &&
      generator.includes('const outputDir = "private-release-handoff"') &&
      generator.includes('const outputPath = join(outputDir, "release-handoff-template.md")') &&
      generator.includes("mkdirSync(outputDir, { recursive: true })") &&
      generator.includes("writeFileSync(outputPath, template)"),
  },
  {
    label: "private handoff template covers store, QA, payment, legal, and push evidence",
    ok:
      generator.includes("## Store Console Evidence") &&
      generator.includes("## Reviewer Access") &&
      generator.includes("## Real-Device QA") &&
      generator.includes("## Two-User DM Evidence") &&
      generator.includes("## Payment And Commerce Evidence") &&
      generator.includes("## Native Push Evidence") &&
      generator.includes("## Legal And Policy Review") &&
      generator.includes("Reviewer contact saved in consoles") &&
      generator.includes("Screenshot upload validation") &&
      generator.includes("Accessibility Nutrition Labels") &&
      generator.includes("Production-access closed test, if required") &&
      generator.includes("Alert delivery") &&
      generator.includes("Tap routing"),
  },
  {
    label: "private handoff template blocks sensitive evidence from repo docs",
    ok:
      generator.includes("Do not commit reviewer passwords") &&
      generator.includes("one-time codes") &&
      generator.includes("tester emails") &&
      generator.includes("personal phone") &&
      generator.includes("account identifiers") &&
      generator.includes("raw device logs") &&
      generator.includes("console screenshots") &&
      generator.includes("payment") &&
      generator.includes("bank/card details") &&
      generator.includes("private DMs") &&
      generator.includes("license documents") &&
      generator.includes("buyer addresses") &&
      generator.includes("private user content") &&
      generator.includes("Repo-visible summaries should use only platform") &&
      generator.includes("pass/fail/blocker status"),
  },
  {
    label: "readiness docs point private evidence collection to the ignored template",
    ok:
      mobileRunbook.includes("npm.cmd run prepare:private-release-handoff") &&
      mobileRunbook.includes("Keep the generated `private-release-handoff/` folder out of git") &&
      mobileRunbook.includes("copy only repo-safe pass/fail summaries back into readiness docs") &&
      realDeviceQa.includes("npm.cmd run prepare:private-release-handoff") &&
      realDeviceQa.includes("The generated") &&
      realDeviceQa.includes("private-release-handoff/") &&
      realDeviceQa.includes("console, device, payment, legal, and push-delivery evidence only"),
  },
];

let failures = 0;

for (const check of checks) {
  if (check.ok) {
    console.log(`PASS ${check.label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${check.label}`);
  }
}

if (failures > 0) {
  console.error(`${failures} private handoff smoke check(s) failed.`);
  process.exit(1);
}
