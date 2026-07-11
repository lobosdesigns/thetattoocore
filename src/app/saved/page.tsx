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
import { ProfileAvatar } from "@/app/profile-avatar";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedProfessional } from "@/lib/verification";

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
  avatar_url?: string | null;
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
  is_sensitive: boolean;
  location_label: string | null;
  profiles: Pick<Profile, "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"> | null;
  style_tags: string[];
};

type ThreadPost = {
  body: string;
  id: string;
  is_sensitive: boolean;
  profiles: Pick<Profile, "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"> | null;
};

type Listing = {
  category: string;
  city: string | null;
  id: string;
  is_sensitive: boolean;
  profiles: Pick<Profile, "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"> | null;
  region: string | null;
  title: string;
};

type Gig = {
  category: string;
  city: string | null;
  id: string;
  is_sensitive: boolean;
  profiles: Pick<Profile, "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"> | null;
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
  return isVerifiedProfessional(profile);
}

function VerifiedBadge({ profile }: { profile?: ProfileBadge | null }) {
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
      <button className="ttc-surface flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold hover:border-[var(--brand-gold)]">
        <Bookmark className="size-4 fill-[var(--foreground)]" />
        Saved
      </button>
    </form>
  );
}

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(20, Number(params.page ?? "1") || 1));
  const savedLimit = page * 25;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("adult_terms_accepted_at, is_adult_confirmed")
    .eq("id", claims.sub)
    .maybeSingle<{
      adult_terms_accepted_at: string | null;
      is_adult_confirmed: boolean | null;
    }>();
  const canViewSensitive = Boolean(
    viewerProfile?.is_adult_confirmed &&
      viewerProfile.adult_terms_accepted_at,
  );

  const { data: savedItems } = await supabase
    .from("saved_items")
    .select("subject_type, subject_id, created_at")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(savedLimit)
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
      ? (() => {
          const query = supabase
            .from("feed_posts")
            .select(
              "id, caption, is_sensitive, style_tags, location_label, profiles:profiles!feed_posts_author_id_fkey(username, display_name, avatar_url, account_type, license_verified_at)",
            )
            .in("id", feedIds)
            .eq("is_published", true)
            .eq("moderation_status", "active");

          return (canViewSensitive ? query : query.eq("is_sensitive", false))
            .returns<FeedPost[]>();
        })()
      : Promise.resolve({ data: [] as FeedPost[] }),
    threadIds.length
      ? (() => {
          const query = supabase
            .from("thread_posts")
            .select(
              "id, body, is_sensitive, profiles:profiles!thread_posts_author_id_fkey(username, display_name, avatar_url, account_type, license_verified_at)",
            )
            .in("id", threadIds)
            .eq("moderation_status", "active");

          return (canViewSensitive ? query : query.eq("is_sensitive", false))
            .returns<ThreadPost[]>();
        })()
      : Promise.resolve({ data: [] as ThreadPost[] }),
    listingIds.length
      ? (() => {
          const query = supabase
            .from("marketplace_listings")
            .select(
              "id, title, category, city, region, is_sensitive, profiles:profiles!marketplace_listings_seller_id_fkey(username, display_name, avatar_url, account_type, license_verified_at)",
            )
            .in("id", listingIds)
            .eq("status", "active")
            .eq("moderation_status", "active");

          return (canViewSensitive ? query : query.eq("is_sensitive", false))
            .returns<Listing[]>();
        })()
      : Promise.resolve({ data: [] as Listing[] }),
    gigIds.length
      ? (() => {
          const query = supabase
            .from("gigs")
            .select(
              "id, title, category, city, region, is_sensitive, profiles:profiles!gigs_poster_id_fkey(username, display_name, avatar_url, account_type, license_verified_at)",
            )
            .in("id", gigIds)
            .eq("status", "active")
            .eq("moderation_status", "active");

          return (canViewSensitive ? query : query.eq("is_sensitive", false))
            .returns<Gig[]>();
        })()
      : Promise.resolve({ data: [] as Gig[] }),
    profileIds.length
      ? supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, account_type, city, region, license_verified_at",
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
          href: `/p/${post.id}`,
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
          href: `/t/${thread.id}`,
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
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-4xl overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to home"
                className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
                href="/"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Saved</h1>
                <p className="text-sm text-[var(--muted-strong)]">
                  Latest {savedLimit} artists, 4U, Gossip, Stuff, and Gigs you bookmarked. Merch joins when products go live.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Search"
                className="ttc-surface flex size-10 items-center justify-center rounded-md border"
                href="/search"
              >
                <Search className="size-5" />
              </Link>
              <NotificationBellLink className="shrink-0" userId={claims.sub} />
            </div>
          </div>
        </header>

        {params.message ? (
          <p className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_88%,var(--brand-gold)_12%)] px-4 py-3 text-sm font-semibold">
            {params.message}
          </p>
        ) : null}

        <section className="px-4 py-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--muted-strong)]">
              {cards.length} saved item{cards.length === 1 ? "" : "s"}
            </p>
            <Link
              className="ttc-surface flex h-9 items-center justify-center rounded-md border px-3 text-xs font-semibold hover:border-[var(--brand-gold)]"
              href="/search"
            >
              Find more
            </Link>
          </div>
          {!canViewSensitive ? (
            <p className="ttc-surface mb-4 rounded-md border px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
              Sensitive saved items stay hidden until your account confirms 18+
              body-art terms.
            </p>
          ) : null}

          {cards.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((card) => {
                const Icon = itemIcon(card.subjectType);

                return (
                  <article
                    className="ttc-card rounded-md p-4"
                    key={`${card.subjectType}:${card.id}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--brand-gold)]">
                          <Icon className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
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
                      <p className="text-xs capitalize text-[var(--muted-strong)]">
                        {card.meta}
                      </p>
                    ) : null}
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                      {card.summary}
                    </p>
                    {card.ownerName ? (
                      <div className="mt-3 flex items-center gap-2">
                        <ProfileAvatar profile={card.owner} size="sm" />
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
            <div className="ttc-card rounded-md p-6 text-center">
              <Bookmark className="mx-auto mb-3 size-8" />
              <h2 className="text-lg font-bold">No saved items yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-strong)]">
                Tap Save on 4U, Gossip, Stuff, or Gigs to keep them here for
                later.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                href="/"
              >
                Browse 4U
              </Link>
            </div>
          )}
          {saved.length === savedLimit ? (
            <div className="mt-5 text-center">
              <Link
                className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold"
                href={`/saved?page=${page + 1}`}
              >
                Load more
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
