import assert from "node:assert/strict";
import {
  AuthorizedOperationReached,
  RedirectSignal,
  createRoleBoundaryClient,
  loadAdminActions,
  makeForm,
  testIds,
} from "./admin-module-test-harness.mjs";

const roles = ["anonymous", "user", "moderator", "admin", "owner"];
const allowedByMinimumRole = {
  admin: new Set(["admin", "owner"]),
  moderator: new Set(["moderator", "admin", "owner"]),
  owner: new Set(["owner"]),
};
const operations = [
  {
    form: { profile_id: testIds.other, role: "user" },
    minimumRole: "owner",
    name: "changeUserRole",
  },
  {
    form: { profile_id: testIds.other, status: "suspended" },
    minimumRole: "moderator",
    name: "changeUserStatus",
  },
  {
    form: { confirm_delete: "delete", profile_id: testIds.other },
    minimumRole: "admin",
    name: "deleteUserAccount",
  },
  {
    form: {
      account_type: "artist",
      display_name: "Test Artist",
      email: "artist@example.com",
      password: "correct horse battery staple",
      username: "test_artist",
    },
    minimumRole: "owner",
    name: "createTestAccount",
  },
  {
    form: {
      credit_amount: "10",
      credit_reason: "promo",
      operation_id: testIds.third,
      profile_id: testIds.other,
    },
    minimumRole: "admin",
    name: "grantUserAdCredit",
  },
  {
    form: {
      moderation_status: "hidden",
      subject_id: testIds.other,
      subject_type: "feed_post",
    },
    minimumRole: "moderator",
    name: "moderateContent",
  },
  {
    form: { comment_id: testIds.other, status: "hidden" },
    minimumRole: "moderator",
    name: "moderateHelpArticleComment",
  },
  {
    form: { report_id: testIds.other, status: "reviewing" },
    minimumRole: "moderator",
    name: "updateReportStatus",
  },
  {
    form: {
      followup_action: "warn_member",
      report_id: testIds.other,
    },
    minimumRole: "moderator",
    name: "recordReportFollowup",
  },
  {
    form: { request_id: testIds.other, status: "approved" },
    minimumRole: "moderator",
    name: "updateLicenseVerification",
  },
  {
    form: { campaign_id: testIds.other, status: "approved" },
    minimumRole: "moderator",
    name: "updateAdCampaignStatus",
  },
  {
    form: {
      campaign_id: testIds.other,
      credit_amount: "10",
      credit_reason: "promo",
    },
    minimumRole: "admin",
    name: "grantAdCampaignCredit",
  },
  {
    form: { product_id: testIds.other, status: "paused" },
    minimumRole: "moderator",
    name: "updateMerchProductStatus",
  },
  {
    form: { order_id: testIds.other, status: "fulfilled" },
    minimumRole: "admin",
    name: "updateMerchOrderStatus",
  },
  {
    form: { confirm: "refund", order_id: testIds.other },
    minimumRole: "admin",
    name: "refundMerchOrder",
  },
  {
    form: { request_id: testIds.other, status: "reviewing" },
    minimumRole: "admin",
    name: "updateAccountDeletionRequest",
  },
  {
    form: { booking_id: testIds.other, confirm: "reconcile" },
    minimumRole: "admin",
    name: "reconcileBookingDepositCheckout",
  },
  {
    form: { booking_id: testIds.other, confirm: "refund" },
    minimumRole: "admin",
    name: "refundBookingDeposit",
  },
];

let currentClient;
const { actions } = await loadAdminActions({
  createAdminClient() {
    throw new AuthorizedOperationReached("private admin client");
  },
  async createClient() {
    return currentClient;
  },
});

for (const role of roles) {
  for (const operation of operations) {
    const roleClient = createRoleBoundaryClient(role);
    currentClient = roleClient.client;
    let outcome;

    try {
      await actions[operation.name](makeForm(operation.form));
      outcome = new Error("Action returned without a terminal outcome");
    } catch (error) {
      outcome = error;
    }

    const shouldPassAuthorization =
      allowedByMinimumRole[operation.minimumRole].has(role);

    if (shouldPassAuthorization) {
      assert.ok(
        outcome instanceof AuthorizedOperationReached,
        `${role} should pass ${operation.name} authorization, got ${outcome}`,
      );
    } else {
      assert.ok(
        outcome instanceof RedirectSignal,
        `${role} should be denied by ${operation.name}, got ${outcome}`,
      );
    }
  }

  console.log(`PASS ${role} direct Server Action authorization matrix`);
}

console.log(
  `PASS ${operations.length} privileged Server Actions enforce their minimum roles independently of middleware`,
);
