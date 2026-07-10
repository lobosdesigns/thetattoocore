import Link from "next/link";
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
  blockPostCommentAuthor,
  blockThreadCommentAuthor,
  createPostComment,
  createThreadComment,
  deletePostComment,
  deleteThreadComment,
  editPostComment,
  editThreadComment,
  hidePostComment,
  hideThreadComment,
  togglePostCommentLike,
  togglePostLike,
  toggleThreadCommentLike,
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
import { PendingSubmitButton } from "./pending-submit-button";
import { ProfileAvatar } from "./profile-avatar";
import { SavedItemButton } from "./saved-item-button";
import { SensitiveContentGate } from "./sensitive-content-gate";
import { CompactShareButton } from "./share-actions";
import { WordLimitedField } from "./word-limited-field";
import { languageLabel, normalizedLanguage } from "@/lib/localization";
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
  deleted_at: string | null;
  parent_id: string | null;
  post_comment_hides: { hidden_by: string }[] | { hidden_by: string } | null;
  post_comment_likes: PostLike[];
  created_at: string;
  profiles: Pick<Profile, "avatar_url" | "display_name" | "id" | "username"> | null;
};

type ThreadLike = {
  user_id: string;
};

type ThreadComment = {
  id: string;
  body: string;
  deleted_at: string | null;
  parent_id: string | null;
  thread_comment_hides: { hidden_by: string }[] | { hidden_by: string } | null;
  thread_comment_likes: ThreadLike[];
  created_at: string;
  profiles: Pick<Profile, "avatar_url" | "display_name" | "id" | "username"> | null;
};

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

function CardCommentControls({
  body,
  commentAuthorId,
  commentId,
  contentOwnerId,
  currentUserId,
  kind,
  returnHash,
  returnPath,
}: {
  body: string;
  commentAuthorId?: string | null;
  commentId: string;
  contentOwnerId?: string | null;
  currentUserId?: string | null;
  kind: "feed" | "thread";
  returnHash: "feed" | "threads";
  returnPath: string;
}) {
  if (!currentUserId) return null;

  const isOwnComment = commentAuthorId === currentUserId;
  const canModerateComment = contentOwnerId === currentUserId && !isOwnComment;

  if (!isOwnComment && !canModerateComment) {
    return (
      <ContentReportForm
        returnHash={returnHash}
        returnPath="/"
        subjectId={commentId}
        subjectType="comment"
      />
    );
  }

  const editAction = kind === "feed" ? editPostComment : editThreadComment;
  const deleteAction = kind === "feed" ? deletePostComment : deleteThreadComment;
  const hideAction = kind === "feed" ? hidePostComment : hideThreadComment;
  const blockAction =
    kind === "feed" ? blockPostCommentAuthor : blockThreadCommentAuthor;

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {isOwnComment ? (
        <details className="group min-w-[13rem] max-w-full">
          <summary className="cursor-pointer list-none rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold text-[#4f473f] transition group-open:border-[#c8953b] group-open:bg-[#fff7ec]">
            Edit
          </summary>
          <form
            action={editAction}
            className="mt-2 grid min-w-0 gap-2 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-2 shadow-[0_10px_24px_rgba(23,20,18,0.12)]"
          >
            <input name="comment_id" type="hidden" value={commentId} />
            <input name="return_path" type="hidden" value={returnPath} />
            {kind === "feed" ? (
              <input
                className="h-9 min-w-0 rounded-md border border-[#d8d1c6] bg-white px-2 text-xs outline-none focus:border-[#171412]"
                defaultValue={body}
                maxLength={300}
                name="body"
                required
              />
            ) : (
              <textarea
                className="min-h-20 min-w-0 rounded-md border border-[#d8d1c6] bg-white px-2 py-2 text-xs outline-none focus:border-[#171412]"
                defaultValue={body}
                maxLength={2000}
                name="body"
                required
              />
            )}
            <PendingSubmitButton
              className="h-8 rounded-md bg-[#171412] px-3 text-xs font-semibold text-white"
              pendingChildren="Saving..."
            >
              Save edit
            </PendingSubmitButton>
          </form>
        </details>
      ) : null}
      {isOwnComment || canModerateComment ? (
        <form action={deleteAction}>
          <input name="comment_id" type="hidden" value={commentId} />
          <input name="return_path" type="hidden" value={returnPath} />
          <PendingSubmitButton
            className="rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold text-[#7a2d1f]"
            pendingChildren="Deleting..."
          >
            Delete
          </PendingSubmitButton>
        </form>
      ) : null}
      {canModerateComment ? (
        <>
          <form action={hideAction}>
            <input name="comment_id" type="hidden" value={commentId} />
            <input name="return_path" type="hidden" value={returnPath} />
            <input name="reason" type="hidden" value="Hidden by post owner." />
            <PendingSubmitButton
              className="rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold text-[#4f473f]"
              pendingChildren="Hiding..."
            >
              Hide
            </PendingSubmitButton>
          </form>
          <form action={blockAction}>
            <input name="comment_id" type="hidden" value={commentId} />
            <input name="return_path" type="hidden" value={returnPath} />
            <PendingSubmitButton
              className="rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold text-[#7a2d1f]"
              pendingChildren="Blocking..."
            >
              Block
            </PendingSubmitButton>
          </form>
        </>
      ) : null}
      {!isOwnComment ? (
        <ContentReportForm
          returnHash={returnHash}
          returnPath="/"
          subjectId={commentId}
          subjectType="comment"
        />
      ) : null}
    </div>
  );
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
      ? "border-[#b9d7bd] bg-[#eef8ef]"
      : status.tone === "danger"
        ? "border-[#e5b8b8] bg-[#fff0f0]"
        : status.tone === "warning"
          ? "border-[#e5c58f] bg-[#fff7ec]"
          : "border-[#d8d1c6] bg-white";

  return (
    <section className={`mt-4 rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-[#766d62]">
        Stuff access
      </p>
      <h2 className="mt-1 text-sm font-bold">{status.title}</h2>
      <p className="mt-1 text-xs leading-5 text-[#4f473f]">{status.body}</p>
      <Link
        className="mt-3 inline-flex h-8 items-center rounded-md bg-[#171412] px-3 text-xs font-semibold text-white"
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
  const location = [campaign.city, campaign.region, campaign.country_code]
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
    <article className="ttc-card rounded-md border border-[#c8953b]/60 bg-[#171412] p-4 text-white shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
      <AdImpressionBeacon campaignId={campaign.id} placement={dbPlacement} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c8953b]">
            {sponsoredSlotTitle(placement)}
          </p>
          <h3 className="mt-2 text-base font-bold">{campaign.title}</h3>
        </div>
        <span className="shrink-0 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold">
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
            className="rounded-md bg-[#c8953b]/20 px-2 py-1 text-xs font-semibold text-[#f8d28b]"
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
        <span className="shrink-0 text-sm font-bold text-[#c8953b]">
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
      <div className="flex aspect-[4/3] items-center justify-center bg-[#171412] text-white">
        <div className="text-center">
          <ImageIcon className="mx-auto mb-2 size-10 opacity-80" />
          <p className="text-sm font-semibold">No media attached</p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="relative overflow-hidden bg-[#171412]">
        <div className="flex aspect-[4/5] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-white">
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
        <video
          className="aspect-[4/5] w-full bg-[#171412] object-cover"
          controls
          playsInline
          preload="metadata"
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
      <div className="flex size-11 items-center justify-center rounded-md bg-[#efe7da]">
        <ImageIcon className="size-5" />
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="relative size-11 overflow-hidden rounded-md bg-[#171412] text-white">
        <div className="flex size-full items-center justify-center bg-[#171412] blur-[1px]">
          <LockKeyhole className="size-5 opacity-70" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-[#171412]/55">
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
        <div className="flex size-11 items-center justify-center rounded-md bg-[#171412] text-white">
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
      <div className="relative mt-3 overflow-hidden rounded-md border border-[#e5ded4] bg-[#171412]">
        <div className="flex aspect-[16/10] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-white">
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
        className="mt-3 aspect-[16/10] rounded-md border border-[#e5ded4] bg-cover bg-center"
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
          <p className="text-sm font-bold">18+ sensitive body-art content</p>
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
            or 18+ sensitive body-art content.
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

function StoriesRail() {
  const items = [
    ["Artists", ImageIcon],
    ["Studios", HomeIcon],
    ["Vendors", ShoppingBag],
    ["Events", CalendarDays],
  ] as const;

  return (
    <section
      aria-label="Stories"
      className="border-b border-[#d8d1c6] bg-[#fffdf9] px-4 py-3"
    >
      <div className="no-scrollbar flex gap-3 overflow-x-auto">
        <div className="flex h-16 min-w-20 flex-col items-center justify-center rounded-md border border-dashed border-[#c8953b] bg-[#fff7ec] px-3 text-center">
          <Sparkles className="size-4 text-[#c8953b]" />
          <span className="mt-1 text-[11px] font-bold text-[#4f473f]">
            Stories
          </span>
        </div>
        {items.map(([label, Icon]) => (
          <div
            className="flex h-16 min-w-20 flex-col items-center justify-center rounded-md border border-[#e5ded4] bg-white px-3 text-center"
            key={label}
          >
            <Icon className="size-4 text-[#766d62]" />
            <span className="mt-1 text-[11px] font-semibold text-[#4f473f]">
              {label}
            </span>
            <span className="text-[10px] font-semibold uppercase text-[#766d62]">
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

function LanguageStatus({ preferredLanguage }: { preferredLanguage: string }) {
  const label = languageLabel(preferredLanguage);

  return <LanguageStatusBanner label={label} />;
}

function TranslationCue({ preferredLanguage }: { preferredLanguage: string }) {
  if (preferredLanguage === "en") return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#766d62]">
      <span className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 py-1">
        Original text
      </span>
      <span className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 py-1">
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
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
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
    { count: unreadDmCount },
    { data: savedItems },
    fourUAd,
    gossipAd,
    stuffAd,
  ] = await Promise.all([
    supabase
      .from("feed_posts")
      .select(
        "id, caption, style_tags, location_label, visibility, is_sensitive, created_at, feed_media(id, storage_bucket, storage_path, media_type, sort_order), post_likes(user_id), post_comments(id, body, parent_id, deleted_at, created_at, post_comment_hides(hidden_by), post_comment_likes(user_id), profiles:profiles!post_comments_author_id_fkey(id, avatar_url, display_name, username)), profiles:profiles!feed_posts_author_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
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
        "id, body, visibility, is_sensitive, created_at, thread_media(id, storage_bucket, storage_path, media_type, sort_order), thread_likes(user_id), thread_comments(id, body, parent_id, deleted_at, created_at, thread_comment_hides(hidden_by), thread_comment_likes(user_id), profiles:profiles!thread_comments_author_id_fkey(id, avatar_url, display_name, username)), profiles:profiles!thread_posts_author_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
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
        "id, title, description, price_cents, currency, category, city, region, visibility, is_sensitive, created_at, marketplace_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!marketplace_listings_seller_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
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
        "id, title, description, category, city, region, country, starts_at, ends_at, compensation, contact_url, visibility, is_sensitive, created_at, gig_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!gigs_poster_id_fkey(id, username, display_name, avatar_url, account_type, city, license_verified_at, region)",
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
              {isSignedIn ? <StuffAccessCard profile={currentProfile ?? null} /> : null}
            </div>

            <div className="mt-auto flex gap-3 pt-8 text-xs font-semibold text-[#766d62]">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </aside>

        <section className="border-x border-[#cfc8bd] bg-[#f2f1ee] pb-52 lg:pb-0">
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
                  className="scroll-mt-28 bg-[#fffdf9] shadow-[0_1px_0_rgba(23,20,18,0.06)]"
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

                  <MediaFrame
                    isLocked={isPostLocked}
                    isSignedIn={isSignedIn}
                    media={post.feed_media[0]}
                    returnPath={`/?message=18%2B%20terms%20accepted.#feed-${post.id}`}
                  />

                  <div className="space-y-3 px-4 py-4">
                    {isPostLocked ? (
                      <p className="rounded-md border border-[#e5c58f] bg-[#fff7ec] px-3 py-2 text-sm leading-6 text-[#7a4a08]">
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
                          {visiblePostComments.length}
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
                      <div className="flex items-center gap-2">
                        <Link
                          className="flex h-9 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-3 text-sm font-semibold"
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
                    {!isPostLocked && visiblePostComments.length ? (
                      <div className="space-y-2 border-t border-[#e5ded4] pt-3">
                        {visiblePostComments
                          .filter((comment) => !comment.parent_id)
                          .slice(0, 2)
                          .map((comment) => {
                            const likedComment = comment.post_comment_likes.some(
                              (like) => like.user_id === claims?.sub,
                            );
                            const replies = post.post_comments
                              .filter((reply) => reply.parent_id === comment.id)
                              .filter(
                                (reply) =>
                                  !reply.deleted_at &&
                                  !hasCommentHide(reply.post_comment_hides),
                              )
                              .slice(0, 2);

                            return (
                          <div className="space-y-2" key={comment.id}>
                          <div className="flex items-start gap-2 text-sm leading-5">
                            <ProfileAvatar profile={comment.profiles} size="sm" />
                            <span className="min-w-0 flex-1">
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
                            </span>
                          </div>
                          <div className="ml-9 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#766d62]">
                            <form action={togglePostCommentLike}>
                              <input name="comment_id" type="hidden" value={comment.id} />
                              <input name="liked" type="hidden" value={likedComment ? "true" : "false"} />
                              <input name="return_path" type="hidden" value="/#feed" />
                              <button className="flex items-center gap-1">
                                <Heart className={`size-3.5 ${likedComment ? "fill-[#c8953b] text-[#c8953b]" : ""}`} />
                                {comment.post_comment_likes.length}
                              </button>
                            </form>
                            {canCreate ? (
                              <details>
                                <summary className="cursor-pointer list-none">Reply</summary>
                                <form action={createPostComment} className="mt-2 flex items-start gap-2">
                                  <input name="post_id" type="hidden" value={post.id} />
                                  <input name="parent_id" type="hidden" value={comment.id} />
                                  <input name="return_path" type="hidden" value="/#feed" />
                                  <WordLimitedField
                                    className="h-9 w-full rounded-md border border-[#d8d1c6] bg-white px-2 text-xs outline-none focus:border-[#171412]"
                                    emojiShortcuts
                                    maxLength={300}
                                    maxWords={40}
                                    minTrimmedLength={1}
                                    name="body"
                                    placeholder="Reply"
                                    required
                                    validationMessage="Reply cannot be empty."
                                  />
                                  <PendingSubmitButton
                                    aria-label="Post reply"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white"
                                    pendingChildren={<LoaderCircle className="size-4 animate-spin" />}
                                  >
                                    <Send className="size-4" />
                                  </PendingSubmitButton>
                                </form>
                              </details>
                            ) : null}
                            <CardCommentControls
                              body={comment.body}
                              commentAuthorId={comment.profiles?.id}
                              commentId={comment.id}
                              contentOwnerId={post.profiles?.id}
                              currentUserId={claims?.sub}
                              kind="feed"
                              returnHash="feed"
                              returnPath="/#feed"
                            />
                          </div>
                          {replies.length ? (
                            <div className="ml-9 space-y-1 border-l border-[#e5ded4] pl-3">
                              {replies.map((reply) => {
                                const likedReply = reply.post_comment_likes.some(
                                  (like) => like.user_id === claims?.sub,
                                );

                                return (
                                  <div
                                    className="space-y-1 text-xs leading-5 text-[#4f473f]"
                                    key={reply.id}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="min-w-0 flex-1">
                                        <span className="font-semibold">
                                          {reply.profiles?.display_name ?? "Member"}
                                        </span>{" "}
                                        {reply.body}
                                      </p>
                                      <form action={togglePostCommentLike}>
                                        <input name="comment_id" type="hidden" value={reply.id} />
                                        <input name="liked" type="hidden" value={likedReply ? "true" : "false"} />
                                        <input name="return_path" type="hidden" value="/#feed" />
                                        <button className="flex items-center gap-1 font-semibold text-[#766d62]">
                                          <Heart className={`size-3 ${likedReply ? "fill-[#c8953b] text-[#c8953b]" : ""}`} />
                                          {reply.post_comment_likes.length}
                                        </button>
                                      </form>
                                    </div>
                                    <CardCommentControls
                                      body={reply.body}
                                      commentAuthorId={reply.profiles?.id}
                                      commentId={reply.id}
                                      contentOwnerId={post.profiles?.id}
                                      currentUserId={claims?.sub}
                                      kind="feed"
                                      returnHash="feed"
                                      returnPath="/#feed"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                          </div>
                            );
                          })}
                      </div>
                    ) : null}
                    {canCreate ? (
                      <form
                        action={createPostComment}
                        className="border-t border-[#e5ded4] pb-24 pt-3 sm:pb-3"
                        id={`comment-${post.id}`}
                      >
                        <input name="post_id" type="hidden" value={post.id} />
                        <input name="return_path" type="hidden" value="/#feed" />
                        <div className="flex items-start gap-2">
                          <WordLimitedField
                            className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                            emojiShortcuts
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
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[#e5ded4] px-4 py-5"
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
                      className="ttc-card scroll-mt-28 rounded-md border border-[#cfc8bd] bg-white p-4"
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
                          <p className="text-xs text-[#766d62]">
                            {timeAgo(thread.created_at)}
                          </p>
                        </div>
                      </div>
                      {!isThreadLocked ? (
                        <p className="text-sm leading-6">{thread.body}</p>
                      ) : (
                        <p className="rounded-md border border-[#e5c58f] bg-[#fff7ec] px-3 py-2 text-sm leading-6 text-[#7a4a08]">
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
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5ded4] pt-3">
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
                            {visibleThreadComments.length}
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
                        <div className="flex items-center gap-2">
                          <Link
                            className="flex h-9 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-3 text-sm font-semibold"
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
                      {visibleThreadComments.length ? (
                        <div className="mt-3 space-y-2">
                          {visibleThreadComments
                            .filter((comment) => !comment.parent_id)
                            .slice(0, 2)
                            .map((comment) => {
                              const likedComment = comment.thread_comment_likes.some(
                                (like) => like.user_id === claims?.sub,
                              );
                              const replies = thread.thread_comments
                                .filter((reply) => reply.parent_id === comment.id)
                                .filter(
                                  (reply) =>
                                    !reply.deleted_at &&
                                    !hasCommentHide(reply.thread_comment_hides),
                                )
                                .slice(0, 2);

                              return (
                                <div
                                  className="rounded-md bg-[#f7f4ef] px-3 py-2"
                                  key={comment.id}
                                >
                                  <div className="flex items-start gap-2 text-sm leading-5">
                                    <ProfileAvatar
                                      profile={comment.profiles}
                                      size="sm"
                                    />
                                    <span className="min-w-0 flex-1">
                                      {comment.profiles?.username ? (
                                        <Link
                                          className="font-semibold hover:underline"
                                          href={`/u/${comment.profiles.username}`}
                                        >
                                          {comment.profiles.display_name ??
                                            "Member"}
                                        </Link>
                                      ) : (
                                        <span className="font-semibold">
                                          Member
                                        </span>
                                      )}{" "}
                                      {comment.body}
                                    </span>
                                  </div>
                                  <div className="ml-9 mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#766d62]">
                                    <form action={toggleThreadCommentLike}>
                                      <input
                                        name="comment_id"
                                        type="hidden"
                                        value={comment.id}
                                      />
                                      <input
                                        name="liked"
                                        type="hidden"
                                        value={likedComment ? "true" : "false"}
                                      />
                                      <input
                                        name="return_path"
                                        type="hidden"
                                        value="/#threads"
                                      />
                                      <button className="flex items-center gap-1">
                                        <Heart
                                          className={`size-3.5 ${
                                            likedComment
                                              ? "fill-[#c8953b] text-[#c8953b]"
                                              : ""
                                          }`}
                                        />
                                        {comment.thread_comment_likes.length}
                                      </button>
                                    </form>
                                    {canCreate ? (
                                      <details>
                                        <summary className="cursor-pointer list-none">
                                          Reply
                                        </summary>
                                        <form
                                          action={createThreadComment}
                                          className="mt-2 flex items-start gap-2"
                                        >
                                          <input
                                            name="thread_id"
                                            type="hidden"
                                            value={thread.id}
                                          />
                                          <input
                                            name="parent_id"
                                            type="hidden"
                                            value={comment.id}
                                          />
                                          <input
                                            name="return_path"
                                            type="hidden"
                                            value="/#threads"
                                          />
                                          <WordLimitedField
                                            className="h-9 w-full rounded-md border border-[#d8d1c6] bg-white px-2 text-xs outline-none focus:border-[#171412]"
                                            emojiShortcuts
                                            maxCharacters={2000}
                                            maxLength={2000}
                                            minTrimmedLength={1}
                                            name="body"
                                            placeholder="Reply"
                                            required
                                            validationMessage="Reply cannot be empty."
                                          />
                                          <PendingSubmitButton
                                            aria-label="Post reply"
                                            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white"
                                            pendingChildren={
                                              <LoaderCircle className="size-4 animate-spin" />
                                            }
                                          >
                                            <Send className="size-4" />
                                          </PendingSubmitButton>
                                        </form>
                                      </details>
                                    ) : null}
                                    <CardCommentControls
                                      body={comment.body}
                                      commentAuthorId={comment.profiles?.id}
                                      commentId={comment.id}
                                      contentOwnerId={thread.profiles?.id}
                                      currentUserId={claims?.sub}
                                      kind="thread"
                                      returnHash="threads"
                                      returnPath="/#threads"
                                    />
                                  </div>
                                  {replies.length ? (
                                    <div className="ml-9 mt-2 space-y-1 border-l border-[#e5ded4] pl-3">
                                      {replies.map((reply) => {
                                        const likedReply =
                                          reply.thread_comment_likes.some(
                                            (like) => like.user_id === claims?.sub,
                                          );

                                        return (
                                          <div
                                            className="space-y-1 text-xs leading-5 text-[#4f473f]"
                                            key={reply.id}
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="min-w-0 flex-1">
                                                <span className="font-semibold">
                                                  {reply.profiles?.display_name ??
                                                    "Member"}
                                                </span>{" "}
                                                {reply.body}
                                              </p>
                                              <form action={toggleThreadCommentLike}>
                                                <input name="comment_id" type="hidden" value={reply.id} />
                                                <input name="liked" type="hidden" value={likedReply ? "true" : "false"} />
                                                <input name="return_path" type="hidden" value="/#threads" />
                                                <button className="flex items-center gap-1 font-semibold text-[#766d62]">
                                                  <Heart className={`size-3 ${likedReply ? "fill-[#c8953b] text-[#c8953b]" : ""}`} />
                                                  {reply.thread_comment_likes.length}
                                                </button>
                                              </form>
                                            </div>
                                            <CardCommentControls
                                              body={reply.body}
                                              commentAuthorId={reply.profiles?.id}
                                              commentId={reply.id}
                                              contentOwnerId={thread.profiles?.id}
                                              currentUserId={claims?.sub}
                                              kind="thread"
                                              returnHash="threads"
                                              returnPath="/#threads"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                        </div>
                      ) : null}
                      {canCreate ? (
                        <form
                          action={createThreadComment}
                          className="mt-3 pb-24 sm:pb-0"
                          id={`thread-comment-${thread.id}`}
                        >
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
                          <div className="flex items-start gap-2">
                            <WordLimitedField
                              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                              emojiShortcuts
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
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[#e5ded4] px-4 py-5"
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
                      className="ttc-card scroll-mt-28 rounded-md border border-[#cfc8bd] bg-white p-4"
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
                      {!isListingLocked ? (
                        <p className="line-clamp-3 text-sm leading-6 text-[#4f473f]">
                          {listing.description || "No description yet."}
                        </p>
                      ) : (
                        <p className="rounded-md border border-[#e5c58f] bg-[#fff7ec] px-3 py-2 text-sm leading-6 text-[#7a4a08]">
                          Sensitive non-nude listing media is blurred until
                          login and 18+ confirmation.
                        </p>
                      )}
                      <p className="mt-3 text-xs text-[#766d62]">
                        {[listing.city, listing.region].filter(Boolean).join(", ") ||
                          listing.profiles?.display_name ||
                          "TheTattooCore"}
                      </p>
                      <div className="mt-2">
                        <VerifiedBadge profile={listing.profiles} />
                      </div>
                      <p className="mt-2 rounded-md border border-[#e5ded4] bg-[#fffdf9] px-3 py-2 text-xs leading-5 text-[#766d62]">
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
                        <Link
                          className="flex h-10 w-full items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                          href={`/stuff/${listing.id}`}
                        >
                          Open listing
                        </Link>
                        <CompactShareButton
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
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
                            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                              <Send className="size-4" />
                              DM seller
                            </button>
                          </form>
                        ) : isSignedIn && canCreateStuff ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                            href="/messages"
                          >
                            Open DM
                          </Link>
                        ) : isSignedIn ? (
                          <Link
                            className="flex h-10 w-full items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                            href="/account#verification-settings"
                          >
                            Verify to contact
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
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[#e5ded4] px-4 py-5"
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
                      className="ttc-card scroll-mt-28 rounded-md border border-[#cfc8bd] bg-white p-4"
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
                      {!isGigLocked ? (
                        <p className="line-clamp-4 text-sm leading-6 text-[#4f473f]">
                          {gig.description || "No details yet."}
                        </p>
                      ) : (
                        <p className="rounded-md border border-[#e5c58f] bg-[#fff7ec] px-3 py-2 text-sm leading-6 text-[#7a4a08]">
                          Sensitive non-nude gig media is blurred until login
                          and 18+ confirmation.
                        </p>
                      )}
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
                        <Link
                          className="flex h-10 w-full items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                          href={`/gigs/${gig.id}`}
                        >
                          Open gig
                        </Link>
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
          </section>

          <section
            className="min-w-full snap-start snap-always border-l border-[#e5ded4] px-4 py-5"
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
          </ColumnSnapRail>
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
                  <Link
                    className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-3 text-sm leading-5"
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
                    className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-3"
                    href={`/gigs/${gig.id}`}
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
                  <Link
                    className="ttc-card block rounded-md border border-[#cfc8bd] bg-white p-3"
                    href={`/stuff/${listing.id}`}
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
