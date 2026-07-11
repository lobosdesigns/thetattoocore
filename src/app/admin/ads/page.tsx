import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { updateAdCampaignStatus } from "../actions";
import { countryLabel, languageLabel } from "@/lib/localization";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type AdCampaign = {
  advertiserName: string;
  advertiserUsername: string;
  bidCents: number;
  body: string | null;
  campaignType: "artist_growth" | "stuff_listing";
  city: string | null;
  clicks: number;
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
  impressions: number;
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
};

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const adReviewStandards = [
  "Artist ads belong in 4U and Gossip; Stuff ads stay in Stuff.",
  "Reject AI tattoo art claims, AI creator replacement claims, and misleading automation promises.",
  "Reject scratcher promotion, unlicensed studio promotion, unsafe practice claims, and restricted equipment ads.",
  "Reject adult/minor targeting, sensitive personal targeting, hidden behavioral profiling, or unclear sponsor ads.",
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Ads",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number) {
  return `/admin/ads?page=${page}`;
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function adStatusClass(status: AdCampaign["status"]) {
  if (status === "active") return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  if (status === "pending_review") return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
  if (status === "rejected") return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";
  if (status === "paused") return "border-[color-mix(in_srgb,#5078c8_35%,var(--card-rim))] bg-[color-mix(in_srgb,#5078c8_10%,var(--paper-warm))] text-[color-mix(in_srgb,#284f8a_78%,var(--foreground))]";

  return "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[var(--muted)]";
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

function targetingText(campaign: AdCampaign) {
  return (
    [
      campaign.city,
      campaign.region,
      countryLabel(campaign.countryCode),
      campaign.language ? languageLabel(campaign.language) : null,
    ]
      .filter(Boolean)
      .join(", ") || "Broad"
  );
}

function clickRate({ clicks, impressions }: Pick<AdCampaign, "clicks" | "impressions">) {
  if (!impressions) return "0.0%";

  return `${((clicks / impressions) * 100).toFixed(1)}%`;
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

function AdCampaignCard({
  campaign,
  currentPage,
}: {
  campaign: AdCampaign;
  currentPage: number;
}) {
  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <p className="truncate text-base font-bold">{campaign.name}</p>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            @{campaign.advertiserUsername} - {adLabel(campaign.campaignType)} -{" "}
            {timeAgo(campaign.createdAt)}
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
      <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
        <p className="text-sm font-semibold">{campaign.title}</p>
        {campaign.body ? (
          <p className="mt-1 line-clamp-3 text-sm leading-5 text-[var(--muted)]">
            {campaign.body}
          </p>
        ) : null}
        {campaign.targetUrl ? (
          <p className="mt-2 truncate text-xs text-[var(--muted-strong)]">
            {campaign.targetUrl}
          </p>
        ) : null}
      </div>
      <dl className="mt-3 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Goal</dt>
          <dd className="mt-0.5 capitalize">{adLabel(campaign.goal)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Bid / daily cap
          </dt>
          <dd className="mt-0.5">
            {dollars(campaign.bidCents)} / {dollars(campaign.dailyBudgetCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Placements
          </dt>
          <dd className="mt-0.5">
            {campaign.placements.length
              ? campaign.placements.map(adLabel).join(", ")
              : "No placement selected"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Targeting
          </dt>
          <dd className="mt-0.5">{targetingText(campaign)}</dd>
        </div>
      </dl>
      {campaign.keywords.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {campaign.keywords.slice(0, 10).map((keyword) => (
            <span
              className="rounded-md bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-2 py-1 text-xs font-medium"
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
            className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-2"
            key={label}
          >
            <p className="font-bold text-[var(--foreground)]">{value}</p>
            <p className="mt-1 text-[var(--muted-strong)]">{label}</p>
          </div>
        ))}
      </div>
      {campaign.reviewerNote ? (
        <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-xs text-[var(--muted)]">
          {campaign.reviewerNote}
        </p>
      ) : null}
      <form action={updateAdCampaignStatus} className="mt-4 space-y-2">
        <input name="campaign_id" type="hidden" value={campaign.id} />
        <input name="return_to" type="hidden" value={pageHref(currentPage)} />
        <input
          className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
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
                  ? "h-10 rounded-md bg-[var(--foreground)] px-2 text-sm font-semibold text-[var(--background)]"
                  : value === "archived"
                    ? "h-10 rounded-md border border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-2 text-sm font-semibold text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_14%,var(--paper-warm))]"
                    : "h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)]"
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

export default async function AdminAdsPage({
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

  const { count, data: adCampaignRows } = await supabase
    .from("ad_campaigns")
    .select(
      "id, name, title, body, target_url, campaign_type, goal, status, bid_cents, daily_budget_cents, country_code, region, city, language, keywords, starts_at, ends_at, reviewer_note, created_at, profiles:profiles!ad_campaigns_advertiser_id_fkey(display_name, username), ad_campaign_placements(placement), ad_events(event_type)",
      { count: "exact" },
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
    .range(from, to)
    .returns<
      {
        ad_campaign_placements: { placement: "4u" | "gossip" | "stuff" }[];
        ad_events: { event_type: "impression" | "click" | "message_lead" }[];
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
    >();
  const campaigns: AdCampaign[] = (adCampaignRows ?? []).map((campaign) => ({
    advertiserName: campaign.profiles?.display_name ?? "Advertiser",
    advertiserUsername: campaign.profiles?.username ?? "advertiser",
    bidCents: campaign.bid_cents,
    body: campaign.body,
    campaignType: campaign.campaign_type,
    city: campaign.city,
    clicks: campaign.ad_events.filter((event) => event.event_type === "click").length,
    countryCode: campaign.country_code,
    createdAt: campaign.created_at,
    dailyBudgetCents: campaign.daily_budget_cents,
    endsAt: campaign.ends_at,
    goal: campaign.goal,
    id: campaign.id,
    impressions: campaign.ad_events.filter(
      (event) => event.event_type === "impression",
    ).length,
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
  }));
  const totalCampaigns = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCampaigns / pageSize));
  const hasNextPage = currentPage < totalPages;
  const pendingCampaigns = campaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const reviewedCampaigns = campaigns.filter(
    (campaign) => campaign.status !== "pending_review",
  );

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
              <h1 className="text-2xl font-bold sm:text-3xl">Ads</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                50 campaigns per page for advertiser review, placement checks, and status updates.
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
            <p className="text-sm text-[var(--muted-strong)]">Campaigns</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalCampaigns)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Pending here</p>
            <p className="mt-2 text-3xl font-bold">{pendingCampaigns.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Reviewed here</p>
            <p className="mt-2 text-3xl font-bold">{reviewedCampaigns.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Review gate</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="size-5 text-[var(--gold)]" />
              Moderator+
            </p>
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {adReviewStandards.map((rule) => (
            <p
              className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted)]"
              key={rule}
            >
              {rule}
            </p>
          ))}
        </div>

        <Pagination
          currentPage={currentPage}
          hasNextPage={hasNextPage}
          totalPages={totalPages}
        />

        {campaigns.length ? (
          <section className="mt-4 grid gap-4">
            {campaigns.map((campaign) => (
              <AdCampaignCard
                campaign={campaign}
                currentPage={currentPage}
                key={campaign.id}
              />
            ))}
          </section>
        ) : (
          <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
            No ad campaigns are in the review or active campaign queues yet.
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
