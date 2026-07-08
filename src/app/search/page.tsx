import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Camera,
  MessageCircle,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type ProfileResult = {
  id: string;
  username: string;
  display_name: string;
  account_type: string;
  city: string | null;
  region: string | null;
};

type FeedResult = {
  id: string;
  caption: string | null;
  location_label: string | null;
  style_tags: string[];
  profiles: Pick<ProfileResult, "display_name" | "username"> | null;
};

type ThreadResult = {
  id: string;
  body: string;
  profiles: Pick<ProfileResult, "display_name" | "username"> | null;
};

type ListingResult = {
  id: string;
  title: string;
  category: string;
  city: string | null;
  region: string | null;
  profiles: Pick<ProfileResult, "display_name" | "username"> | null;
};

type GigResult = {
  id: string;
  title: string;
  category: string;
  city: string | null;
  region: string | null;
  profiles: Pick<ProfileResult, "display_name" | "username"> | null;
};

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

function searchPattern(query: string) {
  return `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
    <section className="border-t border-[#e5ded4] px-4 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-5" />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <span className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-semibold">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm text-[#766d62]">
      No {label} found.
    </p>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = cleanQuery(params.q);
  const pattern = searchPattern(query);
  const supabase = await createClient();

  const [
    { data: profiles },
    { data: feedPosts },
    { data: threads },
    { data: listings },
    { data: gigs },
  ] = query
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, account_type, city, region")
          .or(
            `username.ilike.${pattern},display_name.ilike.${pattern},account_type.ilike.${pattern},city.ilike.${pattern},region.ilike.${pattern}`,
          )
          .eq("is_private", false)
          .order("display_name", { ascending: true })
          .limit(12)
          .returns<ProfileResult[]>(),
        supabase
          .from("feed_posts")
          .select(
            "id, caption, location_label, style_tags, profiles:profiles!feed_posts_author_id_fkey(display_name, username)",
          )
          .eq("is_published", true)
          .eq("moderation_status", "active")
          .or(`caption.ilike.${pattern},location_label.ilike.${pattern}`)
          .order("created_at", { ascending: false })
          .limit(8)
          .returns<FeedResult[]>(),
        supabase
          .from("thread_posts")
          .select(
            "id, body, profiles:profiles!thread_posts_author_id_fkey(display_name, username)",
          )
          .eq("moderation_status", "active")
          .ilike("body", pattern)
          .order("created_at", { ascending: false })
          .limit(8)
          .returns<ThreadResult[]>(),
        supabase
          .from("marketplace_listings")
          .select(
            "id, title, category, city, region, profiles:profiles!marketplace_listings_seller_id_fkey(display_name, username)",
          )
          .eq("status", "active")
          .eq("moderation_status", "active")
          .or(
            `title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},city.ilike.${pattern},region.ilike.${pattern}`,
          )
          .order("created_at", { ascending: false })
          .limit(8)
          .returns<ListingResult[]>(),
        supabase
          .from("gigs")
          .select(
            "id, title, category, city, region, profiles:profiles!gigs_poster_id_fkey(display_name, username)",
          )
          .eq("status", "active")
          .eq("moderation_status", "active")
          .or(
            `title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},city.ilike.${pattern},region.ilike.${pattern},compensation.ilike.${pattern}`,
          )
          .order("created_at", { ascending: false })
          .limit(8)
          .returns<GigResult[]>(),
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

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-4xl bg-[#fffdf9]">
        <header className="sticky top-0 z-10 border-b border-[#e5ded4] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              aria-label="Back to home"
              className="flex size-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
              href="/"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <form action="/search" className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-3">
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
          </div>
        </header>

        <section className="px-4 py-5">
          <h1 className="text-2xl font-bold">Search</h1>
          <p className="mt-1 text-sm text-[#766d62]">
            {query
              ? `${total} result${total === 1 ? "" : "s"} for "${query}"`
              : "Find artists, styles, threads, listings, and gigs."}
          </p>
        </section>

        {!query ? null : (
          <>
            <SearchSection
              count={profiles?.length ?? 0}
              icon={UserRound}
              title="Profiles"
            >
              {profiles?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {profiles.map((profile) => (
                    <Link
                      className="flex items-center gap-3 rounded-md border border-[#d8d1c6] bg-white p-4"
                      href={`/u/${profile.username}`}
                      key={profile.id}
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#171412] text-sm font-bold text-white">
                        {initials(profile.display_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {profile.display_name}
                        </p>
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

            <SearchSection
              count={feedPosts?.length ?? 0}
              icon={Camera}
              title="Feed"
            >
              {feedPosts?.length ? (
                <div className="space-y-3">
                  {feedPosts.map((post) => (
                    <Link
                      className="block rounded-md border border-[#d8d1c6] bg-white p-4"
                      href="/#feed"
                      key={post.id}
                    >
                      <p className="text-sm font-semibold">
                        {post.profiles?.display_name ?? "Member"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#4f473f]">
                        {post.caption || post.style_tags.join(", ") || "Feed post"}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="feed posts" />
              )}
            </SearchSection>

            <SearchSection
              count={threads?.length ?? 0}
              icon={MessageCircle}
              title="Threads"
            >
              {threads?.length ? (
                <div className="space-y-3">
                  {threads.map((thread) => (
                    <Link
                      className="block rounded-md border border-[#d8d1c6] bg-white p-4"
                      href="/#threads"
                      key={thread.id}
                    >
                      <p className="text-sm font-semibold">
                        {thread.profiles?.display_name ?? "Member"}
                      </p>
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-[#4f473f]">
                        {thread.body}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="threads" />
              )}
            </SearchSection>

            <SearchSection
              count={listings?.length ?? 0}
              icon={ShoppingBag}
              title="Marketplace"
            >
              {listings?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {listings.map((listing) => (
                    <Link
                      className="block rounded-md border border-[#d8d1c6] bg-white p-4"
                      href="/#marketplace"
                      key={listing.id}
                    >
                      <p className="text-sm font-semibold">{listing.title}</p>
                      <p className="mt-1 text-xs capitalize text-[#766d62]">
                        {listing.category}
                        {locationText(listing) ? ` - ${locationText(listing)}` : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="marketplace listings" />
              )}
            </SearchSection>

            <SearchSection
              count={gigs?.length ?? 0}
              icon={BriefcaseBusiness}
              title="Gigs"
            >
              {gigs?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {gigs.map((gig) => (
                    <Link
                      className="block rounded-md border border-[#d8d1c6] bg-white p-4"
                      href="/#gigs"
                      key={gig.id}
                    >
                      <p className="text-sm font-semibold">{gig.title}</p>
                      <p className="mt-1 text-xs capitalize text-[#766d62]">
                        {gig.category.replaceAll("_", " ")}
                        {locationText(gig) ? ` - ${locationText(gig)}` : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection label="gigs" />
              )}
            </SearchSection>
          </>
        )}
      </div>
    </main>
  );
}
