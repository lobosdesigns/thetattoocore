import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Flag,
  LinkIcon,
  LogIn,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  ShoppingBag,
  UserPlus,
  UserRoundMinus,
  Video,
  type LucideIcon,
} from "lucide-react";
import { acceptAdultTerms, archiveGig, createContentReport } from "@/app/actions";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { SavedItemButton } from "@/app/saved-item-button";
import { createClient } from "@/lib/supabase/server";
import { siteName, siteUrl } from "@/lib/site";
import {
  acceptFollowRequest,
  declineFollowRequest,
  followProfile,
  unfollowProfile,
} from "./actions";

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
  is_private: boolean;
  license_verified_at: string | null;
  created_at: string;
};

type ViewerProfile = {
  adult_terms_accepted_at: string | null;
  id: string;
  is_adult_confirmed: boolean | null;
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
  media_type: "image" | "video";
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

type GigMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
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
  compensation: string | null;
  contact_url: string | null;
  created_at: string;
  is_sensitive: boolean;
  visibility: "public_preview" | "members" | "private";
  gig_media: GigMedia[];
};

type FollowRecord = {
  following_id: string;
  status: "pending" | "accepted";
};

type FollowRequest = {
  created_at: string;
  follower_id: string;
  profiles: Pick<Profile, "account_type" | "display_name" | "id" | "username"> | null;
};

type FollowPreview = {
  created_at: string;
  profiles: Pick<
    Profile,
    | "account_type"
    | "display_name"
    | "id"
    | "license_verified_at"
    | "username"
  > | null;
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

function isVerifiedProfile(
  profile: Pick<Profile, "account_type" | "license_verified_at">,
) {
  return Boolean(
    profile.license_verified_at &&
      (profile.account_type === "artist" || profile.account_type === "studio"),
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

function formatPrice(listing: Listing) {
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
    day: "numeric",
    month: "short",
  }).format(new Date(gig.starts_at));
}

function formatGigCategory(category: string) {
  return category.replaceAll("_", " ");
}

function formatAccountType(value: string) {
  return value.replaceAll("_", " ");
}

function formatJoinedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
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

function canRenderContent({
  isOwnProfile,
  item,
  viewer,
}: {
  isOwnProfile: boolean;
  item: VisibleContent;
  viewer: { isSignedIn: boolean; isAdultConfirmed: boolean };
}) {
  if (isOwnProfile) return true;
  if (item.visibility === "private") return false;
  if (item.visibility === "members" && !viewer.isSignedIn) return false;
  if (item.is_sensitive && !viewer.isAdultConfirmed) return false;

  return true;
}

function ProfileReportForm({
  profileId,
  username,
}: {
  profileId: string;
  username: string;
}) {
  return (
    <form
      action={createContentReport}
      className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-2"
    >
      <input name="subject_id" type="hidden" value={profileId} />
      <input name="subject_type" type="hidden" value="profile" />
      <input name="return_path" type="hidden" value={`/u/${username}`} />
      <p className="mb-2 text-xs leading-5 text-[#766d62]">
        Report profiles for scams, harassment, illegal services, sexual content,
        minor safety concerns, or impersonation.
      </p>
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
        <select
          aria-label="Report profile reason"
          className="h-10 rounded-md border border-[#cfc8bd] bg-white px-2 text-xs outline-none focus:border-[#171412]"
          name="reason"
        >
          <option value="scam or spam">Scam, spam, or impersonation</option>
          <option value="harassment or hate">Harassment, hate, or threats</option>
          <option value="minor safety concern">Minor safety concern</option>
          <option value="sexual content">Sexual or pornographic content</option>
          <option value="illegal goods or services">Illegal goods or services</option>
          <option value="other">Other policy concern</option>
        </select>
        <input
          className="h-10 min-w-0 rounded-md border border-[#cfc8bd] bg-white px-2 text-xs outline-none focus:border-[#171412]"
          maxLength={500}
          name="details"
          placeholder="What should moderators know?"
        />
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold">
          <Flag className="size-4" />
          Report
        </button>
      </div>
    </form>
  );
}

function AdultTermsGate({ username }: { username: string }) {
  return (
    <section className="border-b border-[#cfc8bd] px-4 py-4">
      <div className="rounded-md border border-[#171412] bg-[#171412] p-4 text-white">
        <p className="text-sm font-bold">18+ body-art content</p>
        <p className="mt-1 text-sm leading-5 text-white/75">
          This profile may include sensitive tattoo, piercing, healing, or
          placement posts. Accept the Terms to view eligible sensitive content.
        </p>
        <form action={acceptAdultTerms} className="mt-3 flex flex-wrap gap-2">
          <input name="return_path" type="hidden" value={`/u/${username}`} />
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

function PublicProfileNotice({
  hiddenCount,
  isAdultConfirmed,
  isSignedIn,
}: {
  hiddenCount: number;
  isAdultConfirmed: boolean;
  isSignedIn: boolean;
}) {
  if (isSignedIn && isAdultConfirmed && hiddenCount === 0) return null;

  return (
    <section className="border-b border-[#cfc8bd] px-4 py-4">
      <div className="ttc-card rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-sm font-bold">
              {isSignedIn ? (
                <ShieldCheck className="size-4" />
              ) : (
                <LogIn className="size-4" />
              )}
              Public profile preview
            </p>
            <p className="mt-1 text-sm leading-6 text-[#766d62]">
              {isSignedIn
                ? "Some member or 18+ content may stay hidden until your account has accepted the adult body-art terms."
                : "Visitors can discover public, non-sensitive work. Sign in to follow, DM, view member-only posts, and confirm 18+ access where allowed."}
            </p>
          </div>
          {hiddenCount > 0 ? (
            <span className="w-fit shrink-0 rounded-md border border-[#cfc8bd] bg-white px-2 py-1 text-xs font-semibold text-[#4f473f]">
              {hiddenCount} hidden
            </span>
          ) : null}
        </div>
        {!isSignedIn ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
              href="/terms"
            >
              Content rules
            </Link>
          </div>
        ) : null}
      </div>
    </section>
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

function FollowPreviewCard({
  label,
  profile,
}: {
  label: string;
  profile: FollowPreview["profiles"];
}) {
  if (!profile) return null;

  return (
    <Link
      className="ttc-card flex items-center gap-3 rounded-md border border-[#cfc8bd] bg-white p-3"
      href={`/u/${profile.username}`}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#171412] text-sm font-bold text-[#c8953b]">
        {initials(profile.display_name)}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-bold">{profile.display_name}</p>
          {isVerifiedProfile(profile) ? (
            <BadgeCheck className="size-3.5 shrink-0 text-[#171412]" />
          ) : null}
        </div>
        <p className="text-xs text-[#766d62]">
          @{profile.username} - {label}
        </p>
      </div>
    </Link>
  );
}

function FollowPreviewSection({
  followers,
  following,
}: {
  followers: FollowPreview[];
  following: FollowPreview[];
}) {
  if (!followers.length && !following.length) return null;

  return (
    <section className="border-b border-[#cfc8bd] px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus className="size-5" />
        <h2 className="text-lg font-bold">Community</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">Recent followers</p>
            <span className="text-xs font-semibold text-[#766d62]">
              {followers.length} shown
            </span>
          </div>
          <div className="grid gap-2">
            {followers.length ? (
              followers.map((follow) => (
                <FollowPreviewCard
                  key={follow.profiles?.id ?? follow.created_at}
                  label="follower"
                  profile={follow.profiles}
                />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-[#cfc8bd] bg-[#fffdf9] p-3 text-sm text-[#766d62]">
                No followers to show yet.
              </p>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">Following</p>
            <span className="text-xs font-semibold text-[#766d62]">
              {following.length} shown
            </span>
          </div>
          <div className="grid gap-2">
            {following.length ? (
              following.map((follow) => (
                <FollowPreviewCard
                  key={follow.profiles?.id ?? follow.created_at}
                  label="following"
                  profile={follow.profiles}
                />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-[#cfc8bd] bg-[#fffdf9] p-3 text-sm text-[#766d62]">
                Not following anyone yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileDetailChip({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#cfc8bd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4f473f]">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

function ProfileContentNav({
  items,
}: {
  items: [href: string, label: string, count: number][];
}) {
  return (
    <nav
      aria-label="Profile content"
      className="sticky top-[65px] z-10 flex gap-2 overflow-x-auto border-b border-[#cfc8bd] bg-[#e8e4dc]/95 px-4 py-3 backdrop-blur"
    >
      {items.map(([href, label, count]) => (
        <a
          className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 text-sm font-bold text-[#171412] hover:border-[#c8953b]"
          href={href}
          key={href}
        >
          <span>{label}</span>
          <span className="rounded-md bg-[#efe7da] px-1.5 py-0.5 text-xs text-[#4f473f]">
            {count}
          </span>
        </a>
      ))}
    </nav>
  );
}

function ProfileSectionHeading({
  count,
  description,
  icon: Icon,
  title,
}: {
  count: number;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-[#766d62]">{description}</p>
        </div>
      </div>
      <span className="w-fit rounded-md border border-[#d8d1c6] bg-white px-2.5 py-1.5 text-xs font-bold text-[#4f473f]">
        {count} live
      </span>
    </div>
  );
}

function ProfileEmptyState({
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
  icon: typeof Camera;
  tips?: string[];
  title: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-[#cfc6ba] bg-[#f7f4ef] p-4">
      <div className="flex size-10 items-center justify-center rounded-md bg-[#efe7da]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#766d62]">{body}</p>
      {tips?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tips.map((tip) => (
            <span
              className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 py-1 text-xs font-semibold text-[#4f473f]"
              key={tip}
            >
              {tip}
            </span>
          ))}
        </div>
      ) : null}
      {actionHref && actionLabel ? (
        <Link
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
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

type ProfilePageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ message?: string }>;
};

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const cleanUsername = username.replace(/^@/, "").toLowerCase();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, account_type, bio, city, region, country, is_private")
    .eq("username", cleanUsername)
    .maybeSingle<Pick<
      Profile,
      | "account_type"
      | "bio"
      | "city"
      | "country"
      | "display_name"
      | "is_private"
      | "region"
      | "username"
    >>();

  if (!profile) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: "Profile not found",
    };
  }

  const location = [profile.city, profile.region, profile.country]
    .filter(Boolean)
    .join(", ");
  const title = `${profile.display_name} (@${profile.username})`;
  const description = profile.is_private
    ? `${profile.display_name} has a private profile on ${siteName}.`
    : profile.bio?.slice(0, 155) ||
      `${profile.display_name} is a ${profile.account_type} on ${siteName}${
        location ? ` in ${location}` : ""
      }.`;

  return {
    alternates: {
      canonical: `${siteUrl}/u/${profile.username}`,
    },
    description,
    openGraph: {
      description,
      title,
      type: "profile",
      url: `${siteUrl}/u/${profile.username}`,
    },
    robots: {
      follow: !profile.is_private,
      index: !profile.is_private,
    },
    title,
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  const { username } = await params;
  const query = await searchParams;
  const cleanUsername = username.replace(/^@/, "").toLowerCase();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, account_type, bio, city, region, country, website_url, instagram_url, is_private, license_verified_at, created_at",
    )
    .eq("username", cleanUsername)
    .maybeSingle<Profile>();

  if (!profile) {
    notFound();
  }

  const [
    { count: followerCount },
    { count: followingCount },
    { data: followRecord },
    { data: followRequests },
    { data: followerPreview },
    { data: followingPreview },
    { data: viewerProfile },
    { data: posts },
    { data: threads },
    { data: listings },
    { data: gigs },
    { data: savedProfile },
  ] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id)
      .eq("status", "accepted"),
    claims?.sub
      ? supabase
          .from("follows")
          .select("following_id, status")
          .eq("follower_id", claims.sub)
          .eq("following_id", profile.id)
          .maybeSingle<FollowRecord>()
      : Promise.resolve({ data: null }),
    claims?.sub === profile.id
      ? supabase
          .from("follows")
          .select(
            "created_at, follower_id, profiles:profiles!follows_follower_id_fkey(id, username, display_name, account_type)",
          )
          .eq("following_id", profile.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(12)
          .returns<FollowRequest[]>()
      : Promise.resolve({ data: null }),
    supabase
      .from("follows")
      .select(
        "created_at, profiles:profiles!follows_follower_id_fkey(id, username, display_name, account_type, license_verified_at)",
      )
      .eq("following_id", profile.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(4)
      .returns<FollowPreview[]>(),
    supabase
      .from("follows")
      .select(
        "created_at, profiles:profiles!follows_following_id_fkey(id, username, display_name, account_type, license_verified_at)",
      )
      .eq("follower_id", profile.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(4)
      .returns<FollowPreview[]>(),
    claims?.sub
      ? supabase
          .from("profiles")
          .select("id, adult_terms_accepted_at, is_adult_confirmed")
          .eq("id", claims.sub)
          .maybeSingle<ViewerProfile>()
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
        "id, title, description, price_cents, currency, category, created_at, is_sensitive, visibility, marketplace_media(id, storage_bucket, storage_path, media_type, sort_order)",
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
    supabase
      .from("gigs")
      .select(
        "id, title, description, category, city, region, country, starts_at, compensation, contact_url, created_at, is_sensitive, visibility, gig_media(id, storage_bucket, storage_path, media_type, sort_order)",
      )
      .eq("poster_id", profile.id)
      .eq("status", "active")
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "gig_media",
      })
      .limit(6)
      .returns<Gig[]>(),
    claims?.sub && claims.sub !== profile.id
      ? supabase
          .from("saved_items")
          .select("subject_id")
          .eq("user_id", claims.sub)
          .eq("subject_type", "profile")
          .eq("subject_id", profile.id)
          .maybeSingle<{ subject_id: string }>()
      : Promise.resolve({ data: null }),
  ]);

  const isOwnProfile = claims?.sub === profile.id;
  const isFollowing = followRecord?.status === "accepted";
  const hasPendingRequest = followRecord?.status === "pending";
  const isPrivateLocked = profile.is_private && !isOwnProfile && !isFollowing;
  const viewer = {
    isAdultConfirmed: Boolean(
      viewerProfile?.is_adult_confirmed &&
        viewerProfile.adult_terms_accepted_at,
    ),
    isSignedIn: Boolean(claims?.sub),
  };
  const canShow = (item: VisibleContent) =>
    !isPrivateLocked && canRenderContent({ isOwnProfile, item, viewer });
  const visiblePosts = (posts ?? []).filter(canShow);
  const visibleThreads = (threads ?? []).filter(canShow);
  const visibleListings = (listings ?? []).filter(canShow);
  const visibleGigs = (gigs ?? []).filter(canShow);
  const hiddenContentCount = isPrivateLocked
    ? 0
    : (posts?.length ?? 0) -
      visiblePosts.length +
      ((threads?.length ?? 0) - visibleThreads.length) +
      ((listings?.length ?? 0) - visibleListings.length) +
      ((gigs?.length ?? 0) - visibleGigs.length);

  return (
    <main className="min-h-screen bg-[#202020] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-5xl bg-[#f2f1ee] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to feed"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
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
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        {query.message ? (
          <p className="border-b border-[#cfc8bd] bg-[#e8e4dc] px-4 py-3 text-sm font-medium">
            {query.message}
          </p>
        ) : null}

        <section className="border-b border-[#cfc8bd] bg-[#fffdf9] px-4 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex size-24 shrink-0 items-center justify-center rounded-md bg-[#171412] text-2xl font-bold text-[#c8953b] shadow-[0_12px_30px_rgba(23,20,18,0.22)]">
              {initials(profile.display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{profile.display_name}</h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#efe7da] px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
                  <UserPlus className="size-3" />
                  {formatAccountType(profile.account_type)}
                </span>
                {isVerifiedProfile(profile) ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#171412] px-2 py-1 text-xs font-semibold text-white">
                    <BadgeCheck className="size-3" />
                    Verified {formatAccountType(profile.account_type)}
                  </span>
                ) : null}
                {profile.is_private ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#cfc8bd] px-2 py-1 text-xs font-semibold text-[#766d62]">
                    <LockKeyhole className="size-3" />
                    Private
                  </span>
                ) : null}
                {!profile.is_private && !viewer.isSignedIn ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#cfc8bd] px-2 py-1 text-xs font-semibold text-[#766d62]">
                    <LogIn className="size-3" />
                    Public preview
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-[#766d62]">
                @{profile.username}
              </p>
              {profile.bio && !isPrivateLocked ? (
                <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6">
                  {profile.bio}
                </p>
              ) : null}
              {isPrivateLocked ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#766d62]">
                  This profile is private. Follow the profile to see posts,
                  gigs, stuff listings, and profile details.
                </p>
              ) : null}
              {!isPrivateLocked ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <ProfileDetailChip icon={CalendarDays}>
                  Joined {formatJoinedDate(profile.created_at)}
                </ProfileDetailChip>
                {isVerifiedProfile(profile) ? (
                  <ProfileDetailChip icon={ShieldCheck}>
                    License verified
                  </ProfileDetailChip>
                ) : null}
                {profileLocation(profile) ? (
                  <ProfileDetailChip icon={MapPin}>
                    {profileLocation(profile)}
                  </ProfileDetailChip>
                ) : null}
                {profile.website_url ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-[#cfc8bd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#171412]"
                    href={profile.website_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <LinkIcon className="size-3.5" />
                    Website
                  </a>
                ) : null}
                {profile.instagram_url ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-[#cfc8bd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#171412]"
                    href={profile.instagram_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <LinkIcon className="size-3.5" />
                    Instagram
                  </a>
                ) : null}
              </div>
              ) : null}
              {!isPrivateLocked ? (
              <div className="mt-5 grid max-w-xl grid-cols-3 gap-4 sm:grid-cols-6">
                <ProfileStat label="4U" value={visiblePosts.length} />
                <ProfileStat label="Gossip" value={visibleThreads.length} />
                <ProfileStat label="Stuff" value={visibleListings.length} />
                <ProfileStat label="Gigs" value={visibleGigs.length} />
                <ProfileStat label="followers" value={followerCount ?? 0} />
                <ProfileStat label="following" value={followingCount ?? 0} />
              </div>
              ) : null}
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
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold">
                      <UserRoundMinus className="size-4" />
                      Following
                    </button>
                  </form>
                ) : hasPendingRequest ? (
                  <form action={unfollowProfile}>
                    <input name="profile_id" type="hidden" value={profile.id} />
                    <input
                      name="username"
                      type="hidden"
                      value={profile.username}
                    />
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold">
                      <UserRoundMinus className="size-4" />
                      Request sent
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
                      {profile.is_private ? "Request follow" : "Follow"}
                    </button>
                  </form>
                )}
                {!isOwnProfile ? (
                  <Link
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
                    href="/messages"
                  >
                    <Send className="size-4" />
                    DM
                  </Link>
                ) : null}
                {!isOwnProfile && claims?.sub ? (
                  <SavedItemButton
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
                    isSaved={Boolean(savedProfile)}
                    returnPath={`/u/${profile.username}`}
                    subjectId={profile.id}
                    subjectType="profile"
                  />
                ) : null}
                {!isOwnProfile && claims?.sub ? (
                  <ProfileReportForm
                    profileId={profile.id}
                    username={profile.username}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {isOwnProfile && profile.is_private && followRequests?.length ? (
          <section className="border-b border-[#cfc8bd] px-4 py-6">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="size-5" />
              <h2 className="text-lg font-bold">Follow requests</h2>
            </div>
            <div className="space-y-3">
              {followRequests.map((request) => (
                <article
                  className="ttc-card flex flex-col gap-3 rounded-md border border-[#cfc8bd] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={request.follower_id}
                >
                  <div>
                    <p className="font-semibold">
                      {request.profiles?.display_name ?? "Unknown member"}
                    </p>
                    <p className="text-sm text-[#766d62]">
                      @{request.profiles?.username ?? "unknown"} ·{" "}
                      {request.profiles?.account_type ?? "member"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={acceptFollowRequest}>
                      <input
                        name="follower_id"
                        type="hidden"
                        value={request.follower_id}
                      />
                      <input
                        name="username"
                        type="hidden"
                        value={profile.username}
                      />
                      <button className="h-9 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white">
                        Approve
                      </button>
                    </form>
                    <form action={declineFollowRequest}>
                      <input
                        name="follower_id"
                        type="hidden"
                        value={request.follower_id}
                      />
                      <input
                        name="username"
                        type="hidden"
                        value={profile.username}
                      />
                      <button className="h-9 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm font-semibold">
                        Decline
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!isPrivateLocked ? (
          <FollowPreviewSection
            followers={followerPreview ?? []}
            following={followingPreview ?? []}
          />
        ) : null}

        {!isPrivateLocked && !isOwnProfile ? (
          <PublicProfileNotice
            hiddenCount={hiddenContentCount}
            isAdultConfirmed={viewer.isAdultConfirmed}
            isSignedIn={viewer.isSignedIn}
          />
        ) : null}

        {viewer.isSignedIn && !viewer.isAdultConfirmed && !isPrivateLocked ? (
          <AdultTermsGate username={profile.username} />
        ) : null}

        {isPrivateLocked ? (
          <section className="px-4 py-8">
            <div className="ttc-card rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-5 text-center">
              <LockKeyhole className="mx-auto mb-3 size-8 text-[#766d62]" />
              <h2 className="text-lg font-bold">Private profile</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#766d62]">
                The owner has limited this profile to followers.
                Public search engines can see only this limited preview.
              </p>
            </div>
          </section>
        ) : (
          <>
        <ProfileContentNav
          items={[
            ["#profile-4u", "4U", visiblePosts.length],
            ["#profile-gossip", "Gossip", visibleThreads.length],
            ["#profile-stuff", "Stuff", visibleListings.length],
            ["#profile-gigs", "Gigs", visibleGigs.length],
          ]}
        />
        <section
          className="scroll-mt-28 border-b border-[#cfc8bd] px-4 py-6"
          id="profile-4u"
        >
          <ProfileSectionHeading
            count={visiblePosts.length}
            description="Photos and short reels from this profile."
            icon={Camera}
            title="4U"
          />
          {visiblePosts.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePosts.map((post) => (
                <PostPreview key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <ProfileEmptyState
              actionHref={isOwnProfile ? "/#feed" : undefined}
              actionLabel={isOwnProfile ? "Post from 4U" : undefined}
              body={
                isOwnProfile
                  ? "Start with fresh work, healed pieces, or a short reel. Use the 4U column plus button from the main feed."
                  : "Photos and short reels from this profile will appear here when they post public 4U content."
              }
              icon={Camera}
              tips={["Photos", "Healed work", "Short reels"]}
              title="No 4U posts yet"
            />
          )}
        </section>

        <section className="grid gap-6 px-4 py-6 lg:grid-cols-2">
          <div className="scroll-mt-28" id="profile-gossip">
            <ProfileSectionHeading
              count={visibleThreads.length}
              description="Longer posts, questions, and shop talk."
              icon={MessageCircle}
              title="Gossip"
            />
            <div className="space-y-3">
              {visibleThreads.length ? (
                visibleThreads.map((thread) => (
                  <article
                    className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4"
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
                <ProfileEmptyState
                  actionHref={isOwnProfile ? "/#threads" : undefined}
                  actionLabel={isOwnProfile ? "Start Gossip" : undefined}
                  body={
                    isOwnProfile
                      ? "Use Gossip for longer shop talk, questions, guest spots, and image-backed threads."
                      : "Longer posts, questions, and community threads from this profile will appear here."
                  }
                  icon={MessageCircle}
                  tips={["Shop talk", "Questions", "Threads"]}
                  title="No Gossip yet"
                />
              )}
            </div>
          </div>

          <div className="scroll-mt-28" id="profile-stuff">
            <ProfileSectionHeading
              count={visibleListings.length}
              description="Flash, supplies, studio gear, and services."
              icon={ShoppingBag}
              title="Stuff"
            />
            <div className="space-y-3">
              {visibleListings.length ? (
                visibleListings.map((listing) => (
                  <Link
                    className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-4 transition hover:border-[#171412]"
                    href={`/stuff/${listing.id}`}
                    key={listing.id}
                  >
                    <div className="flex gap-3">
                      {listing.marketplace_media[0]?.media_type === "video" ? (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white">
                          <Video className="size-6" />
                        </div>
                      ) : listing.marketplace_media[0] ? (
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
                  </Link>
                ))
              ) : (
                <ProfileEmptyState
                  actionHref={isOwnProfile ? "/#marketplace" : undefined}
                  actionLabel={isOwnProfile ? "List Stuff" : undefined}
                  body={
                    isOwnProfile
                      ? "List flash, supplies, studio gear, chair rentals, machines, furniture, or services."
                      : "Marketplace listings from this profile will appear here when they have active Stuff."
                  }
                  icon={ShoppingBag}
                  tips={["Flash", "Supplies", "Studio gear"]}
                  title="No active listings yet"
                />
              )}
            </div>
          </div>

          <div className="scroll-mt-28" id="profile-gigs">
            <ProfileSectionHeading
              count={visibleGigs.length}
              description="Jobs, conventions, guest spots, and events."
              icon={BriefcaseBusiness}
              title="Gigs"
            />
            <div className="space-y-3">
              {visibleGigs.length ? (
                visibleGigs.map((gig) => (
                  <article
                    className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4"
                    key={gig.id}
                  >
                    <div className="flex gap-3">
                      {gig.gig_media[0] ? (
                        <div
                          className="size-16 shrink-0 rounded-md bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${mediaUrl(
                              gig.gig_media[0].storage_bucket,
                              gig.gig_media[0].storage_path,
                            )})`,
                          }}
                        />
                      ) : (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[#efe7da]">
                          <BriefcaseBusiness className="size-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          className="font-semibold hover:underline"
                          href={`/gigs/${gig.id}`}
                        >
                          {gig.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-md bg-[#efe7da] px-2 py-1 text-xs font-medium capitalize">
                            {formatGigCategory(gig.category)}
                          </span>
                          <ContentLabels
                            isSensitive={gig.is_sensitive}
                            visibility={gig.visibility}
                          />
                        </div>
                        <p className="mt-2 flex items-center gap-1 text-xs text-[#766d62]">
                          <CalendarDays className="size-3.5" />
                          {formatGigDate(gig)} -{" "}
                          {[gig.city, gig.region, gig.country]
                            .filter(Boolean)
                            .join(", ") || "Remote / open"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#766d62]">
                          {gig.description || gig.compensation || "No details yet."}
                        </p>
                        {gig.contact_url ? (
                          <a
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
                            href={gig.contact_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            View details
                          </a>
                        ) : null}
                        {isOwnProfile ? (
                          <form action={archiveGig} className="mt-3">
                            <input name="gig_id" type="hidden" value={gig.id} />
                            <input
                              name="username"
                              type="hidden"
                              value={profile.username}
                            />
                            <button className="inline-flex h-9 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold">
                              Archive gig
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <ProfileEmptyState
                  actionHref={isOwnProfile ? "/#gigs" : undefined}
                  actionLabel={isOwnProfile ? "Post a Gig" : undefined}
                  body={
                    isOwnProfile
                      ? "Post open chairs, guest spots, convention plans, apprenticeships, jobs, and event calls."
                      : "Open jobs, guest spots, conventions, and event calls from this profile will appear here."
                  }
                  icon={BriefcaseBusiness}
                  tips={["Guest spots", "Conventions", "Jobs"]}
                  title="No active gigs yet"
                />
              )}
            </div>
          </div>
        </section>
          </>
        )}
      </div>
    </main>
  );
}
