import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import {
  moderateContent,
  recordReportFollowup,
  updateReportStatus,
} from "../actions";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type ReportItem = {
  createdAt: string;
  details: string | null;
  id: string;
  reason: string;
  reporterUsername: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  subjectId: string;
  subjectOwnerUsername: string | null;
  subjectPreview: string | null;
  subjectTitle: string | null;
  subjectType: string;
};
type ReportSubjectPreview = {
  ownerUsername: string | null;
  preview: string | null;
  title: string | null;
};

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const reportModerationSubjectTypes = new Set<string>([
  "feed_post",
  "gig",
  "thread_post",
  "marketplace_listing",
  "merch_product",
]);

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Reports",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number) {
  return `/admin/reports?page=${page}`;
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function shortId(value: string | null) {
  return value ? value.slice(0, 8) : null;
}

function reportSubjectKey(type: string, id: string) {
  return `${type}:${id}`;
}

function canModerateReportedSubject(subjectType: string) {
  return reportModerationSubjectTypes.has(subjectType);
}

function reportReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    "body-art nudity context": "Legacy sensitive body-art context",
    "harassment or hate": "Harassment, hate, or threats",
    "illegal goods or services": "Illegal goods or services",
    "minor safety concern": "Minor safety concern",
    other: "Other policy concern",
    "scam or spam": "Scam, spam, or impersonation",
    "sensitive non-nude body-art": "Sensitive non-nude body-art context",
    "sexual content": "Sexual or pornographic content",
    "unsafe practice": "Unsafe tattoo/body-art practice",
  };

  return labels[reason] ?? reason;
}

function reportReasonClass(reason: string) {
  if (
    reason === "minor safety concern" ||
    reason === "sexual content" ||
    reason === "illegal goods or services"
  ) {
    return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";
  }

  if (reason === "unsafe practice" || reason === "harassment or hate") {
    return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
  }

  return "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[var(--muted)]";
}

function reportStatusClass(status: ReportItem["status"]) {
  if (status === "open") return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
  if (status === "reviewing") return "border-[color-mix(in_srgb,#5078c8_35%,var(--card-rim))] bg-[color-mix(in_srgb,#5078c8_10%,var(--paper-warm))] text-[color-mix(in_srgb,#284f8a_78%,var(--foreground))]";
  if (status === "resolved") return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";

  return "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[var(--muted)]";
}

function isPriorityReport(reason: string) {
  return [
    "harassment or hate",
    "illegal goods or services",
    "minor safety concern",
    "sexual content",
    "unsafe practice",
  ].includes(reason);
}

function Pagination({
  currentPage,
  hasNextPage,
  totalPages,
}: {
  currentPage: number;
  hasNextPage: boolean;
  totalPages: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[var(--muted)]">
        Page {currentPage} of {Math.max(totalPages, 1)}
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={currentPage <= 1}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            currentPage <= 1
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
          }`}
          href={pageHref(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="size-4" />
          Previous 50
        </Link>
        <Link
          aria-disabled={!hasNextPage}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            !hasNextPage
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
          }`}
          href={pageHref(currentPage + 1)}
        >
          Next 50
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function ReportCard({
  currentPage,
  report,
}: {
  currentPage: number;
  report: ReportItem;
}) {
  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${reportReasonClass(
                report.reason,
              )}`}
            >
              {reportReasonLabel(report.reason)}
            </span>
            <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1 text-xs font-semibold capitalize text-[var(--muted-strong)]">
              {report.subjectType.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            Reported by @{report.reporterUsername} - {timeAgo(report.createdAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold capitalize ${reportStatusClass(
            report.status,
          )}`}
        >
          {report.status}
        </span>
      </div>
      {report.subjectTitle || report.subjectPreview ? (
        <div className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Reported item
          </p>
          {report.subjectTitle ? (
            <p className="mt-1 text-sm font-semibold">{report.subjectTitle}</p>
          ) : null}
          {report.subjectOwnerUsername ? (
            <p className="mt-1 text-xs text-[var(--muted-strong)]">
              Owner @{report.subjectOwnerUsername}
            </p>
          ) : null}
          {report.subjectPreview ? (
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-[var(--muted)]">
              {report.subjectPreview}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted-strong)]">
        <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1">
          Report {shortId(report.id)}
        </span>
        <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1">
          Item {shortId(report.subjectId)}
        </span>
      </div>
      {report.details ? (
        <div className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Reporter details
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {report.details}
          </p>
        </div>
      ) : null}
      {canModerateReportedSubject(report.subjectType) ? (
        <form action={moderateContent} className="mt-4 space-y-2">
          <input name="report_id" type="hidden" value={report.id} />
          <input name="return_to" type="hidden" value={pageHref(currentPage)} />
          <input name="subject_id" type="hidden" value={report.subjectId} />
          <input name="subject_type" type="hidden" value={report.subjectType} />
          <input
            className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            maxLength={500}
            name="note"
            placeholder="Content action note for audit log"
          />
          <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">
            {[
              ["under_review", "Review"],
              ["hidden", "Hide"],
              ["removed", "Remove"],
              ["active", "Restore"],
            ].map(([value, label]) => (
              <button
                className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)]"
                key={value}
                name="moderation_status"
                value={value}
              >
                {label}
              </button>
            ))}
          </div>
        </form>
      ) : null}
      <form action={updateReportStatus} className="mt-4 space-y-2">
        <input name="report_id" type="hidden" value={report.id} />
        <input name="return_to" type="hidden" value={pageHref(currentPage)} />
        <input
          className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
          maxLength={500}
          name="note"
          placeholder="Report status note"
        />
        <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
          {[
            ["reviewing", "Reviewing"],
            ["resolved", "Resolve"],
            ["dismissed", "Dismiss"],
          ].map(([value, label]) => (
            <button
              className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)]"
              key={value}
              name="status"
              value={value}
            >
              {label}
            </button>
          ))}
        </div>
      </form>
      <form action={recordReportFollowup} className="mt-4 space-y-2">
        <input name="report_id" type="hidden" value={report.id} />
        <input name="return_to" type="hidden" value={pageHref(currentPage)} />
        <input
          className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
          maxLength={500}
          name="note"
          placeholder="Warning or escalation note"
        />
        <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
          {[
            ["warn_member", "Record warning"],
            ["escalate_report", "Escalate"],
          ].map(([value, label]) => (
            <button
              className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)]"
              key={value}
              name="followup_action"
              value={value}
            >
              {label}
            </button>
          ))}
        </div>
      </form>
    </article>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const currentPage = pageNumber(params.page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, role")
    .eq("id", claims.sub)
    .maybeSingle<{ username: string; display_name: string; role: UserRole }>();

  if (!profile || !moderateRoles.includes(profile.role)) {
    redirect("/admin");
  }

  const { count, data: reportRows } = await supabase
    .from("content_reports")
    .select(
      "id, subject_type, subject_id, reason, details, status, created_at, profiles:profiles!content_reports_reporter_id_fkey(display_name, username)",
      { count: "exact" },
    )
    .in("status", ["open", "reviewing", "resolved", "dismissed"])
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      {
        created_at: string;
        details: string | null;
        id: string;
        profiles: { display_name: string; username: string } | null;
        reason: string;
        status: "open" | "reviewing" | "resolved" | "dismissed";
        subject_id: string;
        subject_type: string;
      }[]
    >();
  const reportSubjectPreviews = new Map<string, ReportSubjectPreview>();
  const reportSubjectIds = (type: string) =>
    (reportRows ?? [])
      .filter((report) => report.subject_type === type)
      .map((report) => report.subject_id);

  await Promise.all([
    (async () => {
      const ids = reportSubjectIds("feed_post");
      if (!ids.length) return;
      const { data } = await supabase
        .from("feed_posts")
        .select("id, caption, profiles:profiles!feed_posts_author_id_fkey(username)")
        .in("id", ids)
        .returns<
          { caption: string | null; id: string; profiles: { username: string } | null }[]
        >();
      for (const post of data ?? []) {
        reportSubjectPreviews.set(reportSubjectKey("feed_post", post.id), {
          ownerUsername: post.profiles?.username ?? null,
          preview: post.caption,
          title: "4U post",
        });
      }
    })(),
    (async () => {
      const ids = reportSubjectIds("thread_post");
      if (!ids.length) return;
      const { data } = await supabase
        .from("thread_posts")
        .select("id, body, profiles:profiles!thread_posts_author_id_fkey(username)")
        .in("id", ids)
        .returns<
          { body: string; id: string; profiles: { username: string } | null }[]
        >();
      for (const thread of data ?? []) {
        reportSubjectPreviews.set(reportSubjectKey("thread_post", thread.id), {
          ownerUsername: thread.profiles?.username ?? null,
          preview: thread.body,
          title: "Gossip post",
        });
      }
    })(),
    (async () => {
      const ids = reportSubjectIds("marketplace_listing");
      if (!ids.length) return;
      const { data } = await supabase
        .from("marketplace_listings")
        .select("id, title, description, profiles:profiles!marketplace_listings_seller_id_fkey(username)")
        .in("id", ids)
        .returns<
          {
            description: string | null;
            id: string;
            profiles: { username: string } | null;
            title: string;
          }[]
        >();
      for (const listing of data ?? []) {
        reportSubjectPreviews.set(
          reportSubjectKey("marketplace_listing", listing.id),
          {
            ownerUsername: listing.profiles?.username ?? null,
            preview: listing.description,
            title: listing.title,
          },
        );
      }
    })(),
    (async () => {
      const ids = reportSubjectIds("gig");
      if (!ids.length) return;
      const { data } = await supabase
        .from("gigs")
        .select("id, title, description, profiles:profiles!gigs_poster_id_fkey(username)")
        .in("id", ids)
        .returns<
          {
            description: string | null;
            id: string;
            profiles: { username: string } | null;
            title: string;
          }[]
        >();
      for (const gig of data ?? []) {
        reportSubjectPreviews.set(reportSubjectKey("gig", gig.id), {
          ownerUsername: gig.profiles?.username ?? null,
          preview: gig.description,
          title: gig.title,
        });
      }
    })(),
    (async () => {
      const ids = reportSubjectIds("merch_product");
      if (!ids.length) return;
      const { data } = await supabase
        .from("merch_products")
        .select("id, title, description, profiles:profiles!merch_products_seller_id_fkey(username)")
        .in("id", ids)
        .returns<
          {
            description: string | null;
            id: string;
            profiles: { username: string } | null;
            title: string;
          }[]
        >();
      for (const product of data ?? []) {
        reportSubjectPreviews.set(reportSubjectKey("merch_product", product.id), {
          ownerUsername: product.profiles?.username ?? null,
          preview: product.description,
          title: product.title,
        });
      }
    })(),
    (async () => {
      const ids = reportSubjectIds("profile");
      if (!ids.length) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio")
        .in("id", ids)
        .returns<
          { bio: string | null; display_name: string; id: string; username: string }[]
        >();
      for (const reportedProfile of data ?? []) {
        reportSubjectPreviews.set(reportSubjectKey("profile", reportedProfile.id), {
          ownerUsername: reportedProfile.username,
          preview: reportedProfile.bio,
          title: reportedProfile.display_name,
        });
      }
    })(),
  ]);

  const reports: ReportItem[] = (reportRows ?? []).map((report) => {
    const subjectPreview = reportSubjectPreviews.get(
      reportSubjectKey(report.subject_type, report.subject_id),
    );

    return {
      createdAt: report.created_at,
      details: report.details,
      id: report.id,
      reason: report.reason,
      reporterUsername: report.profiles?.username ?? "member",
      status: report.status,
      subjectId: report.subject_id,
      subjectOwnerUsername: subjectPreview?.ownerUsername ?? null,
      subjectPreview: subjectPreview?.preview ?? null,
      subjectTitle: subjectPreview?.title ?? null,
      subjectType: report.subject_type,
    };
  });
  const totalReports = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalReports / pageSize));
  const hasNextPage = currentPage < totalPages;
  const openReports = reports.filter((report) => report.status === "open");
  const priorityOpenReports = openReports.filter((report) =>
    isPriorityReport(report.reason),
  );
  const reviewingReports = reports.filter((report) => report.status === "reviewing");

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <section className="ttc-page-panel mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-[var(--card-rim)] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to admin dashboard"
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)]"
              href="/admin"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
                Admin
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">Reports</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                50 reports per page with subject previews, status controls, and content moderation actions.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-sm">
            <p className="font-semibold">{profile.display_name}</p>
            <p className="text-xs text-[var(--muted-strong)]">
              @{profile.username} - {profile.role}
            </p>
          </div>
        </header>

        {params.message ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Reports</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalReports)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Priority here</p>
            <p className="mt-2 text-3xl font-bold">{priorityOpenReports.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Open here</p>
            <p className="mt-2 text-3xl font-bold">{openReports.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">In review here</p>
            <p className="mt-2 text-3xl font-bold">{reviewingReports.length}</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm leading-6 text-[var(--muted)]">
          <Flag className="mt-1 size-5 shrink-0 text-[var(--gold)]" />
          <p>
            Review red reports first, move valid reports into Reviewing, and use
            content actions for reportable 4U, Gossip, Stuff, and Gigs subjects.
            Use warning or escalation follow-ups for audit-only handling when a
            report needs more context before content is hidden or removed.
          </p>
        </div>

        <Pagination
          currentPage={currentPage}
          hasNextPage={hasNextPage}
          totalPages={totalPages}
        />

        {reports.length ? (
          <section className="mt-4 grid gap-4">
            {reports.map((report) => (
              <ReportCard
                currentPage={currentPage}
                key={report.id}
                report={report}
              />
            ))}
          </section>
        ) : (
          <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
            No reports are in this queue yet.
          </p>
        )}

        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            totalPages={totalPages}
          />
        </div>
      </section>
    </main>
  );
}
