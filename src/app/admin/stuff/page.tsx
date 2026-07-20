import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { AdminSectionNav } from "../admin-section-nav";
import { titleCaseStatus } from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";
import { safeStatusMessage } from "@/lib/status-message";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type Listing = {
  category: string;
  city: string | null;
  createdAt: string;
  currency: string | null;
  description: string | null;
  id: string;
  isSensitive: boolean;
  moderationStatus: "active" | "under_review" | "hidden" | "removed";
  priceCents: number | null;
  region: string | null;
  sellerName: string;
  sellerUsername: string;
  status: string;
  title: string;
  visibility: "public_preview" | "members" | "private";
};
type StuffStatus = Listing["status"] | "all";
type ModerationStatus = Listing["moderationStatus"] | "all";

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const stuffStatuses = ["all", "draft", "active", "sold", "archived"] as const;
const moderationStatuses = ["all", "active", "under_review", "hidden", "removed"] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Stuff",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function filterValue<const T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T,
): T[number] {
  const rawValue = singleParam(value);

  return allowed.includes(rawValue ?? "") ? (rawValue as T[number]) : allowed[0];
}

function stuffFilters({
  moderationStatus,
  status,
}: {
  moderationStatus?: string | string[];
  status?: string | string[];
}) {
  return {
    moderationStatus: filterValue(moderationStatus, moderationStatuses) as ModerationStatus,
    status: filterValue(status, stuffStatuses) as StuffStatus,
  };
}

function pageHref(
  page: number,
  filters: ReturnType<typeof stuffFilters> = {
    moderationStatus: "all",
    status: "all",
  },
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.moderationStatus !== "all") {
    params.set("moderation_status", filters.moderationStatus);
  }

  return `/admin/stuff?${params.toString()}`;
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function money(cents: number | null, currency: string | null) {
  if (cents == null) return "Contact";

  return Intl.NumberFormat("en-US", {
    currency: currency || "USD",
    style: "currency",
  }).format(cents / 100);
}

function statusClass(status: Listing["moderationStatus"]) {
  if (status === "active") return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  if (status === "under_review") return "border-[color-mix(in_srgb,#5078c8_35%,var(--card-rim))] bg-[color-mix(in_srgb,#5078c8_10%,var(--paper-warm))] text-[color-mix(in_srgb,#284f8a_78%,var(--foreground))]";
  if (status === "removed") return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";

  return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
}

function Pagination({
  currentPage,
  filters,
  hasNextPage,
  totalPages,
}: {
  currentPage: number;
  filters: ReturnType<typeof stuffFilters>;
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
          href={pageHref(Math.max(1, currentPage - 1), filters)}
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
          href={pageHref(currentPage + 1, filters)}
        >
          Next 50
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{listing.title}</p>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            @{listing.sellerUsername} - {listing.category} - {timeAgo(listing.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${statusClass(
              listing.moderationStatus,
            )}`}
          >
            {titleCaseStatus(listing.moderationStatus)}
          </span>
          <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1 text-xs font-semibold capitalize text-[var(--muted)]">
            {listing.status}
          </span>
        </div>
      </div>
      {listing.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
          {listing.description}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Price</dt>
          <dd>{money(listing.priceCents, listing.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Location
          </dt>
          <dd>{[listing.city, listing.region].filter(Boolean).join(", ") || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Visibility
          </dt>
          <dd className="capitalize">{listing.visibility.replace("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Sensitive
          </dt>
          <dd>{listing.isSensitive ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="flex h-10 items-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold"
          href={`/stuff/${listing.id}`}
        >
          Open listing
        </Link>
        <Link
          className="flex h-10 items-center rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)]"
          href="/admin/content?type=marketplace_listing&page=1"
        >
          Moderate in Content
        </Link>
      </div>
    </article>
  );
}

export default async function AdminStuffPage({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string | string[];
    moderation_status?: string | string[];
    page?: string | string[];
    status?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const statusMessage = safeStatusMessage(params.message);
  const filters = stuffFilters({
    moderationStatus: params.moderation_status,
    status: params.status,
  });
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

  let listingsQuery = supabase
    .from("marketplace_listings")
    .select(
      "id, title, description, price_cents, currency, category, city, region, status, moderation_status, visibility, is_sensitive, created_at, profiles:profiles!marketplace_listings_seller_id_fkey(display_name, username)",
      { count: "exact" },
    )
    .in("status", ["draft", "active", "sold", "archived"])
    .in("moderation_status", ["active", "under_review", "hidden", "removed"]);

  if (filters.status !== "all") {
    listingsQuery = listingsQuery.eq("status", filters.status);
  }

  if (filters.moderationStatus !== "all") {
    listingsQuery = listingsQuery.eq("moderation_status", filters.moderationStatus);
  }

  const { count, data: listingRows } = await listingsQuery
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      {
        category: string;
        city: string | null;
        created_at: string;
        currency: string | null;
        description: string | null;
        id: string;
        is_sensitive: boolean;
        moderation_status: "active" | "under_review" | "hidden" | "removed";
        price_cents: number | null;
        profiles: { display_name: string; username: string } | null;
        region: string | null;
        status: string;
        title: string;
        visibility: "public_preview" | "members" | "private";
      }[]
    >();
  const listings: Listing[] = (listingRows ?? []).map((listing) => ({
    category: listing.category,
    city: listing.city,
    createdAt: listing.created_at,
    currency: listing.currency,
    description: listing.description,
    id: listing.id,
    isSensitive: listing.is_sensitive,
    moderationStatus: listing.moderation_status,
    priceCents: listing.price_cents,
    region: listing.region,
    sellerName: listing.profiles?.display_name ?? "Seller",
    sellerUsername: listing.profiles?.username ?? "seller",
    status: listing.status,
    title: listing.title,
    visibility: listing.visibility,
  }));
  const totalListings = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalListings / pageSize));
  const hasNextPage = currentPage < totalPages;
  const activeCount = listings.filter((listing) => listing.status === "active").length;
  const restrictedCount = listings.filter(
    (listing) =>
      listing.moderationStatus !== "active" || listing.isSensitive || listing.status !== "active",
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
              <h1 className="text-2xl font-bold sm:text-3xl">Stuff</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                50 Stuff listings per page for seller, status, and pricing review.
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

        <AdminSectionNav activeHref="/admin/stuff" />

        {statusMessage ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm font-medium">
            {statusMessage}
          </p>
        ) : null}

        <form
          action="/admin/stuff"
          className="mb-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
        >
          <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Filter Stuff
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="grid gap-1 text-sm font-semibold">
              Listing status
              <select
                className="min-h-11 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)]"
                defaultValue={filters.status}
                name="status"
              >
                {stuffStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All listing statuses" : titleCaseStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Moderation
              <select
                className="min-h-11 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)]"
                defaultValue={filters.moderationStatus}
                name="moderation_status"
              >
                {moderationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All moderation states" : titleCaseStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button className="h-11 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                Apply
              </button>
              <Link
                className="flex h-11 items-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                href="/admin/stuff"
              >
                Clear
              </Link>
            </div>
          </div>
        </form>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Listings</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalListings)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Active here</p>
            <p className="mt-2 text-3xl font-bold">{activeCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Needs attention here</p>
            <p className="mt-2 text-3xl font-bold">{restrictedCount}</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm leading-6 text-[var(--muted)]">
          <ShoppingBag className="mt-1 size-5 shrink-0 text-[var(--gold)]" />
          <p>
            Stuff is verified-professional commerce. Fans may browse, but buying,
            selling, trading, and seller contact stay restricted to verified
            artists, studios, and vendors.
          </p>
        </div>

        <Pagination
          currentPage={currentPage}
          filters={filters}
          hasNextPage={hasNextPage}
          totalPages={totalPages}
        />

        {listings.length ? (
          <section className="mt-4 grid gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </section>
        ) : (
          <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
            No Stuff listings exist yet.
          </p>
        )}

        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            filters={filters}
            hasNextPage={hasNextPage}
            totalPages={totalPages}
          />
        </div>
      </section>
    </main>
  );
}
