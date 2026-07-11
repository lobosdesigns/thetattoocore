import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { moderateContent, updateReportStatus } from "../actions";
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
    return "border-[#e5b8b8] bg-[#fff0f0] text-[#8a2828]";
  }

  if (reason === "unsafe practice" || reason === "harassment or hate") {
    return "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]";
  }

  return "border-[#d8d1c6] bg-[#f7f4ef] text-[#4f473f]";
}

function reportStatusClass(status: ReportItem["status"]) {
  if (status === "open") return "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]";
  if (status === "reviewing") return "border-[#b7c6e8] bg-[#eef3ff] text-[#284f8a]";
  if (status === "resolved") return "border-[#b9d7bd] bg-[#eef8ef] text-[#276231]";

  return "border-[#d8d1c6] bg-[#f7f4ef] text-[#4f473f]";
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
    <div className="flex flex-col gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[#4f473f]">
        Page {currentPage} of {Math.max(totalPages, 1)}
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={currentPage <= 1}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            currentPage <= 1
              ? "pointer-events-none border-[#e5ded4] bg-[#f7f4ef] text-[#a69b8d]"
              : "border-[#cfc8bd] bg-white text-[#171412]"
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
              ? "pointer-events-none border-[#e5ded4] bg-[#f7f4ef] text-[#a69b8d]"
              : "border-[#171412] bg-[#171412] text-white"
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
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
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
            <span className="rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold capitalize text-[#766d62]">
              {report.subjectType.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#766d62]">
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
        <div className="mt-3 rounded-md border border-[#e5ded4] bg-white p-3">
          <p className="text-xs font-semibold uppercase text-[#766d62]">
            Reported item
          </p>
          {report.subjectTitle ? (
            <p className="mt-1 text-sm font-semibold">{report.subjectTitle}</p>
          ) : null}
          {report.subjectOwnerUsername ? (
            <p className="mt-1 text-xs text-[#766d62]">
              Owner @{report.subjectOwnerUsername}
            </p>
          ) : null}
          {report.subjectPreview ? (
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-[#4f473f]">
              {report.subjectPreview}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#766d62]">
        <span className="rounded-md bg-white px-2 py-1">
          Report {shortId(report.id)}
        </span>
        <span className="rounded-md bg-white px-2 py-1">
          Item {shortId(report.subjectId)}
        </span>
      </div>
      {report.details ? (
        <div className="mt-3 rounded-md border border-[#e5ded4] bg-white p-3">
          <p className="text-xs font-semibold uppercase text-[#766d62]">
            Reporter details
          </p>
          <p className="mt-1 text-sm leading-6 text-[#4f473f]">
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
            className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
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
          className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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
              className="h-10 rounded-md border border-[#d8d1c6] bg-white px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
              key={value}
              name="status"
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
        <header className="mb-6 flex flex-col gap-4 border-b border-[#cfc8bd] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to admin dashboard"
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
              href="/admin"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#766d62]">
                Admin
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">Reports</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                50 reports per page with subject previews, status controls, and content moderation actions.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 py-2 text-sm">
            <p className="font-semibold">{profile.display_name}</p>
            <p className="text-xs text-[#766d62]">
              @{profile.username} - {profile.role}
            </p>
          </div>
        </header>

        {params.message ? (
          <p className="mb-4 rounded-md border border-[#cfc8bd] bg-[#e8e4dc] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Reports</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalReports)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Priority here</p>
            <p className="mt-2 text-3xl font-bold">{priorityOpenReports.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Open here</p>
            <p className="mt-2 text-3xl font-bold">{openReports.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">In review here</p>
            <p className="mt-2 text-3xl font-bold">{reviewingReports.length}</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3 text-sm leading-6 text-[#4f473f]">
          <Flag className="mt-1 size-5 shrink-0 text-[#c8953b]" />
          <p>
            Review red reports first, move valid reports into Reviewing, and use
            content actions for reportable 4U, Gossip, Stuff, and Gigs subjects.
            Keep notes specific enough for the moderation audit log.
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
          <p className="mt-4 rounded-md border border-[#e5ded4] bg-[#fffdf9] p-4 text-sm text-[#4f473f]">
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
