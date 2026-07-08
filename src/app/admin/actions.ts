"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type SubjectType = "feed_post" | "gig" | "thread_post" | "marketplace_listing";
type ModerationStatus = "active" | "under_review" | "hidden" | "removed";
type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
type LicenseVerificationStatus = "approved" | "rejected";

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
const licenseStatuses = new Set<LicenseVerificationStatus>([
  "approved",
  "rejected",
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

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
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

export async function moderateContent(formData: FormData) {
  const subjectType = cleanText(formData.get("subject_type"), 40) as SubjectType;
  const subjectId = cleanText(formData.get("subject_id"), 80);
  const moderationStatus = cleanText(
    formData.get("moderation_status"),
    40,
  ) as ModerationStatus;
  const note = cleanText(formData.get("note"), 500);
  const config = subjectConfig[subjectType];

  if (!config || !subjectId || !statuses.has(moderationStatus)) {
    redirect(adminMessage("Choose valid content and moderation status."));
  }

  const { supabase, userId } = await requireModerator();

  const { data: subject, error: subjectError } = await supabase
    .from(config.table)
    .select(config.ownerColumn)
    .eq(config.idColumn, subjectId)
    .maybeSingle<Record<string, string | null>>();

  if (subjectError || !subject) {
    redirect(adminMessage(subjectError?.message || "Content was not found."));
  }

  const { error: updateError } = await supabase
    .from(config.table)
    .update({
      moderation_status: moderationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq(config.idColumn, subjectId);

  if (updateError) {
    redirect(adminMessage(updateError.message || "Could not update content."));
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
      adminMessage(
        actionError.message || "Content changed, but moderation log failed.",
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/");
  redirect(adminMessage("Moderation status updated."));
}

export async function updateReportStatus(formData: FormData) {
  const reportId = cleanText(formData.get("report_id"), 80);
  const status = cleanText(formData.get("status"), 40) as ReportStatus;
  const note = cleanText(formData.get("note"), 500);

  if (!reportId || !reportStatuses.has(status)) {
    redirect("/admin?message=Choose a valid report status.#reports");
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
      `/admin?message=${encodeURIComponent(
        reportError?.message || "Report was not found.",
      )}#reports`,
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
      `/admin?message=${encodeURIComponent(
        updateError.message || "Could not update report.",
      )}#reports`,
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
        `/admin?message=${encodeURIComponent(
          actionError.message || "Report changed, but log failed.",
        )}#reports`,
      );
    }
  }

  revalidatePath("/admin");
  redirect("/admin?message=Report status updated.#reports");
}

export async function updateLicenseVerification(formData: FormData) {
  const requestId = cleanText(formData.get("request_id"), 80);
  const status = cleanText(
    formData.get("status"),
    40,
  ) as LicenseVerificationStatus;
  const note = cleanText(formData.get("note"), 500);

  if (!requestId || !licenseStatuses.has(status)) {
    redirect("/admin?message=Choose a valid license decision.#verification");
  }

  const { supabase, userId } = await requireModerator();
  const { data: request, error: requestError } = await supabase
    .from("license_verification_requests")
    .select("id, profile_id, status")
    .eq("id", requestId)
    .maybeSingle<{ id: string; profile_id: string; status: string }>();

  if (requestError || !request) {
    redirect(
      `/admin?message=${encodeURIComponent(
        requestError?.message || "License request was not found.",
      )}#verification`,
    );
  }

  if (request.status !== "pending") {
    redirect("/admin?message=This license request was already reviewed.#verification");
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
      `/admin?message=${encodeURIComponent(
        updateError.message || "Could not update license request.",
      )}#verification`,
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
        `/admin?message=${encodeURIComponent(
          profileError.message || "License approved, but profile badge failed.",
        )}#verification`,
      );
    }
  }

  await supabase.from("admin_audit_logs").insert({
    actor_id: userId,
    event_type: `license_${status}`,
    metadata: { status },
    summary: note || null,
    target_id: request.id,
    target_type: "license_verification_request",
  });

  revalidatePath("/admin");
  revalidatePath("/account");
  redirect("/admin?message=License verification updated.#verification");
}
