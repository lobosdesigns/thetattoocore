import Link from "next/link";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Flag,
  Heart,
  Home as HomeIcon,
  ImageIcon,
  LogIn,
  LoaderCircle,
  MessageCircle,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import {
  acceptAdultTerms,
  archiveGig,
  createContentReport,
  createPostComment,
  createThreadComment,
  togglePostLike,
  toggleThreadLike,
} from "./actions";
import { ColumnTabs } from "./column-tabs";
import { startConversation } from "./messages/actions";
import { FloatingComposer } from "./floating-composer";
import { LogoLockup, LogoWordmark } from "./logo-mark";
import { NotificationBellLink } from "./notification-bell-link";
import { PendingSubmitButton } from "./pending-submit-button";
import { SavedItemButton } from "./saved-item-button";
import { CompactShareButton } from "./share-actions";
import { WordLimitedField } from "./word-limited-field";
import { siteName, siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
  email?: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string;
  adult_terms_accepted_at?: string | null;
  account_type: string;
  city: string | null;
  is_adult_confirmed?: boolean | null;
  license_verified_at?: string | null;
  region: string | null;
  role?: string | null;
};

type FeedPost = {
  id: string;
  caption: string | null;
  feed_media: PostMedia[];
  is_sensitive: boolean;
  visibility: "public_preview" | "members" | "private";
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
  is_sensitive: boolean;
  thread_comments: ThreadComment[];
  thread_likes: ThreadLike[];
  thread_media: ThreadMedia[];
  visibility: "public_preview" | "members" | "private";
  profiles: Profile | null;
};

type MarketplaceListing = {
  id: string;
  title: string;
  description: string | null;
  is_sensitive: boolean;
  marketplace_media: ListingMedia[];
  price_cents: number | null;
  currency: string;
  category: string;
  city: string | null;
  region: string | null;
  created_at: string;
  visibility: "public_preview" | "members" | "private";
  profiles: Profile | null;
};

type Gig = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  city: string | null;
  region: string | null;
  country: string | null;
  starts_at: string | null;
  ends_at: string | null;
  compensation: string | null;
  contact_url: string | null;
  created_at: string;
  gig_media: GigMedia[];
  is_sensitive: boolean;
  visibility: "public_preview" | "members" | "private";
  profiles: Profile | null;
};

type SavedItem = {
  subject_id: string;
  subject_type: "feed_post" | "gig" | "marketplace_listing" | "thread_post";
};

type PostMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type ListingMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type GigMedia = {
  id: string;
  media_type: "image" | "video";
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

function EmptyColumnState({
  actionHref,
  actionLabel,
  body,
  icon: Icon,
  tips,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  body: string;
  icon: typeof ImageIcon;
  tips?: string[];
  title: string;
}) {
  return (
    <div className="ttc-card rounded-md border border-dashed border-[#cfc6ba] bg-[#fffdf9] p-6">
      <div className="flex size-11 items-center justify-center rounded-md bg-[#171412] text-[#c8953b]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#4f473f]">{body}</p>
      {tips?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tips.map((tip) => (
            <span
              className="rounded-md border border-[#cfc8bd] bg-[#f7f4ef] px-2 py-1 text-xs font-semibold text-[#4f473f]"
              key={tip}
            >
              {tip}
            </span>
          ))}
        </div>
      ) : null}
      {actionLabel ? (
        actionHref ? (
          <Link
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : (
          <p className="mt-5 text-sm font-semibold text-[#171412]">
            {actionLabel}
          </p>
        )
      ) : null}
    </div>
  );
}

function SidebarEmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#cfc6ba] bg-[#fffdf9] p-3 text-sm leading-5 text-[#766d62] shadow-sm">
      {children}
    </div>
  );
}

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

function isVerifiedProfile(profile?: Profile | null) {
  return Boolean(
    profile?.license_verified_at &&
      (profile.account_type === "artist" || profile.account_type === "studio"),
  );
}

function VerifiedBadge({ profile }: { profile?: Profile | null }) {
  if (!isVerifiedProfile(profile)) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[#171412] px-1.5 py-0.5 text-[11px] font-semibold text-white"
      title={`${profile?.account_type ?? "Profile"} license verified`}
    >
      <BadgeCheck className="size-3" />
      Verified
    </span>
  );
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

function formatGigDate(gig: Gig) {
  if (!gig.starts_at) return "Flexible";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(gig.starts_at));
}

function formatGigCategory(category: string) {
  return category.replaceAll("_", " ");
}

function listingMessage(listing: MarketplaceListing) {
  return `Hi, I am interested in your marketplace listing: ${listing.title}`;
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

type VisibleContent = {
  is_sensitive: boolean;
  visibility: "public_preview" | "members" | "private";
};

function canRenderContent(
  item: VisibleContent,
  viewer: { isSignedIn: boolean; isAdultConfirmed: boolean },
) {
  if (item.visibility === "private") return false;
  if (item.visibility === "members" && !viewer.isSignedIn) return false;
  if (item.is_sensitive && !viewer.isAdultConfirmed) return false;

  return true;
}

function ReportForm({
  returnHash,
  subjectId,
  subjectType,
}: {
  returnHash: "feed" | "threads" | "marketplace" | "gigs";
  subjectId: string;
  subjectType: "feed_post" | "thread_post" | "marketplace_listing" | "gig";
}) {
  return (
    <form
      action={createContentReport}
      className="rounded-md border border-[#e5ded4] bg-[#f7f4ef] p-2"
    >
      <input name="subject_id" type="hidden" value={subjectId} />
      <input name="subject_type" type="hidden" value={subjectType} />
      <input name="return_path" type="hidden" value="/" />
      <input name="return_hash" type="hidden" value={returnHash} />
      <p className="mb-2 text-xs leading-5 text-[#766d62]">
        Report content that looks unsafe, scammy, sexual, illegal, harassing,
        or missing the right sensitive body-art context.
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(10rem,14rem)_1fr_auto]">
        <select
          aria-label="Report reason"
          className="h-9 min-w-0 rounded-md border border-[#d8d1c6] bg-white px-2 text-xs outline-none focus:border-[#171412]"
          name="reason"
        >
          <option value="body-art nudity context">Sensitive body-art context</option>
          <option value="sexual content">Sexual or pornographic content</option>
          <option value="minor safety concern">Minor safety concern</option>
          <option value="harassment or hate">Harassment, hate, or threats</option>
          <option value="scam or spam">Scam, spam, or impersonation</option>
          <option value="unsafe practice">Unsafe tattoo/body-art practice</option>
          <option value="illegal goods or services">Illegal goods or services</option>
          <option value="other">Other policy concern</option>
        </select>
        <input
          className="h-9 min-w-0 rounded-md border border-[#d8d1c6] bg-white px-2 text-xs outline-none focus:border-[#171412]"
          maxLength={500}
          name="details"
          placeholder="What should moderators know?"
        />
        <button className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#d8d1c6] bg-white px-2 text-xs font-semibold">
          <Flag className="size-3.5" />
          Report
        </button>
      </div>
    </form>
  );
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

  if (media.media_type === "video") {
    return (
      <div className="flex size-11 items-center justify-center rounded-md bg-[#171412] text-white">
        <Video className="size-5" />
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

function AdultTermsGate({ returnHash = "feed" }: { returnHash?: string }) {
  return (
    <section className="border-b border-[#d8d1c6] bg-[#171412] px-4 py-4 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">18+ body-art content</p>
          <p className="mt-1 text-sm leading-5 text-white/75">
            Sensitive tattoo, piercing, healing, or placement posts require
            login and 18+ Terms acceptance.
          </p>
        </div>
        <form action={acceptAdultTerms} className="flex shrink-0 gap-2">
          <input name="return_path" type="hidden" value="/" />
          <input name="return_hash" type="hidden" value={returnHash} />
          <Link
            className="flex h-10 items-center rounded-md border border-white/25 px-3 text-sm font-semibold"
            href="/terms"
          >
            Terms
          </Link>
          <button className="h-10 rounded-md bg-white px-4 text-sm font-semibold text-[#171412]">
            I am 18+
          </button>
        </form>
      </div>
    </section>
  );
}

function MobileShortcutNav({
  isSignedIn,
  profileHref,
  unreadDmBadge,
}: {
  isSignedIn: boolean;
  profileHref: string;
  unreadDmBadge: number;
}) {
  const memberHref = (href: string) => (isSignedIn ? href : "/login");
  const items = [
    [Search, "Search", "/search", null],
    [Bookmark, "Saved", memberHref("/saved"), null],
    [Bell, "Alerts", memberHref("/notifications"), null],
    [Send, "DM", memberHref("/messages"), unreadDmBadge],
    [UserRound, "Me", memberHref(profileHref), null],
  ] as const;

  return (
    <nav
      aria-label="Mobile shortcuts"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#3a332d] bg-[#171412]/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_28px_rgba(0,0,0,0.24)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map(([Icon, label, href, badge]) => (
          <Link
            className="relative flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-semibold text-[#f2f1ee] hover:bg-white/10"
            href={href}
            key={label}
          >
            <Icon className="size-5" />
            <span className="truncate">{label}</span>
            {badge ? (
              <span className="absolute right-2 top-1 flex min-w-5 items-center justify-center rounded-full bg-[#c8953b] px-1.5 text-[10px] font-bold text-[#171412]">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function PublicVisitorGate({ lockedCount }: { lockedCount: number }) {
  return (
    <section className="border-b border-[#cfc8bd] bg-[#fffdf9] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">Public preview</p>
          <p className="mt-1 text-sm leading-5 text-[#4f473f]">
            Sign in to post, reply, DM, follow creators, and view member-only
            or 18+ body-art content.
          </p>
          {lockedCount ? (
            <p className="mt-2 text-xs font-semibold text-[#766d62]">
              {lockedCount} member or 18+ item{lockedCount === 1 ? "" : "s"} hidden.
            </p>
          ) : null}
        </div>
        <Link
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
          href="/login"
        >
          <LogIn className="size-4" />
          Sign in
        </Link>
      </div>
    </section>
  );
}

function ProfileSetupGate() {
  return (
    <section className="border-b border-[#cfc8bd] bg-[#e8e4dc] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">Finish your profile</p>
          <p className="mt-1 text-sm leading-5 text-[#4f473f]">
            Choose a username and account type before posting, replying,
            listing Stuff, adding Gigs, or sending DMs.
          </p>
        </div>
        <Link
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
          href="/account"
        >
          <UserRound className="size-4" />
          Set up profile
        </Link>
      </div>
    </section>
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
    { data: gigs },
    { count: unreadDmCount },
    { data: savedItems },
  ] = await Promise.all([
    claims?.sub
      ? supabase
          .from("profiles")
          .select(
            "id, username, display_name, account_type, city, adult_terms_accepted_at, is_adult_confirmed, license_verified_at, region, role",
          )
          .eq("id", claims.sub)
          .maybeSingle<Profile>()
      : Promise.resolve({ data: null }),
    supabase
      .from("feed_posts")
      .select(
        "id, caption, style_tags, location_label, visibility, is_sensitive, created_at, feed_media(id, storage_bucket, storage_path, media_type, sort_order), post_likes(user_id), post_comments(id, body, created_at, profiles:profiles!post_comments_author_id_fkey(display_name, username)), profiles:profiles!feed_posts_author_id_fkey(id, username, display_name, account_type, city, license_verified_at, region)",
      )
      .eq("is_published", true)
      .eq("moderation_status", "active")
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
        "id, body, visibility, is_sensitive, created_at, thread_media(id, storage_bucket, storage_path, media_type, sort_order), thread_likes(user_id), thread_comments(id, body, created_at, profiles:profiles!thread_comments_author_id_fkey(display_name, username)), profiles:profiles!thread_posts_author_id_fkey(id, username, display_name, account_type, city, license_verified_at, region)",
      )
      .eq("moderation_status", "active")
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
        "id, title, description, price_cents, currency, category, city, region, visibility, is_sensitive, created_at, marketplace_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!marketplace_listings_seller_id_fkey(id, username, display_name, account_type, city, license_verified_at, region)",
      )
      .eq("status", "active")
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "marketplace_media",
      })
      .limit(20)
      .returns<MarketplaceListing[]>(),
    supabase
      .from("gigs")
      .select(
        "id, title, description, category, city, region, country, starts_at, ends_at, compensation, contact_url, visibility, is_sensitive, created_at, gig_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!gigs_poster_id_fkey(id, username, display_name, account_type, city, license_verified_at, region)",
      )
      .eq("status", "active")
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "gig_media",
      })
      .limit(20)
      .returns<Gig[]>(),
    claims?.sub
      ? supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("recipient_id", claims.sub)
          .eq("type", "message")
          .is("read_at", null)
      : Promise.resolve({ count: 0 }),
    claims?.sub
      ? supabase
          .from("saved_items")
          .select("subject_type, subject_id")
          .eq("user_id", claims.sub)
          .in("subject_type", [
            "feed_post",
            "thread_post",
            "marketplace_listing",
            "gig",
          ])
          .returns<SavedItem[]>()
      : Promise.resolve({ data: [] as SavedItem[] }),
  ]);

  const isSignedIn = Boolean(claims?.sub);
  const viewer = {
    isAdultConfirmed: Boolean(
      currentProfile?.is_adult_confirmed &&
        currentProfile.adult_terms_accepted_at,
    ),
    isSignedIn,
  };
  const visibleFeedPosts = (feedPosts ?? []).filter((post) =>
    canRenderContent(post, viewer),
  );
  const visibleThreadPosts = (threadPosts ?? []).filter((thread) =>
    canRenderContent(thread, viewer),
  );
  const visibleListings = (listings ?? []).filter((listing) =>
    canRenderContent(listing, viewer),
  );
  const visibleGigs = (gigs ?? []).filter((gig) => canRenderContent(gig, viewer));
  const lockedPublicItemCount = [
    ...(feedPosts ?? []),
    ...(threadPosts ?? []),
    ...(listings ?? []),
    ...(gigs ?? []),
  ].filter(
    (item) =>
      item.visibility !== "private" &&
      !canRenderContent(item, viewer),
  ).length;
  const canCreate = Boolean(currentProfile);
  const adminRole = currentProfile?.role;
  const profileHref = currentProfile ? `/u/${currentProfile.username}` : "/account";
  const unreadDmBadge = unreadDmCount ?? 0;
  const savedItemKeys = new Set(
    (savedItems ?? []).map((item) => `${item.subject_type}:${item.subject_id}`),
  );

  return (
    <main className="min-h-screen bg-[#202020] text-[#171412]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[240px_minmax(420px,620px)_320px] lg:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <aside className="hidden border-r border-[#cfc8bd] bg-[#f2f1ee] px-5 py-6 lg:block">
          <div className="flex min-h-full flex-col">
            <div>
              <div className="mb-8 flex justify-start">
                <LogoWordmark className="h-32 w-28" />
              </div>

              <nav className="space-y-1">
                {[
                  [HomeIcon, "4U", "#feed"],
                  [MessageCircle, "Gossip", "#threads"],
                  [ShoppingBag, "Stuff", "#marketplace"],
                  [BriefcaseBusiness, "Gigs", "#gigs"],
                  [Send, "DM", "/messages"],
                  [Bookmark, "Saved", "/saved"],
                  [UserRound, "Profile", profileHref],
                ].map(([Icon, label, href]) => (
                  <Link
                    className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium hover:bg-[#fffdf9]"
                    href={href as string}
                    key={label as string}
                  >
                    <Icon className="size-5" />
                    <span className="min-w-0 flex-1">{label as string}</span>
                    {label === "DM" && unreadDmBadge ? (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-[#171412] px-1.5 text-[10px] font-bold text-white">
                        {unreadDmBadge > 9 ? "9+" : unreadDmBadge}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </nav>

              {adminRole && ["moderator", "admin", "owner"].includes(adminRole) ? (
                <Link
                  className="mt-4 flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
                  href="/admin"
                >
                  Admin
                </Link>
              ) : null}
            </div>

            <div className="mt-auto flex gap-3 pt-8 text-xs font-semibold text-[#766d62]">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </aside>

        <section className="border-x border-[#cfc8bd] bg-[#f2f1ee] pb-24 lg:pb-0">
          <header className="sticky top-0 z-10 border-b border-[#d8d1c6] bg-[#f2f1ee]/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center">
                <LogoLockup className="h-14 w-52 max-w-[52vw] shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <Link
                  aria-label="Search"
                  className="flex size-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
                  href="/search"
                >
                  <Search className="size-5" />
                </Link>
                <NotificationBellLink userId={claims?.sub} />
                <AuthCallout isSignedIn={isSignedIn} />
              </div>
            </div>
          </header>

          <ColumnTabs unreadDmCount={unreadDmBadge} />

          {params.message ? (
            <p
              className="sticky top-0 z-20 border-b border-[#d8d1c6] bg-[#efe7da] px-4 py-3 text-sm font-semibold shadow-sm"
              role="status"
            >
              {params.message}
            </p>
          ) : null}

          {!isSignedIn ? (
            <PublicVisitorGate lockedCount={lockedPublicItemCount} />
          ) : null}

          {isSignedIn && !currentProfile ? <ProfileSetupGate /> : null}

          {currentProfile && !viewer.isAdultConfirmed ? <AdultTermsGate /> : null}

          <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
          <section
            className="min-w-full snap-start divide-y divide-[#e5ded4]"
            id="feed"
          >
            {visibleFeedPosts.length ? (
              visibleFeedPosts.map((post) => (
                <article
                  className="scroll-mt-28 bg-[#fffdf9] shadow-[0_1px_0_rgba(23,20,18,0.06)]"
                  id={`feed-${post.id}`}
                  key={post.id}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <Link
                      className="flex min-w-0 items-center gap-3"
                      href={`/u/${post.profiles?.username ?? "member"}`}
                    >
                      <div className="flex size-11 items-center justify-center rounded-md bg-[#c8953b] text-sm font-bold text-white">
                        {initials(post.profiles?.display_name ?? "TC")}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">
                            {post.profiles?.display_name ??
                              "TheTattooCore member"}
                          </p>
                          <VerifiedBadge profile={post.profiles} />
                        </div>
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
                    ) : (
                      <ContentLabels
                        isSensitive={post.is_sensitive}
                        visibility={post.visibility}
                      />
                    )}
                  </div>

                  <MediaFrame media={post.feed_media[0]} />

                  <div className="space-y-3 px-4 py-4">
                    {post.style_tags[0] ? (
                      <ContentLabels
                        isSensitive={post.is_sensitive}
                        visibility={post.visibility}
                      />
                    ) : null}
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
                        <a
                          className="flex items-center gap-2 text-sm font-medium"
                          href={`#comment-${post.id}`}
                        >
                          <MessageCircle className="size-5" />
                          {post.post_comments.length}
                        </a>
                        {isSignedIn ? (
                          <SavedItemButton
                            hash="feed"
                            isSaved={savedItemKeys.has(`feed_post:${post.id}`)}
                            returnPath="/"
                            subjectId={post.id}
                            subjectType="feed_post"
                          />
                        ) : null}
                      </div>
                      <CompactShareButton
                        text={`Check this 4U post on ${siteName}`}
                        title="TheTattooCore 4U post"
                        url={`${siteUrl}/#feed-${post.id}`}
                      />
                    </div>
                    {isSignedIn ? (
                      <ReportForm
                        returnHash="feed"
                        subjectId={post.id}
                        subjectType="feed_post"
                      />
                    ) : null}
                    <p className="text-sm leading-6">{post.caption}</p>
                    {post.post_comments.length ? (
                      <div className="space-y-2 border-t border-[#e5ded4] pt-3">
                        {post.post_comments.slice(0, 2).map((comment) => (
                          <p className="text-sm leading-5" key={comment.id}>
                            {comment.profiles?.username ? (
                              <Link
                                className="font-semibold hover:underline"
                                href={`/u/${comment.profiles.username}`}
                              >
                                {comment.profiles.display_name ?? "Member"}
                              </Link>
                            ) : (
                              <span className="font-semibold">Member</span>
                            )}{" "}
                            {comment.body}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {canCreate ? (
                      <form
                        action={createPostComment}
                        className="border-t border-[#e5ded4] pt-3"
                        id={`comment-${post.id}`}
                      >
                        <input name="post_id" type="hidden" value={post.id} />
                        <div className="flex items-start gap-2">
                          <WordLimitedField
                            className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                            maxLength={300}
                            maxWords={40}
                            minTrimmedLength={1}
                            name="body"
                            placeholder="Add a short comment"
                            required
                            validationMessage="Comment cannot be empty."
                          />
                          <PendingSubmitButton
                            aria-label="Post comment"
                            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white"
                            pendingChildren={
                              <LoaderCircle className="size-4 animate-spin" />
                            }
                          >
                            <Send className="size-4" />
                          </PendingSubmitButton>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="p-4">
                <EmptyColumnState
                  actionHref={
                    !isSignedIn ? "/login" : canCreate ? undefined : "/account"
                  }
                  actionLabel={
                    !isSignedIn
                      ? "Sign in to post"
                      : canCreate
                        ? "Tap + to post to 4U"
                        : "Set up profile to post"
                  }
                  body="Photos and one-minute reels from artists and collectors will show here. Keep captions tight and let the work lead."
                  icon={ImageIcon}
                  tips={["Fresh work", "Healed pieces", "1 min reels"]}
                  title="No 4U posts yet"
                />
              </div>
            )}
          </section>

          <section
            className="min-w-full snap-start border-l border-[#e5ded4] px-4 py-5"
            id="threads"
          >
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="size-5" />
              <h2 className="text-lg font-bold">Gossip</h2>
            </div>
            <div className="space-y-3">
              {visibleThreadPosts.length
                ? visibleThreadPosts.map((thread) => (
                    <article
                      className="ttc-card scroll-mt-28 rounded-md border border-[#cfc8bd] bg-white p-4"
                      id={`thread-${thread.id}`}
                      key={thread.id}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Link
                          className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                          href={`/u/${thread.profiles?.username ?? "member"}`}
                        >
                          <span>{thread.profiles?.display_name ?? "Member"}</span>
                          <VerifiedBadge profile={thread.profiles} />
                        </Link>
                        <div className="flex shrink-0 items-center gap-2">
                          <ContentLabels
                            isSensitive={thread.is_sensitive}
                            visibility={thread.visibility}
                          />
                          <p className="text-xs text-[#766d62]">
                            {timeAgo(thread.created_at)}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm leading-6">{thread.body}</p>
                      <ThreadImage media={thread.thread_media[0]} />
                      <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#e5ded4] pt-3">
                        <div className="flex items-center gap-4">
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
                          <a
                            className="flex items-center gap-2 text-sm font-medium"
                            href={`#thread-comment-${thread.id}`}
                          >
                            <MessageCircle className="size-5" />
                            {thread.thread_comments.length}
                          </a>
                          {isSignedIn ? (
                            <SavedItemButton
                              hash="threads"
                              isSaved={savedItemKeys.has(
                                `thread_post:${thread.id}`,
                              )}
                              returnPath="/"
                              subjectId={thread.id}
                              subjectType="thread_post"
                            />
                          ) : null}
                        </div>
                        <CompactShareButton
                          text={`Check this Gossip thread on ${siteName}`}
                          title="TheTattooCore Gossip thread"
                          url={`${siteUrl}/#thread-${thread.id}`}
                        />
                      </div>
                      {isSignedIn ? (
                        <div className="mt-3">
                          <ReportForm
                            returnHash="threads"
                            subjectId={thread.id}
                            subjectType="thread_post"
                          />
                        </div>
                      ) : null}
                      {thread.thread_comments.length ? (
                        <div className="mt-3 space-y-2">
                          {thread.thread_comments.slice(0, 2).map((comment) => (
                            <p
                              className="rounded-md bg-[#f7f4ef] px-3 py-2 text-sm leading-5"
                              key={comment.id}
                            >
                              {comment.profiles?.username ? (
                                <Link
                                  className="font-semibold hover:underline"
                                  href={`/u/${comment.profiles.username}`}
                                >
                                  {comment.profiles.display_name ?? "Member"}
                                </Link>
                              ) : (
                                <span className="font-semibold">Member</span>
                              )}{" "}
                              {comment.body}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {canCreate ? (
                        <form
                          action={createThreadComment}
                          className="mt-3"
                          id={`thread-comment-${thread.id}`}
                        >
                          <input
                            name="thread_id"
                            type="hidden"
                            value={thread.id}
                          />
                          <div className="flex items-start gap-2">
                            <WordLimitedField
                              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                              maxCharacters={2000}
                              maxLength={2000}
                              minTrimmedLength={1}
                              name="body"
                              placeholder="Reply to thread"
                              required
                              validationMessage="Thread reply cannot be empty."
                            />
                            <PendingSubmitButton
                              aria-label="Post thread reply"
                              className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white"
                              pendingChildren={
                                <LoaderCircle className="size-4 animate-spin" />
                              }
                            >
                              <Send className="size-4" />
                            </PendingSubmitButton>
                          </div>
                        </form>
                      ) : null}
                    </article>
                  ))
                : (
                    <EmptyColumnState
                      actionHref={
                        !isSignedIn ? "/login" : canCreate ? undefined : "/account"
                      }
                      actionLabel={
                        !isSignedIn
                          ? "Sign in to start gossip"
                          : canCreate
                            ? "Tap + to start Gossip"
                            : "Set up profile to post"
                      }
                      body="Longer shop talk, questions, guest spots, images, and community threads will collect here."
                      icon={MessageCircle}
                      tips={["Ask advice", "Talk shop", "Start a thread"]}
                      title="No Gossip yet"
                    />
                  )}
            </div>
          </section>

          <section
            className="min-w-full snap-start border-l border-[#e5ded4] px-4 py-5"
            id="marketplace"
          >
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag className="size-5" />
              <h2 className="text-lg font-bold">Stuff</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleListings.length
                ? visibleListings.map((listing) => (
                    <article
                      className="ttc-card scroll-mt-28 rounded-md border border-[#cfc8bd] bg-white p-4"
                      id={`stuff-${listing.id}`}
                      key={listing.id}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <ListingThumb media={listing.marketplace_media[0]} />
                        <div>
                          <p className="text-sm font-semibold">
                            <Link
                              className="hover:underline"
                              href={`/stuff/${listing.id}`}
                            >
                              {listing.title}
                            </Link>
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <p className="text-xs capitalize text-[#766d62]">
                              {listing.category}
                            </p>
                            <ContentLabels
                              isSensitive={listing.is_sensitive}
                              visibility={listing.visibility}
                            />
                          </div>
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
                      <div className="mt-2">
                        <VerifiedBadge profile={listing.profiles} />
                      </div>
                      {isSignedIn ? (
                        <div className="mt-3">
                          <ReportForm
                            returnHash="marketplace"
                            subjectId={listing.id}
                            subjectType="marketplace_listing"
                          />
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-2">
                        {isSignedIn ? (
                          <SavedItemButton
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                            hash="marketplace"
                            isSaved={savedItemKeys.has(
                              `marketplace_listing:${listing.id}`,
                            )}
                            returnPath="/"
                            subjectId={listing.id}
                            subjectType="marketplace_listing"
                          />
                        ) : null}
                        <CompactShareButton
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                          text={`Check this Stuff listing on ${siteName}: ${listing.title}`}
                          title={listing.title}
                          url={`${siteUrl}/stuff/${listing.id}`}
                        />
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
                            <input
                              name="source_id"
                              type="hidden"
                              value={listing.id}
                            />
                            <input
                              name="source_title"
                              type="hidden"
                              value={listing.title}
                            />
                            <input
                              name="source_type"
                              type="hidden"
                              value="marketplace_listing"
                            />
                            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                              <Send className="size-4" />
                              DM seller
                            </button>
                          </form>
                        ) : isSignedIn ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                            href="/messages"
                          >
                            Open DM
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
                : (
                    <div className="sm:col-span-2">
                      <EmptyColumnState
                        actionHref={
                          !isSignedIn ? "/login" : canCreate ? undefined : "/account"
                        }
                        actionLabel={
                          !isSignedIn
                            ? "Sign in to list stuff"
                            : canCreate
                              ? "Tap + to list Stuff"
                              : "Set up profile to list"
                        }
                        body="Flash, supplies, chair rentals, studio services, machines, furniture, and useful local finds will appear here."
                        icon={ShoppingBag}
                        tips={["Flash", "Supplies", "Studio gear"]}
                        title="No Stuff listings yet"
                      />
                    </div>
                  )}
            </div>
          </section>

          <section
            className="min-w-full snap-start border-l border-[#e5ded4] px-4 py-5"
            id="gigs"
          >
            <div className="mb-4 flex items-center gap-2">
              <BriefcaseBusiness className="size-5" />
              <h2 className="text-lg font-bold">Gigs</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleGigs.length
                ? visibleGigs.map((gig) => (
                    <article
                      className="ttc-card scroll-mt-28 rounded-md border border-[#cfc8bd] bg-white p-4"
                      id={`gig-${gig.id}`}
                      key={gig.id}
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <ListingThumb media={gig.gig_media[0]} />
                        <div className="min-w-0">
                          <Link
                            className="text-sm font-semibold hover:underline"
                            href={`/gigs/${gig.id}`}
                          >
                            {gig.title}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <p className="text-xs capitalize text-[#766d62]">
                              {formatGigCategory(gig.category)}
                            </p>
                            <ContentLabels
                              isSensitive={gig.is_sensitive}
                              visibility={gig.visibility}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mb-3 flex flex-wrap gap-2 text-xs text-[#766d62]">
                        <span className="flex items-center gap-1 rounded-md bg-[#f7f4ef] px-2 py-1">
                          <CalendarDays className="size-3.5" />
                          {formatGigDate(gig)}
                        </span>
                        <span className="rounded-md bg-[#f7f4ef] px-2 py-1">
                          {[gig.city, gig.region].filter(Boolean).join(", ") ||
                            gig.country ||
                            "Remote / open"}
                        </span>
                      </div>
                      <p className="line-clamp-4 text-sm leading-6 text-[#4f473f]">
                        {gig.description || "No details yet."}
                      </p>
                      {gig.compensation ? (
                        <p className="mt-3 text-sm font-semibold">
                          {gig.compensation}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs text-[#766d62]">
                        Posted by{" "}
                        {gig.profiles?.display_name ?? "TheTattooCore member"} -{" "}
                        {timeAgo(gig.created_at)}
                      </p>
                      <div className="mt-2">
                        <VerifiedBadge profile={gig.profiles} />
                      </div>
                      {isSignedIn ? (
                        <div className="mt-3">
                          <ReportForm
                            returnHash="gigs"
                            subjectId={gig.id}
                            subjectType="gig"
                          />
                        </div>
                      ) : null}
                      {gig.profiles?.id === claims?.sub &&
                      gig.profiles?.username ? (
                        <form action={archiveGig} className="mt-3">
                          <input name="gig_id" type="hidden" value={gig.id} />
                          <input
                            name="username"
                            type="hidden"
                            value={gig.profiles.username}
                          />
                          <button className="flex h-9 w-full items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-3 text-sm font-semibold">
                            Archive gig
                          </button>
                        </form>
                      ) : null}
                      <div className="mt-4 grid gap-2">
                        {isSignedIn ? (
                          <SavedItemButton
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                            hash="gigs"
                            isSaved={savedItemKeys.has(`gig:${gig.id}`)}
                            returnPath="/"
                            subjectId={gig.id}
                            subjectType="gig"
                          />
                        ) : null}
                        <CompactShareButton
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                          text={`Check this Gig on ${siteName}: ${gig.title}`}
                          title={gig.title}
                          url={`${siteUrl}/gigs/${gig.id}`}
                        />
                        {gig.contact_url ? (
                          <a
                            className="flex h-10 w-full items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                            href={gig.contact_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            View details
                          </a>
                        ) : gig.profiles?.username &&
                          gig.profiles.id !== claims?.sub &&
                          isSignedIn ? (
                          <form action={startConversation}>
                            <input
                              name="username"
                              type="hidden"
                              value={gig.profiles.username}
                            />
                            <input
                              name="body"
                              type="hidden"
                              value={`Hi, I am interested in your gig: ${gig.title}`}
                            />
                            <input
                              name="source_id"
                              type="hidden"
                              value={gig.id}
                            />
                            <input
                              name="source_title"
                              type="hidden"
                              value={gig.title}
                            />
                            <input
                              name="source_type"
                              type="hidden"
                              value="gig"
                            />
                            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                              <Send className="size-4" />
                              DM poster
                            </button>
                          </form>
                        ) : (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                            href={isSignedIn ? "/messages" : "/login"}
                          >
                            {isSignedIn ? "Open DM" : "Sign in to respond"}
                          </Link>
                        )}
                      </div>
                    </article>
                  ))
                : (
                    <div className="sm:col-span-2">
                      <EmptyColumnState
                        actionHref={
                          !isSignedIn ? "/login" : canCreate ? undefined : "/account"
                        }
                        actionLabel={
                          !isSignedIn
                            ? "Sign in to post gigs"
                            : canCreate
                              ? "Tap + to post a Gig"
                              : "Set up profile to post"
                        }
                        body="Jobs, conventions, guest spots, apprenticeships, travel openings, and event calls will show here."
                        icon={BriefcaseBusiness}
                        tips={["Jobs", "Conventions", "Guest spots"]}
                        title="No Gigs yet"
                      />
                    </div>
                  )}
            </div>
          </section>

          <section
            className="min-w-full snap-start border-l border-[#e5ded4] px-4 py-5"
            id="messages"
          >
            <div className="mb-4 flex items-center gap-2">
              <Send className="size-5" />
              <h2 className="text-lg font-bold">DM</h2>
            </div>
            <div className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm leading-6 text-[#4f473f]">
              DMs are live. Start conversations, view your inbox,
              and reply from the dedicated messenger.
              <Link
                className="mt-3 flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                href="/messages"
              >
                <Send className="size-4" />
                Open DM
              </Link>
            </div>
          </section>
          </div>
        </section>

        <aside className="hidden bg-[#f2f1ee] px-5 py-6 lg:block">
          <div className="mb-6">
            <Link
              className="flex items-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 py-2 shadow-sm"
              href="/search"
            >
              <Search className="size-4 text-[#766d62]" />
              <span className="text-sm text-[#766d62]">
                Search artists, styles, shops
              </span>
            </Link>
          </div>

          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4" />
              <h2 className="text-sm font-semibold">Live Gossip</h2>
            </div>
            <div className="space-y-3">
              {visibleThreadPosts.length ? (
                visibleThreadPosts.slice(0, 4).map((thread) => (
                  <a
                    className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-3 text-sm leading-5"
                    href={`#thread-${thread.id}`}
                    key={thread.id}
                  >
                    {thread.body}
                  </a>
                ))
              ) : (
                <SidebarEmptyState>No Gossip yet.</SidebarEmptyState>
              )}
            </div>
          </section>

          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <BriefcaseBusiness className="size-4" />
              <h2 className="text-sm font-semibold">Gigs</h2>
            </div>
            <div className="space-y-3">
              {visibleGigs.length ? (
                visibleGigs.slice(0, 4).map((gig) => (
                  <Link
                    className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-3"
                    href={`#gig-${gig.id}`}
                    key={gig.id}
                  >
                    <p className="text-sm font-semibold">{gig.title}</p>
                    <p className="mt-1 text-xs capitalize text-[#766d62]">
                      {formatGigCategory(gig.category)} - {formatGigDate(gig)}
                    </p>
                  </Link>
                ))
              ) : (
                <SidebarEmptyState>No Gigs yet.</SidebarEmptyState>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <ShoppingBag className="size-4" />
              <h2 className="text-sm font-semibold">Stuff</h2>
            </div>
            <div className="space-y-3">
              {visibleListings.length ? (
                visibleListings.slice(0, 4).map((listing) => (
                  <a
                    className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-3"
                    href={`#stuff-${listing.id}`}
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
                ))
              ) : (
                <SidebarEmptyState>No Stuff yet.</SidebarEmptyState>
              )}
            </div>
          </section>
        </aside>
      </div>
      <MobileShortcutNav
        isSignedIn={isSignedIn}
        profileHref={profileHref}
        unreadDmBadge={unreadDmBadge}
      />
      <FloatingComposer canCreate={canCreate} isSignedIn={isSignedIn} />
    </main>
  );
}
