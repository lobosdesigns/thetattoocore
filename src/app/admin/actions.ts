"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendHostgatorEmail } from "@/lib/mail/hostgator";
import { siteName, siteUrl, supportEmail } from "@/lib/site";
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

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
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
      "Your verification was rejected. Open Account to review the note and submit updated proof.";

  try {
    await sendHostgatorEmail({
      headers: {
        "X-TheTattooCore-Transactional": `verification-${status}`,
      },
      html: [
        `<h1>${escapeHtml(subject)}</h1>`,
        `<p>Hi ${escapeHtml(displayName)},</p>`,
        `<p>${escapeHtml(body)}</p>`,
        `<p>You can review verification status from <a href="${accountUrl}">Account &gt; Verification</a>.</p>`,
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
    redirect(
      adminUsersMessage(
        targetError?.message || "Profile was not found.",
        returnTo,
      ),
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) {
    redirect(
      adminUsersMessage(updateError.message || "Could not update role.", returnTo),
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
    .select("id, banned_at, suspended_at")
    .eq("id", profileId)
    .maybeSingle<{
      banned_at: string | null;
      id: string;
      suspended_at: string | null;
    }>();

  if (targetError || !target) {
    redirect(
      adminUsersMessage(
        targetError?.message || "Profile was not found.",
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
    redirect(
      adminUsersMessage(
        updateError.message || "Could not update user status.",
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
    redirect(
      adminUsersMessage(
        createError?.message || "Could not create tester account.",
        returnTo,
      ),
    );
  }

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({
      account_type: accountType,
      display_name: displayName,
      username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) {
    await adminClient.auth.admin.deleteUser(profileId);
    redirect(
      adminUsersMessage(
        updateError.message || "Created auth user, but profile setup failed.",
        returnTo,
      ),
    );
  }

  await supabase.from("admin_audit_logs").insert({
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

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect(adminUsersMessage(`Tester @${username} created.`, returnTo));
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
      redirect(
        adminReportsMessage(
          reportError?.message || "Linked report was not found.",
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
    redirect(
      adminContentMessage(
        subjectError?.message || "Content was not found.",
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
    redirect(
      adminContentMessage(
        updateError.message || "Could not update content.",
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
    redirect(
      adminContentMessage(
        actionError.message || "Content changed, but moderation log failed.",
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
      redirect(
        adminReportsMessage(
          reportUpdateError.message ||
            "Content changed, but the report status did not update.",
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
        redirect(
          adminReportsMessage(
            reportActionError.message ||
              "Content and report changed, but report log failed.",
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
    redirect(
      adminReportsMessage(
        reportError?.message || "Report was not found.",
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
    redirect(
      adminReportsMessage(
        updateError.message || "Could not update report.",
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
      redirect(
        adminReportsMessage(
          actionError.message || "Report changed, but log failed.",
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
    redirect(
      adminReportsMessage(
        reportError?.message || "Report was not found.",
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
    redirect(
      adminReportsMessage(
        actionError.message || "Could not record report follow-up.",
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
      redirect(
        adminReportsMessage(
          updateError.message ||
            "Follow-up was logged, but report status did not update.",
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
    redirect(
      adminVerificationMessage(
        requestError?.message || "License request was not found.",
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
    redirect(
      adminVerificationMessage(
        updateError.message || "Could not update license request.",
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
      redirect(
        adminVerificationMessage(
          profileError.message || "License approved, but profile badge failed.",
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
        "Your verification was rejected. Open Account to review the note and submit updated proof.";
  const { error: notificationError } = await supabase.from("notifications").insert({
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
    redirect(
      adminVerificationMessage(
        notificationError.message ||
          "License updated, but member notification failed.",
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
    .select("id, advertiser_id, status, payment_status, campaign_type, goal")
    .eq("id", campaignId)
    .maybeSingle<{
      advertiser_id: string;
      campaign_type: string;
      goal: string;
      id: string;
      payment_status: string;
      status: string;
    }>();

  if (campaignError || !campaign) {
    redirect(
      adminAdsMessage(
        campaignError?.message || "Ad campaign was not found.",
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
    redirect(
      adminAdsMessage(
        updateError.message || "Could not update ad campaign.",
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
      "id, seller_id, status, title, category, price_cents, currency, is_official, profiles:profiles!merch_products_seller_id_fkey(account_type, license_verified_at)",
    )
    .eq("id", productId)
    .maybeSingle<{
      category: string;
      currency: string;
      id: string;
      is_official: boolean;
      price_cents: number;
      profiles: { account_type: string; license_verified_at: string | null } | null;
      seller_id: string;
      status: string;
      title: string;
    }>();

  if (productError || !product) {
    redirect(
      adminMerchMessage(
        productError?.message || "Merch product was not found.",
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
    redirect(
      adminMerchMessage(
        updateError.message || "Could not update merch product.",
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
    redirect(
      adminMerchMessage(
        orderError?.message || "Merch order was not found.",
        returnTo,
      ),
    );
  }

  if (status === "fulfilled" && order.status !== "paid") {
    redirect(adminMerchMessage("Only paid orders can be fulfilled.", returnTo));
  }

  if (
    status === "cancelled" &&
    !["pending_checkout", "payment_failed", "cancelled"].includes(order.status)
  ) {
    redirect(
      adminMerchMessage(
        "Only pending, failed, or already-cancelled orders can be cancelled here. Refund paid orders in the payment dashboard first.",
        returnTo,
      ),
    );
  }

  const now = new Date().toISOString();
  const updateValues =
    status === "fulfilled"
      ? {
          admin_note: note || null,
          fulfilled_at: now,
          status,
          updated_at: now,
        }
      : {
          admin_note: note || null,
          cancelled_at: now,
          status,
          updated_at: now,
        };
  const { error: updateError } = await supabase
    .from("merch_orders")
    .update(updateValues)
    .eq("id", orderId);

  if (updateError) {
    redirect(
      adminMerchMessage(
        updateError.message || "Could not update merch order.",
        returnTo,
      ),
    );
  }

  if (status === "fulfilled" || status === "cancelled") {
    const { error: itemError } = await supabase
      .from("merch_order_items")
      .update({
        fulfillment_status:
          status === "fulfilled" ? "fulfilled" : "cancelled",
      })
      .eq("order_id", orderId);

    if (itemError) {
      redirect(
        adminMerchMessage(
          itemError.message ||
            "Order changed, but line-item fulfillment status failed.",
          returnTo,
        ),
      );
    }
  }

  if (status === "cancelled") {
    const { error: releaseError } = await supabase.rpc(
      "release_merch_inventory_for_order",
      { p_order_id: orderId },
    );

    if (releaseError) {
      redirect(
        adminMerchMessage(
          releaseError.message ||
            "Order changed, but inventory reservation release failed.",
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
    redirect(
      adminDataRequestsMessage(
        requestError?.message || "Account deletion request was not found.",
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
    redirect(
      adminDataRequestsMessage(
        updateError.message || "Could not update account deletion request.",
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
