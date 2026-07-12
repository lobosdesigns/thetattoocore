import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { cwd } from "node:process";

const sourceRoot = "src/app";

const riskyInitializers = [
  /useState(?:<[^>]+>)?\(\s*\(\)\s*=>[\s\S]*?(?:window|document|localStorage|sessionStorage|navigator)\b[\s\S]*?\)/m,
  /useState(?:<[^>]+>)?\(\s*function[\s\S]*?(?:window|document|localStorage|sessionStorage|navigator)\b[\s\S]*?\)/m,
];

let failures = 0;
const clientFiles = listTsxFiles(sourceRoot).filter((file) =>
  readFileSync(file, "utf8").startsWith('"use client";'),
);

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

function listTsxFiles(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      const stats = statSync(path);

      if (stats.isDirectory()) return listTsxFiles(path);
      if (stats.isFile() && path.endsWith(".tsx")) return [path];

      return [];
    })
    .sort();
}
