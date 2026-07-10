import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  MessageCircle,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { ProfileAvatar } from "@/app/profile-avatar";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedProfessional } from "@/lib/verification";

type ProfileResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  account_type: string;
  city: string | null;
  license_verified_at: string | null;
  region: string | null;
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
    "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"
  > | null;
};

type ThreadResult = {
  id: string;
  body: string;
  profiles: Pick<
    ProfileResult,
    "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"
  > | null;
};

type ListingResult = {
  id: string;
  title: string;
  category: string;
  city: string | null;
  region: string | null;
  profiles: Pick<
    ProfileResult,
    "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"
  > | null;
};

type GigResult = {
  id: string;
  title: string;
  category: string;
  city: string | null;
  region: string | null;
  profiles: Pick<
    ProfileResult,
    "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"
  > | null;
};

type SearchType = "all" | "profiles" | "feed" | "threads" | "marketplace" | "gigs";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Search",
};

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
    text === "gigs"
  ) {
    return text;
  }

  return "all";
}

function searchPattern(query: string) {
  return `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
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

function VerifiedBadge({ profile }: { profile?: SearchProfileBadge }) {
  if (!isVerifiedProfile(profile)) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#171412] px-1.5 py-0.5 text-[11px] font-semibold text-white">
      <BadgeCheck className="size-3" />
      Verified
    </span>
  );
}

function locationText(value: { city: string | null; region: string | null }) {
  return [value.city, value.region].filter(Boolean).join(", ");
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
    <section className="border-t border-[#cfc8bd] px-4 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-[#171412] text-[#c8953b]">
            <Icon className="size-4" />
          </span>
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <span className="rounded-md bg-[#c8953b] px-2 py-1 text-xs font-bold text-[#171412]">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-4 text-sm text-[#766d62] shadow-sm">
      No {label} found.
    </p>
  );
}

function ResultAction({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-3 inline-flex h-8 items-center rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 text-xs font-semibold text-[#171412]">
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
  const pattern = searchPattern(query);
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
  const shouldRunProfiles = hasSearch && runSection(type, "profiles");
  const shouldRunFeed = hasSearch && runSection(type, "feed");
  const shouldRunThreads = hasSearch && runSection(type, "threads");
  const shouldRunListings = hasSearch && runSection(type, "marketplace");
  const shouldRunGigs = hasSearch && runSection(type, "gigs");

  const [
    { data: profiles },
    { data: feedPosts },
    { data: threads },
    { data: listings },
    { data: gigs },
  ] = hasSearch
    ? await Promise.all([
        shouldRunProfiles
          ? supabase
              .from("profiles")
              .select(
                "id, username, display_name, avatar_url, account_type, city, license_verified_at, region",
              )
              .or(
                `username.ilike.${pattern},display_name.ilike.${pattern},account_type.ilike.${pattern},city.ilike.${pattern},region.ilike.${pattern}`,
              )
              .eq("is_private", false)
              .ilike("city", city ? cityPattern : "%")
              .ilike("region", region ? regionPattern : "%")
              .order("display_name", { ascending: true })
              .limit(resultLimit)
              .returns<ProfileResult[]>()
          : Promise.resolve({ data: [] as ProfileResult[] }),
        shouldRunFeed
          ? supabase
              .from("feed_posts")
              .select(
                "id, caption, location_label, style_tags, profiles:profiles!feed_posts_author_id_fkey(display_name, avatar_url, username, account_type, license_verified_at)",
              )
              .eq("is_published", true)
              .eq("moderation_status", "active")
              .eq("visibility", "public_preview")
              .eq("is_sensitive", false)
              .or(
                query
                  ? `caption.ilike.${pattern},location_label.ilike.${pattern}`
                  : `caption.ilike.%,location_label.ilike.%`,
              )
              .ilike("location_label", city ? cityPattern : "%")
              .order("created_at", { ascending: false })
              .limit(resultLimit)
              .returns<FeedResult[]>()
          : Promise.resolve({ data: [] as FeedResult[] }),
        shouldRunThreads && query
          ? supabase
              .from("thread_posts")
              .select(
                "id, body, profiles:profiles!thread_posts_author_id_fkey(display_name, avatar_url, username, account_type, license_verified_at)",
              )
              .eq("moderation_status", "active")
              .eq("visibility", "public_preview")
              .eq("is_sensitive", false)
              .ilike("body", pattern)
              .order("created_at", { ascending: false })
              .limit(resultLimit)
              .returns<ThreadResult[]>()
          : Promise.resolve({ data: [] as ThreadResult[] }),
        shouldRunListings
          ? supabase
              .from("marketplace_listings")
              .select(
                "id, title, category, city, region, profiles:profiles!marketplace_listings_seller_id_fkey(display_name, avatar_url, username, account_type, license_verified_at)",
              )
              .eq("status", "active")
              .eq("moderation_status", "active")
              .eq("visibility", "public_preview")
              .eq("is_sensitive", false)
              .or(
                query
                  ? `title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},city.ilike.${pattern},region.ilike.${pattern}`
                  : `title.ilike.%,description.ilike.%,category.ilike.%,city.ilike.%,region.ilike.%`,
              )
              .ilike("category", category ? categoryPattern : "%")
              .ilike("city", city ? cityPattern : "%")
              .ilike("region", region ? regionPattern : "%")
              .order("created_at", { ascending: false })
              .limit(resultLimit)
              .returns<ListingResult[]>()
          : Promise.resolve({ data: [] as ListingResult[] }),
        shouldRunGigs
          ? supabase
              .from("gigs")
              .select(
                "id, title, category, city, region, profiles:profiles!gigs_poster_id_fkey(display_name, avatar_url, username, account_type, license_verified_at)",
              )
              .eq("status", "active")
              .eq("moderation_status", "active")
              .eq("visibility", "public_preview")
              .eq("is_sensitive", false)
              .or(
                query
                  ? `title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},city.ilike.${pattern},region.ilike.${pattern},compensation.ilike.${pattern}`
                  : `title.ilike.%,description.ilike.%,category.ilike.%,city.ilike.%,region.ilike.%,compensation.ilike.%`,
              )
              .ilike("category", category ? categoryPattern : "%")
              .ilike("city", city ? cityPattern : "%")
              .ilike("region", region ? regionPattern : "%")
              .order("created_at", { ascending: false })
              .limit(resultLimit)
              .returns<GigResult[]>()
          : Promise.resolve({ data: [] as GigResult[] }),
      ])
    : [
        { data: [] as ProfileResult[] },
        { data: [] as FeedResult[] },
        { data: [] as ThreadResult[] },
        { data: [] as ListingResult[] },
        { data: [] as GigResult[] },
      ];

  const total =
    (profiles?.length ?? 0) +
    (feedPosts?.length ?? 0) +
    (threads?.length ?? 0) +
    (listings?.length ?? 0) +
    (gigs?.length ?? 0);
  const canLoadMore =
    hasSearch &&
    [
      shouldRunProfiles ? profiles?.length ?? 0 : 0,
      shouldRunFeed ? feedPosts?.length ?? 0 : 0,
      shouldRunThreads ? threads?.length ?? 0 : 0,
      shouldRunListings ? listings?.length ?? 0 : 0,
      shouldRunGigs ? gigs?.length ?? 0 : 0,
    ].some((count) => count === resultLimit);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#202020] text-[#171412]">
      <div className="mx-auto min-h-screen w-full max-w-4xl overflow-x-hidden bg-[#f2f1ee] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              aria-label="Back to home"
              className="flex size-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
              href="/"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <form
              action="/search"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 shadow-sm"
            >
              <Search className="size-4 shrink-0 text-[#766d62]" />
              <input
                autoFocus
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                defaultValue={query}
                maxLength={80}
                name="q"
                placeholder="Search artists, styles, shops, gigs"
              />
              <button className="h-8 rounded-md bg-[#171412] px-3 text-xs font-semibold text-white">
                Search
              </button>
            </form>
            <NotificationBellLink className="shrink-0" />
          </div>
        </header>

        <section className="px-4 py-5">
          <h1 className="text-2xl font-bold">Search</h1>
          <p className="mt-1 text-sm text-[#766d62]">
            {hasSearch
              ? `${total} result${total === 1 ? "" : "s"} found`
              : "Find public artists, styles, gossip, stuff, and gigs."}
          </p>
          <p className="mt-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 py-2 text-xs leading-5 text-[#766d62]">
            Search only shows public, non-sensitive previews. Member-only,
            private, and 18+ sensitive body-art content stays behind login and
            terms confirmation, and DMs never appear in search.
          </p>
          <form
            action="/search"
            className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <input name="q" type="hidden" value={query} />
            <input name="type" type="hidden" value={type === "all" ? "" : type} />
            <input
              className="h-10 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 text-sm outline-none focus:border-[#171412]"
              defaultValue={category}
              name="category"
              placeholder="category"
            />
            <input
              className="h-10 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 text-sm outline-none focus:border-[#171412]"
              defaultValue={city}
              name="city"
              placeholder="city"
            />
            <input
              className="h-10 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 text-sm outline-none focus:border-[#171412]"
              defaultValue={region}
              name="region"
              placeholder="state / region"
            />
            <button className="h-10 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-4 text-sm font-semibold">
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
            ].map(([value, label]) => (
              <Link
                className={`flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-semibold ${
                  type === value
                    ? "border-[#171412] bg-[#171412] text-white shadow-[0_6px_16px_rgba(23,20,18,0.16)]"
                    : "border-[#cfc8bd] bg-[#fffdf9] hover:border-[#c8953b]"
                }`}
                href={typedHref(value as SearchType, typedParams)}
                key={value}
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        {!hasSearch ? null : (
          <>
            {runSection(type, "profiles") ? (
            <SearchSection count={profiles?.length ?? 0} icon={UserRound} title="Profiles">
              {profiles?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {profiles.map((profile) => (
                    <Link
                      className="ttc-card flex items-center gap-3 rounded-md border border-[#cfc8bd] bg-white p-4"
                      href={`/u/${profile.username}`}
                      key={profile.id}
                    >
                      <ProfileAvatar profile={profile} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">
                            {profile.display_name}
                          </p>
                          <VerifiedBadge profile={profile} />
                        </div>
                        <p className="text-xs text-[#766d62]">
                          @{profile.username} - {profile.account_type}
                        </p>
                        {locationText(profile) ? (
                          <p className="mt-1 text-xs text-[#766d62]">
                            {locationText(profile)}
                          </p>
                        ) : null}
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
            <SearchSection count={feedPosts?.length ?? 0} icon={Camera} title="4U">
              {feedPosts?.length ? (
                <div className="space-y-3">
                  {feedPosts.map((post) => (
                    <Link
                      className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-4"
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
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#4f473f]">
                        {post.caption || post.style_tags.join(", ") || "4U post"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#766d62]">
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
            <SearchSection count={threads?.length ?? 0} icon={MessageCircle} title="Gossip">
              {threads?.length ? (
                <div className="space-y-3">
                  {threads.map((thread) => (
                    <Link
                      className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-4"
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
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-[#4f473f]">
                        {thread.body}
                      </p>
                      {thread.profiles?.username ? (
                        <p className="mt-2 text-xs text-[#766d62]">
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
            <SearchSection count={listings?.length ?? 0} icon={ShoppingBag} title="Stuff">
              {listings?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {listings.map((listing) => (
                    <Link
                      className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-4"
                      href={`/stuff/${listing.id}`}
                      key={listing.id}
                    >
                      <p className="text-sm font-semibold">{listing.title}</p>
                      <p className="mt-1 text-xs capitalize text-[#766d62]">
                        {listing.category}
                        {locationText(listing) ? ` - ${locationText(listing)}` : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <ProfileAvatar profile={listing.profiles} size="sm" />
                        <VerifiedBadge profile={listing.profiles} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#766d62]">
                        {listing.profiles?.username ? (
                          <span>@{listing.profiles.username}</span>
                        ) : null}
                        {listing.profiles?.display_name ? (
                          <span>{listing.profiles.display_name}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 rounded-md bg-[#fffdf9] px-3 py-2 text-xs leading-5 text-[#766d62]">
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
            <SearchSection count={gigs?.length ?? 0} icon={BriefcaseBusiness} title="Gigs">
              {gigs?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {gigs.map((gig) => (
                    <Link
                      className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-4"
                      href={`/gigs/${gig.id}`}
                      key={gig.id}
                    >
                      <p className="text-sm font-semibold">{gig.title}</p>
                      <p className="mt-1 text-xs capitalize text-[#766d62]">
                        {gig.category.replaceAll("_", " ")}
                        {locationText(gig) ? ` - ${locationText(gig)}` : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <ProfileAvatar profile={gig.profiles} size="sm" />
                        <VerifiedBadge profile={gig.profiles} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#766d62]">
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
            {canLoadMore ? (
              <div className="border-t border-[#cfc8bd] px-4 py-5 text-center">
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-4 text-sm font-semibold"
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
