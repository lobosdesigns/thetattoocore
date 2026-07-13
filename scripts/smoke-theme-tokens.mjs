import { readdirSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { cwd } from "node:process";

const filesToCheck = collectFiles("src/app", [".css", ".tsx"]);
const bannedSnippets = [
  "disabled:bg-[color-mix(in_srgb,var(--paper",
  "disabled:bg-[color-mix(in_srgb,var(--paper-soft)_90%,transparent)]",
  "disabled:bg-[var(--paper",
  "disabled:bg-white",
  "disabled:text-white",
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
  {
    file: "src/app/media-lightbox.tsx",
    snippets: [
      "bg-black text-white",
      "border-white/15 bg-black px-3 py-2 text-white",
      "bg-white/10 text-white",
    ],
  },
  {
    file: "src/app/admin/page.tsx",
    snippets: [
      "bg-[#090806] px-5 py-5 text-white",
      "text-sm font-semibold text-white",
      "text-xs text-white/70",
    ],
  },
  {
    file: "src/app/globals.css",
    snippets: [
      ".ttc-card input:not([type=\"checkbox\"]):not([type=\"radio\"])",
      ".ttc-card input::placeholder",
      "input[type=\"date\"]",
      ":root[data-theme=\"dark\"] input[type=\"date\"]",
      "input::file-selector-button",
      ".ttc-comment-controls button",
      ".ttc-comment-controls summary",
    ],
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

function collectFiles(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return collectFiles(path, extensions);
    }

    return extensions.some((extension) => entry.name.endsWith(extension))
      ? [path]
      : [];
  });
}
