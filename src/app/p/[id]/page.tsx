import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Heart,
  LockKeyhole,
  MessageCircle,
  Send,
  Video,
} from "lucide-react";
import {
  blockPostCommentAuthor,
  createPostComment,
  deleteFeedPost,
  deletePostComment,
  editFeedPost,
  editPostComment,
  hidePostComment,
  togglePostCommentLike,
  togglePostLike,
} from "@/app/actions";
import { ContentReportForm } from "@/app/content-report-form";
import { MediaLightbox } from "@/app/media-lightbox";
import { MediaInput } from "@/app/media-input";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { ProtectedVideo } from "@/app/protected-video";
import { ProfileAvatar } from "@/app/profile-avatar";
import { SavedItemButton } from "@/app/saved-item-button";
import { SensitiveContentGate } from "@/app/sensitive-content-gate";
import { ShareActions } from "@/app/share-actions";
import { WordLimitedField } from "@/app/word-limited-field";
import {
  brandShareImage,
  brandShareImageAlt,
  shareImage,
  siteName,
  siteUrl,
} from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedProfessional } from "@/lib/verification";

type Claims = {
  sub: string;
};

type Profile = {
  account_type: string;
  avatar_url?: string | null;
  display_name: string;
  id: string;
  license_verified_at: string | null;
  username: string;
};

type ViewerProfile = {
  adult_terms_accepted_at: string | null;
  is_adult_confirmed: boolean | null;
};

type ContentVisibility =
  | "public_preview"
  | "members"
  | "followers"
  | "verified_professionals"
  | "private";

type FeedMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type FeedPost = {
  caption: string | null;
  created_at: string;
  feed_post_tags: FeedPostTag[];
  feed_media: FeedMedia[];
  id: string;
  is_sensitive: boolean;
  location_label: string | null;
  post_comments?: PostComment[];
  post_likes: PostLike[];
  profiles: Profile | null;
  style_tags: string[];
  visibility: ContentVisibility;
};

type FeedPostTag = {
  profiles: Pick<
    Profile,
    "account_type" | "avatar_url" | "display_name" | "id" | "license_verified_at" | "username"
  > | null;
};

type PostComment = {
  body: string;
  created_at: string;
  deleted_at: string | null;
  id: string;
  parent_id: string | null;
  post_comment_hides: { hidden_by: string }[] | { hidden_by: string } | null;
  post_comment_likes: PostLike[];
  post_comment_media: CommentMedia[];
  profiles: Pick<Profile, "avatar_url" | "display_name" | "id" | "username"> | null;
};

type CommentMedia = {
  height: number | null;
  id: string;
  media_type: "image";
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
  width: number | null;
};

type PostLike = {
  user_id: string;
};

type PostPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ commentsPage?: string | string[] }>;
};

const commentsPageSize = 25;
const imageAccept = "image/jpeg,image/png,image/webp,image/gif";
const postCommentSelect =
  "id, body, parent_id, deleted_at, created_at, post_comment_media(id, storage_bucket, storage_path, media_type, mime_type, width, height), post_comment_hides(hidden_by), post_comment_likes(user_id), profiles:profiles!post_comments_author_id_fkey(id, avatar_url, display_name, username)";

function asArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function TaggedMemberLinks({ tags }: { tags: FeedPostTag[] }) {
  const visibleTags = tags.filter((tag) => tag.profiles);

  if (!visibleTags.length) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
      <span className="text-[var(--muted-strong)]">With</span>
      {visibleTags.map((tag) => {
        const profile = tag.profiles;

        if (!profile) return null;

        return (
          <Link
            className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-2 py-1 hover:underline"
            href={`/u/${profile.username}`}
            key={profile.id}
          >
            @{profile.username}
            <VerifiedBadge profile={profile} />
          </Link>
        );
      })}
    </div>
  );
}

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 1;
}

function mediaUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function hasCommentHide(
  value: { hidden_by: string }[] | { hidden_by: string } | null,
) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function isVerifiedProfile(profile?: Profile | null) {
  return isVerifiedProfessional(profile);
}

function VerifiedBadge({ profile }: { profile?: Profile | null }) {
  if (!profile || !isVerifiedProfile(profile)) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-2 py-1 text-xs font-semibold text-[var(--background)]">
      <BadgeCheck className="size-3" />
      Verified
    </span>
  );
}

function CommentMediaPreview({ media }: { media?: CommentMedia | null }) {
  if (!media) return null;

  const src = mediaUrl(media.storage_bucket, media.storage_path);

  return (
    <MediaLightbox
      alt="Comment attachment"
      description="Comment image attachment"
      mediaType="image"
      src={src}
      title="Comment media"
    >
      <button className="mt-2 block overflow-hidden rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="max-h-64 w-full object-cover"
          loading="lazy"
          src={src}
        />
      </button>
    </MediaLightbox>
  );
}

function canViewPost({
  isOwnPost,
  post,
  viewer,
}: {
  isOwnPost: boolean;
  post: Pick<FeedPost, "is_sensitive" | "visibility">;
  viewer: { isAdultConfirmed: boolean; isSignedIn: boolean };
}) {
  if (isOwnPost) return true;
  if (post.visibility === "private") return false;
  if (post.visibility !== "public_preview" && !viewer.isSignedIn) return false;
  if (post.is_sensitive && !viewer.isAdultConfirmed) return false;

  return true;
}

async function getPost(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feed_posts")
    .select(
      "id, caption, style_tags, location_label, visibility, is_sensitive, created_at, feed_post_tags(profiles:profiles!feed_post_tags_tagged_profile_id_fkey(id, username, display_name, avatar_url, account_type, license_verified_at)), feed_media(id, storage_bucket, storage_path, media_type, sort_order), post_likes(user_id), profiles:profiles!feed_posts_author_id_fkey(id, username, display_name, avatar_url, account_type, license_verified_at)",
    )
    .eq("id", id)
    .eq("is_published", true)
    .eq("moderation_status", "active")
    .order("sort_order", {
      ascending: true,
      referencedTable: "feed_media",
    })
    .maybeSingle<FeedPost>();

  return data;
}

async function getVisiblePostComments({
  blockedCommentProfileIds,
  commentLimit,
  postId,
  supabase,
  userId,
}: {
  blockedCommentProfileIds: Set<string>;
  commentLimit: number;
  postId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId?: string | null;
}) {
  const commentFetchLimit = commentLimit + commentsPageSize;
  const { count: topLevelCommentCount, data: topLevelCommentRows } =
    await supabase
      .from("post_comments")
      .select(postCommentSelect, { count: "exact" })
      .eq("post_id", postId)
      .is("parent_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(commentFetchLimit)
      .returns<PostComment[]>();
  const visibleTopLevelComments = (topLevelCommentRows ?? [])
    .filter(
      (comment) =>
        !hasCommentHide(comment.post_comment_hides) &&
        (!comment.profiles?.id ||
          comment.profiles.id === userId ||
          !blockedCommentProfileIds.has(comment.profiles.id)),
    )
    .slice(0, commentLimit);
  const visibleTopLevelIds = visibleTopLevelComments.map((comment) => comment.id);
  const { data: replyRows } = visibleTopLevelIds.length
    ? await supabase
        .from("post_comments")
        .select(postCommentSelect)
        .eq("post_id", postId)
        .in("parent_id", visibleTopLevelIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .returns<PostComment[]>()
    : { data: [] as PostComment[] };
  const visibleReplies = (replyRows ?? []).filter(
    (comment) =>
      !hasCommentHide(comment.post_comment_hides) &&
      (!comment.profiles?.id ||
        comment.profiles.id === userId ||
        !blockedCommentProfileIds.has(comment.profiles.id)),
  );

  return {
    hasMoreComments:
      (topLevelCommentRows?.length ?? 0) === commentFetchLimit ||
      (topLevelCommentCount ?? 0) > commentLimit,
    visibleComments: [...visibleTopLevelComments, ...visibleReplies],
    visibleTopLevelComments,
  };
}

async function hasBlockRelationship({
  profileId,
  supabase,
  userId,
}: {
  profileId?: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId?: string | null;
}) {
  if (!userId || !profileId || userId === profileId) return false;

  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${profileId}),and(blocker_id.eq.${profileId},blocked_id.eq.${userId})`,
    )
    .maybeSingle<{ blocker_id: string }>();

  return Boolean(data);
}

async function getBlockedProfileIds({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId?: string | null;
}) {
  if (!userId) return new Set<string>();

  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    .returns<{ blocked_id: string; blocker_id: string }[]>();

  return new Set(
    (data ?? []).map((block) =>
      block.blocker_id === userId ? block.blocked_id : block.blocker_id,
    ),
  );
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: "4U post not found",
    };
  }

  const publicIndexable =
    post.visibility === "public_preview" && !post.is_sensitive;
  const description = post.is_sensitive
    ? `Sensitive non-nude body-art 4U post on ${siteName}. Sign in to view eligible content.`
    : post.caption?.slice(0, 155) ||
      `A 4U post by ${post.profiles?.display_name ?? "a member"} on ${siteName}.`;
  const postMedia = asArray(post.feed_media);
  const shareMedia = postMedia.find((media) => media.media_type === "image");
  const image =
    publicIndexable && shareMedia
      ? mediaUrl(shareMedia.storage_bucket, shareMedia.storage_path)
      : brandShareImage;
  const title = post.is_sensitive
    ? `Sensitive non-nude body-art content | ${siteName}`
    : `4U post by ${post.profiles?.display_name ?? siteName}`;

  return {
    alternates: {
      canonical: `${siteUrl}/p/${post.id}`,
    },
    description,
    openGraph: {
      description,
      images: [
        shareImage(
          image,
          publicIndexable ? "TheTattooCore 4U post media" : brandShareImageAlt,
        ),
      ],
      title,
      type: "article",
      url: `${siteUrl}/p/${post.id}`,
    },
    robots: {
      follow: publicIndexable,
      index: publicIndexable,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: [image],
      title,
    },
  };
}

export default async function PostPage({ params, searchParams }: PostPageProps) {
  const { id } = await params;
  const search = await searchParams;
  const commentsPage = pageNumber(search?.commentsPage);
  const commentLimit = commentsPage * commentsPageSize;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
  const post = await getPost(id);

  if (!post) {
    notFound();
  }

  const { data: currentProfile } = claims?.sub
    ? await supabase
        .from("profiles")
        .select("adult_terms_accepted_at, is_adult_confirmed")
        .eq("id", claims.sub)
        .maybeSingle<ViewerProfile>()
    : { data: null };
  const { data: savedItem } = claims?.sub
    ? await supabase
        .from("saved_items")
        .select("subject_id")
        .eq("user_id", claims.sub)
        .eq("subject_type", "feed_post")
        .eq("subject_id", post.id)
        .maybeSingle<{ subject_id: string }>()
    : { data: null };

  const isSignedIn = Boolean(claims?.sub);
  const isOwnPost = claims?.sub === post.profiles?.id;
  if (
    !isOwnPost &&
    (await hasBlockRelationship({
      profileId: post.profiles?.id,
      supabase,
      userId: claims?.sub,
    }))
  ) {
    notFound();
  }
  const viewer = {
    isAdultConfirmed: Boolean(
      currentProfile?.is_adult_confirmed &&
        currentProfile.adult_terms_accepted_at,
    ),
    isSignedIn,
  };
  const showPost = canViewPost({ isOwnPost, post, viewer });
  const blockedCommentProfileIds = await getBlockedProfileIds({
    supabase,
    userId: claims?.sub,
  });
  const postMedia = asArray(post.feed_media);
  const postLikes = asArray(post.post_likes);
  const styleTags = asArray(post.style_tags);
  const media = postMedia[0];
  const mediaSrc = media ? mediaUrl(media.storage_bucket, media.storage_path) : null;
  const liked = postLikes.some((like) => like.user_id === claims?.sub);
  const returnPath = `/p/${post.id}`;
  const { hasMoreComments, visibleComments, visibleTopLevelComments } =
    await getVisiblePostComments({
      blockedCommentProfileIds,
      commentLimit,
      postId: post.id,
      supabase,
      userId: claims?.sub,
    });

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to 4U"
                className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
                href="/#feed"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">4U</p>
                <p className="truncate text-xs text-[var(--muted-strong)]">
                  {post.profiles?.display_name ?? "TheTattooCore member"}
                </p>
              </div>
            </div>
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        {!isSignedIn && post.visibility === "public_preview" && !post.is_sensitive ? (
          <section className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-5 text-[var(--muted)]">
                Public 4U preview. Sign in to like, comment, save, follow, DM,
                and view member-only or 18+ sensitive body-art content.
              </p>
              <Link
                className="flex h-10 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                href={`/login?return_to=${encodeURIComponent(returnPath)}`}
              >
                Sign in
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid min-w-0 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)] bg-[var(--ink)] shadow-[0_12px_30px_rgba(23,20,18,0.22)]">
              {media && mediaSrc ? (
                media.media_type === "video" ? (
                  showPost ? (
                    <MediaLightbox mediaType="video" src={mediaSrc}>
                      <ProtectedVideo
                        className="aspect-[4/5] w-full bg-[var(--ink)] object-contain"
                        src={mediaSrc}
                      />
                    </MediaLightbox>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-white">
                      <div className="text-center opacity-45 blur-[1px]">
                        <LockKeyhole className="mx-auto mb-3 size-14" />
                        <p className="text-sm font-bold uppercase tracking-[0.18em]">
                          Sensitive media
                        </p>
                      </div>
                    </div>
                  )
                ) : showPost ? (
                  <MediaLightbox
                    alt={post.caption ?? "4U post media"}
                    mediaType="image"
                    src={mediaSrc}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className="aspect-[4/5] w-full bg-[var(--ink)] object-contain"
                      src={mediaSrc}
                    />
                  </MediaLightbox>
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-white">
                    <div className="text-center opacity-45 blur-[1px]">
                      <LockKeyhole className="mx-auto mb-3 size-14" />
                      <p className="text-sm font-bold uppercase tracking-[0.18em]">
                        Sensitive media
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center text-white">
                  <Camera className="size-12" />
                </div>
              )}
              {!showPost ? (
                <SensitiveContentGate
                  isSignedIn={isSignedIn}
                  returnPath={returnPath}
                />
              ) : null}
            </div>

            <section className="ttc-card mt-5 rounded-md p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold">
                      {post.profiles?.display_name ?? "TheTattooCore member"}
                    </h1>
                    <VerifiedBadge profile={post.profiles} />
                  </div>
                  {post.profiles?.username ? (
                    <Link
                      className="mt-1 block text-sm text-[var(--muted-strong)] hover:underline"
                      href={`/u/${post.profiles.username}`}
                    >
                      @{post.profiles.username}
                    </Link>
                  ) : null}
                </div>
                <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--muted-strong)]">
                  {timeAgo(post.created_at)}
                </span>
              </div>

              {showPost ? (
                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                  {post.caption || "Untitled 4U post"}
                </p>
              ) : (
                <p className="mt-5 text-sm leading-6 text-[var(--muted-strong)]">
                  This post is limited to members or confirmed 18+ viewers.
                </p>
              )}

              {showPost ? <TaggedMemberLinks tags={post.feed_post_tags ?? []} /> : null}

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
                {styleTags.map((tag) => (
                  <span className="rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] px-2 py-1" key={tag}>
                    {tag}
                  </span>
                ))}
                {post.location_label ? (
                  <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_84%,transparent)] px-2 py-1">
                    {post.location_label}
                  </span>
                ) : null}
                {media?.media_type === "video" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_84%,transparent)] px-2 py-1">
                    <Video className="size-3.5" />
                    Reel
                  </span>
                ) : null}
              </div>

              {isOwnPost && showPost ? (
                <details className="mt-5 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-4">
                  <summary className="cursor-pointer text-sm font-bold">
                    Edit or delete 4U post
                  </summary>
                  <form action={editFeedPost} className="mt-3 space-y-3">
                    <input name="post_id" type="hidden" value={post.id} />
                    <input name="return_path" type="hidden" value={returnPath} />
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
                        defaultValue={styleTags.join(", ")}
                        maxLength={160}
                        name="style_tags"
                        placeholder="blackwork, fine line"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                      Tagged members
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                        defaultValue={(post.feed_post_tags ?? [])
                          .map((tag) => tag.profiles?.username)
                          .filter(Boolean)
                          .map((username) => `@${username}`)
                          .join(", ")}
                        maxLength={340}
                        name="tagged_usernames"
                        placeholder="@artistname, @shopname"
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
                    <input name="return_path" type="hidden" value={returnPath} />
                    <button className="h-10 rounded-md border border-[color-mix(in_srgb,#ef4444_38%,var(--card-rim))] px-4 text-sm font-semibold">
                      Delete 4U post
                    </button>
                  </form>
                </details>
              ) : null}
            </section>
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="ttc-card rounded-md p-4">
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_84%,transparent)] p-3">
                  <p className="text-lg font-bold">{postLikes.length}</p>
                  <p className="text-xs text-[var(--muted-strong)]">likes</p>
                </div>
                <div className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_84%,transparent)] p-3">
                  <p className="text-lg font-bold">{visibleComments.length}</p>
                  <p className="text-xs text-[var(--muted-strong)]">comments</p>
                </div>
              </div>

              {isSignedIn ? (
                <form action={togglePostLike} className="mt-3">
                  <input name="post_id" type="hidden" value={post.id} />
                  <input name="liked" type="hidden" value={String(liked)} />
                  <input name="return_path" type="hidden" value={returnPath} />
                  <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                    <Heart
                      className={`size-4 ${liked ? "fill-[var(--brand-gold)] text-[var(--brand-gold)]" : ""}`}
                    />
                    {liked ? "Liked" : "Like"}
                  </button>
                </form>
              ) : (
                <Link
                  className="mt-3 flex h-11 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                  href={`/login?return_to=${encodeURIComponent(returnPath)}`}
                >
                  Sign in to like
                </Link>
              )}
            </section>

            {isSignedIn ? (
              <SavedItemButton
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                isSaved={Boolean(savedItem)}
                returnPath={returnPath}
                subjectId={post.id}
                subjectType="feed_post"
              />
            ) : null}

            <ShareActions
              text={`Check this 4U post on ${siteName}`}
              title={`4U post by ${post.profiles?.display_name ?? siteName}`}
              url={`${siteUrl}/p/${post.id}`}
            />

            <section className="ttc-card rounded-md p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageCircle className="size-4" />
                <h2 className="text-sm font-bold">Comments</h2>
              </div>
              {isSignedIn && showPost ? (
                <form
                  action={createPostComment}
                  className="mb-4 space-y-2"
                  encType="multipart/form-data"
                >
                  <input name="post_id" type="hidden" value={post.id} />
                  <input name="return_path" type="hidden" value={returnPath} />
                  <WordLimitedField
                    className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    emojiShortcuts
                    maxLength={220}
                    maxWords={40}
                    name="body"
                    placeholder="Add a short comment"
                    wrapperClassName="w-full"
                  />
                  <details className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
                    <summary className="cursor-pointer list-none text-xs font-bold">
                      Attach photo or GIF
                    </summary>
                    <div className="mt-2">
                      <MediaInput
                        accept={imageAccept}
                        compact
                        maxImageBytes={5 * 1024 * 1024}
                        name="media"
                        videoAllowed={false}
                      />
                    </div>
                  </details>
                  <PendingSubmitButton
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)]"
                    pendingLabel="Posting"
                  >
                    <Send className="size-4" />
                    Post comment
                  </PendingSubmitButton>
                </form>
              ) : (
                <Link
                  className="mb-4 flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm font-semibold"
                  href={
                    isSignedIn
                      ? "/terms"
                      : `/login?return_to=${encodeURIComponent(returnPath)}`
                  }
                >
                  {isSignedIn ? "Confirm 18+ to comment" : "Sign in to comment"}
                </Link>
              )}
              <div className="space-y-3">
                {isSignedIn && showPost && visibleComments.length ? (
                  visibleTopLevelComments
                    .map((comment) => {
                      const commentLikes = asArray(comment.post_comment_likes);
                      const commentMedia = asArray(comment.post_comment_media);
                      const likedComment = commentLikes.some(
                        (like) => like.user_id === claims?.sub,
                      );
                      const replies = visibleComments.filter(
                        (reply) => reply.parent_id === comment.id,
                      );
                      const isOwnComment = comment.profiles?.id === claims?.sub;
                      const canModerateComment =
                        isOwnPost && comment.profiles?.id !== claims?.sub;

                      return (
                        <div
                          className="border-t border-[var(--card-rim)] pt-3 text-sm"
                          key={comment.id}
                        >
                          <div className="flex items-start gap-2">
                            <ProfileAvatar profile={comment.profiles} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">
                                {comment.profiles?.username ? (
                                  <Link
                                    className="hover:underline"
                                    href={`/u/${comment.profiles.username}`}
                                  >
                                    {comment.profiles.display_name ?? "Member"}
                                  </Link>
                                ) : (
                                  "Member"
                                )}
                              </p>
                              {comment.body ? (
                                <p className="mt-1 break-words leading-5 text-[var(--muted)]">
                                  {comment.body}
                                </p>
                              ) : null}
                              <CommentMediaPreview media={commentMedia[0]} />
                            </div>
                          </div>
                          <div className="ttc-comment-controls mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <form action={togglePostCommentLike}>
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
                                value={returnPath}
                              />
                              <button className="flex items-center gap-1">
                                <Heart
                                  className={`size-3.5 ${
                                    likedComment
                                      ? "fill-[var(--brand-gold)] text-[var(--brand-gold)]"
                                      : ""
                                  }`}
                                />
                                {commentLikes.length}
                              </button>
                            </form>
                            <details>
                              <summary className="cursor-pointer list-none">
                                Reply
                              </summary>
                              <form
                                action={createPostComment}
                                className="mt-2 grid gap-2"
                                encType="multipart/form-data"
                              >
                                <input
                                  name="post_id"
                                  type="hidden"
                                  value={post.id}
                                />
                                <input
                                  name="parent_id"
                                  type="hidden"
                                  value={comment.id}
                                />
                                <input
                                  name="return_path"
                                  type="hidden"
                                  value={returnPath}
                                />
                                <div className="flex items-start gap-2">
                                  <WordLimitedField
                                    className="h-9 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 text-xs outline-none focus:border-[var(--foreground)]"
                                    emojiShortcuts
                                    maxLength={220}
                                    maxWords={40}
                                    name="body"
                                    placeholder="Reply"
                                  />
                                  <PendingSubmitButton
                                    aria-label="Post reply"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)]"
                                  >
                                    <Send className="size-4" />
                                  </PendingSubmitButton>
                                </div>
                                <MediaInput
                                  accept={imageAccept}
                                  compact
                                  maxImageBytes={5 * 1024 * 1024}
                                  name="media"
                                  videoAllowed={false}
                                />
                              </form>
                            </details>
                            {isOwnComment ? (
                              <details>
                                <summary className="cursor-pointer list-none">
                                  Edit
                                </summary>
                                <form
                                  action={editPostComment}
                                  className="mt-2 grid gap-2"
                                >
                                  <input
                                    name="comment_id"
                                    type="hidden"
                                    value={comment.id}
                                  />
                                  <input
                                    name="return_path"
                                    type="hidden"
                                    value={returnPath}
                                  />
                                  <input
                                    className="h-9 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 text-xs outline-none focus:border-[var(--foreground)]"
                                    defaultValue={comment.body}
                                    maxLength={220}
                                    name="body"
                                    required
                                  />
                                  <button className="h-8 rounded-md bg-[var(--foreground)] px-3 text-xs font-semibold text-[var(--background)]">
                                    Save
                                  </button>
                                </form>
                              </details>
                            ) : null}
                            {isOwnComment ? (
                              <form action={deletePostComment}>
                                <input
                                  name="comment_id"
                                  type="hidden"
                                  value={comment.id}
                                />
                                <input
                                  name="return_path"
                                  type="hidden"
                                  value={returnPath}
                                />
                                <button>Delete</button>
                              </form>
                            ) : null}
                            {canModerateComment ? (
                              <form action={deletePostComment}>
                                <input
                                  name="comment_id"
                                  type="hidden"
                                  value={comment.id}
                                />
                                <input
                                  name="return_path"
                                  type="hidden"
                                  value={returnPath}
                                />
                                <button>Delete</button>
                              </form>
                            ) : null}
                            {canModerateComment ? (
                              <form action={hidePostComment}>
                                <input
                                  name="comment_id"
                                  type="hidden"
                                  value={comment.id}
                                />
                                <input
                                  name="return_path"
                                  type="hidden"
                                  value={returnPath}
                                />
                                <button>Hide</button>
                              </form>
                            ) : null}
                            {canModerateComment ? (
                              <form action={blockPostCommentAuthor}>
                                <input
                                  name="comment_id"
                                  type="hidden"
                                  value={comment.id}
                                />
                                <input
                                  name="return_path"
                                  type="hidden"
                                  value={returnPath}
                                />
                                <button>Block</button>
                              </form>
                            ) : null}
                            {!isOwnComment ? (
                              <ContentReportForm
                                returnPath={returnPath}
                                subjectId={comment.id}
                                subjectType="comment"
                              />
                            ) : null}
                          </div>
                          {replies.length ? (
                            <div className="mt-3 space-y-2 border-l border-[var(--card-rim)] pl-3">
                              {replies.map((reply) => {
                                const replyLikes = asArray(reply.post_comment_likes);
                                const replyMedia = asArray(reply.post_comment_media);
                                const likedReply = replyLikes.some(
                                  (like) => like.user_id === claims?.sub,
                                );
                                const isOwnReply =
                                  reply.profiles?.id === claims?.sub;
                                const canModerateReply =
                                  isOwnPost && reply.profiles?.id !== claims?.sub;

                                return (
                                  <div
                                    className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_84%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted)]"
                                    key={reply.id}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex min-w-0 flex-1 items-start gap-2">
                                        <ProfileAvatar
                                          profile={reply.profiles}
                                          size="sm"
                                        />
                                        <div className="min-w-0 flex-1">
                                        <p className="break-words">
                                          <span className="font-semibold text-[var(--foreground)]">
                                            {reply.profiles?.display_name ?? "Member"}
                                          </span>{" "}
                                          {reply.body}
                                        </p>
                                        <CommentMediaPreview media={replyMedia[0]} />
                                        </div>
                                      </div>
                                      <form action={togglePostCommentLike}>
                                        <input
                                          name="comment_id"
                                          type="hidden"
                                          value={reply.id}
                                        />
                                        <input
                                          name="liked"
                                          type="hidden"
                                          value={likedReply ? "true" : "false"}
                                        />
                                        <input
                                          name="return_path"
                                          type="hidden"
                                          value={returnPath}
                                        />
                                        <button className="flex items-center gap-1 font-semibold text-[var(--muted-strong)]">
                                          <Heart
                                            className={`size-3 ${
                                              likedReply
                                                ? "fill-[var(--brand-gold)] text-[var(--brand-gold)]"
                                                : ""
                                            }`}
                                          />
                                          {replyLikes.length}
                                        </button>
                                      </form>
                                    </div>
                                    <div className="ttc-comment-controls mt-2 flex flex-wrap items-center gap-2 font-semibold">
                                      {isOwnReply ? (
                                        <details>
                                          <summary className="cursor-pointer list-none">
                                            Edit
                                          </summary>
                                          <form
                                            action={editPostComment}
                                            className="mt-2 grid gap-2"
                                          >
                                            <input
                                              name="comment_id"
                                              type="hidden"
                                              value={reply.id}
                                            />
                                            <input
                                              name="return_path"
                                              type="hidden"
                                              value={returnPath}
                                            />
                                            <input
                                              className="h-9 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 text-xs outline-none focus:border-[var(--foreground)]"
                                              defaultValue={reply.body}
                                              maxLength={220}
                                              name="body"
                                              required
                                            />
                                            <button className="h-8 rounded-md bg-[var(--foreground)] px-3 text-xs font-semibold text-[var(--background)]">
                                              Save
                                            </button>
                                          </form>
                                        </details>
                                      ) : null}
                                      {isOwnReply ? (
                                        <form action={deletePostComment}>
                                          <input
                                            name="comment_id"
                                            type="hidden"
                                            value={reply.id}
                                          />
                                          <input
                                            name="return_path"
                                            type="hidden"
                                            value={returnPath}
                                          />
                                          <button>Delete</button>
                                        </form>
                                      ) : null}
                                      {canModerateReply ? (
                                        <form action={deletePostComment}>
                                          <input
                                            name="comment_id"
                                            type="hidden"
                                            value={reply.id}
                                          />
                                          <input
                                            name="return_path"
                                            type="hidden"
                                            value={returnPath}
                                          />
                                          <button>Delete</button>
                                        </form>
                                      ) : null}
                                      {canModerateReply ? (
                                        <form action={hidePostComment}>
                                          <input
                                            name="comment_id"
                                            type="hidden"
                                            value={reply.id}
                                          />
                                          <input
                                            name="return_path"
                                            type="hidden"
                                            value={returnPath}
                                          />
                                          <button>Hide</button>
                                        </form>
                                      ) : null}
                                      {canModerateReply ? (
                                        <form action={blockPostCommentAuthor}>
                                          <input
                                            name="comment_id"
                                            type="hidden"
                                            value={reply.id}
                                          />
                                          <input
                                            name="return_path"
                                            type="hidden"
                                            value={returnPath}
                                          />
                                          <button>Block</button>
                                        </form>
                                      ) : null}
                                      {!isOwnReply ? (
                                        <ContentReportForm
                                          returnPath={returnPath}
                                          subjectId={reply.id}
                                          subjectType="comment"
                                        />
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                ) : (
                  <p className="rounded-md border border-dashed border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-sm text-[var(--muted-strong)]">
                    {isSignedIn && showPost
                      ? "No comments yet."
                      : "Comments are visible after login."}
                  </p>
                )}
                {isSignedIn && showPost && hasMoreComments ? (
                  <Link
                    className="flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm font-semibold"
                    href={`/p/${post.id}?commentsPage=${commentsPage + 1}`}
                  >
                    Load 25 more comments
                  </Link>
                ) : null}
              </div>
            </section>

            {isSignedIn ? (
              <section className="ttc-card rounded-md p-4">
                <p className="mb-3 text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  Safety
                </p>
                <ContentReportForm
                  returnPath={returnPath}
                  subjectId={post.id}
                  subjectType="feed_post"
                />
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
