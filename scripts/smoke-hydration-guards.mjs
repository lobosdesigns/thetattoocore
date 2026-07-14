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
const columnSnapRail = readFileSync("src/app/column-snap-rail.tsx", "utf8");

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

if (
  !columnSnapRail.includes("const router = useRouter()") ||
  !columnSnapRail.includes("lastRefreshAt") ||
  !columnSnapRail.includes("router.refresh()") ||
  !columnSnapRail.includes("now - lastRefreshAt.current > 5000")
) {
  failures += 1;
  console.error("FAIL src/app/column-snap-rail.tsx");
  console.error("  column switches should refresh fresh server-ranked column data with a cooldown");
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
