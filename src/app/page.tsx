import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Heart,
  Home as HomeIcon,
  ImageIcon,
  LockKeyhole,
  LogIn,
  MessageCircle,
  Package,
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
  deleteFeedPost,
  deleteThreadPost,
  editFeedPost,
  editThreadPost,
  togglePostLike,
  toggleThreadLike,
} from "./actions";
import { AdImpressionBeacon } from "./ad-impression-beacon";
import { ColumnTabs } from "./column-tabs";
import { ColumnSnapRail } from "./column-snap-rail";
import { ContentReportForm } from "./content-report-form";
import { startConversation } from "./messages/actions";
import { FloatingComposer } from "./floating-composer";
import { LanguageStatusBanner } from "./language-status-banner";
import { LogoLockup, LogoWordmark } from "./logo-mark";
import { MediaLightbox } from "./media-lightbox";
import { NotificationBellLink } from "./notification-bell-link";
import { ProtectedVideo } from "./protected-video";
import { ProfileAvatar } from "./profile-avatar";
import { SavedItemButton } from "./saved-item-button";
import { SensitiveContentGate } from "./sensitive-content-gate";
import { CompactShareButton } from "./share-actions";
import { countryLabel, languageLabel, normalizedLanguage } from "@/lib/localization";
import { siteName, siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedProfessional } from "@/lib/verification";

type Claims = {
  sub: string;
  email?: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  adult_terms_accepted_at?: string | null;
  account_type: string;
  city: string | null;
  country_code?: string | null;
  is_adult_confirmed?: boolean | null;
  license_verified_at?: string | null;
  location_personalization_enabled?: boolean | null;
  preferred_language?: string | null;
  region: string | null;
  role?: string | null;
  banned_at?: string | null;
  suspended_at?: string | null;
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

type MerchProduct = {
  category: string;
  created_at: string;
  currency: string;
  description: string | null;
  id: string;
  inventory_quantity: number;
  inventory_reserved: number;
  is_official: boolean;
  merch_product_media: ListingMedia[];
  price_cents: number;
  profiles: Profile | null;
  title: string;
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
  subject_type:
    | "feed_post"
    | "gig"
    | "marketplace_listing"
    | "merch_product"
    | "thread_post";
};

type FollowedProfile = {
  following_id: string;
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
  deleted_at: string | null;
  post_comment_hides: { hidden_by: string }[] | { hidden_by: string } | null;
};

type ThreadLike = {
  user_id: string;
};

type ThreadComment = {
  id: string;
  deleted_at: string | null;
  thread_comment_hides: { hidden_by: string }[] | { hidden_by: string } | null;
};

type RankingContext = {
  followedProfileIds: Set<string>;
  preferredCategories: Set<string>;
  preferredStyleTags: Set<string>;
  savedKeys: Set<string>;
  userId: string | null;
  viewerCity: string | null;
  viewerRegion: string | null;
};

function savedKey(subjectType: SavedItem["subject_type"], subjectId: string) {
  return `${subjectType}:${subjectId}`;
}

function ageScore(createdAt: string) {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000);

  return Math.max(0, 240 - ageHours);
}

function profileAffinityScore(profile: Profile | null, context: RankingContext) {
  if (!profile) return 0;

  return (
    (context.followedProfileIds.has(profile.id) ? 950 : 0) +
    (context.viewerCity && profile.city === context.viewerCity ? 95 : 0) +
    (context.viewerRegion && profile.region === context.viewerRegion ? 70 : 0)
  );
}

function locationAffinityScore(
  item: { city?: string | null; region?: string | null },
  context: RankingContext,
) {
  return (
    (context.viewerCity && item.city === context.viewerCity ? 80 : 0) +
    (context.viewerRegion && item.region === context.viewerRegion ? 55 : 0)
  );
}

function buildRankingContext({
  currentProfile,
  feedPosts,
  gigs,
  listings,
  merchProducts,
  savedItems,
  threadPosts,
  userId,
  followedProfileIds,
}: {
  currentProfile: Profile | null;
  feedPosts: FeedPost[];
  followedProfileIds: Set<string>;
  gigs: Gig[];
  listings: MarketplaceListing[];
  merchProducts: MerchProduct[];
  savedItems: SavedItem[];
  threadPosts: ThreadPost[];
  userId: string | null;
}): RankingContext {
  const savedKeys = new Set(
    savedItems.map((item) => savedKey(item.subject_type, item.subject_id)),
  );
  const preferredStyleTags = new Set<string>();
  const preferredCategories = new Set<string>();

  for (const post of feedPosts) {
    const liked = Boolean(userId && post.post_likes.some((like) => like.user_id === userId));
    const saved = savedKeys.has(savedKey("feed_post", post.id));

    if (liked || saved) {
      for (const tag of post.style_tags ?? []) {
        preferredStyleTags.add(tag.toLowerCase());
      }
    }
  }

  for (const thread of threadPosts) {
    const liked = Boolean(
      userId && thread.thread_likes.some((like) => like.user_id === userId),
    );
    const saved = savedKeys.has(savedKey("thread_post", thread.id));

    if (liked || saved) {
      for (const word of thread.body.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []) {
        preferredStyleTags.add(word);
      }
    }
  }

  for (const listing of listings) {
    if (savedKeys.has(savedKey("marketplace_listing", listing.id))) {
      preferredCategories.add(listing.category.toLowerCase());
    }
  }

  for (const gig of gigs) {
    if (savedKeys.has(savedKey("gig", gig.id))) {
      preferredCategories.add(gig.category.toLowerCase());
    }
  }

  for (const product of merchProducts) {
    if (product.profiles && followedProfileIds.has(product.profiles.id)) {
      preferredCategories.add(product.category.toLowerCase());
    }
  }

  return {
    followedProfileIds,
    preferredCategories,
    preferredStyleTags,
    savedKeys,
    userId,
    viewerCity: currentProfile?.location_personalization_enabled
      ? currentProfile.city
      : null,
    viewerRegion: currentProfile?.location_personalization_enabled
      ? currentProfile.region
      : null,
  };
}

function rankFeedPosts(posts: FeedPost[], context: RankingContext) {
  return [...posts].sort((a, b) => {
    const score = (post: FeedPost) =>
      ageScore(post.created_at) +
      profileAffinityScore(post.profiles, context) +
      (context.savedKeys.has(savedKey("feed_post", post.id)) ? 260 : 0) +
      (context.userId && post.post_likes.some((like) => like.user_id === context.userId)
        ? 210
        : 0) +
      post.style_tags.reduce(
        (sum, tag) => sum + (context.preferredStyleTags.has(tag.toLowerCase()) ? 140 : 0),
        0,
      ) +
      Math.min(120, post.post_likes.length * 12 + post.post_comments.length * 8);

    return score(b) - score(a) || Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

function rankThreadPosts(posts: ThreadPost[], context: RankingContext) {
  return [...posts].sort((a, b) => {
    const score = (thread: ThreadPost) =>
      ageScore(thread.created_at) +
      profileAffinityScore(thread.profiles, context) +
      (context.savedKeys.has(savedKey("thread_post", thread.id)) ? 240 : 0) +
      (context.userId &&
      thread.thread_likes.some((like) => like.user_id === context.userId)
        ? 190
        : 0) +
      Math.min(120, thread.thread_likes.length * 12 + thread.thread_comments.length * 8);

    return score(b) - score(a) || Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

function rankCategoryItems<
  T extends {
    category: string;
    city?: string | null;
    created_at: string;
    id: string;
    profiles: Profile | null;
    region?: string | null;
  },
>(items: T[], context: RankingContext, savedType?: SavedItem["subject_type"]) {
  return [...items].sort((a, b) => {
    const score = (item: T) =>
      ageScore(item.created_at) +
      profileAffinityScore(item.profiles, context) +
      locationAffinityScore(item, context) +
      (context.preferredCategories.has(item.category.toLowerCase()) ? 220 : 0) +
      (savedType && context.savedKeys.has(savedKey(savedType, item.id)) ? 260 : 0);

    return score(b) - score(a) || Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

type SponsoredPlacement = "4u-feed" | "gossip-feed" | "stuff-feed";
type AdPlacement = "4u" | "gossip" | "stuff";
type SponsoredCampaign = {
  advertiser: Pick<Profile, "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"> | null;
  body: string | null;
  campaign_type: "artist_growth" | "stuff_listing";
  city: string | null;
  country_code: string | null;
  goal: string;
  id: string;
  keywords: string[];
  language: string | null;
  matchLabels: string[];
  region: string | null;
  target_url: string | null;
  title: string;
};

function sponsoredSlotTitle(placement: SponsoredPlacement) {
  if (placement === "4u-feed") return "Sponsored in 4U";
  if (placement === "gossip-feed") return "Sponsored in Gossip";

  return "Sponsored in Stuff";
}

function hasCommentHide(
  value: { hidden_by: string }[] | { hidden_by: string } | null,
) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function sponsoredDbPlacement(placement: SponsoredPlacement): AdPlacement {
  if (placement === "4u-feed") return "4u";
  if (placement === "gossip-feed") return "gossip";

  return "stuff";
}

function stuffAccessStatus(profile: Profile | null) {
  if (!profile) {
    return {
      body: "Save your profile before posting, commenting, or applying for pro Stuff access.",
      href: "/account",
      label: "Set up profile",
      title: "Profile needed",
      tone: "neutral",
    };
  }

  if (profile.banned_at) {
    return {
      body: "This account is banned from member actions and Stuff access.",
      href: "/account",
      label: "View account",
      title: "Account banned",
      tone: "danger",
    };
  }

  if (profile.suspended_at) {
    return {
      body: "This account is suspended from posting, messaging, and Stuff access.",
      href: "/account",
      label: "View account",
      title: "Account suspended",
      tone: "danger",
    };
  }

  if (isVerifiedProfessional(profile)) {
    return {
      body: "You can list Stuff, contact sellers, trade, and use professional equipment listings.",
      href: "#marketplace",
      label: "Open Stuff",
      title: "Stuff access active",
      tone: "success",
    };
  }

  return {
    body: "Fans can browse Stuff. Buy, sell, trade, seller contact, and pro gear need artist, studio, or vendor verification.",
    href: "/account#verification-settings",
    label: "Apply for verification",
    title: "Browse-only Stuff",
    tone: "warning",
  };
}

function StuffAccessCard({ profile }: { profile: Profile | null }) {
  const status = stuffAccessStatus(profile);
  const toneClass =
    status.tone === "success"
      ? "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))]"
      : status.tone === "danger"
        ? "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))]"
        : status.tone === "warning"
          ? "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))]"
          : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)]";

  return (
    <section className={`mt-4 rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
        Stuff access
      </p>
      <h2 className="mt-1 text-sm font-bold">{status.title}</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{status.body}</p>
      <Link
        className="mt-3 inline-flex h-8 items-center rounded-md bg-[var(--foreground)] px-3 text-xs font-semibold text-[var(--background)]"
        href={status.href}
      >
        {status.label}
      </Link>
    </section>
  );
}

function shouldShowSponsoredSlot(index: number, total: number) {
  return total > 0 && index === Math.min(1, total - 1);
}

function SponsoredSlot({
  campaign,
  placement,
}: {
  campaign?: SponsoredCampaign | null;
  placement: SponsoredPlacement;
}) {
  if (!campaign) return null;

  const dbPlacement = sponsoredDbPlacement(placement);
  const location = [
    campaign.city,
    campaign.region,
    countryLabel(campaign.country_code),
  ]
    .filter(Boolean)
    .join(", ");
  const targetingSummary = [
    location ? "local area" : null,
    campaign.language ? languageLabel(campaign.language) : null,
    campaign.keywords.length ? "style keywords" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const content = (
    <article className="ttc-card rounded-md border border-[color-mix(in_srgb,var(--gold)_60%,var(--card-rim))] bg-[var(--ink)] p-4 text-[var(--paper-warm)] shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
      <AdImpressionBeacon campaignId={campaign.id} placement={dbPlacement} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
            {sponsoredSlotTitle(placement)}
          </p>
          <h3 className="mt-2 text-base font-bold">{campaign.title}</h3>
        </div>
        <span className="shrink-0 rounded-md border border-white/15 bg-[color-mix(in_srgb,var(--paper-warm)_10%,transparent)] px-2 py-1 text-xs font-semibold">
          Ad
        </span>
      </div>
      {campaign.body ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/75">
          {campaign.body}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold capitalize text-white/80">
          {campaign.goal.replaceAll("_", " ")}
        </span>
        {campaign.campaign_type === "artist_growth" ? (
          <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white/80">
            Artist growth
          </span>
        ) : (
          <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white/80">
            Stuff listing
          </span>
        )}
        {campaign.matchLabels.map((label) => (
          <span
            className="rounded-md bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] px-2 py-1 text-xs font-semibold text-[color-mix(in_srgb,var(--gold)_70%,var(--background))]"
            key={label}
          >
            {label}
          </span>
        ))}
        {location ? (
          <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white/80">
            {location}
          </span>
        ) : null}
        {campaign.keywords.slice(0, 3).map((keyword) => (
          <span
            className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white/80"
            key={keyword}
          >
            {keyword}
          </span>
        ))}
      </div>
      <p className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-white/65">
        Sponsored placement reviewed by TheTattooCore. Shown by placement
        {targetingSummary ? ` and ${targetingSummary}` : ""}, not AI profiling.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProfileAvatar profile={campaign.advertiser} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {campaign.advertiser?.display_name ?? "TheTattooCore advertiser"}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/60">
              <span>@{campaign.advertiser?.username ?? "advertiser"}</span>
              <VerifiedBadge profile={campaign.advertiser} />
            </div>
          </div>
        </div>
        <span className="shrink-0 text-sm font-bold text-[var(--gold)]">
          Learn more
        </span>
      </div>
    </article>
  );

  if (!campaign.target_url) return content;

  const clickHref = `/api/ad-click?campaign_id=${encodeURIComponent(
    campaign.id,
  )}&placement=${encodeURIComponent(dbPlacement)}`;

  return (
    <a href={clickHref} rel="nofollow sponsored noreferrer" target="_blank">
      {content}
    </a>
  );
}

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
    <div className="ttc-card rounded-md border border-dashed border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-6">
      <div className="flex size-11 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--gold)]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
      {tips?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tips.map((tip) => (
            <span
              className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--muted)]"
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
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : (
          <p className="mt-5 text-sm font-semibold text-[var(--foreground)]">
            {actionLabel}
          </p>
        )
      ) : null}
    </div>
  );
}

function SidebarEmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm leading-5 text-[var(--muted-strong)] shadow-sm">
      {children}
    </div>
  );
}

function LoadMoreLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-4 flex justify-center">
      <Link
        className="flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 text-sm font-bold shadow-sm hover:bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)]"
        href={href}
      >
        {label}
      </Link>
    </div>
  );
}

function profileLocation(profile?: Profile | null) {
  return [profile?.city, profile?.region].filter(Boolean).join(", ");
}

function isVerifiedProfile(
  profile?: Pick<Profile, "account_type" | "license_verified_at"> | null,
) {
  return isVerifiedProfessional(profile);
}

function VerifiedBadge({
  profile,
}: {
  profile?: Pick<Profile, "account_type" | "license_verified_at"> | null;
}) {
  if (!isVerifiedProfile(profile)) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--background)]"
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
          className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-[11px] font-semibold text-[var(--muted-strong)]"
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

  return true;
}

function canViewSensitiveContent(
  item: VisibleContent,
  viewer: { isSignedIn: boolean; isAdultConfirmed: boolean },
) {
  if (!item.is_sensitive) return true;

  return viewer.isSignedIn && viewer.isAdultConfirmed;
}

function mediaUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function MediaFrame({
  isLocked = false,
  isSignedIn = false,
  media,
  returnPath = "/",
}: {
  isLocked?: boolean;
  isSignedIn?: boolean;
  media?: PostMedia;
  returnPath?: string;
}) {
  if (!media) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-[var(--foreground)] text-[var(--background)]">
        <div className="text-center">
          <ImageIcon className="mx-auto mb-2 size-10 opacity-80" />
          <p className="text-sm font-semibold">No media attached</p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="relative overflow-hidden bg-[var(--foreground)]">
        <div className="flex aspect-[4/5] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-[var(--background)]">
          <div className="text-center opacity-45 blur-[1px]">
            <LockKeyhole className="mx-auto mb-3 size-14" />
            <p className="text-sm font-bold uppercase tracking-[0.18em]">
              Sensitive media
            </p>
          </div>
        </div>
        <SensitiveContentGate
          isSignedIn={isSignedIn}
          returnPath={returnPath}
        />
      </div>
    );
  }

  const src = mediaUrl(media.storage_bucket, media.storage_path);

  if (media.media_type === "video") {
    return (
      <MediaLightbox mediaType="video" src={src}>
        <ProtectedVideo
          className="aspect-[4/5] w-full bg-[var(--foreground)] object-cover"
          src={src}
        />
      </MediaLightbox>
    );
  }

  return (
    <MediaLightbox alt="4U post media" mediaType="image" src={src}>
      <div
        className="aspect-[4/5] bg-cover bg-center"
        style={{ backgroundImage: `url(${src})` }}
      />
    </MediaLightbox>
  );
}

function ListingThumb({
  isLocked = false,
  media,
}: {
  isLocked?: boolean;
  media?: ListingMedia;
}) {
  if (!media) {
    return (
      <div className="flex size-11 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))]">
        <ImageIcon className="size-5" />
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="relative size-11 overflow-hidden rounded-md bg-[var(--foreground)] text-[var(--background)]">
        <div className="flex size-full items-center justify-center bg-[var(--foreground)] blur-[1px]">
          <LockKeyhole className="size-5 opacity-70" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--foreground)_55%,transparent)]">
          <LockKeyhole className="size-4" />
        </div>
      </div>
    );
  }

  if (media.media_type === "video") {
    return (
      <MediaLightbox
        mediaType="video"
        src={mediaUrl(media.storage_bucket, media.storage_path)}
      >
        <div className="flex size-11 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)]">
          <Video className="size-5" />
        </div>
      </MediaLightbox>
    );
  }

  const src = mediaUrl(media.storage_bucket, media.storage_path);

  return (
    <MediaLightbox alt="Listing media" mediaType="image" src={src}>
      <div
        className="size-11 rounded-md bg-cover bg-center"
        style={{
          backgroundImage: `url(${src})`,
        }}
      />
    </MediaLightbox>
  );
}

function ThreadImage({
  isLocked = false,
  isSignedIn = false,
  media,
  returnPath = "/",
}: {
  isLocked?: boolean;
  isSignedIn?: boolean;
  media?: ThreadMedia;
  returnPath?: string;
}) {
  if (!media) return null;

  if (isLocked) {
    return (
      <div className="relative mt-3 overflow-hidden rounded-md border border-[var(--card-rim)] bg-[var(--foreground)]">
        <div className="flex aspect-[16/10] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-[var(--background)]">
          <div className="text-center opacity-45 blur-[1px]">
            <LockKeyhole className="mx-auto mb-2 size-10" />
            <p className="text-xs font-bold uppercase tracking-[0.18em]">
              Sensitive discussion media
            </p>
          </div>
        </div>
        <SensitiveContentGate
          context="discussion"
          isSignedIn={isSignedIn}
          returnPath={returnPath}
        />
      </div>
    );
  }

  const src = mediaUrl(media.storage_bucket, media.storage_path);

  return (
    <MediaLightbox alt="Gossip thread media" mediaType="image" src={src}>
      <div
        className="mt-3 aspect-[16/10] rounded-md border border-[var(--card-rim)] bg-cover bg-center"
        style={{
          backgroundImage: `url(${src})`,
        }}
      />
    </MediaLightbox>
  );
}

function AuthCallout({ isSignedIn }: { isSignedIn: boolean }) {
  if (isSignedIn) {
    return (
      <Link
        className="flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
        href="/account"
      >
        Profile
      </Link>
    );
  }

  return (
    <Link
      className="flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
      href="/login"
    >
      <LogIn className="size-4" />
      Sign in
    </Link>
  );
}

function AdultTermsGate({ returnHash = "feed" }: { returnHash?: string }) {
  return (
    <section className="border-b border-[var(--card-rim)] bg-[var(--foreground)] px-4 py-4 text-[var(--background)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">18+ sensitive body-art content</p>
          <p className="mt-1 text-sm leading-5 text-[var(--background)]/75">
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
          <button className="h-10 rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold text-[var(--foreground)]">
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[color-mix(in_srgb,var(--gold)_24%,var(--card-rim))] bg-[color-mix(in_srgb,var(--foreground)_94%,transparent)] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_28px_rgba(0,0,0,0.24)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map(([Icon, label, href, badge]) => (
          <Link
            className="relative flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-semibold text-[var(--background)] hover:bg-[color-mix(in_srgb,var(--paper-warm)_10%,transparent)]"
            href={href}
            key={label}
          >
            <Icon className="size-5" />
            <span className="truncate">{label}</span>
            {badge ? (
              <span className="absolute right-2 top-1 flex min-w-5 items-center justify-center rounded-full bg-[var(--gold)] px-1.5 text-[10px] font-bold text-[var(--foreground)]">
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
    <section className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">Public preview</p>
          <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
            Sign in to post, reply, DM, follow creators, and view member-only
            or 18+ sensitive body-art content.
          </p>
          {lockedCount ? (
            <p className="mt-2 text-xs font-semibold text-[var(--muted-strong)]">
              {lockedCount} member or 18+ item{lockedCount === 1 ? "" : "s"} hidden.
            </p>
          ) : null}
        </div>
        <Link
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
          href="/login"
        >
          <LogIn className="size-4" />
          Sign in
        </Link>
      </div>
    </section>
  );
}

function StoriesRail() {
  const items = [
    ["Artists", ImageIcon],
    ["Studios", HomeIcon],
    ["Vendors", ShoppingBag],
    ["Merch", Package],
    ["Events", CalendarDays],
  ] as const;

  return (
    <section
      aria-label="Stories"
      className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 py-3"
    >
      <div className="no-scrollbar flex gap-3 overflow-x-auto">
        <div className="flex h-16 min-w-20 flex-col items-center justify-center rounded-md border border-dashed border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] px-3 text-center">
          <Sparkles className="size-4 text-[var(--gold)]" />
          <span className="mt-1 text-[11px] font-bold text-[var(--muted)]">
            Stories
          </span>
        </div>
        {items.map(([label, Icon]) => (
          <div
            className="flex h-16 min-w-20 flex-col items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-center"
            key={label}
          >
            <Icon className="size-4 text-[var(--muted-strong)]" />
            <span className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
              {label}
            </span>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted-strong)]">
              Soon
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileSetupGate() {
  return (
    <section className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">Finish your profile</p>
          <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
            Choose a username and account type before posting, replying,
            listing Stuff, adding Gigs, or sending DMs.
          </p>
        </div>
        <Link
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
          href="/account"
        >
          <UserRound className="size-4" />
          Set up profile
        </Link>
      </div>
    </section>
  );
}

function LanguageStatus({ preferredLanguage }: { preferredLanguage: string }) {
  const label = languageLabel(preferredLanguage);

  return <LanguageStatusBanner label={label} />;
}

function TranslationCue({ preferredLanguage }: { preferredLanguage: string }) {
  if (preferredLanguage === "en") return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[var(--muted-strong)]">
      <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1">
        Original text
      </span>
      <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1">
        Translation planned
      </span>
    </div>
  );
}

async function fetchSponsoredCampaign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  placement: AdPlacement,
  viewer?: Pick<
    Profile,
    | "city"
    | "country_code"
    | "location_personalization_enabled"
    | "preferred_language"
    | "region"
  > | null,
) {
  const now = new Date().toISOString();
  const countryCode = viewer?.country_code?.toUpperCase() || null;
  const language = viewer?.preferred_language?.toLowerCase() || null;
  const useLocal = Boolean(viewer?.location_personalization_enabled);
  const city = useLocal ? viewer?.city || null : null;
  const region = useLocal ? viewer?.region || null : null;
  let query = supabase
    .from("ad_campaigns")
        .select(
          "id, title, body, target_url, campaign_type, goal, bid_cents, city, region, country_code, language, keywords, profiles:profiles!ad_campaigns_advertiser_id_fkey(username, display_name, avatar_url, account_type, license_verified_at), ad_campaign_placements!inner(placement)",
        )
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .eq("ad_campaign_placements.placement", placement);

  if (countryCode) {
    query = query.or(`country_code.is.null,country_code.eq.${countryCode}`);
  }

  if (language) {
    query = query.or(`language.is.null,language.eq.${language}`);
  }

  if (region) {
    query = query.or(`region.is.null,region.eq.${region}`);
  } else {
    query = query.is("region", null);
  }

  if (city) {
    query = query.or(`city.is.null,city.eq.${city}`);
  } else {
    query = query.is("city", null);
  }

  const { data } = await query
    .order("bid_cents", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8)
    .returns<
      {
        bid_cents: number;
        body: string | null;
        campaign_type: "artist_growth" | "stuff_listing";
        city: string | null;
        country_code: string | null;
        goal: string;
        id: string;
        keywords: string[];
        language: string | null;
          profiles: Pick<
            Profile,
            "account_type" | "avatar_url" | "display_name" | "license_verified_at" | "username"
          > | null;
        region: string | null;
        target_url: string | null;
        title: string;
      }[]
    >();

  const campaign = data
    ?.map((item) => ({
      item,
      score:
        item.bid_cents +
        (countryCode && item.country_code === countryCode ? 250 : 0) +
        (language && item.language === language ? 200 : 0) +
        (region && item.region === region ? 150 : 0) +
        (city && item.city === city ? 200 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.item;
  if (!campaign) return null;

  const matchLabels = [
    countryCode && campaign.country_code === countryCode ? "Country match" : null,
    language && campaign.language === language ? "Language match" : null,
    region && campaign.region === region ? "Region match" : null,
    city && campaign.city === city ? "City match" : null,
  ].filter(Boolean) as string[];

  return {
    advertiser: campaign.profiles,
    body: campaign.body,
    campaign_type: campaign.campaign_type,
    city: campaign.city,
    country_code: campaign.country_code,
    goal: campaign.goal,
    id: campaign.id,
    keywords: campaign.keywords ?? [],
    language: campaign.language,
    matchLabels,
    region: campaign.region,
    target_url: campaign.target_url,
    title: campaign.title,
  } satisfies SponsoredCampaign;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    feedPage?: string;
    gigsPage?: string;
    gossipPage?: string;
    merchPage?: string;
    message?: string;
    stuffPage?: string;
  }>;
}) {
  const params = await searchParams;
  const pageSize = 25;
  const pageParam = (value: string | undefined) =>
    Math.max(1, Math.min(20, Number(value ?? "1") || 1));
  const feedLimit = pageParam(params.feedPage) * pageSize;
  const gossipLimit = pageParam(params.gossipPage) * pageSize;
  const stuffLimit = pageParam(params.stuffPage) * pageSize;
  const merchLimit = pageParam(params.merchPage) * pageSize;
  const gigsLimit = pageParam(params.gigsPage) * pageSize;
  const loadMoreHref = (
    key: "feedPage" | "gigsPage" | "gossipPage" | "merchPage" | "stuffPage",
    currentLimit: number,
    hash: string,
  ) => {
    const nextPage = Math.floor(currentLimit / pageSize) + 1;
    const nextParams = new URLSearchParams();

    if (params.message) nextParams.set("message", params.message);
    if (params.feedPage && key !== "feedPage") {
      nextParams.set("feedPage", params.feedPage);
    }
    if (params.gossipPage && key !== "gossipPage") {
      nextParams.set("gossipPage", params.gossipPage);
    }
    if (params.stuffPage && key !== "stuffPage") {
      nextParams.set("stuffPage", params.stuffPage);
    }
    if (params.gigsPage && key !== "gigsPage") {
      nextParams.set("gigsPage", params.gigsPage);
    }
    if (params.merchPage && key !== "merchPage") {
      nextParams.set("merchPage", params.merchPage);
    }
    nextParams.set(key, String(nextPage));

    return `/?${nextParams.toString()}#${hash}`;
  };
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: currentProfile } = claims?.sub
    ? await supabase
        .from("profiles")
        .select(
        "id, username, display_name, avatar_url, account_type, city, country_code, preferred_language, location_personalization_enabled, adult_terms_accepted_at, is_adult_confirmed, license_verified_at, region, role, banned_at, suspended_at",
        )
        .eq("id", claims.sub)
        .maybeSingle<Profile>()
    : { data: null };

  const [
    { data: feedPosts },
    { data: threadPosts },
    { data: listings },
    { data: gigs },
    { data: merchProducts },
    { data: follows },
    { count: unreadDmCount },
    { data: savedItems },
    fourUAd,
    gossipAd,
    stuffAd,
  ] = await Promise.all([
    supabase
      .from("feed_posts")
      .select(
        "id, caption, style_tags, location_label, visibility, is_sensitive, created_at, feed_media(id, storage_bucket, storage_path, media_type, sort_order), post_likes(user_id), post_comments(id, deleted_at, post_comment_hides(hidden_by)), profiles:profiles!feed_posts_author_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
      )
      .eq("is_published", true)
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "feed_media",
      })
      .limit(feedLimit)
      .returns<FeedPost[]>(),
    supabase
      .from("thread_posts")
      .select(
        "id, body, visibility, is_sensitive, created_at, thread_media(id, storage_bucket, storage_path, media_type, sort_order), thread_likes(user_id), thread_comments(id, deleted_at, thread_comment_hides(hidden_by)), profiles:profiles!thread_posts_author_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
      )
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "thread_media",
      })
      .limit(gossipLimit)
      .returns<ThreadPost[]>(),
    supabase
      .from("marketplace_listings")
      .select(
        "id, title, description, price_cents, currency, category, city, region, visibility, is_sensitive, created_at, marketplace_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!marketplace_listings_seller_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
      )
      .eq("status", "active")
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "marketplace_media",
      })
      .limit(stuffLimit)
      .returns<MarketplaceListing[]>(),
    supabase
      .from("gigs")
      .select(
        "id, title, description, category, city, region, country, starts_at, ends_at, compensation, contact_url, visibility, is_sensitive, created_at, gig_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!gigs_poster_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
      )
      .eq("status", "active")
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "gig_media",
      })
      .limit(gigsLimit)
      .returns<Gig[]>(),
    supabase
      .from("merch_products")
      .select(
        "id, title, description, category, price_cents, currency, inventory_quantity, inventory_reserved, is_official, created_at, merch_product_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!merch_products_seller_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
      )
      .eq("status", "active")
      .eq("moderation_status", "active")
      .order("created_at", { ascending: false })
      .order("sort_order", {
        ascending: true,
        referencedTable: "merch_product_media",
      })
      .limit(merchLimit)
      .returns<MerchProduct[]>(),
    claims?.sub
      ? supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", claims.sub)
          .eq("status", "accepted")
          .returns<FollowedProfile[]>()
      : Promise.resolve({ data: [] as FollowedProfile[] }),
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
            "merch_product",
          ])
          .returns<SavedItem[]>()
      : Promise.resolve({ data: [] as SavedItem[] }),
    fetchSponsoredCampaign(supabase, "4u", currentProfile),
    fetchSponsoredCampaign(supabase, "gossip", currentProfile),
    fetchSponsoredCampaign(supabase, "stuff", currentProfile),
  ]);

  const isSignedIn = Boolean(claims?.sub);
  const viewer = {
    isAdultConfirmed: Boolean(
      currentProfile?.is_adult_confirmed &&
        currentProfile.adult_terms_accepted_at,
    ),
    isSignedIn,
  };
  const rankingContext = buildRankingContext({
    currentProfile: currentProfile ?? null,
    feedPosts: feedPosts ?? [],
    followedProfileIds: new Set((follows ?? []).map((follow) => follow.following_id)),
    gigs: gigs ?? [],
    listings: listings ?? [],
    merchProducts: merchProducts ?? [],
    savedItems: savedItems ?? [],
    threadPosts: threadPosts ?? [],
    userId: claims?.sub ?? null,
  });
  const visibleFeedPosts = rankFeedPosts(
    (feedPosts ?? []).filter((post) => canRenderContent(post, viewer)),
    rankingContext,
  );
  const visibleThreadPosts = rankThreadPosts(
    (threadPosts ?? []).filter((thread) => canRenderContent(thread, viewer)),
    rankingContext,
  );
  const visibleListings = rankCategoryItems(
    (listings ?? []).filter((listing) => canRenderContent(listing, viewer)),
    rankingContext,
    "marketplace_listing",
  );
  const visibleGigs = rankCategoryItems(
    (gigs ?? []).filter((gig) => canRenderContent(gig, viewer)),
    rankingContext,
    "gig",
  );
  const visibleMerchProducts = rankCategoryItems(
    (merchProducts ?? []).filter(
      (product) =>
        product.is_official || isVerifiedProfessional(product.profiles),
    ),
    rankingContext,
    "merch_product",
  );
  const lockedPublicItemCount = [
    ...(feedPosts ?? []),
    ...(threadPosts ?? []),
    ...(listings ?? []),
    ...(gigs ?? []),
  ].filter(
    (item) =>
      item.visibility !== "private" &&
      (!canRenderContent(item, viewer) || !canViewSensitiveContent(item, viewer)),
  ).length;
  const canCreate = Boolean(currentProfile);
  const canCreateStuff = isVerifiedProfessional(currentProfile);
  const adminRole = currentProfile?.role;
  const profileHref = currentProfile ? `/u/${currentProfile.username}` : "/account";
  const preferredLanguage = normalizedLanguage(currentProfile?.preferred_language);
  const unreadDmBadge = unreadDmCount ?? 0;
  const savedItemKeys = new Set(
    (savedItems ?? []).map((item) => `${item.subject_type}:${item.subject_id}`),
  );

  return (
    <main className="min-h-screen bg-[color-mix(in_srgb,var(--foreground)_90%,#202020)] text-[var(--foreground)]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[240px_minmax(420px,620px)_320px] lg:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <aside className="hidden border-r border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-5 py-6 lg:block">
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
                  [Package, "Merch", "#merch"],
                  [Send, "DM", "/messages"],
                  [Bookmark, "Saved", "/saved"],
                  [UserRound, "Profile", profileHref],
                ].map(([Icon, label, href]) => (
                  <Link
                    className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium hover:bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)]"
                    href={href as string}
                    key={label as string}
                  >
                    <Icon className="size-5" />
                    <span className="min-w-0 flex-1">{label as string}</span>
                    {label === "DM" && unreadDmBadge ? (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-[var(--foreground)] px-1.5 text-[10px] font-bold text-[var(--background)]">
                        {unreadDmBadge > 9 ? "9+" : unreadDmBadge}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </nav>

              {adminRole && ["moderator", "admin", "owner"].includes(adminRole) ? (
                <Link
                  className="mt-4 flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                  href="/admin"
                >
                  Admin
                </Link>
              ) : null}
              {isSignedIn ? <StuffAccessCard profile={currentProfile ?? null} /> : null}
            </div>

            <div className="mt-auto flex gap-3 pt-8 text-xs font-semibold text-[var(--muted-strong)]">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </aside>

        <section className="border-x border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] pb-52 lg:pb-0">
          <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center">
                <LogoLockup className="h-14 w-52 max-w-[52vw] shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <Link
                  aria-label="Search"
                  className="flex size-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)]"
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
              className="sticky top-0 z-20 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-4 py-3 text-sm font-semibold shadow-sm"
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

          {currentProfile ? (
            <LanguageStatus preferredLanguage={preferredLanguage} />
          ) : null}

          <StoriesRail />

          <ColumnSnapRail>
          <section
            className="min-w-full snap-start snap-always divide-y divide-[#e5ded4]"
            id="feed"
          >
            {visibleFeedPosts.length ? (
              visibleFeedPosts.map((post, index) => {
                const isPostLocked = !canViewSensitiveContent(post, viewer);
                const visiblePostComments = post.post_comments.filter(
                  (comment) =>
                    !comment.deleted_at && !hasCommentHide(comment.post_comment_hides),
                );

                return (
                <div key={post.id}>
                <article
                  className="scroll-mt-28 bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] shadow-[0_1px_0_rgba(23,20,18,0.06)]"
                  id={`feed-${post.id}`}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <Link
                      className="flex min-w-0 items-center gap-3"
                      href={`/u/${post.profiles?.username ?? "member"}`}
                    >
                      <ProfileAvatar profile={post.profiles} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">
                            {post.profiles?.display_name ??
                              "TheTattooCore member"}
                          </p>
                          <VerifiedBadge profile={post.profiles} />
                        </div>
                        <p className="text-xs text-[var(--muted-strong)]">
                          @{post.profiles?.username ?? "member"} -{" "}
                          {post.location_label ||
                            profileLocation(post.profiles) ||
                            "TattooCore"}{" "}
                          - {timeAgo(post.created_at)}
                        </p>
                      </div>
                    </Link>
                    {post.style_tags[0] ? (
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-2 py-1 text-xs font-medium">
                        {post.style_tags[0]}
                      </span>
                    ) : (
                      <ContentLabels
                        isSensitive={post.is_sensitive}
                        visibility={post.visibility}
                      />
                    )}
                  </div>

                  <MediaFrame
                    isLocked={isPostLocked}
                    isSignedIn={isSignedIn}
                    media={post.feed_media[0]}
                    returnPath={`/?message=18%2B%20terms%20accepted.#feed-${post.id}`}
                  />

                  <div className="space-y-3 px-4 py-4">
                    {isPostLocked ? (
                      <p className="rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] px-3 py-2 text-sm leading-6 text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]">
                        Sensitive non-nude body-art media is blurred until you
                        sign in and confirm 18+.
                      </p>
                    ) : null}
                    {post.style_tags[0] ? (
                      <ContentLabels
                        isSensitive={post.is_sensitive}
                        visibility={post.visibility}
                      />
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <form action={togglePostLike}>
                          <input name="post_id" type="hidden" value={post.id} />
                          <input name="return_path" type="hidden" value="/#feed" />
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
                                  ? "fill-[var(--gold)] text-[var(--gold)]"
                                  : ""
                              }`}
                            />
                            {post.post_likes.length}
                          </button>
                        </form>
                        <Link
                          className="flex items-center gap-2 text-sm font-medium"
                          href={`/p/${post.id}#comments`}
                        >
                          <MessageCircle className="size-5" />
                          {visiblePostComments.length}
                        </Link>
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
                      <div className="flex items-center gap-2">
                        <Link
                          className="flex h-9 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold"
                          href={`/p/${post.id}`}
                        >
                          Open
                        </Link>
                        <CompactShareButton
                          text={`Check this 4U post on ${siteName}`}
                          title="TheTattooCore 4U post"
                          url={`${siteUrl}/p/${post.id}`}
                        />
                      </div>
                    </div>
                    {isSignedIn ? (
                      <ContentReportForm
                        returnHash="feed"
                        returnPath="/"
                        subjectId={post.id}
                        subjectType="feed_post"
                      />
                    ) : null}
                    {!isPostLocked ? (
                      <p className="text-sm leading-6">{post.caption}</p>
                    ) : null}
                    <TranslationCue preferredLanguage={preferredLanguage} />
                    {post.profiles?.id === claims?.sub ? (
                      <details className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3">
                        <summary className="cursor-pointer text-sm font-bold">
                          Manage 4U post
                        </summary>
                        <form action={editFeedPost} className="mt-3 space-y-2">
                          <input name="post_id" type="hidden" value={post.id} />
                          <input name="return_path" type="hidden" value="/#feed" />
                          <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                            Caption
                            <textarea
                              className="mt-1 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
                              defaultValue={post.caption ?? ""}
                              maxLength={360}
                              name="caption"
                              placeholder="Edit your 4U caption"
                              rows={3}
                            />
                          </label>
                          <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                            Style tags
                            <input
                              className="mt-1 h-10 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                              defaultValue={post.style_tags.join(", ")}
                              maxLength={160}
                              name="style_tags"
                              placeholder="blackwork, fine line"
                            />
                          </label>
                          <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                            Location
                            <input
                              className="mt-1 h-10 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                              defaultValue={post.location_label ?? ""}
                              maxLength={80}
                              name="location_label"
                              placeholder="Austin, TX"
                            />
                          </label>
                          <button className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                            Save 4U edit
                          </button>
                        </form>
                        <form action={deleteFeedPost} className="mt-3">
                          <input name="post_id" type="hidden" value={post.id} />
                          <input name="return_path" type="hidden" value="/#feed" />
                          <button className="h-10 rounded-md border border-[color-mix(in_srgb,#ef4444_38%,var(--card-rim))] px-4 text-sm font-semibold">
                            Delete 4U post
                          </button>
                        </form>
                      </details>
                    ) : null}
                  </div>
                </article>
                {shouldShowSponsoredSlot(index, visibleFeedPosts.length) ? (
                  <SponsoredSlot campaign={fourUAd} placement="4u-feed" />
                ) : null}
                </div>
                );
              })
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
            {(feedPosts?.length ?? 0) >= feedLimit ? (
              <LoadMoreLink
                href={loadMoreHref("feedPage", feedLimit, "feed")}
                label="Load 25 more 4U posts"
              />
            ) : null}
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[var(--card-rim)] px-4 py-5"
            id="threads"
          >
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="size-5" />
              <h2 className="text-lg font-bold">Gossip</h2>
            </div>
            <div className="space-y-3">
              {visibleThreadPosts.length
                ? visibleThreadPosts.map((thread, index) => {
                    const isThreadLocked = !canViewSensitiveContent(thread, viewer);
                    const visibleThreadComments = thread.thread_comments.filter(
                      (comment) =>
                        !comment.deleted_at &&
                        !hasCommentHide(comment.thread_comment_hides),
                    );

                    return (
                    <div key={thread.id}>
                    <article
                      className="ttc-card scroll-mt-28 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4"
                      id={`thread-${thread.id}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Link
                          className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold hover:underline"
                          href={`/u/${thread.profiles?.username ?? "member"}`}
                        >
                          <ProfileAvatar profile={thread.profiles} size="sm" />
                          <span className="truncate">
                            {thread.profiles?.display_name ?? "Member"}
                          </span>
                          <VerifiedBadge profile={thread.profiles} />
                        </Link>
                        <div className="flex shrink-0 items-center gap-2">
                          <ContentLabels
                            isSensitive={thread.is_sensitive}
                            visibility={thread.visibility}
                          />
                          <p className="text-xs text-[var(--muted-strong)]">
                            {timeAgo(thread.created_at)}
                          </p>
                        </div>
                      </div>
                      {!isThreadLocked ? (
                        <p className="text-sm leading-6">{thread.body}</p>
                      ) : (
                        <p className="rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] px-3 py-2 text-sm leading-6 text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]">
                          Sensitive non-nude body-art discussion is hidden
                          until you sign in and confirm 18+.
                        </p>
                      )}
                      <TranslationCue preferredLanguage={preferredLanguage} />
                      <ThreadImage
                        isLocked={isThreadLocked}
                        isSignedIn={isSignedIn}
                        media={thread.thread_media[0]}
                        returnPath={`/?message=18%2B%20terms%20accepted.#thread-${thread.id}`}
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--card-rim)] pt-3">
                        <div className="flex flex-wrap items-center gap-4">
                          <form action={toggleThreadLike}>
                            <input
                              name="thread_id"
                              type="hidden"
                              value={thread.id}
                            />
                            <input
                              name="return_path"
                              type="hidden"
                              value="/#threads"
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
                                    ? "fill-[var(--gold)] text-[var(--gold)]"
                                    : ""
                                }`}
                              />
                              {thread.thread_likes.length}
                            </button>
                          </form>
                          <Link
                            className="flex items-center gap-2 text-sm font-medium"
                            href={`/t/${thread.id}#comments`}
                          >
                            <MessageCircle className="size-5" />
                            {visibleThreadComments.length}
                          </Link>
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
                        <div className="flex items-center gap-2">
                          <Link
                            className="flex h-9 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold"
                            href={`/t/${thread.id}`}
                          >
                            Open
                          </Link>
                          <CompactShareButton
                            text={`Check this Gossip thread on ${siteName}`}
                            title="TheTattooCore Gossip thread"
                            url={`${siteUrl}/t/${thread.id}`}
                          />
                        </div>
                      </div>
                      {isSignedIn ? (
                        <div className="mt-3">
                          <ContentReportForm
                            returnHash="threads"
                            returnPath="/"
                            subjectId={thread.id}
                            subjectType="thread_post"
                          />
                        </div>
                      ) : null}
                      {thread.profiles?.id === claims?.sub ? (
                        <details className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3">
                          <summary className="cursor-pointer text-sm font-bold">
                            Manage Gossip post
                          </summary>
                          <form action={editThreadPost} className="mt-3 space-y-2">
                            <input
                              name="thread_id"
                              type="hidden"
                              value={thread.id}
                            />
                            <input
                              name="return_path"
                              type="hidden"
                              value="/#threads"
                            />
                            <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                              Post
                              <textarea
                                className="mt-1 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
                                defaultValue={thread.body}
                                maxLength={8000}
                                name="body"
                                placeholder="Edit your Gossip post"
                                rows={5}
                              />
                            </label>
                            <button className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                              Save Gossip edit
                            </button>
                          </form>
                          <form action={deleteThreadPost} className="mt-3">
                            <input
                              name="thread_id"
                              type="hidden"
                              value={thread.id}
                            />
                            <input
                              name="return_path"
                              type="hidden"
                              value="/#threads"
                            />
                            <button className="h-10 rounded-md border border-[color-mix(in_srgb,#ef4444_38%,var(--card-rim))] px-4 text-sm font-semibold">
                              Delete Gossip post
                            </button>
                          </form>
                        </details>
                      ) : null}
                    </article>
                    {shouldShowSponsoredSlot(index, visibleThreadPosts.length) ? (
                      <SponsoredSlot campaign={gossipAd} placement="gossip-feed" />
                    ) : null}
                    </div>
                    );
                  })
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
            {(threadPosts?.length ?? 0) >= gossipLimit ? (
              <LoadMoreLink
                href={loadMoreHref("gossipPage", gossipLimit, "threads")}
                label="Load 25 more Gossip posts"
              />
            ) : null}
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[var(--card-rim)] px-4 py-5"
            id="marketplace"
          >
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag className="size-5" />
              <h2 className="text-lg font-bold">Stuff</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleListings.length
                ? visibleListings.map((listing, index) => {
                    const isListingLocked = !canViewSensitiveContent(listing, viewer);

                    return (
                    <div key={listing.id}>
                    <article
                      className="ttc-card scroll-mt-28 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4"
                      id={`stuff-${listing.id}`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <ListingThumb
                          isLocked={isListingLocked}
                          media={listing.marketplace_media[0]}
                        />
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
                            <p className="text-xs capitalize text-[var(--muted-strong)]">
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
                      {!isListingLocked ? (
                        <p className="line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                          {listing.description || "No description yet."}
                        </p>
                      ) : (
                        <p className="rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] px-3 py-2 text-sm leading-6 text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]">
                          Sensitive non-nude listing media is blurred until
                          login and 18+ confirmation.
                        </p>
                      )}
                      <p className="mt-3 text-xs text-[var(--muted-strong)]">
                        {[listing.city, listing.region].filter(Boolean).join(", ") ||
                          listing.profiles?.display_name ||
                          "TheTattooCore"}
                      </p>
                      <div className="mt-2">
                        <VerifiedBadge profile={listing.profiles} />
                      </div>
                      <p className="mt-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
                        Fans can browse. Seller contact, trades, purchases, and
                        professional equipment activity are verification-gated.
                      </p>
                      {isSignedIn ? (
                        <div className="mt-3">
                          <ContentReportForm
                            returnHash="marketplace"
                            returnPath="/"
                            subjectId={listing.id}
                            subjectType="marketplace_listing"
                          />
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-2">
                        {isSignedIn ? (
                          <SavedItemButton
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                            hash="marketplace"
                            isSaved={savedItemKeys.has(
                              `marketplace_listing:${listing.id}`,
                            )}
                            returnPath="/"
                            subjectId={listing.id}
                            subjectType="marketplace_listing"
                          />
                        ) : null}
                        <Link
                          className="flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                          href={`/stuff/${listing.id}`}
                        >
                          Open listing
                        </Link>
                        {listing.profiles?.id === claims?.sub ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                            href={`/stuff/${listing.id}`}
                          >
                            Manage listing
                          </Link>
                        ) : null}
                        <CompactShareButton
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                          text={`Check this Stuff listing on ${siteName}: ${listing.title}`}
                          title={listing.title}
                          url={`${siteUrl}/stuff/${listing.id}`}
                        />
                        {isSignedIn &&
                        canCreateStuff &&
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
                            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                              <Send className="size-4" />
                              DM seller
                            </button>
                          </form>
                        ) : isSignedIn && canCreateStuff ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                            href="/messages"
                          >
                            Open DM
                          </Link>
                        ) : isSignedIn ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                            href="/account#verification-settings"
                          >
                            Verify to contact
                          </Link>
                        ) : (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                            href="/login"
                          >
                            Sign in to message
                          </Link>
                        )}
                      </div>
                    </article>
                    {shouldShowSponsoredSlot(index, visibleListings.length) ? (
                      <SponsoredSlot campaign={stuffAd} placement="stuff-feed" />
                    ) : null}
                    </div>
                    );
                  })
                : (
                    <div className="sm:col-span-2">
                      <EmptyColumnState
                        actionHref={
                          !isSignedIn
                            ? "/login"
                            : canCreateStuff
                              ? undefined
                              : "/account#verification-settings"
                        }
                        actionLabel={
                          !isSignedIn
                            ? "Sign in to list stuff"
                            : canCreateStuff
                              ? "Tap + to list Stuff"
                              : "Verify to list Stuff"
                        }
                        body="Fans can browse. Verified artists, studios, and vendors can buy, sell, trade, contact sellers, and handle professional shop gear."
                        icon={ShoppingBag}
                        tips={["Flash", "Supplies", "Verified gear"]}
                        title="No Stuff listings yet"
                      />
                    </div>
                  )}
            </div>
            {(listings?.length ?? 0) >= stuffLimit ? (
              <LoadMoreLink
                href={loadMoreHref("stuffPage", stuffLimit, "marketplace")}
                label="Load 25 more Stuff listings"
              />
            ) : null}
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[var(--card-rim)] px-4 py-5"
            id="gigs"
          >
            <div className="mb-4 flex items-center gap-2">
              <BriefcaseBusiness className="size-5" />
              <h2 className="text-lg font-bold">Gigs</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleGigs.length
                ? visibleGigs.map((gig) => {
                    const isGigLocked = !canViewSensitiveContent(gig, viewer);

                    return (
                    <article
                      className="ttc-card scroll-mt-28 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4"
                      id={`gig-${gig.id}`}
                      key={gig.id}
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <ListingThumb
                          isLocked={isGigLocked}
                          media={gig.gig_media[0]}
                        />
                        <div className="min-w-0">
                          <Link
                            className="text-sm font-semibold hover:underline"
                            href={`/gigs/${gig.id}`}
                          >
                            {gig.title}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <p className="text-xs capitalize text-[var(--muted-strong)]">
                              {formatGigCategory(gig.category)}
                            </p>
                            <ContentLabels
                              isSensitive={gig.is_sensitive}
                              visibility={gig.visibility}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--muted-strong)]">
                        <span className="flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-2 py-1">
                          <CalendarDays className="size-3.5" />
                          {formatGigDate(gig)}
                        </span>
                        <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-2 py-1">
                          {[gig.city, gig.region].filter(Boolean).join(", ") ||
                            gig.country ||
                            "Remote / open"}
                        </span>
                      </div>
                      {!isGigLocked ? (
                        <p className="line-clamp-4 text-sm leading-6 text-[var(--muted)]">
                          {gig.description || "No details yet."}
                        </p>
                      ) : (
                        <p className="rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] px-3 py-2 text-sm leading-6 text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]">
                          Sensitive non-nude gig media is blurred until login
                          and 18+ confirmation.
                        </p>
                      )}
                      {gig.compensation ? (
                        <p className="mt-3 text-sm font-semibold">
                          {gig.compensation}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs text-[var(--muted-strong)]">
                        Posted by{" "}
                        {gig.profiles?.display_name ?? "TheTattooCore member"} -{" "}
                        {timeAgo(gig.created_at)}
                      </p>
                      <div className="mt-2">
                        <VerifiedBadge profile={gig.profiles} />
                      </div>
                      {isSignedIn ? (
                        <div className="mt-3">
                          <ContentReportForm
                            returnHash="gigs"
                            returnPath="/"
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
                          <button className="flex h-9 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold">
                            Archive gig
                          </button>
                        </form>
                      ) : null}
                      <div className="mt-4 grid gap-2">
                        {isSignedIn ? (
                          <SavedItemButton
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                            hash="gigs"
                            isSaved={savedItemKeys.has(`gig:${gig.id}`)}
                            returnPath="/"
                            subjectId={gig.id}
                            subjectType="gig"
                          />
                        ) : null}
                        <Link
                          className="flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                          href={`/gigs/${gig.id}`}
                        >
                          Open gig
                        </Link>
                        {gig.profiles?.id === claims?.sub ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                            href={`/gigs/${gig.id}`}
                          >
                            Manage gig
                          </Link>
                        ) : null}
                        <CompactShareButton
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                          text={`Check this Gig on ${siteName}: ${gig.title}`}
                          title={gig.title}
                          url={`${siteUrl}/gigs/${gig.id}`}
                        />
                        {gig.contact_url ? (
                          <a
                            className="flex h-10 w-full items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
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
                            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                              <Send className="size-4" />
                              DM poster
                            </button>
                          </form>
                        ) : (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                            href={isSignedIn ? "/messages" : "/login"}
                          >
                            {isSignedIn ? "Open DM" : "Sign in to respond"}
                          </Link>
                        )}
                      </div>
                    </article>
                    );
                  })
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
            {(gigs?.length ?? 0) >= gigsLimit ? (
              <LoadMoreLink
                href={loadMoreHref("gigsPage", gigsLimit, "gigs")}
                label="Load 25 more Gigs"
              />
            ) : null}
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[var(--card-rim)] px-4 py-5"
            id="merch"
          >
            <div className="mb-4 flex items-center gap-2">
              <Package className="size-5" />
              <h2 className="text-lg font-bold">Merch</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleMerchProducts.length ? (
                visibleMerchProducts.map((product) => {
                  const available =
                    product.inventory_quantity - product.inventory_reserved;

                  return (
                    <article
                      className="ttc-card scroll-mt-28 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4"
                      id={`merch-${product.id}`}
                      key={product.id}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <ListingThumb media={product.merch_product_media[0]} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            <Link
                              className="hover:underline"
                              href={`/merch/${product.id}`}
                            >
                              {product.title}
                            </Link>
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <p className="text-xs capitalize text-[var(--muted-strong)]">
                              {product.category.replaceAll("_", " ")}
                            </p>
                            {product.is_official ? (
                              <span className="rounded-md bg-[var(--foreground)] px-2 py-1 text-xs font-semibold text-[var(--background)]">
                                Official TTC
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <p className="mb-2 text-lg font-bold">
                        {new Intl.NumberFormat("en-US", {
                          currency: product.currency,
                          style: "currency",
                        }).format(product.price_cents / 100)}
                      </p>
                      <p className="line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                        {product.description || "No description yet."}
                      </p>
                      <p className="mt-3 text-xs text-[var(--muted-strong)]">
                        {available > 0
                          ? `${Intl.NumberFormat("en-US").format(available)} available`
                          : "Sold out"}
                      </p>
                      <div className="mt-2">
                        <VerifiedBadge profile={product.profiles} />
                      </div>
                      <div className="mt-4 grid gap-2">
                        <Link
                          className="flex h-10 w-full items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                          href={`/merch/${product.id}`}
                        >
                          Open merch
                        </Link>
                        {product.profiles?.id === claims?.sub ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                            href={`/merch/${product.id}`}
                          >
                            Manage merch
                          </Link>
                        ) : null}
                        {isSignedIn ? (
                          <SavedItemButton
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                            hash="merch"
                            isSaved={savedItemKeys.has(
                              `merch_product:${product.id}`,
                            )}
                            returnPath="/"
                            subjectId={product.id}
                            subjectType="merch_product"
                          />
                        ) : null}
                        <CompactShareButton
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                          text={`Check this Merch on ${siteName}: ${product.title}`}
                          title={product.title}
                          url={`${siteUrl}/merch/${product.id}`}
                        />
                        {isSignedIn && product.profiles?.id !== claims?.sub ? (
                          <ContentReportForm
                            returnHash="merch"
                            returnPath="/"
                            subjectId={product.id}
                            subjectType="merch_product"
                          />
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="sm:col-span-2">
                  <EmptyColumnState
                    actionHref={isSignedIn ? undefined : "/login"}
                    actionLabel={isSignedIn ? "Approval-only" : "Sign in"}
                    body="Artist shirts, prints, art, stickers, vendor brand goods, and official TheTattooCore merchandise will live here. Merch is public-buyable, separate from verified-only Stuff, and checkout is in test mode."
                    icon={Package}
                    tips={["T-shirts", "Prints", "TTC merch"]}
                    title="No Merch yet"
                  />
                </div>
              )}
            </div>
            {(merchProducts?.length ?? 0) >= merchLimit ? (
              <LoadMoreLink
                href={loadMoreHref("merchPage", merchLimit, "merch")}
                label="Load 25 more Merch products"
              />
            ) : null}
            <div className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm leading-6 text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">
                Why Merch is separate from Stuff
              </p>
              <p className="mt-1">
                Stuff is for professional body-art goods, trade, and seller
                contact that need verification. Merch is for safe fan-facing
                brand products the public can buy after production seller
                approval, shipping, taxes, refunds, and fulfillment rules are ready.
              </p>
            </div>
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[var(--card-rim)] px-4 py-5"
            id="messages"
          >
            <div className="mb-4 flex items-center gap-2">
              <Send className="size-5" />
              <h2 className="text-lg font-bold">DM</h2>
            </div>
            <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-4 text-sm leading-6 text-[var(--muted)]">
              DMs are live. Start conversations, view your inbox,
              and reply from the dedicated messenger.
              <Link
                className="mt-3 flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                href="/messages"
              >
                <Send className="size-4" />
                Open DM
              </Link>
            </div>
          </section>
          </ColumnSnapRail>
        </section>

        <aside className="hidden bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-5 py-6 lg:block">
          <div className="mb-6">
            <Link
              className="flex items-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 shadow-sm"
              href="/search"
            >
              <Search className="size-4 text-[var(--muted-strong)]" />
              <span className="text-sm text-[var(--muted-strong)]">
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
                  <Link
                    className="ttc-card block rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3 text-sm leading-5"
                    href={`/t/${thread.id}`}
                    key={thread.id}
                  >
                    {thread.body}
                  </Link>
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
                    className="ttc-card block rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                    href={`/gigs/${gig.id}`}
                    key={gig.id}
                  >
                    <p className="text-sm font-semibold">{gig.title}</p>
                    <p className="mt-1 text-xs capitalize text-[var(--muted-strong)]">
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
                  <Link
                    className="ttc-card block rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                    href={`/stuff/${listing.id}`}
                    key={listing.id}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <ListingThumb media={listing.marketplace_media[0]} />
                      <div>
                        <p className="text-sm font-semibold">{listing.title}</p>
                        <p className="text-xs capitalize text-[var(--muted-strong)]">
                          {listing.category}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{formatPrice(listing)}</p>
                  </Link>
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
      <FloatingComposer
        canCreate={canCreate}
        canCreateStuff={canCreateStuff}
        isSignedIn={isSignedIn}
      />
    </main>
  );
}

