import Link from "next/link";
import type { Metadata } from "next";
import { Fragment } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  ImageIcon,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { AdImpressionBeacon } from "@/app/ad-impression-beacon";
import { ContentReportForm } from "@/app/content-report-form";
import { LogoLockup } from "@/app/logo-mark";
import { ProfileAvatar } from "@/app/profile-avatar";
import { SavedItemButton } from "@/app/saved-item-button";
import { CompactShareButton } from "@/app/share-actions";
import { countryLabel, languageLabel } from "@/lib/localization";
import { createClient } from "@/lib/supabase/server";
import {
  metadataKeywords,
  seoKeywordGroups,
  siteKeywords,
  siteName,
  siteUrl,
} from "@/lib/site";
import { isVerifiedProfessional } from "@/lib/verification";

type Claims = {
  sub: string;
};

type Profile = {
  account_type: string;
  avatar_url?: string | null;
  city: string | null;
  country_code?: string | null;
  display_name: string;
  id: string;
  license_verified_at?: string | null;
  location_personalization_enabled?: boolean | null;
  preferred_language?: string | null;
  region: string | null;
  username: string;
};

type SponsoredCampaign = {
  advertiser: Pick<
    Profile,
    "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"
  > | null;
  body: string | null;
  campaign_type: "artist_growth" | "stuff_listing" | "merch_listing";
  city: string | null;
  country_code: string | null;
  goal: string;
  id: string;
  keywords: string[];
  language: string | null;
  matchLabels: string[];
  region: string | null;
  target_url: string | null;
  title: string;
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
  fulfillment_notes: string | null;
  id: string;
  inventory_quantity: number;
  inventory_reserved: number;
  is_official: boolean;
  merch_product_media: MerchMedia[];
  price_cents: number;
  profiles: Profile | null;
  return_policy: string | null;
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
  keywords: metadataKeywords(siteKeywords, seoKeywordGroups.merch),
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

async function fetchMerchSponsoredCampaign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewer?: Pick<
    Profile,
    | "city"
    | "country_code"
    | "location_personalization_enabled"
    | "preferred_language"
    | "region"
  > | null,
) {
  const now = new Date().toISOString();
  const countryCode = viewer?.country_code?.toUpperCase() || null;
  const language = viewer?.preferred_language?.toLowerCase() || null;
  const useLocal = Boolean(viewer?.location_personalization_enabled);
  const city = useLocal ? viewer?.city || null : null;
  const region = useLocal ? viewer?.region || null : null;
  let query = supabase
    .from("ad_campaigns")
    .select(
      "id, title, body, target_url, campaign_type, goal, bid_cents, city, region, country_code, language, keywords, profiles:profiles!ad_campaigns_advertiser_id_fkey(username, display_name, avatar_url, account_type, license_verified_at), ad_campaign_placements!inner(placement)",
    )
    .eq("status", "active")
    .in("payment_status", ["paid", "waived"])
    .eq("payment_dispute_hold", false)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .eq("campaign_type", "merch_listing")
    .eq("ad_campaign_placements.placement", "merch");

  if (countryCode) {
    query = query.or(`country_code.is.null,country_code.eq.${countryCode}`);
  }
  if (language) {
    query = query.or(`language.is.null,language.eq.${language}`);
  }
  if (region) {
    query = query.or(`region.is.null,region.eq.${region}`);
  } else {
    query = query.is("region", null);
  }
  if (city) {
    query = query.or(`city.is.null,city.eq.${city}`);
  } else {
    query = query.is("city", null);
  }

  const { data } = await query
    .order("bid_cents", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8)
    .returns<
      {
        bid_cents: number;
        body: string | null;
        campaign_type: "artist_growth" | "stuff_listing" | "merch_listing";
        city: string | null;
        country_code: string | null;
        goal: string;
        id: string;
        keywords: string[];
        language: string | null;
        profiles: Pick<
          Profile,
          "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"
        > | null;
        region: string | null;
        target_url: string | null;
        title: string;
      }[]
    >();

  const campaign = data
    ?.map((item) => ({
      item,
      score:
        item.bid_cents +
        (countryCode && item.country_code === countryCode ? 250 : 0) +
        (language && item.language === language ? 200 : 0) +
        (region && item.region === region ? 150 : 0) +
        (city && item.city === city ? 200 : 0),
    }))
    .sort((first, second) => second.score - first.score)[0]?.item;

  if (!campaign) return null;

  const matchLabels = [
    countryCode && campaign.country_code === countryCode ? "Country match" : null,
    language && campaign.language === language ? "Language match" : null,
    region && campaign.region === region ? "Region match" : null,
    city && campaign.city === city ? "City match" : null,
  ].filter(Boolean) as string[];

  return {
    advertiser: campaign.profiles,
    body: campaign.body,
    campaign_type: campaign.campaign_type,
    city: campaign.city,
    country_code: campaign.country_code,
    goal: campaign.goal,
    id: campaign.id,
    keywords: campaign.keywords ?? [],
    language: campaign.language,
    matchLabels,
    region: campaign.region,
    target_url: campaign.target_url,
    title: campaign.title,
  } satisfies SponsoredCampaign;
}

function MerchSponsoredCard({ campaign }: { campaign?: SponsoredCampaign | null }) {
  if (!campaign) return null;

  const location = [
    campaign.city,
    campaign.region,
    countryLabel(campaign.country_code),
  ]
    .filter(Boolean)
    .join(", ");
  const targetingSummary = [
    location ? "local area" : null,
    campaign.language ? languageLabel(campaign.language) : null,
    campaign.keywords.length ? "product keywords" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const card = (
    <article className="ttc-card overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--gold)_60%,var(--card-rim))] bg-[var(--ink)] p-4 text-[var(--paper-warm)] shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
      <AdImpressionBeacon campaignId={campaign.id} placement="merch" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
            Sponsored in Merch
          </p>
          <h2 className="mt-2 line-clamp-2 text-lg font-bold">
            {campaign.title}
          </h2>
        </div>
        <span className="shrink-0 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold">
          Ad
        </span>
      </div>
      {campaign.body ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/75">
          {campaign.body}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold capitalize text-white/80">
          {campaign.goal.replaceAll("_", " ")}
        </span>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white/80">
          Merch listing
        </span>
        {campaign.matchLabels.map((label) => (
          <span
            className="rounded-md bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] px-2 py-1 text-xs font-semibold text-[color-mix(in_srgb,var(--gold)_70%,var(--background))]"
            key={label}
          >
            {label}
          </span>
        ))}
        {campaign.keywords.slice(0, 3).map((keyword) => (
          <span
            className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white/80"
            key={keyword}
          >
            {keyword}
          </span>
        ))}
      </div>
      <p className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-white/65">
        Reviewed sponsored placement
        {targetingSummary ? ` using ${targetingSummary}` : ""}. No AI ad expansion.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProfileAvatar profile={campaign.advertiser} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {campaign.advertiser?.display_name ?? "TheTattooCore advertiser"}
            </p>
            <p className="mt-1 truncate text-xs text-white/60">
              @{campaign.advertiser?.username ?? "advertiser"}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-sm font-bold text-[var(--gold)]">
          View
        </span>
      </div>
    </article>
  );

  if (!campaign.target_url) return card;

  return (
    <a
      className="block"
      href={`/api/ad-click?campaign_id=${encodeURIComponent(
        campaign.id,
      )}&placement=merch`}
      rel="nofollow sponsored"
    >
      {card}
    </a>
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
  const { data: currentProfile } = claims?.sub
    ? await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, account_type, city, country_code, preferred_language, location_personalization_enabled, license_verified_at, region",
        )
        .eq("id", claims.sub)
        .maybeSingle<Profile>()
    : { data: null };
  let productQuery = supabase
    .from("merch_products")
    .select(
      "id, title, description, fulfillment_notes, return_policy, category, price_cents, currency, inventory_quantity, inventory_reserved, shipping_required, is_official, created_at, merch_product_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!merch_products_seller_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
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
  const merchAd = await fetchMerchSponsoredCampaign(supabase, currentProfile);
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
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 text-sm font-semibold"
              href="/help/merch-products-orders"
            >
              Merch help
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
              href="/account#order-settings"
            >
              Seller tools
            </Link>
          </div>
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
                <Fragment key={product.id}>
                <article
                  className="ttc-card overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)]"
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
                      {product.fulfillment_notes || product.return_policy ? (
                        <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
                          Seller notes
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
                {product.id === visibleProducts[Math.min(1, visibleProducts.length - 1)]?.id ? (
                  <MerchSponsoredCard campaign={merchAd} />
                ) : null}
                </Fragment>
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
