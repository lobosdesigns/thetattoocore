import Link from "next/link";
import {
  Bell,
  Heart,
  Home as HomeIcon,
  ImageIcon,
  LogIn,
  MessageCircle,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  createPostComment,
  createThreadComment,
  togglePostLike,
  toggleThreadLike,
} from "./actions";
import { startConversation } from "./messages/actions";
import { FloatingComposer } from "./floating-composer";
import { LogoMark } from "./logo-mark";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
  email?: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string;
  account_type: string;
  city: string | null;
  region: string | null;
  role?: string | null;
};

type FeedPost = {
  id: string;
  caption: string | null;
  feed_media: PostMedia[];
  post_comments: PostComment[];
  post_likes: PostLike[];
  style_tags: string[];
  location_label: string | null;
  created_at: string;
  profiles: Profile | null;
};

type ThreadPost = {
  id: string;
  body: string;
  created_at: string;
  thread_comments: ThreadComment[];
  thread_likes: ThreadLike[];
  thread_media: ThreadMedia[];
  profiles: Profile | null;
};

type MarketplaceListing = {
  id: string;
  title: string;
  description: string | null;
  marketplace_media: ListingMedia[];
  price_cents: number | null;
  currency: string;
  category: string;
  city: string | null;
  region: string | null;
  created_at: string;
  profiles: Profile | null;
};

type PostMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type ListingMedia = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

type ThreadMedia = {
  id: string;
  media_type: "image";
  storage_bucket: string;
  storage_path: string;
};

type PostLike = {
  user_id: string;
};

type PostComment = {
  id: string;
  body: string;
  created_at: string;
  profiles: Pick<Profile, "display_name" | "username"> | null;
};

type ThreadLike = {
  user_id: string;
};

type ThreadComment = {
  id: string;
  body: string;
  created_at: string;
  profiles: Pick<Profile, "display_name" | "username"> | null;
};

const samplePosts = [
  {
    artist: "Mara Vale",
    handle: "@maravale",
    city: "Austin, TX",
    style: "blackwork",
    image:
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=1200&q=80",
    caption:
      "Fresh ornamental forearm piece. Built for flow, healed contrast in mind.",
    likes: "2.4k",
    comments: "184",
  },
  {
    artist: "Noah Ink",
    handle: "@noahink",
    city: "Chicago, IL",
    style: "fine line",
    image:
      "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=1200&q=80",
    caption: "Tiny botanicals today. Booking July flash appointments now.",
    likes: "921",
    comments: "67",
  },
];

const sampleThreads = [
  "What aftercare routine do you recommend for heavy blackwork in summer?",
  "Guest spot opening in Dallas first week of August. Realism artists preferred.",
  "Shop owners: deposits through marketplace or direct invoice?",
];

const sampleListings = [
  { title: "Dragon flash sheet", price: "$80", tag: "digital" },
  { title: "Guest chair: Phoenix", price: "$300/day", tag: "studio" },
  { title: "Aftercare balm batch", price: "$14", tag: "supplies" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function profileLocation(profile?: Profile | null) {
  return [profile?.city, profile?.region].filter(Boolean).join(", ");
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function formatPrice(listing: MarketplaceListing) {
  if (listing.price_cents == null) return "Contact";

  return new Intl.NumberFormat("en-US", {
    currency: listing.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(listing.price_cents / 100);
}

function listingMessage(listing: MarketplaceListing) {
  return `Hi, I am interested in your marketplace listing: ${listing.title}`;
}

function mediaUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function MediaFrame({ media }: { media?: PostMedia }) {
  if (!media) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-[#171412] text-white">
        <div className="text-center">
          <ImageIcon className="mx-auto mb-2 size-10 opacity-80" />
          <p className="text-sm font-semibold">No media attached</p>
        </div>
      </div>
    );
  }

  const src = mediaUrl(media.storage_bucket, media.storage_path);

  if (media.media_type === "video") {
    return (
      <video
        className="aspect-[4/5] w-full bg-[#171412] object-cover"
        controls
        playsInline
        preload="metadata"
        src={src}
      />
    );
  }

  return (
    <div
      className="aspect-[4/5] bg-cover bg-center"
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}

function ListingThumb({ media }: { media?: ListingMedia }) {
  if (!media) {
    return (
      <div className="flex size-11 items-center justify-center rounded-md bg-[#efe7da]">
        <ImageIcon className="size-5" />
      </div>
    );
  }

  return (
    <div
      className="size-11 rounded-md bg-cover bg-center"
      style={{
        backgroundImage: `url(${mediaUrl(media.storage_bucket, media.storage_path)})`,
      }}
    />
  );
}

function ThreadImage({ media }: { media?: ThreadMedia }) {
  if (!media) return null;

  return (
    <div
      className="mt-3 aspect-[16/10] rounded-md border border-[#e5ded4] bg-cover bg-center"
      style={{
        backgroundImage: `url(${mediaUrl(media.storage_bucket, media.storage_path)})`,
      }}
    />
  );
}

function AuthCallout({ isSignedIn }: { isSignedIn: boolean }) {
  if (isSignedIn) {
    return (
      <Link
        className="flex h-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
        href="/account"
      >
        Profile
      </Link>
    );
  }

  return (
    <Link
      className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
      href="/login"
    >
      <LogIn className="size-4" />
      Sign in
    </Link>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  const [
    { data: currentProfile },
    { data: feedPosts },
    { data: threadPosts },
    { data: listings },
  ] = await Promise.all([
    claims?.sub
      ? supabase
          .from("profiles")
          .select("id, username, display_name, account_type, city, region, role")
          .eq("id", claims.sub)
          .maybeSingle<Profile>()
      : Promise.resolve({ data: null }),
    supabase
      .from("feed_posts")
      .select(
        "id, caption, style_tags, location_label, created_at, feed_media(id, storage_bucket, storage_path, media_type, sort_order), post_likes(user_id), post_comments(id, body, created_at, profiles:profiles!post_comments_author_id_fkey(display_name, username)), profiles:profiles!feed_posts_author_id_fkey(id, username, display_name, account_type, city, region)",
      )
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "feed_media",
      })
      .limit(20)
      .returns<FeedPost[]>(),
    supabase
      .from("thread_posts")
      .select(
        "id, body, created_at, thread_media(id, storage_bucket, storage_path, media_type, sort_order), thread_likes(user_id), thread_comments(id, body, created_at, profiles:profiles!thread_comments_author_id_fkey(display_name, username)), profiles:profiles!thread_posts_author_id_fkey(id, username, display_name, account_type, city, region)",
      )
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "thread_media",
      })
      .limit(20)
      .returns<ThreadPost[]>(),
    supabase
      .from("marketplace_listings")
      .select(
        "id, title, description, price_cents, currency, category, city, region, created_at, marketplace_media(id, storage_bucket, storage_path, sort_order), profiles:profiles!marketplace_listings_seller_id_fkey(id, username, display_name, account_type, city, region)",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "marketplace_media",
      })
      .limit(20)
      .returns<MarketplaceListing[]>(),
  ]);

  const isSignedIn = Boolean(claims?.sub);
  const canCreate = Boolean(currentProfile);
  const adminRole = currentProfile?.role;
  const profileHref = currentProfile ? `/u/${currentProfile.username}` : "/account";

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#171412]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[240px_minmax(420px,620px)_320px]">
        <aside className="hidden border-r border-[#d8d1c6] bg-[#fffdf9] px-5 py-6 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="text-lg font-semibold">TheTattooCore</p>
              <p className="text-xs text-[#766d62]">
                The heart of the tattoo community.
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              [HomeIcon, "Feed", "#feed"],
              [MessageCircle, "Threads", "#threads"],
              [ShoppingBag, "Marketplace", "#marketplace"],
              [Send, "Messages", "/messages"],
              [UserRound, "Profile", profileHref],
            ].map(([Icon, label, href]) => (
              <Link
                className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium hover:bg-[#f5f2eb]"
                href={href as string}
                key={label as string}
              >
                <Icon className="size-5" />
                {label as string}
              </Link>
            ))}
          </nav>

          {adminRole && ["moderator", "admin", "owner"].includes(adminRole) ? (
            <Link
              className="mt-4 flex h-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
              href="/admin"
            >
              Admin
            </Link>
          ) : null}
        </aside>

        <section className="border-x border-[#d8d1c6] bg-[#fffdf9]">
          <header className="sticky top-0 z-10 border-b border-[#e5ded4] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <LogoMark className="size-11 shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-xl font-bold">TheTattooCore</h1>
                  <p className="text-xs text-[#766d62]">
                    The heart of the tattoo community.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Search"
                  className="flex size-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
                >
                  <Search className="size-5" />
                </button>
                <button
                  aria-label="Notifications"
                  className="flex size-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
                >
                  <Bell className="size-5" />
                </button>
                <AuthCallout isSignedIn={isSignedIn} />
              </div>
            </div>
          </header>

          <div className="flex gap-2 overflow-x-auto border-b border-[#e5ded4] px-4 py-3">
            {[
              ["Feed", "#feed"],
              ["Threads", "#threads"],
              ["Marketplace", "#marketplace"],
              ["Messages", "/messages"],
            ].map(([tab, href], index) => (
              <Link
                className={`flex h-9 shrink-0 items-center rounded-md border border-[#d8d1c6] px-4 text-sm font-medium ${
                  index === 0 ? "bg-[#171412] text-white" : "bg-white"
                }`}
                href={href}
                key={tab}
              >
                {tab}
              </Link>
            ))}
          </div>

          {params.message ? (
            <p className="border-b border-[#e5ded4] bg-[#efe7da] px-4 py-3 text-sm font-medium">
              {params.message}
            </p>
          ) : null}

          <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
          <section
            className="min-w-full snap-start divide-y divide-[#e5ded4]"
            id="feed"
          >
            {feedPosts?.length ? (
              feedPosts.map((post) => (
                <article className="bg-[#fffdf9]" key={post.id}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <Link
                      className="flex min-w-0 items-center gap-3"
                      href={`/u/${post.profiles?.username ?? "member"}`}
                    >
                      <div className="flex size-11 items-center justify-center rounded-md bg-[#c8953b] text-sm font-bold text-white">
                        {initials(post.profiles?.display_name ?? "TC")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {post.profiles?.display_name ?? "TheTattooCore member"}
                        </p>
                        <p className="text-xs text-[#766d62]">
                          @{post.profiles?.username ?? "member"} -{" "}
                          {post.location_label ||
                            profileLocation(post.profiles) ||
                            "TattooCore"}{" "}
                          - {timeAgo(post.created_at)}
                        </p>
                      </div>
                    </Link>
                    {post.style_tags[0] ? (
                      <span className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-medium">
                        {post.style_tags[0]}
                      </span>
                    ) : null}
                  </div>

                  <MediaFrame media={post.feed_media[0]} />

                  <div className="space-y-3 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <form action={togglePostLike}>
                          <input name="post_id" type="hidden" value={post.id} />
                          <input
                            name="liked"
                            type="hidden"
                            value={post.post_likes.some(
                              (like) => like.user_id === claims?.sub,
                            )
                              ? "true"
                              : "false"}
                          />
                          <button className="flex items-center gap-2 text-sm font-medium">
                            <Heart
                              className={`size-5 ${
                                post.post_likes.some(
                                  (like) => like.user_id === claims?.sub,
                                )
                                  ? "fill-[#c8953b] text-[#c8953b]"
                                  : ""
                              }`}
                            />
                            {post.post_likes.length}
                          </button>
                        </form>
                        <button className="flex items-center gap-2 text-sm font-medium">
                          <MessageCircle className="size-5" />
                          {post.post_comments.length}
                        </button>
                      </div>
                      <button className="flex items-center gap-2 text-sm font-medium">
                        <Send className="size-5" />
                        Share
                      </button>
                    </div>
                    <p className="text-sm leading-6">{post.caption}</p>
                    {post.post_comments.length ? (
                      <div className="space-y-2 border-t border-[#e5ded4] pt-3">
                        {post.post_comments.slice(0, 2).map((comment) => (
                          <p className="text-sm leading-5" key={comment.id}>
                            <span className="font-semibold">
                              {comment.profiles?.display_name ?? "Member"}
                            </span>{" "}
                            {comment.body}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {canCreate ? (
                      <form
                        action={createPostComment}
                        className="flex items-center gap-2 border-t border-[#e5ded4] pt-3"
                      >
                        <input name="post_id" type="hidden" value={post.id} />
                        <input
                          className="h-10 min-w-0 flex-1 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                          maxLength={300}
                          name="body"
                          placeholder="Add a short comment"
                          required
                        />
                        <button
                          aria-label="Post comment"
                          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white"
                        >
                          <Send className="size-4" />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              samplePosts.map((post) => (
                <article className="bg-[#fffdf9]" key={post.handle}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-md bg-[#c8953b]" />
                      <div>
                        <p className="text-sm font-semibold">{post.artist}</p>
                        <p className="text-xs text-[#766d62]">
                          {post.handle} · {post.city}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-medium">
                      {post.style}
                    </span>
                  </div>
                  <div
                    className="aspect-[4/5] bg-cover bg-center"
                    style={{ backgroundImage: `url(${post.image})` }}
                  />
                  <div className="space-y-3 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 text-sm font-medium">
                          <Heart className="size-5" />
                          {post.likes}
                        </button>
                        <button className="flex items-center gap-2 text-sm font-medium">
                          <MessageCircle className="size-5" />
                          {post.comments}
                        </button>
                      </div>
                      <button className="flex items-center gap-2 text-sm font-medium">
                        <Send className="size-5" />
                        Share
                      </button>
                    </div>
                    <p className="text-sm leading-6">{post.caption}</p>
                  </div>
                </article>
              ))
            )}
          </section>

          <section
            className="min-w-full snap-start border-l border-[#e5ded4] px-4 py-5"
            id="threads"
          >
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="size-5" />
              <h2 className="text-lg font-bold">Threads</h2>
            </div>
            <div className="space-y-3">
              {threadPosts?.length
                ? threadPosts.map((thread) => (
                    <article
                      className="rounded-md border border-[#d8d1c6] bg-white p-4"
                      key={thread.id}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Link
                          className="text-sm font-semibold hover:underline"
                          href={`/u/${thread.profiles?.username ?? "member"}`}
                        >
                          {thread.profiles?.display_name ?? "Member"}
                        </Link>
                        <p className="text-xs text-[#766d62]">
                          {timeAgo(thread.created_at)}
                        </p>
                      </div>
                      <p className="text-sm leading-6">{thread.body}</p>
                      <ThreadImage media={thread.thread_media[0]} />
                      <div className="mt-3 flex items-center gap-4 border-t border-[#e5ded4] pt-3">
                        <form action={toggleThreadLike}>
                          <input
                            name="thread_id"
                            type="hidden"
                            value={thread.id}
                          />
                          <input
                            name="liked"
                            type="hidden"
                            value={
                              thread.thread_likes.some(
                                (like) => like.user_id === claims?.sub,
                              )
                                ? "true"
                                : "false"
                            }
                          />
                          <button className="flex items-center gap-2 text-sm font-medium">
                            <Heart
                              className={`size-5 ${
                                thread.thread_likes.some(
                                  (like) => like.user_id === claims?.sub,
                                )
                                  ? "fill-[#c8953b] text-[#c8953b]"
                                  : ""
                              }`}
                            />
                            {thread.thread_likes.length}
                          </button>
                        </form>
                        <button className="flex items-center gap-2 text-sm font-medium">
                          <MessageCircle className="size-5" />
                          {thread.thread_comments.length}
                        </button>
                      </div>
                      {thread.thread_comments.length ? (
                        <div className="mt-3 space-y-2">
                          {thread.thread_comments.slice(0, 2).map((comment) => (
                            <p
                              className="rounded-md bg-[#f7f4ef] px-3 py-2 text-sm leading-5"
                              key={comment.id}
                            >
                              <span className="font-semibold">
                                {comment.profiles?.display_name ?? "Member"}
                              </span>{" "}
                              {comment.body}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {canCreate ? (
                        <form
                          action={createThreadComment}
                          className="mt-3 flex items-center gap-2"
                        >
                          <input
                            name="thread_id"
                            type="hidden"
                            value={thread.id}
                          />
                          <input
                            className="h-10 min-w-0 flex-1 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                            maxLength={2000}
                            name="body"
                            placeholder="Reply to thread"
                            required
                          />
                          <button
                            aria-label="Post thread reply"
                            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white"
                          >
                            <Send className="size-4" />
                          </button>
                        </form>
                      ) : null}
                    </article>
                  ))
                : sampleThreads.map((thread) => (
                    <div
                      className="rounded-md border border-[#d8d1c6] bg-white p-4 text-sm leading-6"
                      key={thread}
                    >
                      {thread}
                    </div>
                  ))}
            </div>
          </section>

          <section
            className="min-w-full snap-start border-l border-[#e5ded4] px-4 py-5"
            id="marketplace"
          >
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag className="size-5" />
              <h2 className="text-lg font-bold">Marketplace</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {listings?.length
                ? listings.map((listing) => (
                    <article
                      className="rounded-md border border-[#d8d1c6] bg-white p-4"
                      key={listing.id}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <ListingThumb media={listing.marketplace_media[0]} />
                        <div>
                          <p className="text-sm font-semibold">
                            {listing.title}
                          </p>
                          <p className="text-xs capitalize text-[#766d62]">
                            {listing.category}
                          </p>
                        </div>
                      </div>
                      <p className="mb-2 text-lg font-bold">
                        {formatPrice(listing)}
                      </p>
                      <p className="line-clamp-3 text-sm leading-6 text-[#4f473f]">
                        {listing.description || "No description yet."}
                      </p>
                      <p className="mt-3 text-xs text-[#766d62]">
                        {[listing.city, listing.region].filter(Boolean).join(", ") ||
                          listing.profiles?.display_name ||
                          "TheTattooCore"}
                      </p>
                      <div className="mt-4">
                        {isSignedIn &&
                        listing.profiles?.username &&
                        listing.profiles.id !== claims?.sub ? (
                          <form action={startConversation}>
                            <input
                              name="username"
                              type="hidden"
                              value={listing.profiles.username}
                            />
                            <input
                              name="body"
                              type="hidden"
                              value={listingMessage(listing)}
                            />
                            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                              <Send className="size-4" />
                              Message seller
                            </button>
                          </form>
                        ) : isSignedIn ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                            href="/messages"
                          >
                            Open messages
                          </Link>
                        ) : (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                            href="/login"
                          >
                            Sign in to message
                          </Link>
                        )}
                      </div>
                    </article>
                  ))
                : sampleListings.map((listing) => (
                    <div
                      className="rounded-md border border-[#d8d1c6] bg-white p-4"
                      key={listing.title}
                    >
                      <div className="mb-2 flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-md bg-[#efe7da]">
                          <ImageIcon className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{listing.title}</p>
                          <p className="text-xs text-[#766d62]">{listing.tag}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold">{listing.price}</p>
                    </div>
                  ))}
            </div>
          </section>

          <section
            className="min-w-full snap-start border-l border-[#e5ded4] px-4 py-5"
            id="messages"
          >
            <div className="mb-4 flex items-center gap-2">
              <Send className="size-5" />
              <h2 className="text-lg font-bold">Messages</h2>
            </div>
            <div className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm leading-6 text-[#4f473f]">
              Direct messages are live. Start conversations, view your inbox,
              and reply from the dedicated messenger.
              <Link
                className="mt-3 flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                href="/messages"
              >
                <Send className="size-4" />
                Open messages
              </Link>
            </div>
          </section>
          </div>
        </section>

        <aside className="hidden bg-[#f5f2eb] px-5 py-6 lg:block">
          <div className="mb-6">
            <div className="flex items-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-3 py-2">
              <Search className="size-4 text-[#766d62]" />
              <span className="text-sm text-[#766d62]">
                Search artists, styles, shops
              </span>
            </div>
          </div>

          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4" />
              <h2 className="text-sm font-semibold">Live Threads</h2>
            </div>
            <div className="space-y-3">
              {(threadPosts?.length ? threadPosts.slice(0, 4) : null)?.map(
                (thread) => (
                  <a
                    className="block rounded-md border border-[#d8d1c6] bg-white p-3 text-sm leading-5"
                    href="#threads"
                    key={thread.id}
                  >
                    {thread.body}
                  </a>
                ),
              ) ??
                sampleThreads.map((thread) => (
                  <a
                    className="block rounded-md border border-[#d8d1c6] bg-white p-3 text-sm leading-5"
                    href="#threads"
                    key={thread}
                  >
                    {thread}
                  </a>
                ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <ShoppingBag className="size-4" />
              <h2 className="text-sm font-semibold">Marketplace</h2>
            </div>
            <div className="space-y-3">
              {(listings?.length ? listings.slice(0, 4) : null)?.map(
                (listing) => (
                  <a
                    className="block rounded-md border border-[#d8d1c6] bg-white p-3"
                    href="#marketplace"
                    key={listing.id}
                  >
                      <div className="mb-2 flex items-center gap-3">
                      <ListingThumb media={listing.marketplace_media[0]} />
                      <div>
                        <p className="text-sm font-semibold">{listing.title}</p>
                        <p className="text-xs capitalize text-[#766d62]">
                          {listing.category}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{formatPrice(listing)}</p>
                  </a>
                ),
              ) ??
                sampleListings.map((listing) => (
                  <a
                    className="block rounded-md border border-[#d8d1c6] bg-white p-3"
                    href="#marketplace"
                    key={listing.title}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-md bg-[#efe7da]">
                        <ImageIcon className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{listing.title}</p>
                        <p className="text-xs text-[#766d62]">{listing.tag}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{listing.price}</p>
                  </a>
                ))}
            </div>
          </section>
        </aside>
      </div>
      <FloatingComposer canCreate={canCreate} isSignedIn={isSignedIn} />
    </main>
  );
}
