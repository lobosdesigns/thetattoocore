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
      "button:disabled:not(.ttc-disabled-state)",
      ':root[data-theme="dark"] button:disabled:not(.ttc-disabled-state)',
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
    file: "src/app/sensitive-content-gate.tsx",
    snippets: [
      "bg-[color-mix(in_srgb,var(--foreground)_92%,transparent)] p-4 text-center text-[var(--background)]",
      "text-[color-mix(in_srgb,var(--background)_72%,transparent)]",
      "bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold text-[var(--foreground)]",
    ],
  },
  {
    file: "src/app/media-input.tsx",
    snippets: [
      "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]",
      "bg-[var(--foreground)] text-[var(--background)]",
      "text-xs font-semibold",
    ],
  },
  {
    file: "src/app/account/license-document-input.tsx",
    snippets: [
      "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]",
      "bg-[var(--foreground)] text-[var(--background)]",
      "text-[var(--muted-strong)]",
    ],
  },
  {
    file: "src/app/account/profile-form.tsx",
    snippets: [
      "ttc-control-active shadow-[0_8px_18px_rgba(23,20,18,0.16)]",
      "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--foreground)] text-xl font-bold text-[var(--brand-gold)]",
      "h-11 rounded-md bg-[var(--foreground)] px-5 text-sm font-semibold text-[var(--background)]",
    ],
  },
  {
    file: "src/app/account/page.tsx",
    snippets: [
      "inline-flex h-9 items-center justify-center rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)]",
      "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]",
      "h-10 w-full rounded-md border border-[var(--card-rim)] bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)] sm:w-fit",
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
  {
    file: "src/app/language-status-banner.tsx",
    snippets: [
      'const storageKey = "ttc-language-status-dismissed"',
      'window.addEventListener("click", dismiss, options)',
      'window.addEventListener("pointerdown", dismiss, options)',
      'window.addEventListener("scroll", dismiss, options)',
      'window.addEventListener("touchstart", dismiss, options)',
      "window.addEventListener(languageStatusDismissEvent, dismiss, options)",
    ],
  },
  {
    file: "src/app/column-snap-rail.tsx",
    snippets: [
      "import { languageStatusDismissEvent } from \"./language-status-banner\"",
      "function dismissLanguageStatus()",
      "dismissLanguageStatus();",
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
