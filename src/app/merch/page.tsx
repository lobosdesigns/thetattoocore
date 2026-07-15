import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BadgeCheck,
  ImageIcon,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { ContentReportForm } from "@/app/content-report-form";
import { LogoLockup } from "@/app/logo-mark";
import { ProfileAvatar } from "@/app/profile-avatar";
import { SavedItemButton } from "@/app/saved-item-button";
import { CompactShareButton } from "@/app/share-actions";
import { createClient } from "@/lib/supabase/server";
import { siteName, siteUrl } from "@/lib/site";
import { isVerifiedProfessional } from "@/lib/verification";

type Claims = {
  sub: string;
};

type Profile = {
  account_type: string;
  avatar_url?: string | null;
  city: string | null;
  display_name: string;
  id: string;
  license_verified_at?: string | null;
  region: string | null;
  username: string;
};

type MerchMedia = {
  id: string;
  media_type: "image" | "video";
  sort_order: number;
  storage_bucket: string;
  storage_path: string;
};

type MerchProduct = {
  category: string;
  created_at: string;
  currency: string;
  description: string | null;
  id: string;
  inventory_quantity: number;
  inventory_reserved: number;
  is_official: boolean;
  merch_product_media: MerchMedia[];
  price_cents: number;
  profiles: Profile | null;
  shipping_required: boolean;
  title: string;
};

const pageSize = 25;

const merchCategoryFilters = [
  ["all", "All"],
  ["apparel", "Apparel"],
  ["print", "Prints"],
  ["art", "Art"],
  ["sticker", "Stickers"],
  ["accessory", "Accessories"],
  ["other", "Other"],
] as const;

const merchSortOptions = [
  ["newest", "Newest"],
  ["price_low", "Low price"],
  ["price_high", "High price"],
  ["available", "Available"],
] as const;

type MerchCategoryFilter = (typeof merchCategoryFilters)[number][0];
type MerchSort = (typeof merchSortOptions)[number][0];

type MerchIndexProps = {
  searchParams?: Promise<{
    category?: string;
    page?: string;
    q?: string;
    sort?: string;
  }>;
};

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/merch`,
  },
  description:
    "Browse approved TheTattooCore merch from verified artists, studios, vendors, and official TTC drops.",
  openGraph: {
    description:
      "Approved artist, studio, vendor, and official TheTattooCore merch.",
    title: `Merch | ${siteName}`,
    type: "website",
    url: `${siteUrl}/merch`,
  },
  title: `Merch | ${siteName}`,
};

function mediaUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function money(cents: number, currency: string) {
  return Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function formatCategory(value: string) {
  return value.replaceAll("_", " ");
}

function productHref({
  category,
  page = 1,
  query,
  sort,
}: {
  category: MerchCategoryFilter;
  page?: number;
  query: string;
  sort: MerchSort;
}) {
  const params = new URLSearchParams();

  if (query) params.set("q", query);
  if (category !== "all") params.set("category", category);
  if (sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `/merch?${qs}` : "/merch";
}

function VerifiedBadge({ profile }: { profile?: Profile | null }) {
  if (!isVerifiedProfessional(profile)) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-2 py-1 text-xs font-semibold text-[var(--background)]">
      <BadgeCheck className="size-3" />
      Verified
    </span>
  );
}

function ProductMedia({ media, title }: { media?: MerchMedia; title: string }) {
  if (!media) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))]">
        <ImageIcon className="size-10 text-[var(--muted-strong)]" />
      </div>
    );
  }

  if (media.media_type === "video") {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-[var(--ink)] text-[var(--paper-warm)]">
        <Package className="size-10" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={title}
      className="aspect-[4/3] w-full bg-[var(--ink)] object-cover"
      src={mediaUrl(media.storage_bucket, media.storage_path)}
    />
  );
}

export default async function MerchIndexPage({ searchParams }: MerchIndexProps) {
  const params = (await searchParams) ?? {};
  const activeCategory = merchCategoryFilters.some(
    ([value]) => value === params.category,
  )
    ? (params.category as MerchCategoryFilter)
    : "all";
  const activeSort = merchSortOptions.some(([value]) => value === params.sort)
    ? (params.sort as MerchSort)
    : "newest";
  const query = (params.q ?? "")
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const currentPage = Math.max(1, Math.min(20, Number(params.page ?? "1") || 1));
  const limit = currentPage * pageSize;
  const fetchLimit = limit + pageSize;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
  let productQuery = supabase
    .from("merch_products")
    .select(
      "id, title, description, category, price_cents, currency, inventory_quantity, inventory_reserved, shipping_required, is_official, created_at, merch_product_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!merch_products_seller_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
    )
    .eq("status", "active")
    .eq("moderation_status", "active");

  if (activeCategory !== "all") {
    productQuery = productQuery.eq("category", activeCategory);
  }
  if (query) {
    productQuery = productQuery.or(
      `title.ilike.%${query}%,description.ilike.%${query}%`,
    );
  }
  if (activeSort === "price_low") {
    productQuery = productQuery.order("price_cents", { ascending: true });
  } else if (activeSort === "price_high") {
    productQuery = productQuery.order("price_cents", { ascending: false });
  } else if (activeSort === "available") {
    productQuery = productQuery.order("inventory_quantity", { ascending: false });
  } else {
    productQuery = productQuery.order("created_at", { ascending: false });
  }

  const { data: productRows } = await productQuery
    .order("sort_order", {
      ascending: true,
      referencedTable: "merch_product_media",
    })
    .limit(fetchLimit)
    .returns<MerchProduct[]>();
  const products = (productRows ?? []).filter(
    (product) => product.is_official || isVerifiedProfessional(product.profiles),
  );
  const visibleProducts = products.slice(0, limit);
  const hasMore = products.length > limit || (productRows?.length ?? 0) === fetchLimit;
  const currentMerchPath = productHref({
    category: activeCategory,
    page: currentPage,
    query,
    sort: activeSort,
  });
  const visibleProductIds = visibleProducts.map((product) => product.id);
  const { data: savedItems } = claims?.sub && visibleProductIds.length
    ? await supabase
        .from("saved_items")
        .select("subject_id")
        .eq("user_id", claims.sub)
        .eq("subject_type", "merch_product")
        .in("subject_id", visibleProductIds)
        .returns<{ subject_id: string }[]>()
    : { data: [] as { subject_id: string }[] };
  const savedMerchIds = new Set((savedItems ?? []).map((item) => item.subject_id));

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-[var(--card-rim)] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to home"
              className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
              href="/#merch"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <LogoLockup className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                TheTattooCore
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">Merch</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                Approved artist, studio, vendor, and official TTC products.
              </p>
            </div>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
            href="/account#seller-settings"
          >
            Seller tools
          </Link>
        </header>

        <section className="mb-5 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
          <form className="flex flex-col gap-3 sm:flex-row" action="/merch">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-strong)]" />
              <input
                className="h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] pl-10 pr-3 text-sm outline-none focus:border-[var(--foreground)]"
                defaultValue={query}
                name="q"
                placeholder="Search shirts, prints, art, stickers"
              />
            </label>
            {activeCategory !== "all" ? (
              <input name="category" type="hidden" value={activeCategory} />
            ) : null}
            {activeSort !== "newest" ? (
              <input name="sort" type="hidden" value={activeSort} />
            ) : null}
            <button className="h-11 rounded-md bg-[var(--foreground)] px-5 text-sm font-semibold text-[var(--background)]">
              Search
            </button>
          </form>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase text-[var(--muted-strong)]">
            <SlidersHorizontal className="size-4" />
            Filters
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {merchCategoryFilters.map(([value, label]) => (
              <Link
                className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold ${
                  activeCategory === value
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_86%,transparent)] text-[var(--foreground)]"
                }`}
                href={productHref({
                  category: value,
                  query,
                  sort: activeSort,
                })}
                key={value}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {merchSortOptions.map(([value, label]) => (
              <Link
                className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold ${
                  activeSort === value
                    ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_24%,var(--paper-warm))] text-[var(--foreground)]"
                    : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_86%,transparent)] text-[var(--foreground)]"
                }`}
                href={productHref({
                  category: activeCategory,
                  query,
                  sort: value,
                })}
                key={value}
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        {visibleProducts.length ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product) => {
              const available =
                product.inventory_quantity - product.inventory_reserved;

              return (
                <article
                  className="ttc-card overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)]"
                  key={product.id}
                >
                  <Link href={`/merch/${product.id}`}>
                    <ProductMedia
                      media={product.merch_product_media[0]}
                      title={product.title}
                    />
                  </Link>
                  <div className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--gold)_14%,var(--paper-warm))] px-2 py-1 text-xs font-semibold capitalize text-[var(--muted)]">
                        {formatCategory(product.category)}
                      </span>
                      {product.is_official ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-2 py-1 text-xs font-semibold text-[var(--background)]">
                          <ShieldCheck className="size-3" />
                          Official TTC
                        </span>
                      ) : null}
                    </div>
                    <Link className="hover:underline" href={`/merch/${product.id}`}>
                      <h2 className="line-clamp-2 text-lg font-bold">
                        {product.title}
                      </h2>
                    </Link>
                    <p className="mt-2 text-xl font-bold">
                      {money(product.price_cents, product.currency)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                      {product.description || "No description yet."}
                    </p>
                    <div className="mt-4 flex items-center gap-3 border-t border-[var(--card-rim)] pt-3">
                      <ProfileAvatar profile={product.profiles} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {product.profiles?.display_name ?? "TheTattooCore seller"}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted-strong)]">
                          <span>@{product.profiles?.username ?? "seller"}</span>
                          <VerifiedBadge profile={product.profiles} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-[var(--muted-strong)]">
                        {available > 0
                          ? `${Intl.NumberFormat("en-US").format(available)} available`
                          : "Sold out"}
                      </p>
                      <Link
                        className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--foreground)] px-3 text-xs font-semibold text-[var(--background)]"
                        href={`/merch/${product.id}`}
                      >
                        Open
                      </Link>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {claims?.sub ? (
                        <SavedItemButton
                          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-xs font-semibold"
                          isSaved={savedMerchIds.has(product.id)}
                          returnPath={currentMerchPath}
                          subjectId={product.id}
                          subjectType="merch_product"
                        />
                      ) : null}
                      <CompactShareButton
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-xs font-semibold"
                        text={`Check this Merch on ${siteName}: ${product.title}`}
                        title={product.title}
                        url={`${siteUrl}/merch/${product.id}`}
                      />
                      {claims?.sub && product.profiles?.id !== claims.sub ? (
                        <ContentReportForm
                          returnPath={currentMerchPath}
                          subjectId={product.id}
                          subjectType="merch_product"
                        />
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-8 text-center">
            <Package className="mx-auto size-10 text-[var(--gold)]" />
            <h2 className="mt-4 text-xl font-bold">No Merch found</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Try another category, clear the search, or check back as more
              approved seller products go live.
            </p>
            <Link
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
              href="/merch"
            >
              Clear filters
            </Link>
          </section>
        )}

        {hasMore ? (
          <Link
            className="mt-6 flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 text-sm font-semibold"
            href={productHref({
              category: activeCategory,
              page: currentPage + 1,
              query,
              sort: activeSort,
            })}
          >
            Load 25 more Merch products
          </Link>
        ) : null}
      </div>
    </main>
  );
}
