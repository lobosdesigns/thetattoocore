import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  LinkIcon,
  MapPin,
  MessageCircle,
  Send,
  ShoppingBag,
  UserPlus,
  UserRoundMinus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { followProfile, unfollowProfile } from "./actions";

type Claims = {
  sub: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string;
  account_type: string;
  bio: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  website_url: string | null;
  instagram_url: string | null;
  created_at: string;
};

type FeedMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type FeedPost = {
  id: string;
  caption: string | null;
  created_at: string;
  is_sensitive: boolean;
  style_tags: string[];
  visibility: "public_preview" | "members" | "private";
  feed_media: FeedMedia[];
};

type ThreadPost = {
  id: string;
  body: string;
  created_at: string;
  is_sensitive: boolean;
  visibility: "public_preview" | "members" | "private";
};

type ListingMedia = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

type Listing = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  category: string;
  created_at: string;
  is_sensitive: boolean;
  visibility: "public_preview" | "members" | "private";
  marketplace_media: ListingMedia[];
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function mediaUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function profileLocation(profile: Profile) {
  return [profile.city, profile.region, profile.country]
    .filter(Boolean)
    .join(", ");
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function formatPrice(listing: Listing) {
  if (listing.price_cents == null) return "Contact";

  return new Intl.NumberFormat("en-US", {
    currency: listing.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(listing.price_cents / 100);
}

function ContentLabels({
  isSensitive,
  visibility,
}: {
  isSensitive?: boolean;
  visibility?: "public_preview" | "members" | "private";
}) {
  const labels = [
    visibility === "members" ? "Members" : null,
    visibility === "private" ? "Private" : null,
    isSensitive ? "Sensitive" : null,
  ].filter(Boolean);

  if (!labels.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span
          className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 py-1 text-[11px] font-semibold text-[#766d62]"
          key={label}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-[#766d62]">{label}</p>
    </div>
  );
}

function PostPreview({ post }: { post: FeedPost }) {
  const media = post.feed_media[0];

  return (
    <article className="rounded-md border border-[#d8d1c6] bg-white">
      {media ? (
        media.media_type === "video" ? (
          <video
            className="aspect-[4/5] w-full rounded-t-md bg-[#171412] object-cover"
            controls
            playsInline
            preload="metadata"
            src={mediaUrl(media.storage_bucket, media.storage_path)}
          />
        ) : (
          <div
            className="aspect-[4/5] rounded-t-md bg-cover bg-center"
            style={{
              backgroundImage: `url(${mediaUrl(
                media.storage_bucket,
                media.storage_path,
              )})`,
            }}
          />
        )
      ) : (
        <div className="flex aspect-[4/5] items-center justify-center rounded-t-md bg-[#171412] text-white">
          <Camera className="size-8" />
        </div>
      )}
      <div className="space-y-2 p-3">
        {post.style_tags[0] ? (
          <span className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-medium">
            {post.style_tags[0]}
          </span>
        ) : null}
        <ContentLabels
          isSensitive={post.is_sensitive}
          visibility={post.visibility}
        />
        <p className="line-clamp-3 text-sm leading-6">
          {post.caption || "Untitled post"}
        </p>
        <p className="text-xs text-[#766d62]">{timeAgo(post.created_at)}</p>
      </div>
    </article>
  );
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { username } = await params;
  const query = await searchParams;
  const cleanUsername = username.replace(/^@/, "").toLowerCase();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, account_type, bio, city, region, country, website_url, instagram_url, created_at",
    )
    .eq("username", cleanUsername)
    .maybeSingle<Profile>();

  if (!profile) {
    notFound();
  }

  const [
    { count: followerCount },
    { count: followingCount },
    { count: postCount },
    { data: followRecord },
    { data: posts },
    { data: threads },
    { data: listings },
  ] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    supabase
      .from("feed_posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", profile.id)
      .eq("is_published", true)
      .eq("moderation_status", "active"),
    claims?.sub
      ? supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", claims.sub)
          .eq("following_id", profile.id)
          .maybeSingle<{ following_id: string }>()
      : Promise.resolve({ data: null }),
    supabase
      .from("feed_posts")
      .select(
        "id, caption, created_at, is_sensitive, style_tags, visibility, feed_media(id, storage_bucket, storage_path, media_type, sort_order)",
      )
      .eq("author_id", profile.id)
      .eq("is_published", true)
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "feed_media",
      })
      .limit(9)
      .returns<FeedPost[]>(),
    supabase
      .from("thread_posts")
      .select("id, body, created_at, is_sensitive, visibility")
      .eq("author_id", profile.id)
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<ThreadPost[]>(),
    supabase
      .from("marketplace_listings")
      .select(
        "id, title, description, price_cents, currency, category, created_at, is_sensitive, visibility, marketplace_media(id, storage_bucket, storage_path, sort_order)",
      )
      .eq("seller_id", profile.id)
      .eq("status", "active")
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "marketplace_media",
      })
      .limit(6)
      .returns<Listing[]>(),
  ]);

  const isOwnProfile = claims?.sub === profile.id;
  const isFollowing = Boolean(followRecord);

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-5xl bg-[#fffdf9]">
        <header className="sticky top-0 z-10 border-b border-[#e5ded4] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              aria-label="Back to feed"
              className="flex size-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
              href="/"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">
                {profile.display_name}
              </h1>
              <p className="text-xs text-[#766d62]">@{profile.username}</p>
            </div>
          </div>
        </header>

        {query.message ? (
          <p className="border-b border-[#e5ded4] bg-[#efe7da] px-4 py-3 text-sm font-medium">
            {query.message}
          </p>
        ) : null}

        <section className="border-b border-[#e5ded4] px-4 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex size-24 shrink-0 items-center justify-center rounded-md bg-[#171412] text-2xl font-bold text-white">
              {initials(profile.display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{profile.display_name}</h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#efe7da] px-2 py-1 text-xs font-semibold capitalize">
                  <BadgeCheck className="size-3" />
                  {profile.account_type}
                </span>
              </div>
              <p className="text-sm font-medium text-[#766d62]">
                @{profile.username}
              </p>
              {profile.bio ? (
                <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6">
                  {profile.bio}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#766d62]">
                {profileLocation(profile) ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" />
                    {profileLocation(profile)}
                  </span>
                ) : null}
                {profile.website_url ? (
                  <a
                    className="inline-flex items-center gap-1 font-medium text-[#171412]"
                    href={profile.website_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <LinkIcon className="size-4" />
                    Website
                  </a>
                ) : null}
                {profile.instagram_url ? (
                  <a
                    className="inline-flex items-center gap-1 font-medium text-[#171412]"
                    href={profile.instagram_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <LinkIcon className="size-4" />
                    Instagram
                  </a>
                ) : null}
              </div>
              <div className="mt-5 grid max-w-sm grid-cols-3 gap-4">
                <ProfileStat label="posts" value={postCount ?? 0} />
                <ProfileStat label="followers" value={followerCount ?? 0} />
                <ProfileStat label="following" value={followingCount ?? 0} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {isOwnProfile ? (
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                    href="/account"
                  >
                    Edit profile
                  </Link>
                ) : isFollowing ? (
                  <form action={unfollowProfile}>
                    <input name="profile_id" type="hidden" value={profile.id} />
                    <input
                      name="username"
                      type="hidden"
                      value={profile.username}
                    />
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold">
                      <UserRoundMinus className="size-4" />
                      Following
                    </button>
                  </form>
                ) : (
                  <form action={followProfile}>
                    <input name="profile_id" type="hidden" value={profile.id} />
                    <input
                      name="username"
                      type="hidden"
                      value={profile.username}
                    />
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                      <UserPlus className="size-4" />
                      Follow
                    </button>
                  </form>
                )}
                {!isOwnProfile ? (
                  <Link
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                    href="/messages"
                  >
                    <Send className="size-4" />
                    Message
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#e5ded4] px-4 py-6">
          <div className="mb-4 flex items-center gap-2">
            <Camera className="size-5" />
            <h2 className="text-lg font-bold">Posts</h2>
          </div>
          {posts?.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostPreview key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm text-[#766d62]">
              No feed posts yet.
            </p>
          )}
        </section>

        <section className="grid gap-6 px-4 py-6 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle className="size-5" />
              <h2 className="text-lg font-bold">Threads</h2>
            </div>
            <div className="space-y-3">
              {threads?.length ? (
                threads.map((thread) => (
                  <article
                    className="rounded-md border border-[#d8d1c6] bg-white p-4"
                    key={thread.id}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <ContentLabels
                        isSensitive={thread.is_sensitive}
                        visibility={thread.visibility}
                      />
                      <p className="shrink-0 text-xs text-[#766d62]">
                        {timeAgo(thread.created_at)}
                      </p>
                    </div>
                    <p className="text-sm leading-6">{thread.body}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm text-[#766d62]">
                  No threads yet.
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag className="size-5" />
              <h2 className="text-lg font-bold">Marketplace</h2>
            </div>
            <div className="space-y-3">
              {listings?.length ? (
                listings.map((listing) => (
                  <article
                    className="rounded-md border border-[#d8d1c6] bg-white p-4"
                    key={listing.id}
                  >
                    <div className="flex gap-3">
                      {listing.marketplace_media[0] ? (
                        <div
                          className="size-16 shrink-0 rounded-md bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${mediaUrl(
                              listing.marketplace_media[0].storage_bucket,
                              listing.marketplace_media[0].storage_path,
                            )})`,
                          }}
                        />
                      ) : (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[#efe7da]">
                          <ShoppingBag className="size-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold">{listing.title}</p>
                        <div className="mt-1">
                          <ContentLabels
                            isSensitive={listing.is_sensitive}
                            visibility={listing.visibility}
                          />
                        </div>
                        <p className="text-sm font-bold">
                          {formatPrice(listing)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#766d62]">
                          {listing.description || listing.category}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm text-[#766d62]">
                  No active listings yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
