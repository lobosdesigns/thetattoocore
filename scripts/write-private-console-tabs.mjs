import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { homedir } from "node:os";

const defaultInput = "private-release-handoff/console-tabs.json";
const defaultOutput = resolve(homedir(), "Desktop", "TheTattooCore Launch Console Tabs.html");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || !value) {
    throw new Error(
      "Usage: npm.cmd run prepare:private-console-tabs -- --tabs-json private-release-handoff/console-tabs.json --out \"%USERPROFILE%\\Desktop\\TheTattooCore Launch Console Tabs.html\"",
    );
  }
  args.set(key.slice(2), value);
}

const inputPath = resolve(args.get("tabs-json") ?? defaultInput);
const outputPath = resolve(args.get("out") ?? defaultOutput);
const privateRoot = resolve("private-release-handoff");
const desktopRoot = resolve(homedir(), "Desktop");

if (!existsSync(inputPath)) {
  throw new Error(
    `${inputPath} is missing. Save private tab data there first; do not commit it.`,
  );
}

if (!outputPath.startsWith(privateRoot) && !outputPath.startsWith(desktopRoot)) {
  throw new Error("Console tab restore files must be written to Desktop or private-release-handoff.");
}

const tabs = JSON.parse(readFileSync(inputPath, "utf8"));

if (!Array.isArray(tabs) || tabs.length === 0) {
  throw new Error("Tab input must be a non-empty array.");
}

const safeTabs = tabs.map((tab, index) => {
  if (!tab || typeof tab.url !== "string" || typeof tab.title !== "string") {
    throw new Error(`Tab ${index + 1} must include title and url strings.`);
  }

  const url = new URL(tab.url);
  if (url.protocol !== "https:") {
    throw new Error(`Tab ${index + 1} must use https.`);
  }

  return {
    title: tab.title.trim() || `Console tab ${index + 1}`,
    url: url.toString(),
  };
});

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const links = safeTabs
  .map(
    (tab) =>
      `      <li><a href="${escapeHtml(tab.url)}" target="_blank" rel="noreferrer">${escapeHtml(
        tab.title,
      )}</a></li>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TheTattooCore Launch Console Tabs</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; max-width: 880px; line-height: 1.5; color: #151515; }
      h1 { font-size: 24px; margin-bottom: 8px; }
      p { color: #444; }
      li { margin: 10px 0; }
      a { color: #1355cc; }
      button { margin-top: 16px; padding: 10px 14px; border: 1px solid #222; border-radius: 6px; background: #fff; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>TheTattooCore Launch Console Tabs</h1>
    <p>Private restore file for the current app-store, payment, push, and owner handoff tabs. Keep this off git.</p>
    <ol>
${links}
    </ol>
    <button type="button" id="open-all">Open all tabs</button>
    <script>
      const tabs = ${JSON.stringify(safeTabs)};
      document.getElementById("open-all").addEventListener("click", () => {
        for (const tab of tabs) {
          window.open(tab.url, "_blank", "noopener,noreferrer");
        }
      });
    </script>
  </body>
</html>
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);

console.log(`Wrote ${basename(outputPath)} with ${safeTabs.length} private console tabs.`);
