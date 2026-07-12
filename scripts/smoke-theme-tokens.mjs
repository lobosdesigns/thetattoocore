import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { cwd } from "node:process";

const filesToCheck = [
  "src/app/account/page.tsx",
  "src/app/admin/users/page.tsx",
  "src/app/admin/verification/page.tsx",
  "src/app/pending-submit-button.tsx",
  "src/app/globals.css",
];
const bannedSnippets = [
  "disabled:bg-[color-mix(in_srgb,var(--paper-soft)_90%,transparent)]",
  "disabled:text-[var(--muted-strong)]",
];
const requiredSnippets = [
  {
    file: "src/app/globals.css",
    snippets: [
      ".ttc-disabled-state:disabled",
      ':root[data-theme="dark"] .ttc-disabled-state:disabled',
    ],
  },
  {
    file: "src/app/pending-submit-button.tsx",
    snippets: ["ttc-disabled-state"],
  },
];

let failures = 0;

for (const file of filesToCheck) {
  const body = readFileSync(file, "utf8");
  const found = bannedSnippets.filter((snippet) => body.includes(snippet));

  if (found.length) {
    failures += 1;
    console.error(`FAIL ${relative(cwd(), file)}`);
    console.error(`  banned disabled-theme snippets: ${found.join(", ")}`);
  }
}

for (const { file, snippets } of requiredSnippets) {
  const body = readFileSync(file, "utf8");
  const missing = snippets.filter((snippet) => !body.includes(snippet));

  if (missing.length) {
    failures += 1;
    console.error(`FAIL ${relative(cwd(), file)}`);
    console.error(`  missing theme snippets: ${missing.join(", ")}`);
  }
}

if (failures) {
  console.error(`${failures} theme token smoke check(s) failed.`);
  process.exit(1);
}

console.log("PASS theme token smoke checks");
