"use server";

import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendHostgatorEmail } from "@/lib/mail/hostgator";
import { insertNotifications } from "@/lib/notification-write";
import { siteName, siteUrl, supportEmail } from "@/lib/site";
import { createStripeClient, stripeCheckoutPreflight } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
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
type AccountDeletionStatus = "reviewing" | "completed" | "rejected" | "cancelled";
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
const roleStatuses = new Set<UserRole>(["user", "moderator", "admin", "owner"]);
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
  "completed",
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

function adminUsersMessage(message: string, returnTo?: string) {
  const safeReturnTo =
    returnTo?.startsWith("/admin/users") || returnTo === "/admin"
      ? returnTo
      : "/admin#users";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  const hashIndex = safeReturnTo.indexOf("#");

  if (hashIndex >= 0) {
    const base = safeReturnTo.slice(0, hashIndex);
    const hash = safeReturnTo.slice(hashIndex);

    return `${base}${separator}message=${encodeURIComponent(message)}${hash}`;
  }

  return `${safeReturnTo}${separator}message=${encodeURIComponent(message)}`;
}

function adminAdsMessage(message: string, returnTo?: string) {
  const safeReturnTo =
    returnTo?.startsWith("/admin/ads") || returnTo === "/admin"
      ? returnTo
      : "/admin#ads";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  const hashIndex = safeReturnTo.indexOf("#");

  if (hashIndex >= 0) {
    const base = safeReturnTo.slice(0, hashIndex);
    const hash = safeReturnTo.slice(hashIndex);

    return `${base}${separator}message=${encodeURIComponent(message)}${hash}`;
  }

  return `${safeReturnTo}${separator}message=${encodeURIComponent(message)}`;
}

function adminMerchMessage(message: string, returnTo?: string) {
  const safeReturnTo =
    returnTo?.startsWith("/admin/merch") || returnTo === "/admin"
      ? returnTo
      : "/admin#merch";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  const hashIndex = safeReturnTo.indexOf("#");

  if (hashIndex >= 0) {
    const base = safeReturnTo.slice(0, hashIndex);
    const hash = safeReturnTo.slice(hashIndex);

    return `${base}${separator}message=${encodeURIComponent(message)}${hash}`;
  }

  return `${safeReturnTo}${separator}message=${encodeURIComponent(message)}`;
}

function adminPaymentsMessage(message: string, returnTo?: string) {
  const safeReturnTo =
    returnTo?.startsWith("/admin/payments") || returnTo === "/admin"
      ? returnTo
      : "/admin/payments";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  const hashIndex = safeReturnTo.indexOf("#");

  if (hashIndex >= 0) {
    const base = safeReturnTo.slice(0, hashIndex);
    const hash = safeReturnTo.slice(hashIndex);

    return `${base}${separator}message=${encodeURIComponent(message)}${hash}`;
  }

  return `${safeReturnTo}${separator}message=${encodeURIComponent(message)}`;
}

function adminDataRequestsMessage(message: string, returnTo?: string) {
  const safeReturnTo =
    returnTo?.startsWith("/admin/data-requests") || returnTo === "/admin"
      ? returnTo
      : "/admin#data-requests";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  const hashIndex = safeReturnTo.indexOf("#");

  if (hashIndex >= 0) {
    const base = safeReturnTo.slice(0, hashIndex);
    const hash = safeReturnTo.slice(hashIndex);

    return `${base}${separator}message=${encodeURIComponent(message)}${hash}`;
  }

  return `${safeReturnTo}${separator}message=${encodeURIComponent(message)}`;
}

function adminVerificationMessage(message: string, returnTo?: string) {
  const safeReturnTo =
    returnTo?.startsWith("/admin/verification") || returnTo === "/admin"
      ? returnTo
      : "/admin#verification";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  const hashIndex = safeReturnTo.indexOf("#");

  if (hashIndex >= 0) {
    const base = safeReturnTo.slice(0, hashIndex);
    const hash = safeReturnTo.slice(hashIndex);

    return `${base}${separator}message=${encodeURIComponent(message)}${hash}`;
  }

  return `${safeReturnTo}${separator}message=${encodeURIComponent(message)}`;
}

function adminReportsMessage(message: string, returnTo?: string) {
  const safeReturnTo =
    returnTo?.startsWith("/admin/reports") || returnTo === "/admin"
      ? returnTo
      : "/admin#reports";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  const hashIndex = safeReturnTo.indexOf("#");

  if (hashIndex >= 0) {
    const base = safeReturnTo.slice(0, hashIndex);
    const hash = safeReturnTo.slice(hashIndex);

    return `${base}${separator}message=${encodeURIComponent(message)}${hash}`;
  }

  return `${safeReturnTo}${separator}message=${encodeURIComponent(message)}`;
}

function adminContentMessage(message: string, returnTo?: string) {
  const safeReturnTo =
    returnTo?.startsWith("/admin/content") || returnTo === "/admin"
      ? returnTo
      : "/admin#content";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  const hashIndex = safeReturnTo.indexOf("#");

  if (hashIndex >= 0) {
    const base = safeReturnTo.slice(0, hashIndex);
    const hash = safeReturnTo.slice(hashIndex);

    return `${base}${separator}message=${encodeURIComponent(message)}${hash}`;
  }

  return `${safeReturnTo}${separator}message=${encodeURIComponent(message)}`;
}

function helpArticlePath(slug: string) {
  return `/help/${slug}`;
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function centsFromDollars(value: FormDataEntryValue | null, maxCents: number) {
  const text = cleanText(value, 20);
  if (!text) return 0;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return -1;

  return Math.min(Math.round(amount * 100), maxCents);
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
    console.error("Verification decision email user lookup failed", userError);
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
  } catch (error) {
    console.error("Verification decision email failed", error);
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

  return { supabase, userId };
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
  const role = cleanText(formData.get("role"), 40) as UserRole;

  if (!profileId || !roleStatuses.has(role)) {
    redirect(adminUsersMessage("Choose a valid user and role.", returnTo));
  }

  const { supabase, userId } = await requireOwner();

  if (profileId === userId && role !== "owner") {
    redirect(adminUsersMessage("Owners cannot demote their own account.", returnTo));
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle<{ id: string; role: UserRole }>();

  if (targetError || !target) {
    if (targetError) {
      console.error("Admin role profile lookup failed.", targetError);
    }
    redirect(
      adminUsersMessage(
        "Profile was not found.",
        returnTo,
      ),
    );
  }

  if (target.role === "owner" && role !== "owner") {
    redirect(adminUsersMessage("Owner accounts cannot be demoted.", returnTo));
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) {
    console.error("Admin role update failed.", updateError);
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

  if (!profileId || !userStatuses.has(status)) {
    redirect(adminUsersMessage("Choose a valid user and status.", returnTo));
  }

  const { supabase, userId } = await requireModerator();

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
      console.error("Admin user status profile lookup failed.", targetError);
    }
    redirect(
      adminUsersMessage(
        "Profile was not found.",
        returnTo,
      ),
    );
  }

  if (target.role === "owner" && status !== "active") {
    redirect(adminUsersMessage("Owner accounts cannot be suspended or banned.", returnTo));
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
    console.error("Admin user status update failed.", updateError);
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

  if (!profileId) {
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
      console.error("Admin user deletion profile lookup failed.", targetError);
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
    console.error("Admin auth user delete failed.", deleteError);
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
    console.error("Admin user deletion audit logging failed.", auditError);
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
      console.error("Tester account auth create failed.", createError);
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
    console.error("Tester account profile setup failed.", updateError);
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
      email,
      username,
    },
    target_id: profileId,
    target_type: "profile",
  });

  if (auditError) {
    console.error("Tester account audit logging failed.", auditError);
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
  const returnTo = cleanText(formData.get("return_to"), 120);
  const reason = cleanText(formData.get("credit_reason"), 40) as AdCreditReason;
  const note = cleanText(formData.get("credit_note"), 500);
  const expiresAt = cleanText(formData.get("expires_at"), 20);
  const creditAmountCents = centsFromDollars(formData.get("credit_amount"), 10000000);

  if (!profileId || !adCreditReasons.has(reason)) {
    redirect(adminUsersMessage("Choose a valid user and ad credit reason.", returnTo));
  }

  if (creditAmountCents <= 0) {
    redirect(adminUsersMessage("Ad credit amount must be greater than zero.", returnTo));
  }

  const expiration =
    expiresAt && Number.isFinite(new Date(`${expiresAt}T23:59:59Z`).getTime())
      ? new Date(`${expiresAt}T23:59:59Z`).toISOString()
      : null;
  const { supabase, userId } = await requireAdmin();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", profileId)
    .maybeSingle<{ id: string; username: string }>();

  if (targetError || !target) {
    if (targetError) {
      console.error("Admin ad credit profile lookup failed.", targetError);
    }
    redirect(
      adminUsersMessage("Profile was not found.", returnTo),
    );
  }

  const { error: insertError } = await supabase.from("ad_credit_ledger").insert({
    actor_id: userId,
    amount_cents: creditAmountCents,
    credit_reason: reason,
    expires_at: expiration,
    note: note || null,
    profile_id: profileId,
  });

  if (insertError) {
    console.error("Admin ad credit grant failed.", insertError);
    redirect(
      adminUsersMessage("Could not grant ad credit. Please try again.", returnTo),
    );
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: "user_ad_credit_granted",
    metadata: {
      amount_cents: creditAmountCents,
      expires_at: expiration,
      reason,
    },
    summary: note || `Manual ad credit granted to @${target.username}.`,
    target_id: profileId,
    target_type: "profile",
  });

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

  if (!config || !subjectId || !statuses.has(moderationStatus)) {
    redirect(adminContentMessage("Choose valid content and moderation status.", returnTo));
  }

  const { supabase, userId } = await requireModerator();
  let linkedReport: {
    id: string;
    subject_id: string;
    subject_type: string;
  } | null = null;

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
        console.error("Admin linked content report lookup failed.", reportError);
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
      console.error("Admin content subject lookup failed.", subjectError);
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
    console.error("Admin content moderation update failed.", updateError);
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
    console.error("Admin content moderation log failed.", actionError);
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
      console.error("Admin linked report status update failed.", reportUpdateError);
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
        console.error("Admin linked report resolution log failed.", reportActionError);
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

  if (!commentId || !helpCommentStatuses.has(status)) {
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
      console.error("Admin Help question lookup failed.", commentError);
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
    console.error("Admin Help question update failed.", updateError);
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

  if (!reportId || !reportStatuses.has(status)) {
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
      console.error("Admin report status lookup failed.", reportError);
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
    console.error("Admin report status update failed.", updateError);
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
      console.error("Admin report status log failed.", actionError);
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

  if (!reportId || !reportFollowupActions.has(followupAction)) {
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
      console.error("Admin report follow-up lookup failed.", reportError);
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
    console.error("Admin report follow-up log failed.", actionError);
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
      console.error("Admin report follow-up status update failed.", updateError);
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

  if (!requestId || !licenseStatuses.has(status)) {
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
      console.error("Admin verification request lookup failed.", requestError);
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
    console.error("Admin verification request update failed.", updateError);
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
      console.error("Admin verification profile badge update failed.", profileError);
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
    console.error("Admin verification notification failed.", notificationError);
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

  if (!campaignId || !adCampaignStatuses.has(status)) {
    redirect(adminAdsMessage("Choose a valid ad campaign status.", returnTo));
  }

  const { supabase, userId } = await requireModerator();
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
      console.error("Admin ad campaign lookup failed.", campaignError);
    }
    redirect(
      adminAdsMessage(
        "Ad campaign was not found.",
        returnTo,
      ),
    );
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

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("ad_campaigns")
    .update({
      reviewed_at: now,
      reviewed_by: userId,
      reviewer_note: note || null,
      status,
      updated_at: now,
    })
    .eq("id", campaignId);

  if (updateError) {
    console.error("Admin ad campaign status update failed.", updateError);
    redirect(
      adminAdsMessage(
        "Could not update ad campaign. Please try again.",
        returnTo,
      ),
    );
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: `ad_campaign_${status}`,
    metadata: {
      campaign_type: campaign.campaign_type,
      from_status: campaign.status,
      goal: campaign.goal,
      to_status: status,
    },
    summary: note || null,
    target_id: campaign.id,
    target_type: "ad_campaign",
  });

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

  if (!campaignId || !adCreditReasons.has(reason)) {
    redirect(adminAdsMessage("Choose a valid ad credit reason.", returnTo));
  }

  if (creditAmountCents <= 0) {
    redirect(adminAdsMessage("Ad credit amount must be a valid dollar amount.", returnTo));
  }

  const { supabase, userId } = await requireAdmin();
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
      console.error("Admin ad credit campaign lookup failed.", campaignError);
    }
    redirect(
      adminAdsMessage(
        "Ad campaign was not found.",
        returnTo,
      ),
    );
  }

  if (campaign.payment_status === "paid" || campaign.payment_status === "checkout_started") {
    redirect(
      adminAdsMessage(
        "Only unpaid, failed, refunded, or already-waived ad campaigns can receive manual credit.",
        returnTo,
      ),
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("ad_campaigns")
    .update({
      payment_status: "waived",
      platform_fee_cents: 0,
      prepaid_amount_cents: creditAmountCents,
      reviewer_note: note || "Ad credit applied.",
      updated_at: now,
    })
    .eq("id", campaign.id);

  if (updateError) {
    console.error("Admin ad campaign credit update failed.", updateError);
    redirect(adminAdsMessage("Could not apply ad credit. Please try again.", returnTo));
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: "ad_campaign_credit_granted",
    metadata: {
      campaign_type: campaign.campaign_type,
      credit_amount_cents: creditAmountCents,
      from_payment_status: campaign.payment_status,
      goal: campaign.goal,
      reason,
    },
    summary: note || `Manual ad credit granted for ${reason}.`,
    target_id: campaign.id,
    target_type: "ad_campaign",
  });

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

  if (!productId || !merchProductStatuses.has(status)) {
    redirect(adminMerchMessage("Choose a valid merch product status.", returnTo));
  }

  const { supabase, userId } = await requireModerator();
  const { data: product, error: productError } = await supabase
    .from("merch_products")
    .select(
      "id, seller_id, status, title, category, price_cents, currency, fulfillment_notes, is_official, return_policy, shipping_required, ships_from_city, ships_from_region, profiles:profiles!merch_products_seller_id_fkey(account_type, license_verified_at)",
    )
    .eq("id", productId)
    .maybeSingle<{
      category: string;
      currency: string;
      fulfillment_notes: string | null;
      id: string;
      is_official: boolean;
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
      console.error("Admin Merch product lookup failed.", productError);
    }
    redirect(
      adminMerchMessage(
        "Merch product was not found.",
        returnTo,
      ),
    );
  }

  if (
    (status === "approved" || status === "active") &&
    !product.is_official &&
    !(
      product.profiles?.license_verified_at &&
      verificationEligibleAccountTypes.has(product.profiles.account_type)
    )
  ) {
    redirect(
      adminMerchMessage(
        "This seller must be artist, studio, or vendor license verified before Merch can be approved or activated.",
        returnTo,
      ),
    );
  }

  const missingMerchReviewDetails =
    status === "active" &&
    (!product.return_policy ||
      (product.shipping_required &&
        (!product.ships_from_city ||
          !product.ships_from_region ||
          !product.fulfillment_notes)));

  if (missingMerchReviewDetails) {
    redirect(
      adminMerchMessage(
        "Merch needs ship-from, fulfillment, and return/refund details before checkout can be activated.",
        returnTo,
      ),
    );
  }

  if (status === "active" && !product.is_official) {
    const payoutMode = stripeCheckoutPreflight();

    if (!payoutMode.ready) {
      redirect(
        adminMerchMessage(
          "This seller must finish payout setup before Merch checkout can be activated.",
          returnTo,
        ),
      );
    }

    const { data: payoutAccount, error: payoutError } = await supabase
      .from("stripe_connect_accounts")
      .select("livemode, charges_enabled, payouts_enabled, details_submitted")
      .eq("profile_id", product.seller_id)
      .eq("livemode", payoutMode.actual)
      .maybeSingle<{
        charges_enabled: boolean;
        details_submitted: boolean;
        livemode: boolean;
        payouts_enabled: boolean;
      }>();

    const payoutReady =
      payoutAccount?.livemode === payoutMode.actual &&
      Boolean(payoutAccount.charges_enabled) &&
      Boolean(payoutAccount?.payouts_enabled) &&
      Boolean(payoutAccount?.details_submitted);

    if (payoutError || !payoutReady) {
      redirect(
        adminMerchMessage(
          "This seller must finish payout setup before Merch checkout can be activated.",
          returnTo,
        ),
      );
    }
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("merch_products")
    .update({
      reviewed_at: now,
      reviewed_by: userId,
      reviewer_note: note || null,
      status,
      updated_at: now,
    })
    .eq("id", productId);

  if (updateError) {
    console.error("Admin Merch product update failed.", updateError);
    redirect(
      adminMerchMessage(
        "Could not update Merch product. Please try again.",
        returnTo,
      ),
    );
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: `merch_product_${status}`,
    metadata: {
      category: product.category,
      currency: product.currency,
      from_status: product.status,
      price_cents: product.price_cents,
      to_status: status,
    },
    summary: note || null,
    target_id: product.id,
    target_type: "merch_product",
  });

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

  if (!orderId || !merchOrderAdminStatuses.has(status)) {
    redirect(adminMerchMessage("Choose a valid merch order and status.", returnTo));
  }

  const { supabase, userId } = await requireModerator();
  const inventoryAdmin = status === "cancelled" ? createAdminClient() : null;

  if (status === "cancelled" && !inventoryAdmin) {
    console.error("Admin Merch inventory release client is unavailable.");
    redirect(
      adminMerchMessage(
        "Could not prepare the inventory update. Please try again.",
        returnTo,
      ),
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("merch_orders")
    .select("id, status, buyer_id, total_cents, currency")
    .eq("id", orderId)
    .maybeSingle<{
      buyer_id: string;
      currency: string;
      id: string;
      status: string;
      total_cents: number;
    }>();

  if (orderError || !order) {
    if (orderError) {
      console.error("Admin Merch order lookup failed.", orderError);
    }
    redirect(
      adminMerchMessage(
        "Merch order was not found.",
        returnTo,
      ),
    );
  }

  if (status === "fulfilled" && order.status !== "paid") {
    redirect(adminMerchMessage("Only paid orders can be fulfilled.", returnTo));
  }

  if (
    status === "cancelled" &&
    !["pending_checkout", "payment_failed"].includes(order.status)
  ) {
    redirect(
      adminMerchMessage(
        order.status === "cancelled"
          ? "This order is already cancelled."
          : "Only pending or failed orders can be cancelled here. Refund paid orders in the payment review tools first.",
        returnTo,
      ),
    );
  }

  const now = new Date().toISOString();
  if (status === "fulfilled") {
    const { error: updateError } = await supabase
      .from("merch_orders")
      .update({
        admin_note: note || null,
        fulfilled_at: now,
        status,
        updated_at: now,
      })
      .eq("id", orderId)
      .eq("status", "paid");

    if (updateError) {
      console.error("Admin Merch order update failed.", updateError);
      redirect(
        adminMerchMessage(
          "Could not update Merch order. Please try again.",
          returnTo,
        ),
      );
    }

    const { error: itemError } = await supabase
      .from("merch_order_items")
      .update({
        fulfillment_status: "fulfilled",
      })
      .eq("order_id", orderId);

    if (itemError) {
      console.error("Admin Merch order item fulfillment update failed.", itemError);
      redirect(
        adminMerchMessage(
          "Order changed, but line-item fulfillment status failed. Please try again.",
          returnTo,
        ),
      );
    }
  }

  if (status === "cancelled") {
    const orderCancellationClient = inventoryAdmin;

    if (!orderCancellationClient) {
      throw new Error("Order cancellation client was not prepared.");
    }

    const { data: cancelledOrders, error: cancellationError } =
      await orderCancellationClient
        .rpc("cancel_unpaid_merch_order", {
          p_admin_note: note || null,
          p_order_id: orderId,
        });

    if (cancellationError) {
      console.error("Admin Merch order cancellation failed.", cancellationError);
      redirect(
        adminMerchMessage(
          "Could not cancel Merch order. Please try again.",
          returnTo,
        ),
      );
    }

    if (!Array.isArray(cancelledOrders) || cancelledOrders.length === 0) {
      redirect(
        adminMerchMessage(
          "This order is no longer eligible for cancellation.",
          returnTo,
        ),
      );
    }
  }

  const { data: orderItems } = await supabase
    .from("merch_order_items")
    .select("product_id")
    .eq("order_id", orderId)
    .returns<MerchOrderProductRow[]>();
  const productIds = new Set(
    (orderItems ?? []).map((item) => item.product_id).filter(Boolean),
  );

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: `merch_order_${status}`,
    metadata: {
      currency: order.currency,
      from_status: order.status,
      to_status: status,
      total_cents: order.total_cents,
    },
    summary: note || null,
    target_id: order.id,
    target_type: "merch_order",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/merch");
  revalidatePath("/account");
  for (const productId of productIds) {
    revalidatePath(`/merch/${productId}`);
  }
  redirect(adminMerchMessage("Merch order updated.", returnTo));
}

export async function updateAccountDeletionRequest(formData: FormData) {
  const requestId = cleanText(formData.get("request_id"), 80);
  const returnTo = cleanText(formData.get("return_to"), 120);
  const status = cleanText(
    formData.get("status"),
    40,
  ) as AccountDeletionStatus;
  const note = cleanText(formData.get("note"), 500);

  if (!requestId || !accountDeletionStatuses.has(status)) {
    redirect(
      adminDataRequestsMessage("Choose a valid account deletion status.", returnTo),
    );
  }

  if ((status === "completed" || status === "rejected") && note.length < 10) {
    redirect(
      adminDataRequestsMessage(
        "Add a clear review note before completing or rejecting the request.",
        returnTo,
      ),
    );
  }

  const { supabase, userId } = await requireModerator();
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
      console.error("Account deletion request lookup failed.", requestError);
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
    console.error("Account deletion request update failed.", updateError);
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

export async function resetStaleBookingDepositCheckouts(formData: FormData) {
  const returnTo = cleanText(formData.get("return_to"), 160);
  const confirm = cleanText(formData.get("confirm"), 20);

  if (confirm !== "reset") {
    redirect(
      adminPaymentsMessage(
        "Confirm stale booking checkout reset before running it.",
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

  if (!adminClient) {
    redirect(adminPaymentsMessage("Private payment tools unavailable.", returnTo));
  }

  const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: resetRows, error } = await adminClient
    .from("booking_requests")
    .update({
      payment_status: "payment_failed",
      status: "accepted",
      stripe_checkout_session_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("status", "deposit_pending")
    .eq("payment_status", "checkout_started")
    .lt("updated_at", staleCutoff)
    .select("id");

  if (error) {
    console.error("Admin stale booking checkout reset failed.", error);
    redirect(
      adminPaymentsMessage(
        "Could not reset stale booking checkouts. Please try again.",
        returnTo,
      ),
    );
  }

  const resetCount = resetRows?.length ?? 0;

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: "reset_stale_booking_deposit_checkouts",
    metadata: {
      reset_count: resetCount,
      stale_before: staleCutoff,
    },
    summary: `Reset ${resetCount} stale booking deposit checkout${resetCount === 1 ? "" : "s"}.`,
    target_id: userId,
    target_type: "payment_ops",
  });

  revalidatePath("/admin/payments");
  revalidatePath("/account");
  revalidatePath("/messages");
  redirect(
    adminPaymentsMessage(
      `Reset ${resetCount} stale booking deposit checkout${resetCount === 1 ? "" : "s"}.`,
      returnTo,
    ),
  );
}

export async function refundBookingDeposit(formData: FormData) {
  const returnTo = cleanText(formData.get("return_to"), 160);
  const bookingId = cleanText(formData.get("booking_id"), 80);
  const confirm = cleanText(formData.get("confirm"), 20).toLowerCase();

  if (!bookingId) {
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

  if (!adminClient || !stripe) {
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
      console.error("Admin booking deposit lookup failed.", error);
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
    console.error(
      "Admin booking deposit refund audit lookup failed.",
      refundAuditLookupError,
    );
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

  try {
    const refunds = await stripe.refunds.list({
      limit: 100,
      payment_intent: paymentIntentId,
    });
    matchingRefund = refunds.data.find(
      (refund) =>
        refund.metadata?.booking_request_id === booking.id &&
        refund.metadata?.refund_kind === "booking_deposit",
    );
  } catch (error) {
    console.error("Admin booking deposit refund history lookup failed.", error);
    redirect(
      adminPaymentsMessage(
        "Could not confirm booking refund history. No new refund was requested. Please try again.",
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
    } catch (error) {
      console.error("Admin booking deposit refund request failed.", error);
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
      summary: `Requested full booking deposit refund for ${booking.title}.`,
      target_id: booking.id,
      target_type: "booking_request",
    });

  if (refundAuditError) {
    console.error(
      "Admin booking deposit refund audit record failed.",
      refundAuditError,
    );
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
