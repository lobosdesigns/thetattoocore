import { readFileSync } from "node:fs";

const adminActions = readFileSync("src/app/admin/actions.ts", "utf8");
const adminNav = readFileSync("src/app/admin/admin-section-nav.tsx", "utf8");
const adminOverview = readFileSync("src/app/admin/page.tsx", "utf8");
const adminMediaOps = readFileSync("src/app/admin/media-ops/page.tsx", "utf8");
const adminUsers = readFileSync("src/app/admin/users/page.tsx", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const adminDataRequests = readFileSync("src/app/admin/data-requests/page.tsx", "utf8");
const adminContent = readFileSync("src/app/admin/content/page.tsx", "utf8");
const adminReports = readFileSync("src/app/admin/reports/page.tsx", "utf8");
const adminVerification = readFileSync("src/app/admin/verification/page.tsx", "utf8");
const adminGigs = readFileSync("src/app/admin/gigs/page.tsx", "utf8");
const adminStuff = readFileSync("src/app/admin/stuff/page.tsx", "utf8");
const adCreditMigration = readFileSync(
  "supabase/migrations/20260715033000_ad_credit_ledger.sql",
  "utf8",
);
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
const statusLabels = readFileSync("src/lib/status-labels.ts", "utf8");

const pagedAdminPages = [
  "ads",
  "content",
  "data-requests",
  "gigs",
  "merch",
  "payments",
  "reports",
  "stuff",
  "users",
  "verification",
];

const adminSections = [
  "/admin/users",
  "/admin/verification",
  "/admin/reports",
  "/admin/content",
  "/admin/stuff",
  "/admin/gigs",
  "/admin/merch",
  "/admin/ads",
  "/admin/payments",
  "/admin/media-ops",
  "/admin/mail-settings",
  "/admin/data-requests",
];

const pagedPageSources = pagedAdminPages.map((page) => [
  page,
  readFileSync(`src/app/admin/${page}/page.tsx`, "utf8"),
]);
const mediaOpsSource = [adminOverview, adminMediaOps].join("\n");

const checks = [
  {
    label: "admin section nav exposes each dedicated admin area",
    ok:
      adminNav.includes('aria-label="Admin sections"') &&
      adminSections.every((href) => adminNav.includes(`"${href}"`)),
  },
  {
    label: "public route smoke protects every dedicated admin area behind login",
    ok: adminSections.every((href) => publicSmoke.includes(`path: "${href}"`)),
  },
  {
    label: "long admin queues use 50-item pagination",
    ok: pagedPageSources.every(
      ([, source]) =>
        source.includes("const pageSize = 50") &&
        source.includes("const from = (currentPage - 1) * pageSize") &&
        source.includes("const to = from + pageSize - 1") &&
        source.includes("totalPages"),
    ),
  },
  {
    label: "admin content marks temporary stories with expiry state",
    ok:
      readFileSync("src/app/admin/content/page.tsx", "utf8").includes(
        "function storyExpiryState",
      ) &&
      readFileSync("src/app/admin/content/page.tsx", "utf8").includes(
        "expiresLabel: expiry.label",
      ) &&
      readFileSync("src/app/admin/content/page.tsx", "utf8").includes(
        'Story {item.isExpired ? "expired" : "expires"}',
      ),
  },
  {
    label: "admin overview stays a short command center with dedicated links",
    ok:
      adminOverview.includes("const overviewCards = [") &&
      adminOverview.includes("This overview intentionally stays short.") &&
      adminOverview.includes("Full queues belong on") &&
      adminOverview.includes("count: merchReview?.length ?? 0") &&
      adminOverview.includes("latest product review signals") &&
      adminSections
        .filter((href) => href !== "/admin/media-ops")
        .every((href) => adminOverview.includes(`href: "${href}"`) || adminOverview.includes(`href="${href}"`)),
  },
  {
    label: "admin media ops copy stays launch-safe and avoids raw provider/process wording",
    ok:
      mediaOpsSource.includes("Capped reels") &&
      mediaOpsSource.includes("higher-volume video tools") &&
      mediaOpsSource.includes("video upgrades") &&
      !mediaOpsSource.includes("Raw capped reels") &&
      !mediaOpsSource.includes("uploaded raw") &&
      !mediaOpsSource.includes("video transcodes") &&
      !mediaOpsSource.includes("video transcoding") &&
      !mediaOpsSource.includes("managed video processing") &&
      !mediaOpsSource.includes("current storage path"),
  },
  {
    label: "owner-only role changes cannot demote the current owner",
    ok:
      adminActions.includes("async function requireOwner()") &&
      adminActions.includes('if (profile?.role !== "owner")') &&
      adminActions.includes('if (profileId === userId && role !== "owner")') &&
      adminActions.includes("Owners cannot demote their own account.") &&
      adminActions.includes('event_type: "profile_role_changed"'),
  },
  {
    label: "tester account creation is owner-only, confirmed, privately backed, and audited",
    ok:
      adminActions.includes("export async function createTestAccount") &&
      adminActions.includes("await requireOwner()") &&
      adminActions.includes("const adminClient = createAdminClient()") &&
      adminActions.includes("Private owner tools are not enabled") &&
      adminActions.includes("email_confirm: true") &&
      adminActions.includes("adminClient.auth.admin.createUser") &&
      adminActions.includes("adminClient.auth.admin.deleteUser(profileId)") &&
      adminActions.includes('event_type: "tester_account_created"'),
  },
  {
    label: "admin users page shows tester creation only to owners with private tool readiness",
    ok:
      adminUsers.includes("const canManageRoles = profile.role === \"owner\"") &&
      adminUsers.includes("const canCreateTestAccounts = canManageRoles && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)") &&
      adminUsers.includes("Create tester account") &&
      adminUsers.includes("Owner tools ready") &&
      adminUsers.includes("Owner tools disabled") &&
      adminUsers.includes("disabled={!canCreateTestAccounts}"),
  },
  {
    label: "admin users page supports search while preserving paginated actions",
    ok:
      adminUsers.includes("function searchTerm") &&
      adminUsers.includes("Search users") &&
      adminUsers.includes("Username, display name, type, city, region, or role") &&
      adminUsers.includes("usersQuery = usersQuery.or") &&
      adminUsers.includes("city.ilike") &&
      adminUsers.includes("query={activeSearch}") &&
      adminUsers.includes("pageHref(currentPage, activeSearch)") &&
      publicSmoke.includes('path: "/admin/users?q=ceocore"'),
  },
  {
    label: "admin users can grant account-level ad credits with audit logging",
    ok:
      adCreditMigration.includes("create table if not exists public.ad_credit_ledger") &&
      adCreditMigration.includes("private.current_user_can_admin()") &&
      adCreditMigration.includes("Users can view own ad credits") &&
      adminActions.includes("export async function grantUserAdCredit") &&
      adminActions.includes("await requireAdmin()") &&
      adminActions.includes('event_type: "user_ad_credit_granted"') &&
      adminActions.includes('.from("ad_credit_ledger").insert') &&
      adminUsers.includes("grantUserAdCredit") &&
      adminUsers.includes("Add ad credit") &&
      adminUsers.includes("Visible ad credits") &&
      adminUsers.includes("Ad credit {money(user.adCreditBalanceCents)}") &&
      productPlan.includes("Account-level ad credits are also started"),
  },
  {
    label: "account deletion queues show friendly status labels",
    ok:
      statusLabels.includes("export function accountDeletionStatusLabel") &&
      statusLabels.includes('if (status === "pending") return "Pending review"') &&
      statusLabels.includes('if (status === "reviewing") return "In review"') &&
      accountPage.includes("accountDeletionStatusLabel(request.status)") &&
      !accountPage.includes("{request.status} deletion request") &&
      adminDataRequests.includes("accountDeletionStatusLabel(request.status)") &&
      !adminDataRequests.includes(">{request.status}</span>"),
  },
  {
    label: "admin reports can filter long queues while preserving pagination",
    ok:
      adminReports.includes("function reportFilters") &&
      adminReports.includes("Filter reports") &&
      adminReports.includes("Clear filters") &&
      adminReports.includes("filters.status !== \"all\"") &&
      adminReports.includes("reportsQuery.eq(\"reason\"") &&
      adminReports.includes("reportsQuery.eq(\"subject_type\"") &&
      adminReports.includes("pageHref(currentPage, filters)") &&
      publicSmoke.includes('path: "/admin/reports?status=open"') &&
      publicSmoke.includes('path: "/admin/reports?reason=unsafe%20practice"') &&
      publicSmoke.includes('path: "/admin/reports?subject_type=help_article_comment"'),
  },
  {
    label: "admin content can filter status while preserving pagination and actions",
    ok:
      adminContent.includes("type ContentStatusFilter") &&
      adminContent.includes("const contentStatusOptions") &&
      adminContent.includes("function contentStatusFilter") &&
      adminContent.includes("Filter content") &&
      adminContent.includes("Clear filter") &&
      adminContent.includes("query = query.eq(\"status\", \"pending_review\")") &&
      adminContent.includes("query = query.eq(\"moderation_status\", activeStatus)") &&
      adminContent.includes("pageHref(item.subjectType, currentPage, status)") &&
      publicSmoke.includes('path: "/admin/content?status=hidden"') &&
      publicSmoke.includes('path: "/admin/content?type=help_article_comment&status=pending_review"') &&
      productPlan.includes("Admin Content supports 50-item pagination plus status filters"),
  },
  {
    label: "admin verification can filter status and account type while preserving pagination and actions",
    ok:
      adminVerification.includes("function verificationFilters") &&
      adminVerification.includes("Filter verification") &&
      adminVerification.includes("Clear") &&
      adminVerification.includes("requestsQuery = requestsQuery.eq(\"status\", filters.status)") &&
      adminVerification.includes("requestsQuery = requestsQuery.eq(\"account_type\", filters.accountType)") &&
      adminVerification.includes("pageHref(currentPage, filters)") &&
      adminVerification.includes("return_to") &&
      publicSmoke.includes('path: "/admin/verification?status=pending"') &&
      publicSmoke.includes('path: "/admin/verification?account_type=vendor"') &&
      productPlan.includes("Admin Verification supports 50-item pagination plus status and account-type filters"),
  },
  {
    label: "admin moderation queues use shared friendly status labels",
    ok:
      statusLabels.includes("export function titleCaseStatus") &&
      adminContent.includes("titleCaseStatus(status)") &&
      adminOverview.includes("titleCaseStatus(value)") &&
      adminGigs.includes("titleCaseStatus(gig.moderationStatus)") &&
      adminStuff.includes("titleCaseStatus(listing.moderationStatus)") &&
      !adminOverview.includes('return value.replaceAll("_", " ")') &&
      !adminContent.includes('status.replace("_", " ")') &&
      !adminGigs.includes('moderationStatus.replace("_", " ")') &&
      !adminStuff.includes('moderationStatus.replace("_", " ")'),
  },
  {
    label: "plan records dedicated admin pages and tester account tooling",
    ok:
      productPlan.includes("Admin sections must become dedicated pages") &&
      productPlan.includes("Admin `/admin` must stay an overview-only command center") &&
      productPlan.includes("Owner/admin support tooling should include a controlled way to create tester/member accounts") &&
      productPlan.includes("owner-only access, server-only Supabase admin auth, confirmed tester creation, and audit logging"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} admin guard smoke check(s) failed.`);
  process.exit(1);
}
