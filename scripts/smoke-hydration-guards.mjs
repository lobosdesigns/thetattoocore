import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { cwd } from "node:process";

const clientFiles = [
  "src/app/column-tabs.tsx",
  "src/app/floating-composer-shell.tsx",
  "src/app/language-status-banner.tsx",
  "src/app/theme-preference-picker.tsx",
];

const riskyInitializers = [
  /useState(?:<[^>]+>)?\(\s*\(\)\s*=>[\s\S]*?(?:window|document|localStorage|sessionStorage|navigator)\b[\s\S]*?\)/m,
  /useState(?:<[^>]+>)?\(\s*function[\s\S]*?(?:window|document|localStorage|sessionStorage|navigator)\b[\s\S]*?\)/m,
];

let failures = 0;

for (const file of clientFiles) {
  const body = readFileSync(file, "utf8");
  const matches = riskyInitializers.filter((pattern) => pattern.test(body));

  if (matches.length > 0) {
    failures += 1;
    console.error(`FAIL ${relative(cwd(), file)}`);
    console.error(
      "  browser-only state must sync after hydration, not inside the initial render",
    );
  }
}

if (failures > 0) {
  console.error(`${failures} hydration guard smoke check(s) failed.`);
  process.exit(1);
}

console.log("PASS hydration guard smoke checks");
