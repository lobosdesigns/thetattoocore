import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, ChevronLeft, ChevronRight } from "lucide-react";
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
  if (status === "active") return "border-[#b9d7bd] bg-[#eef8ef] text-[#276231]";
  if (status === "under_review") return "border-[#b7c6e8] bg-[#eef3ff] text-[#284f8a]";
  if (status === "removed") return "border-[#e5b8b8] bg-[#fff0f0] text-[#8a2828]";

  return "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]";
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

function GigCard({ gig }: { gig: Gig }) {
  const location = [gig.city, gig.region, gig.country].filter(Boolean).join(", ");

  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{gig.title}</p>
          <p className="mt-1 text-xs text-[#766d62]">
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
          <span className="rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
            {gig.status}
          </span>
        </div>
      </div>
      {gig.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#4f473f]">
          {gig.description}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm text-[#4f473f] sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">Location</dt>
          <dd>{location || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">Starts</dt>
          <dd>{formatDate(gig.startsAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Compensation
          </dt>
          <dd>{gig.compensation || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Visibility
          </dt>
          <dd className="capitalize">{gig.visibility.replace("_", " ")}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="flex h-10 items-center rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold"
          href={`/gigs/${gig.id}`}
        >
          Open gig
        </Link>
        <Link
          className="flex h-10 items-center rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
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
              <h1 className="text-2xl font-bold sm:text-3xl">Gigs</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                50 jobs, conventions, guest spots, and events per page.
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

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Gigs</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalGigs)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Active here</p>
            <p className="mt-2 text-3xl font-bold">{activeCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Needs attention here</p>
            <p className="mt-2 text-3xl font-bold">{needsAttentionCount}</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3 text-sm leading-6 text-[#4f473f]">
          <BriefcaseBusiness className="mt-1 size-5 shrink-0 text-[#c8953b]" />
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
          <p className="mt-4 rounded-md border border-[#e5ded4] bg-[#fffdf9] p-4 text-sm text-[#4f473f]">
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
