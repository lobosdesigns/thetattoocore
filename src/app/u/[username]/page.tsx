import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  BriefcaseBusiness,
  CalendarDays,
  CalendarPlus,
  Camera,
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
import {
  acceptAdultTerms,
  archiveGig,
  createBookingRequest,
  endStoryPost,
  recordStoryView,
  replyToStory,
  toggleStoryReaction,
} from "@/app/actions";
import { ContentReportForm } from "@/app/content-report-form";
import { MediaLightbox } from "@/app/media-lightbox";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { ProtectedVideo } from "@/app/protected-video";
import { ProfileAvatar } from "@/app/profile-avatar";
import { SavedItemButton } from "@/app/saved-item-button";
import { createClient } from "@/lib/supabase/server";
import { platformFeePercentLabel } from "@/lib/payments/fees";
import {
  brandShareImage,
  brandShareImageAlt,
  shareImage,
  siteName,
  siteUrl,
} from "@/lib/site";
import { userGeneratedLinkRel } from "@/lib/urls";
import { isVerifiedProfessional } from "@/lib/verification";
import {
  acceptFollowRequest,
  blockProfile,
  declineFollowRequest,
  followProfile,
  unblockProfile,
  unfollowProfile,
} from "./actions";

type Claims = {
  sub: string;
};

type ShopProfile = {
  account_type: string;
  avatar_url: string | null;
  display_name: string;
  id: string;
  license_verified_at: string | null;
  username: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  account_type: string;
  bio: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  website_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  shop_profile: ShopProfile | null;
  shop_profile_id: string | null;
  is_private: boolean;
  license_verified_at: string | null;
  created_at: string;
};

type ViewerProfile = {
  adult_terms_accepted_at: string | null;
  id: string;
  is_adult_confirmed: boolean | null;
};

type BookingSettings = {
  booking_enabled: boolean;
  booking_note: string | null;
  calendar_connection_status: string;
  cancellation_policy: string | null;
  default_deposit_amount_cents: number;
  deposit_policy: string;
  timezone: string;
  weekly_availability: {
    summary?: string | null;
  } | null;
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

type StoryMedia = {
  id: string;
  media_type: "image";
  storage_bucket: string;
  storage_path: string;
};

type StoryPost = {
  id: string;
  author_id: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  is_sensitive: boolean;
  visibility: "public_preview" | "members" | "private";
  story_media: StoryMedia[];
  story_reactions?: { count: number }[];
  story_views?: { count: number }[];
};

type FollowRecord = {
  following_id: string;
  status: "pending" | "accepted";
};

type BlockRecord = {
  blocked_id: string;
  blocker_id: string;
};

type FollowRequest = {
  created_at: string;
  follower_id: string;
  profiles: Pick<Profile, "account_type" | "avatar_url" | "display_name" | "id" | "username"> | null;
};

type FollowPreview = {
  created_at: string;
  profiles: Pick<
    Profile,
    | "account_type"
    | "avatar_url"
    | "display_name"
    | "id"
    | "license_verified_at"
    | "username"
  > | null;
};

type LinkedArtist = Pick<
  Profile,
  | "account_type"
  | "avatar_url"
  | "display_name"
  | "id"
  | "license_verified_at"
  | "username"
>;

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
  return isVerifiedProfessional(profile);
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.max(1, Math.ceil(minutes / 60));
  if (hours <= 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function timeUntil(value: string) {
  const diffMs = new Date(value).getTime() - Date.now();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

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

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
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
          className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-2 py-1 text-[11px] font-semibold text-[var(--muted-strong)]"
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

function AdultTermsGate({ username }: { username: string }) {
  return (
    <section className="border-b border-[var(--card-rim)] px-4 py-4">
      <div className="rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)] bg-[var(--ink)] p-4 text-[var(--background)]">
        <p className="text-sm font-bold">18+ sensitive body-art content</p>
        <p className="mt-1 text-sm leading-5 text-[var(--background)]/75">
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
          <button className="h-10 rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold text-[var(--ink)]">
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
    <section className="border-b border-[var(--card-rim)] px-4 py-4">
      <div className="ttc-card rounded-md p-4">
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
            <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
              {isSignedIn
                ? "Some 18+ sensitive body-art content may stay hidden until your account has accepted the adult body-art terms."
                : "Visitors can discover public, non-sensitive work. Sign in to follow, DM, open full comments, view member-only posts, and confirm 18+ access where allowed."}
            </p>
            {!isSignedIn ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
                {[
                  "Limited comments",
                  "No DMs",
                  "No member-only posts",
                  "No sensitive media",
                ].map((item) => (
                    <span
                      className="ttc-surface rounded-md border px-2 py-1"
                      key={item}
                    >
                      {item}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>
          {hiddenCount > 0 ? (
            <span className="w-fit shrink-0 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
              {hiddenCount} hidden
            </span>
          ) : null}
        </div>
        {!isSignedIn ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
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

function ProfileStat({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: number;
}) {
  const content = (
    <>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-[var(--muted-strong)]">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link className="block rounded-md hover:underline" href={href}>
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
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
      className="ttc-card flex items-center gap-3 rounded-md p-3"
      href={`/u/${profile.username}`}
    >
      <ProfileAvatar profile={profile} size="md" />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-bold">{profile.display_name}</p>
          {isVerifiedProfile(profile) ? (
            <BadgeCheck className="size-3.5 shrink-0 text-[var(--foreground)]" />
          ) : null}
        </div>
        <p className="text-xs text-[var(--muted-strong)]">
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
    <section className="border-b border-[var(--card-rim)] px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus className="size-5" />
        <h2 className="text-lg font-bold">Community</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">Recent followers</p>
            <span className="text-xs font-semibold text-[var(--muted-strong)]">
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
              <p className="rounded-md border border-dashed border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-sm text-[var(--muted-strong)]">
                No followers to show yet.
              </p>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">Following</p>
            <span className="text-xs font-semibold text-[var(--muted-strong)]">
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
              <p className="rounded-md border border-dashed border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-sm text-[var(--muted-strong)]">
                Not following anyone yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function LinkedArtistsSection({
  artists,
  shopName,
}: {
  artists: LinkedArtist[];
  shopName: string;
}) {
  if (!artists.length) return null;

  return (
    <section className="border-b border-[var(--card-rim)] px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <BriefcaseBusiness className="size-5" />
        <div>
          <h2 className="text-lg font-bold">Artists at this shop</h2>
          <p className="text-sm text-[var(--muted-strong)]">
            Public artist profiles linked to {shopName}.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => (
          <FollowPreviewCard key={artist.id} label="artist" profile={artist} />
        ))}
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
    <span className="ttc-surface inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

function ProfileLinkChip({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      className="ttc-surface inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]"
      href={href}
    >
      <LinkIcon className="size-3.5" />
      {label}
    </Link>
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
      className="sticky top-[65px] z-10 flex gap-2 overflow-x-auto border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur"
    >
      {items.map(([href, label, count]) => (
        <a
          className="ttc-surface flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-bold hover:border-[var(--brand-gold)]"
          href={href}
          key={href}
        >
          <span>{label}</span>
          <span className="rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] px-1.5 py-0.5 text-xs text-[var(--muted)]">
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)]">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--muted-strong)]">{description}</p>
        </div>
      </div>
      <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2.5 py-1.5 text-xs font-bold text-[var(--muted)]">
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
    <div className="rounded-md border border-dashed border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_86%,transparent)] p-4">
      <div className="flex size-10 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{body}</p>
      {tips?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tips.map((tip) => (
            <span
              className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--muted)]"
              key={tip}
            >
              {tip}
            </span>
          ))}
        </div>
      ) : null}
      {actionHref && actionLabel ? (
        <Link
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
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
  const mediaSrc = media
    ? mediaUrl(media.storage_bucket, media.storage_path)
    : null;

  return (
    <article className="ttc-surface rounded-md border">
      {media ? (
        media.media_type === "video" ? (
          <MediaLightbox mediaType="video" src={mediaSrc ?? ""}>
            <ProtectedVideo
              className="aspect-[4/5] w-full rounded-t-md bg-[var(--ink)] object-cover"
              src={mediaSrc ?? undefined}
            />
          </MediaLightbox>
        ) : (
          <MediaLightbox
            alt={post.caption ?? "Profile post media"}
            mediaType="image"
            src={mediaSrc ?? ""}
          >
            <div
              className="aspect-[4/5] rounded-t-md bg-cover bg-center"
              style={{
                backgroundImage: `url(${mediaSrc})`,
              }}
            />
          </MediaLightbox>
        )
      ) : (
        <div className="flex aspect-[4/5] items-center justify-center rounded-t-md bg-[var(--foreground)] text-[var(--background)]">
          <Camera className="size-8" />
        </div>
      )}
      <div className="space-y-2 p-3">
        {post.style_tags[0] ? (
          <span className="rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] px-2 py-1 text-xs font-medium">
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--muted-strong)]">{timeAgo(post.created_at)}</p>
          <Link
            className="text-xs font-bold text-[var(--foreground)] hover:underline"
            href={`/p/${post.id}`}
          >
            Open
          </Link>
        </div>
      </div>
    </article>
  );
}

function ProfileStoryCard({
  isOwnProfile,
  profileUsername,
  story,
  viewerId,
}: {
  isOwnProfile: boolean;
  profileUsername: string;
  story: StoryPost;
  viewerId?: string;
}) {
  const media = story.story_media[0];
  const mediaSrc = media
    ? mediaUrl(media.storage_bucket, media.storage_path)
    : null;
  const canRecordStoryView = Boolean(viewerId && viewerId !== story.author_id);
  const canReplyToStory = Boolean(viewerId && viewerId !== story.author_id);
  const storyViewCount = story.story_views?.[0]?.count ?? 0;
  const storyReactionCount = story.story_reactions?.[0]?.count ?? 0;
  const reactionOptions = [
    ["fire", "\u{1F525}"],
    ["heart", "\u{1F5A4}"],
    ["clap", "\u{1F44F}"],
    ["hundred", "\u{1F4AF}"],
    ["flash", "\u26A1"],
    ["sparkles", "\u2728"],
  ] as const;
  const quickReplies = ["\u{1F525}", "\u{1F5A4}", "\u{1F64C}", "\u{1F4AF}"];

  if (!mediaSrc) return null;

  return (
    <section className="mt-5 max-w-xl rounded-lg border border-[color-mix(in_srgb,var(--gold)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_11%,var(--paper-warm))] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--muted-strong)]">
            Active story
          </p>
          <p className="text-sm font-semibold">
            Expires in {timeUntil(story.expires_at)}
          </p>
        </div>
        {isOwnProfile ? (
          <form action={endStoryPost}>
            <input name="story_id" type="hidden" value={story.id} />
            <button className="h-8 rounded-md border border-[var(--card-rim)] bg-[var(--foreground)] px-3 text-xs font-bold text-[var(--background)]">
              End
            </button>
          </form>
        ) : null}
      </div>
      <MediaLightbox
        alt="Profile story"
        description={
          story.caption ||
          `${timeAgo(story.created_at)} story. Expires in ${timeUntil(story.expires_at)}.`
        }
        footer={
          isOwnProfile ? (
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-2 text-white">
              <div className="rounded-md border border-white/15 bg-white/10 p-3">
                <p className="text-2xl font-black">{storyViewCount}</p>
                <p className="text-xs font-semibold uppercase text-white/65">
                  Views
                </p>
              </div>
              <div className="rounded-md border border-white/15 bg-white/10 p-3">
                <p className="text-2xl font-black">{storyReactionCount}</p>
                <p className="text-xs font-semibold uppercase text-white/65">
                  Reactions
                </p>
              </div>
            </div>
          ) : canReplyToStory ? (
            <div className="mx-auto grid max-w-xl gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-white/60">
                React to story
              </p>
              <div className="flex gap-2 overflow-x-auto">
                {reactionOptions.map(([value, label]) => (
                  <form action={toggleStoryReaction} key={value}>
                    <input name="story_id" type="hidden" value={story.id} />
                    <input name="reaction" type="hidden" value={value} />
                    <button
                      aria-label={`React ${value}`}
                      className="flex h-9 min-w-11 items-center justify-center rounded-md border border-white/20 bg-white/10 px-3 text-lg"
                    >
                      {label}
                    </button>
                  </form>
                ))}
              </div>
              <p className="pt-1 text-xs font-bold uppercase tracking-wide text-white/60">
                Send a DM reply
              </p>
              <form action={replyToStory} className="flex gap-2">
                <input name="story_id" type="hidden" value={story.id} />
                <input
                  className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/55 focus:border-white"
                  maxLength={500}
                  name="body"
                  placeholder="Reply to story"
                  required
                />
                <button
                  aria-label="Send story reply"
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white text-black"
                >
                  <Send className="size-4" />
                </button>
              </form>
              <div className="flex gap-2 overflow-x-auto">
                {quickReplies.map((reaction) => (
                  <form action={replyToStory} key={reaction}>
                    <input name="story_id" type="hidden" value={story.id} />
                    <input name="body" type="hidden" value={reaction} />
                    <button
                      aria-label={`Reply ${reaction}`}
                      className="flex h-9 min-w-11 items-center justify-center rounded-md border border-white/20 bg-white/10 px-3 text-lg"
                    >
                      {reaction}
                    </button>
                  </form>
                ))}
              </div>
              <div className="max-w-sm">
                <ContentReportForm
                  returnPath={`/u/${profileUsername}`}
                  subjectId={story.id}
                  subjectType="story_post"
                />
              </div>
            </div>
          ) : null
        }
        mediaType="image"
        openAction={
          canRecordStoryView ? recordStoryView.bind(null, story.id) : undefined
        }
        src={mediaSrc}
        title="Active story"
      >
        <button className="grid w-full grid-cols-[72px_1fr] items-center gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-2 text-left">
          <span
            className="block aspect-square rounded-md border border-[var(--card-rim)] bg-cover bg-center bg-[color-mix(in_srgb,var(--foreground)_88%,var(--gold))]"
            style={{ backgroundImage: `url(${mediaSrc})` }}
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold">
              {story.caption || "Tap to view story"}
            </span>
            <span className="mt-1 block text-xs font-semibold text-[var(--muted-strong)]">
              {timeAgo(story.created_at)} · 24h story
            </span>
          </span>
        </button>
      </MediaLightbox>
    </section>
  );
}

function ProfileStoryPrompt() {
  return (
    <section className="mt-5 max-w-xl rounded-lg border border-dashed border-[color-mix(in_srgb,var(--gold)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_8%,var(--paper-warm))] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--muted-strong)]">
            No active story
          </p>
          <p className="mt-1 text-sm font-semibold">
            Add a 24h image update from the Stories rail.
          </p>
        </div>
        <Link
          className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--foreground)] px-3 text-xs font-bold text-[var(--background)]"
          href="/?compose=stories#stories"
        >
          Add story
        </Link>
      </div>
    </section>
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
    .select(
      "id, username, display_name, avatar_url, account_type, bio, city, region, country, is_private",
    )
    .eq("username", cleanUsername)
    .maybeSingle<Pick<
      Profile,
      | "account_type"
      | "avatar_url"
      | "bio"
      | "city"
      | "country"
      | "display_name"
      | "id"
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
  const shareTitle = profile.is_private
    ? `Private profile | ${siteName}`
    : title;
  const { data: sharePost } = profile.is_private
    ? { data: null }
    : await supabase
        .from("feed_posts")
        .select(
          "feed_media(storage_bucket, storage_path, media_type, sort_order)",
        )
        .eq("author_id", profile.id)
        .eq("is_published", true)
        .eq("visibility", "public_preview")
        .eq("is_sensitive", false)
        .order("created_at", { ascending: false })
        .order("sort_order", {
          ascending: true,
          referencedTable: "feed_media",
        })
        .limit(1)
        .maybeSingle<{ feed_media: FeedMedia[] }>();
  const shareImageMedia = sharePost?.feed_media.find(
    (media) => media.media_type === "image",
  );
  const profileShareImage = profile.is_private
    ? brandShareImage
    : profile.avatar_url
      ? profile.avatar_url
      : shareImageMedia
        ? mediaUrl(shareImageMedia.storage_bucket, shareImageMedia.storage_path)
        : brandShareImage;
  const profileShareImageAlt = profile.is_private
    ? brandShareImageAlt
    : profile.avatar_url
      ? `${profile.display_name} profile photo on ${siteName}`
      : shareImageMedia
        ? `${profile.display_name} public tattoo work on ${siteName}`
        : brandShareImageAlt;

  return {
    alternates: {
      canonical: `${siteUrl}/u/${profile.username}`,
    },
    description,
    openGraph: {
      description,
      images: [shareImage(profileShareImage, profileShareImageAlt)],
      title: shareTitle,
      type: "profile",
      url: `${siteUrl}/u/${profile.username}`,
    },
    robots: {
      follow: !profile.is_private,
      index: !profile.is_private,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: [profileShareImage],
      title: shareTitle,
    },
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

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, account_type, bio, city, region, country, website_url, instagram_url, tiktok_url, facebook_url, youtube_url, x_url, shop_profile_id, is_private, license_verified_at, created_at",
    )
    .eq("username", cleanUsername)
    .maybeSingle<Omit<Profile, "shop_profile">>();

  if (!profileRow) {
    notFound();
  }

  const { data: shopProfile } = profileRow.shop_profile_id
    ? await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, account_type, license_verified_at")
        .eq("id", profileRow.shop_profile_id)
        .maybeSingle<ShopProfile>()
    : { data: null };
  const profile: Profile = {
    ...profileRow,
    shop_profile: shopProfile ?? null,
  };

  const [
    { count: followerCount },
    { count: followingCount },
    { data: followRecord },
    { data: followRequests },
    { data: followerPreview },
    { data: followingPreview },
    { data: viewerProfile },
    { data: blockRecord },
    { data: posts },
    { data: threads },
    { data: listings },
    { data: gigs },
    { data: savedProfile },
    { data: linkedArtists },
    { data: bookingSettings },
    { data: activeStories },
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
            "created_at, follower_id, profiles:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, account_type)",
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
        "created_at, profiles:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, account_type, license_verified_at)",
      )
      .eq("following_id", profile.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(4)
      .returns<FollowPreview[]>(),
    supabase
      .from("follows")
      .select(
        "created_at, profiles:profiles!follows_following_id_fkey(id, username, display_name, avatar_url, account_type, license_verified_at)",
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
    claims?.sub && claims.sub !== profile.id
      ? supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(
            `and(blocker_id.eq.${claims.sub},blocked_id.eq.${profile.id}),and(blocker_id.eq.${profile.id},blocked_id.eq.${claims.sub})`,
          )
          .limit(1)
          .maybeSingle<BlockRecord>()
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
    profile.account_type === "studio"
      ? supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, account_type, license_verified_at",
          )
          .eq("shop_profile_id", profile.id)
          .eq("account_type", "artist")
          .eq("is_private", false)
          .is("banned_at", null)
          .is("suspended_at", null)
          .order("display_name", { ascending: true })
          .limit(12)
          .returns<LinkedArtist[]>()
      : Promise.resolve({ data: [] as LinkedArtist[] }),
    ["artist", "studio"].includes(profile.account_type)
      ? supabase
          .from("booking_settings")
          .select(
            "booking_enabled, timezone, weekly_availability, booking_note, cancellation_policy, deposit_policy, default_deposit_amount_cents, calendar_connection_status",
          )
          .eq("profile_id", profile.id)
          .maybeSingle<BookingSettings>()
      : Promise.resolve({ data: null }),
    supabase
      .from("story_posts")
      .select(
        "id, author_id, caption, visibility, is_sensitive, created_at, expires_at, story_media(id, storage_bucket, storage_path, media_type, sort_order), story_reactions(count), story_views(count)",
      )
      .eq("author_id", profile.id)
      .eq("moderation_status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "story_media",
      })
      .limit(1)
      .returns<StoryPost[]>(),
  ]);

  const isOwnProfile = claims?.sub === profile.id;
  const blockedByViewer =
    Boolean(blockRecord) && blockRecord?.blocker_id === claims?.sub;
  const viewerBlockedByProfile =
    Boolean(blockRecord) && blockRecord?.blocked_id === claims?.sub;
  const hasBlockRelationship = blockedByViewer || viewerBlockedByProfile;
  const isFollowing = followRecord?.status === "accepted";
  const hasPendingRequest = followRecord?.status === "pending";
  const isPrivateLocked =
    (profile.is_private && !isOwnProfile && !isFollowing) ||
    hasBlockRelationship;
  const viewer = {
    isAdultConfirmed: Boolean(
      viewerProfile?.is_adult_confirmed &&
        viewerProfile.adult_terms_accepted_at,
    ),
    isSignedIn: Boolean(claims?.sub),
  };
  const canRequestBooking =
    !isOwnProfile &&
    Boolean(claims?.sub) &&
    !hasBlockRelationship &&
    !isPrivateLocked &&
    isVerifiedProfile(profile) &&
    ["artist", "studio"].includes(profile.account_type);
  const canShowBookingAvailability = Boolean(
    !isPrivateLocked &&
      bookingSettings?.booking_enabled &&
      isVerifiedProfile(profile) &&
      ["artist", "studio"].includes(profile.account_type),
  );
  const canShow = (item: VisibleContent) =>
    !isPrivateLocked && canRenderContent({ isOwnProfile, item, viewer });
  const visiblePosts = (posts ?? []).filter(canShow);
  const visibleThreads = (threads ?? []).filter(canShow);
  const visibleListings = (listings ?? []).filter(canShow);
  const visibleGigs = (gigs ?? []).filter(canShow);
  const visibleStory = (activeStories ?? []).find(canShow);
  const hiddenContentCount = isPrivateLocked
    ? 0
    : (posts?.length ?? 0) -
      visiblePosts.length +
      ((threads?.length ?? 0) - visibleThreads.length) +
      ((listings?.length ?? 0) - visibleListings.length) +
      ((gigs?.length ?? 0) - visibleGigs.length);

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to feed"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border ttc-surface"
                href="/"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">
                  {profile.display_name}
                </h1>
                <p className="text-xs text-[var(--muted-strong)]">@{profile.username}</p>
              </div>
            </div>
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        {query.message ? (
          <p className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_88%,var(--brand-gold)_12%)] px-4 py-3 text-sm font-medium">
            {query.message}
          </p>
        ) : null}

        <section className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-4 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <ProfileAvatar
              className="shadow-[0_12px_30px_rgba(23,20,18,0.22)]"
              profile={profile}
              size="xl"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{profile.display_name}</h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] px-2 py-1 text-xs font-semibold capitalize text-[var(--muted)]">
                  <UserPlus className="size-3" />
                  {formatAccountType(profile.account_type)}
                </span>
                {isVerifiedProfile(profile) ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-2 py-1 text-xs font-semibold text-[var(--background)]">
                    <BadgeCheck className="size-3" />
                    Verified {formatAccountType(profile.account_type)}
                  </span>
                ) : null}
                {profile.is_private ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] px-2 py-1 text-xs font-semibold text-[var(--muted-strong)]">
                    <LockKeyhole className="size-3" />
                    Private
                  </span>
                ) : null}
                {!profile.is_private && !viewer.isSignedIn ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] px-2 py-1 text-xs font-semibold text-[var(--muted-strong)]">
                    <LogIn className="size-3" />
                    Public preview
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-[var(--muted-strong)]">
                @{profile.username}
              </p>
              {profile.bio && !isPrivateLocked ? (
                <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6">
                  {profile.bio}
                </p>
              ) : null}
              {isPrivateLocked ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">
                  {blockedByViewer
                    ? "You blocked this profile. Unblock them if you want to view, follow, or message again."
                    : viewerBlockedByProfile
                      ? "This profile is not available to your account."
                      : "This profile is private. Follow the profile to see posts, gigs, stuff listings, and profile details."}
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
                {profile.shop_profile ? (
                  <ProfileLinkChip
                    href={`/u/${profile.shop_profile.username}`}
                    label={`Shop: ${profile.shop_profile.display_name}`}
                  />
                ) : null}
                {profile.website_url ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                    href={profile.website_url}
                    rel={userGeneratedLinkRel}
                    target="_blank"
                  >
                    <LinkIcon className="size-3.5" />
                    Website
                  </a>
                ) : null}
                {profile.instagram_url ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                    href={profile.instagram_url}
                    rel={userGeneratedLinkRel}
                    target="_blank"
                  >
                    <LinkIcon className="size-3.5" />
                    Instagram
                  </a>
                ) : null}
                {profile.tiktok_url ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                    href={profile.tiktok_url}
                    rel={userGeneratedLinkRel}
                    target="_blank"
                  >
                    <LinkIcon className="size-3.5" />
                    TikTok
                  </a>
                ) : null}
                {profile.facebook_url ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                    href={profile.facebook_url}
                    rel={userGeneratedLinkRel}
                    target="_blank"
                  >
                    <LinkIcon className="size-3.5" />
                    Facebook
                  </a>
                ) : null}
                {profile.youtube_url ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                    href={profile.youtube_url}
                    rel={userGeneratedLinkRel}
                    target="_blank"
                  >
                    <LinkIcon className="size-3.5" />
                    YouTube
                  </a>
                ) : null}
                {profile.x_url ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                    href={profile.x_url}
                    rel={userGeneratedLinkRel}
                    target="_blank"
                  >
                    <LinkIcon className="size-3.5" />
                    X
                  </a>
                ) : null}
              </div>
              ) : null}
              {visibleStory ? (
                <ProfileStoryCard
                  isOwnProfile={isOwnProfile}
                  profileUsername={profile.username}
                  story={visibleStory}
                  viewerId={claims?.sub}
                />
              ) : isOwnProfile && !isPrivateLocked ? (
                <ProfileStoryPrompt />
              ) : null}
              {canShowBookingAvailability ? (
                <section className="mt-5 rounded-lg border border-[color-mix(in_srgb,var(--gold)_34%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--paper-warm))] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
                        Booking availability
                      </p>
                      <h3 className="mt-1 text-base font-bold">
                        Open for requests
                      </h3>
                    </div>
                    <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-xs font-semibold">
                      {bookingSettings?.timezone}
                    </span>
                  </div>
                  {bookingSettings?.weekly_availability?.summary ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                      {bookingSettings.weekly_availability.summary}
                    </p>
                  ) : null}
                  {bookingSettings?.booking_note ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                      {bookingSettings.booking_note}
                    </p>
                  ) : null}
                  {bookingSettings?.cancellation_policy ? (
                    <div className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2">
                      <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                        Cancellation policy
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                        {bookingSettings.cancellation_policy}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted-strong)]">
                    <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 capitalize">
                      Deposit {bookingSettings?.deposit_policy}
                    </span>
                    {bookingSettings?.default_deposit_amount_cents ? (
                      <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1">
                        Typical deposit{" "}
                        {formatMoney(
                          bookingSettings.default_deposit_amount_cents,
                          "USD",
                        )}
                      </span>
                    ) : null}
                    <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1">
                      Calendar manual
                    </span>
                  </div>
                </section>
              ) : null}
              {!isPrivateLocked ? (
              <div className="mt-5 grid max-w-xl grid-cols-3 gap-4 sm:grid-cols-6">
                <ProfileStat label="4U" value={visiblePosts.length} />
                <ProfileStat label="Gossip" value={visibleThreads.length} />
                <ProfileStat label="Stuff" value={visibleListings.length} />
                <ProfileStat label="Gigs" value={visibleGigs.length} />
                <ProfileStat
                  href={
                    viewer.isSignedIn
                      ? `/u/${profile.username}/followers`
                      : undefined
                  }
                  label="followers"
                  value={followerCount ?? 0}
                />
                <ProfileStat
                  href={
                    viewer.isSignedIn
                      ? `/u/${profile.username}/following`
                      : undefined
                  }
                  label="following"
                  value={followingCount ?? 0}
                />
              </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                {isOwnProfile ? (
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                    href="/account"
                  >
                    Edit profile
                  </Link>
                ) : hasBlockRelationship ? null : isFollowing ? (
                  <form action={unfollowProfile}>
                    <input name="profile_id" type="hidden" value={profile.id} />
                    <input
                      name="username"
                      type="hidden"
                      value={profile.username}
                    />
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold">
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
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold">
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
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                      <UserPlus className="size-4" />
                      {profile.is_private ? "Request follow" : "Follow"}
                    </button>
                  </form>
                )}
                {!isOwnProfile && !hasBlockRelationship ? (
                  <Link
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                    href={`/messages?to=${profile.username}`}
                  >
                    <Send className="size-4" />
                    DM
                  </Link>
                ) : null}
                {!isOwnProfile && claims?.sub && !hasBlockRelationship ? (
                  <SavedItemButton
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                    isSaved={Boolean(savedProfile)}
                    returnPath={`/u/${profile.username}`}
                    subjectId={profile.id}
                    subjectType="profile"
                  />
                ) : null}
                {!isOwnProfile && claims?.sub && !hasBlockRelationship ? (
                  <ContentReportForm
                    returnPath={`/u/${profile.username}`}
                    subjectId={profile.id}
                    subjectType="profile"
                  />
                ) : null}
                {!isOwnProfile && claims?.sub ? (
                  blockedByViewer ? (
                    <form action={unblockProfile}>
                      <input name="profile_id" type="hidden" value={profile.id} />
                      <input
                        name="username"
                        type="hidden"
                        value={profile.username}
                      />
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold">
                        <Ban className="size-4" />
                        Unblock
                      </button>
                    </form>
                  ) : viewerBlockedByProfile ? null : (
                    <form action={blockProfile}>
                      <input name="profile_id" type="hidden" value={profile.id} />
                      <input
                        name="username"
                        type="hidden"
                        value={profile.username}
                      />
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[color-mix(in_srgb,#d14b4b_36%,var(--card-rim))] bg-[color-mix(in_srgb,#d14b4b_12%,var(--paper-warm))] px-4 text-sm font-semibold text-[color-mix(in_srgb,#d14b4b_80%,var(--foreground))]">
                        <Ban className="size-4" />
                        Block
                      </button>
                    </form>
                  )
                ) : null}
              </div>
              {canRequestBooking ? (
                <details
                  className="mt-4 scroll-mt-28 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_84%,var(--brand-gold)_7%)] p-3"
                  id="booking-request"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold">
                      <CalendarPlus className="size-4 text-[var(--gold)]" />
                      Request booking
                    </span>
                    <span className="text-xs font-semibold text-[var(--muted-strong)]">
                      Deposit later
                    </span>
                  </summary>
                  <form action={createBookingRequest} className="mt-3 grid gap-3">
                    <input name="artist_id" type="hidden" value={profile.id} />
                    <input
                      name="return_path"
                      type="hidden"
                      value={`/u/${profile.username}`}
                    />
                    <input
                      className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                      maxLength={120}
                      name="title"
                      placeholder="Tattoo idea or appointment title"
                      required
                    />
                    <textarea
                      className="min-h-28 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                      maxLength={2000}
                      name="body"
                      placeholder="Describe placement, size, style, references, schedule needs, and anything the artist should know."
                      required
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                        maxLength={120}
                        name="placement"
                        placeholder="Placement"
                      />
                      <input
                        className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                        maxLength={160}
                        name="style_tags"
                        placeholder="Style tags"
                      />
                      <input
                        className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                        maxLength={120}
                        name="preferred_city"
                        placeholder="Preferred city"
                      />
                      <input
                        className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                        maxLength={240}
                        name="preferred_dates"
                        placeholder="Preferred dates"
                      />
                    </div>
                    <label className="block">
                      <span className="text-xs font-semibold text-[var(--muted)]">
                        Requested deposit amount
                      </span>
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue={
                          bookingSettings?.default_deposit_amount_cents
                            ? (bookingSettings.default_deposit_amount_cents / 100).toFixed(2)
                            : ""
                        }
                        inputMode="decimal"
                        name="deposit_amount"
                        placeholder="Example: 100"
                      />
                    </label>
                    <p className="text-xs leading-5 text-[var(--muted-strong)]">
                      Deposit checkout opens only after the artist or studio
                      accepts. TTC records a transparent {platformFeePercentLabel}{" "}
                      booking processing fee with the deposit.
                    </p>
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                      <CalendarPlus className="size-4" />
                      Send booking request
                    </button>
                  </form>
                </details>
              ) : null}
            </div>
          </div>
        </section>

        {isOwnProfile && profile.is_private && followRequests?.length ? (
          <section className="border-b border-[var(--card-rim)] px-4 py-6">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="size-5" />
              <h2 className="text-lg font-bold">Follow requests</h2>
            </div>
            <div className="space-y-3">
              {followRequests.map((request) => (
                <article
                  className="ttc-card flex flex-col gap-3 rounded-md p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={request.follower_id}
                >
                  <div>
                    <p className="font-semibold">
                      {request.profiles?.display_name ?? "Unknown member"}
                    </p>
                    <p className="text-sm text-[var(--muted-strong)]">
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
                      <button className="h-9 rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)]">
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
                      <button className="h-9 ttc-surface rounded-md border px-3 text-sm font-semibold">
                        Decline
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!isPrivateLocked && viewer.isSignedIn ? (
          <FollowPreviewSection
            followers={followerPreview ?? []}
            following={followingPreview ?? []}
          />
        ) : null}

        {!isPrivateLocked ? (
          <LinkedArtistsSection
            artists={linkedArtists ?? []}
            shopName={profile.display_name}
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
            <div className="ttc-card rounded-md border ttc-surface p-5 text-center">
              <LockKeyhole className="mx-auto mb-3 size-8 text-[var(--muted-strong)]" />
              <h2 className="text-lg font-bold">Private profile</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-strong)]">
                {blockedByViewer
                  ? "You blocked this profile, so their content and messages are hidden."
                  : viewerBlockedByProfile
                    ? "This profile is not available to your account."
                    : "The owner has limited this profile to followers. Public search engines can see only this limited preview."}
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
          className="scroll-mt-28 border-b border-[var(--card-rim)] px-4 py-6"
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
                  <Link
                    className="ttc-card block rounded-md p-4 transition hover:border-[var(--foreground)]"
                    href={`/t/${thread.id}`}
                    key={thread.id}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <ContentLabels
                        isSensitive={thread.is_sensitive}
                        visibility={thread.visibility}
                      />
                      <p className="shrink-0 text-xs text-[var(--muted-strong)]">
                        {timeAgo(thread.created_at)}
                      </p>
                    </div>
                    <p className="text-sm leading-6">{thread.body}</p>
                  </Link>
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
                    className="ttc-card block rounded-md p-4 transition hover:border-[var(--foreground)]"
                    href={`/stuff/${listing.id}`}
                    key={listing.id}
                  >
                    <div className="flex gap-3">
                      {listing.marketplace_media[0]?.media_type === "video" ? (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)]">
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
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))]">
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
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted-strong)]">
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
                      ? "List flash, supplies, chair rentals, machines, furniture, or services. Seller contact and pro gear activity stay verified-only."
                      : "Marketplace listings from this profile will appear here when they have active Stuff. Fans can browse; seller contact is verified-only."
                  }
                  icon={ShoppingBag}
                  tips={["Flash", "Supplies", "Verified gear"]}
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
                    className="ttc-card rounded-md p-4"
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
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))]">
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
                          <span className="rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] px-2 py-1 text-xs font-medium capitalize">
                            {formatGigCategory(gig.category)}
                          </span>
                          <ContentLabels
                            isSensitive={gig.is_sensitive}
                            visibility={gig.visibility}
                          />
                        </div>
                        <p className="mt-2 flex items-center gap-1 text-xs text-[var(--muted-strong)]">
                          <CalendarDays className="size-3.5" />
                          {formatGigDate(gig)} -{" "}
                          {[gig.city, gig.region, gig.country]
                            .filter(Boolean)
                            .join(", ") || "Remote / open"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted-strong)]">
                          {gig.description || gig.compensation || "No details yet."}
                        </p>
                        {gig.contact_url ? (
                          <a
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)]"
                            href={gig.contact_url}
                            rel={userGeneratedLinkRel}
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
                            <button className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm font-semibold">
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
