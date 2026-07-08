import Link from "next/link";
import {
  Bell,
  Camera,
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
  createFeedPost,
  createMarketplaceListing,
  createThreadPost,
} from "./actions";
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
  style_tags: string[];
  location_label: string | null;
  created_at: string;
  profiles: Profile | null;
};

type ThreadPost = {
  id: string;
  body: string;
  created_at: string;
  profiles: Profile | null;
};

type MarketplaceListing = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  category: string;
  city: string | null;
  region: string | null;
  created_at: string;
  profiles: Profile | null;
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
        "id, caption, style_tags, location_label, created_at, profiles(id, username, display_name, account_type, city, region)",
      )
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<FeedPost[]>(),
    supabase
      .from("thread_posts")
      .select(
        "id, body, created_at, profiles(id, username, display_name, account_type, city, region)",
      )
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<ThreadPost[]>(),
    supabase
      .from("marketplace_listings")
      .select(
        "id, title, description, price_cents, currency, category, city, region, created_at, profiles(id, username, display_name, account_type, city, region)",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<MarketplaceListing[]>(),
  ]);

  const isSignedIn = Boolean(claims?.sub);
  const canCreate = Boolean(currentProfile);
  const adminRole = currentProfile?.role;

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#171412]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[240px_minmax(420px,620px)_320px]">
        <aside className="hidden border-r border-[#d8d1c6] bg-[#fffdf9] px-5 py-6 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[#171412] text-sm font-bold text-white">
              TC
            </div>
            <div>
              <p className="text-lg font-semibold">TheTattooCore</p>
              <p className="text-xs text-[#766d62]">artist network</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              [HomeIcon, "Feed", "#feed"],
              [MessageCircle, "Threads", "#threads"],
              [ShoppingBag, "Marketplace", "#marketplace"],
              [Send, "Messages", "#messages"],
              [UserRound, "Profile", "/account"],
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
              <div>
                <h1 className="text-xl font-bold">TheTattooCore</h1>
                <p className="text-xs text-[#766d62]">
                  feed, threads, market, messages
                </p>
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
              ["Messages", "#messages"],
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

          <section className="border-b border-[#e5ded4] px-4 py-4" id="create">
            {canCreate ? (
              <div className="grid gap-3 md:grid-cols-3">
                <form
                  action={createFeedPost}
                  className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-3"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Camera className="size-4" />
                    Feed post
                  </div>
                  <textarea
                    className="mb-2 min-h-24 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
                    maxLength={2200}
                    name="caption"
                    placeholder="Share fresh work, booking notes, or a healed update."
                    required
                  />
                  <input
                    className="mb-2 h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="style_tags"
                    placeholder="blackwork, fine line"
                  />
                  <input
                    className="mb-3 h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="location_label"
                    placeholder="Austin, TX"
                  />
                  <button className="h-10 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                    Publish
                  </button>
                </form>

                <form
                  action={createThreadPost}
                  className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-3"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <MessageCircle className="size-4" />
                    Thread
                  </div>
                  <textarea
                    className="mb-3 min-h-36 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
                    maxLength={1000}
                    name="body"
                    placeholder="Ask artists, talk shop, post guest spots, share advice."
                    required
                  />
                  <button className="h-10 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                    Post thread
                  </button>
                </form>

                <form
                  action={createMarketplaceListing}
                  className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-3"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <ShoppingBag className="size-4" />
                    Listing
                  </div>
                  <input
                    className="mb-2 h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    maxLength={120}
                    name="title"
                    placeholder="Flash sheet, chair rental, supplies"
                    required
                  />
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <input
                      className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                      name="price"
                      placeholder="80"
                    />
                    <select
                      className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                      name="category"
                    >
                      <option value="flash">Flash</option>
                      <option value="guest-spot">Guest spot</option>
                      <option value="chair">Chair</option>
                      <option value="supplies">Supplies</option>
                      <option value="service">Service</option>
                    </select>
                  </div>
                  <textarea
                    className="mb-2 min-h-20 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
                    maxLength={2000}
                    name="description"
                    placeholder="Details, terms, dates, or pickup/shipping notes."
                  />
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <input
                      className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                      name="city"
                      placeholder="City"
                    />
                    <input
                      className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                      name="region"
                      placeholder="State"
                    />
                  </div>
                  <button className="h-10 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                    Publish listing
                  </button>
                </form>
              </div>
            ) : (
              <div className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4">
                <p className="text-sm font-semibold">
                  {isSignedIn
                    ? "Finish your profile to start posting."
                    : "Sign in to post, reply, list, and message."}
                </p>
                <div className="mt-3 flex gap-3">
                  <Link
                    className="flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                    href={isSignedIn ? "/account" : "/login"}
                  >
                    {isSignedIn ? "Set up profile" : "Sign in"}
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section className="divide-y divide-[#e5ded4]" id="feed">
            {feedPosts?.length ? (
              feedPosts.map((post) => (
                <article className="bg-[#fffdf9]" key={post.id}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-md bg-[#c8953b] text-sm font-bold text-white">
                        {initials(post.profiles?.display_name ?? "TC")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {post.profiles?.display_name ?? "TheTattooCore member"}
                        </p>
                        <p className="text-xs text-[#766d62]">
                          @{post.profiles?.username ?? "member"} ·{" "}
                          {post.location_label ||
                            profileLocation(post.profiles) ||
                            "TattooCore"}{" "}
                          · {timeAgo(post.created_at)}
                        </p>
                      </div>
                    </div>
                    {post.style_tags[0] ? (
                      <span className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-medium">
                        {post.style_tags[0]}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex aspect-[4/3] items-center justify-center bg-[#171412] text-white">
                    <div className="text-center">
                      <ImageIcon className="mx-auto mb-2 size-10 opacity-80" />
                      <p className="text-sm font-semibold">Media upload next</p>
                    </div>
                  </div>

                  <div className="space-y-3 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 text-sm font-medium">
                          <Heart className="size-5" />0
                        </button>
                        <button className="flex items-center gap-2 text-sm font-medium">
                          <MessageCircle className="size-5" />0
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

          <section className="border-t border-[#e5ded4] px-4 py-5" id="threads">
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
                        <p className="text-sm font-semibold">
                          {thread.profiles?.display_name ?? "Member"}
                        </p>
                        <p className="text-xs text-[#766d62]">
                          {timeAgo(thread.created_at)}
                        </p>
                      </div>
                      <p className="text-sm leading-6">{thread.body}</p>
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
            className="border-t border-[#e5ded4] px-4 py-5"
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
                        <div className="flex size-11 items-center justify-center rounded-md bg-[#efe7da]">
                          <ImageIcon className="size-5" />
                        </div>
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

          <section className="border-t border-[#e5ded4] px-4 py-5" id="messages">
            <div className="mb-4 flex items-center gap-2">
              <Send className="size-5" />
              <h2 className="text-lg font-bold">Messages</h2>
            </div>
            <div className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm leading-6 text-[#4f473f]">
              Messenger database tables are ready. The next pass will add direct
              conversation creation, inbox list, and realtime message delivery.
            </div>
          </section>
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
                      <div className="flex size-10 items-center justify-center rounded-md bg-[#efe7da]">
                        <ImageIcon className="size-5" />
                      </div>
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
    </main>
  );
}
