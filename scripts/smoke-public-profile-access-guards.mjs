import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  throw new Error(message);
};
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalizePath = (filePath) => filePath.split(path.sep).join("/");

function walkFiles(dir, extensions, files = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(relativePath, extensions, files);
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }
  return files;
}

const migrationDir = path.join(root, "supabase", "migrations");
const publicProfileMigrations = fs
  .readdirSync(migrationDir)
  .filter((file) => file.endsWith("_create_public_profiles_view.sql"));

if (publicProfileMigrations.length !== 1) {
  fail(`Expected exactly one public_profiles migration, found ${publicProfileMigrations.length}.`);
}

const migrationPath = path.join("supabase", "migrations", publicProfileMigrations[0]);
const migrationSql = read(migrationPath);
const migrationLower = migrationSql.toLowerCase();
const executableMigrationLower = migrationSql
  .replace(/^\s*--.*$/gm, "")
  .toLowerCase();

for (const required of [
  "create or replace view public.public_profiles",
  "with (security_invoker = true)",
  "from public.profiles",
  "where is_private = false",
  "and suspended_at is null",
  "and banned_at is null",
  "lower(username) not in",
  "grant select on public.public_profiles to anon, authenticated;",
]) {
  if (!migrationLower.includes(required)) {
    fail(`public_profiles migration is missing required SQL: ${required}`);
  }
}

const bannedSql = [
  "revoke",
  "drop policy",
  "alter policy",
  "drop view",
  "alter table public.profiles",
  "drop trigger",
  "delete from",
  "update public.profiles",
  "insert into public.profiles",
];
for (const banned of bannedSql) {
  if (executableMigrationLower.includes(banned)) {
    fail(`Phase 1 migration must be additive only; found forbidden SQL: ${banned}`);
  }
}

const selectMatch = migrationSql.match(/select\s+([\s\S]*?)\s+from\s+public\.profiles/i);
if (!selectMatch) fail("Unable to parse public_profiles select list.");
const selectedColumns = selectMatch[1]
  .split(",")
  .map((column) => column.trim().replace(/--.*$/gm, ""))
  .filter(Boolean);
const approvedColumns = [
  "id",
  "username",
  "display_name",
  "account_type",
  "bio",
  "avatar_url",
  "banner_url",
  "city",
  "region",
  "country",
  "website_url",
  "instagram_url",
  "tiktok_url",
  "facebook_url",
  "youtube_url",
  "x_url",
  "shop_profile_id",
  "license_verified_at",
  "followers_visibility",
  "following_visibility",
  "comment_permission",
  "created_at",
  "updated_at",
];
if (selectedColumns.join("\n") !== approvedColumns.join("\n")) {
  fail(`public_profiles column contract drifted.\nExpected: ${approvedColumns.join(", ")}\nActual: ${selectedColumns.join(", ")}`);
}

const sensitiveColumnPatterns = [
  /\brole\b/i,
  /\bis_adult_confirmed\b/i,
  /\badult_terms_accepted_at\b/i,
  /\bnotify_/i,
  /\bnotification_/i,
  /\btheme_preference\b/i,
  /\bpreferred_language\b/i,
  /\blocation_personalization_enabled\b/i,
  /\bsuspended_at\b/i,
  /\bbanned_at\b/i,
  /\bmoderation_note\b/i,
  /\blicense_verified_by\b/i,
  /\blicense_verification_request_id\b/i,
];
for (const column of selectedColumns) {
  for (const pattern of sensitiveColumnPatterns) {
    if (pattern.test(column)) fail(`Sensitive profile column exposed by public_profiles: ${column}`);
  }
}

const indexingSource = read("src/lib/profile-indexing.ts");
const exportedListMatch = indexingSource.match(/export const internalProfileUsernames = \[([\s\S]*?)\] as const;/);
if (!exportedListMatch) fail("internalProfileUsernames must stay exported for SQL drift checks.");
const appInternalUsernames = [...exportedListMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const sqlInternalUsernames = [...migrationSql.matchAll(/'([^']+)'/g)]
  .map((match) => match[1])
  .filter((value) => appInternalUsernames.includes(value));
if (appInternalUsernames.join("\n") !== sqlInternalUsernames.join("\n")) {
  fail(`Internal/test/reviewer profile exclusions drifted. App: ${appInternalUsernames.join(", ")} SQL: ${sqlInternalUsernames.join(", ")}`);
}

const publicProfileType = read("src/lib/public-profiles.ts");
for (const sensitive of [
  "is_private",
  "suspended_at",
  "banned_at",
  "role",
  "is_adult_confirmed",
  "adult_terms_accepted_at",
  "moderation_note",
]) {
  if (publicProfileType.includes(sensitive)) {
    fail(`PublicProfile type must not expose sensitive/base-only field: ${sensitive}`);
  }
}

const sitemapSource = read("src/app/sitemap.ts");
if (!sitemapSource.includes('.from("public_profiles")')) fail("sitemap must read public profiles through public_profiles.");
if (sitemapSource.includes('.from("profiles")')) fail("sitemap must not read public.profiles directly for profile URLs.");
if (sitemapSource.includes("isInternalIndexingProfile")) fail("sitemap internal profile filtering belongs in the SQL view, not duplicated in app code.");

const searchSource = read("src/app/search/page.tsx");
if (!searchSource.includes('let publicProfileQuery = supabase\n                .from("public_profiles")')) {
  fail("search public profile query must use public_profiles.");
}
if (!/const privateProfilesPromise = visiblePrivateProfileIds\.size[\s\S]*?\.from\("profiles"\)[\s\S]*?\.in\("id", Array\.from\(visiblePrivateProfileIds\)\)/.test(searchSource)) {
  fail("search must keep the private-profile compatibility query isolated to visible private profile ids.");
}
if (!/const \{ data: profileShops \} = profileShopIds\.length[\s\S]*?\.from\("public_profiles"\)/.test(searchSource)) {
  fail("search profile shop lookup must use public_profiles.");
}
if (!searchSource.includes('.in("id", profileShopIds)')) {
  fail("search profile shop lookup should remain batched by profileShopIds.");
}

const profilePageSource = read("src/app/u/[username]/page.tsx");
for (const required of [
  '.from("public_profiles")',
  "const publicProfileSelect =",
  "const privateProfileSelect = `${publicProfileSelect}, is_private`;",
  "const { data: fallbackProfileRow } = publicProfileRow",
  '.from("profiles")',
  "? { ...publicProfileRow, is_private: false }",
]) {
  if (!profilePageSource.includes(required)) fail(`profile page missing expected public_profiles compatibility pattern: ${required}`);
}

const docsPath = "docs/PUBLIC_PROFILE_ACCESS_PHASE_1.md";
if (!fs.existsSync(path.join(root, docsPath))) fail(`${docsPath} must document Phase 1 compatibility and remaining profile usage.`);
const docsSource = read(docsPath);
for (const required of [
  "Phase 1 is additive only",
  "public.profiles access remains temporarily active",
  "Do not use supabase db push",
  "No base-table revokes",
  "Remaining direct public.profiles reads",
  "Remaining embedded profiles:profiles joins",
  migrationPath.split(path.sep).join("/"),
]) {
  if (!docsSource.includes(required)) fail(`Phase 1 docs missing required note: ${required}`);
}

const sourceFiles = [
  ...walkFiles("src", new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"])),
  ...walkFiles("scripts", new Set([".mjs", ".js", ".ts"])),
];
const directProfileFiles = [];
const embeddedProfileFiles = [];
for (const relativePath of sourceFiles) {
  if (normalizePath(relativePath) === "scripts/smoke-public-profile-access-guards.mjs") continue;
  const source = read(relativePath);
  if (/\.from\(\s*["'`]profiles["'`]\s*\)/.test(source)) directProfileFiles.push(normalizePath(relativePath));
  if (source.includes("profiles:profiles")) embeddedProfileFiles.push(normalizePath(relativePath));
}
for (const file of [...directProfileFiles, ...embeddedProfileFiles]) {
  if (!docsSource.includes(file)) {
    fail(`Profile usage is not classified in ${docsPath}: ${file}`);
  }
}

console.log(`public profile access guard passed (${publicProfileMigrations[0]})`);