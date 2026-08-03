"use server";

import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendHostgatorEmail } from "@/lib/mail/hostgator";
import { insertNotifications } from "@/lib/notification-write";
import { siteName, siteUrl, supportEmail } from "@/lib/site";
import {
  bookingCheckoutReconciliationDecision,
  bookingCheckoutReleaseAttemptDecision,
} from "@/lib/stripe/checkout-session";
import { createStripeClient, stripeCheckoutPreflight } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  canModerateUserStatus,
  isAssignableUserRole,
  type UserRole,
} from "@/lib/admin-role-hierarchy";

type AccountType = "artist" | "enthusiast" | "studio" | "supplier" | "vendor";
type SubjectType =
  | "feed_post"
  | "gig"
  | "marketplace_listing"
  | "merch_product"
  | "story_post"
  | "thread_post";
type ModerationStatus = "active" | "under_review" | "hidden" | "removed";
type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
type ReportFollowupAction = "escalate_report" | "warn_member";
type LicenseVerificationStatus = "approved" | "rejected";
type UserStatus = "active" | "suspended" | "banned";
type AdCampaignStatus = "approved" | "active" | "paused" | "rejected" | "archived";
type MerchProductStatus = "approved" | "active" | "paused" | "rejected" | "archived";
type MerchOrderAdminStatus = "fulfilled" | "cancelled";
type AccountDeletionStatus = "reviewing" | "rejected" | "cancelled";
type AdCreditReason = "promo" | "trade" | "sponsor" | "makegood" | "other";
type HelpCommentStatus = "pending_review" | "visible" | "hidden" | "removed";
type MerchOrderProductRow = {
  product_id: string;
};
type MailSettings = {
  from_email: string | null;
  from_name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_secure: boolean;
  smtp_password_secret_name: string;
  reply_to_email: string | null;
  is_enabled: boolean;
};

const moderatorRoles = new Set<UserRole>(["moderator", "admin", "owner"]);
const statuses = new Set<ModerationStatus>([
  "active",
  "under_review",
  "hidden",
  "removed",
]);
const reportStatuses = new Set<ReportStatus>([
  "open",
  "reviewing",
  "resolved",
  "dismissed",
]);
const reportFollowupActions = new Set<ReportFollowupAction>([
  "escalate_report",
  "warn_member",
]);
const licenseStatuses = new Set<LicenseVerificationStatus>([
  "approved",
  "rejected",
]);
const verificationEligibleAccountTypes = new Set(["artist", "studio", "vendor"]);
const userStatuses = new Set<UserStatus>(["active", "suspended", "banned"]);
const accountTypes = new Set<AccountType>([
  "artist",
  "enthusiast",
  "studio",
  "supplier",
  "vendor",
]);
const adCampaignStatuses = new Set<AdCampaignStatus>([
  "approved",
  "active",
  "paused",
  "rejected",
  "archived",
]);
const merchProductStatuses = new Set<MerchProductStatus>([
  "approved",
  "active",
  "paused",
  "rejected",
  "archived",
]);
const merchOrderAdminStatuses = new Set<MerchOrderAdminStatus>([
  "fulfilled",
  "cancelled",
]);
const accountDeletionStatuses = new Set<AccountDeletionStatus>([
  "reviewing",
  "rejected",
  "cancelled",
]);
const adCreditReasons = new Set<AdCreditReason>([
  "promo",
  "trade",
  "sponsor",
  "makegood",
  "other",
]);
const helpCommentStatuses = new Set<HelpCommentStatus>([
  "pending_review",
  "visible",
  "hidden",
  "removed",
]);

const subjectConfig = {
  feed_post: {
    idColumn: "id",
    ownerColumn: "author_id",
    table: "feed_posts",
  },
  gig: {
    idColumn: "id",
    ownerColumn: "poster_id",
    table: "gigs",
  },
  marketplace_listing: {
    idColumn: "id",
    ownerColumn: "seller_id",
    table: "marketplace_listings",
  },
  merch_product: {
    idColumn: "id",
    ownerColumn: "seller_id",
    table: "merch_products",
  },
  story_post: {
    idColumn: "id",
    ownerColumn: "author_id",
    table: "story_posts",
  },
  thread_post: {
    idColumn: "id",
    ownerColumn: "author_id",
    table: "thread_posts",
  },
} satisfies Record<
  SubjectType,
  { idColumn: string; ownerColumn: string; table: string }
>;

function adminMessage(message: string) {
  return `/admin?message=${encodeURIComponent(message)}#content`;
}

function safeAdminReturnPath(
  returnTo: string | undefined,
  allowedPath: string,
  fallback: string,
) {
  const value = returnTo?.trim();
  const hasControlCharacter =
    value &&
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });

  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasControlCharacter ||
    /%(?:2e|2f|5c)/i.test(value)
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://admin.internal");
    const pathAllowed =
      url.pathname === "/admin" ||
      url.pathname === allowedPath ||
      url.pathname.startsWith(`${allowedPath}/`);

    if (url.origin !== "https://admin.internal" || !pathAllowed) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function adminSectionMessage(
  message: string,
  returnTo: string | undefined,
  allowedPath: string,
  fallback: string,
) {
  const safeReturnTo = safeAdminReturnPath(returnTo, allowedPath, fallback);
  const url = new URL(safeReturnTo, "https://admin.internal");
  url.searchParams.set("message", message);

  return `${url.pathname}${url.search}${url.hash}`;
}

function adminUsersMessage(message: string, returnTo?: string) {
  return adminSectionMessage(message, returnTo, "/admin/users", "/admin#users");
}

function adminAdsMessage(message: string, returnTo?: string) {
  return adminSectionMessage(message, returnTo, "/admin/ads", "/admin#ads");
}

function adminMerchMessage(message: string, returnTo?: string) {
  return adminSectionMessage(message, returnTo, "/admin/merch", "/admin#merch");
}

function adminPaymentsMessage(message: string, returnTo?: string) {
  return adminSectionMessage(
    message,
    returnTo,
    "/admin/payments",
    "/admin/payments",
  );
}

function adminDataRequestsMessage(message: string, returnTo?: string) {
  return adminSectionMessage(
    message,
    returnTo,
    "/admin/data-requests",
    "/admin#data-requests",
  );
}

function adminVerificationMessage(message: string, returnTo?: string) {
  return adminSectionMessage(
    message,
    returnTo,
    "/admin/verification",
    "/admin#verification",
  );
}

function adminReportsMessage(message: string, returnTo?: string) {
  return adminSectionMessage(
    message,
    returnTo,
    "/admin/reports",
    "/admin#reports",
  );
}

function adminContentMessage(message: string, returnTo?: string) {
  return adminSectionMessage(
    message,
    returnTo,
    "/admin/content",
    "/admin#content",
  );
}

function helpArticlePath(slug: string) {
  return `/help/${slug}`;
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function bookingCheckoutSessionSnapshot(session: Stripe.Checkout.Session) {
  return {
    amountTotal: session.amount_total,
    artistId: session.metadata?.artist_id,
    bookingId: session.metadata?.booking_request_id,
    clientId: session.metadata?.client_id,
    clientReferenceId: session.client_reference_id,
    currency: session.currency,
    id: session.id,
    livemode: session.livemode,
    mode: session.mode,
    paymentKind: session.metadata?.payment_kind,
    paymentStatus: session.payment_status,
    status: session.status,
  };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function centsFromDollars(value: FormDataEntryValue | null, maxCents: number) {
  const text = cleanText(value, 20);
  if (!text) return 0;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return -1;

  return Math.min(Math.round(amount * 100), maxCents);
}

function optionalEndOfDayTimestamp(value: string) {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 2000 || year > 9999) return undefined;

  const timestamp = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

  if (
    timestamp.getUTCFullYear() !== year ||
    timestamp.getUTCMonth() !== month - 1 ||
    timestamp.getUTCDate() !== day
  ) {
    return undefined;
  }

  return timestamp.toISOString();
}

function isPastDate(value: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);

  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

function isEmail(value?: string | null): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function maybeSendVerificationDecisionEmail({
  accountType,
  note,
  profileId,
  status,
  supabase,
}: {
  accountType: string;
  note: string | null;
  profileId: string;
  status: LicenseVerificationStatus;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, notify_email_important, username")
      .eq("id", profileId)
      .maybeSingle<{
        display_name: string | null;
        notify_email_important: boolean | null;
        username: string | null;
      }>(),
    supabase
      .from("mail_settings")
      .select(
        "from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled",
      )
      .maybeSingle<MailSettings>(),
  ]);

  if (profile?.notify_email_important === false || !settings?.is_enabled) {
    return;
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    console.warn("Verification decision email skipped: missing service role key.");
    return;
  }

  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(profileId);

  if (userError) {
    console.error("Verification decision email user lookup failed");
    return;
  }

  const recipientEmail = userData.user?.email;
  if (!isEmail(recipientEmail)) return;

  const displayName = profile?.display_name || profile?.username || "there";
  const accountUrl = `${siteUrl}/account#verification-settings`;
  const approved = status === "approved";
  const subject = approved
    ? `${siteName} ${accountType} verification approved`
    : `${siteName} verification needs updated proof`;
  const body = approved
    ? `Your ${accountType} verification was approved. Stuff seller contact, professional access, and ad submission are now unlocked.`
    : note ||
      "Your verification was rejected. Open Settings to review the note and submit updated proof.";

  try {
    await sendHostgatorEmail({
      headers: {
        "X-TheTattooCore-Transactional": `verification-${status}`,
      },
      html: [
        `<h1>${escapeHtml(subject)}</h1>`,
        `<p>Hi ${escapeHtml(displayName)},</p>`,
        `<p>${escapeHtml(body)}</p>`,
        `<p>You can review verification status from <a href="${accountUrl}">Settings &gt; Verification</a>.</p>`,
        `<p>For help, email <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>`,
      ].join(""),
      recipientEmail,
      settings,
      subject,
      text: [
        subject,
        "",
        `Hi ${displayName},`,
        "",
        body,
        "",
        `Review status: ${accountUrl}`,
        `Help: ${supportEmail}`,
      ].join("\n"),
    });
  } catch {
    console.error("Verification decision email failed.");
  }
}

function actionTypeFor(status: ModerationStatus) {
  if (status === "active") return "restore_content";
  if (status === "removed") return "remove_content";

  return "hide_content";
}

async function requireModerator() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole }>();

  if (!profile || !moderatorRoles.has(profile.role)) {
    redirect(adminMessage("Admin access required."));
  }

  return { role: profile.role, supabase, userId };
}

async function requireOwner() {
  const { supabase, userId } = await requireModerator();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole }>();

  if (profile?.role !== "owner") {
    redirect("/admin?message=Owner access required.#users");
  }

  return { supabase, userId };
}

async function requireAdmin() {
  const { supabase, userId } = await requireModerator();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole }>();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    redirect("/admin?message=Admin access required.");
  }

  return { supabase, userId };
}

export async function changeUserRole(formData: FormData) {
  const profileId = cleanText(formData.get("profile_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const role = cleanText(formData.get("role"), 40);

  if (!isUuid(profileId) || !isAssignableUserRole(role)) {
    redirect(adminUsersMessage("Choose a valid user and role.", returnTo));
  }

  const { supabase, userId } = await requireOwner();

  if (profileId === userId) {
    redirect(adminUsersMessage("Owners cannot demote their own account.", returnTo));
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle<{ id: string; role: UserRole }>();

  if (targetError || !target) {
    if (targetError) {
      console.error("Admin role profile lookup failed.");
    }
    redirect(
      adminUsersMessage(
        "Profile was not found.",
        returnTo,
      ),
    );
  }

  if (target.role === "owner") {
    redirect(adminUsersMessage("Owner accounts cannot be demoted.", returnTo));
  }

  if (target.role === role) {
    redirect(adminUsersMessage("User already has that role.", returnTo));
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) {
    console.error("Admin role update failed.");
    redirect(
      adminUsersMessage("Could not update role. Please try again.", returnTo),
    );
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: "profile_role_changed",
    metadata: {
      from_role: target.role,
      to_role: role,
    },
    target_id: profileId,
    target_type: "profile",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect(adminUsersMessage("User role updated.", returnTo));
}

export async function changeUserStatus(formData: FormData) {
  const profileId = cleanText(formData.get("profile_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const status = cleanText(formData.get("status"), 40) as UserStatus;
  const note = cleanText(formData.get("note"), 500);

  if (!isUuid(profileId) || !userStatuses.has(status)) {
    redirect(adminUsersMessage("Choose a valid user and status.", returnTo));
  }

  const { role: actorRole, supabase, userId } = await requireModerator();

  if (profileId === userId && status !== "active") {
    redirect(adminUsersMessage("You cannot suspend or ban your own account.", returnTo));
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, banned_at, role, suspended_at")
    .eq("id", profileId)
    .maybeSingle<{
      banned_at: string | null;
      id: string;
      role: UserRole;
      suspended_at: string | null;
    }>();

  if (targetError || !target) {
    if (targetError) {
      console.error("Admin user status profile lookup failed.");
    }
    redirect(
      adminUsersMessage(
        "Profile was not found.",
        returnTo,
      ),
    );
  }

  if (!canModerateUserStatus(actorRole, target.role)) {
    redirect(
      adminUsersMessage(
        target.role === "owner"
          ? "Owner accounts cannot be suspended or banned."
          : "Your role cannot moderate this account.",
        returnTo,
      ),
    );
  }

  const now = new Date().toISOString();
  const updateValues =
    status === "active"
      ? {
          banned_at: null,
          moderation_note: note || null,
          suspended_at: null,
          updated_at: now,
        }
      : status === "suspended"
        ? {
            banned_at: null,
            moderation_note: note || null,
            suspended_at: now,
            updated_at: now,
          }
        : {
            banned_at: now,
            moderation_note: note || null,
            suspended_at: null,
            updated_at: now,
          };

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updateValues)
    .eq("id", profileId);

  if (updateError) {
    console.error("Admin user status update failed.");
    redirect(
      adminUsersMessage(
        "Could not update user status. Please try again.",
        returnTo,
      ),
    );
  }

  await supabase.from("moderation_actions").insert({
    action_type:
      status === "active"
        ? "restore_content"
        : status === "suspended"
          ? "suspend_user"
          : "ban_user",
    actor_id: userId,
    metadata: {
      from_banned_at: target.banned_at,
      from_suspended_at: target.suspended_at,
      to_status: status,
    },
    note: note || null,
    subject_id: profileId,
    subject_type: "profile",
    target_user_id: profileId,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect(adminUsersMessage("User status updated.", returnTo));
}

export async function deleteUserAccount(formData: FormData) {
  const profileId = cleanText(formData.get("profile_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const confirmation = cleanText(formData.get("confirm_delete"), 40).toLowerCase();

  if (!isUuid(profileId)) {
    redirect(adminUsersMessage("Choose a valid user account.", returnTo));
  }

  if (confirmation !== "delete") {
    redirect(adminUsersMessage("Type delete to confirm account deletion.", returnTo));
  }

  const { supabase, userId } = await requireAdmin();

  if (profileId === userId) {
    redirect(adminUsersMessage("You cannot delete your own account.", returnTo));
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole }>();

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role, username, banned_at, suspended_at")
    .eq("id", profileId)
    .maybeSingle<{
      banned_at: string | null;
      id: string;
      role: UserRole;
      suspended_at: string | null;
      username: string;
    }>();

  if (targetError || !target) {
    if (targetError) {
      console.error("Admin user deletion profile lookup failed.");
    }
    redirect(adminUsersMessage("Profile was not found.", returnTo));
  }

  if (target.role === "owner") {
    redirect(adminUsersMessage("Owner accounts cannot be deleted.", returnTo));
  }

  if (target.role === "admin" && actor?.role !== "owner") {
    redirect(adminUsersMessage("Owner role required to delete admin accounts.", returnTo));
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    redirect(
      adminUsersMessage(
        "Private account deletion tools are not enabled. Please try again after owner tools are ready.",
        returnTo,
      ),
    );
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(profileId);

  if (deleteError) {
    console.error("Admin auth user delete failed.");
    redirect(
      adminUsersMessage(
        "Could not delete user account. Review account activity and try again.",
        returnTo,
      ),
    );
  }

  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: "user_account_deleted",
    metadata: {
      target_role: target.role,
      target_username: target.username,
      was_banned: Boolean(target.banned_at),
      was_suspended: Boolean(target.suspended_at),
    },
    summary: `Deleted user account @${target.username}.`,
    target_id: profileId,
    target_type: "profile",
  });

  if (auditError) {
    console.error("Admin user deletion audit logging failed.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect(adminUsersMessage(`User @${target.username} deleted.`, returnTo));
}

export async function createTestAccount(formData: FormData) {
  const email = cleanText(formData.get("email"), 254).toLowerCase();
  const password = cleanText(formData.get("password"), 128);
  const username = cleanText(formData.get("username"), 30).toLowerCase();
  const displayName = cleanText(formData.get("display_name"), 80);
  const accountType = cleanText(formData.get("account_type"), 40) as AccountType;
  const returnTo = cleanText(formData.get("return_to"), 120);

  if (!isEmail(email)) {
    redirect(adminUsersMessage("Enter a valid tester email.", returnTo));
  }

  if (password.length < 8) {
    redirect(adminUsersMessage("Tester password must be at least 8 characters.", returnTo));
  }

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    redirect(
      adminUsersMessage(
        "Tester username must be 3-30 lowercase letters, numbers, or underscores.",
        returnTo,
      ),
    );
  }

  if (!displayName || !accountTypes.has(accountType)) {
    redirect(adminUsersMessage("Add a display name and valid account type.", returnTo));
  }

  const { supabase, userId } = await requireOwner();
  const adminClient = createAdminClient();

  if (!adminClient) {
    redirect(
      adminUsersMessage(
        "Private owner tools are not enabled, so Admin cannot create tester accounts yet.",
        returnTo,
      ),
    );
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle<{ id: string }>();

  if (existingProfile) {
    redirect(adminUsersMessage("That username is already taken.", returnTo));
  }

  const { data: createdUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: {
        full_name: displayName,
      },
    });

  const profileId = createdUser.user?.id;

  if (createError || !profileId) {
    if (createError) {
      console.error("Tester account auth create failed.");
    }
    redirect(
      adminUsersMessage(
        "Could not create tester account. Please try again.",
        returnTo,
      ),
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      account_type: accountType,
      display_name: displayName,
      username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) {
    console.error("Tester account profile setup failed.");
    await adminClient.auth.admin.deleteUser(profileId);
    redirect(
      adminUsersMessage(
        "Created tester login, but profile setup failed. Please try again.",
        returnTo,
      ),
    );
  }

  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: "tester_account_created",
    metadata: {
      account_type: accountType,
      username,
    },
    target_id: profileId,
    target_type: "profile",
  });

  if (auditError) {
    console.error("Tester account audit logging failed.");
    await adminClient.auth.admin.deleteUser(profileId);
    redirect(
      adminUsersMessage(
        "Created tester account, but audit logging failed. Please try again.",
        returnTo,
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect(adminUsersMessage(`Tester @${username} created.`, returnTo));
}

export async function grantUserAdCredit(formData: FormData) {
  const profileId = cleanText(formData.get("profile_id"), 80);
  const operationId = cleanText(formData.get("operation_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const reason = cleanText(formData.get("credit_reason"), 40) as AdCreditReason;
  const note = cleanText(formData.get("credit_note"), 500);
  const expiresAt = cleanText(formData.get("expires_at"), 20);
  const creditAmountCents = centsFromDollars(formData.get("credit_amount"), 10000000);

  if (
    !isUuid(profileId) ||
    !isUuid(operationId) ||
    !adCreditReasons.has(reason)
  ) {
    redirect(adminUsersMessage("Choose a valid user and ad credit reason.", returnTo));
  }

  if (creditAmountCents <= 0) {
    redirect(adminUsersMessage("Ad credit amount must be greater than zero.", returnTo));
  }

  const expiration = optionalEndOfDayTimestamp(expiresAt);

  if (expiration === undefined) {
    redirect(adminUsersMessage("Choose a valid ad credit expiration date.", returnTo));
  }

  const { supabase } = await requireAdmin();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", profileId)
    .maybeSingle<{ id: string; username: string }>();

  if (targetError || !target) {
    if (targetError) {
      console.error("Admin ad credit profile lookup failed.");
    }
    redirect(
      adminUsersMessage("Profile was not found.", returnTo),
    );
  }

  const { data: applied, error: grantError } = await supabase.rpc(
    "grant_admin_ad_credit",
    {
      p_amount_cents: creditAmountCents,
      p_credit_reason: reason,
      p_expires_at: expiration,
      p_note: note || null,
      p_operation_id: operationId,
      p_profile_id: profileId,
    },
  );

  if (grantError) {
    console.error("Admin ad credit grant failed.");
    redirect(
      adminUsersMessage("Could not grant ad credit. Please try again.", returnTo),
    );
  }

  if (!applied) {
    redirect(adminUsersMessage("This ad credit was already applied.", returnTo));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/ads");
  revalidatePath("/account");
  redirect(adminUsersMessage(`Ad credit granted to @${target.username}.`, returnTo));
}

export async function moderateContent(formData: FormData) {
  const subjectType = cleanText(formData.get("subject_type"), 40) as SubjectType;
  const subjectId = cleanText(formData.get("subject_id"), 80);
  const reportId = cleanText(formData.get("report_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const moderationStatus = cleanText(
    formData.get("moderation_status"),
    40,
  ) as ModerationStatus;
  const note = cleanText(formData.get("note"), 500);
  const config = subjectConfig[subjectType];

  if (!config || !isUuid(subjectId) || !statuses.has(moderationStatus)) {
    redirect(adminContentMessage("Choose valid content and moderation status.", returnTo));
  }

  const { supabase, userId } = await requireModerator();
  let linkedReport: {
    id: string;
    subject_id: string;
    subject_type: string;
  } | null = null;

  if (reportId && !isUuid(reportId)) {
    redirect(adminReportsMessage("Linked report was not found.", returnTo));
  }

  if (reportId) {
    const { data: report, error: reportError } = await supabase
      .from("content_reports")
      .select("id, subject_type, subject_id")
      .eq("id", reportId)
      .maybeSingle<{
        id: string;
        subject_id: string;
        subject_type: string;
      }>();

    if (reportError || !report) {
      if (reportError) {
        console.error("Admin linked content report lookup failed.");
      }
      redirect(
        adminReportsMessage(
          "Linked report was not found.",
          returnTo,
        ),
      );
    }

    if (report.subject_type !== subjectType || report.subject_id !== subjectId) {
      redirect(adminReportsMessage("Report does not match that content.", returnTo));
    }

    linkedReport = report;
  }

  const { data: subject, error: subjectError } = await supabase
    .from(config.table)
    .select(config.ownerColumn)
    .eq(config.idColumn, subjectId)
    .maybeSingle<Record<string, string | null>>();

  if (subjectError || !subject) {
    if (subjectError) {
      console.error("Admin content subject lookup failed.");
    }
    redirect(
      adminContentMessage(
        "Content was not found.",
        returnTo,
      ),
    );
  }

  const { error: updateError } = await supabase
    .from(config.table)
    .update({
      moderation_status: moderationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq(config.idColumn, subjectId);

  if (updateError) {
    console.error("Admin content moderation update failed.");
    redirect(
      adminContentMessage(
        "Could not update content. Please try again.",
        returnTo,
      ),
    );
  }

  const { error: actionError } = await supabase
    .from("moderation_actions")
    .insert({
      action_type: actionTypeFor(moderationStatus),
      actor_id: userId,
      metadata: {
        moderation_status: moderationStatus,
      },
      note: note || null,
      subject_id: subjectId,
      subject_type: subjectType,
      target_user_id: subject[config.ownerColumn],
    });

  if (actionError) {
    console.error("Admin content moderation log failed.");
    redirect(
      adminContentMessage(
        "Content changed, but moderation log failed. Please try again.",
        returnTo,
      ),
    );
  }

  if (linkedReport) {
    const nextReportStatus =
      moderationStatus === "under_review" ? "reviewing" : "resolved";
    const now = new Date().toISOString();
    const reportUpdate =
      nextReportStatus === "resolved"
        ? {
            assigned_to: userId,
            resolved_at: now,
            resolved_by: userId,
            status: nextReportStatus,
            updated_at: now,
          }
        : {
            assigned_to: userId,
            resolved_at: null,
            resolved_by: null,
            status: nextReportStatus,
            updated_at: now,
          };

    const { error: reportUpdateError } = await supabase
      .from("content_reports")
      .update(reportUpdate)
      .eq("id", reportId);

    if (reportUpdateError) {
      console.error("Admin linked report status update failed.");
      redirect(
        adminReportsMessage(
          "Content changed, but the report status did not update. Please try again.",
          returnTo,
        ),
      );
    }

    if (nextReportStatus === "resolved") {
      const { error: reportActionError } = await supabase
        .from("moderation_actions")
        .insert({
          action_type: "resolve_report",
          actor_id: userId,
          metadata: {
            moderation_status: moderationStatus,
            report_status: nextReportStatus,
          },
          note: note || null,
          report_id: reportId,
          subject_id: subjectId,
          subject_type: subjectType,
          target_user_id: subject[config.ownerColumn],
        });

      if (reportActionError) {
        console.error("Admin linked report resolution log failed.");
        redirect(
          adminReportsMessage(
            "Content and report changed, but report log failed. Please try again.",
            returnTo,
          ),
        );
      }
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/admin/reports");
  revalidatePath("/");
  redirect(
    reportId
      ? adminReportsMessage("Moderation status and report updated.", returnTo)
      : adminContentMessage("Moderation status updated.", returnTo),
  );
}

export async function moderateHelpArticleComment(formData: FormData) {
  const commentId = cleanText(formData.get("comment_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 140);
  const status = cleanText(formData.get("status"), 40) as HelpCommentStatus;
  const note = cleanText(formData.get("note"), 500);
  const isOfficialAnswer = formData.get("is_official_answer") === "on";
  const isPinned = formData.get("is_pinned") === "on";

  if (!isUuid(commentId) || !helpCommentStatuses.has(status)) {
    redirect(adminContentMessage("Choose a valid Help question status.", returnTo));
  }

  const { supabase, userId } = await requireModerator();
  const { data: comment, error: commentError } = await supabase
    .from("help_article_comments")
    .select("id, article_slug, author_id, status")
    .eq("id", commentId)
    .maybeSingle<{
      article_slug: string;
      author_id: string;
      id: string;
      status: HelpCommentStatus;
    }>();

  if (commentError || !comment) {
    if (commentError) {
      console.error("Admin Help question lookup failed.");
    }
    redirect(
      adminContentMessage(
        "Help question was not found.",
        returnTo,
      ),
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("help_article_comments")
    .update({
      hidden_at: status === "hidden" || status === "removed" ? now : null,
      is_official_answer: isOfficialAnswer,
      is_pinned: isPinned,
      reviewed_at: now,
      reviewed_by: userId,
      status,
      updated_at: now,
    })
    .eq("id", commentId);

  if (updateError) {
    console.error("Admin Help question update failed.");
    redirect(
      adminContentMessage(
        "Could not update Help question. Please try again.",
        returnTo,
      ),
    );
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: `help_comment_${status}`,
    metadata: {
      is_official_answer: isOfficialAnswer,
      is_pinned: isPinned,
      previous_status: comment.status,
    },
    summary: note || `Help question marked ${status.replaceAll("_", " ")}.`,
    target_id: commentId,
    target_type: "help_article_comment",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath(helpArticlePath(comment.article_slug));
  redirect(adminContentMessage("Help question updated.", returnTo));
}

export async function updateReportStatus(formData: FormData) {
  const reportId = cleanText(formData.get("report_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const status = cleanText(formData.get("status"), 40) as ReportStatus;
  const note = cleanText(formData.get("note"), 500);

  if (!isUuid(reportId) || !reportStatuses.has(status)) {
    redirect(adminReportsMessage("Choose a valid report status.", returnTo));
  }

  const { supabase, userId } = await requireModerator();
  const { data: report, error: reportError } = await supabase
    .from("content_reports")
    .select("id, subject_type, subject_id, reporter_id")
    .eq("id", reportId)
    .maybeSingle<{
      id: string;
      reporter_id: string;
      subject_id: string;
      subject_type: string;
    }>();

  if (reportError || !report) {
    if (reportError) {
      console.error("Admin report status lookup failed.");
    }
    redirect(
      adminReportsMessage(
        "Report was not found.",
        returnTo,
      ),
    );
  }

  const resolved = status === "resolved" || status === "dismissed";
  const updateValues = resolved
    ? {
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        status,
        updated_at: new Date().toISOString(),
      }
    : {
        assigned_to: userId,
        resolved_at: null,
        resolved_by: null,
        status,
        updated_at: new Date().toISOString(),
      };
  const { error: updateError } = await supabase
    .from("content_reports")
    .update(updateValues)
    .eq("id", reportId);

  if (updateError) {
    console.error("Admin report status update failed.");
    redirect(
      adminReportsMessage(
        "Could not update report. Please try again.",
        returnTo,
      ),
    );
  }

  if (resolved) {
    const { error: actionError } = await supabase
      .from("moderation_actions")
      .insert({
        action_type: status === "resolved" ? "resolve_report" : "dismiss_report",
        actor_id: userId,
        metadata: { report_status: status },
        note: note || null,
        report_id: report.id,
        subject_id: report.subject_id,
        subject_type: report.subject_type,
      });

    if (actionError) {
      console.error("Admin report status log failed.");
      redirect(
        adminReportsMessage(
          "Report changed, but log failed. Please try again.",
          returnTo,
        ),
      );
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  redirect(adminReportsMessage("Report status updated.", returnTo));
}

export async function recordReportFollowup(formData: FormData) {
  const reportId = cleanText(formData.get("report_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const followupAction = cleanText(
    formData.get("followup_action"),
    40,
  ) as ReportFollowupAction;
  const note = cleanText(formData.get("note"), 500);

  if (!isUuid(reportId) || !reportFollowupActions.has(followupAction)) {
    redirect(adminReportsMessage("Choose a valid report follow-up.", returnTo));
  }

  const { supabase, userId } = await requireModerator();
  const { data: report, error: reportError } = await supabase
    .from("content_reports")
    .select("id, subject_type, subject_id, reporter_id, status")
    .eq("id", reportId)
    .maybeSingle<{
      id: string;
      reporter_id: string;
      status: ReportStatus;
      subject_id: string;
      subject_type: string;
    }>();

  if (reportError || !report) {
    if (reportError) {
      console.error("Admin report follow-up lookup failed.");
    }
    redirect(
      adminReportsMessage(
        "Report was not found.",
        returnTo,
      ),
    );
  }

  const config = subjectConfig[report.subject_type as SubjectType];
  let targetUserId: string | null = null;

  if (report.subject_type === "profile") {
    targetUserId = report.subject_id;
  } else if (config) {
    const { data: subject } = await supabase
      .from(config.table)
      .select(config.ownerColumn)
      .eq(config.idColumn, report.subject_id)
      .maybeSingle<Record<string, string | null>>();

    targetUserId = subject?.[config.ownerColumn] ?? null;
  }

  const now = new Date().toISOString();
  const { error: actionError } = await supabase
    .from("moderation_actions")
    .insert({
      action_type: followupAction,
      actor_id: userId,
      metadata: {
        report_status:
          followupAction === "escalate_report" ? "reviewing" : report.status,
      },
      note: note || null,
      report_id: report.id,
      subject_id: report.subject_id,
      subject_type: report.subject_type,
      target_user_id: targetUserId,
    });

  if (actionError) {
    console.error("Admin report follow-up log failed.");
    redirect(
      adminReportsMessage(
        "Could not record report follow-up. Please try again.",
        returnTo,
      ),
    );
  }

  if (report.status === "open" || followupAction === "escalate_report") {
    const { error: updateError } = await supabase
      .from("content_reports")
      .update({
        assigned_to: userId,
        status: "reviewing",
        updated_at: now,
      })
      .eq("id", report.id);

    if (updateError) {
      console.error("Admin report follow-up status update failed.");
      redirect(
        adminReportsMessage(
          "Follow-up was logged, but report status did not update. Please try again.",
          returnTo,
        ),
      );
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  redirect(
    adminReportsMessage(
      followupAction === "escalate_report"
        ? "Report escalated for review."
        : "Warning follow-up recorded.",
      returnTo,
    ),
  );
}

export async function updateLicenseVerification(formData: FormData) {
  const requestId = cleanText(formData.get("request_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const status = cleanText(
    formData.get("status"),
    40,
  ) as LicenseVerificationStatus;
  const note = cleanText(formData.get("note"), 500);

  if (!isUuid(requestId) || !licenseStatuses.has(status)) {
    redirect(adminVerificationMessage("Choose a valid license decision.", returnTo));
  }

  if (status === "rejected" && note.length < 10) {
    redirect(
      adminVerificationMessage(
        "Add a short rejection note for the member.",
        returnTo,
      ),
    );
  }

  const { supabase, userId } = await requireModerator();
  const { data: request, error: requestError } = await supabase
    .from("license_verification_requests")
    .select("id, account_type, expires_on, profile_id, status")
    .eq("id", requestId)
    .maybeSingle<{
      account_type: string;
      expires_on: string | null;
      id: string;
      profile_id: string;
      status: string;
    }>();

  if (requestError || !request) {
    if (requestError) {
      console.error("Admin verification request lookup failed.");
    }
    redirect(
      adminVerificationMessage(
        "License request was not found.",
        returnTo,
      ),
    );
  }

  if (request.status !== "pending") {
    redirect(
      adminVerificationMessage(
        "This license request was already reviewed.",
        returnTo,
      ),
    );
  }

  if (
    status === "approved" &&
    !verificationEligibleAccountTypes.has(request.account_type)
  ) {
    redirect(
      adminVerificationMessage(
        "Only artist, studio, or vendor accounts can be approved.",
        returnTo,
      ),
    );
  }

  if (status === "approved" && isPastDate(request.expires_on)) {
    redirect(
      adminVerificationMessage(
        "Expired license documents must be rejected or resubmitted.",
        returnTo,
      ),
    );
  }

  const { error: updateError } = await supabase
    .from("license_verification_requests")
    .update({
      reviewed_at: new Date().toISOString(),
      reviewer_id: userId,
      reviewer_note: note || null,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (updateError) {
    console.error("Admin verification request update failed.");
    redirect(
      adminVerificationMessage(
        "Could not update license request. Please try again.",
        returnTo,
      ),
    );
  }

  if (status === "approved") {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        license_verification_request_id: request.id,
        license_verified_at: new Date().toISOString(),
        license_verified_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.profile_id);

    if (profileError) {
      console.error("Admin verification profile badge update failed.");
      redirect(
        adminVerificationMessage(
          "License approved, but profile badge failed. Please try again.",
          returnTo,
        ),
      );
    }
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: `license_${status}`,
    metadata: {
      account_type: request.account_type,
      expires_on: request.expires_on,
      status,
    },
    summary: note || null,
    target_id: request.id,
    target_type: "license_verification_request",
  });

  const notificationBody =
    status === "approved"
      ? `Your ${request.account_type} verification was approved. Stuff seller contact, professional access, and ad submission are now unlocked.`
      : note ||
        "Your verification was rejected. Open Settings to review the note and submit updated proof.";
  const { error: notificationError } = await insertNotifications({
    actor_id: userId,
    body: notificationBody.slice(0, 240),
    href: "/account#verification-settings",
    recipient_id: request.profile_id,
    subject_id: request.id,
    subject_type: "license_verification_request",
    title:
      status === "approved"
        ? "Verification approved"
        : "Verification needs updated proof",
    type:
      status === "approved"
        ? "verification_approved"
        : "verification_rejected",
  });

  if (notificationError) {
    console.error("Admin verification notification failed.");
    redirect(
      adminVerificationMessage(
        "License updated, but member notification failed. Please try again.",
        returnTo,
      ),
    );
  }

  await maybeSendVerificationDecisionEmail({
    accountType: request.account_type,
    note: note || null,
    profileId: request.profile_id,
    status,
    supabase,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/verification");
  revalidatePath("/account");
  redirect(adminVerificationMessage("License verification updated.", returnTo));
}

export async function updateAdCampaignStatus(formData: FormData) {
  const campaignId = cleanText(formData.get("campaign_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const status = cleanText(formData.get("status"), 40) as AdCampaignStatus;
  const note = cleanText(formData.get("note"), 500);

  if (!isUuid(campaignId) || !adCampaignStatuses.has(status)) {
    redirect(adminAdsMessage("Choose a valid ad campaign status.", returnTo));
  }

  const { supabase } = await requireModerator();
  const { data: campaign, error: campaignError } = await supabase
    .from("ad_campaigns")
    .select(
      "id, advertiser_id, status, payment_status, payment_dispute_hold, campaign_type, goal",
    )
    .eq("id", campaignId)
    .maybeSingle<{
      advertiser_id: string;
      campaign_type: string;
      goal: string;
      id: string;
      payment_dispute_hold: boolean;
      payment_status: string;
      status: string;
    }>();

  if (campaignError || !campaign) {
    if (campaignError) {
      console.error("Admin ad campaign lookup failed.");
    }
    redirect(
      adminAdsMessage(
        "Ad campaign was not found.",
        returnTo,
      ),
    );
  }

  if (campaign.status === status) {
    redirect(adminAdsMessage("Ad campaign already has that status.", returnTo));
  }

  if (status === "active" && campaign.payment_dispute_hold) {
    redirect(
      adminAdsMessage(
        "This campaign is under payment review and cannot be activated.",
        returnTo,
      ),
    );
  }

  if (
    status === "active" &&
    campaign.payment_status !== "paid" &&
    campaign.payment_status !== "waived"
  ) {
    redirect(
      adminAdsMessage(
        "Paid or waived ad payment is required before activation.",
        returnTo,
      ),
    );
  }

  const { data: updated, error: updateError } = await supabase.rpc(
    "admin_update_ad_campaign_status",
    {
      p_campaign_id: campaign.id,
      p_expected_status: campaign.status,
      p_note: note || null,
      p_status: status,
    },
  );

  if (updateError) {
    console.error("Admin ad campaign status update failed.");
    redirect(
      adminAdsMessage(
        "Could not update ad campaign. Please try again.",
        returnTo,
      ),
    );
  }

  if (!updated) {
    redirect(
      adminAdsMessage(
        "Ad campaign changed before this decision. Review it and try again.",
        returnTo,
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/ads");
  revalidatePath("/");
  redirect(adminAdsMessage("Ad campaign updated.", returnTo));
}

export async function grantAdCampaignCredit(formData: FormData) {
  const campaignId = cleanText(formData.get("campaign_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const reason = cleanText(formData.get("credit_reason"), 40) as AdCreditReason;
  const note = cleanText(formData.get("credit_note"), 500);
  const creditAmountCents = centsFromDollars(formData.get("credit_amount"), 10000000);

  if (!isUuid(campaignId) || !adCreditReasons.has(reason)) {
    redirect(adminAdsMessage("Choose a valid ad credit reason.", returnTo));
  }

  if (creditAmountCents <= 0) {
    redirect(adminAdsMessage("Ad credit amount must be a valid dollar amount.", returnTo));
  }

  const { supabase } = await requireAdmin();
  const { data: campaign, error: campaignError } = await supabase
    .from("ad_campaigns")
    .select("id, advertiser_id, status, payment_status, prepaid_amount_cents, daily_budget_cents, campaign_type, goal")
    .eq("id", campaignId)
    .maybeSingle<{
      advertiser_id: string;
      campaign_type: string;
      daily_budget_cents: number;
      goal: string;
      id: string;
      payment_status: string;
      prepaid_amount_cents: number;
      status: string;
    }>();

  if (campaignError || !campaign) {
    if (campaignError) {
      console.error("Admin ad credit campaign lookup failed.");
    }
    redirect(
      adminAdsMessage(
        "Ad campaign was not found.",
        returnTo,
      ),
    );
  }

  if (
    campaign.payment_status === "waived" &&
    campaign.prepaid_amount_cents === creditAmountCents
  ) {
    redirect(adminAdsMessage("This ad credit was already applied.", returnTo));
  }

  if (campaign.payment_status === "paid" || campaign.payment_status === "checkout_started") {
    redirect(
      adminAdsMessage(
        "Only unpaid, failed, refunded, or already-waived ad campaigns can receive manual credit.",
        returnTo,
      ),
    );
  }

  const { data: updated, error: updateError } = await supabase.rpc(
    "admin_grant_ad_campaign_credit",
    {
      p_campaign_id: campaign.id,
      p_credit_amount_cents: creditAmountCents,
      p_credit_reason: reason,
      p_expected_payment_status: campaign.payment_status,
      p_expected_prepaid_amount_cents: campaign.prepaid_amount_cents,
      p_note: note || null,
    },
  );

  if (updateError) {
    console.error("Admin ad campaign credit update failed.");
    redirect(adminAdsMessage("Could not apply ad credit. Please try again.", returnTo));
  }

  if (!updated) {
    redirect(
      adminAdsMessage(
        "Ad campaign payment changed before this credit. Review it and try again.",
        returnTo,
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/ads");
  revalidatePath("/admin/payments");
  revalidatePath("/");
  redirect(adminAdsMessage("Ad credit applied. Campaign payment is now waived.", returnTo));
}

export async function updateMerchProductStatus(formData: FormData) {
  const productId = cleanText(formData.get("product_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const status = cleanText(formData.get("status"), 40) as MerchProductStatus;
  const note = cleanText(formData.get("note"), 500);

  if (!isUuid(productId) || !merchProductStatuses.has(status)) {
    redirect(adminMerchMessage("Choose a valid merch product status.", returnTo));
  }

  const { supabase } = await requireModerator();
  const { data: product, error: productError } = await supabase
    .from("merch_products")
    .select(
      "id, seller_id, status, moderation_status, title, category, price_cents, currency, inventory_quantity, inventory_reserved, fulfillment_notes, is_official, return_policy, shipping_required, ships_from_city, ships_from_region, profiles:profiles!merch_products_seller_id_fkey(account_type, license_verified_at)",
    )
    .eq("id", productId)
    .maybeSingle<{
      category: string;
      currency: string;
      fulfillment_notes: string | null;
      id: string;
      inventory_quantity: number;
      inventory_reserved: number;
      is_official: boolean;
      moderation_status: string;
      price_cents: number;
      profiles: { account_type: string; license_verified_at: string | null } | null;
      return_policy: string | null;
      seller_id: string;
      shipping_required: boolean;
      ships_from_city: string | null;
      ships_from_region: string | null;
      status: string;
      title: string;
    }>();

  if (productError || !product) {
    if (productError) {
      console.error("Admin Merch product lookup failed.");
    }
    redirect(
      adminMerchMessage(
        "Merch product was not found.",
        returnTo,
      ),
    );
  }

  if (product.status === status) {
    redirect(adminMerchMessage("Merch product already has that status.", returnTo));
  }

  if (status === "active" && product.status !== "approved") {
    redirect(
      adminMerchMessage(
        "Merch must be approved before seller checkout can be activated.",
        returnTo,
      ),
    );
  }

  if (status === "active" && product.is_official) {
    redirect(
      adminMerchMessage(
        "Official TTC Merch cannot be activated in this release.",
        returnTo,
      ),
    );
  }

  const sellerVerified = Boolean(
    product.profiles?.license_verified_at &&
      verificationEligibleAccountTypes.has(product.profiles.account_type),
  );

  if (
    (status === "approved" || status === "active") &&
    !product.is_official &&
    !sellerVerified
  ) {
    redirect(
      adminMerchMessage(
        "This seller must be artist, studio, or vendor license verified before Merch can be approved or activated.",
        returnTo,
      ),
    );
  }

  if (status === "active") {
    const adminClient = createAdminClient();

    if (!adminClient) {
      console.error("Admin Merch seller checkout lookup failed.");
      redirect(
        adminMerchMessage(
          "Could not review seller checkout readiness. Please try again.",
          returnTo,
        ),
      );
    }

    const { data: checkoutRow, error: checkoutError } = await adminClient
      .from("merch_products")
      .select(
        "id, external_checkout_url, seller_checkout_terms_version, seller_checkout_terms_accepted_at",
      )
      .eq("id", product.id)
      .eq("seller_id", product.seller_id)
      .maybeSingle<{
        external_checkout_url: string | null;
        id: string;
        seller_checkout_terms_accepted_at: string | null;
        seller_checkout_terms_version: string | null;
      }>();

    if (checkoutError || !checkoutRow) {
      console.error("Admin Merch seller checkout lookup failed.");
      redirect(
        adminMerchMessage(
          "Could not review seller checkout readiness. Please try again.",
          returnTo,
        ),
      );
    }

    const { sellerCheckoutSubmissionReadiness } = await import("@/lib/merch/seller-checkout");
    const checkoutReadiness = sellerCheckoutSubmissionReadiness({
      externalCheckoutUrl: checkoutRow.external_checkout_url,
      fulfillmentNotes: product.fulfillment_notes,
      inventoryQuantity: product.inventory_quantity,
      inventoryReserved: product.inventory_reserved,
      isOfficial: product.is_official,
      moderationStatus: product.moderation_status,
      returnPolicy: product.return_policy,
      sellerCheckoutTermsAcceptedAt: checkoutRow.seller_checkout_terms_accepted_at,
      sellerCheckoutTermsVersion: checkoutRow.seller_checkout_terms_version,
      sellerVerified,
      shippingRequired: product.shipping_required,
      shipsFromCity: product.ships_from_city,
      shipsFromRegion: product.ships_from_region,
      status: product.status,
    });

    if (!checkoutReadiness.ready) {
      const message =
        checkoutReadiness.reason === "seller_unverified"
          ? "This seller must be artist, studio, or vendor license verified before Merch can be approved or activated."
          : checkoutReadiness.reason === "sold_out"
            ? "Merch needs available inventory before seller checkout can be activated."
            : checkoutReadiness.reason === "missing_fulfillment"
              ? "Merch needs ship-from, fulfillment, and return/refund details before seller checkout can be activated."
              : checkoutReadiness.reason === "missing_terms"
                ? "The seller must accept the current seller checkout responsibilities before Merch can be activated."
                : checkoutReadiness.reason === "invalid_url"
                  ? "Merch needs a valid live Stripe Payment Link before seller checkout can be activated."
                  : "Merch is not ready for seller checkout activation.";

      redirect(adminMerchMessage(message, returnTo));
    }
  }

  const { data: updated, error: updateError } = await supabase.rpc(
    "admin_update_merch_product_status",
    {
      p_expected_status: product.status,
      p_note: note || null,
      p_product_id: product.id,
      p_status: status,
    },
  );

  if (updateError) {
    console.error("Admin Merch product update failed.");
    redirect(
      adminMerchMessage(
        "Could not update Merch product. Please try again.",
        returnTo,
      ),
    );
  }

  if (!updated) {
    redirect(
      adminMerchMessage(
        "Merch product changed before this decision. Review it and try again.",
        returnTo,
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/merch");
  redirect(adminMerchMessage("Merch product updated.", returnTo));
}

export async function updateMerchOrderStatus(formData: FormData) {
  const orderId = cleanText(formData.get("order_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const status = cleanText(
    formData.get("status"),
    40,
  ) as MerchOrderAdminStatus;
  const note = cleanText(formData.get("note"), 1000);

  if (!isUuid(orderId) || !merchOrderAdminStatuses.has(status)) {
    redirect(adminMerchMessage("Choose a valid merch order and status.", returnTo));
  }

  const { supabase } = await requireAdmin();

  const { data: order, error: orderError } = await supabase
    .from("merch_orders")
    .select(
      "id, status, inventory_reservation_status, buyer_id, total_cents, currency",
    )
    .eq("id", orderId)
    .maybeSingle<{
      buyer_id: string;
      currency: string;
      id: string;
      inventory_reservation_status: string;
      status: string;
      total_cents: number;
    }>();

  if (orderError || !order) {
    if (orderError) {
      console.error("Admin Merch order lookup failed.");
    }
    redirect(
      adminMerchMessage(
        "Merch order was not found.",
        returnTo,
      ),
    );
  }

  if (order.status === status) {
    redirect(adminMerchMessage(`This order is already ${status}.`, returnTo));
  }

  if (status === "fulfilled" && order.status !== "paid") {
    redirect(adminMerchMessage("Only paid orders can be fulfilled.", returnTo));
  }

  if (status === "cancelled" && order.status === "pending_checkout") {
    redirect(
      adminMerchMessage(
        "This order still has a checkout in progress. Reconcile the checkout before cancelling it.",
        returnTo,
      ),
    );
  }

  if (
    status === "cancelled" &&
    order.status === "payment_failed" &&
    order.inventory_reservation_status !== "released"
  ) {
    redirect(
      adminMerchMessage(
        "This failed order is not ready for cancellation. Keep it held for review.",
        returnTo,
      ),
    );
  }

  if (
    status === "cancelled" &&
    order.status !== "payment_failed"
  ) {
    redirect(
      adminMerchMessage(
        order.status === "cancelled"
          ? "This order is already cancelled."
          : "Only failed orders can be cancelled here. Refund paid orders in the payment review tools first.",
        returnTo,
      ),
    );
  }

  const { data: updated, error: updateError } = await supabase.rpc(
    "admin_update_merch_order_status",
    {
      p_admin_note: note || null,
      p_order_id: order.id,
      p_status: status,
    },
  );

  if (updateError) {
    console.error("Admin Merch order update failed.");
    redirect(
      adminMerchMessage(
        "Could not update Merch order. Please try again.",
        returnTo,
      ),
    );
  }

  if (!updated) {
    redirect(
      adminMerchMessage(
        "Merch order changed before this action. Review it and try again.",
        returnTo,
      ),
    );
  }

  const { data: orderItems } = await supabase
    .from("merch_order_items")
    .select("product_id")
    .eq("order_id", orderId)
    .returns<MerchOrderProductRow[]>();
  const productIds = new Set(
    (orderItems ?? []).map((item) => item.product_id).filter(Boolean),
  );

  revalidatePath("/admin");
  revalidatePath("/admin/merch");
  revalidatePath("/account");
  for (const productId of productIds) {
    revalidatePath(`/merch/${productId}`);
  }
  redirect(adminMerchMessage("Merch order updated.", returnTo));
}

export async function refundMerchOrder(formData: FormData) {
  const orderId = cleanText(formData.get("order_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const confirm = cleanText(formData.get("confirm"), 20).toLowerCase();

  if (!isUuid(orderId)) {
    redirect(adminMerchMessage("Choose a Merch order first.", returnTo));
  }

  if (confirm !== "refund") {
    redirect(
      adminMerchMessage(
        "Type refund to confirm the full Merch order refund.",
        returnTo,
      ),
    );
  }

  const { supabase, userId } = await requireModerator();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole }>();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    redirect(adminMerchMessage("Admin payment access required.", returnTo));
  }

  const adminClient = createAdminClient();
  const stripe = createStripeClient();
  const checkoutPreflight = stripeCheckoutPreflight();

  if (!adminClient || !stripe || !checkoutPreflight.ready) {
    redirect(adminMerchMessage("Private payment tools unavailable.", returnTo));
  }

  const { data: order, error: orderError } = await adminClient
    .from("merch_orders")
    .select(
      "id, status, total_cents, stripe_payment_intent_id, payment_dispute_hold",
    )
    .eq("id", orderId)
    .maybeSingle<{
      id: string;
      payment_dispute_hold: boolean;
      status: string;
      stripe_payment_intent_id: string | null;
      total_cents: number;
    }>();

  if (orderError || !order) {
    if (orderError) {
      console.error("Admin Merch refund order lookup failed.");
    }
    redirect(adminMerchMessage("Merch order was not found.", returnTo));
  }

  if (
    !order.stripe_payment_intent_id ||
    order.total_cents <= 0 ||
    !["paid", "fulfilled"].includes(order.status)
  ) {
    redirect(
      adminMerchMessage(
        "Only paid or fulfilled Merch orders with a payment record can be refunded here.",
        returnTo,
      ),
    );
  }

  if (order.payment_dispute_hold) {
    redirect(
      adminMerchMessage(
        "This Merch payment is under review and cannot be refunded here yet.",
        returnTo,
      ),
    );
  }

  const paymentIntentId = order.stripe_payment_intent_id;
  const { data: existingRefundAudits, error: refundAuditLookupError } =
    await adminClient
      .from("admin_audit_logs")
      .select("id")
      .eq("event_type", "refund_merch_order_requested")
      .eq("target_id", order.id)
      .eq("target_type", "merch_order")
      .limit(1)
      .returns<{ id: string }[]>();

  if (refundAuditLookupError) {
    console.error("Admin Merch refund audit lookup failed.");
    redirect(
      adminMerchMessage(
        "Could not verify Merch refund history. No refund was requested. Please try again.",
        returnTo,
      ),
    );
  }

  if (existingRefundAudits?.length) {
    redirect(adminMerchMessage("This Merch refund was already requested.", returnTo));
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
  } catch {
    console.error("Admin Merch payment lookup failed before refund.");
    redirect(
      adminMerchMessage(
        "Could not confirm the Merch payment. No refund was requested. Please try again.",
        returnTo,
      ),
    );
  }

  if (
    paymentIntent.livemode !== checkoutPreflight.actual ||
    paymentIntent.metadata?.payment_kind !== "merch_order" ||
    paymentIntent.metadata?.merch_order_id !== order.id
  ) {
    console.error("Admin Merch refund payment ownership check failed.");
    redirect(
      adminMerchMessage(
        "This payment could not be matched safely to the Merch order. No refund was requested.",
        returnTo,
      ),
    );
  }

  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === "string") {
    redirect(
      adminMerchMessage(
        "The Merch payment charge could not be inspected. No refund was requested.",
        returnTo,
      ),
    );
  }

  const merchRefundRequestKeyVersion = "merch-full-refund-v1";
  const merchRefundRequestKey = `${merchRefundRequestKeyVersion}:${order.id}:${latestCharge.id}`;
  let matchingRefund: Stripe.Refund | undefined;
  let existingRefunds: Stripe.Refund[] = [];

  try {
    const refunds = await stripe.refunds.list({
      charge: latestCharge.id,
      limit: 100,
    });
    existingRefunds = refunds.data;
    matchingRefund = refunds.data.find(
      (refund) =>
        refund.metadata?.merch_order_id === order.id &&
        refund.metadata?.refund_kind === "merch_order_full",
    );
  } catch {
    console.error("Admin Merch refund history lookup failed.");
    redirect(
      adminMerchMessage(
        "Could not confirm Merch refund history. No new refund was requested. Please try again.",
        returnTo,
      ),
    );
  }

  if (matchingRefund?.status === "failed" || matchingRefund?.status === "canceled") {
    redirect(
      adminMerchMessage(
        "The earlier Merch refund needs payment review before another attempt.",
        returnTo,
      ),
    );
  }

  const activeExistingRefund = existingRefunds.find(
    (refund) => refund.status !== "failed" && refund.status !== "canceled",
  );

  if (!matchingRefund && (activeExistingRefund || latestCharge.amount_refunded > 0)) {
    redirect(
      adminMerchMessage(
        "This Merch payment already has refund activity. Review it before taking another action.",
        returnTo,
      ),
    );
  }

  const reverseDestinationTransfer = Boolean(latestCharge.transfer_data?.destination);
  const refundApplicationFee =
    reverseDestinationTransfer && (latestCharge.application_fee_amount ?? 0) > 0;

  if (!matchingRefund) {
    const refundParams: Stripe.RefundCreateParams = {
      charge: latestCharge.id,
      metadata: {
        merch_order_id: order.id,
        refund_kind: "merch_order_full",
      },
      reason: "requested_by_customer",
    };

    if (reverseDestinationTransfer) {
      refundParams.reverse_transfer = true;
      refundParams.refund_application_fee = refundApplicationFee;
    }

    try {
      matchingRefund = await stripe.refunds.create(refundParams, {
        idempotencyKey: merchRefundRequestKey,
      });
    } catch {
      console.error("Admin Merch refund request failed.");
      redirect(
        adminMerchMessage(
          "Could not confirm the Merch refund. Retry this action; it will not send a duplicate refund.",
          returnTo,
        ),
      );
    }
  }

  const { error: refundAuditError } = await adminClient
    .from("admin_audit_logs")
    .insert({
      actor_id: userId,
      event_type: "refund_merch_order_requested",
      metadata: {
        application_fee_refunded: refundApplicationFee,
        payment_intent_id: paymentIntentId,
        refund_id: matchingRefund.id,
        refund_status: matchingRefund.status,
        request_key_version: merchRefundRequestKeyVersion,
        seller_transfer_reversed: reverseDestinationTransfer,
        total_cents: order.total_cents,
      },
      operation_key: merchRefundRequestKey,
      summary: `Requested full Merch refund for order ${order.id.slice(0, 8)}.`,
      target_id: order.id,
      target_type: "merch_order",
    });

  if (refundAuditError?.code === "23505") {
    redirect(adminMerchMessage("This Merch refund was already requested.", returnTo));
  }

  if (refundAuditError) {
    console.error("Admin Merch refund audit record failed.");
    redirect(
      adminMerchMessage(
        "Refund request needs audit confirmation. Retry this action; it will not send a duplicate refund.",
        returnTo,
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/merch");
  revalidatePath("/admin/payments");
  revalidatePath("/account");
  redirect(
    adminMerchMessage(
      "Merch refund request recorded. Final payment status will update shortly.",
      returnTo,
    ),
  );
}

export async function updateAccountDeletionRequest(formData: FormData) {
  const requestId = cleanText(formData.get("request_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const statusValue = cleanText(
    formData.get("status"),
    40,
  );
  const note = cleanText(formData.get("note"), 500);

  if (statusValue === "completed") {
    redirect(
      adminDataRequestsMessage(
        "Completion requires the verified account deletion workflow.",
        returnTo,
      ),
    );
  }

  const status = statusValue as AccountDeletionStatus;

  if (!isUuid(requestId) || !accountDeletionStatuses.has(status)) {
    redirect(
      adminDataRequestsMessage("Choose a valid account deletion status.", returnTo),
    );
  }

  if (status === "rejected" && note.length < 10) {
    redirect(
      adminDataRequestsMessage(
        "Add a clear review note before rejecting the request.",
        returnTo,
      ),
    );
  }

  const { supabase, userId } = await requireAdmin();
  const { data: request, error: requestError } = await supabase
    .from("account_deletion_requests")
    .select("id, profile_id, status")
    .eq("id", requestId)
    .maybeSingle<{
      id: string;
      profile_id: string;
      status: string;
  }>();

  if (requestError || !request) {
    if (requestError) {
      console.error("Account deletion request lookup failed.");
    }
    redirect(
      adminDataRequestsMessage(
        "Account deletion request was not found.",
        returnTo,
      ),
    );
  }

  if (request.status === "completed") {
    redirect(
      adminDataRequestsMessage(
        "Completed deletion requests cannot be changed.",
        returnTo,
      ),
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("account_deletion_requests")
    .update({
      reviewed_at: now,
      reviewed_by: userId,
      reviewer_note: note || null,
      status,
    })
    .eq("id", requestId);

  if (updateError) {
    console.error("Account deletion request update failed.");
    redirect(
      adminDataRequestsMessage(
        "Could not update account deletion request. Please try again.",
        returnTo,
      ),
    );
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: `account_deletion_${status}`,
    metadata: {
      from_status: request.status,
      to_status: status,
    },
    summary: note || null,
    target_id: request.id,
    target_type: "account_deletion_request",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/data-requests");
  revalidatePath("/account");
  redirect(adminDataRequestsMessage("Account deletion request updated.", returnTo));
}

export async function reconcileBookingDepositCheckout(formData: FormData) {
  const returnTo = cleanText(formData.get("return_to"), 160);
  const bookingId = cleanText(formData.get("booking_id"), 80);
  const confirm = cleanText(formData.get("confirm"), 20).toLowerCase();

  if (!isUuid(bookingId)) {
    redirect(adminPaymentsMessage("Choose a booking checkout first.", returnTo));
  }

  if (confirm !== "reconcile") {
    redirect(
      adminPaymentsMessage(
        "Confirm the held booking checkout reconciliation before running it.",
        returnTo,
      ),
    );
  }

  const { supabase, userId } = await requireModerator();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole }>();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    redirect(adminPaymentsMessage("Admin payment access required.", returnTo));
  }

  const adminClient = createAdminClient();
  const stripe = createStripeClient();
  const checkoutPreflight = stripeCheckoutPreflight();

  if (!adminClient || !stripe || !checkoutPreflight.ready) {
    redirect(adminPaymentsMessage("Private payment tools unavailable.", returnTo));
  }

  const { data: booking, error } = await adminClient
    .from("booking_requests")
    .select(
      "id, artist_id, client_id, currency, payment_dispute_hold, payment_status, status, stripe_checkout_session_id, total_cents, updated_at",
    )
    .eq("id", bookingId)
    .maybeSingle<{
      artist_id: string;
      client_id: string;
      currency: string;
      id: string;
      payment_dispute_hold: boolean;
      payment_status: string;
      status: string;
      stripe_checkout_session_id: string | null;
      total_cents: number;
      updated_at: string;
    }>();

  if (error || !booking) {
    if (error) {
      console.error("Admin booking checkout lookup failed.");
    }

    redirect(
      adminPaymentsMessage(
        "Could not confirm this booking checkout. It remains held for review.",
        returnTo,
      ),
    );
  }

  const checkoutSessionId = booking.stripe_checkout_session_id;

  if (
    booking.status !== "deposit_pending" ||
    booking.payment_status !== "checkout_started" ||
    booking.payment_dispute_hold ||
    !checkoutSessionId
  ) {
    redirect(
      adminPaymentsMessage(
        "This booking no longer has a held checkout to reconcile.",
        returnTo,
      ),
    );
  }

  const staleBefore = Date.now() - 24 * 60 * 60 * 1000;
  const bookingUpdatedAt = Date.parse(booking.updated_at);

  if (
    !Number.isFinite(bookingUpdatedAt) ||
    bookingUpdatedAt > staleBefore
  ) {
    redirect(
      adminPaymentsMessage(
        "This booking checkout is not old enough to reconcile. It remains held for review.",
        returnTo,
      ),
    );
  }

  let checkoutSession: Stripe.Checkout.Session;

  try {
    checkoutSession =
      await stripe.checkout.sessions.retrieve(checkoutSessionId);
  } catch {
    console.error("Admin booking checkout retrieval failed.");
    redirect(
      adminPaymentsMessage(
        "Could not confirm this booking checkout. It remains held for review.",
        returnTo,
      ),
    );
  }

  const reconciliationOptions = {
    booking: {
      artistId: booking.artist_id,
      clientId: booking.client_id,
      currency: booking.currency,
      id: booking.id,
      totalCents: booking.total_cents,
    },
    expectedLivemode: checkoutPreflight.actual,
    sessionId: checkoutSessionId,
  };
  let reconciliationDecision = bookingCheckoutReconciliationDecision({
    ...reconciliationOptions,
    session: bookingCheckoutSessionSnapshot(checkoutSession),
  });

  if (reconciliationDecision.action === "hold") {
    console.error("Admin booking checkout reconciliation held.");
    redirect(
      adminPaymentsMessage(
        "This checkout cannot be safely released. It remains held for review.",
        returnTo,
      ),
    );
  }

  let reconciledSession = checkoutSession;

  if (reconciliationDecision.action === "expire") {
    try {
      reconciledSession = await stripe.checkout.sessions.expire(
        checkoutSession.id,
      );
    } catch {
      console.error("Admin booking checkout expiration failed.");
      redirect(
        adminPaymentsMessage(
          "Could not safely close this checkout. It remains held for review.",
          returnTo,
        ),
      );
    }
  }

  reconciliationDecision = bookingCheckoutReconciliationDecision({
    ...reconciliationOptions,
    session: bookingCheckoutSessionSnapshot(reconciledSession),
  });

  if (reconciliationDecision.action !== "release") {
    redirect(
      adminPaymentsMessage(
        "This checkout was not confirmed closed and unpaid. It remains held for review.",
        returnTo,
      ),
    );
  }

  const { error: auditError } = await adminClient
    .from("admin_audit_logs")
    .insert({
      actor_id: userId,
      event_type: "booking_checkout_reconciliation_approved",
      metadata: {
        from_payment_status: booking.payment_status,
        from_status: booking.status,
        reconciliation_result: "expired_unpaid",
        remote_payment_status: reconciledSession.payment_status,
        remote_status: reconciledSession.status,
      },
      operation_key: `booking-checkout-reconciliation-v1:${booking.id}:${checkoutSessionId}`,
      summary: "Approved an expired unpaid booking checkout for conditional release.",
      target_id: booking.id,
      target_type: "booking_request",
    });

  if (auditError && auditError.code !== "23505") {
    console.error("Admin booking checkout reconciliation audit failed.");
    redirect(
      adminPaymentsMessage(
        "Checkout remains held because reconciliation could not be recorded. Please try again.",
        returnTo,
      ),
    );
  }

  const { data: releasedBooking, error: releaseError } = await adminClient
    .from("booking_requests")
    .update({
      payment_status: "payment_failed",
      status: "accepted",
      stripe_checkout_session_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("status", "deposit_pending")
    .eq("payment_status", "checkout_started")
    .eq("payment_dispute_hold", false)
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (releaseError) {
    console.error("Admin booking checkout release result was indeterminate.");
  }

  let alreadyReleasedBooking: { id: string } | null = null;
  let alreadyReleasedError: unknown = null;

  if (releaseError || !releasedBooking) {
    const {
      data,
      error,
    } = await adminClient
      .from("booking_requests")
      .select("id")
      .eq("id", booking.id)
      .eq("status", "accepted")
      .eq("payment_status", "payment_failed")
      .eq("payment_dispute_hold", false)
      .is("stripe_checkout_session_id", null)
      .maybeSingle<{ id: string }>();

    alreadyReleasedBooking = data;
    alreadyReleasedError = error;
  }

  const releaseDecision = bookingCheckoutReleaseAttemptDecision({
    bookingId: booking.id,
    releasedBookingId: releasedBooking?.id ?? null,
    updateError: Boolean(releaseError),
    verifiedReleasedBookingId: alreadyReleasedBooking?.id ?? null,
    verificationError: Boolean(alreadyReleasedError),
  });

  if (releaseDecision.action === "reject") {
    if (alreadyReleasedError) {
      console.error("Admin booking checkout post-race verification failed.");
    }

    redirect(
      adminPaymentsMessage(
        "Checkout was not released because the booking changed during reconciliation.",
        returnTo,
      ),
    );
  }

  const releaseWasAlreadyCompleted =
    releaseDecision.reason !== "update_matched";

  revalidatePath("/admin/payments");
  revalidatePath("/account");
  revalidatePath("/messages");
  redirect(
    adminPaymentsMessage(
      releaseWasAlreadyCompleted
        ? "Checkout reconciliation was already completed. The booking is ready for a new deposit attempt."
        : "Checkout reconciled. The booking is ready for a new deposit attempt.",
      returnTo,
    ),
  );
}

export async function refundBookingDeposit(formData: FormData) {
  const returnTo = cleanText(formData.get("return_to"), 160);
  const bookingId = cleanText(formData.get("booking_id"), 80);
  const confirm = cleanText(formData.get("confirm"), 20).toLowerCase();

  if (!isUuid(bookingId)) {
    redirect(adminPaymentsMessage("Choose a booking deposit first.", returnTo));
  }

  if (confirm !== "refund") {
    redirect(
      adminPaymentsMessage(
        "Type refund to confirm the booking deposit refund.",
        returnTo,
      ),
    );
  }

  const { supabase, userId } = await requireModerator();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole }>();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    redirect(adminPaymentsMessage("Admin payment access required.", returnTo));
  }

  const adminClient = createAdminClient();
  const stripe = createStripeClient();
  const checkoutPreflight = stripeCheckoutPreflight();

  if (!adminClient || !stripe || !checkoutPreflight.ready) {
    redirect(adminPaymentsMessage("Private payment tools unavailable.", returnTo));
  }

  const { data: booking, error } = await adminClient
    .from("booking_requests")
    .select(
      "id, title, payment_status, payment_dispute_hold, status, total_cents, stripe_payment_intent_id",
    )
    .eq("id", bookingId)
    .maybeSingle<{
      id: string;
      payment_dispute_hold: boolean;
      payment_status: string;
      status: string;
      stripe_payment_intent_id: string | null;
      title: string;
      total_cents: number;
    }>();

  if (error || !booking) {
    if (error) {
      console.error("Admin booking deposit lookup failed.");
    }

    redirect(adminPaymentsMessage("Booking deposit not found.", returnTo));
  }

  const paymentIntentId = booking.stripe_payment_intent_id;

  if (!paymentIntentId || booking.total_cents <= 0) {
    redirect(
      adminPaymentsMessage(
        "Only paid booking deposits with a payment record can be refunded here.",
        returnTo,
      ),
    );
  }

  const { data: existingRefundAudits, error: refundAuditLookupError } =
    await adminClient
      .from("admin_audit_logs")
      .select("id")
      .eq("event_type", "refund_booking_deposit_requested")
      .eq("target_id", booking.id)
      .eq("target_type", "booking_request")
      .limit(1)
      .returns<{ id: string }[]>();

  if (refundAuditLookupError) {
    console.error("Admin booking deposit refund audit lookup failed.");
    redirect(
      adminPaymentsMessage(
        "Could not verify booking refund history. No refund was requested. Please try again.",
        returnTo,
      ),
    );
  }

  if (existingRefundAudits?.length) {
    redirect(
      adminPaymentsMessage(
        "Booking deposit refund was already requested.",
        returnTo,
      ),
    );
  }

  const bookingRefundRequestKeyVersion = "booking-full-refund-v1";
  const bookingRefundRequestKey = `${bookingRefundRequestKeyVersion}:${booking.id}:${paymentIntentId}`;
  let matchingRefund: Stripe.Refund | undefined;
  let existingRefunds: Stripe.Refund[] = [];
  let paymentIntent: Stripe.PaymentIntent;

  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    console.error("Admin booking payment lookup failed before refund.");
    redirect(
      adminPaymentsMessage(
        "Could not confirm the booking payment. No refund was requested. Please try again.",
        returnTo,
      ),
    );
  }

  if (
    paymentIntent.livemode !== checkoutPreflight.actual ||
    paymentIntent.metadata?.payment_kind !== "booking_deposit" ||
    paymentIntent.metadata?.booking_request_id !== booking.id
  ) {
    console.error("Admin booking refund payment ownership check failed.");
    redirect(
      adminPaymentsMessage(
        "This payment could not be matched safely to the booking. No refund was requested.",
        returnTo,
      ),
    );
  }

  try {
    const refunds = await stripe.refunds.list({
      limit: 100,
      payment_intent: paymentIntentId,
    });
    existingRefunds = refunds.data;
    matchingRefund = refunds.data.find(
      (refund) =>
        refund.metadata?.booking_request_id === booking.id &&
        refund.metadata?.refund_kind === "booking_deposit",
    );
  } catch {
    console.error("Admin booking deposit refund history lookup failed.");
    redirect(
      adminPaymentsMessage(
        "Could not confirm booking refund history. No new refund was requested. Please try again.",
        returnTo,
      ),
    );
  }

  if (matchingRefund?.status === "failed" || matchingRefund?.status === "canceled") {
    redirect(
      adminPaymentsMessage(
        "The earlier booking refund needs payment review before another attempt.",
        returnTo,
      ),
    );
  }

  const activeExistingRefund = existingRefunds.find(
    (refund) => refund.status !== "failed" && refund.status !== "canceled",
  );

  if (!matchingRefund && activeExistingRefund) {
    redirect(
      adminPaymentsMessage(
        "This booking payment already has refund activity. Review it before taking another action.",
        returnTo,
      ),
    );
  }

  if (!matchingRefund) {
    if (booking.payment_dispute_hold) {
      redirect(
        adminPaymentsMessage(
          "This booking payment is under review and cannot be refunded here yet.",
          returnTo,
        ),
      );
    }

    if (
      booking.payment_status !== "paid" ||
      booking.status !== "deposit_paid"
    ) {
      redirect(
        adminPaymentsMessage(
          "Only paid booking deposits with a payment record can be refunded here.",
          returnTo,
        ),
      );
    }

    try {
      matchingRefund = await stripe.refunds.create(
        {
          metadata: {
            booking_request_id: booking.id,
            refund_kind: "booking_deposit",
          },
          payment_intent: paymentIntentId,
          reason: "requested_by_customer",
        },
        { idempotencyKey: bookingRefundRequestKey },
      );
    } catch {
      console.error("Admin booking deposit refund request failed.");
      redirect(
        adminPaymentsMessage(
          "Could not confirm booking refund. Retry this action; it will not send a duplicate refund.",
          returnTo,
        ),
      );
    }
  }

  const { error: refundAuditError } = await adminClient
    .from("admin_audit_logs")
    .insert({
      actor_id: userId,
      event_type: "refund_booking_deposit_requested",
      metadata: {
        booking_request_id: booking.id,
        payment_intent_id: paymentIntentId,
        refund_id: matchingRefund.id,
        refund_status: matchingRefund.status,
        request_key_version: bookingRefundRequestKeyVersion,
        total_cents: booking.total_cents,
      },
      operation_key: bookingRefundRequestKey,
      summary: `Requested full booking deposit refund for ${booking.title}.`,
      target_id: booking.id,
      target_type: "booking_request",
    });

  if (refundAuditError?.code === "23505") {
    redirect(
      adminPaymentsMessage(
        "Booking deposit refund was already requested.",
        returnTo,
      ),
    );
  }

  if (refundAuditError) {
    console.error("Admin booking deposit refund audit record failed.");
    redirect(
      adminPaymentsMessage(
        "Refund request needs audit confirmation. Retry this action; it will not send a duplicate refund.",
        returnTo,
      ),
    );
  }

  revalidatePath("/admin/payments");
  revalidatePath("/account");
  revalidatePath("/messages");
  redirect(
    adminPaymentsMessage(
      "Booking deposit refund request recorded. Final payment status will update shortly.",
      returnTo,
    ),
  );
}
