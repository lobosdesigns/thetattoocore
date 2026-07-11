import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminSectionNav } from "../admin-section-nav";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type Gig = {
  category: string;
  city: string | null;
  compensation: string | null;
  contactUrl: string | null;
  country: string | null;
  createdAt: string;
  description: string | null;
  endsAt: string | null;
  id: string;
  isSensitive: boolean;
  moderationStatus: "active" | "under_review" | "hidden" | "removed";
  posterName: string;
  posterUsername: string;
  region: string | null;
  startsAt: string | null;
  status: "active" | "filled" | "archived";
  title: string;
  visibility: "public_preview" | "members" | "private";
};

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Gigs",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number) {
  return `/admin/gigs?page=${page}`;
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
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function statusClass(status: Gig["moderationStatus"]) {
  if (status === "active") return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  if (status === "under_review") return "border-[color-mix(in_srgb,#5078c8_35%,var(--card-rim))] bg-[color-mix(in_srgb,#5078c8_10%,var(--paper-warm))] text-[color-mix(in_srgb,#284f8a_78%,var(--foreground))]";
  if (status === "removed") return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";

  return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
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

function GigCard({ gig }: { gig: Gig }) {
  const location = [gig.city, gig.region, gig.country].filter(Boolean).join(", ");

  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{gig.title}</p>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            @{gig.posterUsername} - {gig.category.replace("_", " ")} - {timeAgo(gig.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${statusClass(
              gig.moderationStatus,
            )}`}
          >
            {gig.moderationStatus.replace("_", " ")}
          </span>
          <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1 text-xs font-semibold capitalize text-[var(--muted)]">
            {gig.status}
          </span>
        </div>
      </div>
      {gig.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
          {gig.description}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Location</dt>
          <dd>{location || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Starts</dt>
          <dd>{formatDate(gig.startsAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Compensation
          </dt>
          <dd>{gig.compensation || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Visibility
          </dt>
          <dd className="capitalize">{gig.visibility.replace("_", " ")}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="flex h-10 items-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold"
          href={`/gigs/${gig.id}`}
        >
          Open gig
        </Link>
        <Link
          className="flex h-10 items-center rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)]"
          href="/admin/content?type=gig&page=1"
        >
          Moderate in Content
        </Link>
      </div>
    </article>
  );
}

export default async function AdminGigsPage({
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

  const { count, data: gigRows } = await supabase
    .from("gigs")
    .select(
      "id, title, description, category, city, region, country, starts_at, ends_at, compensation, contact_url, status, moderation_status, visibility, is_sensitive, created_at, profiles:profiles!gigs_poster_id_fkey(display_name, username)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      {
        category: string;
        city: string | null;
        compensation: string | null;
        contact_url: string | null;
        country: string | null;
        created_at: string;
        description: string | null;
        ends_at: string | null;
        id: string;
        is_sensitive: boolean;
        moderation_status: "active" | "under_review" | "hidden" | "removed";
        profiles: { display_name: string; username: string } | null;
        region: string | null;
        starts_at: string | null;
        status: "active" | "filled" | "archived";
        title: string;
        visibility: "public_preview" | "members" | "private";
      }[]
    >();

  const gigs: Gig[] = (gigRows ?? []).map((gig) => ({
    category: gig.category,
    city: gig.city,
    compensation: gig.compensation,
    contactUrl: gig.contact_url,
    country: gig.country,
    createdAt: gig.created_at,
    description: gig.description,
    endsAt: gig.ends_at,
    id: gig.id,
    isSensitive: gig.is_sensitive,
    moderationStatus: gig.moderation_status,
    posterName: gig.profiles?.display_name ?? "Member",
    posterUsername: gig.profiles?.username ?? "member",
    region: gig.region,
    startsAt: gig.starts_at,
    status: gig.status,
    title: gig.title,
    visibility: gig.visibility,
  }));
  const totalGigs = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalGigs / pageSize));
  const hasNextPage = currentPage < totalPages;
  const activeCount = gigs.filter((gig) => gig.status === "active").length;
  const needsAttentionCount = gigs.filter(
    (gig) => gig.moderationStatus !== "active" || gig.isSensitive,
  ).length;

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
              <h1 className="text-2xl font-bold sm:text-3xl">Gigs</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                50 jobs, conventions, guest spots, and events per page.
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

        <AdminSectionNav activeHref="/admin/gigs" />

        {params.message ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Gigs</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalGigs)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Active here</p>
            <p className="mt-2 text-3xl font-bold">{activeCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Needs attention here</p>
            <p className="mt-2 text-3xl font-bold">{needsAttentionCount}</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm leading-6 text-[var(--muted)]">
          <BriefcaseBusiness className="mt-1 size-5 shrink-0 text-[var(--gold)]" />
          <p>
            Gigs covers jobs, conventions, guest spots, apprenticeships, shop
            openings, and body-art events. Keep listings professional and clear
            enough for public previews.
          </p>
        </div>

        <Pagination
          currentPage={currentPage}
          hasNextPage={hasNextPage}
          totalPages={totalPages}
        />

        {gigs.length ? (
          <section className="mt-4 grid gap-4">
            {gigs.map((gig) => (
              <GigCard key={gig.id} gig={gig} />
            ))}
          </section>
        ) : (
          <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
            No Gigs exist yet.
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
