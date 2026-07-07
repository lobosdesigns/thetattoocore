import {
  Bell,
  Heart,
  Home as HomeIcon,
  ImageIcon,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";

const posts = [
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

const threads = [
  "What aftercare routine do you recommend for heavy blackwork in summer?",
  "Guest spot opening in Dallas first week of August. Realism artists preferred.",
  "Shop owners: deposits through marketplace or direct invoice?",
];

const listings = [
  { title: "Dragon flash sheet", price: "$80", tag: "digital" },
  { title: "Guest chair: Phoenix", price: "$300/day", tag: "studio" },
  { title: "Aftercare balm batch", price: "$14", tag: "supplies" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#171412]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[240px_minmax(420px,620px)_320px]">
        <aside className="hidden border-r border-[#d8d1c6] px-5 py-6 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#171412] text-white">
              TC
            </div>
            <div>
              <p className="text-lg font-semibold">TheTattooCore</p>
              <p className="text-xs text-[#766d62]">artist network</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              [HomeIcon, "Feed"],
              [MessageCircle, "Threads"],
              [ShoppingBag, "Marketplace"],
              [Send, "Messages"],
              [UserRound, "Profile"],
            ].map(([Icon, label]) => (
              <button
                className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium hover:bg-white"
                key={label as string}
              >
                <Icon className="size-5" />
                {label as string}
              </button>
            ))}
          </nav>

          <button className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
            <Plus className="size-4" />
            Create
          </button>
        </aside>

        <section className="border-x border-[#d8d1c6] bg-[#fffdf9]">
          <header className="sticky top-0 z-10 border-b border-[#e5ded4] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">TheTattooCore</h1>
                <p className="text-xs text-[#766d62]">feed, threads, market</p>
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
              </div>
            </div>
          </header>

          <div className="flex gap-2 overflow-x-auto border-b border-[#e5ded4] px-4 py-3">
            {["Feed", "Threads", "Marketplace", "Messages"].map((tab) => (
              <button
                className="h-9 shrink-0 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-medium first:bg-[#171412] first:text-white"
                key={tab}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="divide-y divide-[#e5ded4]">
            {posts.map((post) => (
              <article className="bg-[#fffdf9]" key={post.handle}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-lg bg-[#d9a441]" />
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
            ))}
          </div>
        </section>

        <aside className="hidden px-5 py-6 lg:block">
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
              {threads.map((thread) => (
                <button
                  className="w-full rounded-md border border-[#d8d1c6] bg-white p-3 text-left text-sm leading-5"
                  key={thread}
                >
                  {thread}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <ShoppingBag className="size-4" />
              <h2 className="text-sm font-semibold">Marketplace</h2>
            </div>
            <div className="space-y-3">
              {listings.map((listing) => (
                <div
                  className="rounded-md border border-[#d8d1c6] bg-white p-3"
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
        </aside>
      </div>
    </main>
  );
}
