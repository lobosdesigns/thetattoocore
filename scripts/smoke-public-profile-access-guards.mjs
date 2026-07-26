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
const repairMigrations = fs
  .readdirSync(migrationDir)
  .filter((file) => file.endsWith("_restrict_anonymous_profile_base_table_access.sql"));

if (publicProfileMigrations.length !== 1) {
  fail(`Expected exactly one public_profiles migration, found ${publicProfileMigrations.length}.`);
}
if (repairMigrations.length !== 1) {
  fail(`Expected exactly one anonymous profile base-table repair migration, found ${repairMigrations.length}.`);
}

const migrationPath = path.join("supabase", "migrations", publicProfileMigrations[0]);
const migrationSql = read(migrationPath);
const migrationLower = migrationSql.toLowerCase();

for (const required of [
  "create view public.public_profiles",
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

const repairPath = path.join("supabase", "migrations", repairMigrations[0]);
const repairSql = read(repairPath);
const repairLower = repairSql.toLowerCase();
for (const required of [
  "alter view public.public_profiles set (security_invoker = false)",
  "revoke all privileges on table public.profiles",
  "information_schema.columns",
  "revoke select (%1$i), insert (%1$i), update (%1$i), references (%1$i)",
  "from anon",
  "drop policy if exists \"profiles are viewable by everyone\" on public.profiles",
  "create policy \"authenticated users can read allowed profiles\"",
  "to authenticated",
  "id = (select auth.uid())",
  "private.current_user_can_moderate()",
  "is_private = false",
  "suspended_at is null",
  "banned_at is null",
  "grant select on table public.public_profiles",
  "to anon, authenticated",
  "grant select on table public.profiles",
  "to authenticated, service_role",
  "verification sql after applying",
  "rollback",
]) {
  if (!repairLower.includes(required)) {
    fail(`profile repair migration is missing required SQL or documentation: ${required}`);
  }
}
for (const forbidden of [
  "drop table public.profiles",
  "delete from public.profiles",
  "truncate public.profiles",
  "drop public.profiles",
]) {
  if (repairLower.includes(forbidden)) fail(`profile repair migration contains forbidden SQL: ${forbidden}`);
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

const profilePageSource = read("src/app/u/[username]/page.tsx");
if (!profilePageSource.includes('.from("public_profiles")')) fail("profile page must read public profiles through public_profiles.");
if (/fallbackProfileRow|privateProfileSelect|\.from\("profiles"\)\s*[\s\S]{0,160}\.eq\("username", cleanUsername\)/.test(profilePageSource)) {
  fail("profile page must not fall back to public.profiles by username.");
}

const sitemapSource = read("src/app/sitemap.ts");
if (!sitemapSource.includes('.from("public_profiles")')) fail("sitemap must read public profiles through public_profiles.");
if (sitemapSource.includes('.from("profiles")')) fail("sitemap must not read public.profiles directly for profile URLs.");
const threadQuery = sitemapSource.match(/const \{ data: threads \}[\s\S]*?\.returns<PublicThread\[\]>\(\);/);
if (!threadQuery) fail("Unable to locate sitemap thread query.");
if (threadQuery[0].includes('is_published')) fail("sitemap thread query must not reference nonexistent thread_posts.is_published.");

const searchSource = read("src/app/search/page.tsx");
if (!/let publicProfileQuery = supabase\s*\.from\("public_profiles"\)/.test(searchSource)) {
  fail("search public profile query must use public_profiles.");
}
if (!/const privateProfilesPromise = visiblePrivateProfileIds\.size[\s\S]*?\.from\("profiles"\)[\s\S]*?\.in\("id", Array\.from\(visiblePrivateProfileIds\)\)/.test(searchSource)) {
  fail("search must keep the private-profile compatibility query isolated to visible private profile ids.");
}
const merchQuery = searchSource.match(/let merchQuery = supabase[\s\S]*?return merchQuery/);
if (!merchQuery) fail("Unable to locate Merch search query.");
if (/category\.ilike/.test(merchQuery[0])) {
  fail("Merch search must not use ILIKE against the enum category column.");
}
if (!merchQuery[0].includes('merchQuery.eq("category", merchCategory)')) {
  fail("Merch search must use exact category equality for recognized category filters.");
}

const uuidGuard = read("src/lib/route-ids.ts");
if (!uuidGuard.includes("export function isUuid") || !uuidGuard.includes("uuidPattern.test")) {
  fail("shared UUID route guard is missing.");
}
for (const detailPath of [
  "src/app/p/[id]/page.tsx",
  "src/app/t/[id]/page.tsx",
  "src/app/stuff/[id]/page.tsx",
  "src/app/gigs/[id]/page.tsx",
  "src/app/merch/[id]/page.tsx",
]) {
  const detailSource = read(detailPath);
  if (!detailSource.includes('import { isUuid } from "@/lib/route-ids"')) {
    fail(`${detailPath} must import the shared UUID route guard.`);
  }
  if (!detailSource.includes("if (!isUuid(id)) return null;")) {
    fail(`${detailPath} must reject malformed IDs before database helper queries.`);
  }
  if (!detailSource.includes("if (!isUuid(id)) notFound();")) {
    fail(`${detailPath} must return a real 404 for malformed route IDs before page queries.`);
  }
}

const middlewareSource = read("src/middleware.ts");
const cspSource = read("src/lib/security/csp.ts");
if (!middlewareSource.includes("cspHeader()")) {
  fail("middleware must emit CSP through the centralized policy helper.");
}
if (!cspSource.includes('cspEnforceFlag = "TTC_CSP_ENFORCE_ENABLED"')) {
  fail("CSP enforcement must remain behind the explicit TTC_CSP_ENFORCE_ENABLED flag.");
}
if (!cspSource.includes('cspReportOnlyHeaderName = "Content-Security-Policy-Report-Only"')) {
  fail("CSP must keep Report-Only as the default header mode.");
}
if (!cspSource.includes('env[cspEnforceFlag] === "true"')) {
  fail("CSP enforcement must require the flag to be exactly true.");
}

const docsPath = "docs/PUBLIC_PROFILE_ACCESS_PHASE_1.md";
const docsSource = read(docsPath);
for (const required of [
  "revokes anonymous direct access",
  "Supabase CLI was not installed",
  "Do not use supabase db push",
  "Remaining direct public.profiles reads",
  "Remaining embedded profiles:profiles joins",
  "Before enforcing CSP, observe Report-Only violations",
  repairPath.split(path.sep).join("/"),
]) {
  if (!docsSource.includes(required)) fail(`${docsPath} missing required note: ${required}`);
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

console.log(`public profile access guard passed (${repairMigrations[0]})`);
