import { readFileSync } from "node:fs";

const adminActions = readFileSync("src/app/admin/actions.ts", "utf8");
const adminNav = readFileSync("src/app/admin/admin-section-nav.tsx", "utf8");
const adminOverview = readFileSync("src/app/admin/page.tsx", "utf8");
const adminMediaOps = readFileSync("src/app/admin/media-ops/page.tsx", "utf8");
const adminMailSettings = readFileSync("src/app/admin/mail-settings/page.tsx", "utf8");
const adminUsers = readFileSync("src/app/admin/users/page.tsx", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const adminDataRequests = readFileSync("src/app/admin/data-requests/page.tsx", "utf8");
const adminContent = readFileSync("src/app/admin/content/page.tsx", "utf8");
const adminReports = readFileSync("src/app/admin/reports/page.tsx", "utf8");
const adminVerification = readFileSync("src/app/admin/verification/page.tsx", "utf8");
const adminGigs = readFileSync("src/app/admin/gigs/page.tsx", "utf8");
const adminStuff = readFileSync("src/app/admin/stuff/page.tsx", "utf8");
const adminPayments = readFileSync("src/app/admin/payments/page.tsx", "utf8");
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
      adminOverview.includes("const launchReadinessItems = [") &&
      adminOverview.includes("const betaFinishBoard = [") &&
      adminOverview.includes("const betaGoNoGoItems = [") &&
      adminOverview.includes("const betaGoNoGoReady = betaGoNoGoItems.every") &&
      adminOverview.includes("One-week beta push") &&
      adminOverview.includes("Beta go/no-go") &&
      adminOverview.includes("Tester wave looks clear") &&
      adminOverview.includes("Ready for testers") &&
      adminOverview.includes("Needs cleanup") &&
      adminOverview.includes("Open reports") &&
      adminOverview.includes("Pending verification") &&
      adminOverview.includes("Pending ads") &&
      adminOverview.includes("Mail sender") &&
      adminOverview.includes("Seven-day maturity sprint") &&
      adminOverview.includes("Stabilize") &&
      adminOverview.includes("Commerce") &&
      adminOverview.includes("Trust") &&
      adminOverview.includes("Education") &&
      adminOverview.includes("App handoff") &&
      adminOverview.includes("stabilize first") &&
      adminOverview.includes("Payment gates") &&
      adminOverview.includes("Merch readiness") &&
      adminOverview.includes("Help coverage") &&
      adminOverview.includes("App handoff") &&
      adminOverview.includes("before external app review") &&
      adminOverview.includes("count: merchReview?.length ?? 0") &&
      adminOverview.includes("latest product review signals") &&
      adminSections
        .filter((href) => href !== "/admin/media-ops")
        .every((href) => adminOverview.includes(`href: "${href}"`) || adminOverview.includes(`href="${href}"`)),
  },
  {
    label: "admin media ops copy stays launch-safe and avoids raw provider/process wording",
    ok:
      adminMediaOps.includes("const betaQaLaunchChecks = [") &&
      adminMediaOps.includes("const betaReleaseStatus:") &&
      adminMediaOps.includes("const betaNextActions = [") &&
      adminMediaOps.includes("const storeSubmissionChecks = [") &&
      adminMediaOps.includes("const betaEvidencePack = [") &&
      adminMediaOps.includes("const helpTutorialReadiness = [") &&
      adminMediaOps.includes("Beta release status") &&
      adminMediaOps.includes("Where the apps stand now") &&
      adminMediaOps.includes("Google Play") &&
      adminMediaOps.includes("Active internal test") &&
      adminMediaOps.includes("Apple TestFlight") &&
      adminMediaOps.includes("Build 1.0 (3)") &&
      adminMediaOps.includes("Internal testing") &&
      adminMediaOps.includes("Next beta actions") &&
      adminMediaOps.includes("Beta QA launch checklist") &&
      adminMediaOps.includes("App handoff checklist") &&
      adminMediaOps.includes("Beta evidence pack") &&
      adminMediaOps.includes("What to save before widening beta") &&
      adminMediaOps.includes("Help tutorial readiness") &&
      adminMediaOps.includes("Capture gaps to close before beta") &&
      adminMediaOps.includes("Help checklist") &&
      adminMediaOps.includes("latest lint, build, public-route smoke, mobile smoke, and payment guard results") &&
      adminMediaOps.includes("native auth/checkout return checks") &&
      adminMediaOps.includes("two-user DM pass") &&
      adminMediaOps.includes("Admin > Payments reconciliation") &&
      adminMediaOps.includes("store screenshots from safe sample accounts") &&
      adminMediaOps.includes("production payment policy review") &&
      adminMediaOps.includes("store data-safety/privacy answers") &&
      adminMediaOps.includes("Archive the real-device QA evidence") &&
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
    label: "admin mail settings avoids raw provider and secret labels",
    ok:
      adminMailSettings.includes("Company SMTP") &&
      adminMailSettings.includes("Private lookup") &&
      adminMailSettings.includes("Private password") &&
      adminMailSettings.includes("Configured") &&
      !adminMailSettings.includes("{mailSettings?.provider ?? \"hostgator\"}") &&
      !adminMailSettings.includes("HOSTGATOR_SMTP_PASSWORD") &&
      !adminMailSettings.includes("Secret binding"),
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
    label: "admin data requests can filter status and search while preserving actions",
    ok:
      adminDataRequests.includes("function dataRequestFilters") &&
      adminDataRequests.includes("Filter data requests") &&
      adminDataRequests.includes("Username, display name, or reason") &&
      adminDataRequests.includes("requestsQuery = requestsQuery.eq(\"status\", filters.status)") &&
      adminDataRequests.includes(".from(\"profiles\")") &&
      adminDataRequests.includes("profile_id.in.") &&
      adminDataRequests.includes("pageHref(currentPage, filters)") &&
      publicSmoke.includes('path: "/admin/data-requests?status=pending"') &&
      publicSmoke.includes('path: "/admin/data-requests?q=ceocore"') &&
      productPlan.includes("Admin Data Requests supports 50-item pagination plus status filters and username/reason search"),
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
    label: "admin Stuff and Gigs can filter status and moderation state",
    ok:
      adminStuff.includes("function stuffFilters") &&
      adminStuff.includes("Filter Stuff") &&
      adminStuff.includes("listingsQuery = listingsQuery.eq(\"status\", filters.status)") &&
      adminStuff.includes("listingsQuery = listingsQuery.eq(\"moderation_status\", filters.moderationStatus)") &&
      adminStuff.includes("pageHref(currentPage + 1, filters)") &&
      adminGigs.includes("function gigFilters") &&
      adminGigs.includes("Filter Gigs") &&
      adminGigs.includes("gigsQuery = gigsQuery.eq(\"status\", filters.status)") &&
      adminGigs.includes("gigsQuery = gigsQuery.eq(\"moderation_status\", filters.moderationStatus)") &&
      adminGigs.includes("pageHref(currentPage + 1, filters)") &&
      publicSmoke.includes('path: "/admin/stuff?status=active"') &&
      publicSmoke.includes('path: "/admin/gigs?moderation_status=under_review"') &&
      productPlan.includes("Admin Stuff and Admin Gigs support status and moderation filters"),
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
    label: "admin verification document cards avoid raw storage wording",
    ok:
      adminVerification.includes("Private review document") &&
      adminVerification.includes("review document") &&
      adminVerification.includes("access before deciding") &&
      !adminVerification.includes("Private file -") &&
      !adminVerification.includes("check storage"),
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
    label: "admin payments keeps operator payout and dispute runbooks visible",
    ok:
      adminPayments.includes("const paymentOpsRunbooks = [") &&
      adminPayments.includes("Seller payout release") &&
      adminPayments.includes("Refund and dispute review") &&
      adminPayments.includes("Booking deposit review") &&
      adminPayments.includes("Freeze payout release and fulfillment closeout") &&
      adminPayments.includes("Keep paid deposit refunds admin-reviewed") &&
      adminPayments.includes("/help/seller-payouts-payment-safety") &&
      adminPayments.includes("/help/order-refunds-disputes") &&
      adminPayments.includes("Order support guide") &&
      productPlan.includes("public Help guide for hosted payout setup"),
  },
  {
    label: "plan records dedicated admin pages and tester account tooling",
    ok:
      productPlan.includes("Admin sections must become dedicated pages") &&
      productPlan.includes("Admin `/admin` must stay an overview-only command center") &&
      productPlan.includes("compact one-week launch readiness snapshot") &&
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
