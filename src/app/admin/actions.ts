"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type SubjectType = "feed_post" | "thread_post" | "marketplace_listing";
type ModerationStatus = "active" | "under_review" | "hidden" | "removed";
type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

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

const subjectConfig = {
  feed_post: {
    idColumn: "id",
    ownerColumn: "author_id",
    table: "feed_posts",
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
