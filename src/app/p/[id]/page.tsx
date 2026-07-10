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
  deletePostComment,
  editPostComment,
  hidePostComment,
  togglePostCommentLike,
  togglePostLike,
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

type FeedMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type FeedPost = {
  caption: string | null;
  created_at: string;
  feed_media: FeedMedia[];
  id: string;
  is_sensitive: boolean;
  location_label: string | null;
  post_comments: PostComment[];
  post_likes: PostLike[];
  profiles: Profile | null;
  style_tags: string[];
  visibility: "public_preview" | "members" | "private";
};

type PostComment = {
  body: string;
  created_at: string;
  deleted_at: string | null;
  id: string;
  parent_id: string | null;
  post_comment_hides: { hidden_by: string }[];
  post_comment_likes: PostLike[];
  profiles: Pick<Profile, "display_name" | "id" | "username"> | null;
};

type PostLike = {
  user_id: string;
};

type PostPageProps = {
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
  if (post.visibility === "members" && !viewer.isSignedIn) return false;
  if (post.is_sensitive && !viewer.isAdultConfirmed) return false;

  return true;
}

async function getPost(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feed_posts")
    .select(
      "id, caption, style_tags, location_label, visibility, is_sensitive, created_at, feed_media(id, storage_bucket, storage_path, media_type, sort_order), post_likes(user_id), post_comments(id, body, parent_id, deleted_at, created_at, post_comment_hides(hidden_by), post_comment_likes(user_id), profiles:profiles!post_comments_author_id_fkey(id, display_name, username)), profiles:profiles!feed_posts_author_id_fkey(id, username, display_name, account_type, license_verified_at)",
    )
    .eq("id", id)
    .eq("is_published", true)
    .eq("moderation_status", "active")
    .order("sort_order", {
      ascending: true,
      referencedTable: "feed_media",
    })
    .order("created_at", {
      ascending: false,
      referencedTable: "post_comments",
    })
    .maybeSingle<FeedPost>();

  return data;
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
  const shareMedia = post.feed_media.find((media) => media.media_type === "image");
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

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
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
  const viewer = {
    isAdultConfirmed: Boolean(
      currentProfile?.is_adult_confirmed &&
        currentProfile.adult_terms_accepted_at,
    ),
    isSignedIn,
  };
  const showPost = canViewPost({ isOwnPost, post, viewer });
  const media = post.feed_media[0];
  const mediaSrc = media ? mediaUrl(media.storage_bucket, media.storage_path) : null;
  const liked = post.post_likes.some((like) => like.user_id === claims?.sub);
  const returnPath = `/p/${post.id}`;
  const visibleComments = post.post_comments.filter(
    (comment) => !comment.deleted_at && !comment.post_comment_hides.length,
  );

  return (
    <main className="min-h-screen bg-[#202020] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-5xl bg-[#f2f1ee] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to 4U"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
                href="/#feed"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">4U</p>
                <p className="truncate text-xs text-[#766d62]">
                  {post.profiles?.display_name ?? "TheTattooCore member"}
                </p>
              </div>
            </div>
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        {!isSignedIn && post.visibility === "public_preview" && !post.is_sensitive ? (
          <section className="border-b border-[#cfc8bd] bg-[#fffdf9] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-5 text-[#4f473f]">
                Public 4U preview. Sign in to like, comment, save, follow, DM,
                and view member-only or 18+ sensitive body-art content.
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
          <div>
            <div className="relative overflow-hidden rounded-md border border-[#3a332d] bg-[#171412] shadow-[0_12px_30px_rgba(23,20,18,0.22)]">
              {media && mediaSrc ? (
                media.media_type === "video" ? (
                  showPost ? (
                    <MediaLightbox mediaType="video" src={mediaSrc}>
                      <video
                        className="aspect-[4/5] w-full bg-[#171412] object-contain"
                        controls
                        playsInline
                        preload="metadata"
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
                      className="aspect-[4/5] w-full bg-[#171412] object-contain"
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

            <section className="ttc-card mt-5 rounded-md border border-[#cfc8bd] bg-white p-5">
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
                      className="mt-1 block text-sm text-[#766d62] hover:underline"
                      href={`/u/${post.profiles.username}`}
                    >
                      @{post.profiles.username}
                    </Link>
                  ) : null}
                </div>
                <span className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-2 py-1 text-xs font-semibold text-[#766d62]">
                  {timeAgo(post.created_at)}
                </span>
              </div>

              {showPost ? (
                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[#4f473f]">
                  {post.caption || "Untitled 4U post"}
                </p>
              ) : (
                <p className="mt-5 text-sm leading-6 text-[#766d62]">
                  This post is limited to members or confirmed 18+ viewers.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#4f473f]">
                {post.style_tags.map((tag) => (
                  <span className="rounded-md bg-[#efe7da] px-2 py-1" key={tag}>
                    {tag}
                  </span>
                ))}
                {post.location_label ? (
                  <span className="rounded-md bg-[#f7f4ef] px-2 py-1">
                    {post.location_label}
                  </span>
                ) : null}
                {media?.media_type === "video" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#f7f4ef] px-2 py-1">
                    <Video className="size-3.5" />
                    Reel
                  </span>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4">
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-md bg-[#f7f4ef] p-3">
                  <p className="text-lg font-bold">{post.post_likes.length}</p>
                  <p className="text-xs text-[#766d62]">likes</p>
                </div>
                <div className="rounded-md bg-[#f7f4ef] p-3">
                  <p className="text-lg font-bold">{visibleComments.length}</p>
                  <p className="text-xs text-[#766d62]">comments</p>
                </div>
              </div>

              {isSignedIn ? (
                <form action={togglePostLike} className="mt-3">
                  <input name="post_id" type="hidden" value={post.id} />
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
                subjectId={post.id}
                subjectType="feed_post"
              />
            ) : null}

            <ShareActions
              text={`Check this 4U post on ${siteName}`}
              title={`4U post by ${post.profiles?.display_name ?? siteName}`}
              url={`${siteUrl}/p/${post.id}`}
            />

            <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageCircle className="size-4" />
                <h2 className="text-sm font-bold">Comments</h2>
              </div>
              {isSignedIn && showPost ? (
                <form action={createPostComment} className="mb-4 space-y-2">
                  <input name="post_id" type="hidden" value={post.id} />
                  <input name="return_path" type="hidden" value={returnPath} />
                  <WordLimitedField
                    className="h-10 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    emojiShortcuts
                    maxLength={220}
                    maxWords={40}
                    minTrimmedLength={1}
                    name="body"
                    placeholder="Add a short comment"
                    required
                    validationMessage="Comment cannot be empty."
                    wrapperClassName="w-full"
                  />
                  <PendingSubmitButton
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
                    pendingLabel="Posting"
                  >
                    <Send className="size-4" />
                    Post comment
                  </PendingSubmitButton>
                </form>
              ) : (
                <Link
                  className="mb-4 flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold"
                  href={isSignedIn ? "/terms" : "/login"}
                >
                  {isSignedIn ? "Confirm 18+ to comment" : "Sign in to comment"}
                </Link>
              )}
              <div className="space-y-3">
                {isSignedIn && showPost && visibleComments.length ? (
                  visibleComments
                    .filter((comment) => !comment.parent_id)
                    .slice(0, 12)
                    .map((comment) => {
                      const likedComment = comment.post_comment_likes.some(
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
                          <p className="mt-1 leading-5 text-[#4f473f]">
                            {comment.body}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#766d62]">
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
                                      ? "fill-[#c8953b] text-[#c8953b]"
                                      : ""
                                  }`}
                                />
                                {comment.post_comment_likes.length}
                              </button>
                            </form>
                            <details>
                              <summary className="cursor-pointer list-none">
                                Reply
                              </summary>
                              <form
                                action={createPostComment}
                                className="mt-2 flex items-start gap-2"
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
                                <WordLimitedField
                                  className="h-9 w-full rounded-md border border-[#cfc8bd] bg-white px-2 text-xs outline-none focus:border-[#171412]"
                                  emojiShortcuts
                                  maxLength={220}
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
                                    className="h-9 w-full rounded-md border border-[#cfc8bd] bg-white px-2 text-xs outline-none focus:border-[#171412]"
                                    defaultValue={comment.body}
                                    maxLength={220}
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
                            <div className="mt-3 space-y-2 border-l border-[#e5ded4] pl-3">
                              {replies.map((reply) => {
                                const likedReply = reply.post_comment_likes.some(
                                  (like) => like.user_id === claims?.sub,
                                );
                                const isOwnReply =
                                  reply.profiles?.id === claims?.sub;
                                const canModerateReply =
                                  isOwnPost && reply.profiles?.id !== claims?.sub;

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
                                        <button className="flex items-center gap-1 font-semibold text-[#766d62]">
                                          <Heart
                                            className={`size-3 ${
                                              likedReply
                                                ? "fill-[#c8953b] text-[#c8953b]"
                                                : ""
                                            }`}
                                          />
                                          {reply.post_comment_likes.length}
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
                                              className="h-9 w-full rounded-md border border-[#cfc8bd] bg-white px-2 text-xs outline-none focus:border-[#171412]"
                                              defaultValue={reply.body}
                                              maxLength={220}
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
                  <p className="rounded-md border border-dashed border-[#cfc8bd] bg-[#fffdf9] p-3 text-sm text-[#766d62]">
                    {isSignedIn && showPost
                      ? "No comments yet."
                      : "Comments are visible after login."}
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
