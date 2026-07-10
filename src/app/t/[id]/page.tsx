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
  deleteThreadComment,
  editThreadComment,
  hideThreadComment,
  toggleThreadCommentLike,
  toggleThreadLike,
} from "@/app/actions";
import { ContentReportForm } from "@/app/content-report-form";
import { MediaLightbox } from "@/app/media-lightbox";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { PendingSubmitButton } from "@/app/pending-submit-button";
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
  display_name: string;
  id: string;
  license_verified_at: string | null;
  username: string;
};

type ViewerProfile = {
  adult_terms_accepted_at: string | null;
  is_adult_confirmed: boolean | null;
};

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
  thread_comments: ThreadComment[];
  thread_likes: ThreadLike[];
  thread_media: ThreadMedia[];
  visibility: "public_preview" | "members" | "private";
};

type ThreadComment = {
  body: string;
  created_at: string;
  deleted_at: string | null;
  id: string;
  parent_id: string | null;
  thread_comment_hides: { hidden_by: string }[] | { hidden_by: string } | null;
  thread_comment_likes: ThreadLike[];
  profiles: Pick<Profile, "display_name" | "id" | "username"> | null;
};

type ThreadLike = {
  user_id: string;
};

type ThreadPageProps = {
  params: Promise<{ id: string }>;
};

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
    <span className="inline-flex items-center gap-1 rounded-md bg-[#171412] px-2 py-1 text-xs font-semibold text-white">
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
  if (thread.visibility === "members" && !viewer.isSignedIn) return false;
  if (thread.is_sensitive && !viewer.isAdultConfirmed) return false;

  return true;
}

async function getThread(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("thread_posts")
    .select(
      "id, body, visibility, is_sensitive, created_at, thread_media(id, storage_bucket, storage_path, media_type, sort_order), thread_likes(user_id), thread_comments(id, body, parent_id, deleted_at, created_at, thread_comment_hides(hidden_by), thread_comment_likes(user_id), profiles:profiles!thread_comments_author_id_fkey(id, display_name, username)), profiles:profiles!thread_posts_author_id_fkey(id, username, display_name, account_type, license_verified_at)",
    )
    .eq("id", id)
    .eq("moderation_status", "active")
    .order("sort_order", {
      ascending: true,
      referencedTable: "thread_media",
    })
    .order("created_at", {
      ascending: false,
      referencedTable: "thread_comments",
    })
    .maybeSingle<ThreadPost>();

  return data;
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
  const shareMedia = thread.thread_media[0];
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

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { id } = await params;
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
  const viewer = {
    isAdultConfirmed: Boolean(
      currentProfile?.is_adult_confirmed &&
        currentProfile.adult_terms_accepted_at,
    ),
    isSignedIn,
  };
  const showThread = canViewThread({ isOwnThread, thread, viewer });
  const media = thread.thread_media[0];
  const mediaSrc = media ? mediaUrl(media.storage_bucket, media.storage_path) : null;
  const liked = thread.thread_likes.some((like) => like.user_id === claims?.sub);
  const returnPath = `/t/${thread.id}`;
  const visibleComments = thread.thread_comments.filter(
    (comment) =>
      !comment.deleted_at && !hasCommentHide(comment.thread_comment_hides),
  );

  return (
    <main className="min-h-screen bg-[#202020] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-5xl bg-[#f2f1ee] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to Gossip"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
                href="/#threads"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Gossip</p>
                <p className="truncate text-xs text-[#766d62]">
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
          <section className="border-b border-[#cfc8bd] bg-[#fffdf9] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-5 text-[#4f473f]">
                Public Gossip preview. Sign in to like, reply, save, follow,
                DM, and view member-only or 18+ sensitive body-art content.
              </p>
              <Link
                className="flex h-10 shrink-0 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                href="/login"
              >
                Sign in
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {media && mediaSrc ? (
              <div className="relative overflow-hidden rounded-md border border-[#3a332d] bg-[#171412] shadow-[0_12px_30px_rgba(23,20,18,0.22)]">
                {showThread ? (
                  <MediaLightbox
                    alt="Gossip thread media"
                    mediaType="image"
                    src={mediaSrc}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className="aspect-[16/10] w-full bg-[#171412] object-contain"
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

            <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-5">
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
                      className="mt-1 block text-sm text-[#766d62] hover:underline"
                      href={`/u/${thread.profiles.username}`}
                    >
                      @{thread.profiles.username}
                    </Link>
                  ) : null}
                </div>
                <span className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 py-1 text-xs font-semibold text-[#766d62]">
                  {timeAgo(thread.created_at)}
                </span>
              </div>

              {showThread ? (
                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[#4f473f]">
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

              {!media ? (
                <div className="mt-5 flex h-24 items-center justify-center rounded-md border border-dashed border-[#cfc8bd] bg-[#fffdf9] text-[#766d62]">
                  <ImageIcon className="mr-2 size-5" />
                  Text thread
                </div>
              ) : null}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4">
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-md bg-[#f7f4ef] p-3">
                  <p className="text-lg font-bold">{thread.thread_likes.length}</p>
                  <p className="text-xs text-[#766d62]">likes</p>
                </div>
                <div className="rounded-md bg-[#f7f4ef] p-3">
                  <p className="text-lg font-bold">
                    {visibleComments.length}
                  </p>
                  <p className="text-xs text-[#766d62]">replies</p>
                </div>
              </div>

              {isSignedIn ? (
                <form action={toggleThreadLike} className="mt-3">
                  <input name="thread_id" type="hidden" value={thread.id} />
                  <input name="liked" type="hidden" value={String(liked)} />
                  <input name="return_path" type="hidden" value={returnPath} />
                  <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                    <Heart
                      className={`size-4 ${liked ? "fill-[#c8953b] text-[#c8953b]" : ""}`}
                    />
                    {liked ? "Liked" : "Like"}
                  </button>
                </form>
              ) : (
                <Link
                  className="mt-3 flex h-11 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                  href="/login"
                >
                  Sign in to like
                </Link>
              )}
            </section>

            {isSignedIn ? (
              <SavedItemButton
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
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

            <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageCircle className="size-4" />
                <h2 className="text-sm font-bold">Replies</h2>
              </div>
              {isSignedIn && showThread ? (
                <form action={createThreadComment} className="mb-4 space-y-2">
                  <input name="thread_id" type="hidden" value={thread.id} />
                  <input name="return_path" type="hidden" value={returnPath} />
                  <WordLimitedField
                    as="textarea"
                    className="min-h-24 w-full rounded-md border border-[#cfc8bd] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
                    emojiShortcuts
                    maxCharacters={2000}
                    maxLength={2000}
                    minTrimmedLength={1}
                    name="body"
                    placeholder="Reply to this Gossip thread"
                    required
                    validationMessage="Reply cannot be empty."
                    wrapperClassName="w-full"
                  />
                  <PendingSubmitButton
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
                    pendingLabel="Replying"
                  >
                    <Send className="size-4" />
                    Reply
                  </PendingSubmitButton>
                </form>
              ) : (
                <Link
                  className="mb-4 flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold"
                  href={isSignedIn ? "/terms" : "/login"}
                >
                  {isSignedIn ? "Confirm 18+ to reply" : "Sign in to reply"}
                </Link>
              )}
              <div className="space-y-3">
                {isSignedIn && showThread && visibleComments.length ? (
                  visibleComments
                    .filter((comment) => !comment.parent_id)
                    .slice(0, 12)
                    .map((comment) => {
                      const likedComment = comment.thread_comment_likes.some(
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
                          className="border-t border-[#e5ded4] pt-3 text-sm"
                          key={comment.id}
                        >
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
                          <p className="mt-1 whitespace-pre-wrap leading-5 text-[#4f473f]">
                            {comment.body}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#766d62]">
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
                                      ? "fill-[#c8953b] text-[#c8953b]"
                                      : ""
                                  }`}
                                />
                                {comment.thread_comment_likes.length}
                              </button>
                            </form>
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
                                  value={returnPath}
                                />
                                <WordLimitedField
                                  className="h-9 w-full rounded-md border border-[#cfc8bd] bg-white px-2 text-xs outline-none focus:border-[#171412]"
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
                                >
                                  <Send className="size-4" />
                                </PendingSubmitButton>
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
                                    className="min-h-20 w-full rounded-md border border-[#cfc8bd] bg-white px-2 py-2 text-xs outline-none focus:border-[#171412]"
                                    defaultValue={comment.body}
                                    maxLength={2000}
                                    name="body"
                                    required
                                  />
                                  <button className="h-8 rounded-md bg-[#171412] px-3 text-xs font-semibold text-white">
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
                            <div className="mt-3 space-y-2 border-l border-[#e5ded4] pl-3">
                              {replies.map((reply) => {
                                const likedReply =
                                  reply.thread_comment_likes.some(
                                    (like) => like.user_id === claims?.sub,
                                  );
                                const isOwnReply =
                                  reply.profiles?.id === claims?.sub;
                                const canModerateReply =
                                  isOwnThread &&
                                  reply.profiles?.id !== claims?.sub;

                                return (
                                  <div
                                    className="rounded-md bg-[#f7f4ef] px-3 py-2 text-xs leading-5 text-[#4f473f]"
                                    key={reply.id}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="min-w-0 flex-1">
                                        <span className="font-semibold text-[#171412]">
                                          {reply.profiles?.display_name ?? "Member"}
                                        </span>{" "}
                                        {reply.body}
                                      </p>
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
                                        <button className="flex items-center gap-1 font-semibold text-[#766d62]">
                                          <Heart
                                            className={`size-3 ${
                                              likedReply
                                                ? "fill-[#c8953b] text-[#c8953b]"
                                                : ""
                                            }`}
                                          />
                                          {reply.thread_comment_likes.length}
                                        </button>
                                      </form>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-3 font-semibold text-[#766d62]">
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
                                              className="min-h-20 w-full rounded-md border border-[#cfc8bd] bg-white px-2 py-2 text-xs outline-none focus:border-[#171412]"
                                              defaultValue={reply.body}
                                              maxLength={2000}
                                              name="body"
                                              required
                                            />
                                            <button className="h-8 rounded-md bg-[#171412] px-3 text-xs font-semibold text-white">
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
                  <p className="rounded-md border border-dashed border-[#cfc8bd] bg-[#fffdf9] p-3 text-sm text-[#766d62]">
                    {isSignedIn && showThread
                      ? "No replies yet."
                      : "Replies are visible after login."}
                  </p>
                )}
              </div>
            </section>

            {isSignedIn ? (
              <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase text-[#766d62]">
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
