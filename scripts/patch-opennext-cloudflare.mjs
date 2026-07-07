import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const target = join(
  process.cwd(),
  "node_modules",
  "@opennextjs",
  "cloudflare",
  "dist",
  "cli",
  "build",
  "bundle-server.js",
);

const before = 'external: ["./middleware/handler.mjs"],';
const after = 'external: ["./middleware/handler.mjs", "cloudflare:sockets"],';

let source = readFileSync(target, "utf8");

if (source.includes(after)) {
  process.exit(0);
}

if (!source.includes(before)) {
  throw new Error("Could not find OpenNext Cloudflare external list to patch.");
}

source = source.replace(before, after);
writeFileSync(target, source);
