import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  BriefcaseBusiness,
  Flag,
  Gavel,
  ImageIcon,
  Mail,
  Megaphone,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";
import {
  changeUserRole,
  changeUserStatus,
  moderateContent,
  updateAdCampaignStatus,
  updateAccountDeletionRequest,
  updateLicenseVerification,
  updateReportStatus,
} from "./actions";
import { MailTestForm } from "./mail-test-form";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type ModerationStatus = "active" | "under_review" | "hidden" | "removed";
type Claims = {
  sub: string;
  email?: string;
};
type ReviewItem = {
  id: string;
  title: string;
  body: string | null;
  authorName: string;
  authorUsername: string;
  createdAt: string;
  isSensitive: boolean;
  sensitiveReason: string | null;
  status: ModerationStatus;
  subjectType: "feed_post" | "gig" | "thread_post" | "marketplace_listing";
  visibility: "public_preview" | "members" | "private";
};
type ReportItem = {
  id: string;
  createdAt: string;
  details: string | null;
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
type LicenseRequest = {
  accountType: string;
  createdAt: string;
  documentName: string;
  expiresOn: string | null;
  id: string;
  issuingRegion: string;
  licenseName: string;
  licenseNumber: string | null;
  profileName: string;
  profileUsername: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  status: "pending" | "approved" | "rejected";
  storageBucket: string;
  signedDocumentUrl: string | null;
};
type AccountDeletionRequest = {
  id: string;
  profileName: string;
  profileUsername: string;
  reason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  status: "pending" | "reviewing" | "completed" | "rejected" | "cancelled";
};
type AdminUser = {
  accountType: string;
  bannedAt: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  moderationNote: string | null;
  role: UserRole;
  suspendedAt: string | null;
  username: string;
};
type AuditItem = {
  actorUsername: string;
  createdAt: string;
  context: string | null;
  id: string;
  kind: "audit" | "moderation";
  label: string;
  note: string | null;
};
type ActivityMetadata = Record<string, unknown>;
type AdCampaign = {
  advertiserName: string;
  advertiserUsername: string;
  bidCents: number;
  body: string | null;
  campaignType: "artist_growth" | "stuff_listing";
  city: string | null;
  countryCode: string | null;
  createdAt: string;
  dailyBudgetCents: number;
  endsAt: string | null;
  goal:
    | "leads"
    | "messages"
    | "engagement"
    | "listing_views"
    | "seller_messages"
    | "marketplace_engagement";
  id: string;
  keywords: string[];
  language: string | null;
  name: string;
  placements: ("4u" | "gossip" | "stuff")[];
  region: string | null;
  reviewerNote: string | null;
  startsAt: string | null;
  status:
    | "draft"
    | "pending_review"
    | "approved"
    | "active"
    | "paused"
    | "rejected"
    | "archived";
  targetUrl: string | null;
  title: string;
  clicks: number;
  impressions: number;
};

const adminTabs = [
  [Activity, "Overview", "/admin#overview"],
  [Users, "Users", "/admin/users"],
  [ShieldCheck, "Verification", "/admin/verification"],
  [Trash2, "Data Requests", "/admin/data-requests"],
  [Flag, "Reports", "/admin/reports"],
  [ImageIcon, "Content", "/admin/content"],
  [ImageIcon, "Media Ops", "/admin/media-ops"],
  [BriefcaseBusiness, "Gigs", "/admin/gigs"],
  [ShoppingBag, "Stuff", "/admin/stuff"],
  [Megaphone, "Ads", "/admin/ads"],
  [Mail, "Mail Settings", "/admin/mail-settings"],
] as const;

const mediaOpsStages = [
  [
    "Live now",
    "Browser WebP image optimization, saved-size feedback, server signature checks, dimension checks, and 60-second MP4/MOV/WebM reel validation.",
  ],
  [
    "Next",
    "Store generated thumbnails and poster images so feeds, search, profiles, and share previews can load lighter media without exposing originals.",
  ],
  [
    "Scale trigger",
    "Move active reels to Cloudflare Stream when video usage justifies paid transcoding, adaptive playback, and managed thumbnails.",
  ],
  [
    "Later",
    "Add a retryable processing queue for video transcodes, moderation thumbnails, failed media jobs, and post-upload safety review.",
  ],
] as const;

const mediaCostRules = [
  "Keep original media in Supabase Storage while early traffic is small.",
  "Use client-side image compression first because it is free and reduces storage before upload.",
  "Keep current reel caps strict: 60 seconds and 50 MB while videos are uploaded raw.",
  "Do not enable paid video transcoding until reels are getting enough real usage to justify it.",
  "Consider Cloudflare Images for image variants and Cloudflare Stream for video only after upload volume grows.",
] as const;

const licenseReviewChecklist = [
  "Confirm the account is an artist, studio, or vendor before approval.",
  "Match the document to the profile name, shop, or vendor business.",
  "Reject expired documents and ask the member to resubmit current proof.",
  "Do not approve scratcher activity, unlicensed studios, AI tattoo art claims, or restricted equipment access for unqualified buyers.",
] as const;

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin",
};

function formatCount(value: number | null) {
  return value == null ? "0" : Intl.NumberFormat("en-US").format(value);
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not provided";
}

function statusLabel(status: ModerationStatus) {
  return status.replace("_", " ");
}

function licenseStatusClass(status: LicenseRequest["status"]) {
  if (status === "approved") return "border-[#b9d7bd] bg-[#eef8ef] text-[#276231]";
  if (status === "rejected") return "border-[#e5b8b8] bg-[#fff0f0] text-[#8a2828]";

  return "border-[#d8d1c6] bg-[#f7f4ef] text-[#4f473f]";
}

function accountDeletionStatusClass(status: AccountDeletionRequest["status"]) {
  if (status === "completed") {
    return "border-[#b9d7bd] bg-[#eef8ef] text-[#276231]";
  }
  if (status === "rejected" || status === "cancelled") {
    return "border-[#e5b8b8] bg-[#fff0f0] text-[#8a2828]";
  }
  if (status === "reviewing") {
    return "border-[#b7c6e8] bg-[#eef3ff] text-[#284f8a]";
  }

  return "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]";
}

function fileNameFromPath(path: string) {
  const name = path.split("/").filter(Boolean).at(-1);
  return name || "License document";
}

function isExpiredDate(value: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);

  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

function userStatus(user: Pick<AdminUser, "bannedAt" | "suspendedAt">) {
  if (user.bannedAt) return "banned";
  if (user.suspendedAt) return "suspended";

  return "active";
}

function activityLabel(value: string) {
  return value.replaceAll("_", " ");
}

function activitySubject(value: string | null) {
  return value ? activityLabel(value) : null;
}

function shortId(value: string | null) {
  return value ? value.slice(0, 8) : null;
}

function textMetadata(metadata: ActivityMetadata | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function moderationActivityLabel(
  actionType: string,
  metadata: ActivityMetadata | null,
) {
  const moderationStatus = textMetadata(metadata, "moderation_status");
  const reportStatus = textMetadata(metadata, "report_status");

  if (reportStatus === "resolved" && moderationStatus) {
    if (moderationStatus === "hidden") return "Resolved report and hid content";
    if (moderationStatus === "removed") {
      return "Resolved report and removed content";
    }
    if (moderationStatus === "active") {
      return "Resolved report and restored content";
    }
  }

  if (actionType === "hide_content") return "Hid content";
  if (actionType === "remove_content") return "Removed content";
  if (actionType === "restore_content") return "Restored content";
  if (actionType === "suspend_user") return "Suspended user";
  if (actionType === "ban_user") return "Banned user";
  if (actionType === "resolve_report") return "Resolved report";
  if (actionType === "dismiss_report") return "Dismissed report";

  return activityLabel(actionType);
}

function auditActivityLabel(eventType: string, metadata: ActivityMetadata | null) {
  if (eventType === "profile_role_changed") {
    const fromRole = textMetadata(metadata, "from_role");
    const toRole = textMetadata(metadata, "to_role");

    return fromRole && toRole
      ? `Changed role from ${fromRole} to ${toRole}`
      : "Changed user role";
  }

  if (eventType === "license_approved") return "Approved artist verification";
  if (eventType === "license_rejected") return "Rejected artist verification";
  if (eventType === "ad_campaign_approved") return "Approved ad campaign";
  if (eventType === "ad_campaign_active") return "Activated ad campaign";
  if (eventType === "ad_campaign_paused") return "Paused ad campaign";
  if (eventType === "ad_campaign_rejected") return "Rejected ad campaign";
  if (eventType === "ad_campaign_archived") return "Archived ad campaign";
  if (eventType === "account_deletion_reviewing") {
    return "Started account deletion review";
  }
  if (eventType === "account_deletion_completed") {
    return "Completed account deletion request";
  }
  if (eventType === "account_deletion_rejected") {
    return "Rejected account deletion request";
  }
  if (eventType === "account_deletion_cancelled") {
    return "Cancelled account deletion request";
  }

  return activityLabel(eventType);
}

function activityContext({
  reportId,
  subjectId,
  subjectType,
  targetType,
}: {
  reportId?: string | null;
  subjectId?: string | null;
  subjectType?: string | null;
  targetType?: string | null;
}) {
  const parts = [
    activitySubject(subjectType ?? targetType ?? null),
    reportId ? `report ${shortId(reportId)}` : null,
    subjectId ? `item ${shortId(subjectId)}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" - ") : null;
}

function reportSubjectKey(type: string, id: string) {
  return `${type}:${id}`;
}

const reportModerationSubjectTypes = new Set<string>([
  "feed_post",
  "gig",
  "thread_post",
  "marketplace_listing",
]);

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

function isPriorityReport(reason: string) {
  return [
    "harassment or hate",
    "illegal goods or services",
    "minor safety concern",
    "sexual content",
    "unsafe practice",
  ].includes(reason);
}

function reportStatusClass(status: ReportItem["status"]) {
  if (status === "open") return "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]";
  if (status === "reviewing") return "border-[#b7c6e8] bg-[#eef3ff] text-[#284f8a]";
  if (status === "resolved") return "border-[#b9d7bd] bg-[#eef8ef] text-[#276231]";

  return "border-[#d8d1c6] bg-[#f7f4ef] text-[#4f473f]";
}

function adStatusClass(status: AdCampaign["status"]) {
  if (status === "active") return "border-[#b9d7bd] bg-[#eef8ef] text-[#276231]";
  if (status === "pending_review") return "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]";
  if (status === "rejected") return "border-[#e5b8b8] bg-[#fff0f0] text-[#8a2828]";
  if (status === "paused") return "border-[#b7c6e8] bg-[#eef3ff] text-[#284f8a]";

  return "border-[#d8d1c6] bg-[#f7f4ef] text-[#4f473f]";
}

function dollars(cents: number) {
  return Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function adLabel(value: string) {
  if (value === "4u") return "4U";

  return value.replaceAll("_", " ");
}

function clickRate({ clicks, impressions }: Pick<AdCampaign, "clicks" | "impressions">) {
  if (!impressions) return "0.0%";

  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

function ReviewCard({ item }: { item: ReviewItem }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-md border border-[#e5ded4] bg-white p-3 sm:p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <p className="truncate text-sm font-bold">{item.title}</p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{item.authorUsername} - {timeAgo(item.createdAt)}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
          {statusLabel(item.status)}
        </span>
      </div>
      {item.body ? (
        <p className="line-clamp-3 text-sm leading-6 text-[#4f473f]">
          {item.body}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-medium capitalize">
          {item.subjectType.replace("_", " ")}
        </span>
        <span className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-medium capitalize">
          {item.visibility.replace("_", " ")}
        </span>
        {item.isSensitive ? (
          <span className="rounded-md bg-[#f6dfdf] px-2 py-1 text-xs font-semibold text-[#8a2828]">
            Sensitive: {item.sensitiveReason?.replaceAll("_", " ") ?? "body art"}
          </span>
        ) : null}
      </div>
      <form action={moderateContent} className="mt-4 space-y-2">
        <input name="subject_id" type="hidden" value={item.id} />
        <input name="subject_type" type="hidden" value={item.subjectType} />
        <input
          className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
          maxLength={500}
          name="note"
          placeholder="Moderator note"
        />
        <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">
          {[
            ["under_review", "Review"],
            ["hidden", "Hide"],
            ["removed", "Remove"],
            ["active", "Restore"],
          ].map(([value, label]) => (
            <button
              className="h-10 rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
              key={value}
              name="moderation_status"
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

function ReportCard({ report }: { report: ReportItem }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-md border border-[#e5ded4] bg-white p-3 sm:p-4">
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
            <span className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 py-1 text-xs font-semibold capitalize text-[#766d62]">
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
        <div className="mt-3 rounded-md border border-[#e5ded4] bg-[#f7f4ef] p-3">
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
        <span className="rounded-md bg-[#f7f4ef] px-2 py-1">
          Report {shortId(report.id)}
        </span>
        <span className="rounded-md bg-[#f7f4ef] px-2 py-1">
          Item {shortId(report.subjectId)}
        </span>
      </div>
      {report.details ? (
        <div className="mt-3 rounded-md border border-[#e5ded4] bg-[#fffdf9] p-3">
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
                className="h-10 rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
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
              className="h-10 rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
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

function QueueGroup({
  children,
  count,
  emptyText,
  title,
}: {
  children: ReactNode;
  count: number;
  emptyText: string;
  title: string;
}) {
  return (
    <section className="rounded-md border border-[#e5ded4] bg-[#fffdf9] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] px-2 py-1 text-xs font-semibold text-[#4f473f]">
          {count}
        </span>
      </div>
      {count ? (
        <div className="grid gap-3">{children}</div>
      ) : (
        <p className="rounded-md border border-[#e5ded4] bg-white p-3 text-sm text-[#4f473f]">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function QueueSummary({
  items,
}: {
  items: [label: string, count: number, tone?: "default" | "danger" | "warning"][];
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map(([label, count, tone = "default"]) => (
        <span
          className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
            tone === "danger"
              ? "border-[#e5b8b8] bg-[#fff0f0] text-[#8a2828]"
              : tone === "warning"
                ? "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]"
                : "border-[#d8d1c6] bg-[#f7f4ef] text-[#4f473f]"
          }`}
          key={label}
        >
          {label}: {formatCount(count)}
        </span>
      ))}
    </div>
  );
}

function LicenseRequestCard({ request }: { request: LicenseRequest }) {
  const isPending = request.status === "pending";
  const isExpired = isExpiredDate(request.expiresOn);

  return (
    <article className="min-w-0 overflow-hidden rounded-md border border-[#e5ded4] bg-white p-3 sm:p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <p className="truncate text-sm font-bold">{request.profileName}</p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{request.profileUsername} - {request.accountType} -{" "}
            {timeAgo(request.createdAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold capitalize ${licenseStatusClass(
            request.status,
          )}`}
        >
          {request.status}
        </span>
      </div>
      <dl className="grid gap-3 text-sm text-[#4f473f] sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Certification
          </dt>
          <dd className="mt-0.5">{request.licenseName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Region
          </dt>
          <dd className="mt-0.5">{request.issuingRegion}</dd>
        </div>
        {request.licenseNumber ? (
          <div>
            <dt className="text-xs font-semibold uppercase text-[#766d62]">
              License number
            </dt>
            <dd className="mt-0.5">{request.licenseNumber}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Submitted
          </dt>
          <dd className="mt-0.5">{formatDate(request.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Expires
          </dt>
          <dd className="mt-0.5">
            {formatDate(request.expiresOn)}
            {isExpired ? (
              <span className="ml-2 rounded-md bg-[#fff0f0] px-2 py-0.5 text-xs font-semibold text-[#8a2828]">
                expired
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
      <div className="mt-4 rounded-md border border-[#e5ded4] bg-[#fffdf9] p-3">
        <p className="text-xs font-semibold uppercase text-[#766d62]">
          Review checklist
        </p>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-[#4f473f]">
          {licenseReviewChecklist.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>
      <div className="mt-4 rounded-md border border-[#e5ded4] bg-[#f7f4ef] p-3">
        <p className="truncate text-sm font-semibold">{request.documentName}</p>
        <p className="mt-1 text-xs text-[#766d62]">
          Private file - {request.storageBucket}
        </p>
      </div>
      {request.signedDocumentUrl ? (
        <a
          className="mt-4 flex h-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-3 text-sm font-semibold hover:bg-[#f7f4ef]"
          href={request.signedDocumentUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open private document
        </a>
      ) : (
        <p className="mt-4 rounded-md border border-[#e5ded4] bg-[#f7f4ef] px-3 py-2 text-xs text-[#766d62]">
          Document link is unavailable. Refresh the queue or check storage
          permissions.
        </p>
      )}
      {isPending ? (
        <form action={updateLicenseVerification} className="mt-4 space-y-2">
          <input name="request_id" type="hidden" value={request.id} />
          <input
            className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            maxLength={500}
            name="note"
            placeholder="Reviewer note, required for rejection"
          />
          {isExpired ? (
            <p className="rounded-md border border-[#e5b8b8] bg-[#fff0f0] px-3 py-2 text-xs leading-5 text-[#8a2828]">
              This document appears expired. Reject it and ask the member to
              resubmit current proof.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-10 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#a9a19a]"
              disabled={isExpired}
              name="status"
              value="approved"
            >
              Approve
            </button>
            <button
              className="h-10 rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-3 text-sm font-semibold hover:bg-[#f7f4ef]"
              name="status"
              value="rejected"
            >
              Reject
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-md border border-[#e5ded4] bg-[#f7f4ef] px-3 py-2 text-xs text-[#766d62]">
          <p>
            Reviewed {request.reviewedAt ? formatDate(request.reviewedAt) : "previously"}.
          </p>
          {request.reviewerNote ? (
            <p className="mt-1 text-[#4f473f]">{request.reviewerNote}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function AccountDeletionRequestCard({
  request,
}: {
  request: AccountDeletionRequest;
}) {
  const isOpen = request.status === "pending" || request.status === "reviewing";

  return (
    <article className="min-w-0 overflow-hidden rounded-md border border-[#e5ded4] bg-white p-3 sm:p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <p className="truncate text-sm font-bold">{request.profileName}</p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{request.profileUsername} - requested {timeAgo(request.requestedAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold capitalize ${accountDeletionStatusClass(
            request.status,
          )}`}
        >
          {request.status}
        </span>
      </div>
      <div className="rounded-md border border-[#e5ded4] bg-[#fffdf9] p-3">
        <p className="text-xs font-semibold uppercase text-[#766d62]">
          Member reason
        </p>
        <p className="mt-1 text-sm leading-6 text-[#4f473f]">
          {request.reason || "No reason provided."}
        </p>
      </div>
      <div className="mt-3 rounded-md border border-[#e5ded4] bg-[#f7f4ef] p-3 text-xs leading-5 text-[#4f473f]">
        <p className="font-bold">Manual handling checklist</p>
        <p className="mt-1">
          Confirm identity, review safety or legal holds, preserve required audit
          records, then process the user data removal before marking completed.
        </p>
      </div>
      {isOpen ? (
        <form action={updateAccountDeletionRequest} className="mt-4 space-y-2">
          <input name="request_id" type="hidden" value={request.id} />
          <input
            className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            maxLength={500}
            name="note"
            placeholder="Reviewer note, required to complete or reject"
          />
          <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">
            {[
              ["reviewing", "Review"],
              ["completed", "Complete"],
              ["rejected", "Reject"],
              ["cancelled", "Cancel"],
            ].map(([value, label]) => (
              <button
                className={
                  value === "completed"
                    ? "h-10 rounded-md bg-[#171412] px-2 text-sm font-semibold text-white"
                    : value === "rejected"
                      ? "h-10 rounded-md border border-[#e5b8b8] bg-[#fff0f0] px-2 text-sm font-semibold text-[#8a2828] hover:bg-[#f6dfdf]"
                      : "h-10 rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
                }
                key={value}
                name="status"
                value={value}
              >
                {label}
              </button>
            ))}
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-md border border-[#e5ded4] bg-[#f7f4ef] px-3 py-2 text-xs text-[#766d62]">
          <p>
            Reviewed {request.reviewedAt ? formatDate(request.reviewedAt) : "previously"}.
          </p>
          {request.reviewerNote ? (
            <p className="mt-1 text-[#4f473f]">{request.reviewerNote}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function AdCampaignCard({ campaign }: { campaign: AdCampaign }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-md border border-[#e5ded4] bg-white p-3 sm:p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <p className="truncate text-sm font-bold">{campaign.name}</p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{campaign.advertiserUsername} -{" "}
            {adLabel(campaign.campaignType)} - {timeAgo(campaign.createdAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold capitalize ${adStatusClass(
            campaign.status,
          )}`}
        >
          {adLabel(campaign.status)}
        </span>
      </div>
      <div className="rounded-md border border-[#e5ded4] bg-[#f7f4ef] p-3">
        <p className="text-sm font-semibold">{campaign.title}</p>
        {campaign.body ? (
          <p className="mt-1 line-clamp-3 text-sm leading-5 text-[#4f473f]">
            {campaign.body}
          </p>
        ) : null}
        {campaign.targetUrl ? (
          <p className="mt-2 truncate text-xs text-[#766d62]">
            {campaign.targetUrl}
          </p>
        ) : null}
      </div>
      <dl className="mt-3 grid gap-3 text-sm text-[#4f473f] sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Goal
          </dt>
          <dd className="mt-0.5 capitalize">{adLabel(campaign.goal)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Bid / daily cap
          </dt>
          <dd className="mt-0.5">
            {dollars(campaign.bidCents)} / {dollars(campaign.dailyBudgetCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Placements
          </dt>
          <dd className="mt-0.5">
            {campaign.placements.length
              ? campaign.placements.map(adLabel).join(", ")
              : "No placement selected"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Targeting
          </dt>
          <dd className="mt-0.5">
            {[campaign.city, campaign.region, campaign.countryCode, campaign.language]
              .filter(Boolean)
              .join(", ") || "Broad"}
          </dd>
        </div>
      </dl>
      {campaign.keywords.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {campaign.keywords.slice(0, 8).map((keyword) => (
            <span
              className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-medium"
              key={keyword}
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-2 text-center text-xs min-[390px]:grid-cols-3">
        {[
          ["Impressions", campaign.impressions],
          ["Clicks", campaign.clicks],
          ["CTR", clickRate(campaign)],
        ].map(([label, value]) => (
          <div
            className="rounded-md border border-[#e5ded4] bg-[#fffdf9] px-2 py-2"
            key={label}
          >
            <p className="font-bold text-[#171412]">{value}</p>
            <p className="mt-1 text-[#766d62]">{label}</p>
          </div>
        ))}
      </div>
      {campaign.reviewerNote ? (
        <p className="mt-3 rounded-md border border-[#e5ded4] bg-[#fffdf9] px-3 py-2 text-xs text-[#4f473f]">
          {campaign.reviewerNote}
        </p>
      ) : null}
      <form action={updateAdCampaignStatus} className="mt-4 space-y-2">
        <input name="campaign_id" type="hidden" value={campaign.id} />
        <input
          className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
          maxLength={500}
          name="note"
          placeholder="Reviewer note"
        />
        <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-5">
          {[
            ["approved", "Approve"],
            ["active", "Activate"],
            ["paused", "Pause"],
            ["rejected", "Reject"],
            ["archived", "Archive"],
          ].map(([value, label]) => (
            <button
              className={
                value === "active"
                  ? "h-10 rounded-md bg-[#171412] px-2 text-sm font-semibold text-white"
                  : value === "archived"
                    ? "h-10 rounded-md border border-[#e5b8b8] bg-[#fff0f0] px-2 text-sm font-semibold text-[#8a2828] hover:bg-[#f6dfdf]"
                  : "h-10 rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
              }
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
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
    return (
      <main className="min-h-screen bg-[#202020] px-4 py-8 text-[#171412]">
        <section className="ttc-card mx-auto w-full max-w-2xl rounded-lg border border-[#cfc8bd] bg-[#f2f1ee] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[#171412] text-[#c8953b]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin access required</h1>
              <p className="text-sm text-[#766d62]">{claims.email}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[#4f473f]">
            This account is signed in, but it has not been assigned an admin or
            moderator role yet.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              className="flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              href="/account"
            >
              Open profile
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
              href="/"
            >
              Back to site
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const adminProfile = profile;
  const canSendMailTest = profile.role === "admin" || profile.role === "owner";

  const [
    { count: userCount },
    { count: openReports },
    { count: pendingVerifications },
    { count: pendingAds },
    { count: pendingDataRequests },
    { count: marketplaceQueue },
    { count: moderationActions },
    { data: adminUsers },
    { data: verificationQueue },
    { data: accountDeletionQueue },
    { data: reportQueue },
    { data: feedReview },
    { data: threadReview },
    { data: listingReview },
    { data: gigReview },
    { data: adCampaignQueue },
    { data: mailSettings },
    { data: adminAuditLogs },
    { data: moderationLog },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("content_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("license_verification_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("ad_campaigns")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("account_deletion_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "reviewing"]),
    supabase
      .from("marketplace_listings")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "active"]),
    supabase
      .from("moderation_actions")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, account_type, role, banned_at, suspended_at, moderation_note, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          account_type: string;
          banned_at: string | null;
          created_at: string;
          display_name: string;
          id: string;
          moderation_note: string | null;
          role: UserRole;
          suspended_at: string | null;
          username: string;
        }[]
      >(),
    supabase
      .from("license_verification_requests")
      .select(
        "id, account_type, license_name, license_number, issuing_region, expires_on, storage_bucket, storage_path, status, reviewer_note, reviewed_at, created_at, profiles:profiles!license_verification_requests_profile_id_fkey(display_name, username)",
      )
      .in("status", ["pending", "approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          account_type: string;
          created_at: string;
          expires_on: string | null;
          id: string;
          issuing_region: string;
          license_name: string;
          license_number: string | null;
          profiles: { display_name: string; username: string } | null;
          reviewed_at: string | null;
          reviewer_note: string | null;
          storage_bucket: string;
          storage_path: string;
          status: "pending" | "approved" | "rejected";
        }[]
      >(),
    supabase
      .from("account_deletion_requests")
      .select(
        "id, reason, status, reviewer_note, requested_at, reviewed_at, profiles:profiles!account_deletion_requests_profile_id_fkey(display_name, username)",
      )
      .in("status", ["pending", "reviewing", "rejected", "cancelled"])
      .order("requested_at", { ascending: false })
      .limit(25)
      .returns<
        {
          id: string;
          profiles: { display_name: string; username: string } | null;
          reason: string | null;
          requested_at: string;
          reviewed_at: string | null;
          reviewer_note: string | null;
          status: "pending" | "reviewing" | "completed" | "rejected" | "cancelled";
        }[]
      >(),
    supabase
      .from("content_reports")
      .select(
        "id, subject_type, subject_id, reason, details, status, created_at, profiles:profiles!content_reports_reporter_id_fkey(display_name, username)",
      )
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          id: string;
          subject_type: string;
          subject_id: string;
          reason: string;
          details: string | null;
          status: "open" | "reviewing" | "resolved" | "dismissed";
          created_at: string;
          profiles: { display_name: string; username: string } | null;
        }[]
      >(),
    supabase
      .from("feed_posts")
      .select(
        "id, caption, created_at, is_sensitive, sensitive_reason, moderation_status, visibility, profiles:profiles!feed_posts_author_id_fkey(display_name, username)",
      )
      .or("is_sensitive.eq.true,moderation_status.neq.active")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          id: string;
          caption: string | null;
          created_at: string;
          is_sensitive: boolean;
          sensitive_reason: string | null;
          moderation_status: ModerationStatus;
          visibility: "public_preview" | "members" | "private";
          profiles: { display_name: string; username: string } | null;
        }[]
      >(),
    supabase
      .from("thread_posts")
      .select(
        "id, body, created_at, is_sensitive, sensitive_reason, moderation_status, visibility, profiles:profiles!thread_posts_author_id_fkey(display_name, username)",
      )
      .or("is_sensitive.eq.true,moderation_status.neq.active")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          id: string;
          body: string;
          created_at: string;
          is_sensitive: boolean;
          sensitive_reason: string | null;
          moderation_status: ModerationStatus;
          visibility: "public_preview" | "members" | "private";
          profiles: { display_name: string; username: string } | null;
        }[]
      >(),
    supabase
      .from("marketplace_listings")
      .select(
        "id, title, description, created_at, is_sensitive, sensitive_reason, moderation_status, visibility, profiles:profiles!marketplace_listings_seller_id_fkey(display_name, username)",
      )
      .or("is_sensitive.eq.true,moderation_status.neq.active")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          id: string;
          title: string;
          description: string | null;
          created_at: string;
          is_sensitive: boolean;
          sensitive_reason: string | null;
          moderation_status: ModerationStatus;
          visibility: "public_preview" | "members" | "private";
          profiles: { display_name: string; username: string } | null;
        }[]
      >(),
    supabase
      .from("gigs")
      .select(
        "id, title, description, created_at, is_sensitive, sensitive_reason, moderation_status, visibility, profiles:profiles!gigs_poster_id_fkey(display_name, username)",
      )
      .or("is_sensitive.eq.true,moderation_status.neq.active")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          id: string;
          title: string;
          description: string | null;
          created_at: string;
          is_sensitive: boolean;
          sensitive_reason: string | null;
          moderation_status: ModerationStatus;
          visibility: "public_preview" | "members" | "private";
          profiles: { display_name: string; username: string } | null;
        }[]
      >(),
    supabase
      .from("ad_campaigns")
      .select(
        "id, name, title, body, target_url, campaign_type, goal, status, bid_cents, daily_budget_cents, country_code, region, city, language, keywords, starts_at, ends_at, reviewer_note, created_at, profiles:profiles!ad_campaigns_advertiser_id_fkey(display_name, username), ad_campaign_placements(placement), ad_events(event_type)",
      )
      .in("status", [
        "pending_review",
        "approved",
        "active",
        "paused",
        "rejected",
        "archived",
      ])
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          ad_events: { event_type: "impression" | "click" | "message_lead" }[];
          ad_campaign_placements: { placement: "4u" | "gossip" | "stuff" }[];
          bid_cents: number;
          body: string | null;
          campaign_type: "artist_growth" | "stuff_listing";
          city: string | null;
          country_code: string | null;
          created_at: string;
          daily_budget_cents: number;
          ends_at: string | null;
          goal:
            | "leads"
            | "messages"
            | "engagement"
            | "listing_views"
            | "seller_messages"
            | "marketplace_engagement";
          id: string;
          keywords: string[];
          language: string | null;
          name: string;
          profiles: { display_name: string; username: string } | null;
          region: string | null;
          reviewer_note: string | null;
          starts_at: string | null;
          status:
            | "draft"
            | "pending_review"
            | "approved"
            | "active"
            | "paused"
            | "rejected"
            | "archived";
          target_url: string | null;
          title: string;
        }[]
      >(),
    supabase
      .from("mail_settings")
      .select(
        "provider, from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled",
      )
      .maybeSingle<{
        provider: string;
        from_email: string | null;
        from_name: string;
        smtp_host: string | null;
        smtp_port: number | null;
        smtp_username: string | null;
        smtp_secure: boolean;
        smtp_password_secret_name: string;
        reply_to_email: string | null;
        is_enabled: boolean;
      }>(),
    supabase
      .from("admin_audit_logs")
      .select(
        "id, event_type, target_type, target_id, summary, metadata, created_at, profiles:profiles!admin_audit_logs_actor_id_fkey(display_name, username)",
      )
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          created_at: string;
          event_type: string;
          id: string;
          metadata: ActivityMetadata | null;
          profiles: { display_name: string; username: string } | null;
          summary: string | null;
          target_id: string | null;
          target_type: string | null;
        }[]
      >(),
    supabase
      .from("moderation_actions")
      .select(
        "id, action_type, subject_type, subject_id, report_id, note, metadata, created_at, profiles:profiles!moderation_actions_actor_id_fkey(display_name, username)",
      )
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          action_type: string;
          created_at: string;
          id: string;
          metadata: ActivityMetadata | null;
          note: string | null;
          profiles: { display_name: string; username: string } | null;
          report_id: string | null;
          subject_id: string | null;
          subject_type: string | null;
        }[]
      >(),
  ]);

  const metrics = [
    ["Members", userCount, "Profiles created"],
    ["Open reports", openReports, "Needs review"],
    ["License checks", pendingVerifications, "Pending approval"],
    ["Ad reviews", pendingAds, "Pending campaigns"],
    ["Data requests", pendingDataRequests, "Privacy queue"],
    ["Listings", marketplaceQueue, "Draft and active"],
    ["Actions", moderationActions, "Moderation log"],
  ];
  const users: AdminUser[] = (adminUsers ?? []).map((user) => ({
    accountType: user.account_type,
    bannedAt: user.banned_at,
    createdAt: user.created_at,
    displayName: user.display_name,
    id: user.id,
    moderationNote: user.moderation_note,
    role: user.role,
    suspendedAt: user.suspended_at,
    username: user.username,
  }));
  const canManageRoles = adminProfile.role === "owner";
  const activityItems: AuditItem[] = [
    ...(adminAuditLogs ?? []).map((item) => ({
      actorUsername: item.profiles?.username ?? "admin",
      context: activityContext({
        subjectId: item.target_id,
        targetType: item.target_type,
      }),
      createdAt: item.created_at,
      id: item.id,
      kind: "audit" as const,
      label: auditActivityLabel(item.event_type, item.metadata),
      note: item.summary,
    })),
    ...(moderationLog ?? []).map((item) => ({
      actorUsername: item.profiles?.username ?? "moderator",
      context: activityContext({
        reportId: item.report_id,
        subjectId: item.subject_id,
        subjectType: item.subject_type,
      }),
      createdAt: item.created_at,
      id: item.id,
      kind: "moderation" as const,
      label: moderationActivityLabel(item.action_type, item.metadata),
      note: item.note,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 12);
  const signedDocumentUrls = await Promise.all(
    (verificationQueue ?? []).map(async (request) => {
      const { data } = await supabase.storage
        .from(request.storage_bucket)
        .createSignedUrl(request.storage_path, 300);

      return [request.id, data?.signedUrl ?? null] as const;
    }),
  );
  const signedDocumentUrlByRequest = new Map(signedDocumentUrls);
  const licenseRequests: LicenseRequest[] = (verificationQueue ?? []).map(
    (request) => ({
      accountType: request.account_type,
      createdAt: request.created_at,
      documentName: fileNameFromPath(request.storage_path),
      expiresOn: request.expires_on,
      id: request.id,
      issuingRegion: request.issuing_region,
      licenseName: request.license_name,
      licenseNumber: request.license_number,
      profileName: request.profiles?.display_name ?? "Member",
      profileUsername: request.profiles?.username ?? "member",
      reviewedAt: request.reviewed_at,
      reviewerNote: request.reviewer_note,
      signedDocumentUrl: signedDocumentUrlByRequest.get(request.id) ?? null,
      status: request.status,
      storageBucket: request.storage_bucket,
    }),
  );
  const pendingLicenseRequests = licenseRequests.filter(
    (request) => request.status === "pending",
  );
  const approvedLicenseRequests = licenseRequests.filter(
    (request) => request.status === "approved",
  );
  const rejectedLicenseRequests = licenseRequests.filter(
    (request) => request.status === "rejected",
  );
  const accountDeletionRequests: AccountDeletionRequest[] = (
    accountDeletionQueue ?? []
  ).map((request) => ({
    id: request.id,
    profileName: request.profiles?.display_name ?? "Member",
    profileUsername: request.profiles?.username ?? "member",
    reason: request.reason,
    requestedAt: request.requested_at,
    reviewedAt: request.reviewed_at,
    reviewerNote: request.reviewer_note,
    status: request.status,
  }));
  const openAccountDeletionRequests = accountDeletionRequests.filter(
    (request) => request.status === "pending" || request.status === "reviewing",
  );
  const closedAccountDeletionRequests = accountDeletionRequests.filter(
    (request) => request.status !== "pending" && request.status !== "reviewing",
  );
  const reportSubjectPreviews = new Map<string, ReportSubjectPreview>();
  const reportSubjectIds = (type: string) =>
    (reportQueue ?? [])
      .filter((report) => report.subject_type === type)
      .map((report) => report.subject_id);

  await Promise.all([
    (async () => {
      const ids = reportSubjectIds("feed_post");
      if (!ids.length) return;

      const { data } = await supabase
        .from("feed_posts")
        .select(
          "id, caption, profiles:profiles!feed_posts_author_id_fkey(username)",
        )
        .in("id", ids)
        .returns<
          {
            caption: string | null;
            id: string;
            profiles: { username: string } | null;
          }[]
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
        .select(
          "id, body, profiles:profiles!thread_posts_author_id_fkey(username)",
        )
        .in("id", ids)
        .returns<
          {
            body: string;
            id: string;
            profiles: { username: string } | null;
          }[]
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
        .select(
          "id, title, description, profiles:profiles!marketplace_listings_seller_id_fkey(username)",
        )
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
        .select(
          "id, title, description, profiles:profiles!gigs_poster_id_fkey(username)",
        )
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
          {
            bio: string | null;
            display_name: string;
            id: string;
            username: string;
          }[]
        >();

      for (const profile of data ?? []) {
        reportSubjectPreviews.set(reportSubjectKey("profile", profile.id), {
          ownerUsername: profile.username,
          preview: profile.bio,
          title: profile.display_name,
        });
      }
    })(),
  ]);
  const reports: ReportItem[] = (reportQueue ?? []).map((report) => ({
    ...(() => {
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
    })(),
  }));
  const openReportItems = reports.filter((report) => report.status === "open");
  const priorityOpenReportItems = openReportItems.filter((report) =>
    isPriorityReport(report.reason),
  );
  const routineOpenReportItems = openReportItems.filter(
    (report) => !isPriorityReport(report.reason),
  );
  const reviewingReportItems = reports.filter(
    (report) => report.status === "reviewing",
  );
  const reviewItems: ReviewItem[] = [
    ...(feedReview ?? []).map((post) => ({
      authorName: post.profiles?.display_name ?? "Member",
      authorUsername: post.profiles?.username ?? "member",
      body: post.caption,
      createdAt: post.created_at,
      id: post.id,
      isSensitive: post.is_sensitive,
      sensitiveReason: post.sensitive_reason,
      status: post.moderation_status,
      subjectType: "feed_post" as const,
      title: post.caption || "Feed post",
      visibility: post.visibility,
    })),
    ...(threadReview ?? []).map((thread) => ({
      authorName: thread.profiles?.display_name ?? "Member",
      authorUsername: thread.profiles?.username ?? "member",
      body: thread.body,
      createdAt: thread.created_at,
      id: thread.id,
      isSensitive: thread.is_sensitive,
      sensitiveReason: thread.sensitive_reason,
      status: thread.moderation_status,
      subjectType: "thread_post" as const,
      title: "Thread post",
      visibility: thread.visibility,
    })),
    ...(listingReview ?? []).map((listing) => ({
      authorName: listing.profiles?.display_name ?? "Seller",
      authorUsername: listing.profiles?.username ?? "seller",
      body: listing.description,
      createdAt: listing.created_at,
      id: listing.id,
      isSensitive: listing.is_sensitive,
      sensitiveReason: listing.sensitive_reason,
      status: listing.moderation_status,
      subjectType: "marketplace_listing" as const,
      title: listing.title,
      visibility: listing.visibility,
    })),
    ...(gigReview ?? []).map((gig) => ({
      authorName: gig.profiles?.display_name ?? "Member",
      authorUsername: gig.profiles?.username ?? "member",
      body: gig.description,
      createdAt: gig.created_at,
      id: gig.id,
      isSensitive: gig.is_sensitive,
      sensitiveReason: gig.sensitive_reason,
      status: gig.moderation_status,
      subjectType: "gig" as const,
      title: gig.title,
      visibility: gig.visibility,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const adCampaigns: AdCampaign[] = (adCampaignQueue ?? []).map((campaign) => ({
    advertiserName: campaign.profiles?.display_name ?? "Advertiser",
    advertiserUsername: campaign.profiles?.username ?? "advertiser",
    bidCents: campaign.bid_cents,
    body: campaign.body,
    campaignType: campaign.campaign_type,
    city: campaign.city,
    countryCode: campaign.country_code,
    createdAt: campaign.created_at,
    dailyBudgetCents: campaign.daily_budget_cents,
    endsAt: campaign.ends_at,
    goal: campaign.goal,
    id: campaign.id,
    keywords: campaign.keywords ?? [],
    language: campaign.language,
    name: campaign.name,
    placements: campaign.ad_campaign_placements.map(
      (placement) => placement.placement,
    ),
    region: campaign.region,
    reviewerNote: campaign.reviewer_note,
    startsAt: campaign.starts_at,
    status: campaign.status,
    targetUrl: campaign.target_url,
    title: campaign.title,
    clicks: campaign.ad_events.filter((event) => event.event_type === "click")
      .length,
    impressions: campaign.ad_events.filter(
      (event) => event.event_type === "impression",
    ).length,
  }));
  const pendingAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const reviewedAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status !== "pending_review",
  );
  const overviewMode = true;
  const overviewCards = [
    {
      action: "Open users",
      body: "Paged account review, role changes, suspensions, bans, and moderation notes.",
      count: userCount,
      href: "/admin/users",
      label: "Users",
      meta: `${users.length} latest previewed`,
    },
    {
      action: "Verification page planned",
      body: "Artist, studio, and vendor license approval should move to a dedicated queue page.",
      count: pendingLicenseRequests.length,
      href: "/admin/verification",
      label: "Verification",
      meta: `${approvedLicenseRequests.length} approved / ${rejectedLicenseRequests.length} rejected in latest slice`,
    },
    {
      action: "Reports page planned",
      body: "Content reports need their own review page with filters, status, and pagination.",
      count: reports.length,
      href: "/admin/reports",
      label: "Reports",
      meta: `${priorityOpenReportItems.length} priority open`,
    },
    {
      action: "Ads page planned",
      body: "Campaign review, placements, bids, and performance should not live in the overview.",
      count: pendingAdCampaigns.length,
      href: "/admin/ads",
      label: "Ads",
      meta: `${reviewedAdCampaigns.length} reviewed in latest slice`,
    },
    {
      action: "Data page planned",
      body: "Deletion and privacy requests need a focused operational page and audit history.",
      count: openAccountDeletionRequests.length,
      href: "/admin/data-requests",
      label: "Data requests",
      meta: `${closedAccountDeletionRequests.length} recently closed`,
    },
    {
      action: "Open content",
      body: "Media, 4U, Gossip, Stuff, and Gigs moderation should split into dedicated review pages.",
      count: reviewItems.length,
      href: "/admin/content",
      label: "Content",
      meta: `${pendingAdCampaigns.length + reports.length + reviewItems.length} combined active queue signals`,
    },
    {
      action: "Open Stuff",
      body: "Verified-only marketplace listings get their own paged review page for seller, price, status, and access checks.",
      count: marketplaceQueue ?? 0,
      href: "/admin/stuff",
      label: "Stuff",
      meta: `${marketplaceQueue ?? 0} listings tracked`,
    },
    {
      action: "Open Gigs",
      body: "Jobs, conventions, guest spots, apprenticeships, shop openings, and events now have a paged review page.",
      count: gigReview?.length ?? 0,
      href: "/admin/gigs",
      label: "Gigs",
      meta: `${gigReview?.length ?? 0} latest review signals`,
    },
    {
      action: "Open mail",
      body: "SMTP status, sender identity, secret binding, and test tools now live on a focused settings page.",
      count: mailSettings?.is_enabled ? 1 : 0,
      href: "/admin/mail-settings",
      label: "Mail",
      meta: mailSettings?.is_enabled ? "SMTP enabled" : "SMTP disabled",
    },
    {
      action: "Open media ops",
      body: "Optimization, thumbnail, upload-limit, and video-processing notes now live on a focused media page.",
      count: mediaOpsStages.length,
      href: "/admin/media-ops",
      label: "Media ops",
      meta: `${mediaCostRules.length} cost rules tracked`,
    },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#202020] text-[#171412]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_28px_90px_rgba(0,0,0,0.42)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-[#3b332b] bg-[#1c1916]/95 px-5 py-5 text-[#fffdf9] backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md border border-[#c8953b]/50 bg-[#0f0d0b] text-[#c8953b] shadow-[0_0_20px_rgba(200,149,59,0.16)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">Admin</p>
              <p className="text-xs text-[#c9bfb1]">TheTattooCore</p>
            </div>
          </div>

          <nav className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto pb-1 lg:mx-0 lg:grid lg:grid-cols-1 lg:overflow-visible">
            {adminTabs.map(([Icon, label, href]) => (
              <a
                className="flex h-11 shrink-0 items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 text-sm font-semibold text-[#f7f4ef] backdrop-blur hover:border-[#c8953b]/60 hover:bg-[#c8953b]/15 lg:w-full"
                href={href}
                key={label}
              >
                <Icon className="size-5 text-[#c8953b]" />
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-6 rounded-md border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold">{adminProfile.display_name}</p>
            <p className="text-xs text-[#c9bfb1]">
              @{adminProfile.username} - {adminProfile.role}
            </p>
          </div>
        </aside>

        <section className="min-w-0 bg-[#ece8df] px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-[#cfc8bd] pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin dashboard</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                Moderation, user safety, marketplace review, and mail setup.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
                href="/"
              >
                Site
              </Link>
              <Link
                className="flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                href="/account"
              >
                Account
              </Link>
            </div>
          </header>

          <nav className="no-scrollbar sticky top-0 z-10 -mx-4 mb-6 flex gap-2 overflow-x-auto border-y border-[#cfc8bd] bg-[#ece8df]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
            {adminTabs.map(([Icon, label, href]) => (
              <a
                className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9]/90 px-3 text-xs font-bold shadow-sm"
                href={href}
                key={label}
              >
                <Icon className="size-4 text-[#c8953b]" />
                {label}
              </a>
            ))}
          </nav>

          {params.message ? (
            <p className="mb-6 rounded-md border border-[#cfc8bd] bg-[#e8e4dc] px-4 py-3 text-sm font-medium">
              {params.message}
            </p>
          ) : null}

          <section
            className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
            id="overview"
          >
            {metrics.map(([label, value, caption]) => (
              <div
                className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4"
                key={label as string}
              >
                <p className="text-sm text-[#766d62]">{caption as string}</p>
                <p className="mt-2 text-3xl font-bold">
                  {formatCount(value as number | null)}
                </p>
                <p className="mt-1 text-sm font-semibold">{label as string}</p>
              </div>
            ))}
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <Link
                className="ttc-card flex min-h-48 flex-col justify-between rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4 hover:border-[#c8953b]"
                href={card.href}
                key={card.label}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold">{card.label}</h2>
                    <span className="rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-bold text-[#4f473f]">
                      {formatCount(card.count)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#4f473f]">
                    {card.body}
                  </p>
                  <p className="mt-3 rounded-md border border-[#e5ded4] bg-white px-3 py-2 text-xs leading-5 text-[#766d62]">
                    {card.meta}
                  </p>
                </div>
                <span className="mt-4 text-sm font-bold text-[#171412]">
                  {card.action}
                </span>
              </Link>
            ))}
          </section>

          <section className="mb-6 rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5">
            <div className="flex items-center gap-3">
              <Activity className="size-5" />
              <h2 className="text-lg font-bold">Recent activity</h2>
            </div>
            {activityItems.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {activityItems.slice(0, 6).map((item) => (
                  <article
                    className="rounded-md border border-[#e5ded4] bg-white p-3"
                    key={`${item.kind}-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs text-[#766d62]">
                          @{item.actorUsername} - {timeAgo(item.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-[#efe7da] px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
                        {item.kind}
                      </span>
                    </div>
                    {item.context ? (
                      <p className="mt-2 text-xs capitalize text-[#766d62]">
                        {item.context}
                      </p>
                    ) : null}
                    {item.note ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#4f473f]">
                        {item.note}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-[#e5ded4] bg-white p-4 text-sm text-[#4f473f]">
                No admin or moderation activity has been logged yet.
              </p>
            )}
          </section>

          <p className="rounded-md border border-[#cfc8bd] bg-[#e8e4dc] px-4 py-3 text-sm leading-6 text-[#4f473f]">
            This overview intentionally stays short. Full queues belong on
            dedicated admin pages so Users, Ads, Reports, Verification, Stuff,
            Merch, Gigs, Mail, and Data Requests can scale without turning the
            dashboard into a long scroll.
          </p>

          {overviewMode ? null : (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <section className="min-w-0 space-y-5">
              <div
                className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5"
                id="users"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Users className="size-5" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">Users and roles</h2>
                    <p className="text-xs text-[#766d62]">
                      Dashboard preview. Use the full page for paged account review.
                    </p>
                  </div>
                  <Link
                    className="hidden h-9 shrink-0 items-center rounded-md border border-[#cfc8bd] bg-white px-3 text-xs font-bold sm:flex"
                    href="/admin/users"
                  >
                    Full users page
                  </Link>
                </div>
                <Link
                  className="mb-4 flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-bold sm:hidden"
                  href="/admin/users"
                >
                  Open full Users page
                </Link>
                {!canManageRoles ? (
                  <p className="mb-4 rounded-md border border-[#e5ded4] bg-white p-3 text-sm text-[#4f473f]">
                    Owner role required to promote admins or moderators.
                  </p>
                ) : null}
                <div className="grid gap-3">
                  {users.map((user) => (
                    <article
                      className="min-w-0 overflow-hidden rounded-md border border-[#e5ded4] bg-white p-3"
                      key={user.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {user.displayName}
                          </p>
                          <p className="mt-1 text-xs text-[#766d62]">
                            @{user.username} - {user.accountType} - joined{" "}
                            {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="w-fit rounded-md border border-[#d8d1c6] bg-[#f7f4ef] px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
                            {user.role}
                          </span>
                          <span
                            className={`w-fit rounded-md px-2 py-1 text-xs font-semibold capitalize ${
                              userStatus(user) === "active"
                                ? "bg-[#efe7da] text-[#4f473f]"
                                : userStatus(user) === "suspended"
                                  ? "bg-[#fff1c7] text-[#6f5200]"
                                  : "bg-[#f6dfdf] text-[#8a2828]"
                            }`}
                          >
                            {userStatus(user)}
                          </span>
                        </div>
                      </div>
                      {user.moderationNote ? (
                        <p className="mt-3 rounded-md bg-[#f7f4ef] px-3 py-2 text-xs text-[#766d62]">
                          {user.moderationNote}
                        </p>
                      ) : null}
                      {canManageRoles ? (
                        <form
                          action={changeUserRole}
                          className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                        >
                          <input name="profile_id" type="hidden" value={user.id} />
                          <select
                            className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                            defaultValue={user.role}
                            name="role"
                          >
                            {["user", "moderator", "admin", "owner"].map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <button className="h-10 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                            Update role
                          </button>
                        </form>
                      ) : null}
                      <form action={changeUserStatus} className="mt-3 space-y-2">
                        <input name="profile_id" type="hidden" value={user.id} />
                        <input
                          className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                          maxLength={500}
                          name="note"
                          placeholder="Moderation note"
                        />
                        <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
                          {[
                            ["active", "Restore"],
                            ["suspended", "Suspend"],
                            ["banned", "Ban"],
                          ].map(([value, label]) => (
                            <button
                              className="h-10 rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
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
                  ))}
                </div>
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="verification"
              >
                <div className="mb-4 flex items-center gap-3">
                  <ShieldCheck className="size-5" />
                  <h2 className="text-lg font-bold">
                    Artist, studio, and vendor verification
                  </h2>
                </div>
                <p className="mb-4 rounded-md border border-[#e5ded4] bg-white px-3 py-2 text-sm leading-6 text-[#4f473f]">
                  Approvals unlock Stuff seller contact, buy/sell/trade access,
                  vendor participation, and professional equipment activity.
                  Keep notes specific when rejecting so members know what to
                  resubmit.
                </p>
                <QueueSummary
                  items={[
                    ["Pending", pendingLicenseRequests.length, "warning"],
                    ["Approved", approvedLicenseRequests.length],
                    ["Rejected", rejectedLicenseRequests.length, "danger"],
                  ]}
                />
                {licenseRequests.length ? (
                  <div className="space-y-4">
                    <QueueGroup
                      count={pendingLicenseRequests.length}
                      emptyText="No pending artist, studio, or vendor submissions."
                      title="Pending approval"
                    >
                      {pendingLicenseRequests.map((request) => (
                        <LicenseRequestCard
                          key={request.id}
                          request={request}
                        />
                      ))}
                    </QueueGroup>
                    <QueueGroup
                      count={rejectedLicenseRequests.length}
                      emptyText="No recently rejected submissions."
                      title="Recently rejected"
                    >
                      {rejectedLicenseRequests.map((request) => (
                        <LicenseRequestCard
                          key={request.id}
                          request={request}
                        />
                      ))}
                    </QueueGroup>
                  </div>
                ) : (
                  <div className="rounded-md border border-[#e5ded4] bg-white p-4 text-sm text-[#4f473f]">
                    No artist, studio, or vendor license submissions are waiting
                    right now.
                  </div>
                )}
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="data-requests"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Trash2 className="size-5" />
                  <h2 className="text-lg font-bold">Data requests</h2>
                </div>
                <p className="mb-4 rounded-md border border-[#e5ded4] bg-white px-3 py-2 text-sm leading-6 text-[#4f473f]">
                  Handle account deletion requests manually during launch. Do
                  identity, safety, and legal checks before marking anything
                  completed.
                </p>
                <QueueSummary
                  items={[
                    ["Open", openAccountDeletionRequests.length, "warning"],
                    ["Recently closed", closedAccountDeletionRequests.length],
                  ]}
                />
                <div className="space-y-4">
                  <QueueGroup
                    count={openAccountDeletionRequests.length}
                    emptyText="No account deletion requests are waiting."
                    title="Open deletion requests"
                  >
                    {openAccountDeletionRequests.map((request) => (
                      <AccountDeletionRequestCard
                        key={request.id}
                        request={request}
                      />
                    ))}
                  </QueueGroup>
                  <QueueGroup
                    count={closedAccountDeletionRequests.length}
                    emptyText="No recently closed data requests."
                    title="Recently closed"
                  >
                    {closedAccountDeletionRequests.map((request) => (
                      <AccountDeletionRequestCard
                        key={request.id}
                        request={request}
                      />
                    ))}
                  </QueueGroup>
                </div>
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="reports"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Flag className="size-5" />
                  <h2 className="text-lg font-bold">Report queue</h2>
                </div>
                <p className="mb-4 rounded-md border border-[#e5ded4] bg-white px-3 py-2 text-sm leading-6 text-[#4f473f]">
                  Review red reports first, move valid reports into Reviewing,
                  and keep notes specific enough for the moderation audit log.
                </p>
                <QueueSummary
                  items={[
                    ["Priority open", priorityOpenReportItems.length, "danger"],
                    ["Routine open", routineOpenReportItems.length, "warning"],
                    ["In review", reviewingReportItems.length],
                  ]}
                />
                {reports.length ? (
                  <div className="space-y-4">
                    <QueueGroup
                      count={priorityOpenReportItems.length}
                      emptyText="No priority reports are open."
                      title="Priority open reports"
                    >
                      {priorityOpenReportItems.map((report) => (
                        <ReportCard key={report.id} report={report} />
                      ))}
                    </QueueGroup>
                    <QueueGroup
                      count={routineOpenReportItems.length}
                      emptyText="No routine reports are open."
                      title="Routine open reports"
                    >
                      {routineOpenReportItems.map((report) => (
                        <ReportCard key={report.id} report={report} />
                      ))}
                    </QueueGroup>
                    <QueueGroup
                      count={reviewingReportItems.length}
                      emptyText="No reports are currently in review."
                      title="In review"
                    >
                      {reviewingReportItems.map((report) => (
                        <ReportCard key={report.id} report={report} />
                      ))}
                    </QueueGroup>
                  </div>
                ) : (
                  <div className="rounded-md border border-[#e5ded4] bg-white p-4 text-sm text-[#4f473f]">
                    No open reports are waiting right now.
                  </div>
                )}
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="content"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Gavel className="size-5" />
                  <h2 className="text-lg font-bold">Content moderation</h2>
                </div>
                {reviewItems.length ? (
                  <div className="grid gap-3">
                    {reviewItems.slice(0, 12).map((item) => (
                      <ReviewCard item={item} key={`${item.subjectType}-${item.id}`} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-[#e5ded4] bg-white p-4 text-sm text-[#4f473f]">
                    No sensitive, hidden, removed, or under-review content is
                    waiting right now.
                  </div>
                )}
              </div>
            </section>

            <aside className="min-w-0 space-y-5">
              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="gigs"
              >
                <div className="mb-4 flex items-center gap-3">
                  <BriefcaseBusiness className="size-5" />
                  <h2 className="text-lg font-bold">Gigs</h2>
                </div>
                <p className="text-sm leading-6 text-[#4f473f]">
                  Gigs review covers jobs, conventions, guest spots, shop
                  openings, apprenticeships, and event posts.
                </p>
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="marketplace"
              >
                <div className="mb-4 flex items-center gap-3">
                  <ShoppingBag className="size-5" />
                  <h2 className="text-lg font-bold">Marketplace</h2>
                </div>
                <p className="text-sm leading-6 text-[#4f473f]">
                  Marketplace review will cover flash sheets, guest spots,
                  studio chairs, supplies, and service listings.
                </p>
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="ads"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Megaphone className="size-5" />
                  <h2 className="text-lg font-bold">Ads</h2>
                </div>
                <p className="mb-4 rounded-md border border-[#e5ded4] bg-white px-3 py-2 text-sm leading-6 text-[#4f473f]">
                  Review paid spots before they can run. Artist ads belong in
                  4U and Gossip; Stuff ads stay in Stuff.
                </p>
                <div className="mb-4 grid gap-2 sm:grid-cols-3">
                  {[
                    "Verify advertiser is an approved artist, studio, or vendor.",
                    "Reject unsafe scratcher, unlicensed studio, or restricted equipment ads.",
                    "Confirm targeting is coarse and the sponsor label will be clear.",
                  ].map((rule) => (
                    <p
                      className="rounded-md border border-[#e5ded4] bg-white px-3 py-2 text-xs leading-5 text-[#4f473f]"
                      key={rule}
                    >
                      {rule}
                    </p>
                  ))}
                </div>
                <QueueSummary
                  items={[
                    ["Pending", pendingAdCampaigns.length, "warning"],
                    ["Reviewed", reviewedAdCampaigns.length],
                  ]}
                />
                <div className="space-y-4">
                  <QueueGroup
                    count={pendingAdCampaigns.length}
                    emptyText="No ad campaigns are waiting for review."
                    title="Pending ad review"
                  >
                    {pendingAdCampaigns.map((campaign) => (
                      <AdCampaignCard campaign={campaign} key={campaign.id} />
                    ))}
                  </QueueGroup>
                  <QueueGroup
                    count={reviewedAdCampaigns.length}
                    emptyText="No reviewed campaigns are in this queue yet."
                    title="Recently reviewed ads"
                  >
                    {reviewedAdCampaigns.map((campaign) => (
                      <AdCampaignCard campaign={campaign} key={campaign.id} />
                    ))}
                  </QueueGroup>
                </div>
              </div>

              <div
                className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5"
                id="media-ops"
              >
                <div className="mb-4 flex items-center gap-3">
                  <ImageIcon className="size-5" />
                  <h2 className="text-lg font-bold">Media ops</h2>
                </div>
                <p className="text-sm leading-6 text-[#4f473f]">
                  Keep uploads cheap and reliable first. Add heavier processing
                  only when real usage proves we need thumbnails, transcodes, or
                  separate media services.
                </p>
                <div className="mt-4 grid gap-3">
                  {mediaOpsStages.map(([label, body]) => (
                    <div
                      className="rounded-md border border-[#cfc8bd] bg-white p-3"
                      key={label}
                    >
                      <p className="text-xs font-bold uppercase text-[#766d62]">
                        {label}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-[#4f473f]">
                        {body}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-md border border-[#cfc8bd] bg-[#f2f1ee] p-3">
                  <p className="text-sm font-bold">Cost rules</p>
                  <ul className="mt-2 space-y-2 text-xs leading-5 text-[#766d62]">
                    {mediaCostRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="mail-settings"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Mail className="size-5" />
                  <h2 className="text-lg font-bold">Mail settings</h2>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">Provider</dt>
                    <dd className="font-semibold capitalize">
                      {mailSettings?.provider ?? "hostgator"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">From name</dt>
                    <dd className="font-semibold">
                      {mailSettings?.from_name ?? "TheTattooCore"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">SMTP host</dt>
                    <dd className="font-semibold">
                      {mailSettings?.smtp_host ?? "Not set"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">Secret</dt>
                    <dd className="font-semibold">
                      {mailSettings?.smtp_password_secret_name ??
                        "HOSTGATOR_SMTP_PASSWORD"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">Enabled</dt>
                    <dd className="font-semibold">
                      {mailSettings?.is_enabled ? "Yes" : "No"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <Activity className="size-5" />
                  <h2 className="text-lg font-bold">Recent activity</h2>
                </div>
                {activityItems.length ? (
                  <div className="space-y-3">
                    {activityItems.map((item) => (
                      <article
                        className="rounded-md border border-[#e5ded4] bg-white p-3"
                        key={`${item.kind}-${item.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold capitalize">
                              {item.label}
                            </p>
                            <p className="mt-1 text-xs text-[#766d62]">
                              @{item.actorUsername} - {timeAgo(item.createdAt)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-md bg-[#efe7da] px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
                            {item.kind}
                          </span>
                        </div>
                        {item.context ? (
                          <p className="mt-2 text-xs capitalize text-[#766d62]">
                            {item.context}
                          </p>
                        ) : null}
                        {item.note ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#4f473f]">
                            {item.note}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-[#e5ded4] bg-white p-4 text-sm text-[#4f473f]">
                    No admin or moderation activity has been logged yet.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <Mail className="size-5" />
                  <h2 className="text-lg font-bold">SMTP test</h2>
                </div>
                <MailTestForm
                  defaultRecipient={claims.email}
                  disabled={!mailSettings?.is_enabled || !canSendMailTest}
                />
                {!mailSettings?.is_enabled ? (
                  <p className="mt-3 text-sm text-[#766d62]">
                    Mail sending is disabled in settings.
                  </p>
                ) : !canSendMailTest ? (
                  <p className="mt-3 text-sm text-[#766d62]">
                    Admin or owner role required to send tests.
                  </p>
                ) : null}
              </div>
            </aside>
          </div>
          )}
        </section>
      </div>
    </main>
  );
}

