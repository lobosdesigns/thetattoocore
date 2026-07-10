import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;

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

function pageHref(page: number) {
  return `/admin/stuff?page=${page}`;
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

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{listing.title}</p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{listing.sellerUsername} - {listing.category} - {timeAgo(listing.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${statusClass(
              listing.moderationStatus,
            )}`}
          >
            {listing.moderationStatus.replace("_", " ")}
          </span>
          <span className="rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
            {listing.status}
          </span>
        </div>
      </div>
      {listing.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#4f473f]">
          {listing.description}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm text-[#4f473f] sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">Price</dt>
          <dd>{money(listing.priceCents, listing.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Location
          </dt>
          <dd>{[listing.city, listing.region].filter(Boolean).join(", ") || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Visibility
          </dt>
          <dd className="capitalize">{listing.visibility.replace("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#766d62]">
            Sensitive
          </dt>
          <dd>{listing.isSensitive ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="flex h-10 items-center rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold"
          href={`/stuff/${listing.id}`}
        >
          Open listing
        </Link>
        <Link
          className="flex h-10 items-center rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
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

  const { count, data: listingRows } = await supabase
    .from("marketplace_listings")
    .select(
      "id, title, description, price_cents, currency, category, city, region, status, moderation_status, visibility, is_sensitive, created_at, profiles:profiles!marketplace_listings_seller_id_fkey(display_name, username)",
      { count: "exact" },
    )
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
    <main className="min-h-screen overflow-x-hidden bg-[#202020] text-[#171412]">
      <section className="mx-auto min-h-screen w-full max-w-6xl bg-[#ece8df] px-4 py-6 sm:px-6 lg:px-8">
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
              <h1 className="text-2xl font-bold sm:text-3xl">Stuff</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                50 marketplace listings per page for seller, status, and pricing review.
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
            <p className="text-sm text-[#766d62]">Listings</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalListings)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Active here</p>
            <p className="mt-2 text-3xl font-bold">{activeCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Needs attention here</p>
            <p className="mt-2 text-3xl font-bold">{restrictedCount}</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3 text-sm leading-6 text-[#4f473f]">
          <ShoppingBag className="mt-1 size-5 shrink-0 text-[#c8953b]" />
          <p>
            Stuff is verified-professional commerce. Fans may browse, but buying,
            selling, trading, and seller contact stay restricted to verified
            artists, studios, and vendors.
          </p>
        </div>

        <Pagination
          currentPage={currentPage}
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
          <p className="mt-4 rounded-md border border-[#e5ded4] bg-[#fffdf9] p-4 text-sm text-[#4f473f]">
            No Stuff listings exist yet.
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
