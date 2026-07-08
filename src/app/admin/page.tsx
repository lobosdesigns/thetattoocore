import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Activity,
  BriefcaseBusiness,
  Flag,
  Gavel,
  ImageIcon,
  Mail,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import {
  changeUserRole,
  changeUserStatus,
  moderateContent,
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
  subjectType: string;
};
type LicenseRequest = {
  accountType: string;
  createdAt: string;
  expiresOn: string | null;
  id: string;
  issuingRegion: string;
  licenseName: string;
  licenseNumber: string | null;
  profileName: string;
  profileUsername: string;
  status: "pending" | "approved" | "rejected";
  signedDocumentUrl: string | null;
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

const adminTabs = [
  [Activity, "Overview"],
  [Users, "Users"],
  [ShieldCheck, "Verification"],
  [Flag, "Reports"],
  [ImageIcon, "Content"],
  [BriefcaseBusiness, "Gigs"],
  [ShoppingBag, "Marketplace"],
  [Mail, "Mail Settings"],
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

function statusLabel(status: ModerationStatus) {
  return status.replace("_", " ");
}

function userStatus(user: Pick<AdminUser, "bannedAt" | "suspendedAt">) {
  if (user.bannedAt) return "banned";
  if (user.suspendedAt) return "suspended";

  return "active";
}

function ReviewCard({ item }: { item: ReviewItem }) {
  return (
    <article className="rounded-md border border-[#e5ded4] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
    <article className="rounded-md border border-[#e5ded4] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold capitalize">
            {report.reason}
          </p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{report.reporterUsername} - {timeAgo(report.createdAt)}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] px-2 py-1 text-xs font-semibold capitalize">
          {report.status}
        </span>
      </div>
      <p className="text-xs font-semibold uppercase text-[#766d62]">
        {report.subjectType.replace("_", " ")}
      </p>
      <p className="mt-1 break-all text-xs text-[#766d62]">
        {report.subjectId}
      </p>
      {report.details ? (
        <p className="mt-3 text-sm leading-6 text-[#4f473f]">{report.details}</p>
      ) : null}
      <form action={updateReportStatus} className="mt-4 space-y-2">
        <input name="report_id" type="hidden" value={report.id} />
        <input
          className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
          maxLength={500}
          name="note"
          placeholder="Report note"
        />
        <div className="grid grid-cols-3 gap-2">
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

function LicenseRequestCard({ request }: { request: LicenseRequest }) {
  const isPending = request.status === "pending";

  return (
    <article className="rounded-md border border-[#e5ded4] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{request.profileName}</p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{request.profileUsername} - {request.accountType} -{" "}
            {timeAgo(request.createdAt)}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
          {request.status}
        </span>
      </div>
      <dl className="grid gap-2 text-sm text-[#4f473f]">
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
        {request.expiresOn ? (
          <div>
            <dt className="text-xs font-semibold uppercase text-[#766d62]">
              Expires
            </dt>
            <dd className="mt-0.5">{request.expiresOn}</dd>
          </div>
        ) : null}
      </dl>
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
            placeholder="Reviewer note"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-10 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
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
      ) : null}
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
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-[#171412]">
        <section className="mx-auto w-full max-w-2xl rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[#171412] text-white">
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
              className="flex h-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
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
    { count: marketplaceQueue },
    { count: moderationActions },
    { data: adminUsers },
    { data: verificationQueue },
    { data: reportQueue },
    { data: feedReview },
    { data: threadReview },
    { data: listingReview },
    { data: gigReview },
    { data: mailSettings },
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
      .limit(16)
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
        "id, account_type, license_name, license_number, issuing_region, expires_on, storage_bucket, storage_path, status, created_at, profiles:profiles!license_verification_requests_profile_id_fkey(display_name, username)",
      )
      .in("status", ["pending", "rejected"])
      .order("created_at", { ascending: false })
      .limit(8)
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
          storage_bucket: string;
          storage_path: string;
          status: "pending" | "approved" | "rejected";
        }[]
      >(),
    supabase
      .from("content_reports")
      .select(
        "id, subject_type, subject_id, reason, details, status, created_at, profiles:profiles!content_reports_reporter_id_fkey(display_name, username)",
      )
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(12)
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
      .limit(6)
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
      .limit(6)
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
      .limit(6)
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
      .limit(6)
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
  ]);

  const metrics = [
    ["Members", userCount, "Profiles created"],
    ["Open reports", openReports, "Needs review"],
    ["License checks", pendingVerifications, "Pending approval"],
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
      expiresOn: request.expires_on,
      id: request.id,
      issuingRegion: request.issuing_region,
      licenseName: request.license_name,
      licenseNumber: request.license_number,
      profileName: request.profiles?.display_name ?? "Member",
      profileUsername: request.profiles?.username ?? "member",
      signedDocumentUrl: signedDocumentUrlByRequest.get(request.id) ?? null,
      status: request.status,
    }),
  );
  const reports: ReportItem[] = (reportQueue ?? []).map((report) => ({
    createdAt: report.created_at,
    details: report.details,
    id: report.id,
    reason: report.reason,
    reporterUsername: report.profiles?.username ?? "member",
    status: report.status,
    subjectId: report.subject_id,
    subjectType: report.subject_type,
  }));
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

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#171412]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[#d8d1c6] bg-[#fffdf9] px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[#171412] text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">Admin</p>
              <p className="text-xs text-[#766d62]">TheTattooCore</p>
            </div>
          </div>

          <nav className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {adminTabs.map(([Icon, label]) => (
              <a
                className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-[#f7f4ef]"
                href={`#${label.toLowerCase().replaceAll(" ", "-")}`}
                key={label}
              >
                <Icon className="size-5" />
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-6 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-3">
            <p className="text-sm font-semibold">{adminProfile.display_name}</p>
            <p className="text-xs text-[#766d62]">
              @{adminProfile.username} - {adminProfile.role}
            </p>
          </div>
        </aside>

        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-[#d8d1c6] pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin dashboard</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                Moderation, user safety, marketplace review, and mail setup.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                className="flex h-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
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

          {params.message ? (
            <p className="mb-6 rounded-md border border-[#d8d1c6] bg-[#efe7da] px-4 py-3 text-sm font-medium">
              {params.message}
            </p>
          ) : null}

          <section
            className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            id="overview"
          >
            {metrics.map(([label, value, caption]) => (
              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-4"
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

          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="space-y-5">
              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="users"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Users className="size-5" />
                  <h2 className="text-lg font-bold">Users and roles</h2>
                </div>
                {!canManageRoles ? (
                  <p className="mb-4 rounded-md border border-[#e5ded4] bg-white p-3 text-sm text-[#4f473f]">
                    Owner role required to promote admins or moderators.
                  </p>
                ) : null}
                <div className="grid gap-3">
                  {users.map((user) => (
                    <article
                      className="rounded-md border border-[#e5ded4] bg-white p-3"
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
                        <div className="grid grid-cols-3 gap-2">
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
                    Artist and studio verification
                  </h2>
                </div>
                {licenseRequests.length ? (
                  <div className="grid gap-3">
                    {licenseRequests.map((request) => (
                      <LicenseRequestCard
                        key={request.id}
                        request={request}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-[#e5ded4] bg-white p-4 text-sm text-[#4f473f]">
                    No artist or studio license submissions are waiting right
                    now.
                  </div>
                )}
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="reports"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Flag className="size-5" />
                  <h2 className="text-lg font-bold">Report queue</h2>
                </div>
                {reports.length ? (
                  <div className="grid gap-3">
                    {reports.map((report) => (
                      <ReportCard key={report.id} report={report} />
                    ))}
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

            <aside className="space-y-5">
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
                  <Settings className="size-5" />
                  <h2 className="text-lg font-bold">Next controls</h2>
                </div>
                <div className="space-y-2 text-sm text-[#4f473f]">
                  <p>Role editor</p>
                  <p>Report detail workflow</p>
                  <p>SMTP test email</p>
                  <p>Audit log explorer</p>
                </div>
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
        </section>
      </div>
    </main>
  );
}
