import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Activity,
  BriefcaseBusiness,
  CircleHelp,
  CreditCard,
  Flag,
  ImageIcon,
  Mail,
  Megaphone,
  Package,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";
import { titleCaseStatus } from "@/lib/status-labels";
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
  subjectType:
    | "feed_post"
    | "gig"
    | "marketplace_listing"
    | "merch_product"
    | "thread_post";
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
  campaignType: "artist_growth" | "stuff_listing" | "merch_listing";
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
    | "marketplace_engagement"
    | "product_views"
    | "shop_visits"
    | "purchases";
  id: string;
  keywords: string[];
  language: string | null;
  name: string;
  placements: ("4u" | "gossip" | "stuff" | "merch")[];
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
  [Package, "Merch", "/admin/merch"],
  [Megaphone, "Ads", "/admin/ads"],
  [CreditCard, "Payments", "/admin/payments"],
  [Mail, "Mail Settings", "/admin/mail-settings"],
  [CircleHelp, "Help", "/help"],
] as const;

const mediaOpsStages = [
  [
    "Live now",
    "Browser image optimization, saved-size feedback, file checks, dimension checks, and 60-second MP4/MOV reel validation.",
  ],
  [
    "Next",
    "Add generated thumbnails and poster images so feeds, search, profiles, and share previews can load lighter previews before full media opens.",
  ],
  [
    "Scale trigger",
    "Upgrade active reels when usage justifies smoother playback, automatic poster images, and faster browsing.",
  ],
  [
    "Later",
    "Add retry tools for poster generation, moderation thumbnails, failed media jobs, and post-upload safety review.",
  ],
] as const;

const mediaCostRules = [
  "Use the current delivery path first for safety and image-delivery polish before adding new paid media products.",
  "Keep original media on the current private path while early traffic is small.",
  "Keep company email and static backups separate from active user media or video delivery.",
  "Use client-side image compression first because it is free and reduces storage before upload.",
  "Keep current reel caps strict: 60 seconds and 50 MB for now.",
  "Do not enable paid video upgrades until reels are getting enough real usage to justify it.",
  "Consider managed image and video upgrades only after upload volume grows.",
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

function fileNameFromPath(path: string) {
  const name = path.split("/").filter(Boolean).at(-1);
  return name || "License document";
}

function activityLabel(value: string) {
  return titleCaseStatus(value);
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
  if (actionType === "warn_member") return "Recorded member warning";
  if (actionType === "escalate_report") return "Escalated report";

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

function isPriorityReport(reason: string) {
  return [
    "harassment or hate",
    "illegal goods or services",
    "minor safety concern",
    "sexual content",
    "unsafe practice",
  ].includes(reason);
}

function adminLoginPath() {
  return `/login?return_to=${encodeURIComponent("/admin")}`;
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
    redirect(adminLoginPath());
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, role")
    .eq("id", claims.sub)
    .maybeSingle<{ username: string; display_name: string; role: UserRole }>();

  if (!profile || !moderateRoles.includes(profile.role)) {
    return (
      <main className="ttc-page min-h-screen px-4 py-8">
        <section className="ttc-card mx-auto w-full max-w-2xl rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--gold)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin access required</h1>
              <p className="text-sm text-[var(--muted-strong)]">{claims.email}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">
            This account is signed in, but it has not been assigned an admin or
            moderator role yet.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              className="flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
              href="/account"
            >
              Open profile
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
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
    { data: merchReview },
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
      .from("merch_products")
      .select(
        "id, title, description, created_at, moderation_status, profiles:profiles!merch_products_seller_id_fkey(display_name, username)",
      )
      .neq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<
        {
          created_at: string;
          description: string | null;
          id: string;
          moderation_status: ModerationStatus;
          profiles: { display_name: string; username: string } | null;
          title: string;
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
          ad_campaign_placements: { placement: "4u" | "gossip" | "stuff" | "merch" }[];
          bid_cents: number;
          body: string | null;
          campaign_type: "artist_growth" | "stuff_listing" | "merch_listing";
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
            | "marketplace_engagement"
            | "product_views"
            | "shop_visits"
            | "purchases";
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
      const ids = reportSubjectIds("merch_product");
      if (!ids.length) return;

      const { data } = await supabase
        .from("merch_products")
        .select(
          "id, title, description, profiles:profiles!merch_products_seller_id_fkey(username)",
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

      for (const product of data ?? []) {
        reportSubjectPreviews.set(
          reportSubjectKey("merch_product", product.id),
          {
            ownerUsername: product.profiles?.username ?? null,
            preview: product.description,
            title: product.title,
          },
        );
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
    ...(merchReview ?? []).map((product) => ({
      authorName: product.profiles?.display_name ?? "Seller",
      authorUsername: product.profiles?.username ?? "seller",
      body: product.description,
      createdAt: product.created_at,
      id: product.id,
      isSensitive: false,
      sensitiveReason: null,
      status: product.moderation_status,
      subjectType: "merch_product" as const,
      title: product.title,
      visibility: "public_preview" as const,
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
      action: "Open verification",
      body: "Artist, studio, and vendor license approval has a dedicated queue page.",
      count: pendingLicenseRequests.length,
      href: "/admin/verification",
      label: "Verification",
      meta: `${approvedLicenseRequests.length} approved / ${rejectedLicenseRequests.length} rejected in latest slice`,
    },
    {
      action: "Open reports",
      body: "Content reports have a dedicated review page with status controls and pagination.",
      count: reports.length,
      href: "/admin/reports",
      label: "Reports",
      meta: `${priorityOpenReportItems.length} priority open`,
    },
    {
      action: "Open ads",
      body: "Campaign review, placements, bids, and performance live on a dedicated ads page.",
      count: pendingAdCampaigns.length,
      href: "/admin/ads",
      label: "Ads",
      meta: `${reviewedAdCampaigns.length} reviewed in latest slice`,
    },
    {
      action: "Open data requests",
      body: "Deletion and privacy requests need a focused operational page and audit history.",
      count: openAccountDeletionRequests.length,
      href: "/admin/data-requests",
      label: "Data requests",
      meta: `${closedAccountDeletionRequests.length} recently closed`,
    },
    {
      action: "Open content",
      body: "4U, Gossip, Stuff, Gigs, and Merch moderation now live on a focused paged content queue.",
      count: reviewItems.length,
      href: "/admin/content",
      label: "Content",
      meta: `${pendingAdCampaigns.length + reports.length + reviewItems.length} combined active queue signals`,
    },
    {
      action: "Open Stuff",
      body: "Verified-only Stuff listings get their own paged review page for seller, price, status, and access checks.",
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
      action: "Open Merch",
      body: "Public-buyable artist, studio, vendor, and official TTC products get their own paged product and order review page.",
      count: merchReview?.length ?? 0,
      href: "/admin/merch",
      label: "Merch",
      meta: `${merchReview?.length ?? 0} latest product review signals`,
    },
    {
      action: "Open payments",
      body: "Checkout receipts, payment status, refund status, and payout readiness live on a focused ops page.",
      count: 0,
      href: "/admin/payments",
      label: "Payments",
      meta: "Payment events, Merch orders, and ad payments",
    },
    {
      action: "Open mail",
      body: "Mail status, sender identity, secure credentials, and test tools now live on a focused settings page.",
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
    {
      action: "Open Help",
      body: "Self-serve tutorials and guide questions reduce repeated support requests for setup, ads, Merch, bookings, verification, and safety.",
      count: 0,
      href: "/help",
      label: "Help Center",
      meta: "Guides, FAQs, and moderated article questions",
    },
  ];
  const launchReadinessItems = [
    {
      body: "Confirm payout setup, refund/dispute handling, and booking-deposit review before real money opens wider.",
      href: "/admin/payments",
      label: "Payment gates",
    },
    {
      body: "Review seller readiness, fulfillment notes, return/refund notes, and paid-order handling before promoting products.",
      href: "/admin/merch",
      label: "Merch readiness",
    },
    {
      body: "Keep verification, content, reports, and data requests clear enough for the first member wave.",
      href: "/admin/verification",
      label: "Trust queues",
    },
    {
      body: "Fill priority guides with screenshot or short-video tutorial slots so members can self-serve setup questions.",
      href: "/help",
      label: "Help coverage",
    },
    {
      body: "Run real-device checks for login, signup, DMs, posting, booking, payouts, and mobile layout before store pushes.",
      href: "/admin/media-ops",
      label: "Beta QA",
    },
    {
      body: "Confirm support/legal copy, privacy answers, safe screenshots, native auth, payment review, and QA evidence before external app review.",
      href: "/admin/media-ops",
      label: "App handoff",
    },
  ];

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_28px_90px_rgba(0,0,0,0.42)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-[color-mix(in_srgb,var(--gold)_34%,transparent)] bg-[#090806] px-5 py-5 text-white backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--gold)_55%,transparent)] bg-[color-mix(in_srgb,var(--gold)_16%,#090806)] text-[var(--gold)] shadow-[0_0_20px_rgba(200,149,59,0.18)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Admin</p>
              <p className="text-xs text-white/70">TheTattooCore</p>
            </div>
          </div>

          <nav className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto pb-1 lg:mx-0 lg:grid lg:grid-cols-1 lg:overflow-visible">
            {adminTabs.map(([Icon, label, href]) => (
              <a
                className="flex h-11 shrink-0 items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white backdrop-blur hover:border-[color-mix(in_srgb,var(--gold)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--gold)_15%,transparent)] lg:w-full"
                href={href}
                key={label}
              >
                <Icon className="size-5 text-[var(--gold)]" />
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-6 rounded-md border border-white/15 bg-white/10 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-sm font-semibold text-white">{adminProfile.display_name}</p>
            <p className="text-xs text-white/70">
              @{adminProfile.username} - {adminProfile.role}
            </p>
          </div>
        </aside>

        <section className="ttc-page-panel min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-[var(--card-rim)] pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin dashboard</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                Moderation, user safety, marketplace review, and mail setup.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                href="/help"
              >
                Help
              </Link>
              <Link
                className="flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                href="/"
              >
                Site
              </Link>
              <Link
                className="flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                href="/account"
              >
                Account
              </Link>
            </div>
          </header>

          <nav className="no-scrollbar sticky top-0 z-10 -mx-4 mb-6 flex gap-2 overflow-x-auto border-y border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_95%,transparent)] px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
            {adminTabs.map(([Icon, label, href]) => (
              <a
                className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_90%,transparent)] px-3 text-xs font-bold shadow-sm"
                href={href}
                key={label}
              >
                <Icon className="size-4 text-[var(--gold)]" />
                {label}
              </a>
            ))}
          </nav>

          {params.message ? (
            <p className="mb-6 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm font-medium">
              {params.message}
            </p>
          ) : null}

          <section
            className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
            id="overview"
          >
            {metrics.map(([label, value, caption]) => (
              <div
                className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
                key={label as string}
              >
                <p className="text-sm text-[var(--muted-strong)]">{caption as string}</p>
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
                className="ttc-card flex min-h-48 flex-col justify-between rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 hover:border-[var(--gold)]"
                href={card.href}
                key={card.label}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold">{card.label}</h2>
                    <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1 text-xs font-bold text-[var(--muted)]">
                      {formatCount(card.count)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {card.body}
                  </p>
                  <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
                    {card.meta}
                  </p>
                </div>
                <span className="mt-4 text-sm font-bold text-[var(--foreground)]">
                  {card.action}
                </span>
              </Link>
            ))}
          </section>

          <section className="mb-6 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,var(--gold)_8%)] p-5 shadow-[0_16px_55px_rgba(0,0,0,0.16)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--gold)]">
                  Launch readiness
                </p>
                <h2 className="mt-2 text-2xl font-black">One-week beta push</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Keep the overview focused on the highest-risk gates, then jump
                  into the dedicated pages for the actual work.
                </p>
              </div>
              <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[var(--foreground)] px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--background)]">
                Command center
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {launchReadinessItems.map((item) => (
                <Link
                  className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm hover:border-[var(--gold)]"
                  href={item.href}
                  key={item.label}
                >
                  <p className="font-black">{item.label}</p>
                  <p className="mt-2 leading-5 text-[var(--muted)]">
                    {item.body}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
            <div className="flex items-center gap-3">
              <Activity className="size-5" />
              <h2 className="text-lg font-bold">Recent activity</h2>
            </div>
            {activityItems.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {activityItems.slice(0, 6).map((item) => (
                  <article
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                    key={`${item.kind}-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted-strong)]">
                          @{item.actorUsername} - {timeAgo(item.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-2 py-1 text-xs font-semibold capitalize text-[var(--muted)]">
                        {item.kind}
                      </span>
                    </div>
                    {item.context ? (
                      <p className="mt-2 text-xs capitalize text-[var(--muted-strong)]">
                        {item.context}
                      </p>
                    ) : null}
                    {item.note ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--muted)]">
                        {item.note}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4 text-sm text-[var(--muted)]">
                No admin or moderation activity has been logged yet.
              </p>
            )}
          </section>

          <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            This overview intentionally stays short. Full queues belong on
            dedicated admin pages so Users, Ads, Reports, Verification, Stuff,
            Merch, Gigs, Mail, and Data Requests can scale without turning the
            dashboard into a long scroll.
          </p>

        </section>
      </div>
    </main>
  );
}

