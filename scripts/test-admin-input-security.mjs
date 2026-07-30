import assert from "node:assert/strict";
import {
  RedirectSignal,
  createSupabaseDouble,
  importTypeScriptWithStubs,
  loadAdminActions,
  makeForm,
  testIds,
} from "./admin-module-test-harness.mjs";

const invalidOperations = [
  ["changeUserRole", { profile_id: "' OR 1=1 --", role: "owner" }],
  ["changeUserStatus", { profile_id: "<script>alert(1)</script>", status: "root" }],
  ["deleteUserAccount", { confirm_delete: "delete", profile_id: "not-a-uuid" }],
  [
    "createTestAccount",
    {
      account_type: "owner",
      display_name: "<img src=x onerror=alert(1)>",
      email: "bad\r\nBcc: attacker@example.com",
      password: "long-enough-password",
      username: "javascript:alert(1)",
    },
  ],
  [
    "grantUserAdCredit",
    {
      credit_amount: "10",
      credit_reason: "anything",
      profile_id: "' OR 1=1 --",
    },
  ],
  [
    "moderateContent",
    {
      moderation_status: "active",
      subject_id: "' OR 1=1 --",
      subject_type: "feed_post",
    },
  ],
  ["moderateHelpArticleComment", { comment_id: "not-a-uuid", status: "hidden" }],
  ["updateReportStatus", { report_id: "not-a-uuid", status: "reviewing" }],
  [
    "recordReportFollowup",
    { followup_action: "drop table", report_id: "not-a-uuid" },
  ],
  [
    "updateLicenseVerification",
    { request_id: "not-a-uuid", status: "approved<script>" },
  ],
  [
    "updateAdCampaignStatus",
    { campaign_id: "not-a-uuid", status: "approved<script>" },
  ],
  [
    "grantAdCampaignCredit",
    {
      campaign_id: "not-a-uuid",
      credit_amount: "10",
      credit_reason: "anything",
    },
  ],
  ["updateMerchProductStatus", { product_id: "not-a-uuid", status: "active<script>" }],
  ["updateMerchOrderStatus", { order_id: "not-a-uuid", status: "fulfilled<script>" }],
  ["refundMerchOrder", { confirm: "refund", order_id: "not-a-uuid" }],
  [
    "updateAccountDeletionRequest",
    { request_id: "not-a-uuid", status: "completed" },
  ],
  [
    "reconcileBookingDepositCheckout",
    { booking_id: "not-a-uuid", confirm: "reconcile" },
  ],
  ["refundBookingDeposit", { booking_id: "not-a-uuid", confirm: "refund" }],
];

let createClientCalls = 0;
const { actions } = await loadAdminActions({
  async createClient() {
    createClientCalls += 1;
    throw new Error("Invalid input reached authentication or database access");
  },
});

for (const [name, values] of invalidOperations) {
  createClientCalls = 0;
  let outcome;

  try {
    await actions[name](makeForm(values));
  } catch (error) {
    outcome = error;
  }

  assert.ok(outcome instanceof RedirectSignal, `${name} did not reject safely`);
  assert.equal(
    createClientCalls,
    0,
    `${name} queried authentication/database for malformed input`,
  );
}
console.log(
  `PASS ${invalidOperations.length} privileged actions reject SQL-like IDs and invalid enums before database access`,
);

for (const returnTo of [
  "/admin/users/../../api/admin/mail/test",
  "/admin/users/%2e%2e/%2e%2e/api/admin/mail/test",
  "/admin/users\\..\\..\\api\\admin\\mail\\test",
  "//attacker.example/admin/users",
  "https://attacker.example/admin/users",
]) {
  let outcome;

  try {
    await actions.changeUserRole(
      makeForm({
        profile_id: testIds.other,
        return_to: returnTo,
        role: "owner",
      }),
    );
  } catch (error) {
    outcome = error;
  }

  assert.ok(outcome instanceof RedirectSignal);
  const redirectUrl = new URL(outcome.location, "https://thetattoocore.com");
  assert.equal(redirectUrl.origin, "https://thetattoocore.com");
  assert.equal(redirectUrl.pathname, "/admin");
  assert.equal(redirectUrl.hash, "#users");
  assert.equal(/[\\]|%2e|\.\./i.test(outcome.location), false);
}
console.log("PASS hostile return paths cannot create arbitrary or traversal redirects");

for (const expiresAt of ["not-a-date", "2026-02-30", "2026-07-30T00:00:00Z"]) {
  createClientCalls = 0;
  let outcome;

  try {
    await actions.grantUserAdCredit(
      makeForm({
        credit_amount: "10",
        credit_reason: "promo",
        expires_at: expiresAt,
        profile_id: testIds.other,
      }),
    );
  } catch (error) {
    outcome = error;
  }

  assert.ok(outcome instanceof RedirectSignal);
  assert.equal(
    createClientCalls,
    0,
    `unexpected timestamp ${expiresAt} reached authentication/database access`,
  );
}
console.log("PASS unexpected ad-credit dates fail before privileged database access");

{
  const mailCalls = [];
  const notificationCalls = [];
  const auditRows = [];
  const hostileNote = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
    "x".repeat(600),
  ].join(" ");
  const hostileDisplayName = "<img src=x onerror=alert(1)>";
  const verificationClient = createSupabaseDouble({
    claims: {
      email: "moderator@example.com",
      sub: testIds.actor,
    },
    execute(query) {
      if (
        query.table === "profiles" &&
        query.operation === "select" &&
        query.selection === "role"
      ) {
        return { data: { role: "moderator" }, error: null };
      }

      if (
        query.table === "license_verification_requests" &&
        query.operation === "select"
      ) {
        return {
          data: {
            account_type: "artist",
            expires_on: null,
            id: testIds.other,
            profile_id: testIds.third,
            status: "pending",
          },
          error: null,
        };
      }

      if (
        query.table === "license_verification_requests" &&
        query.operation === "update"
      ) {
        return { data: null, error: null };
      }

      if (query.table === "admin_audit_logs" && query.operation === "insert") {
        auditRows.push(query.payload);
        return { data: null, error: null };
      }

      if (
        query.table === "profiles" &&
        query.operation === "select" &&
        query.selection.includes("display_name")
      ) {
        return {
          data: {
            display_name: hostileDisplayName,
            notify_email_important: true,
            username: "fixture_artist",
          },
          error: null,
        };
      }

      if (query.table === "mail_settings" && query.operation === "select") {
        return {
          data: {
            from_email: "noreply@example.com",
            from_name: "TheTattooCore",
            is_enabled: true,
            reply_to_email: "support@example.com",
            smtp_host: "smtp.example.com",
            smtp_password_secret_name: "HOSTGATOR_SMTP_PASSWORD",
            smtp_port: 465,
            smtp_secure: true,
            smtp_username: "mailer@example.com",
          },
          error: null,
        };
      }

      throw new Error(`Unexpected verification query on ${query.table}`);
    },
  });
  const loaded = await loadAdminActions({
    createAdminClient() {
      return {
        auth: {
          admin: {
            async getUserById() {
              return {
                data: { user: { email: "recipient@example.com" } },
                error: null,
              };
            },
          },
        },
      };
    },
    async createClient() {
      return verificationClient.client;
    },
    async insertNotifications(payload) {
      notificationCalls.push(payload);
      return { error: null };
    },
    async sendHostgatorEmail(payload) {
      mailCalls.push(payload);
    },
  });
  let outcome;

  try {
    await loaded.actions.updateLicenseVerification(
      makeForm({
        note: hostileNote,
        request_id: testIds.other,
        status: "rejected",
      }),
    );
  } catch (error) {
    outcome = error;
  }

  assert.ok(outcome instanceof RedirectSignal);
  assert.equal(mailCalls.length, 1);
  assert.equal(notificationCalls.length, 1);
  assert.equal(auditRows.length, 1);
  assert.ok(auditRows[0].summary.length <= 500);
  assert.ok(notificationCalls[0].body.length <= 240);
  assert.doesNotMatch(mailCalls[0].html, /<(?:script|img)\b/i);
  assert.doesNotMatch(mailCalls[0].html, /href=["']javascript:/i);
  assert.match(mailCalls[0].html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/i);
  assert.match(mailCalls[0].html, /&lt;img src=x onerror=alert\(1\)&gt;/i);
  assert.equal(mailCalls[0].recipientEmail, "recipient@example.com");
}
console.log("PASS hostile admin text is bounded and HTML-escaped before rendering");

{
  let getClaimsCalls = 0;
  const middleware = await importTypeScriptWithStubs("src/middleware.ts", {
    "@/lib/app-link-association": {
      androidAssetLinksPayload: () => null,
      appleAppSiteAssociationPayload: () => null,
      associationJsonResponse: () => new Response(null),
      unavailableAssociationResponse: () => new Response(null, { status: 503 }),
    },
    "@/lib/auth-session": {
      authCookieOptions: (options) => options,
      authSessionPreferenceCookie: "ttc-session",
      persistentSessionFromValue: () => false,
    },
    "@/lib/security/csp": {
      cspHeader: () => ["Content-Security-Policy", "default-src 'self'"],
      cspHeaderName: "Content-Security-Policy",
      cspReportOnlyHeaderName: "Content-Security-Policy-Report-Only",
    },
    "@supabase/ssr": {
      createServerClient() {
        return {
          auth: {
            async getClaims() {
              getClaimsCalls += 1;
              return { data: null, error: null };
            },
          },
        };
      },
    },
    "next/server": {
      NextRequest: class {},
      NextResponse: {
        next() {
          return new Response(null);
        },
        redirect(url, status) {
          return new Response(null, {
            headers: { location: String(url) },
            status,
          });
        },
      },
    },
  });

  function fakeRequest(pathname) {
    const url = new URL(pathname, "http://localhost:3000");
    const cookieValues = new Map();

    return {
      cookies: {
        get(name) {
          const value = cookieValues.get(name);
          return value === undefined ? undefined : { name, value };
        },
        getAll() {
          return [...cookieValues].map(([name, value]) => ({ name, value }));
        },
        set(name, value) {
          cookieValues.set(name, value);
        },
      },
      headers: new Headers({ host: "localhost:3000" }),
      nextUrl: {
        pathname: url.pathname,
        protocol: url.protocol,
        clone() {
          return new URL(url);
        },
      },
    };
  }

  const adminResponse = await middleware.middleware(fakeRequest("/admin"));
  const apiResponse = await middleware.middleware(
    fakeRequest("/api/admin/mail/test"),
  );
  const publicResponse = await middleware.middleware(fakeRequest("/about"));

  for (const response of [adminResponse, apiResponse]) {
    assert.match(response.headers.get("cache-control") ?? "", /private/i);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
  }

  assert.equal(publicResponse.headers.get("x-robots-tag"), null);
  assert.equal(publicResponse.headers.get("x-frame-options"), "DENY");
  assert.equal(getClaimsCalls, 3);
  assert.equal(
    Array.from(middleware.config.matcher).join(","),
    "/((?!_next/static|_next/image|favicon.ico).*)",
  );
}
console.log(
  "PASS middleware refreshes claims and applies private/noindex headers without acting as the role boundary",
);
