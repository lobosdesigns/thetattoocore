import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  Camera,
  MessageCircle,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { toggleSavedItem } from "@/app/actions";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

type SavedItem = {
  created_at: string;
  subject_id: string;
  subject_type:
    | "feed_post"
    | "gig"
    | "marketplace_listing"
    | "profile"
    | "thread_post";
};

type ProfileBadge = {
  account_type: string;
  license_verified_at: string | null;
};

type Profile = ProfileBadge & {
  city: string | null;
  display_name: string;
  id: string;
  region: string | null;
  username: string;
};

type FeedPost = {
  caption: string | null;
  id: string;
  location_label: string | null;
  profiles: Pick<Profile, "account_type" | "display_name" | "license_verified_at" | "username"> | null;
  style_tags: string[];
};

type ThreadPost = {
  body: string;
  id: string;
  profiles: Pick<Profile, "account_type" | "display_name" | "license_verified_at" | "username"> | null;
};

type Listing = {
  category: string;
  city: string | null;
  id: string;
  profiles: Pick<Profile, "account_type" | "display_name" | "license_verified_at" | "username"> | null;
  region: string | null;
  title: string;
};

type Gig = {
  category: string;
  city: string | null;
  id: string;
  profiles: Pick<Profile, "account_type" | "display_name" | "license_verified_at" | "username"> | null;
  region: string | null;
  title: string;
};

type SavedCard = {
  href: string;
  id: string;
  meta: string;
  owner?: ProfileBadge | null;
  ownerName?: string | null;
  subjectType: SavedItem["subject_type"];
  summary: string;
  title: string;
  typeLabel: string;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Saved",
};

function isVerifiedProfile(profile?: ProfileBadge | null) {
  return Boolean(
    profile?.license_verified_at &&
      (profile.account_type === "artist" || profile.account_type === "studio"),
  );
}

function VerifiedBadge({ profile }: { profile?: ProfileBadge | null }) {
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

function idsFor(items: SavedItem[], type: SavedItem["subject_type"]) {
  return items
    .filter((item) => item.subject_type === type)
    .map((item) => item.subject_id);
}

function itemIcon(type: SavedItem["subject_type"]) {
  if (type === "feed_post") return Camera;
  if (type === "thread_post") return MessageCircle;
  if (type === "marketplace_listing") return ShoppingBag;
  if (type === "gig") return BriefcaseBusiness;

  return UserRound;
}

function UnsaveButton({
  subjectId,
  subjectType,
}: {
  subjectId: string;
  subjectType: SavedItem["subject_type"];
}) {
  return (
    <form action={toggleSavedItem}>
      <input name="subject_id" type="hidden" value={subjectId} />
      <input name="subject_type" type="hidden" value={subjectType} />
      <input name="saved" type="hidden" value="true" />
      <input name="return_path" type="hidden" value="/saved" />
      <button className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-3 text-xs font-semibold">
        <Bookmark className="size-4 fill-[#171412]" />
        Saved
      </button>
    </form>
  );
}

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: savedItems } = await supabase
    .from("saved_items")
    .select("subject_type, subject_id, created_at")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<SavedItem[]>();

  const saved = savedItems ?? [];
  const feedIds = idsFor(saved, "feed_post");
  const threadIds = idsFor(saved, "thread_post");
  const listingIds = idsFor(saved, "marketplace_listing");
  const gigIds = idsFor(saved, "gig");
  const profileIds = idsFor(saved, "profile");

  const [
    { data: feedPosts },
    { data: threadPosts },
    { data: listings },
    { data: gigs },
    { data: profiles },
  ] = await Promise.all([
    feedIds.length
      ? supabase
          .from("feed_posts")
          .select(
            "id, caption, style_tags, location_label, profiles:profiles!feed_posts_author_id_fkey(username, display_name, account_type, license_verified_at)",
          )
          .in("id", feedIds)
          .eq("is_published", true)
          .eq("moderation_status", "active")
          .returns<FeedPost[]>()
      : Promise.resolve({ data: [] as FeedPost[] }),
    threadIds.length
      ? supabase
          .from("thread_posts")
          .select(
            "id, body, profiles:profiles!thread_posts_author_id_fkey(username, display_name, account_type, license_verified_at)",
          )
          .in("id", threadIds)
          .eq("moderation_status", "active")
          .returns<ThreadPost[]>()
      : Promise.resolve({ data: [] as ThreadPost[] }),
    listingIds.length
      ? supabase
          .from("marketplace_listings")
          .select(
            "id, title, category, city, region, profiles:profiles!marketplace_listings_seller_id_fkey(username, display_name, account_type, license_verified_at)",
          )
          .in("id", listingIds)
          .eq("status", "active")
          .eq("moderation_status", "active")
          .returns<Listing[]>()
      : Promise.resolve({ data: [] as Listing[] }),
    gigIds.length
      ? supabase
          .from("gigs")
          .select(
            "id, title, category, city, region, profiles:profiles!gigs_poster_id_fkey(username, display_name, account_type, license_verified_at)",
          )
          .in("id", gigIds)
          .eq("status", "active")
          .eq("moderation_status", "active")
          .returns<Gig[]>()
      : Promise.resolve({ data: [] as Gig[] }),
    profileIds.length
      ? supabase
          .from("profiles")
          .select(
            "id, username, display_name, account_type, city, region, license_verified_at",
          )
          .in("id", profileIds)
          .eq("is_private", false)
          .is("banned_at", null)
          .is("suspended_at", null)
          .returns<Profile[]>()
      : Promise.resolve({ data: [] as Profile[] }),
  ]);

  const feedMap = new Map((feedPosts ?? []).map((post) => [post.id, post]));
  const threadMap = new Map((threadPosts ?? []).map((thread) => [thread.id, thread]));
  const listingMap = new Map((listings ?? []).map((listing) => [listing.id, listing]));
  const gigMap = new Map((gigs ?? []).map((gig) => [gig.id, gig]));
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const cards: SavedCard[] = saved
    .map((item) => {
      if (item.subject_type === "feed_post") {
        const post = feedMap.get(item.subject_id);
        if (!post) return null;

        return {
          href: `/#feed-${post.id}`,
          id: post.id,
          meta: [post.profiles?.display_name, post.location_label]
            .filter(Boolean)
            .join(" - "),
          owner: post.profiles,
          ownerName: post.profiles?.display_name,
          subjectType: item.subject_type,
          summary: post.caption || post.style_tags.join(", ") || "4U post",
          title: "4U post",
          typeLabel: "4U",
        };
      }

      if (item.subject_type === "thread_post") {
        const thread = threadMap.get(item.subject_id);
        if (!thread) return null;

        return {
          href: `/#thread-${thread.id}`,
          id: thread.id,
          meta: thread.profiles?.display_name ?? "Member",
          owner: thread.profiles,
          ownerName: thread.profiles?.display_name,
          subjectType: item.subject_type,
          summary: thread.body,
          title: "Gossip thread",
          typeLabel: "Gossip",
        };
      }

      if (item.subject_type === "marketplace_listing") {
        const listing = listingMap.get(item.subject_id);
        if (!listing) return null;

        return {
          href: `/stuff/${listing.id}`,
          id: listing.id,
          meta: [listing.category, locationText(listing)].filter(Boolean).join(" - "),
          owner: listing.profiles,
          ownerName: listing.profiles?.display_name,
          subjectType: item.subject_type,
          summary: listing.profiles?.display_name
            ? `Listed by ${listing.profiles.display_name}`
            : "Stuff listing",
          title: listing.title,
          typeLabel: "Stuff",
        };
      }

      if (item.subject_type === "gig") {
        const gig = gigMap.get(item.subject_id);
        if (!gig) return null;

        return {
          href: `/gigs/${gig.id}`,
          id: gig.id,
          meta: [gig.category.replaceAll("_", " "), locationText(gig)]
            .filter(Boolean)
            .join(" - "),
          owner: gig.profiles,
          ownerName: gig.profiles?.display_name,
          subjectType: item.subject_type,
          summary: gig.profiles?.display_name
            ? `Posted by ${gig.profiles.display_name}`
            : "Gig",
          title: gig.title,
          typeLabel: "Gigs",
        };
      }

      const profile = profileMap.get(item.subject_id);
      if (!profile) return null;

      return {
        href: `/u/${profile.username}`,
        id: profile.id,
        meta: [profile.account_type, locationText(profile)].filter(Boolean).join(" - "),
        owner: profile,
        ownerName: profile.display_name,
        subjectType: item.subject_type,
        summary: `@${profile.username}`,
        title: profile.display_name,
        typeLabel: "Profile",
      };
    })
    .filter(Boolean) as SavedCard[];

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-4xl bg-[#fffdf9]">
        <header className="sticky top-0 z-10 border-b border-[#e5ded4] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to home"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
                href="/"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Saved</h1>
                <p className="text-sm text-[#766d62]">
                  Artists, 4U, Gossip, Stuff, and Gigs you bookmarked.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Search"
                className="flex size-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
                href="/search"
              >
                <Search className="size-5" />
              </Link>
              <NotificationBellLink className="shrink-0" userId={claims.sub} />
            </div>
          </div>
        </header>

        {params.message ? (
          <p className="border-b border-[#d8d1c6] bg-[#efe7da] px-4 py-3 text-sm font-semibold">
            {params.message}
          </p>
        ) : null}

        <section className="px-4 py-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#766d62]">
              {cards.length} saved item{cards.length === 1 ? "" : "s"}
            </p>
            <Link
              className="flex h-9 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-3 text-xs font-semibold"
              href="/search"
            >
              Find more
            </Link>
          </div>

          {cards.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((card) => {
                const Icon = itemIcon(card.subjectType);

                return (
                  <article
                    className="rounded-md border border-[#d8d1c6] bg-white p-4"
                    key={`${card.subjectType}:${card.id}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white">
                          <Icon className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-[#766d62]">
                            {card.typeLabel}
                          </p>
                          <Link
                            className="mt-1 block text-sm font-bold hover:underline"
                            href={card.href}
                          >
                            {card.title}
                          </Link>
                        </div>
                      </div>
                      <UnsaveButton
                        subjectId={card.id}
                        subjectType={card.subjectType}
                      />
                    </div>
                    {card.meta ? (
                      <p className="text-xs capitalize text-[#766d62]">
                        {card.meta}
                      </p>
                    ) : null}
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#4f473f]">
                      {card.summary}
                    </p>
                    {card.ownerName ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs font-semibold">
                          {card.ownerName}
                        </span>
                        <VerifiedBadge profile={card.owner} />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-6 text-center">
              <Bookmark className="mx-auto mb-3 size-8" />
              <h2 className="text-lg font-bold">No saved items yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#766d62]">
                Tap Save on 4U, Gossip, Stuff, or Gigs to keep them here for
                later.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                href="/"
              >
                Browse 4U
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
