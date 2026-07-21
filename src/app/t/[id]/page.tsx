import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Heart,
  ImageIcon,
  LockKeyhole,
  MessageCircle,
  Send,
} from "lucide-react";
import {
  blockThreadCommentAuthor,
  createThreadComment,
  deleteThreadPost,
  deleteThreadComment,
  editThreadPost,
  editThreadComment,
  hideThreadComment,
  toggleThreadCommentLike,
  toggleThreadLike,
} from "@/app/actions";
import { ContentReportForm } from "@/app/content-report-form";
import { MediaLightbox } from "@/app/media-lightbox";
import { MediaInput } from "@/app/media-input";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { PendingSubmitButton } from "@/app/pending-submit-button";
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

type ThreadMedia = {
  id: string;
  media_type: "image";
  storage_bucket: string;
  storage_path: string;
};

type ThreadPost = {
  body: string;
  created_at: string;
  id: string;
  is_sensitive: boolean;
  profiles: Profile | null;
  thread_comments?: ThreadComment[];
  thread_likes: ThreadLike[];
  thread_media: ThreadMedia[];
  visibility: ContentVisibility;
};

type ThreadComment = {
  body: string;
  created_at: string;
  deleted_at: string | null;
  id: string;
  parent_id: string | null;
  thread_comment_media: CommentMedia[];
  thread_comment_hides: { hidden_by: string }[] | { hidden_by: string } | null;
  thread_comment_likes: ThreadLike[];
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

type ThreadLike = {
  user_id: string;
};

type ThreadPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ commentsPage?: string | string[] }>;
};

const commentsPageSize = 25;
const imageAccept = "image/jpeg,image/png,image/webp,image/gif";
const threadCommentSelect =
  "id, body, parent_id, deleted_at, created_at, thread_comment_media(id, storage_bucket, storage_path, media_type, mime_type, width, height), thread_comment_hides(hidden_by), thread_comment_likes(user_id), profiles:profiles!thread_comments_author_id_fkey(id, avatar_url, display_name, username)";

function asArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
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

function canViewThread({
  isOwnThread,
  thread,
  viewer,
}: {
  isOwnThread: boolean;
  thread: Pick<ThreadPost, "is_sensitive" | "visibility">;
  viewer: { isAdultConfirmed: boolean; isSignedIn: boolean };
}) {
  if (isOwnThread) return true;
  if (thread.visibility === "private") return false;
  if (thread.visibility !== "public_preview" && !viewer.isSignedIn) return false;
  if (thread.is_sensitive && !viewer.isAdultConfirmed) return false;

  return true;
}

async function getThread(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("thread_posts")
    .select(
      "id, body, visibility, is_sensitive, created_at, thread_media(id, storage_bucket, storage_path, media_type, sort_order), thread_likes(user_id), profiles:profiles!thread_posts_author_id_fkey(id, username, display_name, avatar_url, account_type, license_verified_at)",
    )
    .eq("id", id)
    .eq("moderation_status", "active")
    .order("sort_order", {
      ascending: true,
      referencedTable: "thread_media",
    })
    .maybeSingle<ThreadPost>();

  return data;
}

async function getVisibleThreadComments({
  blockedCommentProfileIds,
  commentLimit,
  supabase,
  threadId,
  userId,
}: {
  blockedCommentProfileIds: Set<string>;
  commentLimit: number;
  supabase: Awaited<ReturnType<typeof createClient>>;
  threadId: string;
  userId?: string | null;
}) {
  const commentFetchLimit = commentLimit + commentsPageSize;
  const { count: topLevelCommentCount, data: topLevelCommentRows } =
    await supabase
      .from("thread_comments")
      .select(threadCommentSelect, { count: "exact" })
      .eq("thread_id", threadId)
      .is("parent_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(commentFetchLimit)
      .returns<ThreadComment[]>();
  const visibleTopLevelComments = (topLevelCommentRows ?? [])
    .filter(
      (comment) =>
        !hasCommentHide(comment.thread_comment_hides) &&
        (!comment.profiles?.id ||
          comment.profiles.id === userId ||
          !blockedCommentProfileIds.has(comment.profiles.id)),
    )
    .slice(0, commentLimit);
  const visibleTopLevelIds = visibleTopLevelComments.map((comment) => comment.id);
  const { data: replyRows } = visibleTopLevelIds.length
    ? await supabase
        .from("thread_comments")
        .select(threadCommentSelect)
        .eq("thread_id", threadId)
        .in("parent_id", visibleTopLevelIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .returns<ThreadComment[]>()
    : { data: [] as ThreadComment[] };
  const visibleReplies = (replyRows ?? []).filter(
    (comment) =>
      !hasCommentHide(comment.thread_comment_hides) &&
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
}: ThreadPageProps): Promise<Metadata> {
  const { id } = await params;
  const thread = await getThread(id);

  if (!thread) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: "Gossip thread not found",
    };
  }

  const publicIndexable =
    thread.visibility === "public_preview" && !thread.is_sensitive;
  const description = thread.is_sensitive
    ? `Sensitive non-nude body-art Gossip thread on ${siteName}. Sign in to view eligible content.`
    : thread.body.slice(0, 155) ||
      `A Gossip thread by ${thread.profiles?.display_name ?? "a member"} on ${siteName}.`;
  const threadMedia = asArray(thread.thread_media);
  const shareMedia = threadMedia[0];
  const image =
    publicIndexable && shareMedia
      ? mediaUrl(shareMedia.storage_bucket, shareMedia.storage_path)
      : brandShareImage;
  const title = thread.is_sensitive
    ? `Sensitive non-nude body-art content | ${siteName}`
    : `Gossip by ${thread.profiles?.display_name ?? siteName}`;

  return {
    alternates: {
      canonical: `${siteUrl}/t/${thread.id}`,
    },
    description,
    openGraph: {
      description,
      images: [
        shareImage(
          image,
          publicIndexable
            ? "TheTattooCore Gossip thread media"
            : brandShareImageAlt,
        ),
      ],
      title,
      type: "article",
      url: `${siteUrl}/t/${thread.id}`,
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

export default async function ThreadPage({
  params,
  searchParams,
}: ThreadPageProps) {
  const { id } = await params;
  const search = await searchParams;
  const commentsPage = pageNumber(search?.commentsPage);
  const commentLimit = commentsPage * commentsPageSize;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
  const thread = await getThread(id);

  if (!thread) {
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
        .eq("subject_type", "thread_post")
        .eq("subject_id", thread.id)
        .maybeSingle<{ subject_id: string }>()
    : { data: null };

  const isSignedIn = Boolean(claims?.sub);
  const isOwnThread = claims?.sub === thread.profiles?.id;
  if (
    !isOwnThread &&
    (await hasBlockRelationship({
      profileId: thread.profiles?.id,
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
  const showThread = canViewThread({ isOwnThread, thread, viewer });
  const blockedCommentProfileIds = await getBlockedProfileIds({
    supabase,
    userId: claims?.sub,
  });
  const threadMedia = asArray(thread.thread_media);
  const threadLikes = asArray(thread.thread_likes);
  const media = threadMedia[0];
  const mediaSrc = media ? mediaUrl(media.storage_bucket, media.storage_path) : null;
  const liked = threadLikes.some((like) => like.user_id === claims?.sub);
  const returnPath = `/t/${thread.id}`;
  const { hasMoreComments, visibleComments, visibleTopLevelComments } =
    await getVisibleThreadComments({
      blockedCommentProfileIds,
      commentLimit,
      supabase,
      threadId: thread.id,
      userId: claims?.sub,
    });

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to Gossip"
                className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
                href="/#threads"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Gossip</p>
                <p className="truncate text-xs text-[var(--muted-strong)]">
                  {thread.profiles?.display_name ?? "TheTattooCore member"}
                </p>
              </div>
            </div>
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        {!isSignedIn &&
        thread.visibility === "public_preview" &&
        !thread.is_sensitive ? (
          <section className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-5 text-[var(--muted)]">
                Public Gossip preview. Sign in to like, reply, save, follow,
                DM, and view member-only or 18+ sensitive body-art content.
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
          <div className="min-w-0 space-y-5">
            {media && mediaSrc ? (
              <div className="relative overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)] bg-[var(--ink)] shadow-[0_12px_30px_rgba(23,20,18,0.22)]">
                {showThread ? (
                  <MediaLightbox
                    alt="Gossip thread media"
                    mediaType="image"
                    src={mediaSrc}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className="aspect-[16/10] w-full bg-[var(--ink)] object-contain"
                      src={mediaSrc}
                    />
                  </MediaLightbox>
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-white">
                    <div className="text-center opacity-45 blur-[1px]">
                      <LockKeyhole className="mx-auto mb-3 size-12" />
                      <p className="text-sm font-bold uppercase tracking-[0.18em]">
                        Sensitive media
                      </p>
                    </div>
                  </div>
                )}
                {!showThread ? (
                  <SensitiveContentGate
                    context="discussion"
                    isSignedIn={isSignedIn}
                    returnPath={returnPath}
                  />
                ) : null}
              </div>
            ) : null}

            <section className="ttc-card rounded-md p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold">
                      {thread.profiles?.display_name ?? "TheTattooCore member"}
                    </h1>
                    <VerifiedBadge profile={thread.profiles} />
                  </div>
                  {thread.profiles?.username ? (
                    <Link
                      className="mt-1 block text-sm text-[var(--muted-strong)] hover:underline"
                      href={`/u/${thread.profiles.username}`}
                    >
                      @{thread.profiles.username}
                    </Link>
                  ) : null}
                </div>
                <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--muted-strong)]">
                  {timeAgo(thread.created_at)}
                </span>
              </div>

              {showThread ? (
                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                  {thread.body}
                </p>
              ) : (
                <SensitiveContentGate
                  context="discussion"
                  isSignedIn={isSignedIn}
                  returnPath={returnPath}
                  variant="card"
                />
              )}

              {isOwnThread && showThread ? (
                <details className="mt-5 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
                  <summary className="cursor-pointer list-none text-sm font-bold">
                    Edit or delete Gossip post
                  </summary>
                  <form action={editThreadPost} className="mt-3 space-y-2">
                    <input name="thread_id" type="hidden" value={thread.id} />
                    <input name="return_path" type="hidden" value={returnPath} />
                    <WordLimitedField
                      as="textarea"
                      className="min-h-28 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                      defaultValue={thread.body}
                      maxCharacters={8000}
                      maxLength={8000}
                      name="body"
                      placeholder="Edit your Gossip post"
                      wrapperClassName="space-y-2"
                    />
                    <button className="h-10 w-full rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                      Save Gossip edit
                    </button>
                  </form>
                  <form action={deleteThreadPost} className="mt-3">
                    <input name="thread_id" type="hidden" value={thread.id} />
                    <input name="return_path" type="hidden" value={returnPath} />
                    <button className="h-10 w-full rounded-md border border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-4 text-sm font-semibold text-[var(--danger)]">
                      Delete Gossip post
                    </button>
                  </form>
                </details>
              ) : null}

              {!media ? (
                <div className="mt-5 flex h-24 items-center justify-center rounded-md border border-dashed border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] text-[var(--muted-strong)]">
                  <ImageIcon className="mr-2 size-5" />
                  Text thread
                </div>
              ) : null}
            </section>
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="ttc-card rounded-md p-4">
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_84%,transparent)] p-3">
                  <p className="text-lg font-bold">{threadLikes.length}</p>
                  <p className="text-xs text-[var(--muted-strong)]">likes</p>
                </div>
                <div className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_84%,transparent)] p-3">
                  <p className="text-lg font-bold">
                    {visibleComments.length}
                  </p>
                  <p className="text-xs text-[var(--muted-strong)]">replies</p>
                </div>
              </div>

              {isSignedIn ? (
                <form action={toggleThreadLike} className="mt-3">
                  <input name="thread_id" type="hidden" value={thread.id} />
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
                subjectId={thread.id}
                subjectType="thread_post"
              />
            ) : null}

            <ShareActions
              text={`Check this Gossip thread on ${siteName}`}
              title={`Gossip by ${thread.profiles?.display_name ?? siteName}`}
              url={`${siteUrl}/t/${thread.id}`}
            />

            <section className="ttc-card rounded-md p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageCircle className="size-4" />
                <h2 className="text-sm font-bold">Replies</h2>
              </div>
              {isSignedIn && showThread ? (
                <form
                  action={createThreadComment}
                  className="mb-4 space-y-2"
                  encType="multipart/form-data"
                >
                  <input name="thread_id" type="hidden" value={thread.id} />
                  <input name="return_path" type="hidden" value={returnPath} />
                  <WordLimitedField
                    as="textarea"
                    className="min-h-24 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    emojiShortcuts
                    maxCharacters={2000}
                    maxLength={2000}
                    name="body"
                    placeholder="Reply to this Gossip thread"
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
                    pendingLabel="Replying"
                  >
                    <Send className="size-4" />
                    Reply
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
                  {isSignedIn ? "Confirm 18+ to reply" : "Sign in to reply"}
                </Link>
              )}
              <div className="space-y-3">
                {isSignedIn && showThread && visibleComments.length ? (
                  visibleTopLevelComments
                    .map((comment) => {
                      const commentLikes = asArray(comment.thread_comment_likes);
                      const commentMedia = asArray(comment.thread_comment_media);
                      const likedComment = commentLikes.some(
                        (like) => like.user_id === claims?.sub,
                      );
                      const replies = visibleComments.filter(
                        (reply) => reply.parent_id === comment.id,
                      );
                      const isOwnComment = comment.profiles?.id === claims?.sub;
                      const canModerateComment =
                        isOwnThread && comment.profiles?.id !== claims?.sub;

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
                                <p className="mt-1 whitespace-pre-wrap break-words leading-5 text-[var(--muted)]">
                                  {comment.body}
                                </p>
                              ) : null}
                              <CommentMediaPreview media={commentMedia[0]} />
                            </div>
                          </div>
                          <div className="ttc-comment-controls mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
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
                                action={createThreadComment}
                                className="mt-2 grid gap-2"
                                encType="multipart/form-data"
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
                                  value={returnPath}
                                />
                                <div className="flex items-start gap-2">
                                  <WordLimitedField
                                    className="h-9 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 text-xs outline-none focus:border-[var(--foreground)]"
                                    emojiShortcuts
                                    maxCharacters={2000}
                                    maxLength={2000}
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
                                  action={editThreadComment}
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
                                  <textarea
                                    className="min-h-20 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 py-2 text-xs outline-none focus:border-[var(--foreground)]"
                                    defaultValue={comment.body}
                                    maxLength={2000}
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
                              <form action={deleteThreadComment}>
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
                              <form action={deleteThreadComment}>
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
                              <form action={hideThreadComment}>
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
                              <form action={blockThreadCommentAuthor}>
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
                                const replyLikes = asArray(reply.thread_comment_likes);
                                const replyMedia = asArray(reply.thread_comment_media);
                                const likedReply =
                                  replyLikes.some(
                                    (like) => like.user_id === claims?.sub,
                                  );
                                const isOwnReply =
                                  reply.profiles?.id === claims?.sub;
                                const canModerateReply =
                                  isOwnThread &&
                                  reply.profiles?.id !== claims?.sub;

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
                                      <form action={toggleThreadCommentLike}>
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
                                            action={editThreadComment}
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
                                            <textarea
                                              className="min-h-20 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 py-2 text-xs outline-none focus:border-[var(--foreground)]"
                                              defaultValue={reply.body}
                                              maxLength={2000}
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
                                        <form action={deleteThreadComment}>
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
                                        <form action={deleteThreadComment}>
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
                                        <form action={hideThreadComment}>
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
                                        <form action={blockThreadCommentAuthor}>
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
                    {isSignedIn && showThread
                      ? "No replies yet."
                      : "Replies are visible after login."}
                  </p>
                )}
                {isSignedIn && showThread && hasMoreComments ? (
                  <Link
                    className="flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm font-semibold"
                    href={`/t/${thread.id}?commentsPage=${commentsPage + 1}`}
                  >
                    Load 25 more replies
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
                  subjectId={thread.id}
                  subjectType="thread_post"
                />
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
