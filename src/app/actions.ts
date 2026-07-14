"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MediaMetadata } from "@/lib/media/metadata";
import { inspectMediaFile, validateMediaMetadata } from "@/lib/media/metadata";
import {
  allowsInAppNotification,
  notificationPreferenceSelect,
  type NotificationPreferenceProfile,
} from "@/lib/notifications";
import { calculatePlatformFeeCents } from "@/lib/payments/fees";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanExternalUrl } from "@/lib/urls";
import { isVerifiedProfessional } from "@/lib/verification";

const MEDIA_BUCKET = "tattoo-media";
const VISIBILITY_VALUES = new Set(["public_preview", "members", "private"]);
const REPORT_SUBJECT_TYPES = new Set([
  "comment",
  "profile",
  "feed_post",
  "gig",
  "thread_post",
  "marketplace_listing",
  "merch_product",
  "story_post",
]);
const SAVED_SUBJECT_TYPES = new Set([
  "feed_post",
  "gig",
  "marketplace_listing",
  "merch_product",
  "profile",
  "thread_post",
]);
const STORY_REACTIONS = new Set([
  "clap",
  "fire",
  "flash",
  "heart",
  "hundred",
  "sparkles",
]);
const STORY_REACTION_LABELS: Record<string, string> = {
  clap: "clapped for your story",
  fire: "reacted fire to your story",
  flash: "sent a flash reaction to your story",
  heart: "loved your story",
  hundred: "reacted 100 to your story",
  sparkles: "sent sparkles to your story",
};
const MERCH_CATEGORIES = new Set([
  "accessory",
  "apparel",
  "art",
  "official",
  "other",
  "print",
  "sticker",
]);
const REPORT_REASONS = new Set([
  "sensitive non-nude body-art",
  "body-art nudity context",
  "sexual content",
  "minor safety concern",
  "harassment or hate",
  "scam or spam",
  "unsafe practice",
  "illegal goods or services",
  "other",
]);
const REPORT_SUBJECT_CONFIG = {
  feed_post: { ownerColumn: "author_id", table: "feed_posts" },
  gig: { ownerColumn: "poster_id", table: "gigs" },
  marketplace_listing: { ownerColumn: "seller_id", table: "marketplace_listings" },
  merch_product: { ownerColumn: "seller_id", table: "merch_products" },
  profile: { ownerColumn: "id", table: "profiles" },
  story_post: { ownerColumn: "author_id", table: "story_posts" },
  thread_post: { ownerColumn: "author_id", table: "thread_posts" },
} as const;

type ReportSubjectType = keyof typeof REPORT_SUBJECT_CONFIG | "comment";
type SavedSubjectType =
  | "feed_post"
  | "gig"
  | "marketplace_listing"
  | "merch_product"
  | "profile"
  | "thread_post";

type Claims = {
  sub: string;
};

function homeMessage(message: string, hash?: string) {
  return `/?message=${encodeURIComponent(message)}${hash ? `#${hash}` : ""}`;
}

function hashForMediaKind(kind: "feed" | "gig" | "marketplace" | "story" | "thread") {
  if (kind === "thread") return "threads";
  if (kind === "story") return "stories";

  return kind;
}

function redirectWithMessage({
  hash,
  message,
  path,
}: {
  hash?: string;
  message: string;
  path: string;
}) {
  const cleanPath =
    path.startsWith("/") && !path.startsWith("//") && !path.includes("://")
      ? path
      : "/";
  const cleanHash = hash?.replace(/[^a-z0-9_-]/gi, "");

  return `${cleanPath}?message=${encodeURIComponent(message)}${
    cleanHash ? `#${cleanHash}` : ""
  }`;
}

function cleanReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const path = cleanText(value, 220) || fallback;

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }

  return path;
}

function revalidateReturnPath(path: string) {
  const pathname = path.split("#")[0]?.split("?")[0] || "/";

  revalidatePath(pathname.startsWith("/") ? pathname : "/");
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanWords(value: FormDataEntryValue | null, maxWords: number) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

function cleanId(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function cleanMoneyCents(value: FormDataEntryValue | null) {
  const normalized = cleanText(value, 20).replace(/[$,]/g, "");
  const parsed = normalized ? Number(normalized) : 0;

  if (!Number.isFinite(parsed) || parsed <= 0) return 0;

  return Math.min(500000, Math.round(parsed * 100));
}

async function findExistingConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetId: string,
) {
  const { data: myMemberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  const conversationIds =
    myMemberships?.map((membership) => membership.conversation_id) ?? [];

  if (!conversationIds.length) return null;

  const { data: targetMembership } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", targetId)
    .in("conversation_id", conversationIds)
    .limit(1)
    .maybeSingle<{ conversation_id: string }>();

  return targetMembership?.conversation_id ?? null;
}

async function ensureDirectConversation({
  supabase,
  targetId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  userId: string;
}) {
  const existingConversationId = await findExistingConversation(
    supabase,
    userId,
    targetId,
  );

  if (existingConversationId) return existingConversationId;

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({ created_by: userId })
    .select("id")
    .single<{ id: string }>();

  if (conversationError || !conversation) {
    throw new Error(conversationError?.message || "Could not start DM.");
  }

  const { error: creatorMemberError } = await supabase
    .from("conversation_members")
    .insert({ conversation_id: conversation.id, user_id: userId });

  if (creatorMemberError) {
    throw new Error(creatorMemberError.message || "Could not add you to DM.");
  }

  const { error: targetMemberError } = await supabase
    .from("conversation_members")
    .insert({ conversation_id: conversation.id, user_id: targetId });

  if (targetMemberError) {
    throw new Error(targetMemberError.message || "Could not add member to DM.");
  }

  return conversation.id;
}

async function blockRelationshipExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetId: string,
) {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`,
    )
    .limit(1)
    .maybeSingle<{ blocker_id: string }>();

  return Boolean(data);
}

export async function acceptAdultTerms(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const returnPath = cleanReturnPath(formData.get("return_path"), "/");
  const returnHash = cleanText(formData.get("return_hash"), 40);
  const now = new Date().toISOString();
  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      adult_terms_accepted_at: now,
      is_adult_confirmed: true,
      updated_at: now,
    })
    .eq("id", claims.sub)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !profile) {
    redirect(
      redirectWithMessage({
        hash: returnHash,
        message: error?.message || "Finish your profile before accepting 18+ terms.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidateReturnPath(returnPath);
  redirect(
    redirectWithMessage({
      hash: returnHash,
      message: "18+ terms accepted. Sensitive non-nude body-art content can now be shown.",
      path: returnPath,
    }),
  );
}

function cleanReportReason(value: FormDataEntryValue | null) {
  const reason = cleanText(value, 120);

  return REPORT_REASONS.has(reason) ? reason : "other";
}

function reportRedirect({
  hash,
  message,
  path,
}: {
  hash?: string;
  message: string;
  path: string;
}): never {
  redirect(
    redirectWithMessage({
      hash,
      message,
      path,
    }),
  );
}

async function findCommentSubjectOwner({
  commentId,
  supabase,
}: {
  commentId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const postComment = await supabase
    .from("post_comments")
    .select("author_id")
    .eq("id", commentId)
    .maybeSingle<{ author_id: string }>();

  if (postComment.data || postComment.error) return postComment;

  return supabase
    .from("thread_comments")
    .select("author_id")
    .eq("id", commentId)
    .maybeSingle<{ author_id: string }>();
}

async function removeFollowRelationship({
  blockedId,
  blockerId,
  supabase,
}: {
  blockedId: string;
  blockerId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  await supabase
    .from("follows")
    .delete()
    .or(
      `and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`,
    );
}

function cleanVisibility(
  value: FormDataEntryValue | null,
  fallback: "public_preview" | "members" | "private",
) {
  const text = cleanText(value, 32);

  return VISIBILITY_VALUES.has(text) ? text : fallback;
}

function sensitiveFields() {
  // Launch policy: visible nudity is not allowed, so new upload forms do not
  // expose a sensitive-content bypass. Keep legacy columns false by default.
  return {
    is_sensitive: false,
    sensitive_reason: null,
  };
}

function mediaFromForm(formData: FormData, name: string) {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName.slice(0, 12);
  }

  return file.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
}

async function requireProfile() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, banned_at, suspended_at")
    .eq("id", claims.sub)
    .maybeSingle<{ banned_at: string | null; id: string; suspended_at: string | null }>();

  if (!profile) {
    redirect("/account");
  }

  if (profile.banned_at) {
    redirect(homeMessage("This account is banned from member actions."));
  }

  if (profile.suspended_at) {
    redirect(homeMessage("This account is suspended from member actions."));
  }

  return { supabase, userId: claims.sub };
}

async function currentDisplayName({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle<{ display_name: string }>();

  return profile?.display_name ?? "A member";
}

async function notifyContentOwner({
  actorId,
  body,
  href,
  ownerId,
  subjectId,
  subjectType,
  supabase,
  title,
  type,
}: {
  actorId: string;
  body: string;
  href: string;
  ownerId: string | null | undefined;
  subjectId: string;
  subjectType: "feed_post" | "thread_post";
  supabase: Awaited<ReturnType<typeof createClient>>;
  title: string;
  type: "feed_like" | "feed_comment" | "thread_like" | "thread_comment";
}) {
  if (!ownerId || ownerId === actorId) return;
  if (await blockRelationshipExists(supabase, actorId, ownerId)) return;

  const preferenceCategory =
    type === "feed_like" || type === "feed_comment" ? "feed" : "thread";
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select(notificationPreferenceSelect(preferenceCategory))
    .eq("id", ownerId)
    .maybeSingle<NotificationPreferenceProfile>();

  if (!allowsInAppNotification(ownerProfile, preferenceCategory)) return;

  const { error } = await supabase.from("notifications").insert({
    actor_id: actorId,
    body: body.slice(0, 240),
    href,
    recipient_id: ownerId,
    subject_id: subjectId,
    subject_type: subjectType,
    title,
    type,
  });

  if (!error) {
    revalidatePath("/notifications");
  }
}

async function uploadPostMedia({
  file,
  id,
  kind,
  metadata,
  supabase,
  userId,
}: {
  file: File;
  id: string;
  kind: "feed" | "gig" | "marketplace" | "story" | "thread";
  metadata: MediaMetadata;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const path = `${userId}/${kind}/${id}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: metadata.mimeType,
    upsert: false,
  });

  if (error) {
    redirect(
      homeMessage(
        error.message || "Could not upload media.",
        hashForMediaKind(kind),
      ),
    );
  }

  return {
    bucket: MEDIA_BUCKET,
    mediaType: metadata.mediaType,
    path,
  };
}

async function uploadCommentMedia({
  commentId,
  file,
  metadata,
  supabase,
  userId,
}: {
  commentId: string;
  file: File;
  metadata: MediaMetadata;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const path = `${userId}/comment/${commentId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: metadata.mimeType,
    upsert: false,
  });

  if (error) {
    return {
      bucket: MEDIA_BUCKET,
      error: error.message || "Could not upload comment media.",
      mediaType: metadata.mediaType,
      path: null,
    };
  }

  return {
    bucket: MEDIA_BUCKET,
    error: null,
    mediaType: metadata.mediaType,
    path,
  };
}

function mediaMetadataFields(metadata: MediaMetadata) {
  return {
    duration_seconds: metadata.durationSeconds,
    file_size_bytes: metadata.fileSizeBytes,
    height: metadata.height,
    mime_type: metadata.mimeType,
    original_filename: metadata.originalFilename,
    width: metadata.width,
  };
}

function storyMediaMetadataFields(metadata: MediaMetadata) {
  return {
    duration_seconds: metadata.durationSeconds,
    file_size_bytes: metadata.fileSizeBytes,
    height: metadata.height,
    mime_type: metadata.mimeType,
    original_filename: metadata.originalFilename,
    width: metadata.width,
  };
}

export async function createFeedPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const caption = cleanWords(formData.get("caption"), 40);
  const locationLabel = cleanText(formData.get("location_label"), 80);
  const media = mediaFromForm(formData, "media");
  const sensitive = sensitiveFields();
  const visibility = cleanVisibility(formData.get("visibility"), "public_preview");
  const styleTags = cleanText(formData.get("style_tags"), 160)
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

  if (caption.length < 3) {
    redirect(homeMessage("Feed post needs at least 3 characters.", "feed"));
  }

  if (!media) {
    redirect(homeMessage("Feed posts need a photo or reel.", "feed"));
  }

  const metadata = await inspectMediaFile(media);
  const validationMessage = validateMediaMetadata(metadata);

  if (validationMessage) {
    redirect(homeMessage(validationMessage, "feed"));
  }

  const { data: post, error } = await supabase
    .from("feed_posts")
    .insert({
      author_id: userId,
      caption,
      is_indexable: visibility === "public_preview" && !sensitive.is_sensitive,
      is_sensitive: sensitive.is_sensitive,
      kind: metadata.mediaType === "video" ? "reel" : "photo",
      location_label: locationLabel || null,
      moderation_status: "active",
      sensitive_reason: sensitive.sensitive_reason,
      style_tags: styleTags,
      visibility,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(
      homeMessage(error.message || "Could not publish feed post.", "feed"),
    );
  }

  if (media && post) {
    const upload = await uploadPostMedia({
      file: media,
      id: post.id,
      kind: "feed",
      metadata,
      supabase,
      userId,
    });
    const { error: mediaError } = await supabase.from("feed_media").insert({
      ...mediaMetadataFields(metadata),
      media_type: upload.mediaType,
      post_id: post.id,
      is_sensitive: sensitive.is_sensitive,
      sensitive_reason: sensitive.sensitive_reason,
      storage_bucket: upload.bucket,
      storage_path: upload.path,
    });

    if (mediaError) {
      redirect(
        homeMessage(
          mediaError.message || "Media uploaded but could not attach to the post.",
          "feed",
        ),
      );
    }
  }

  revalidatePath("/");
  redirect(homeMessage("Feed post published.", "feed"));
}

export async function createStoryPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const caption = cleanText(formData.get("caption"), 240);
  const media = mediaFromForm(formData, "media");
  const visibility = cleanVisibility(formData.get("visibility"), "members");

  if (!media) {
    redirect(homeMessage("Stories need a photo, GIF, or short video.", "stories"));
  }

  const metadata = await inspectMediaFile(media);
  const validationMessage = validateMediaMetadata(metadata);

  if (validationMessage) {
    redirect(homeMessage(validationMessage, "stories"));
  }

  if (metadata.mediaType === "video" && metadata.fileSizeBytes > 25 * 1024 * 1024) {
    redirect(homeMessage("Story videos can be up to 25 MB for now.", "stories"));
  }

  if (
    metadata.mediaType === "video" &&
    metadata.durationSeconds != null &&
    metadata.durationSeconds > 15
  ) {
    redirect(homeMessage("Story videos can be up to 15 seconds for now.", "stories"));
  }

  const storyId = crypto.randomUUID();
  const storagePath = `${userId}/story/${storyId}/${crypto.randomUUID()}.${extensionFor(media)}`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, media, {
      cacheControl: "31536000",
      contentType: metadata.mimeType,
      upsert: false,
    });

  if (uploadError) {
    redirect(homeMessage(uploadError.message || "Could not upload story media.", "stories"));
  }

  const { data: story, error } = await supabase
    .from("story_posts")
    .insert({
      id: storyId,
      author_id: userId,
      caption: caption || null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      is_sensitive: false,
      moderation_status: "active",
      sensitive_reason: null,
      visibility,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !story) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    redirect(homeMessage(error?.message || "Could not create story.", "stories"));
  }

  const { error: mediaError } = await supabase.from("story_media").insert({
    story_id: story.id,
    media_type: metadata.mediaType,
    sort_order: 0,
    storage_bucket: MEDIA_BUCKET,
    storage_path: storagePath,
    ...storyMediaMetadataFields(metadata),
  });

  if (mediaError) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    await supabase.from("story_posts").delete().eq("id", story.id).eq("author_id", userId);
    redirect(homeMessage(mediaError.message || "Could not attach story media.", "stories"));
  }

  revalidatePath("/");
  redirect(homeMessage("Story posted for 24 hours.", "stories"));
}

export async function endStoryPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const storyId = cleanId(formData.get("story_id"));
  const writeClient = createAdminClient() ?? supabase;

  if (!storyId) {
    redirect(homeMessage("Choose a story first.", "stories"));
  }

  const { error } = await writeClient
    .from("story_posts")
    .update({
      moderation_status: "hidden",
    })
    .eq("id", storyId)
    .eq("author_id", userId);

  if (error) {
    redirect(homeMessage(error.message || "Could not end that story.", "stories"));
  }

  revalidatePath("/");
  redirect(homeMessage("Story ended.", "stories"));
}

export async function recordStoryView(storyId: string) {
  const cleanStoryId = String(storyId ?? "").trim();

  if (!cleanStoryId) return;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) return;

  const { data: story } = await supabase
    .from("story_posts")
    .select("id, author_id, expires_at, moderation_status")
    .eq("id", cleanStoryId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{
      author_id: string;
      expires_at: string;
      id: string;
      moderation_status: string;
    }>();

  if (!story || story.author_id === claims.sub || story.moderation_status !== "active") {
    return;
  }

  await supabase.from("story_views").upsert(
    {
      story_id: cleanStoryId,
      viewed_at: new Date().toISOString(),
      viewer_id: claims.sub,
    },
    {
      onConflict: "story_id,viewer_id",
    },
  );
}

export async function toggleStoryReaction(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const storyId = cleanId(formData.get("story_id"));
  const reaction = cleanText(formData.get("reaction"), 20);

  if (!storyId) {
    redirect(homeMessage("Choose a story to react to.", "stories"));
  }

  if (!STORY_REACTIONS.has(reaction)) {
    redirect(homeMessage("Choose a valid story reaction.", "stories"));
  }

  const { data: story, error: storyError } = await supabase
    .from("story_posts")
    .select("id, author_id, expires_at, moderation_status")
    .eq("id", storyId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{
      author_id: string;
      expires_at: string;
      id: string;
      moderation_status: string;
    }>();

  if (storyError || !story || story.moderation_status !== "active") {
    redirect(homeMessage("That story is no longer available.", "stories"));
  }

  if (story.author_id === userId) {
    redirect(homeMessage("You cannot react to your own story.", "stories"));
  }

  if (await blockRelationshipExists(supabase, userId, story.author_id)) {
    redirect(homeMessage("You cannot react to a blocked profile.", "stories"));
  }

  const { data: existingReaction } = await supabase
    .from("story_reactions")
    .select("reaction")
    .eq("story_id", storyId)
    .eq("reactor_id", userId)
    .maybeSingle<{ reaction: string }>();

  if (existingReaction?.reaction === reaction) {
    await supabase
      .from("story_reactions")
      .delete()
      .eq("story_id", storyId)
      .eq("reactor_id", userId);
    revalidatePath("/");
    redirect(homeMessage("Story reaction removed.", "stories"));
  }

  const { error } = await supabase.from("story_reactions").upsert(
    {
      reaction,
      story_id: storyId,
      reactor_id: userId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "story_id,reactor_id",
    },
  );

  if (error) {
    redirect(homeMessage(error.message || "Could not react to that story.", "stories"));
  }

  const [{ data: senderProfile }, { data: authorPreferences }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle<{ display_name: string }>(),
    supabase
      .from("profiles")
      .select(notificationPreferenceSelect("feed"))
      .eq("id", story.author_id)
      .maybeSingle<NotificationPreferenceProfile>(),
  ]);

  if (allowsInAppNotification(authorPreferences, "feed")) {
    await supabase.from("notifications").insert({
      actor_id: userId,
      body: STORY_REACTION_LABELS[reaction] ?? "reacted to your story",
      href: "/#stories",
      recipient_id: story.author_id,
      subject_id: story.id,
      subject_type: "story_post",
      title: `Story reaction from ${senderProfile?.display_name ?? "a member"}`.slice(
        0,
        120,
      ),
      type: "story_reaction",
    });
  }

  revalidatePath("/");
  revalidatePath("/notifications");
  redirect(homeMessage("Story reaction sent.", "stories"));
}

export async function replyToStory(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const storyId = cleanId(formData.get("story_id"));
  const body = cleanText(formData.get("body"), 500);

  if (!storyId) {
    redirect(homeMessage("Choose a story to reply to.", "stories"));
  }

  if (body.length < 1) {
    redirect(homeMessage("Write a story reply first.", "stories"));
  }

  const { data: story, error: storyError } = await supabase
    .from("story_posts")
    .select(
      "id, author_id, caption, expires_at, moderation_status, profiles:profiles!story_posts_author_id_fkey(username, display_name)",
    )
    .eq("id", storyId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{
      author_id: string;
      caption: string | null;
      expires_at: string;
      id: string;
      moderation_status: string;
      profiles: {
        display_name: string;
        username: string;
      } | null;
    }>();

  if (storyError || !story || story.moderation_status !== "active") {
    redirect(homeMessage("That story is no longer available.", "stories"));
  }

  if (story.author_id === userId) {
    redirect(homeMessage("You cannot DM yourself from your own story.", "stories"));
  }

  if (await blockRelationshipExists(supabase, userId, story.author_id)) {
    redirect(homeMessage("You cannot reply to a blocked profile.", "stories"));
  }

  let conversationId: string;

  try {
    conversationId = await ensureDirectConversation({
      supabase,
      targetId: story.author_id,
      userId,
    });
  } catch (error) {
    redirect(
      homeMessage(
        error instanceof Error ? error.message : "Could not open a DM for that story.",
        "stories",
      ),
    );
  }

  const messageBody = `Story reply: ${body}`.slice(0, 4000);
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      body: messageBody,
      conversation_id: conversationId,
      sender_id: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (messageError || !message) {
    redirect(
      homeMessage(messageError?.message || "Could not send story reply.", "stories"),
    );
  }

  const [{ data: senderProfile }, { data: authorPreferences }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle<{ display_name: string }>(),
    supabase
      .from("profiles")
      .select(notificationPreferenceSelect("message"))
      .eq("id", story.author_id)
      .maybeSingle<NotificationPreferenceProfile>(),
  ]);

  if (allowsInAppNotification(authorPreferences, "message")) {
    await supabase.from("notifications").insert({
      actor_id: userId,
      body: body.slice(0, 160),
      href: `/messages?c=${conversationId}`,
      recipient_id: story.author_id,
      subject_id: story.id,
      subject_type: "story_post",
      title: `Story reply from ${senderProfile?.display_name ?? "a member"}`.slice(0, 120),
      type: "message",
    });
  }

  revalidatePath("/");
  revalidatePath("/messages");
  revalidatePath("/notifications");
  redirect(homeMessage(`Reply sent to ${story.profiles?.display_name ?? "story owner"}.`, "stories"));
}

export async function createBookingRequest(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const artistId = cleanId(formData.get("artist_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/");
  const title = cleanText(formData.get("title"), 120);
  const body = cleanText(formData.get("body"), 2000);
  const placement = cleanText(formData.get("placement"), 120);
  const styleTags = cleanText(formData.get("style_tags"), 160);
  const preferredCity = cleanText(formData.get("preferred_city"), 120);
  const preferredDates = cleanText(formData.get("preferred_dates"), 240);
  const depositAmountCents = cleanMoneyCents(formData.get("deposit_amount"));
  const platformFeeCents = calculatePlatformFeeCents(depositAmountCents);
  const totalCents = depositAmountCents + platformFeeCents;

  if (!artistId || artistId === userId) {
    redirect(
      redirectWithMessage({
        hash: "booking-request",
        message: "Choose a verified artist or studio for booking.",
        path: returnPath,
      }),
    );
  }

  if (title.length < 3 || body.length < 10) {
    redirect(
      redirectWithMessage({
        hash: "booking-request",
        message: "Add a title and at least 10 characters of booking details.",
        path: returnPath,
      }),
    );
  }

  const { data: artist, error: artistError } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, account_type, license_verified_at, shop_profile_id, suspended_at, banned_at",
    )
    .eq("id", artistId)
    .maybeSingle<{
      account_type: string;
      banned_at: string | null;
      display_name: string;
      id: string;
      license_verified_at: string | null;
      shop_profile_id: string | null;
      suspended_at: string | null;
      username: string;
    }>();

  if (
    artistError ||
    !artist ||
    !["artist", "studio"].includes(artist.account_type) ||
    !artist.license_verified_at ||
    artist.suspended_at ||
    artist.banned_at
  ) {
    redirect(
      redirectWithMessage({
        hash: "booking-request",
        message: "Booking requests are available for verified artists and studios.",
        path: returnPath,
      }),
    );
  }

  if (await blockRelationshipExists(supabase, userId, artist.id)) {
    redirect(
      redirectWithMessage({
        hash: "booking-request",
        message: "You cannot send a booking request to a blocked profile.",
        path: returnPath,
      }),
    );
  }

  let conversationId: string;

  try {
    conversationId = await ensureDirectConversation({
      supabase,
      targetId: artist.id,
      userId,
    });
  } catch (error) {
    redirect(
      redirectWithMessage({
        hash: "booking-request",
        message:
          error instanceof Error
            ? error.message
            : "Could not open a DM for this booking request.",
        path: returnPath,
      }),
    );
  }

  const { data: booking, error } = await supabase
    .from("booking_requests")
    .insert({
      artist_id: artist.id,
      body,
      client_id: userId,
      conversation_id: conversationId,
      currency: "USD",
      deposit_amount_cents: depositAmountCents,
      payment_status: "not_ready",
      placement: placement || null,
      platform_fee_cents: platformFeeCents,
      preferred_city: preferredCity || null,
      preferred_dates: preferredDates || null,
      shop_profile_id:
        artist.account_type === "artist" ? artist.shop_profile_id : artist.id,
      status: "requested",
      style_tags: styleTags || null,
      title,
      total_cents: totalCents,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !booking) {
    redirect(
      redirectWithMessage({
        hash: "booking-request",
        message: error?.message || "Could not send booking request.",
        path: returnPath,
      }),
    );
  }

  await supabase.from("messages").insert({
    body: `Booking request: ${title}. ${depositAmountCents > 0 ? `Requested deposit ${(depositAmountCents / 100).toLocaleString("en-US", { currency: "USD", style: "currency" })} plus TTC fee.` : "No deposit requested yet."}`,
    conversation_id: conversationId,
    sender_id: userId,
  });

  const { data: artistPreferences } = await supabase
    .from("profiles")
    .select(notificationPreferenceSelect("message"))
    .eq("id", artist.id)
    .maybeSingle<NotificationPreferenceProfile>();

  if (allowsInAppNotification(artistPreferences, "message")) {
    await supabase.from("notifications").insert({
      actor_id: userId,
      body:
        depositAmountCents > 0
          ? `Requested deposit: $${(depositAmountCents / 100).toFixed(2)} plus TTC processing fee.`
          : "No deposit requested yet.",
      href: `/messages?c=${conversationId}`,
      recipient_id: artist.id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title: "New booking request",
      type: "booking_request",
    });
  }

  revalidateReturnPath(returnPath);
  revalidatePath("/messages");
  revalidatePath("/notifications");
  redirect(
    redirectWithMessage({
      hash: "booking-request",
      message: `Booking request sent to ${artist.display_name}. Deposit checkout opens after they accept.`,
      path: returnPath,
    }),
  );
}

export async function editFeedPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const postId = cleanId(formData.get("post_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#feed");
  const caption = cleanWords(formData.get("caption"), 40);
  const locationLabel = cleanText(formData.get("location_label"), 80);
  const styleTags = cleanText(formData.get("style_tags"), 160)
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

  if (!postId) {
    redirect(redirectWithMessage({ message: "Choose a 4U post first.", path: returnPath }));
  }

  if (caption.length < 3) {
    redirect(
      redirectWithMessage({
        message: "4U caption needs at least 3 characters.",
        path: returnPath,
      }),
    );
  }

  const { data: updatedPost, error } = await supabase
    .from("feed_posts")
    .update({
      caption,
      location_label: locationLabel || null,
      style_tags: styleTags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("author_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updatedPost) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not edit 4U post. It may be gone or owned by another account.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/p/${postId}`);
  redirect(
    redirectWithMessage({
      message: "4U post updated.",
      path: returnPath,
    }),
  );
}

export async function deleteFeedPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const postId = cleanId(formData.get("post_id"));
  const returnPath = cleanText(formData.get("return_path"), 200) || "/#feed";

  if (!postId) {
    redirect(redirectWithMessage({ message: "Choose a 4U post first.", path: returnPath }));
  }

  const { data: deletedPost, error } = await supabase
    .from("feed_posts")
    .update({
      is_indexable: false,
      moderation_status: "removed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("author_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !deletedPost) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not delete 4U post. It may be gone or owned by another account.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/p/${postId}`);
  redirect(homeMessage("4U post deleted.", "feed"));
}

export async function createThreadPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const body = cleanText(formData.get("body"), 8000);
  const media = mediaFromForm(formData, "media");
  const metadata = media ? await inspectMediaFile(media) : null;
  const sensitive = sensitiveFields();
  const visibility = cleanVisibility(formData.get("visibility"), "members");

  if (body.length < 3) {
    redirect(homeMessage("Thread post needs at least 3 characters.", "threads"));
  }

  if (metadata) {
    const validationMessage = validateMediaMetadata(metadata);

    if (validationMessage) {
      redirect(homeMessage(validationMessage, "threads"));
    }
  }

  if (metadata && metadata.mediaType !== "image") {
    redirect(homeMessage("Thread posts support images right now.", "threads"));
  }

  const { data: thread, error } = await supabase
    .from("thread_posts")
    .insert({
      author_id: userId,
      body,
      is_indexable: visibility === "public_preview" && !sensitive.is_sensitive,
      is_sensitive: sensitive.is_sensitive,
      moderation_status: "active",
      sensitive_reason: sensitive.sensitive_reason,
      visibility,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(
      homeMessage(error.message || "Could not publish thread post.", "threads"),
    );
  }

  if (media && metadata && thread) {
    const upload = await uploadPostMedia({
      file: media,
      id: thread.id,
      kind: "thread",
      metadata,
      supabase,
      userId,
    });
    const { error: mediaError } = await supabase.from("thread_media").insert({
      ...mediaMetadataFields(metadata),
      media_type: "image",
      is_sensitive: sensitive.is_sensitive,
      sensitive_reason: sensitive.sensitive_reason,
      storage_bucket: upload.bucket,
      storage_path: upload.path,
      thread_id: thread.id,
    });

    if (mediaError) {
      redirect(
        homeMessage(
          mediaError.message ||
            "Image uploaded but could not attach to the thread.",
          "threads",
        ),
      );
    }
  }

  revalidatePath("/");
  redirect(homeMessage("Thread posted.", "threads"));
}

export async function editThreadPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const threadId = cleanId(formData.get("thread_id"));
  const returnPath = cleanText(formData.get("return_path"), 200) || "/#threads";
  const body = cleanText(formData.get("body"), 8000);

  if (!threadId) {
    redirect(redirectWithMessage({ message: "Choose a Gossip post first.", path: returnPath }));
  }

  if (body.length < 3) {
    redirect(
      redirectWithMessage({
        message: "Gossip post needs at least 3 characters.",
        path: returnPath,
      }),
    );
  }

  const { data: updatedThread, error } = await supabase
    .from("thread_posts")
    .update({
      body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("author_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updatedThread) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not edit Gossip post. It may be gone or owned by another account.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/t/${threadId}`);
  redirect(
    redirectWithMessage({
      message: "Gossip post updated.",
      path: returnPath,
    }),
  );
}

export async function deleteThreadPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const threadId = cleanId(formData.get("thread_id"));
  const returnPath = cleanText(formData.get("return_path"), 200) || "/#threads";

  if (!threadId) {
    redirect(redirectWithMessage({ message: "Choose a Gossip post first.", path: returnPath }));
  }

  const { data: deletedThread, error } = await supabase
    .from("thread_posts")
    .update({
      is_indexable: false,
      moderation_status: "removed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("author_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !deletedThread) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not delete Gossip post. It may be gone or owned by another account.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/t/${threadId}`);
  redirect(homeMessage("Gossip post deleted.", "threads"));
}

export async function createMarketplaceListing(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, license_verified_at")
    .eq("id", userId)
    .maybeSingle<{
      account_type: string;
      license_verified_at: string | null;
    }>();

  if (!isVerifiedProfessional(profile)) {
    redirect(
      homeMessage(
        "Verified artist, studio, or vendor status is required to list Stuff.",
        "marketplace",
      ),
    );
  }

  const title = cleanText(formData.get("title"), 120);
  const description = cleanText(formData.get("description"), 2000);
  const category = cleanText(formData.get("category"), 40) || "flash";
  const city = cleanText(formData.get("city"), 80);
  const media = mediaFromForm(formData, "media");
  const metadata = media ? await inspectMediaFile(media) : null;
  const region = cleanText(formData.get("region"), 40);
  const sensitive = sensitiveFields();
  const visibility = cleanVisibility(formData.get("visibility"), "public_preview");
  const priceInput = cleanText(formData.get("price"), 20).replace(/[$,]/g, "");
  const priceNumber = priceInput ? Number(priceInput) : NaN;
  const priceCents = Number.isFinite(priceNumber)
    ? Math.max(0, Math.round(priceNumber * 100))
    : null;

  if (title.length < 3) {
    redirect(
      homeMessage("Listing title needs at least 3 characters.", "marketplace"),
    );
  }

  if (metadata) {
    const validationMessage = validateMediaMetadata(metadata);

    if (validationMessage) {
      redirect(homeMessage(validationMessage, "marketplace"));
    }
  }

  const { data: listing, error } = await supabase
    .from("marketplace_listings")
    .insert({
      seller_id: userId,
      title,
      description: description || null,
      category,
      city: city || null,
      region: region || null,
      is_indexable: visibility === "public_preview" && !sensitive.is_sensitive,
      is_sensitive: sensitive.is_sensitive,
      moderation_status: "active",
      price_cents: priceCents,
      sensitive_reason: sensitive.sensitive_reason,
      status: "active",
      visibility,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(
      homeMessage(error.message || "Could not publish listing.", "marketplace"),
    );
  }

  if (media && metadata && listing) {
    const upload = await uploadPostMedia({
      file: media,
      id: listing.id,
      kind: "marketplace",
      metadata,
      supabase,
      userId,
    });
    const { error: mediaError } = await supabase.from("marketplace_media").insert({
      ...mediaMetadataFields(metadata),
      listing_id: listing.id,
      is_sensitive: sensitive.is_sensitive,
      media_type: upload.mediaType,
      sensitive_reason: sensitive.sensitive_reason,
      storage_bucket: upload.bucket,
      storage_path: upload.path,
    });

    if (mediaError) {
      redirect(
        homeMessage(
          mediaError.message ||
            "Media uploaded but could not attach to the listing.",
          "marketplace",
        ),
      );
    }
  }

  revalidatePath("/");
  redirect(homeMessage("Marketplace listing published.", "marketplace"));
}

export async function editMarketplaceListing(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const listingId = cleanId(formData.get("listing_id"));
  const returnPath =
    cleanText(formData.get("return_path"), 200) ||
    (listingId ? `/stuff/${listingId}` : "/#marketplace");
  const title = cleanText(formData.get("title"), 120);
  const description = cleanText(formData.get("description"), 2000);
  const category = cleanText(formData.get("category"), 40) || "flash";
  const city = cleanText(formData.get("city"), 80);
  const region = cleanText(formData.get("region"), 40);
  const priceInput = cleanText(formData.get("price"), 20).replace(/[$,]/g, "");
  const priceNumber = priceInput ? Number(priceInput) : NaN;
  const priceCents = Number.isFinite(priceNumber)
    ? Math.max(0, Math.round(priceNumber * 100))
    : null;

  if (!listingId) {
    redirect(
      redirectWithMessage({
        message: "Choose a Stuff listing first.",
        path: "/#marketplace",
      }),
    );
  }

  if (title.length < 3) {
    redirect(
      redirectWithMessage({
        message: "Listing title needs at least 3 characters.",
        path: returnPath,
      }),
    );
  }

  const { data: updatedListing, error } = await supabase
    .from("marketplace_listings")
    .update({
      category,
      city: city || null,
      description: description || null,
      price_cents: priceCents,
      region: region || null,
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("seller_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updatedListing) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not update Stuff listing. It may be gone or owned by another account.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/stuff/${listingId}`);
  redirect(
    redirectWithMessage({
      message: "Stuff listing updated.",
      path: returnPath,
    }),
  );
}

export async function archiveMarketplaceListing(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const listingId = cleanId(formData.get("listing_id"));

  if (!listingId) {
    redirect(homeMessage("Choose a Stuff listing first.", "marketplace"));
  }

  const { data: archivedListing, error } = await supabase
    .from("marketplace_listings")
    .update({
      is_indexable: false,
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("seller_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !archivedListing) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not archive Stuff listing. It may be gone or owned by another account.",
        path: `/stuff/${listingId}`,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/stuff/${listingId}`);
  redirect(homeMessage("Stuff listing archived.", "marketplace"));
}

export async function createContentReport(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const subjectType = cleanText(
    formData.get("subject_type"),
    40,
  ) as ReportSubjectType;
  const subjectId = cleanId(formData.get("subject_id"));
  const reason = cleanReportReason(formData.get("reason"));
  const details = cleanText(formData.get("details"), 500);
  const returnPath = cleanReturnPath(formData.get("return_path"), "/");
  const returnHash = cleanText(formData.get("return_hash"), 80);
  if (!REPORT_SUBJECT_TYPES.has(subjectType) || !subjectId) {
    reportRedirect({
      hash: returnHash,
      message: "Choose something to report first.",
      path: returnPath,
    });
  }

  const subjectConfig =
    subjectType === "comment" ? null : REPORT_SUBJECT_CONFIG[subjectType];
  const subjectResult = subjectConfig
    ? await supabase
        .from(subjectConfig.table)
        .select(subjectConfig.ownerColumn)
        .eq("id", subjectId)
        .maybeSingle<Record<string, string>>()
    : await findCommentSubjectOwner({ commentId: subjectId, supabase });
  const subject = subjectResult.data;
  const subjectError = subjectResult.error;

  if (subjectError || !subject) {
    reportRedirect({
      hash: returnHash,
      message: "That item is no longer available to report.",
      path: returnPath,
    });
  }

  let ownerId: string;

  if (subjectType === "comment") {
    ownerId = (subject as { author_id: string }).author_id;
  } else if (subjectConfig) {
    ownerId = (subject as Record<string, string>)[subjectConfig.ownerColumn];
  } else {
    reportRedirect({
      hash: returnHash,
      message: "Choose something to report first.",
      path: returnPath,
    });
  }

  if (ownerId === userId) {
    reportRedirect({
      hash: returnHash,
      message: "You cannot report your own content.",
      path: returnPath,
    });
  }

  const { data: existingReport } = await supabase
    .from("content_reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .in("status", ["open", "reviewing"])
    .maybeSingle<{ id: string }>();

  if (existingReport) {
    reportRedirect({
      hash: returnHash,
      message: "You already have an open report for that item.",
      path: returnPath,
    });
  }

  const { error } = await supabase.from("content_reports").insert({
    details: details || null,
    reason,
    reporter_id: userId,
    subject_id: subjectId,
    subject_type: subjectType,
  });

  if (error) {
    reportRedirect({
      hash: returnHash,
      message:
        error.code === "23505"
          ? "You already have an open report for that item."
          : error.message || "Could not send report.",
      path: returnPath,
    });
  }

  revalidatePath("/admin");
  redirect(
    redirectWithMessage({
      hash: returnHash,
      message: "Report sent to moderators.",
      path: returnPath,
    }),
  );
}

export async function archiveGig(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const gigId = cleanId(formData.get("gig_id"));
  const username = cleanText(formData.get("username"), 80);
  const returnPath = username ? `/u/${username}` : "/";

  if (!gigId) {
    redirect(
      redirectWithMessage({
        message: "Choose a gig first.",
        path: returnPath,
      }),
    );
  }

  const { data: archivedGig, error } = await supabase
    .from("gigs")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", gigId)
    .eq("poster_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !archivedGig) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not archive gig. It may be gone or owned by another account.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  if (username) revalidatePath(`/u/${username}`);

  redirect(
    redirectWithMessage({
      message: "Gig archived.",
      path: returnPath,
    }),
  );
}

const GIG_CATEGORIES = new Set([
  "apprenticeship",
  "convention",
  "event",
  "guest_spot",
  "job",
  "shop_opening",
]);

export async function editGig(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const gigId = cleanId(formData.get("gig_id"));
  const returnPath =
    cleanText(formData.get("return_path"), 200) ||
    (gigId ? `/gigs/${gigId}` : "/#gigs");
  const title = cleanText(formData.get("title"), 140);
  const description = cleanText(formData.get("description"), 2400);
  const rawCategory = cleanText(formData.get("category"), 40);
  const category = GIG_CATEGORIES.has(rawCategory) ? rawCategory : "job";
  const city = cleanText(formData.get("city"), 80);
  const region = cleanText(formData.get("region"), 80);
  const country = cleanText(formData.get("country"), 80) || "US";
  const compensation = cleanText(formData.get("compensation"), 120);
  const contactUrl = cleanExternalUrl(formData.get("contact_url"), 240);

  if (!gigId) {
    redirect(homeMessage("Choose a Gig first.", "gigs"));
  }

  if (title.length < 3) {
    redirect(
      redirectWithMessage({
        message: "Gig title needs at least 3 characters.",
        path: returnPath,
      }),
    );
  }

  const { data: updatedGig, error } = await supabase
    .from("gigs")
    .update({
      category,
      city: city || null,
      compensation: compensation || null,
      contact_url: contactUrl || null,
      country: country || null,
      description: description || null,
      region: region || null,
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gigId)
    .eq("poster_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updatedGig) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not update Gig. It may be gone or owned by another account.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/gigs/${gigId}`);
  redirect(
    redirectWithMessage({
      message: "Gig updated.",
      path: returnPath,
    }),
  );
}

export async function archiveGigFromDetail(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const gigId = cleanId(formData.get("gig_id"));

  if (!gigId) {
    redirect(homeMessage("Choose a Gig first.", "gigs"));
  }

  const { data: archivedGig, error } = await supabase
    .from("gigs")
    .update({
      is_indexable: false,
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", gigId)
    .eq("poster_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !archivedGig) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not archive Gig. It may be gone or owned by another account.",
        path: `/gigs/${gigId}`,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/gigs/${gigId}`);
  redirect(homeMessage("Gig archived.", "gigs"));
}

export async function editMerchProduct(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const productId = cleanId(formData.get("product_id"));
  const returnPath =
    cleanText(formData.get("return_path"), 200) ||
    (productId ? `/merch/${productId}` : "/#merch");
  const title = cleanText(formData.get("title"), 120);
  const description = cleanText(formData.get("description"), 4000);
  const rawCategory = cleanText(formData.get("category"), 40);
  const category = MERCH_CATEGORIES.has(rawCategory) ? rawCategory : "other";
  const priceInput = cleanText(formData.get("price"), 20).replace(/[$,]/g, "");
  const priceNumber = priceInput ? Number(priceInput) : NaN;
  const priceCents = Number.isFinite(priceNumber)
    ? Math.max(0, Math.round(priceNumber * 100))
    : null;
  const inventoryInput = cleanText(formData.get("inventory_quantity"), 12);
  const inventoryNumber = inventoryInput ? Number(inventoryInput) : NaN;
  const inventoryQuantity = Number.isFinite(inventoryNumber)
    ? Math.max(0, Math.floor(inventoryNumber))
    : null;
  const shippingRequired = formData.get("shipping_required") === "on";
  const shipsFromCity = cleanText(formData.get("ships_from_city"), 80);
  const shipsFromRegion = cleanText(formData.get("ships_from_region"), 80);

  if (!productId) {
    redirect(homeMessage("Choose a Merch product first.", "merch"));
  }

  if (title.length < 3) {
    redirect(
      redirectWithMessage({
        message: "Merch title needs at least 3 characters.",
        path: returnPath,
      }),
    );
  }

  if (priceCents == null) {
    redirect(
      redirectWithMessage({
        message: "Add a valid Merch price.",
        path: returnPath,
      }),
    );
  }

  if (inventoryQuantity == null) {
    redirect(
      redirectWithMessage({
        message: "Add a valid Merch inventory quantity.",
        path: returnPath,
      }),
    );
  }

  const { data: product, error: productError } = await supabase
    .from("merch_products")
    .select(
      "id, seller_id, status, is_official, inventory_reserved, profiles:profiles!merch_products_seller_id_fkey(account_type, license_verified_at)",
    )
    .eq("id", productId)
    .maybeSingle<{
      id: string;
      inventory_reserved: number;
      is_official: boolean;
      profiles: { account_type: string; license_verified_at: string | null } | null;
      seller_id: string;
      status: string;
    }>();

  if (productError || !product) {
    redirect(
      redirectWithMessage({
        message: productError?.message || "Merch product was not found.",
        path: returnPath,
      }),
    );
  }

  if (product.seller_id !== userId) {
    redirect(
      redirectWithMessage({
        message: "You can only edit your own Merch.",
        path: returnPath,
      }),
    );
  }

  if (product.is_official) {
    redirect(
      redirectWithMessage({
        message: "Official TTC Merch must be edited from admin.",
        path: returnPath,
      }),
    );
  }

  if (!isVerifiedProfessional(product.profiles)) {
    redirect(
      redirectWithMessage({
        message: "Verified artist, studio, or vendor status is required to edit Merch.",
        path: returnPath,
      }),
    );
  }

  if (inventoryQuantity < product.inventory_reserved) {
    redirect(
      redirectWithMessage({
        message: "Inventory cannot be lower than reserved checkout quantity.",
        path: returnPath,
      }),
    );
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    redirect(
      redirectWithMessage({
        message: "Merch edits need owner tools enabled first.",
        path: returnPath,
      }),
    );
  }

  const nextStatus =
    product.status === "active" || product.status === "approved"
      ? "pending_review"
      : product.status;
  const { data: updatedProduct, error } = await adminClient
    .from("merch_products")
    .update({
      category,
      description: description || null,
      inventory_quantity: inventoryQuantity,
      is_indexable: nextStatus === "active",
      price_cents: priceCents,
      shipping_required: shippingRequired,
      ships_from_city: shipsFromCity || null,
      ships_from_region: shipsFromRegion || null,
      status: nextStatus,
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("seller_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updatedProduct) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not update Merch product. It may be gone or owned by another account.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/merch/${productId}`);
  revalidatePath("/admin/merch");

  if (nextStatus !== product.status) {
    redirect(homeMessage("Merch updated and sent back to review.", "merch"));
  }

  redirect(
    redirectWithMessage({
      message: "Merch product updated.",
      path: returnPath,
    }),
  );
}

export async function archiveMerchProduct(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const productId = cleanId(formData.get("product_id"));

  if (!productId) {
    redirect(homeMessage("Choose a Merch product first.", "merch"));
  }

  const { data: product, error: productError } = await supabase
    .from("merch_products")
    .select("id, seller_id, is_official")
    .eq("id", productId)
    .maybeSingle<{ id: string; is_official: boolean; seller_id: string }>();

  if (productError || !product) {
    redirect(
      redirectWithMessage({
        message: productError?.message || "Merch product was not found.",
        path: `/merch/${productId}`,
      }),
    );
  }

  if (product.seller_id !== userId) {
    redirect(
      redirectWithMessage({
        message: "You can only archive your own Merch.",
        path: `/merch/${productId}`,
      }),
    );
  }

  if (product.is_official) {
    redirect(
      redirectWithMessage({
        message: "Official TTC Merch must be archived from admin.",
        path: `/merch/${productId}`,
      }),
    );
  }

  const { data: archivedProduct, error } = await supabase
    .from("merch_products")
    .update({
      is_indexable: false,
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("seller_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !archivedProduct) {
    redirect(
      redirectWithMessage({
        message:
          error?.message ||
          "Could not archive Merch product. It may be gone or owned by another account.",
        path: `/merch/${productId}`,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath(`/merch/${productId}`);
  revalidatePath("/admin/merch");
  redirect(homeMessage("Merch product archived.", "merch"));
}

export async function togglePostLike(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const postId = cleanId(formData.get("post_id"));
  const liked = cleanText(formData.get("liked"), 8) === "true";
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#feed");

  if (!postId) {
    redirect(homeMessage("Choose a post first."));
  }

  const result = liked
    ? await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId)
    : await supabase.from("post_likes").upsert({
        post_id: postId,
        user_id: userId,
      });

  if (result.error) {
    redirect(homeMessage(result.error.message || "Could not update like."));
  }

  if (!liked) {
    const [{ data: post }, actorName] = await Promise.all([
      supabase
        .from("feed_posts")
        .select("author_id")
        .eq("id", postId)
        .maybeSingle<{ author_id: string }>(),
      currentDisplayName({ supabase, userId }),
    ]);

    await notifyContentOwner({
      actorId: userId,
      body: `${actorName} liked your feed post.`,
      href: `/p/${postId}`,
      ownerId: post?.author_id,
      subjectId: postId,
      subjectType: "feed_post",
      supabase,
      title: "New like",
      type: "feed_like",
    });
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function toggleSavedItem(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const subjectType = cleanText(
    formData.get("subject_type"),
    40,
  ) as SavedSubjectType;
  const subjectId = cleanId(formData.get("subject_id"));
  const saved = cleanText(formData.get("saved"), 8) === "true";
  const returnPath = cleanText(formData.get("return_path"), 200) || "/";
  const returnHash = cleanText(formData.get("return_hash"), 80);

  if (!SAVED_SUBJECT_TYPES.has(subjectType) || !subjectId) {
    redirect(
      redirectWithMessage({
        hash: returnHash,
        message: "Choose something to save first.",
        path: returnPath,
      }),
    );
  }

  const result = saved
    ? await supabase
        .from("saved_items")
        .delete()
        .eq("user_id", userId)
        .eq("subject_type", subjectType)
        .eq("subject_id", subjectId)
    : await supabase.from("saved_items").upsert({
        subject_id: subjectId,
        subject_type: subjectType,
        user_id: userId,
      });

  if (result.error) {
    redirect(
      redirectWithMessage({
        hash: returnHash,
        message: result.error.message || "Could not update saved item.",
        path: returnPath,
      }),
    );
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(
    redirectWithMessage({
      hash: returnHash,
      message: saved ? "Removed from saved." : "Saved.",
      path: returnPath,
    }),
  );
}

export async function createPostComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const body = cleanWords(formData.get("body"), 40);
  const media = mediaFromForm(formData, "media");
  const postId = cleanId(formData.get("post_id"));
  const parentId = cleanId(formData.get("parent_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#feed");

  if (!postId) {
    redirect(homeMessage("Choose a post first."));
  }

  if (!body && !media) {
    redirect(homeMessage("Comment needs text, a photo, or a GIF."));
  }

  let metadata: MediaMetadata | null = null;

  if (media) {
    metadata = await inspectMediaFile(media);
    const validationMessage = validateMediaMetadata(metadata);

    if (validationMessage || metadata.mediaType !== "image") {
      redirect(homeMessage(validationMessage || "Comments support photos and GIFs only."));
    }

    if (metadata.fileSizeBytes > 5 * 1024 * 1024) {
      redirect(homeMessage("Comment images and GIFs can be up to 5 MB."));
    }
  }

  const commentId = crypto.randomUUID();
  const upload =
    media && metadata
      ? await uploadCommentMedia({
          commentId,
          file: media,
          metadata,
          supabase,
          userId,
        })
      : null;

  if (upload?.error || (media && !upload?.path)) {
    redirect(homeMessage(upload?.error || "Could not upload comment media."));
  }

  const { error } = await supabase.from("post_comments").insert({
    id: commentId,
    author_id: userId,
    body,
    parent_id: parentId || null,
    post_id: postId,
  });

  if (error) {
    if (upload?.path) await supabase.storage.from(MEDIA_BUCKET).remove([upload.path]);
    redirect(homeMessage(error.message || "Could not add comment."));
  }

  if (upload?.path && metadata) {
    const { error: mediaError } = await supabase.from("post_comment_media").insert({
      ...mediaMetadataFields(metadata),
      comment_id: commentId,
      media_type: upload.mediaType,
      storage_bucket: upload.bucket,
      storage_path: upload.path,
    });

    if (mediaError) {
      await supabase.storage.from(MEDIA_BUCKET).remove([upload.path]);
      await supabase.rpc("delete_post_comment_for_current_user", {
        target_comment_id: commentId,
      });
      redirect(homeMessage(mediaError.message || "Could not attach comment media."));
    }
  }

  const [{ data: post }, { data: parentComment }, actorName] = await Promise.all([
    supabase
      .from("feed_posts")
      .select("author_id")
      .eq("id", postId)
      .maybeSingle<{ author_id: string }>(),
    parentId
      ? supabase
          .from("post_comments")
          .select("author_id")
          .eq("id", parentId)
          .maybeSingle<{ author_id: string }>()
      : Promise.resolve({ data: null }),
    currentDisplayName({ supabase, userId }),
  ]);

  await notifyContentOwner({
    actorId: userId,
    body: `${actorName}: ${body || "sent a photo or GIF comment."}`,
    href: `/p/${postId}`,
    ownerId: post?.author_id,
    subjectId: postId,
    subjectType: "feed_post",
    supabase,
    title: "New feed comment",
    type: "feed_comment",
  });

  if (parentComment?.author_id && parentComment.author_id !== post?.author_id) {
    await notifyContentOwner({
      actorId: userId,
      body: `${actorName} replied: ${body || "sent a photo or GIF reply."}`,
      href: `/p/${postId}`,
      ownerId: parentComment.author_id,
      subjectId: postId,
      subjectType: "feed_post",
      supabase,
      title: "New comment reply",
      type: "feed_comment",
    });
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function togglePostCommentLike(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const liked = cleanText(formData.get("liked"), 8) === "true";
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#feed");

  if (!commentId) {
    redirect(homeMessage("Choose a comment first."));
  }

  const result = liked
    ? await supabase
        .from("post_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId)
    : await supabase.from("post_comment_likes").upsert({
        comment_id: commentId,
        user_id: userId,
      });

  if (result.error) {
    redirect(homeMessage(result.error.message || "Could not update comment like."));
  }

  if (!liked) {
    const [{ data: comment }, actorName] = await Promise.all([
      supabase
        .from("post_comments")
        .select("author_id, post_id")
        .eq("id", commentId)
        .maybeSingle<{ author_id: string; post_id: string }>(),
      currentDisplayName({ supabase, userId }),
    ]);

    await notifyContentOwner({
      actorId: userId,
      body: `${actorName} liked your 4U comment.`,
      href: comment?.post_id ? `/p/${comment.post_id}` : returnPath,
      ownerId: comment?.author_id,
      subjectId: comment?.post_id ?? commentId,
      subjectType: "feed_post",
      supabase,
      title: "New comment like",
      type: "feed_like",
    });
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function editPostComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const body = cleanWords(formData.get("body"), 40);
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#feed");

  if (!commentId || !body) {
    redirect(homeMessage("Comment cannot be empty.", "feed"));
  }

  const { error } = await supabase
    .from("post_comments")
    .update({
      body,
      deleted_at: null,
      deleted_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("author_id", userId);

  if (error) {
    redirect(homeMessage(error.message || "Could not edit comment.", "feed"));
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function deletePostComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#feed");

  if (!commentId) {
    redirect(homeMessage("Choose a comment first.", "feed"));
  }

  const { data: comment, error: commentError } = await supabase
    .from("post_comments")
    .select("author_id, feed_posts!inner(author_id)")
    .eq("id", commentId)
    .maybeSingle<{
      author_id: string;
      feed_posts: { author_id: string };
    }>();

  if (
    commentError ||
    !comment ||
    (comment.author_id !== userId && comment.feed_posts.author_id !== userId)
  ) {
    redirect(homeMessage("Only the comment author or post owner can delete it.", "feed"));
  }

  const { error } = await supabase.rpc(
    "delete_post_comment_for_current_user",
    {
      target_comment_id: commentId,
    },
  );

  if (error) {
    redirect(homeMessage(error.message || "Could not delete comment.", "feed"));
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function hidePostComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#feed");
  const reason = cleanText(formData.get("reason"), 240);

  if (!commentId) {
    redirect(homeMessage("Choose a comment first.", "feed"));
  }

  const { error } = await supabase.from("post_comment_hides").upsert({
    comment_id: commentId,
    hidden_by: userId,
    reason: reason || null,
  });

  if (error) {
    redirect(homeMessage(error.message || "Could not hide comment.", "feed"));
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function blockPostCommentAuthor(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#feed");

  if (!commentId) {
    redirect(homeMessage("Choose a comment first.", "feed"));
  }

  const { data: comment, error: commentError } = await supabase
    .from("post_comments")
    .select("author_id, post_id, feed_posts!inner(author_id)")
    .eq("id", commentId)
    .maybeSingle<{
      author_id: string;
      feed_posts: { author_id: string };
      post_id: string;
    }>();

  if (commentError || !comment || comment.feed_posts.author_id !== userId) {
    redirect(homeMessage("Only the post owner can block from this comment.", "feed"));
  }

  if (comment.author_id !== userId) {
    await supabase.from("user_blocks").upsert(
      {
        blocked_id: comment.author_id,
        blocker_id: userId,
        reason: "Blocked from comment moderation.",
      },
      { onConflict: "blocker_id,blocked_id" },
    );
    await removeFollowRelationship({
      blockedId: comment.author_id,
      blockerId: userId,
      supabase,
    });
  }

  await supabase.from("post_comment_hides").upsert({
    comment_id: commentId,
    hidden_by: userId,
    reason: "Blocked commenter.",
  });

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function toggleThreadLike(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const threadId = cleanId(formData.get("thread_id"));
  const liked = cleanText(formData.get("liked"), 8) === "true";
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#threads");

  if (!threadId) {
    redirect(homeMessage("Choose a thread first."));
  }

  const result = liked
    ? await supabase
        .from("thread_likes")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", userId)
    : await supabase.from("thread_likes").upsert({
        thread_id: threadId,
        user_id: userId,
      });

  if (result.error) {
    redirect(homeMessage(result.error.message || "Could not update thread like."));
  }

  if (!liked) {
    const [{ data: thread }, actorName] = await Promise.all([
      supabase
        .from("thread_posts")
        .select("author_id")
        .eq("id", threadId)
        .maybeSingle<{ author_id: string }>(),
      currentDisplayName({ supabase, userId }),
    ]);

    await notifyContentOwner({
      actorId: userId,
      body: `${actorName} liked your thread.`,
      href: `/t/${threadId}`,
      ownerId: thread?.author_id,
      subjectId: threadId,
      subjectType: "thread_post",
      supabase,
      title: "New thread like",
      type: "thread_like",
    });
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function createThreadComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const body = cleanText(formData.get("body"), 2000);
  const media = mediaFromForm(formData, "media");
  const threadId = cleanId(formData.get("thread_id"));
  const parentId = cleanId(formData.get("parent_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#threads");

  if (!threadId) {
    redirect(homeMessage("Choose a thread first."));
  }

  if (!body && !media) {
    redirect(homeMessage("Reply needs text, a photo, or a GIF."));
  }

  let metadata: MediaMetadata | null = null;

  if (media) {
    metadata = await inspectMediaFile(media);
    const validationMessage = validateMediaMetadata(metadata);

    if (validationMessage || metadata.mediaType !== "image") {
      redirect(homeMessage(validationMessage || "Gossip comments support photos and GIFs only."));
    }

    if (metadata.fileSizeBytes > 5 * 1024 * 1024) {
      redirect(homeMessage("Comment images and GIFs can be up to 5 MB."));
    }
  }

  const commentId = crypto.randomUUID();
  const upload =
    media && metadata
      ? await uploadCommentMedia({
          commentId,
          file: media,
          metadata,
          supabase,
          userId,
        })
      : null;

  if (upload?.error || (media && !upload?.path)) {
    redirect(homeMessage(upload?.error || "Could not upload comment media."));
  }

  const { error } = await supabase.from("thread_comments").insert({
    id: commentId,
    author_id: userId,
    body,
    parent_id: parentId || null,
    thread_id: threadId,
  });

  if (error) {
    if (upload?.path) await supabase.storage.from(MEDIA_BUCKET).remove([upload.path]);
    redirect(homeMessage(error.message || "Could not add thread comment."));
  }

  if (upload?.path && metadata) {
    const { error: mediaError } = await supabase.from("thread_comment_media").insert({
      ...mediaMetadataFields(metadata),
      comment_id: commentId,
      media_type: upload.mediaType,
      storage_bucket: upload.bucket,
      storage_path: upload.path,
    });

    if (mediaError) {
      await supabase.storage.from(MEDIA_BUCKET).remove([upload.path]);
      await supabase.rpc("delete_thread_comment_for_current_user", {
        target_comment_id: commentId,
      });
      redirect(homeMessage(mediaError.message || "Could not attach comment media."));
    }
  }

  const [{ data: thread }, { data: parentComment }, actorName] = await Promise.all([
    supabase
      .from("thread_posts")
      .select("author_id")
      .eq("id", threadId)
      .maybeSingle<{ author_id: string }>(),
    parentId
      ? supabase
          .from("thread_comments")
          .select("author_id")
          .eq("id", parentId)
          .maybeSingle<{ author_id: string }>()
      : Promise.resolve({ data: null }),
    currentDisplayName({ supabase, userId }),
  ]);

  await notifyContentOwner({
    actorId: userId,
    body: `${actorName}: ${body || "sent a photo or GIF comment."}`,
    href: `/t/${threadId}`,
    ownerId: thread?.author_id,
    subjectId: threadId,
    subjectType: "thread_post",
    supabase,
    title: "New thread comment",
    type: "thread_comment",
  });

  if (parentComment?.author_id && parentComment.author_id !== thread?.author_id) {
    await notifyContentOwner({
      actorId: userId,
      body: `${actorName} replied: ${body || "sent a photo or GIF reply."}`,
      href: `/t/${threadId}`,
      ownerId: parentComment.author_id,
      subjectId: threadId,
      subjectType: "thread_post",
      supabase,
      title: "New comment reply",
      type: "thread_comment",
    });
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function toggleThreadCommentLike(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const liked = cleanText(formData.get("liked"), 8) === "true";
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#threads");

  if (!commentId) {
    redirect(homeMessage("Choose a comment first."));
  }

  const result = liked
    ? await supabase
        .from("thread_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId)
    : await supabase.from("thread_comment_likes").upsert({
        comment_id: commentId,
        user_id: userId,
      });

  if (result.error) {
    redirect(homeMessage(result.error.message || "Could not update comment like."));
  }

  if (!liked) {
    const [{ data: comment }, actorName] = await Promise.all([
      supabase
        .from("thread_comments")
        .select("author_id, thread_id")
        .eq("id", commentId)
        .maybeSingle<{ author_id: string; thread_id: string }>(),
      currentDisplayName({ supabase, userId }),
    ]);

    await notifyContentOwner({
      actorId: userId,
      body: `${actorName} liked your Gossip comment.`,
      href: comment?.thread_id ? `/t/${comment.thread_id}` : returnPath,
      ownerId: comment?.author_id,
      subjectId: comment?.thread_id ?? commentId,
      subjectType: "thread_post",
      supabase,
      title: "New comment like",
      type: "thread_like",
    });
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function editThreadComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const body = cleanText(formData.get("body"), 2000);
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#threads");

  if (!commentId || !body) {
    redirect(homeMessage("Comment cannot be empty.", "threads"));
  }

  const { error } = await supabase
    .from("thread_comments")
    .update({
      body,
      deleted_at: null,
      deleted_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("author_id", userId);

  if (error) {
    redirect(homeMessage(error.message || "Could not edit comment.", "threads"));
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function deleteThreadComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#threads");

  if (!commentId) {
    redirect(homeMessage("Choose a comment first.", "threads"));
  }

  const { data: comment, error: commentError } = await supabase
    .from("thread_comments")
    .select("author_id, thread_posts!inner(author_id)")
    .eq("id", commentId)
    .maybeSingle<{
      author_id: string;
      thread_posts: { author_id: string };
    }>();

  if (
    commentError ||
    !comment ||
    (comment.author_id !== userId && comment.thread_posts.author_id !== userId)
  ) {
    redirect(
      homeMessage("Only the comment author or thread owner can delete it.", "threads"),
    );
  }

  const { error } = await supabase.rpc(
    "delete_thread_comment_for_current_user",
    {
      target_comment_id: commentId,
    },
  );

  if (error) {
    redirect(homeMessage(error.message || "Could not delete comment.", "threads"));
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function hideThreadComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#threads");
  const reason = cleanText(formData.get("reason"), 240);

  if (!commentId) {
    redirect(homeMessage("Choose a comment first.", "threads"));
  }

  const { error } = await supabase.from("thread_comment_hides").upsert({
    comment_id: commentId,
    hidden_by: userId,
    reason: reason || null,
  });

  if (error) {
    redirect(homeMessage(error.message || "Could not hide comment.", "threads"));
  }

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}

export async function blockThreadCommentAuthor(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const commentId = cleanId(formData.get("comment_id"));
  const returnPath = cleanReturnPath(formData.get("return_path"), "/#threads");

  if (!commentId) {
    redirect(homeMessage("Choose a comment first.", "threads"));
  }

  const { data: comment, error: commentError } = await supabase
    .from("thread_comments")
    .select("author_id, thread_id, thread_posts!inner(author_id)")
    .eq("id", commentId)
    .maybeSingle<{
      author_id: string;
      thread_id: string;
      thread_posts: { author_id: string };
    }>();

  if (commentError || !comment || comment.thread_posts.author_id !== userId) {
    redirect(
      homeMessage("Only the thread owner can block from this comment.", "threads"),
    );
  }

  if (comment.author_id !== userId) {
    await supabase.from("user_blocks").upsert(
      {
        blocked_id: comment.author_id,
        blocker_id: userId,
        reason: "Blocked from comment moderation.",
      },
      { onConflict: "blocker_id,blocked_id" },
    );
    await removeFollowRelationship({
      blockedId: comment.author_id,
      blockerId: userId,
      supabase,
    });
  }

  await supabase.from("thread_comment_hides").upsert({
    comment_id: commentId,
    hidden_by: userId,
    reason: "Blocked commenter.",
  });

  revalidatePath("/");
  revalidateReturnPath(returnPath);
  redirect(returnPath);
}
