import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { ProfileAvatar } from "@/app/profile-avatar";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedProfessional } from "@/lib/verification";
import { RecentSearches } from "./recent-searches";

type ProfileResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  account_type: string;
  bio: string | null;
  city: string | null;
  license_verified_at: string | null;
  region: string | null;
  shop_profile?: {
    display_name: string;
    username: string;
  } | null;
  shop_profile_id: string | null;
};

type FollowRelation = {
  follower_id: string;
  following_id: string;
  status: string;
};

type SearchProfileBadge = Pick<
  ProfileResult,
  "account_type" | "license_verified_at"
> | null;

type FeedResult = {
  id: string;
  caption: string | null;
  location_label: string | null;
  style_tags: string[];
  profiles: Pick<
    ProfileResult,
    "account_type" | "avatar_url" | "display_name" | "id" | "license_verified_at" | "username"
  > | null;
};

type ThreadResult = {
  id: string;
  body: string;
  profiles: Pick<
    ProfileResult,
    "account_type" | "avatar_url" | "display_name" | "id" | "license_verified_at" | "username"
  > | null;
};

type ListingResult = {
  description: string | null;
  id: string;
  title: string;
  category: string;
  city: string | null;
  region: string | null;
  profiles: Pick<
    ProfileResult,
    "account_type" | "avatar_url" | "display_name" | "id" | "license_verified_at" | "username"
  > | null;
};

type GigResult = {
  compensation: string | null;
  description: string | null;
  id: string;
  title: string;
  category: string;
  city: string | null;
  region: string | null;
  profiles: Pick<
    ProfileResult,
    "account_type" | "avatar_url" | "display_name" | "id" | "license_verified_at" | "username"
  > | null;
};

type MerchResult = {
  category: string;
  city: string | null;
  currency: string;
  description: string | null;
  id: string;
  is_official: boolean;
  price_cents: number;
  profiles: Pick<
    ProfileResult,
    "account_type" | "avatar_url" | "display_name" | "id" | "license_verified_at" | "username"
  > | null;
  region: string | null;
  title: string;
};

type SearchType =
  | "all"
  | "profiles"
  | "feed"
  | "threads"
  | "marketplace"
  | "gigs"
  | "merch";

const MERCH_CATEGORY_VALUES = new Set([
  "apparel",
  "print",
  "art",
  "sticker",
  "accessory",
  "official",
  "other",
]);

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Search",
};

export const dynamic = "force-dynamic";

function cleanQuery(value?: string) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function cleanFilter(value?: string, maxLength = 40) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function cleanType(value?: string): SearchType {
  const text = cleanFilter(value, 20);

  if (
    text === "profiles" ||
    text === "feed" ||
    text === "threads" ||
    text === "marketplace" ||
    text === "gigs" ||
    text === "merch"
  ) {
    return text;
  }

  return "all";
}

function searchPattern(query: string) {
  const clean = query
    .replace(/[^a-zA-Z0-9_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `%${clean}%`;
}

function usernameQuery(query: string) {
  return query
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

function searchTerms(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 6);
}

function searchOr(fields: string[], query: string, fallbackFields = fields) {
  const terms = searchTerms(query);

  if (!terms.length) {
    return fallbackFields
      .map((field) => `${field}.ilike.${searchPattern("")}`)
      .join(",");
  }

  return terms
    .flatMap((term) =>
      fields.map((field) => `${field}.ilike.${searchPattern(term)}`),
    )
    .join(",");
}

function textValue(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");

  return String(value ?? "");
}

function weightedSearchScore(
  terms: string[],
  fields: { value: unknown; weight: number }[],
  boosts: number[] = [],
) {
  if (!terms.length) return boosts.reduce((total, boost) => total + boost, 0);

  let score = boosts.reduce((total, boost) => total + boost, 0);

  for (const term of terms) {
    for (const field of fields) {
      const text = textValue(field.value).toLowerCase();

      if (!text) continue;
      if (text === term) score += field.weight * 3;
      else if (text.startsWith(term)) score += field.weight * 2;
      else if (text.includes(term)) score += field.weight;
    }
  }

  return score;
}

function compareSearchResults<T>(
  terms: string[],
  score: (item: T) => number,
  fallback: (item: T) => string,
) {
  return (a: T, b: T) => {
    const scoreDiff = score(b) - score(a);

    if (scoreDiff !== 0) return scoreDiff;

    return fallback(a).localeCompare(fallback(b));
  };
}

function runSection(type: SearchType, section: Exclude<SearchType, "all">) {
  return type === "all" || type === section;
}

function typedHref(type: SearchType, params: URLSearchParams) {
  const next = new URLSearchParams(params);
  next.delete("page");

  if (type === "all") {
    next.delete("type");
  } else {
    next.set("type", type);
  }

  const qs = next.toString();

  return qs ? `/search?${qs}` : "/search";
}

function isVerifiedProfile(profile?: SearchProfileBadge) {
  return isVerifiedProfessional(profile);
}

async function getBlockedProfileIds({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId?: string | null;
}) {
  if (!userId) return new Set<string>();

  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    .returns<{ blocked_id: string; blocker_id: string }[]>();

  return new Set(
    (data ?? []).map((block) =>
      block.blocker_id === userId ? block.blocked_id : block.blocker_id,
    ),
  );
}

function VerifiedBadge({ profile }: { profile?: SearchProfileBadge }) {
  if (!isVerifiedProfile(profile)) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--background)]">
      <BadgeCheck className="size-3" />
      Verified
    </span>
  );
}

function locationText(value: { city: string | null; region: string | null }) {
  return [value.city, value.region].filter(Boolean).join(", ");
}

function shopProfileText(profile: ProfileResult) {
  const shop = Array.isArray(profile.shop_profile)
    ? profile.shop_profile[0]
    : profile.shop_profile;

  return shop ? `Shop: ${shop.display_name}` : null;
}

function SearchSection({
  children,
  count,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  count: number;
  icon: typeof Search;
  title: string;
}) {
  return (
    <section className="border-t border-[var(--card-rim)] px-4 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--brand-gold)]">
            <Icon className="size-4" />
          </span>
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <span className="rounded-md bg-[var(--brand-gold)] px-2 py-1 text-xs font-bold text-[var(--ink)]">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <p className="ttc-surface rounded-md border p-4 text-sm text-[var(--muted-strong)] shadow-sm">
      No {label} found.
    </p>
  );
}

function SearchNoResultsTips({
  category,
  city,
  query,
  region,
}: {
  category: string;
  city: string;
  query: string;
  region: string;
}) {
  const hasFilters = Boolean(category || city || region);

  return (
    <section className="border-t border-[var(--card-rim)] px-4 py-5">
      <div className="ttc-card rounded-md p-4">
        <h2 className="text-lg font-bold">No matches yet</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Try the exact username, a display name, city, style, shop name, or a
          broader word. Search can only show public and privacy-safe results.
        </p>
        <ul className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted-strong)] sm:grid-cols-3">
          <li className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3">
            Usernames work best without spaces, like{" "}
            <span className="font-bold text-[var(--text)]">@artistname</span>.
          </li>
          <li className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3">
            Search by city or state when you know where the artist, shop, gig,
            or seller is based.
          </li>
          <li className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3">
            Switch tabs between Profiles, 4U, Gossip, Stuff, Gigs, and Merch if
            the result type matters.
          </li>
        </ul>
        {hasFilters ? (
          <Link
            className="ttc-surface mt-4 inline-flex h-9 items-center rounded-md border px-3 text-xs font-bold"
            href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}
          >
            Clear filters
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function ResultAction({ children }: { children: React.ReactNode }) {
  return (
    <span className="ttc-surface mt-3 inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold">
      {children}
    </span>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    city?: string;
    page?: string;
    q?: string;
    region?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;
  const query = cleanQuery(params.q);
  const category = cleanFilter(params.category);
  const city = cleanFilter(params.city);
  const region = cleanFilter(params.region);
  const type = cleanType(params.type);
  const page = Math.max(1, Math.min(20, Number(params.page ?? "1") || 1));
  const resultLimit = page * 25;
  const resultFetchLimit = resultLimit + 25;
  const terms = searchTerms(query);
  const exactUsername = usernameQuery(query);
  const cityPattern = searchPattern(city);
  const regionPattern = searchPattern(region);
  const categoryPattern = searchPattern(category);
  const typedParams = new URLSearchParams();

  if (query) typedParams.set("q", query);
  if (category) typedParams.set("category", category);
  if (city) typedParams.set("city", city);
  if (region) typedParams.set("region", region);
  const loadMoreParams = new URLSearchParams(typedParams);
  if (type !== "all") loadMoreParams.set("type", type);
  loadMoreParams.set("page", String(page + 1));

  const hasSearch = Boolean(query || category || city || region);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { sub: string } | undefined;
  const blockedProfileIds = await getBlockedProfileIds({
    supabase,
    userId: claims?.sub,
  });
  const { data: visiblePrivateFollowRows } = claims?.sub
    ? await supabase
        .from("follows")
        .select("follower_id, following_id, status")
        .or(`follower_id.eq.${claims.sub},following_id.eq.${claims.sub}`)
        .eq("status", "accepted")
        .returns<FollowRelation[]>()
    : { data: [] as FollowRelation[] };
  const visiblePrivateProfileIds = new Set(
    (visiblePrivateFollowRows ?? []).map((follow) =>
      follow.follower_id === claims?.sub ? follow.following_id : follow.follower_id,
    ),
  );
  const shouldRunProfiles = hasSearch && runSection(type, "profiles");
  const shouldRunFeed = hasSearch && runSection(type, "feed");
  const shouldRunThreads = hasSearch && runSection(type, "threads");
  const shouldRunListings = hasSearch && runSection(type, "marketplace");
  const shouldRunGigs = hasSearch && runSection(type, "gigs");
  const shouldRunMerch = hasSearch && runSection(type, "merch");

  const [
    { data: profiles },
    { data: feedPosts },
    { data: threads },
    { data: listings },
    { data: gigs },
    { data: merchProducts },
      ] = hasSearch
    ? await Promise.all([
        shouldRunProfiles
          ? (() => {
              let publicProfileQuery = supabase
                .from("profiles")
                .select(
                  "id, username, display_name, avatar_url, banner_url, account_type, bio, city, license_verified_at, region, shop_profile_id",
                )
                .or(
                  searchOr(
                    [
                      "username",
                      "display_name",
                      "bio",
                      "city",
                      "region",
                    ],
                    query,
                  ),
                )
                .eq("is_private", false);

              if (city) publicProfileQuery = publicProfileQuery.ilike("city", cityPattern);
              if (region) publicProfileQuery = publicProfileQuery.ilike("region", regionPattern);

              const publicProfilesPromise = publicProfileQuery
                .order("display_name", { ascending: true })
                .limit(resultFetchLimit)
                .returns<ProfileResult[]>();
              const privateProfilesPromise = visiblePrivateProfileIds.size
                ? (() => {
                    let privateProfileQuery = supabase
                      .from("profiles")
                      .select(
                        "id, username, display_name, avatar_url, banner_url, account_type, bio, city, license_verified_at, region, shop_profile_id",
                      )
                      .in("id", Array.from(visiblePrivateProfileIds))
                      .or(
                        searchOr(
                          [
                            "username",
                            "display_name",
                            "bio",
                            "city",
                            "region",
                          ],
                          query,
                        ),
                      );

                    if (city) privateProfileQuery = privateProfileQuery.ilike("city", cityPattern);
                    if (region) {
                      privateProfileQuery = privateProfileQuery.ilike("region", regionPattern);
                    }

                    return privateProfileQuery
                      .order("display_name", { ascending: true })
                      .limit(resultFetchLimit)
                      .returns<ProfileResult[]>();
                  })()
                : Promise.resolve({ data: [] as ProfileResult[] });

              return Promise.all([publicProfilesPromise, privateProfilesPromise]).then(
                ([publicProfiles, privateProfiles]) => {
                  const profileMap = new Map<string, ProfileResult>();

                  for (const profile of publicProfiles.data ?? []) {
                    profileMap.set(profile.id, profile);
                  }
                  for (const profile of privateProfiles.data ?? []) {
                    profileMap.set(profile.id, profile);
                  }

                  return {
                    ...publicProfiles,
                    data: Array.from(profileMap.values()).sort((a, b) =>
                      compareSearchResults<ProfileResult>(
                        terms,
                        (profile) =>
                          weightedSearchScore(
                            terms,
                            [
                              { value: profile.username, weight: 40 },
                              { value: profile.display_name, weight: 34 },
                              { value: profile.account_type, weight: 18 },
                              { value: profile.city, weight: 14 },
                              { value: profile.region, weight: 12 },
                              { value: profile.bio, weight: 8 },
                            ],
                            [
                              visiblePrivateProfileIds.has(profile.id) ? 8 : 0,
                              isVerifiedProfile(profile) ? 5 : 0,
                            ],
                          ),
                        (profile) => profile.display_name,
                      )(a, b),
                    ),
                  };
                },
              );
            })()
          : Promise.resolve({ data: [] as ProfileResult[] }),
        shouldRunFeed
          ? (() => {
              let feedQuery = supabase
                .from("feed_posts")
                .select(
                  "id, caption, location_label, style_tags, profiles:profiles!feed_posts_author_id_fkey(id, display_name, avatar_url, username, account_type, license_verified_at)",
                )
                .eq("is_published", true)
                .eq("moderation_status", "active")
                .eq("visibility", "public_preview")
                .eq("is_sensitive", false)
                .or(
                  query
                    ? searchOr(["caption", "location_label"], query)
                    : `caption.ilike.%,location_label.ilike.%`,
                );

              if (city) feedQuery = feedQuery.ilike("location_label", cityPattern);

              return feedQuery
                .order("created_at", { ascending: false })
                .limit(resultFetchLimit)
                .returns<FeedResult[]>();
            })()
          : Promise.resolve({ data: [] as FeedResult[] }),
        shouldRunThreads && query
          ? supabase
              .from("thread_posts")
              .select(
                "id, body, profiles:profiles!thread_posts_author_id_fkey(id, display_name, avatar_url, username, account_type, license_verified_at)",
              )
              .eq("moderation_status", "active")
              .eq("visibility", "public_preview")
              .eq("is_sensitive", false)
              .or(searchOr(["body"], query))
              .order("created_at", { ascending: false })
              .limit(resultFetchLimit)
              .returns<ThreadResult[]>()
          : Promise.resolve({ data: [] as ThreadResult[] }),
        shouldRunListings
          ? (() => {
              let listingQuery = supabase
                .from("marketplace_listings")
                .select(
                  "id, title, description, category, city, region, profiles:profiles!marketplace_listings_seller_id_fkey(id, display_name, avatar_url, username, account_type, license_verified_at)",
                )
                .eq("status", "active")
                .eq("moderation_status", "active")
                .eq("visibility", "public_preview")
                .eq("is_sensitive", false)
                .or(
                  query
                    ? searchOr(
                        ["title", "description", "category", "city", "region"],
                        query,
                      )
                    : `title.ilike.%,description.ilike.%,category.ilike.%,city.ilike.%,region.ilike.%`,
                );

              if (category) listingQuery = listingQuery.ilike("category", categoryPattern);
              if (city) listingQuery = listingQuery.ilike("city", cityPattern);
              if (region) listingQuery = listingQuery.ilike("region", regionPattern);

              return listingQuery
                .order("created_at", { ascending: false })
                .limit(resultFetchLimit)
                .returns<ListingResult[]>();
            })()
          : Promise.resolve({ data: [] as ListingResult[] }),
        shouldRunGigs
          ? (() => {
              let gigQuery = supabase
                .from("gigs")
                .select(
                  "id, title, description, category, city, region, compensation, profiles:profiles!gigs_poster_id_fkey(id, display_name, avatar_url, username, account_type, license_verified_at)",
                )
                .eq("status", "active")
                .eq("moderation_status", "active")
                .eq("visibility", "public_preview")
                .eq("is_sensitive", false)
                .or(
                  query
                    ? searchOr(
                        [
                          "title",
                          "description",
                          "category",
                          "city",
                          "region",
                          "compensation",
                        ],
                        query,
                      )
                    : `title.ilike.%,description.ilike.%,category.ilike.%,city.ilike.%,region.ilike.%,compensation.ilike.%`,
                );

              if (category) gigQuery = gigQuery.ilike("category", categoryPattern);
              if (city) gigQuery = gigQuery.ilike("city", cityPattern);
              if (region) gigQuery = gigQuery.ilike("region", regionPattern);

              return gigQuery
                .order("created_at", { ascending: false })
                .limit(resultFetchLimit)
                .returns<GigResult[]>();
            })()
          : Promise.resolve({ data: [] as GigResult[] }),
        shouldRunMerch
          ? (() => {
              const merchCategory = category.toLowerCase();
              let merchQuery = supabase
                .from("merch_products")
                .select(
                  "id, title, description, category, price_cents, currency, is_official, ships_from_city, ships_from_region, profiles:profiles!merch_products_seller_id_fkey(id, display_name, avatar_url, username, account_type, license_verified_at)",
                )
                .eq("status", "active")
                .eq("moderation_status", "active")
                .eq("is_indexable", true)
                .or(
                  query
                    ? searchOr(
                        [
                          "title",
                          "description",
                          "category",
                          "ships_from_city",
                          "ships_from_region",
                        ],
                        query,
                      )
                    : `title.ilike.%,description.ilike.%,ships_from_city.ilike.%,ships_from_region.ilike.%`,
                );

              if (MERCH_CATEGORY_VALUES.has(merchCategory)) {
                merchQuery = merchQuery.eq("category", merchCategory);
              }
              if (city) merchQuery = merchQuery.ilike("ships_from_city", cityPattern);
              if (region) {
                merchQuery = merchQuery.ilike("ships_from_region", regionPattern);
              }

              return merchQuery
                .order("created_at", { ascending: false })
                .limit(resultFetchLimit)
                .returns<
                  {
                    category: string;
                    currency: string;
                    description: string | null;
                    id: string;
                    is_official: boolean;
                    price_cents: number;
                    profiles: MerchResult["profiles"];
                    ships_from_city: string | null;
                    ships_from_region: string | null;
                    title: string;
                  }[]
                >()
                .then(({ data, ...rest }) => ({
                  data: (data ?? [])
                    .filter(
                      (product) =>
                        product.is_official ||
                        isVerifiedProfessional(product.profiles),
                    )
                    .map((product) => ({
                      category: product.category,
                      city: product.ships_from_city,
                      currency: product.currency,
                      description: product.description,
                      id: product.id,
                      is_official: product.is_official,
                      price_cents: product.price_cents,
                      profiles: product.profiles,
                      region: product.ships_from_region,
                      title: product.title,
                    })),
                  ...rest,
                }));
            })()
          : Promise.resolve({ data: [] as MerchResult[] }),
      ])
    : [
        { data: [] as ProfileResult[] },
        { data: [] as FeedResult[] },
        { data: [] as ThreadResult[] },
        { data: [] as ListingResult[] },
        { data: [] as GigResult[] },
        { data: [] as MerchResult[] },
      ];
  const profileShopIds = Array.from(
    new Set((profiles ?? []).map((profile) => profile.shop_profile_id).filter(Boolean)),
  ) as string[];
  const { data: profileShops } = profileShopIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", profileShopIds)
        .returns<{ display_name: string; id: string; username: string }[]>()
    : { data: [] as { display_name: string; id: string; username: string }[] };
  const profileShopMap = new Map(
    (profileShops ?? []).map((shop) => [shop.id, shop]),
  );
  const filteredProfileResults = (profiles ?? [])
    .filter((profile) => !blockedProfileIds.has(profile.id))
    .map((profile) => ({
      ...profile,
      shop_profile: profile.shop_profile_id
        ? (profileShopMap.get(profile.shop_profile_id) ?? null)
        : null,
    }))
    .sort(
      compareSearchResults<ProfileResult>(
        terms,
        (profile) =>
          weightedSearchScore(
            terms,
            [
              { value: profile.username, weight: 40 },
              { value: profile.display_name, weight: 34 },
              { value: profile.account_type, weight: 18 },
              { value: profile.city, weight: 14 },
              { value: profile.region, weight: 12 },
              { value: shopProfileText(profile), weight: 10 },
              { value: profile.bio, weight: 8 },
            ],
            [
              exactUsername && profile.username === exactUsername ? 70 : 0,
              exactUsername && profile.username.startsWith(exactUsername) ? 20 : 0,
              visiblePrivateProfileIds.has(profile.id) ? 8 : 0,
              isVerifiedProfile(profile) ? 5 : 0,
            ],
          ),
        (profile) => profile.display_name,
      ),
    );
  const filteredFeedResults = (feedPosts ?? [])
    .filter(
      (post) => !post.profiles?.id || !blockedProfileIds.has(post.profiles.id),
    )
    .sort(
      compareSearchResults<FeedResult>(
        terms,
        (post) =>
          weightedSearchScore(terms, [
            { value: post.caption, weight: 30 },
            { value: post.style_tags, weight: 24 },
            { value: post.location_label, weight: 14 },
            { value: post.profiles?.username, weight: 12 },
            { value: post.profiles?.display_name, weight: 10 },
          ]),
        (post) => post.caption || post.style_tags.join(" ") || post.id,
      ),
    );
  const filteredThreadResults = (threads ?? [])
    .filter(
      (thread) =>
        !thread.profiles?.id || !blockedProfileIds.has(thread.profiles.id),
    )
    .sort(
      compareSearchResults<ThreadResult>(
        terms,
        (thread) =>
          weightedSearchScore(terms, [
            { value: thread.body, weight: 30 },
            { value: thread.profiles?.username, weight: 12 },
            { value: thread.profiles?.display_name, weight: 10 },
          ]),
        (thread) => thread.body,
      ),
    );
  const filteredListingResults = (listings ?? [])
    .filter(
      (listing) =>
        !listing.profiles?.id || !blockedProfileIds.has(listing.profiles.id),
    )
    .sort(
      compareSearchResults<ListingResult>(
        terms,
        (listing) =>
          weightedSearchScore(terms, [
            { value: listing.title, weight: 34 },
            { value: listing.category, weight: 20 },
            { value: listing.city, weight: 14 },
            { value: listing.region, weight: 12 },
            { value: listing.description, weight: 8 },
            { value: listing.profiles?.username, weight: 8 },
            { value: listing.profiles?.display_name, weight: 6 },
          ]),
        (listing) => listing.title,
      ),
    );
  const filteredGigResults = (gigs ?? [])
    .filter((gig) => !gig.profiles?.id || !blockedProfileIds.has(gig.profiles.id))
    .sort(
      compareSearchResults<GigResult>(
        terms,
        (gig) =>
          weightedSearchScore(terms, [
            { value: gig.title, weight: 34 },
            { value: gig.category, weight: 20 },
            { value: gig.city, weight: 14 },
            { value: gig.region, weight: 12 },
            { value: gig.compensation, weight: 10 },
            { value: gig.description, weight: 8 },
            { value: gig.profiles?.username, weight: 8 },
            { value: gig.profiles?.display_name, weight: 6 },
          ]),
        (gig) => gig.title,
      ),
    );
  const filteredMerchResults = (merchProducts ?? [])
    .filter(
      (product) =>
        product.is_official ||
        !product.profiles?.id ||
        !blockedProfileIds.has(product.profiles.id),
    )
    .sort(
      compareSearchResults<MerchResult>(
        terms,
        (product) =>
          weightedSearchScore(terms, [
            { value: product.title, weight: 34 },
            { value: product.category, weight: 20 },
            { value: product.city, weight: 14 },
            { value: product.region, weight: 12 },
            { value: product.description, weight: 8 },
            { value: product.profiles?.username, weight: 8 },
            { value: product.profiles?.display_name, weight: 6 },
          ]),
        (product) => product.title,
      ),
    );
  const profileResults = filteredProfileResults.slice(0, resultLimit);
  const feedResults = filteredFeedResults.slice(0, resultLimit);
  const threadResults = filteredThreadResults.slice(0, resultLimit);
  const listingResults = filteredListingResults.slice(0, resultLimit);
  const gigResults = filteredGigResults.slice(0, resultLimit);
  const merchResults = filteredMerchResults.slice(0, resultLimit);

  const total =
    profileResults.length +
    feedResults.length +
    threadResults.length +
    listingResults.length +
    gigResults.length +
    merchResults.length;
  const canLoadMore =
    hasSearch &&
    [
      shouldRunProfiles
        ? filteredProfileResults.length > resultLimit ||
          (profiles?.length ?? 0) === resultFetchLimit
        : false,
      shouldRunFeed
        ? filteredFeedResults.length > resultLimit ||
          (feedPosts?.length ?? 0) === resultFetchLimit
        : false,
      shouldRunThreads
        ? filteredThreadResults.length > resultLimit ||
          (threads?.length ?? 0) === resultFetchLimit
        : false,
      shouldRunListings
        ? filteredListingResults.length > resultLimit ||
          (listings?.length ?? 0) === resultFetchLimit
        : false,
      shouldRunGigs
        ? filteredGigResults.length > resultLimit ||
          (gigs?.length ?? 0) === resultFetchLimit
        : false,
      shouldRunMerch
        ? filteredMerchResults.length > resultLimit ||
          (merchProducts?.length ?? 0) === resultFetchLimit
        : false,
    ].some(Boolean);

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-4xl overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              aria-label="Back to home"
              className="ttc-surface flex size-10 items-center justify-center rounded-md border"
              href="/"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <form
              action="/search"
              className="ttc-surface flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 shadow-sm"
            >
              <Search className="size-4 shrink-0 text-[var(--muted-strong)]" />
              <input
                autoFocus
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                defaultValue={query}
                maxLength={80}
                name="q"
                placeholder="Search artists, styles, shops, gigs, merch"
              />
              <button className="h-8 rounded-md bg-[var(--foreground)] px-3 text-xs font-semibold text-[var(--background)]">
                Search
              </button>
            </form>
            <NotificationBellLink className="shrink-0" />
          </div>
        </header>

        <section className="px-4 py-5">
          <h1 className="text-2xl font-bold">Search</h1>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">
            {hasSearch
              ? `${total} result${total === 1 ? "" : "s"} found`
              : "Find public artists, styles, gossip, Stuff, Gigs, and public Merch previews."}
          </p>
          <p className="ttc-surface mt-2 rounded-md border px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
            Search only shows public, non-sensitive previews. Member-only,
            private, and 18+ sensitive body-art content stays behind login and
            terms confirmation, and DMs never appear in search.
          </p>
          <div className="ttc-surface mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
            <Package className="mt-0.5 size-4 shrink-0 text-[var(--brand-gold)]" />
            <p>
              Merch checkout is limited during launch. Public discovery should stay
              limited to active, safe, approved products until production
              seller, tax, shipping, refund, and payment rules are ready.
            </p>
          </div>
          <form
            action="/search"
            className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <input name="q" type="hidden" value={query} />
            <input name="type" type="hidden" value={type === "all" ? "" : type} />
            <input
              className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
              defaultValue={category}
              name="category"
              placeholder="category"
            />
            <input
              className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
              defaultValue={city}
              name="city"
              placeholder="city"
            />
            <input
              className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
              defaultValue={region}
              name="region"
              placeholder="state / region"
            />
            <button className="ttc-surface h-10 rounded-md border px-4 text-sm font-semibold">
              Filter
            </button>
          </form>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {[
              ["all", "All"],
              ["profiles", "Profiles"],
              ["feed", "4U"],
              ["threads", "Gossip"],
              ["marketplace", "Stuff"],
              ["gigs", "Gigs"],
              ["merch", "Merch"],
            ].map(([value, label]) => (
              <Link
                className={`flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-semibold ${
                  type === value
                    ? "ttc-control-active border-[var(--foreground)] shadow-[0_6px_16px_rgba(23,20,18,0.16)]"
                    : "ttc-surface hover:border-[var(--brand-gold)]"
                }`}
                href={typedHref(value as SearchType, typedParams)}
                key={value}
              >
                {label}
              </Link>
            ))}
          </div>
          <RecentSearches
            current={{
              category,
              city,
              q: query,
              region,
              type,
            }}
          />
        </section>

        {!hasSearch ? null : (
          <>
            {total === 0 ? (
              <SearchNoResultsTips
                category={category}
                city={city}
                query={query}
                region={region}
              />
            ) : null}
            {runSection(type, "profiles") ? (
            <SearchSection count={profileResults.length} icon={UserRound} title="Profiles">
              {profileResults.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {profileResults.map((profile) => (
                    <Link
                      className="ttc-card overflow-hidden rounded-md"
                      href={`/u/${profile.username}`}
                      key={profile.id}
                    >
                      <div
                        className="h-20 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--foreground)_88%,var(--brand-gold))] bg-cover bg-center"
                        style={
                          profile.banner_url
                            ? { backgroundImage: `url(${profile.banner_url})` }
                            : undefined
                        }
                      />
                      <div className="flex items-start gap-3 p-4">
                        <ProfileAvatar
                          className="-mt-10 border-2 border-[var(--paper-warm)] shadow-lg"
                          profile={profile}
                        />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-sm font-semibold">
                              {profile.display_name}
                            </p>
                            <VerifiedBadge profile={profile} />
                          </div>
                          <p className="text-xs text-[var(--muted-strong)]">
                            @{profile.username} - {profile.account_type}
                          </p>
                          {locationText(profile) ? (
                            <p className="mt-1 text-xs text-[var(--muted-strong)]">
                              {locationText(profile)}
                            </p>
                          ) : null}
                          {shopProfileText(profile) ? (
                            <p className="mt-1 text-xs font-semibold text-[var(--muted-strong)]">
                              {shopProfileText(profile)}
                            </p>
                          ) : null}
                          {profile.bio ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                              {profile.bio}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="profiles" />
              )}
            </SearchSection>
            ) : null}

            {runSection(type, "feed") ? (
            <SearchSection count={feedResults.length} icon={Camera} title="4U">
              {feedResults.length ? (
                <div className="space-y-3">
                  {feedResults.map((post) => (
                    <Link
                      className="ttc-card block rounded-md p-4"
                      href={`/p/${post.id}`}
                      key={post.id}
                    >
                      <div className="flex items-center gap-2">
                        <ProfileAvatar profile={post.profiles} size="sm" />
                        <p className="text-sm font-semibold">
                          {post.profiles?.display_name ?? "Member"}
                        </p>
                        <VerifiedBadge profile={post.profiles} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                        {post.caption || post.style_tags.join(", ") || "4U post"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted-strong)]">
                        {post.profiles?.username ? (
                          <span>@{post.profiles.username}</span>
                        ) : null}
                        {post.location_label ? <span>{post.location_label}</span> : null}
                      </div>
                      <ResultAction>Open 4U post</ResultAction>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="4U posts" />
              )}
            </SearchSection>
            ) : null}

            {runSection(type, "threads") ? (
            <SearchSection count={threadResults.length} icon={MessageCircle} title="Gossip">
              {threadResults.length ? (
                <div className="space-y-3">
                  {threadResults.map((thread) => (
                    <Link
                      className="ttc-card block rounded-md p-4"
                      href={`/t/${thread.id}`}
                      key={thread.id}
                    >
                      <div className="flex items-center gap-2">
                        <ProfileAvatar profile={thread.profiles} size="sm" />
                        <p className="text-sm font-semibold">
                          {thread.profiles?.display_name ?? "Member"}
                        </p>
                        <VerifiedBadge profile={thread.profiles} />
                      </div>
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                        {thread.body}
                      </p>
                      {thread.profiles?.username ? (
                        <p className="mt-2 text-xs text-[var(--muted-strong)]">
                          @{thread.profiles.username}
                        </p>
                      ) : null}
                      <ResultAction>Open Gossip thread</ResultAction>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="gossip" />
              )}
            </SearchSection>
            ) : null}

            {runSection(type, "marketplace") ? (
            <SearchSection count={listingResults.length} icon={ShoppingBag} title="Stuff">
              {listingResults.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {listingResults.map((listing) => (
                    <Link
                      className="ttc-card block rounded-md p-4"
                      href={`/stuff/${listing.id}`}
                      key={listing.id}
                    >
                      <p className="text-sm font-semibold">{listing.title}</p>
                      <p className="mt-1 text-xs capitalize text-[var(--muted-strong)]">
                        {listing.category}
                        {locationText(listing) ? ` - ${locationText(listing)}` : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <ProfileAvatar profile={listing.profiles} size="sm" />
                        <VerifiedBadge profile={listing.profiles} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted-strong)]">
                        {listing.profiles?.username ? (
                          <span>@{listing.profiles.username}</span>
                        ) : null}
                        {listing.profiles?.display_name ? (
                          <span>{listing.profiles.display_name}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
                        Browse is public. Seller contact and professional gear
                        activity require verified artist, studio, or vendor
                        status.
                      </p>
                      <ResultAction>View Stuff listing</ResultAction>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="stuff" />
              )}
            </SearchSection>
            ) : null}

            {runSection(type, "gigs") ? (
            <SearchSection count={gigResults.length} icon={BriefcaseBusiness} title="Gigs">
              {gigResults.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {gigResults.map((gig) => (
                    <Link
                      className="ttc-card block rounded-md p-4"
                      href={`/gigs/${gig.id}`}
                      key={gig.id}
                    >
                      <p className="text-sm font-semibold">{gig.title}</p>
                      <p className="mt-1 text-xs capitalize text-[var(--muted-strong)]">
                        {gig.category.replaceAll("_", " ")}
                        {locationText(gig) ? ` - ${locationText(gig)}` : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <ProfileAvatar profile={gig.profiles} size="sm" />
                        <VerifiedBadge profile={gig.profiles} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted-strong)]">
                        {gig.profiles?.username ? (
                          <span>@{gig.profiles.username}</span>
                        ) : null}
                        {gig.profiles?.display_name ? (
                          <span>{gig.profiles.display_name}</span>
                        ) : null}
                      </div>
                      <ResultAction>View Gig</ResultAction>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="gigs" />
              )}
            </SearchSection>
            ) : null}

            {runSection(type, "merch") ? (
            <SearchSection count={merchResults.length} icon={Package} title="Merch">
              {merchResults.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {merchResults.map((product) => (
                    <Link
                      className="ttc-card block rounded-md p-4"
                      href={`/merch/${product.id}`}
                      key={product.id}
                    >
                      <p className="text-sm font-semibold">{product.title}</p>
                      <p className="mt-1 text-xs capitalize text-[var(--muted-strong)]">
                        {product.category} -{" "}
                        {Intl.NumberFormat("en-US", {
                          currency: product.currency,
                          style: "currency",
                        }).format(product.price_cents / 100)}
                        {locationText(product) ? ` - ${locationText(product)}` : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <ProfileAvatar profile={product.profiles} size="sm" />
                        <VerifiedBadge profile={product.profiles} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted-strong)]">
                        {product.profiles?.username ? (
                          <span>@{product.profiles.username}</span>
                        ) : null}
                        {product.profiles?.display_name ? (
                          <span>{product.profiles.display_name}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
                        Merch is fan-facing brand goods. Production checkout
                        stays limited until seller, shipping, tax, and refund
                        rules are complete.
                      </p>
                      <ResultAction>View Merch</ResultAction>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="merch" />
              )}
            </SearchSection>
            ) : null}
            {canLoadMore ? (
              <div className="border-t border-[var(--card-rim)] px-4 py-5 text-center">
                <Link
                  className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold"
                  href={`/search?${loadMoreParams.toString()}`}
                >
                  Load more
                </Link>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
